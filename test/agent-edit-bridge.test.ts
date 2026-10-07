import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeStateRevision, parseAgentEdit } from "@/features/editor/agent/agentEditProtocol";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import {
  AGENT_CLAIM_MS, BRIDGE_IO_TIMEOUT_MS, LOCK_CHECK_FRESH_MS, RELEASE_WRITE_WAIT_MS, startAgentEditBridge,
} from "@/features/editor/ui/agentEditBridge";
import { acquireRequestLock, readWorkspaceTextFileStrict, releaseRequestLock, writeWorkspaceFile } from "@/features/editor/ui/workspaceClient";

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
  readWorkspaceTextFileStrict: vi.fn(async (path: string) => ({ ok: true, text: files.get(path) ?? null })),
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

/**
 * 서버의 gui 잠금을 주인 id 기준으로 흉내 낸다 — 잡기·연장·해제와, 잠금으로 보호되는 파일(결과·상태)
 * 쓰기를 쓰는 순간 주인과 대조한다. 해제는 그 주인의 gui-state.json만 지운다.
 */
function ownerAwareServer({ releaseDelayMs = 0 }: { releaseDelayMs?: number }) {
  let lockOwner: string | null = null;
  vi.mocked(acquireRequestLock).mockImplementation(async (_kind, who, renew) => {
    if (renew) return lockOwner === who ? "acquired" : "busy";
    if (lockOwner !== null && lockOwner !== who) return "busy";
    lockOwner = who;
    return "acquired";
  });
  vi.mocked(releaseRequestLock).mockImplementation((_kind, who) => new Promise<void>((resolve) => {
    setTimeout(() => {
      if (lockOwner === who) {
        lockOwner = null;
        if ((JSON.parse(files.get("runtime/gui-state.json") ?? "null") as { id?: string } | null)?.id === who) files.delete("runtime/gui-state.json");
      }
      resolve();
    }, releaseDelayMs);
  }));
  const writes = vi.mocked(writeWorkspaceFile);
  const base = writes.getMockImplementation()!;
  writes.mockImplementation(async (path, body, type, rev, who) =>
    (path === "runtime/agent-edit-result.json" || path === "runtime/gui-state.json") && who !== lockOwner
      ? { ok: false, error: "잠금 거부", status: 409 }
      : base(path, body, type, rev, who));
  return { owner: () => lockOwner };
}

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
  // 테스트가 바꾼 가짜 서버 동작이 다음 테스트로 새지 않게 기본 동작으로 되돌린다
  vi.mocked(releaseRequestLock).mockImplementation(async () => undefined);
  vi.mocked(writeWorkspaceFile).mockImplementation(async (path, body) => { files.set(path, body as string); return { ok: true, path }; });
  vi.mocked(readWorkspaceTextFileStrict).mockImplementation(async (path) => ({ ok: true, text: files.get(path) ?? null }));
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

  it("연결 전부터 있던 요청은 적용하지 않고, 이전 연결이 적용했는지 모른다고 정직하게 알린다", async () => {
    sendEdit({ id: "before-connect", baseStateRevision: "anything", pageId: "page1", commands: retitle("옛 요청") });
    await connect();
    await vi.advanceTimersByTimeAsync(2000);
    expect(title()).not.toBe("옛 요청");
    // "적용하지 않았다"고 단정하지 않는다 — 다른 탭·새로고침 전 연결이 이미 적용했을 수 있다
    expect(result()).toMatchObject({ requestId: "before-connect", status: "rejected", uncertain: true });
    expect(result().message).toContain("이미 반영됐는지 먼저 확인");
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

  it("확인 대기 중 홈에 갔다 바로 돌아오면 거절을 쓰고 잠금을 푼다 — 해제가 늦게 도착해도 새 연결의 잠금·상태는 지우지 않는다", async () => {
    const server = ownerAwareServer({ releaseDelayMs: 100 });
    await connect();
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    useNavigationStore.getState().openHome();
    useNavigationStore.getState().openEditor(); // 해제가 도착하기 전에 돌아온다
    await vi.advanceTimersByTimeAsync(5500); // 해제 도착 → 다음 회차가 새 주인 id로 잡는다
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(server.owner()).not.toBeNull();
    expect(state()?.id).toBe(server.owner()); // 늦은 해제가 새 연결의 상태 파일을 지우지 않았다
    expect(result()).toMatchObject({ requestId: "bg", status: "rejected" });
  });

  it("최초 연결의 복원 읽기 중 홈에 갔다 돌아와도, 늦게 도착한 해제가 새 연결을 지우지 않는다", async () => {
    const server = ownerAwareServer({ releaseDelayMs: 200 });
    // 잠금을 잡은 뒤 이전 결과를 읽는 동안(느림) 사용자가 홈으로 간다
    const read = vi.mocked(readWorkspaceTextFileStrict);
    const serverRead = read.getMockImplementation()!;
    read.mockImplementationOnce((path) => new Promise((resolve) => { setTimeout(() => resolve(serverRead(path)), 50); }));
    stop = startAgentEditBridge();
    await vi.advanceTimersByTimeAsync(10);
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(60); // 복원 읽기가 끝나며 연결을 취소하고 해제를 보낸다
    expect(releaseRequestLock).toHaveBeenCalled();
    useNavigationStore.getState().openEditor(); // 해제가 도착하기 전에 돌아온다
    await vi.advanceTimersByTimeAsync(5500);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(state()?.id).toBe(server.owner());
  });

  it("결과 쓰기가 응답 없이 멈춰도 홈 이동의 해제와 다시 연결이 막히지 않는다", async () => {
    const server = ownerAwareServer({});
    await connect();
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    // 확인창의 pending 결과 쓰기가 끝나지 않는다
    writes.mockImplementation((path, body, type, rev, who) =>
      path === "runtime/agent-edit-result.json" && typeof body === "string" && body.includes('"pending"')
        ? new Promise(() => undefined)
        : serverWrite(path, body, type, rev, who));
    await vi.advanceTimersByTimeAsync(1100);
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "confirm" });
    const firstOwner = server.owner();
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(10);
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(RELEASE_WRITE_WAIT_MS + 6000);
    writes.mockImplementation(serverWrite);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(server.owner()).not.toBe(firstOwner);
  });

  it("재연결 복원 중 결과·요청 파일 읽기가 실패하면 연결을 미뤄, 이미 적용한 요청의 결과를 덮지 않는다", async () => {
    // A를 적용하고 applied까지 기록한 상태(이전 연결)
    sendEdit({ id: "a", baseStateRevision: "old-connection", pageId: "page1", commands: retitle("A") });
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "a", status: "applied" }));
    const read = vi.mocked(readWorkspaceTextFileStrict);
    read.mockResolvedValueOnce({ ok: false }); // 복원 직후 읽기가 일시 실패
    await connect();
    expect(useAgentEditStore.getState().connected).toBe(false);
    await vi.advanceTimersByTimeAsync(6000); // 다음 회차가 다시 잡아 제대로 복원한다
    expect(useAgentEditStore.getState().connected).toBe(true);
    await vi.advanceTimersByTimeAsync(3000); // 폴링이 a를 다시 처리하지 않는다
    expect(result()).toMatchObject({ requestId: "a", status: "applied" });
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

  it("확인 대기(pending)를 결과로 알리지 못했으면 확인창을 띄워 두지 않고 연결을 잃은 것으로 친다", async () => {
    await connect();
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    // 처리 직전 확인 뒤 잠금이 넘어가(만료·인계) 서버가 결과 쓰기를 거부한다
    writes.mockImplementation(async (path, body, type, rev, owner) =>
      path === "runtime/agent-edit-result.json" ? { ok: false, error: "잠금 거부", status: 409 } : serverWrite(path, body, type, rev, owner));
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    writes.mockImplementation(serverWrite);
    expect(useAgentEditStore.getState().connected).toBe(false);
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "rejected", requestId: "bg" });
  });

  it("결과 쓰기의 일시 오류(네트워크·5xx)로는 연결을 놓지 않고, 다음 회차에 그 결과를 다시 쓴다", async () => {
    await connect();
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    writes.mockImplementation(async (path, body, type, rev, owner) =>
      path === "runtime/agent-edit-result.json" ? { ok: false, error: "fetch failed" } : serverWrite(path, body, type, rev, owner));
    sendEdit({ id: "e1", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("적용됨") });
    await vi.advanceTimersByTimeAsync(1100);
    writes.mockImplementation(serverWrite);
    expect(title()).toBe("적용됨");
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(result()).toBeNull(); // 아직 못 알렸다
    await vi.advanceTimersByTimeAsync(5000); // 다음 회차가 못 쓴 결과를 다시 쓴다(거절이 아니라 적용)
    expect(result()).toMatchObject({ requestId: "e1", status: "applied" });
  });

  it("확인 대기(pending)를 쓰는 중 홈으로 가도 거절이 그 뒤에 쓰여 결과가 pending으로 남지 않는다", async () => {
    await connect();
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    // pending 쓰기는 느리고 거절 쓰기는 빠르다 — 순서를 지키지 않으면 pending이 마지막에 남는다
    writes.mockImplementation((path, body, type, rev, owner) => {
      const delay = typeof body === "string" && body.includes('"pending"') ? 100 : 0;
      return new Promise((resolve) => { setTimeout(() => resolve(serverWrite(path, body, type, rev, owner)), delay); });
    });
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(710); // poll(1초)이 확인창을 띄우고 pending을 쓰는 중
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "confirm" });
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(300);
    writes.mockImplementation(serverWrite);
    expect(result()).toMatchObject({ requestId: "bg", status: "rejected" });
  });

  it("잠금이 만료돼 적용 결과를 못 쓴 뒤 같은 탭이 다시 잡으면, 그 요청을 거절이 아닌 적용으로 알린다", async () => {
    await connect();
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    // 잠자기·서버 장애로 잠금이 만료됐다 — 다음 결과 쓰기 한 번은 409
    let refused = false;
    writes.mockImplementation(async (path, body, type, rev, owner) => {
      if (path === "runtime/agent-edit-result.json" && !refused) { refused = true; return { ok: false, error: "만료", status: 409 }; }
      return serverWrite(path, body, type, rev, owner);
    });
    sendEdit({ id: "e1", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("한 번 적용") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(title()).toBe("한 번 적용");
    expect(useAgentEditStore.getState().connected).toBe(false);
    const history = useEditorStore.getState().history;
    await vi.advanceTimersByTimeAsync(5000); // 같은 탭이 만료된 잠금을 새로 잡는다
    writes.mockImplementation(serverWrite);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(result()).toMatchObject({ requestId: "e1", status: "applied" });
    expect(useEditorStore.getState().history).toBe(history); // 다시 적용하지 않는다
  });

  it("못 쓴 결과를 다시 쓰는 일은 그 연결 안에서만 한다 — 다시 연결한 뒤 다른 요청의 새 결과를 덮지 않는다", async () => {
    await connect();
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    writes.mockImplementation(async (path, body, type, rev, owner) =>
      path === "runtime/agent-edit-result.json" ? { ok: false, error: "fetch failed" } : serverWrite(path, body, type, rev, owner));
    sendEdit({ id: "a", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("A") });
    await vi.advanceTimersByTimeAsync(1100); // A 적용, 결과는 일시 오류로 못 썼다
    writes.mockImplementation(serverWrite);
    useNavigationStore.getState().openHome(); // 다시 쓰기 전에 연결을 푼다
    await vi.advanceTimersByTimeAsync(10);
    // 그 사이 다른 탭이 B를 처리했다
    sendEdit({ id: "b", baseStateRevision: "other-tab", pageId: "page1", commands: retitle("B") });
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "b", status: "applied" }));
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(11_000); // 다시 연결하고 연장 회차를 여러 번 지난다
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(result()).toMatchObject({ requestId: "b", status: "applied" });
  });

  it("지난 연결에서 보낸 결과 쓰기가 다시 연결한 뒤 실패해도, 그 옛 결과로 새 결과를 덮지 않는다", async () => {
    await connect();
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    // A의 첫 결과 쓰기만 느린 네트워크에 걸려 3초 뒤 실패한다(그 뒤 쓰기는 정상)
    let stalled = false;
    writes.mockImplementation((path, body, type, rev, owner) => {
      if (path === "runtime/agent-edit-result.json" && !stalled) {
        stalled = true;
        return new Promise((resolve) => { setTimeout(() => resolve({ ok: false, error: "fetch failed" }), 3000); });
      }
      return serverWrite(path, body, type, rev, owner);
    });
    sendEdit({ id: "a", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("A") });
    await vi.advanceTimersByTimeAsync(710); // poll이 A를 적용하고 결과 쓰기가 걸려 있다
    expect(title()).toBe("A");
    useNavigationStore.getState().openHome();
    await vi.advanceTimersByTimeAsync(10);
    // 그 사이 다른 탭이 B를 처리했다
    sendEdit({ id: "b", baseStateRevision: "other-tab", pageId: "page1", commands: retitle("B") });
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "b", status: "applied" }));
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(15_000); // 다시 연결 → A 쓰기가 실패로 끝남 → 연장 회차 여러 번
    writes.mockImplementation(serverWrite);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(result()).toMatchObject({ requestId: "b", status: "applied" });
  });

  it("A→B→A로 다시 연결해도 지난 연결에서 늦게 도착한 결과 쓰기는 B의 결과를 덮지 못한다 — 연결마다 주인 id가 다르다", async () => {
    // 서버의 잠금·결과 쓰기 소유권(쓰는 순간 대조)을 흉내 낸다
    let lockOwner: string | null = null;
    vi.mocked(acquireRequestLock).mockImplementation(async (_kind, who, renew) => {
      if (renew) return lockOwner === who ? "acquired" : "busy";
      if (lockOwner !== null && lockOwner !== who) return "busy";
      lockOwner = who;
      return "acquired";
    });
    vi.mocked(releaseRequestLock).mockImplementation(async (_kind, who) => { if (lockOwner === who) lockOwner = null; });
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    let landLate!: () => void;
    writes.mockImplementation((path, body, type, rev, who) => {
      const land = () => (path === "runtime/agent-edit-result.json" && who !== lockOwner
        ? { ok: false as const, error: "잠금 거부", status: 409 }
        : serverWrite(path, body, type, rev, who));
      // A의 결과 쓰기는 본문이 늦게 도착한다
      if (path === "runtime/agent-edit-result.json" && typeof body === "string" && body.includes('"old-a"')) {
        return new Promise((resolve) => { landLate = () => resolve(land()); });
      }
      return Promise.resolve(land());
    });

    await connect();
    const firstOwner = state().id;
    sendEdit({ id: "old-a", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("A") });
    await vi.advanceTimersByTimeAsync(1100); // A 적용, 결과 쓰기는 오가는 중
    useNavigationStore.getState().openHome(); // A가 연결을 푼다
    await vi.advanceTimersByTimeAsync(10);
    expect(lockOwner).toBeNull();
    // B가 연결해 new-b를 처리하고 푼다
    lockOwner = "tab-b";
    sendEdit({ id: "new-b", baseStateRevision: "b", pageId: "page1", commands: retitle("B") });
    files.set("runtime/agent-edit-result.json", JSON.stringify({ protocol: 1, requestId: "new-b", status: "applied" }));
    lockOwner = null;
    useNavigationStore.getState().openEditor(); // A가 다시 연결한다 — 새 주인 id로
    await vi.advanceTimersByTimeAsync(300);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(lockOwner).not.toBe(firstOwner);
    expect(result()).toMatchObject({ requestId: "new-b", status: "applied" });
    // 지난 연결의 쓰기가 아직 응답이 없어도 새 연결의 결과는 막히지 않는다
    sendEdit({ id: "c", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("C") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(result()).toMatchObject({ requestId: "c", status: "applied" });
    landLate(); // 지난 연결의 쓰기가 이제 도착한다 — 지난 주인 id라 거부된다
    await vi.advanceTimersByTimeAsync(11_000);
    writes.mockImplementation(serverWrite);
    expect(result()).toMatchObject({ requestId: "c", status: "applied" });
  });

  it("확인 대기 중 새 요청이 오면 앞 요청을 적용하지 않은 것으로 확정해 알리고 새 요청을 처리한다", async () => {
    await connect();
    sendEdit({ id: "bg1", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    expect(result()).toMatchObject({ requestId: "bg1", status: "pending" });
    sendEdit({ id: "e2", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("새 요청") });
    await vi.advanceTimersByTimeAsync(1100);
    const written = vi.mocked(writeWorkspaceFile).mock.calls
      .filter(([path]) => path === "runtime/agent-edit-result.json").map(([, body]) => JSON.parse(body as string) as { requestId: string; status: string });
    expect(written).toContainEqual(expect.objectContaining({ requestId: "bg1", status: "rejected" }));
    expect(result()).toMatchObject({ requestId: "e2", status: "applied" });
    expect(title()).toBe("새 요청");
  });

  it("처리 직전 소유권 확인이 일시 오류(unavailable)면 적용하지 않고 다음 폴링에서 다시 본다", async () => {
    await connect();
    vi.mocked(acquireRequestLock).mockResolvedValue("unavailable");
    sendEdit({ id: "e1", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("확인 뒤 적용") });
    await vi.advanceTimersByTimeAsync(2100);
    expect(title()).not.toBe("확인 뒤 적용");
    expect(result()).toBeNull();
    vi.mocked(acquireRequestLock).mockResolvedValue("acquired");
    await vi.advanceTimersByTimeAsync(1100);
    expect(title()).toBe("확인 뒤 적용");
    expect(result()).toMatchObject({ requestId: "e1", status: "applied" });
  });

  it("확인창의 적용도 소유권 확인이 일시 오류면 적용하지 않고 확인창을 남긴다", async () => {
    await connect();
    const before = useEditorStore.getState().spec;
    sendEdit({ id: "bg", baseStateRevision: state().stateRevision, pageId: "page1", commands: background("#000000") });
    await vi.advanceTimersByTimeAsync(1100);
    vi.mocked(acquireRequestLock).mockResolvedValue("unavailable");
    useAgentEditStore.getState().resolveConfirm(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(useEditorStore.getState().spec).toBe(before);
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "confirm", requestId: "bg" });
  });

  it("확인 불가(uncertain) 결과를 일시 오류로 못 써 다시 쓸 때도 uncertain을 유지한다", async () => {
    sendEdit({ id: "before-connect", baseStateRevision: "anything", pageId: "page1", commands: retitle("옛 요청") });
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    let failed = false;
    writes.mockImplementation(async (path, body, type, rev, who) => {
      if (path === "runtime/agent-edit-result.json" && !failed) { failed = true; return { ok: false, error: "fetch failed" }; }
      return serverWrite(path, body, type, rev, who);
    });
    await connect();
    expect(result()).toBeNull();
    await vi.advanceTimersByTimeAsync(5000); // 다음 회차가 다시 쓴다
    writes.mockImplementation(serverWrite);
    expect(result()).toMatchObject({ requestId: "before-connect", status: "rejected", uncertain: true });
  });

  it("확인 불가(uncertain) 결과를 409로 못 쓴 뒤 같은 탭이 다시 잡아 다시 쓸 때도 uncertain을 유지한다", async () => {
    sendEdit({ id: "before-connect", baseStateRevision: "anything", pageId: "page1", commands: retitle("옛 요청") });
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    let refused = false;
    writes.mockImplementation(async (path, body, type, rev, who) => {
      if (path === "runtime/agent-edit-result.json" && !refused) { refused = true; return { ok: false, error: "만료", status: 409 }; }
      return serverWrite(path, body, type, rev, who);
    });
    await connect();
    expect(useAgentEditStore.getState().connected).toBe(false); // 409로 연결을 잃었다
    await vi.advanceTimersByTimeAsync(5000); // 같은 탭이 다시 잡는다
    writes.mockImplementation(serverWrite);
    expect(useAgentEditStore.getState().connected).toBe(true);
    expect(result()).toMatchObject({ requestId: "before-connect", status: "rejected", uncertain: true });
  });

  it("응답 없는 요청(복원 읽기·하트비트·결과 쓰기)이 있어도 연결 확인과 폴링이 멈추지 않는다", async () => {
    const hang = <T,>() => new Promise<T>(() => undefined);
    // 1) 복원 읽기가 멈춘다 → 시간 제한 뒤 잠금을 풀고 다음 회차에 연결한다
    vi.mocked(readWorkspaceTextFileStrict).mockImplementationOnce(() => hang());
    await connect();
    expect(useAgentEditStore.getState().connected).toBe(false);
    await vi.advanceTimersByTimeAsync(BRIDGE_IO_TIMEOUT_MS + AGENT_CLAIM_MS + 500);
    expect(useAgentEditStore.getState().connected).toBe(true);

    // 2) 결과 쓰기가 멈춘다 → 폴링이 다음 요청을 계속 처리한다
    const writes = vi.mocked(writeWorkspaceFile);
    const serverWrite = writes.getMockImplementation()!;
    let hungOnce = false;
    writes.mockImplementation((path, body, type, rev, who) => {
      if (path === "runtime/agent-edit-result.json" && !hungOnce) { hungOnce = true; return hang(); }
      return serverWrite(path, body, type, rev, who);
    });
    sendEdit({ id: "e1", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("하나") });
    await vi.advanceTimersByTimeAsync(BRIDGE_IO_TIMEOUT_MS + 1500);
    sendEdit({ id: "e2", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("둘") });
    await vi.advanceTimersByTimeAsync(1500);
    expect(title()).toBe("둘");
    expect(result()).toMatchObject({ requestId: "e2", status: "applied" });

    // 3) 하트비트(gui-state.json) 쓰기가 멈춘다 → 연결 확인(연장)이 계속 돈다
    let stateHung = false;
    writes.mockImplementation((path, body, type, rev, who) => {
      if (path === "runtime/gui-state.json" && !stateHung) { stateHung = true; return hang(); }
      return serverWrite(path, body, type, rev, who);
    });
    useEditorStore.getState().setNodeField("headerTitle", "content", "상태 바뀜"); // 공개를 유도한다
    await vi.advanceTimersByTimeAsync(AGENT_CLAIM_MS);
    const claimsBefore = vi.mocked(acquireRequestLock).mock.calls.length;
    await vi.advanceTimersByTimeAsync(BRIDGE_IO_TIMEOUT_MS + AGENT_CLAIM_MS * 2);
    writes.mockImplementation(serverWrite);
    expect(vi.mocked(acquireRequestLock).mock.calls.length).toBeGreaterThan(claimsBefore);
  });

  it("처리 직전 소유권 확인 응답이 잠금 기한의 절반보다 늦게 오면 믿지 않고 적용하지 않는다", async () => {
    await connect();
    // 확인을 보낸 직후 탭이 얼었다(타이머도 멈춤) 깨어나, 몇십 초 전에 보낸 확인의 "주인 맞음"을 받는다
    vi.mocked(acquireRequestLock).mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + LOCK_CHECK_FRESH_MS + 1000);
      return "acquired";
    });
    sendEdit({ id: "late", baseStateRevision: state().stateRevision, pageId: "page1", commands: retitle("늦은 확인") });
    await vi.advanceTimersByTimeAsync(800); // 그 폴링 한 번
    expect(title()).not.toBe("늦은 확인");
    expect(result()).toBeNull();
  });

  it("잠금 요청이 오가는 중 탭을 닫아도 해제를 보낸다 — 서버는 이미 잡았을 수 있다", async () => {
    vi.mocked(acquireRequestLock).mockImplementationOnce(() => new Promise(() => undefined));
    stop = startAgentEditBridge();
    await vi.advanceTimersByTimeAsync(10);
    const onPageHide = vi.mocked(window.addEventListener).mock.calls.find(([type]) => type === "pagehide")![1] as unknown as (event: { persisted: boolean }) => void;
    onPageHide({ persisted: false });
    expect(releaseRequestLock).toHaveBeenCalledWith("gui", expect.any(String), true);
  });

  it("최초 연결의 복원을 읽는 중 탭을 닫아도 잠금을 푼다", async () => {
    const read = vi.mocked(readWorkspaceTextFileStrict);
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
