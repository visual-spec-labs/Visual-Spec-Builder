import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Keep real file I/O, but hold the stream's descriptor close until cleanup. HTTP
// completion must not expose a manifest that this server still holds open.
const handles = vi.hoisted(() => ({ delay: false, open: 0, close: [] as (() => Promise<void>)[] }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    createReadStream: ((path, options) => {
      if (!handles.delay || !String(path).endsWith("generation-manifest.json")) {
        return actual.createReadStream(path, options);
      }
      return actual.createReadStream(path, {
        ...(typeof options === "object" ? options : {}),
        fs: {
          open: (path, flags, mode, callback) => actual.open(path, flags, mode, (error, fd) => {
            if (!error) handles.open += 1;
            callback(error, fd);
          }),
          read: actual.read,
          close: (fd, callback) => {
            handles.close.push(() => new Promise<void>((resolve) => actual.close(fd, (error) => {
              handles.open -= 1;
              callback(error);
              resolve();
            })));
          },
        },
      });
    }) as typeof actual.createReadStream,
  };
});
const { createWorkspaceMiddleware, ensureWorkspaceDirs } = await import("@/features/workspace/workspaceServer");
let root: string;
let server: Server;
let url: string;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "vsb-manifest-close-"));
  ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => res.end()));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/__vs/file/runtime/generation-manifest.json`;
  writeFileSync(join(root, "runtime/generation-manifest.json"), '{"protocol":2,"projects":{},"entries":{}}');
});
afterEach(async () => {
  await Promise.all(handles.close.splice(0).map((close) => close()));
  handles.delay = false;
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(root, { recursive: true, force: true });
});
it("manifest 응답이 완료되면 서버의 읽기 핸들이 닫혀 즉시 교체할 수 있다", async () => {
  handles.delay = true;
  const response = await fetch(url);
  expect(response.status).toBe(200);
  const body = await response.text();
  // Give an already-requested close callback a turn; the gate never uses a sleep.
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(handles.open, "HTTP body completed while its manifest descriptor is still open").toBe(0);
  const written = await fetch(url, { method: "PUT", body });
  expect(written.status).toBe(200);
  expect(readFileSync(join(root, "runtime/generation-manifest.json"), "utf8")).toBe(body);
});
it("실파일 manifest 읽기 직후 원자 교체를 반복해도 매번 전체 기록을 보존한다", async () => {
  // No delayed or simulated I/O: also runs on Windows CI with real file handles.
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const read = await fetch(url);
    expect(read.status).toBe(200);
    const manifest = await read.json() as Record<string, unknown>;
    expect(manifest).toEqual({ protocol: 2, projects: {}, entries: {}, ...(iteration ? { iteration: iteration - 1 } : {}) });
    const body = JSON.stringify({ ...manifest, iteration });
    const written = await fetch(url, { method: "PUT", body });
    expect(written.status, await written.text()).toBe(200);
    expect(readFileSync(join(root, "runtime/generation-manifest.json"), "utf8")).toBe(body);
  }
});
