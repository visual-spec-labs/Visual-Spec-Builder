import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { seedSpec } from "@/features/editor/store/seedSpec";
import { requestNlEdit } from "@/features/editor/nl/nlAgentClient";
import {
  acquireRequestLock,
  listWorkspaceFiles,
  releaseRequestLock,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";

/**
 * 요청 클라이언트가 공유 요청 파일 잠금을 지키는지(#273). 서버 쪽 규칙은
 * `request-lock.test.ts`·`workspace-middleware.test.ts`, 실제 두 탭은 브라우저로 확인한다.
 */
vi.mock("@/features/editor/ui/workspaceClient", () => ({
  acquireRequestLock: vi.fn(),
  releaseRequestLock: vi.fn(),
  writeWorkspaceFile: vi.fn(async () => ({ ok: true, path: "runtime/nl-request.json" })),
  listWorkspaceFiles: vi.fn(async () => []),
  readWorkspaceTextFile: vi.fn(async () => null),
}));

const input = { id: "req-b", instruction: "간격을 24로", scope: { kind: "screen" as const, nodeId: null, label: "화면 전체" }, pageId: "page1", page: seedSpec.screen };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("다른 탭이 기다리는 중이면 요청 파일을 쓰지 않고 busy로 안내한다", async () => {
  vi.mocked(acquireRequestLock).mockResolvedValue("busy");
  const outcome = requestNlEdit(input, { cancelled: false });
  await vi.runAllTimersAsync();
  expect(await outcome).toMatchObject({ kind: "busy" });
  expect(writeWorkspaceFile).not.toHaveBeenCalled();
});

it("같은 탭의 이전 요청이 잠깐 뒤 풀리면 다시 시도해 잡는다", async () => {
  vi.mocked(acquireRequestLock).mockResolvedValueOnce("busy").mockResolvedValue("acquired");
  const token = { cancelled: false };
  const outcome = requestNlEdit(input, token);
  await vi.advanceTimersByTimeAsync(400);
  expect(writeWorkspaceFile).toHaveBeenCalledWith(
    "runtime/nl-request.json", expect.any(String), "application/json", undefined, "req-b",
  );
  token.cancelled = true;
  await vi.runAllTimersAsync();
  expect(await outcome).toEqual({ kind: "cancelled" });
});

it("응답·취소·timeout 어느 쪽으로 끝나도 잠금을 푼다", async () => {
  vi.mocked(acquireRequestLock).mockResolvedValue("acquired");
  const outcome = requestNlEdit(input, { cancelled: false });
  await vi.runAllTimersAsync();
  expect(await outcome).toMatchObject({ kind: "timeout" });
  expect(releaseRequestLock).toHaveBeenCalledWith("nl", "req-b", false);
  expect(listWorkspaceFiles).toHaveBeenCalled();
});

it("기다리는 사이 잠금을 잃으면 다른 탭 요청으로 바뀌었다고 알린다", async () => {
  vi.mocked(acquireRequestLock).mockResolvedValueOnce("acquired").mockResolvedValue("busy");
  const outcome = requestNlEdit(input, { cancelled: false });
  await vi.runAllTimersAsync();
  expect(await outcome).toMatchObject({ kind: "busy", message: expect.stringContaining("만료") });
});

it("뒤로/앞으로 캐시에 들어가는 pagehide는 잠금을 풀지 않고, 실제로 닫을 때만 푼다", async () => {
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  vi.stubGlobal("window", {
    addEventListener: (name: string, fn: (event: { persisted: boolean }) => void) => listeners.set(name, fn),
    removeEventListener: vi.fn(),
  });
  vi.mocked(acquireRequestLock).mockResolvedValue("acquired");
  const token = { cancelled: false };
  const outcome = requestNlEdit(input, token);
  await vi.advanceTimersByTimeAsync(10);

  listeners.get("pagehide")?.({ persisted: true });
  expect(releaseRequestLock).not.toHaveBeenCalled();
  listeners.get("pagehide")?.({ persisted: false });
  expect(releaseRequestLock).toHaveBeenCalledWith("nl", "req-b", true);

  token.cancelled = true;
  await vi.runAllTimersAsync();
  await outcome;
});
