import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_MARKER_HEADER } from "@/features/workspace/protocol";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
function response(body: unknown, marker = true) {
  return new Response(JSON.stringify(body), { headers: marker ? { [WORKSPACE_MARKER_HEADER]: "1" } : {} });
}

describe("목록 메타데이터 클라이언트", () => {
  it("opt-in 질의만 보내고 0과 음수 시각을 보존하며 무효 항목을 제외한다", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ok: true})).mockResolvedValueOnce(response({entries: [
      {name: "epoch.json", mtimeMs: 0}, {name: "before.json", mtimeMs: -1},
      {name: "bad.json", mtimeMs: "10"}, null, {name: 12, mtimeMs: 1},
    ]}));
    vi.stubGlobal("fetch", fetcher);
    const {listWorkspaceFileEntries} = await import("@/features/editor/ui/workspaceClient");
    expect(await listWorkspaceFileEntries("specs")).toEqual([
      {name: "epoch.json", mtimeMs: 0}, {name: "before.json", mtimeMs: -1},
    ]);
    expect(fetcher).toHaveBeenLastCalledWith("/__vs/list/specs?metadata=1");
  });
  it.each([{}, null, {entries: "wrong"}])("무효 응답 %j는 연결 불가로 처리한다", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(body)));
    const {listWorkspaceFileEntries} = await import("@/features/editor/ui/workspaceClient");
    expect(await listWorkspaceFileEntries("specs")).toBeNull();
  });
  it("정적 서버의 HTML 폴백은 빈 작업공간으로 오인하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html>")));
    const {listWorkspaceFileEntries} = await import("@/features/editor/ui/workspaceClient");
    expect(await listWorkspaceFileEntries("specs")).toBeNull();
  });
});

describe("엄격한 텍스트 읽기 (#279)", () => {
  it("없음(404)과 읽기 실패(HTTP 오류·네트워크)를 구분한다", async () => {
    const marker = { [WORKSPACE_MARKER_HEADER]: "1" };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(new Response("본문", { headers: marker }))
      .mockResolvedValueOnce(new Response("", { status: 404, headers: marker }))
      .mockResolvedValueOnce(new Response("", { status: 500, headers: marker }))
      .mockRejectedValueOnce(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetcher);
    const { readWorkspaceTextFileStrict } = await import("@/features/editor/ui/workspaceClient");
    expect(await readWorkspaceTextFileStrict("runtime/a.json")).toEqual({ ok: true, text: "본문" });
    expect(await readWorkspaceTextFileStrict("runtime/a.json")).toEqual({ ok: true, text: null });
    expect(await readWorkspaceTextFileStrict("runtime/a.json")).toEqual({ ok: false });
    expect(await readWorkspaceTextFileStrict("runtime/a.json")).toEqual({ ok: false });
  });
});

it("상태 조회는 중단 신호를 fetch에 전달하고 실패를 캐시하지 않는다", async () => {
  const controller = new AbortController();
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("aborted")).mockResolvedValueOnce(response({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  const { isWorkspaceAvailable } = await import("@/features/editor/ui/workspaceClient");
  expect(await isWorkspaceAvailable(controller.signal)).toBe(false);
  expect(fetcher).toHaveBeenCalledWith("/__vs/status", { method: "GET", signal: controller.signal });
  expect(await isWorkspaceAvailable()).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
