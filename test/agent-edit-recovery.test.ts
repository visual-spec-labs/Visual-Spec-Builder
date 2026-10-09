import * as fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { AGENT_CLAIM_MS, AGENT_EDIT_POLL_MS, BRIDGE_IO_TIMEOUT_MS, startAgentEditBridge } from "@/features/editor/ui/agentEditBridge";
import { readWorkspaceTextFileStrict } from "@/features/editor/ui/workspaceClient";
import { WORKSPACE_REQUEST_LOCK_ROUTE, workspaceFileUrl } from "@/features/workspace/protocol";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, statSync: vi.fn(actual.statSync) };
});

let root: string;
let server: Server;
let stop: (() => void) | undefined;
let delayFirstClaim = false;
let responses: { method: string; url: string; status: number }[];
const GUI_LOCK_URL = `${WORKSPACE_REQUEST_LOCK_ROUTE}gui`;
// claim은 상태 확인 → 잠금 획득 → 복원 읽기 순으로 HTTP 요청을 기다린다.
const CLAIM_IO_WAIT_MS = 3 * BRIDGE_IO_TIMEOUT_MS;
const responseCount = (method: string, url: string, status: number) =>
  responses.filter((response) => response.method === method && response.url === url && response.status === status).length;
const nativeFetch = globalThis.fetch;

beforeEach(async () => {
  root = fs.mkdtempSync(join(tmpdir(), "agent-edit-recovery-"));
  ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  delayFirstClaim = false;
  responses = [];
  server = createServer((req, res) => {
    res.once("finish", () => {
      responses.push({ method: req.method!, url: req.url!, status: res.statusCode });
    });
    const respond = () => middleware(req, res, () => { res.statusCode = 404; res.end(); });
    if (delayFirstClaim && req.method === "POST" && req.url === GUI_LOCK_URL) {
      delayFirstClaim = false;
      // 기본 waitFor의 1초보다 느리지만 브리지 I/O 제한(5초) 안인 정상 응답.
      // 이전 테스트의 Windows 타이밍 실패를 매번 재현하는 회귀 조건이다.
      setTimeout(respond, 1200);
    } else respond();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => nativeFetch(new URL(input, base), init));
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  useEditorStore.getState().loadSpec(seedSpec);
  useNavigationStore.getState().openEditor();
  useAgentEditStore.setState({ connected: false, notice: null });
});

afterEach(async () => {
  stop?.();
  stop = undefined;
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllGlobals();
  vi.mocked(fs.statSync).mockReset();
  vi.mocked(fs.statSync).mockImplementation((await vi.importActual<typeof fs>("node:fs")).statSync);
  fs.rmSync(root, { recursive: true, force: true });
});

it.each(["EIO", "EACCES"])("두 복원 파일의 %s 동시 실패 뒤 회복해도 applied 결과를 보존한다", async (code) => {
  const paths = ["runtime/agent-edit-result.json", "runtime/agent-edit.json"];
  const applied = JSON.stringify({ protocol: 1, requestId: "already-applied", status: "applied", uncertain: false });
  fs.writeFileSync(join(root, paths[0]), applied);
  fs.writeFileSync(join(root, paths[1]), JSON.stringify({
    protocol: 1, id: "already-applied", baseStateRevision: "previous-connection", pageId: "page1",
    commands: [{ type: "updateNode", id: "headerTitle", path: "content", value: "중복 편집" }],
  }));
  const originalStat = vi.mocked(fs.statSync).getMockImplementation()!;
  let failing = true;
  vi.mocked(fs.statSync).mockImplementation((...args: Parameters<typeof fs.statSync>) => {
    if (failing && paths.some((path) => args[0] === join(root, path))) throw Object.assign(new Error(code), { code });
    return originalStat(...args);
  });
  // 실제 HTTP 미들웨어와 strict 클라이언트를 통과시킨다. 두 파일 모두 부재가 아니라 실패다.
  expect(await Promise.all(paths.map((path) => readWorkspaceTextFileStrict(path)))).toEqual([{ ok: false }, { ok: false }]);
  const history = useEditorStore.getState().history;
  delayFirstClaim = code === "EACCES";
  stop = startAgentEditBridge();
  await vi.waitFor(() => {
    // 직접 읽기뿐 아니라 브리지 복원도 500으로 실패하고 잠금까지 풀었는지 확인한다.
    expect(responseCount("GET", workspaceFileUrl(paths[0]), 500)).toBeGreaterThan(1);
    expect(responseCount("DELETE", GUI_LOCK_URL, 200)).toBeGreaterThan(0);
  }, { timeout: CLAIM_IO_WAIT_MS });
  expect(vi.mocked(fs.statSync).mock.calls.filter(([path]) => path === join(root, paths[0])).length).toBeGreaterThan(1);
  expect(useAgentEditStore.getState().connected).toBe(false);
  expect(fs.readFileSync(join(root, paths[0]), "utf8")).toBe(applied);
  failing = false;
  await vi.waitFor(() => expect(useAgentEditStore.getState().connected).toBe(true), { timeout: AGENT_CLAIM_MS + CLAIM_IO_WAIT_MS });
  // 고정 sleep 대신 복원 뒤 실제 폴링의 성공 응답까지 기다린다.
  await vi.waitFor(() => {
    expect(responseCount("GET", workspaceFileUrl(paths[1]), 200)).toBeGreaterThan(1);
  }, { timeout: AGENT_EDIT_POLL_MS + 2 * BRIDGE_IO_TIMEOUT_MS });
  expect(vi.mocked(fs.statSync).mock.calls.filter(([path]) => path === join(root, paths[1])).length).toBeGreaterThan(2);
  expect(fs.readFileSync(join(root, paths[0]), "utf8")).toBe(applied);
  expect(useEditorStore.getState().history).toBe(history);
  expect(await readWorkspaceTextFileStrict("runtime/missing.json")).toEqual({ ok: true, text: null });
}, 60_000);
