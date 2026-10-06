import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeStateRevision, parseAgentEdit } from "@/features/editor/agent/agentEditProtocol";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { startAgentEditBridge } from "@/features/editor/ui/agentEditBridge";
import { acquireRequestLock, releaseRequestLock } from "@/features/editor/ui/workspaceClient";

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
    expect(result()).toMatchObject({ requestId: "bg1", status: "applied" });

    sendEdit({ id: "bg2", baseStateRevision: currentRevision(), pageId: "page1", commands: [{ type: "updateNode", id: "root", path: "background", value: [{ type: "solid", color: "#FFFFFF" }] }] });
    await vi.advanceTimersByTimeAsync(1100);
    useAgentEditStore.getState().resolveConfirm(false);
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
