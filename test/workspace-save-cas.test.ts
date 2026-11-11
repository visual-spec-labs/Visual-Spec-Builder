import { createServer, request, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";
import { WORKSPACE_EXPECTED_REVISION_HEADER as expectedHeader, WORKSPACE_REVISION_HEADER as revisionHeader } from "@/features/workspace/protocol";

import { blankSpec } from "@/features/editor/store/blankSpec";

let root: string;
let server: Server;
let url: string;
let port: number;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "vsb-cas-")); ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => res.end()));
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  port = (server.address() as AddressInfo).port;
  url = `http://127.0.0.1:${port}/__vs/file/specs/`;
});
afterEach(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(root, { recursive: true, force: true });
});
const put = (name: string, text: string, revision: string, host = "127.0.0.1"): Promise<{ status: number }> => new Promise((done, reject) => {
  const req = request({ hostname: "127.0.0.1", port, path: `/__vs/file/specs/${name}`, method: "PUT",
    headers: { [expectedHeader]: revision, host: `${host}:${port}`, origin: `http://${host}:${port}` } }, (res) => {
    res.resume(); res.on("end", () => done({ status: res.statusCode! }));
  });
  req.on("error", reject); req.end(text);
});

describe("disk Save compare-and-write across accepted origins", () => {
  it("two origins editing the same loaded revision produce one winner and one preserved conflict", async () => {
    writeFileSync(join(root, "specs/a.json"), "original");
    const loaded = await fetch(url + "a.json");
    const revision = loaded.headers.get(revisionHeader)!;
    expect(await loaded.text()).toBe("original");
    const responses = await Promise.all([put("a.json", "tab A", revision, "localhost"), put("a.json", "tab B", revision)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? "tab A" : "tab B";
    expect(readFileSync(join(root, "specs/a.json"), "utf8")).toBe(winner);
    const latest = await fetch(url + "a.json");
    expect(latest.headers.get(revisionHeader)).not.toBe(revision);
    expect((await put("a.json", "after explicit reload", latest.headers.get(revisionHeader)!, "[::1]")).status).toBe(200);
  });
  it("requires a revision, rejects stale retries and never recreates renamed/deleted source", async () => {
    writeFileSync(join(root, "specs/a.json"), "original");
    const revision = (await fetch(url + "a.json")).headers.get(revisionHeader)!;
    expect((await fetch(url + "a.json", { method: "PUT", body: "old client" })).status).toBe(428);
    expect(readFileSync(join(root, "specs/a.json"), "utf8")).toBe("original");
    unlinkSync(join(root, "specs/a.json"));
    expect((await put("a.json", "stale source", revision)).status).toBe(409);
    expect((await fetch(url + "a.json")).status).toBe(404);
  });
  it("rename returns the new revision and stale source Saves cannot recreate the original", async () => {
    const original = JSON.stringify(blankSpec);
    writeFileSync(join(root, "specs/old.json"), original);
    const oldRevision = (await fetch(url + "old.json")).headers.get(revisionHeader)!;
    const renamed = await fetch(`http://127.0.0.1:${port}/__vs/rename`, { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "old.json", name: "New", expectedText: original }) });
    expect(renamed.status).toBe(200);
    const revision = renamed.headers.get(revisionHeader)!;
    expect(revision).toMatch(/^[a-f0-9]{64}$/);
    expect((await put("old.json", "stale draft", oldRevision, "localhost")).status).toBe(409);
    expect((await fetch(url + "old.json")).status).toBe(404);
    expect((await put("New.json", "saved after rename", revision)).status).toBe(200);
  });
  it("rename and cross-origin Save as serialize case-insensitive destination collisions", async () => {
    const original = JSON.stringify(blankSpec);
    writeFileSync(join(root, "specs/old.json"), original);
    const responses = await Promise.all([
      fetch(`http://127.0.0.1:${port}/__vs/rename`, { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "old.json", name: "New", expectedText: original }) }),
      put("new.json", "other tab", "missing", "localhost"),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  });
  it("Save as is create-only and case variants cannot overwrite or create duplicate projects", async () => {
    const responses = await Promise.all([put("New.json", "first", "missing", "localhost"), put("new.json", "second", "missing")]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const name = responses[0].status === 200 ? "New.json" : "new.json";
    const saved = readFileSync(join(root, "specs", name), "utf8");
    expect((await put(name, "overwrite", "missing")).status).toBe(409);
    expect(readFileSync(join(root, "specs", name), "utf8")).toBe(saved);
  });
});
