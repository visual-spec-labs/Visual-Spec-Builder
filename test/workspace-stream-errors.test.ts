import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mode: "normal" as "normal" | "missing" | "io" | "partial" | "cancel",
  stream: undefined as PassThrough | undefined,
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    createReadStream: ((path, options) => {
      if (state.mode === "normal") return actual.createReadStream(path, options);
      if (state.mode === "missing") {
        // The real stat has already succeeded; make the async open fail.
        actual.unlinkSync(path);
        return actual.createReadStream(path, options);
      }
      const stream = new PassThrough();
      state.stream = stream;
      if (state.mode === "io") {
        queueMicrotask(() => stream.destroy(Object.assign(new Error("read failed"), { code: "EIO" })));
      } else {
        queueMicrotask(() => stream.write("part"));
      }
      return stream;
    }) as typeof actual.createReadStream,
  };
});
const { createWorkspaceMiddleware, ensureWorkspaceDirs } = await import("@/features/workspace/workspaceServer");
let root: string;
let server: Server;
let base: string;
beforeEach(async () => {
  state.mode = "normal";
  root = mkdtempSync(join(tmpdir(), "vsb-stream-errors-"));
  ensureWorkspaceDirs(root);
  writeFileSync(join(root, "assets/asset.svg"), "<svg>asset fixture</svg>");
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => res.end()));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  state.stream?.destroy();
  state.stream = undefined;
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  rmSync(root, { recursive: true, force: true });
});

it("normal asset bytes and content length are unchanged", async () => {
  const response = await fetch(`${base}/__vs/file/assets/asset.svg`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-length")).toBe("24");
  expect(await response.text()).toBe("<svg>asset fixture</svg>");
});

it.each([["missing", 404], ["io", 500]] as const)("%s before headers fails only the request", async (mode, status) => {
  state.mode = mode;
  const response = await fetch(`${base}/__vs/file/assets/asset.svg`);
  expect(response.status).toBe(status);
  const body = await response.text();
  expect(JSON.parse(body)).toMatchObject({ ok: false });
  expect(response.headers.get("content-length")).toBe(String(Buffer.byteLength(body)));
  expect((await fetch(`${base}/__vs/status`)).status).toBe(200);
});

it("read failure after headers terminates the partial response, not the server", async () => {
  state.mode = "partial";
  const response = await fetch(`${base}/__vs/file/assets/asset.svg`);
  expect(response.status).toBe(200);
  const result = response.text();
  const rejected = expect(result).rejects.toThrow();
  state.stream!.destroy(Object.assign(new Error("mid-read failure"), { code: "EIO" }));
  await rejected;
  expect((await fetch(`${base}/__vs/status`)).status).toBe(200);
});

it("client cancellation closes its source stream", async () => {
  state.mode = "cancel";
  const response = await fetch(`${base}/__vs/file/assets/asset.svg`);
  await response.body!.cancel();
  await vi.waitFor(() => expect(state.stream!.destroyed).toBe(true));
  expect((await fetch(`${base}/__vs/status`)).status).toBe(200);
});
