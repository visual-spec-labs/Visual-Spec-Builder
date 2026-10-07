import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeStateRevision, parseAgentEdit } from "@/features/editor/agent/agentEditProtocol";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { startAgentEditBridge } from "@/features/editor/ui/agentEditBridge";
import { acquireRequestLock, readWorkspaceTextFile, releaseRequestLock, writeWorkspaceFile } from "@/features/editor/ui/workspaceClient";

/**
 * 외부 에이전트 대화 → 열린 GUI 반영 통로(#279). 작업공간 파일 입출력은 메모리 지도로
 * 흉내 내고, 스토어·관문(G1~G3)·Undo는 실제 코드를 쓴다.
 */
const files = new Map<string, string>();
vi.mock("@/features/editor/ui/workspaceClient", () => ({
  isWorkspaceAvailable: vi.fn(async () => true),
  acquireRequestLock: vi.fn(async () => "acquired"),
  releaseRequestLock: vi.fn(),
  listWorkspaceFiles: vi.fn(async (dir: string) => [...files.keys()]
    .filter((path) => path.startsWith(`${dir}/`)).map((path) => path.slice(dir.length + 1))),
  readWorkspaceTextFile: vi.fn(async (path: string) => files.get(path) ?? null),
  writeWorkspaceFile: vi.fn(async (path: string, body: string) => { files.set(path, body); return { ok: true, path }; }),
}));

const state = () => JSON.parse(files.get("runtime/gui-state.json") ?? "null");
const result = () => JSON.parse(files.get("runtime/agent-edit-result.json") ?? "null");
const title = () => (useEditorStore.getState().spec.pages.page1.nodes.headerTitle as { content: string }).content;
function sendEdit(edit: Record<string, unknown>) {
  files.set("runtime/agent-edit.json", JSON.stringify({ protocol: 1, ...edit }));
}
const background = (color: string) => [{ type: "updateNode", id: "root", path: "background", value: [{ type: "solid", color }] }];
const retitle = (value: string) => [{ type: "updateNode", id: "headerTitle", path: "content", value }];

let stop: (() => void) | undefined;
async function connect() {
  stop = startAgentEditBridge();
  await vi.advanceTimersByTimeAsync(300);
}

beforeEach(() => {
  vi.useFakeTimers();
  files.clear();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  useEditorStore.getState().loadSpec(seedSpec);
  useDocumentStore.getState().setFileName("same.json", "rev-1");
  useSaveConflictStore.setState({ paused: false });
  useAgentEditStore.setState({ notice: null, connected: false });
  useNavigationStore.getState().openEditor();
  vi.mocked(acquireRequestLock).mockResolvedValue("acquired");
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("GUI 상태 공개 (#279)", () => {
  it("연결된 탭은 문서·페이지·선택·상태 버전을 gui-state.json에 공개한다", async () => {
    useEditorStore.getState().select("headerTitle");
    await connect();
    expect(useAgentEditStore.getState().connected).toBe(true);
    const published = state();
    expect(published).toMatchObject({
      protocol: 1, fileName: "same.json", diskRevision: "rev-1", pageId: "page1", selectedId: "headerTitle",
      editPath: "runtime/agent-edit.json", resultPath: "runtime/agent-edit-result.json",
    });
    expect(published.page.nodes.headerTitle.content).toBe(title());
    expect(published.stateRevision).toBe(computeStateRevision({
      tabId: published.id, documentId: useEditorStore.getState().documentId, fileName: "same.json", pageId: "page1",
      page: useEditorStore.getState().spec.pages.page1,
    }));
  });

  it("편집하면 상태 버전이 바뀐 gui-state를 다시 공개한다", async () => {
    await connect();
    const before = state().stateRevision;
    useEditorStore.getState().setNodeField("headerTitle", "content", "직접 편집");
    await vi.advanceTimersByTimeAsync(300);
    expect(state().stateRevision).not.toBe(before);
    expect(state().page.nodes.headerTitle.content).toBe("직접 편집");
  });

  it("다른 탭이 이미 연결돼 있으면 공개하지도 편집을 받지도 않는다", async () => {
    vi.mocked(acquireRequestLock).mockResolvedValue("busy");
    await connect();
    sendEdit({ id: "e1", baseStateRevision: "x", pageId: "page1", commands: retitle("무시") });
    await vi.advanceTimersByTimeAsync(2000);
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(state()).toBeNull();
    expect(result()).toBeNull();
  });

  it("멈추면 연결 잠금을 푼다 — 서버가 gui-state.json을 정리한다", async () => {
    await connect();
    const tabId = state().id;
    stop!();
    stop = undefined;
    await vi.advanceTimersByTimeAsync(0); // 확인 대기 결과를 쓴 뒤 푼다
    expect(releaseRequestLock).toHaveBeenCalledWith("gui", tabId);
    expect(useAgentEditStore.getState().connected).toBe(false);
  });
});

describe("에이전트 편집 적용 (#279)", () => {
  it("읽은 상태 그대로면 Undo 한 단계로 적용하고 결과·알림을 남긴다", async () => {
    await connect();
    const before = title();
    sendEdit({ id: "e1", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("에이전트 편집"), summary: "제목 변경" });
    await vi.advanceTimersByTimeAsync(1100);

    expect(title()).toBe("에이전트 편집");
    expect(result()).toMatchObject({ requestId: "e1", status: "applied", message: "제목 변경" });
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "applied", requestId: "e1" });
    useEditorStore.getState().undo();
    expect(title()).toBe(before);
  });

  it("같은 요청 id는 한 번만 적용한다", async () => {
    await connect();
    sendEdit({ id: "e1", baseStateRevision: state().stateRevision, pageId: "page1", commands: [{ type: "updateNode", id: "headerTitle", path: "content", value: "한 번" }] });
    await vi.advanceTimersByTimeAsync(1100);
    const after = useEditorStore.getState().history;
    await vi.advanceTimersByTimeAsync(3000);
    expect(useEditorStore.getState().history).toBe(after);
    // 다시 처리하면 상태 버전이 바뀌어 "거절"로 결과를 덮는다 — 에이전트가 적용된 편집을
    // 실패로 오해한다. 결과는 처음 그대로여야 한다.
    expect(result()).toMatchObject({ requestId: "e1", status: "applied" });
  });

  it("요청을 만든 뒤 사용자가 편집했으면 적용하지 않고 다시 읽으라고 알린다", async () => {
    await connect();
    const base = state().stateRevision;
    useEditorStore.getState().setNodeField("headerTitle", "content", "사용자 편집");
    sendEdit({ id: "e1", baseStateRevision: base, pageId: "page1", commands: retitle("낡은 요청") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(title()).toBe("사용자 편집");
    expect(result()).toMatchObject({ requestId: "e1", status: "rejected" });
    expect(result().message).toContain("gui-state.json을 다시 읽고");
  });

  it("다른 페이지·저장 충돌 중·형태가 틀린 요청은 적용하지 않는다", async () => {
    await connect();
    sendEdit({ id: "page", baseStateRevision: state().stateRevision, pageId: "page2", commands: retitle("x") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(result()).toMatchObject({ requestId: "page", status: "rejected" });

    useSaveConflictStore.setState({ paused: true });
    sendEdit({ id: "paused", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("x") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(result()).toMatchObject({ requestId: "paused", status: "rejected" });
    useSaveConflictStore.setState({ paused: false });

    sendEdit({ id: "shape", baseStateRevision: state().stateRevision, pageId: "page1", commands: [{ type: "updateNode" }] });
    await vi.advanceTimersByTimeAsync(1100);
    expect(result()).toMatchObject({ requestId: "shape", status: "invalid" });
    expect(title()).toBe((seedSpec.screen.nodes.headerTitle as { content: string }).content);
  });

  it("배경을 바꾸는 편집은 확인을 기다렸다가 적용하거나 거절한다", async () => {
    await connect();
    const repaint = [{ type: "updateNode", id: "root", path: "background", value: [{ type: "solid", color: "#000000" }] }];
    sendEdit({ id: "bg1", baseStateRevision: state().stateRevision, pageId: "page1", commands: repaint });
    await vi.advanceTimersByTimeAsync(1100);
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "confirm", requestId: "bg1" });
    expect(result()).toMatchObject({ requestId: "bg1", status: "pending" });
    useAgentEditStore.getState().resolveConfirm(true);
    await vi.advanceTimersByTimeAsync(0); // 적용 직전 연결 소유권을 다시 확인한다
    expect(result()).toMatchObject({ requestId: "bg1", status: "applied" });

    sendEdit({ id: "bg2", baseStateRevision: currentRevision(), pageId: "page1", commands: [{ type: "updateNode", id: "root", path: "background", value: [{ type: "solid", color: "#FFFFFF" }] }] });
    await vi.advanceTimersByTimeAsync(1100);
    useAgentEditStore.getState().resolveConfirm(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(result()).toMatchObject({ requestId: "bg2", status: "rejected" });
  });

  it("다시 연결되면 이전에 처리한 마지막 요청을 다시 적용하지 않는다", async () => {
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "old", status: "applied" }));
    sendEdit({ id: "old", baseStateRevision: "whatever", pageId: "page1", commands: retitle("다시 적용되면 안 됨") });
    await connect();
    await vi.advanceTimersByTimeAsync(2000);
    expect(title()).not.toBe("다시 적용되면 안 됨");
  });
});

function currentRevision() {
  const { spec, documentId } = useEditorStore.getState();
  return computeStateRevision({ tabId: state().id, documentId, fileName: "same.json", pageId: "page1", page: spec.pages.page1 });
}

describe("연결 조건 (#279 셀프 리뷰)", () => {
  it("홈 화면에서는 연결하지 않고, 에디터로 가면 연결되며, 홈으로 돌아오면 연결을 푼다", async () => {
    useNavigationStore.getState().openHome();
    await connect();
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(state()).toBeNull();

    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(300);
    expect(useAgentEditStore.getState().connected).toBe(true);
    const tabId = state().id;

    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(300);
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(releaseRequestLock).toHaveBeenCalledWith("gui", tabId);
  });

  it("연결 전부터 있던 요청은 적용하지 않되, 다시 요청하라는 결과를 남긴다", async () => {
    sendEdit({ id: "before-connect", baseStateRevision: "anything", pageId: "page1", commands: retitle("옛 요청") });
    await connect();
    await vi.advanceTimersByTimeAsync(2000);
    expect(title()).not.toBe("옛 요청");
    expect(result()).toMatchObject({ requestId: "before-connect", status: "rejected" });
    expect(result().message).toContain("gui-state.json을 다시 읽고");
  });

  it("연결 확인이 진행되는 도중 홈으로 가도 곧바로 연결을 푼다", async () => {
    await connect();
    const tabId = state().id;
    let finish!: (value: "acquired") => void;
    vi.mocked(acquireRequestLock).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await vi.advanceTimersByTimeAsync(5000); // 5초 확인이 서버 응답을 기다리는 중
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(0);
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(releaseRequestLock).toHaveBeenCalledWith("gui", tabId);
    finish("acquired");
    await vi.advanceTimersByTimeAsync(300);
    expect(useAgentEditStore.getState().connected).toBe(false);
  });

  it("처리 직전에 연결이 다른 탭으로 넘어갔으면 적용하지 않는다", async () => {
    await connect();
    const base = state().stateRevision;
    vi.mocked(acquireRequestLock).mockResolvedValue("busy");
    sendEdit({ id: "e1", baseStateRevision: base, pageId: "page1", commands: retitle("넘어간 뒤") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(title()).not.toBe("넘어간 뒤");
    expect(useAgentEditStore.getState().connected).toBe(false);
  });

  it("확인 대기 중 연결이 다른 탭으로 넘어가면 확인창을 무효로 하고, 적용·취소해도 공유 결과를 덮지 않는다", async () => {
    for (const accept of [true, false]) {
      vi.mocked(acquireRequestLock).mockResolvedValue("acquired");
      files.clear();
      useAgentEditStore.setState({ notice: null });
      await connect();
      const before = useEditorStore.getState().spec;
      sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
      await vi.advanceTimersByTimeAsync(1100);
      expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "confirm" });
      // 정지·연장 지연으로 잠금이 B 탭에 넘어갔다. B가 결과를 쓴다
      vi.mocked(acquireRequestLock).mockResolvedValue("busy");
      files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "bg", status: "rejected", message: "B" }));

      useAgentEditStore.getState().resolveConfirm(accept); // 다음 연장 전에 누른다 — 직전 확인이 잡는다
      await vi.advanceTimersByTimeAsync(0);
      expect(useEditorStore.getState().spec).toBe(before);
      expect(result()).toMatchObject({ status: "rejected", message: "B" });
      expect(useAgentEditStore.getState().connected).toBe(false);
      expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "rejected", requestId: "bg" });
      stop?.(); stop = undefined;
    }
  });

  it("연장에서 연결을 잃으면 그 즉시 확인창을 무효로 한다", async () => {
    await connect();
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    vi.mocked(acquireRequestLock).mockResolvedValue("busy");
    await vi.advanceTimersByTimeAsync(5000);
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "rejected", requestId: "bg" });
  });

  it("확인 대기 중 홈으로 가 연결을 풀면 확인창을 무효로 하고 결과를 거절로 남긴다", async () => {
    await connect();
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(0);
    expect(result()).toMatchObject({ requestId: "bg", status: "rejected" });
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "rejected", requestId: "bg" });
  });

  it("연결이 넘어간 줄 모른 채 홈으로 가도 옛 요청의 거절이 새 주인의 결과를 덮지 않는다 — 결과는 주인만 쓴다", async () => {
    await connect();
    const tabId = state().id;
    sendEdit({ id: "bg-old", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(result()).toMatchObject({ requestId: "bg-old", status: "pending" });

    // A가 정지한 사이 잠금이 B로 넘어가고 B가 새 요청을 처리했다. A는 아직 다음 연장 전이다.
    // 서버는 결과 파일을 잠금 주인(B)만 쓰게 한다 — 그 동작을 흉내 낸다.
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    writes.mockImplementation(async (path, body, type, rev, owner) =>
      path === "runtime/agent-edit-result.json" && owner !== "tab-b"
        ? { ok: false, error: "409" }
        : serverWrite(path, body, type, rev, owner));
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "b-new", status: "applied" }));

    useNavigationStore.getState().openHome(); // A는 아직 자기가 주인인 줄 안다
    await vi.advanceTimersByTimeAsync(0);
    writes.mockImplementation(serverWrite);
    expect(result()).toMatchObject({ requestId: "b-new", status: "applied" });
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "rejected", requestId: "bg-old" });
    // A는 결과를 자기 이름(잠금 주인 id)으로 쓰려 했고, 그 뒤에 잠금을 풀었다
    const ownWrites = writes.mock.calls.flatMap(([path, , , , owner], index) => path === "runtime/agent-edit-result.json" && owner === tabId ? [index] : []);
    const attempt = ownWrites[ownWrites.length - 1];
    expect(attempt).toBeGreaterThanOrEqual(0);
    expect(writes.mock.invocationCallOrder[attempt]).toBeLessThan(vi.mocked(releaseRequestLock).mock.invocationCallOrder.at(-1)!);
  });

  it("확인 대기 중 홈에 갔다 바로 돌아와도, 거절을 쓰고 잠금을 푼 뒤에 다시 잡는다", async () => {
    await connect();
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    // 해제 요청(DELETE)은 늦게 끝난다 — 끝나기 전에 다시 잡으면 늦은 해제가 새 잠금을 지운다
    let releaseDone = false;
    vi.mocked(releaseRequestLock).mockImplementationOnce(() => new Promise((resolve) => {
      setTimeout(() => { releaseDone = true; resolve(); }, 100);
    }));
    const acquiredAfterRelease: boolean[] = [];
    vi.mocked(acquireRequestLock).mockClear();
    vi.mocked(acquireRequestLock).mockImplementation(async () => { acquiredAfterRelease.push(releaseDone); return "acquired"; });
    useNavigationStore.getState().openHome();
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(300);
    expect(acquiredAfterRelease.length).toBeGreaterThan(0);
    expect(acquiredAfterRelease.every(Boolean)).toBe(true);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(result()).toMatchObject({ requestId: "bg", status: "rejected" });
  });

  it("최초 연결의 복원 읽기 중 홈에 갔다 돌아와도, 늦게 끝나는 해제를 기다린 뒤 다시 잡는다", async () => {
    // 잠금을 잡은 뒤 이전 결과를 읽는 동안(느림) 사용자가 홈으로 간다
    const read = vi.mocked(readWorkspaceTextFile);
    const serverRead = read.getMockImplementation()!;
    read.mockImplementationOnce((path) => new Promise((resolve) => { setTimeout(() => resolve(serverRead(path)), 50); }));
    // 해제 요청(DELETE)도 늦게 끝난다. 끝나면 서버는 이 탭의 상태 파일을 지운다
    let releaseDone = false;
    vi.mocked(releaseRequestLock).mockImplementationOnce(() => new Promise((resolve) => {
      setTimeout(() => { releaseDone = true; files.delete("runtime/gui-state.json"); resolve(); }, 200);
    }));
    const acquiredAfterRelease: boolean[] = [];
    vi.mocked(acquireRequestLock).mockImplementation(async () => { acquiredAfterRelease.push(releaseDone); return "acquired"; });

    stop = startAgentEditBridge();
    await vi.advanceTimersByTimeAsync(10);
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(60); // 복원 읽기가 끝나며 연결을 취소하고 해제를 보낸다
    expect(releaseRequestLock).toHaveBeenCalled();
    useNavigationStore.getState().openEditor(); // 해제가 끝나기 전에 돌아온다
    await vi.advanceTimersByTimeAsync(500);

    expect(acquiredAfterRelease).toEqual([false, true]); // 처음 잡기, 해제가 끝난 뒤 다시 잡기
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(state()).not.toBeNull(); // 늦은 해제가 새로 공개한 상태 파일을 지우지 않았다
  });

  it("연장 요청이 오가는 사이 홈에 갔다 돌아오면, 그 응답으로 연결됐다고 치지 않는다 — 늦은 해제가 지운다", async () => {
    await connect();
    // 다음 연장(5초)은 100ms 걸리고, 그 사이 보낸 해제(DELETE)는 300ms 뒤 도착해 상태 파일을 지운다
    vi.mocked(acquireRequestLock).mockImplementation(() => new Promise((resolve) => { setTimeout(() => resolve("acquired"), 100); }));
    vi.mocked(releaseRequestLock).mockImplementationOnce(() => new Promise((resolve) => {
      setTimeout(() => { files.delete("runtime/gui-state.json"); resolve(); }, 300);
    }));
    await vi.advanceTimersByTimeAsync(4710); // 연장 요청이 막 나갔다
    useNavigationStore.getState().openHome();
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(400);
    // 연결됐다고 표시하면서 상태 파일이 없는 상태는 없다
    if (useAgentEditStore.getState().connected) expect(state()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5500); // 다음 회차가 해제를 기다린 뒤 다시 잡는다
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(state()).not.toBeNull();
  });

  it("해제가 이미 끝난 뒤 도착한 지난 연장 응답으로 연결을 되살리지 않는다", async () => {
    await connect();
    // 다음 연장(5초)의 응답은 500ms 뒤 도착한다. 그 사이 홈 이동 → 해제(DELETE)가 곧바로 끝나고 → 복귀
    vi.mocked(acquireRequestLock).mockImplementation(() => new Promise((resolve) => { setTimeout(() => resolve("acquired"), 500); }));
    vi.mocked(releaseRequestLock).mockImplementationOnce(async () => { files.delete("runtime/gui-state.json"); });
    await vi.advanceTimersByTimeAsync(4710); // 연장 요청이 막 나갔다
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(10); // 해제가 끝났다
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(600); // 지난 연장 응답(acquired)이 도착했다
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(state()).toBeNull();
    await vi.advanceTimersByTimeAsync(5000); // 다음 회차가 새로 잡는다
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(state()).not.toBeNull();
  });

  it("처리 직전 확인 응답이 오기 전에 연결을 잃었으면, 그 응답이 성공이어도 편집을 적용하지 않는다", async () => {
    await connect();
    const before = title();
    // poll의 처리 직전 확인은 6초 걸려 성공으로 돌아오고, 그 사이 주기 연장은 잠금이 B에 넘어간 걸 본다
    let calls = 0;
    vi.mocked(acquireRequestLock).mockImplementation(() => {
      calls += 1;
      return calls === 1
        ? new Promise((resolve) => { setTimeout(() => resolve("acquired"), 6000); })
        : Promise.resolve("busy");
    });
    sendEdit({ id: "late", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("잃은 뒤 적용") });
    await vi.advanceTimersByTimeAsync(5000); // poll이 확인을 보냈고, 주기 연장이 busy로 연결을 잃었다
    expect(useAgentEditStore.getState().connected).toBe(false);
    await vi.advanceTimersByTimeAsync(2500); // 지난 확인 응답(acquired)이 도착했다
    expect(title()).toBe(before);
    expect(result()).toBeNull();
  });

  it("최초 연결의 복원을 읽는 중 탭을 닫아도 잠금을 푼다", async () => {
    const read = vi.mocked(readWorkspaceTextFile);
    const serverRead = read.getMockImplementation()!;
    read.mockImplementationOnce((path) => new Promise((resolve) => { setTimeout(() => resolve(serverRead(path)), 50); }));
    stop = startAgentEditBridge();
    await vi.advanceTimersByTimeAsync(10); // 잠금은 잡았고 복원을 읽는 중 — 아직 연결 표시 전
    expect(useAgentEditStore.getState().connected).toBe(false);
    const onPageHide = vi.mocked(window.addEventListener).mock.calls.find(([type]) => type === "pagehide")![1] as unknown as (event: { persisted: boolean }) => void;
    onPageHide({ persisted: false });
    expect(releaseRequestLock).toHaveBeenCalledWith("gui", expect.any(String), true);
  });

  it("확인 대기(pending)로 남은 요청은 새 연결이 거절로 끝낸다 — 새로고침하면 확인창이 사라지기 때문이다", async () => {
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "bg", status: "pending" }));
    sendEdit({ id: "bg", baseStateRevision: "old-tab", pageId: "page1", commands: background("#000000") });
    await connect();
    expect(result()).toMatchObject({ requestId: "bg", status: "rejected" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(result()).toMatchObject({ requestId: "bg", status: "rejected" }); // 다시 처리하지 않는다

    // 요청 파일이 이미 지워졌어도 pending 결과는 끝낸다
    stop?.(); stop = undefined;
    files.clear();
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "bg2", status: "pending" }));
    await connect();
    expect(result()).toMatchObject({ requestId: "bg2", status: "rejected" });
  });

  it("상태 버전에 탭 id가 들어가 같은 문서·내용이어도 다른 연결과 값이 다르다", () => {
    const page = useEditorStore.getState().spec.pages.page1;
    const base = { documentId: 1, fileName: "same.json", pageId: "page1", page };
    expect(computeStateRevision({ ...base, tabId: "a" })).not.toBe(computeStateRevision({ ...base, tabId: "b" }));
  });
});

describe("요청 형식 (#279)", () => {
  it("버전·기준 상태·페이지가 없으면 이유를 알리고, id를 읽을 수 없으면 답할 짝이 없다", () => {
    expect(parseAgentEdit(null)).toEqual({ kind: "none" });
    expect(parseAgentEdit("{ not json")).toEqual({ kind: "unreadable" });
    expect(parseAgentEdit(JSON.stringify({ protocol: 1 }))).toEqual({ kind: "unreadable" });
    expect(parseAgentEdit(JSON.stringify({ protocol: 2, id: "a" }))).toMatchObject({ kind: "malformed", id: "a" });
    expect(parseAgentEdit(JSON.stringify({ protocol: 1, id: "a", pageId: "page1", commands: [] }))).toMatchObject({ kind: "malformed" });
    expect(parseAgentEdit(JSON.stringify({ protocol: 1, id: "a", baseStateRevision: "r", commands: [] }))).toMatchObject({ kind: "malformed" });
  });
});
