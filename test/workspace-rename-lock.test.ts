import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as mutations from "@/features/workspace/workspaceMutation";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";
import { blankSpec } from "@/features/editor/store/blankSpec";

let root: string, outside: string, server: Server, origin: string;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "vsb-rename-lock-"));
  outside = mkdtempSync(join(tmpdir(), "vsb-rename-outside-"));
  ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => res.end()));
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>(done => server.close(() => done()));
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

it("rechecks rename source and destination scope after waiting for a workspace mutation", async () => {
  const original = JSON.stringify(blankSpec);
  writeFileSync(join(root, "specs", "old.json"), original);
  writeFileSync(join(outside, "old.json"), original);
  mkdirSync(join(outside, "sentinel"));
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  const queued = new Promise<void>(done => { entered = done; });
  const actual = mutations.withWorkspaceMutation;
  vi.spyOn(mutations, "withWorkspaceMutation").mockImplementationOnce(async (paths, action, workspace) => {
    entered(); await gate; return actual(paths, action, workspace);
  });
  const pending = fetch(`${origin}/__vs/rename`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ fileName: "old.json", name: "New", expectedText: original }),
  });
  await queued;
  try {
    renameSync(join(root, "specs"), join(root, "original-specs"));
    // A component changed after the route's original safety check.
    symlinkSync(outside, join(root, "specs"), "junction");
  } finally { release(); }
  const response = await pending;
  expect(response.status).toBe(403); await response.text();
  expect(readFileSync(join(outside, "old.json"), "utf8")).toBe(original);
  expect(readFileSync(join(root, "original-specs", "old.json"), "utf8")).toBe(original);
});
