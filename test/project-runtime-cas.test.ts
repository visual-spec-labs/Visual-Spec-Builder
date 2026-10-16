import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";
import { WORKSPACE_EXPECTED_REVISION_HEADER as expectedHeader, WORKSPACE_REVISION_HEADER as revisionHeader, WORKSPACE_REQUEST_OWNER_HEADER as ownerHeader } from "@/features/workspace/protocol";

let root: string; let server: Server; let origin: string;
const snapshot = "project-input-request_A.json";
const sidecar = `project-generation-${"a".repeat(64)}.json`;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "vsb-project-cas-")); ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => res.end()));
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>(done => server.close(() => done()));
  rmSync(root, { recursive: true, force: true });
});
async function put(name: string, body: string, revision?: string) {
  const response = await fetch(`${origin}/__vs/file/runtime/${name}`, { method: "PUT", body,
    headers: { origin, ...(revision === undefined ? {} : { [expectedHeader]: revision }) } });
  await response.text(); return response;
}
async function get(name: string) {
  const response = await fetch(`${origin}/__vs/file/runtime/${name}`);
  return { status: response.status, revision: response.headers.get(revisionHeader), text: await response.text() };
}

describe("project runtime snapshot/provenance compare-and-write", () => {
  it("requires a create-only token and never overwrites a snapshot, including identical retries", async () => {
    expect((await put(snapshot, "first")).status).toBe(428);
    expect((await put(snapshot, "first", "bad")).status).toBe(400);
    const created = await put(snapshot, "first", "missing"); expect(created.status).toBe(200);
    const loaded = await get(snapshot);
    expect(loaded.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(created.headers.get(revisionHeader)).toBe(loaded.revision);
    expect((await put(snapshot, "first", "missing")).status).toBe(409);
    expect((await put(snapshot, "replace", loaded.revision!)).status).toBe(409);
    expect((await get(snapshot)).text).toBe("first");
  });
  it("serializes concurrent snapshot creates and rejects case-only aliases", async () => {
    const result = await Promise.all([put(snapshot, "A", "missing"), put(snapshot, "B", "missing")]);
    expect(result.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await put("project-input-request_a.json", "alias", "missing")).status).toBe(409);
    expect(readFileSync(join(root, "runtime", snapshot), "utf8")).toBe(result[0].status === 200 ? "A" : "B");
  });
  it("requires provenance revisions and preserves the winner of concurrent updates", async () => {
    expect((await put(sidecar, "initial")).status).toBe(428);
    expect((await put(sidecar, "initial", "missing")).status).toBe(200);
    const old = await get(sidecar);
    const result = await Promise.all([put(sidecar, "A", old.revision!), put(sidecar, "B", old.revision!)]);
    expect(result.map(r => r.status).sort()).toEqual([200, 409]);
    const current = await get(sidecar);
    expect(current.text).toBe(result[0].status === 200 ? "A" : "B");
    writeFileSync(join(root, "runtime", sidecar), "external edit");
    expect((await put(sidecar, "stale", current.revision!)).status).toBe(409);
    expect((await get(sidecar)).text).toBe("external edit");
  });
  it.each(["Project-input-a.json", "project-input-.json", "project-generation-short.json", `project-generation-${"A".repeat(64)}.json`])("rejects noncanonical reserved path %s", async name => {
    expect((await put(name, "bad", "missing")).status).toBe(400);
  });
  it("leaves legacy runtime writes and deletion restrictions unchanged", async () => {
    expect((await put("ticket-response.json", "legacy")).status).toBe(200);
    expect((await get("ticket-response.json")).revision).toBeNull();
    expect((await put(snapshot, "kept", "missing")).status).toBe(200);
    const response = await fetch(`${origin}/__vs/file/runtime/${snapshot}`, { method: "DELETE", headers: { origin, [expectedHeader]: (await get(snapshot)).revision! } });
    expect(response.status).toBe(405); await response.text();
    expect((await get(snapshot)).text).toBe("kept");
  });
});


describe("project sidecar recovery removal", () => {
  async function lease(method: string, owner: string) {
    const response = await fetch(`${origin}/__vs/request-lock/ticket`, { method, headers: { origin, [ownerHeader]: owner } });
    await response.text(); return response.status;
  }
  async function remove(name: string, revision?: string, owner?: string) {
    const response = await fetch(`${origin}/__vs/file/runtime/${name}`, {method:"DELETE",headers:{origin,
      ...(revision === undefined ? {} : {[expectedHeader]:revision}), ...(owner === undefined ? {} : {[ownerHeader]:owner})}});
    await response.text();return response.status;
  }
  it("requires both an exact hash and a current lease to remove a sidecar whose prior state was absent", async () => {
    await put(sidecar,"accepted","missing");const revision=(await get(sidecar)).revision!;
    expect(await remove(sidecar,revision)).toBe(428);
    expect(await lease("POST","restore")).toBe(200);
    expect(await remove(sidecar,undefined,"restore")).toBe(428);
    expect(await remove(sidecar,"missing","restore")).toBe(428);
    expect(await remove(sidecar,"0".repeat(64),"restore")).toBe(409);
    expect(await remove(sidecar,revision,"other")).toBe(409);
    expect((await get(sidecar)).text).toBe("accepted");
    expect(await remove(sidecar,revision,"restore")).toBe(200);
    expect((await get(sidecar)).status).toBe(404);
  });
  it("preserves same bytes when the recovery lease was superseded", async () => {
    await put(sidecar,"same bytes","missing");const revision=(await get(sidecar)).revision!;
    expect(await lease("POST","old")).toBe(200);expect(await lease("DELETE","old")).toBe(200);
    expect(await lease("POST","new")).toBe(200);
    expect(await remove(sidecar,revision,"old")).toBe(409);expect((await get(sidecar)).text).toBe("same bytes");
  });
  it("fences provenance PUT when the caller supplies a lease owner", async () => {
    await put(sidecar,"original","missing");const revision=(await get(sidecar)).revision!;
    expect(await lease("POST","current")).toBe(200);
    const save = async (owner:string) => {
      const result=await fetch(`${origin}/__vs/file/runtime/${sidecar}`,{method:"PUT",body:"updated",headers:{origin,[expectedHeader]:revision,[ownerHeader]:owner}});
      await result.text();return result.status;
    };
    expect(await save("lost")).toBe(409);expect((await get(sidecar)).text).toBe("original");
    expect(await save("current")).toBe(200);
  });
  it("serializes matching deletes and keeps other runtime paths forbidden", async () => {
    await put(sidecar,"one","missing");const revision=(await get(sidecar)).revision!;
    expect(await lease("POST","restore")).toBe(200);
    expect((await Promise.all([remove(sidecar,revision,"restore"),remove(sidecar,revision,"restore")])).sort()).toEqual([200,409]);
    for(const name of [snapshot,"ticket-response.json","project-generation-short.json",`project-generation-${"A".repeat(64)}.json`]) {
      expect(await remove(name,revision,"restore")).toBe(405);
    }
  });
});
