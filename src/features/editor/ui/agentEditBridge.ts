/**
 * 열린 GUI를 외부 에이전트 대화와 잇는 브라우저 쪽 절반 (이슈 #279). 규약은
 * `agent/agentEditProtocol.ts` 상단에 적었다.
 *
 * 작업공간에서 **한 탭만** 연결된다 — `/__vs/request-lock/gui` 잠금(#273)을 쥔 탭만 상태를
 * 공개하고 편집 요청을 받는다. 탭이 여럿이면 같은 편집이 두 번 적용되기 때문이다. 쥔 탭을
 * 닫으면 잠금이 풀리며 `gui-state.json`도 정리되고, 다른 탭이 다음 회차에 이어받는다.
 *
 * 편집은 자연어 입력창과 **같은 관문**을 지난다: 형태 검사(G1) → 미리 적용(G2·G3) →
 * `applyGuardedTransaction`으로 Undo 한 단계. 배경을 바꾸면 적용 전에 확인받는다.
 */

import {
  AGENT_EDIT_FILE,
  AGENT_EDIT_PATH,
  AGENT_EDIT_RESULT_PATH,
  buildAgentEditResult,
  buildGuiState,
  computeStateRevision,
  GUI_STATE_PATH,
  parseAgentEdit,
  type AgentEditStatus,
} from "@/features/editor/agent/agentEditProtocol";
import { runTransactionGates } from "@/features/editor/command/transactionGate";
import type { Command } from "@/features/editor/command/types";
import { changedBackgroundNodes } from "@/features/editor/nl/backgroundChange";
import { describeCommandIssues, describeCommands, describeTransactionFailure } from "@/features/editor/nl/nlMessage";
import type { PageId } from "@/features/editor/schema";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

import {
  acquireRequestLock,
  isWorkspaceAvailable,
  listWorkspaceFiles,
  readWorkspaceTextFile,
  releaseRequestLock,
  writeWorkspaceFile,
} from "./workspaceClient";

/** 편집 요청을 확인하는 간격. 사람이 대화에서 요청하는 속도에 비하면 충분히 촘촘하다. */
export const AGENT_EDIT_POLL_MS = 1000;
/** 연결 잠금을 잡거나 연장하는 간격 — 잠금 기한(30초)보다 충분히 짧다. */
export const AGENT_CLAIM_MS = 5000;
/** 내용이 그대로여도 이 간격으로 `updatedAt`을 갱신한다 — 에이전트가 GUI가 열려 있는지 판단한다. */
export const GUI_STATE_HEARTBEAT_MS = 10_000;

/**
 * 주기 작업 타이머. 사용자는 보통 터미널(에이전트)을 앞에 두고 브라우저를 뒤에 둔다 — Chrome은
 * 5분 넘게 가려진 탭의 setInterval을 1분에 한 번으로 묶어(intensive throttling) 하트비트·폴링·
 * 잠금 연장이 모두 늦어진다(#279 리뷰). 전용 Worker의 타이머는 그 제약을 받지 않으므로 Worker가
 * 박자를 보내고 실제 일은 메인 스레드가 한다. Worker를 못 쓰는 환경(테스트 등)은 setInterval로.
 */
function startTicker(intervalMs: number, tick: () => void): () => void {
  if (typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function") {
    try {
      const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${intervalMs});`], { type: "text/javascript" }));
      const worker = new Worker(url);
      worker.onmessage = tick;
      return () => { worker.terminate(); URL.revokeObjectURL(url); };
    } catch { /* 아래 setInterval로 */ }
  }
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}

function currentState(tabId: string) {
  const { spec, activePageId, selectedId, documentId } = useEditorStore.getState();
  const { fileName, diskRevision } = useDocumentStore.getState();
  return buildGuiState({
    tabId, documentId, fileName, diskRevision, pageId: activePageId,
    page: spec.pages[activePageId], selectedId, now: new Date(),
  });
}

/** 지금 GUI 상태 버전. 편집 요청의 `baseStateRevision`과 비교한다. */
export function currentStateRevision(tabId: string): string {
  const { spec, activePageId, documentId } = useEditorStore.getState();
  return computeStateRevision({
    tabId, documentId, fileName: useDocumentStore.getState().fileName,
    pageId: activePageId, page: spec.pages[activePageId],
  });
}

export function startAgentEditBridge(): () => void {
  const tabId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `gui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let stopped = false;
  let holder = false;
  let lastPublished = "";
  let lastPublishedAt = 0;
  let lastHandledId: string | null = null;
  let polling = false;
  let claiming = false;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const tickers: (() => void)[] = [];
  /** 에디터 화면일 때만 연결한다 — 홈에서는 보이지 않는 문서에 편집이 적용된다(#279 리뷰). */
  const onEditor = () => useNavigationStore.getState().screen === "editor";

  async function writeResult(requestId: string, status: AgentEditStatus, message: string) {
    await writeWorkspaceFile(AGENT_EDIT_RESULT_PATH,
      JSON.stringify(buildAgentEditResult(requestId, status, message, currentStateRevision(tabId)), null, 2),
      "application/json");
  }

  async function publish(force = false) {
    if (stopped || !holder) return;
    const state = currentState(tabId);
    const comparable = JSON.stringify({ ...state, updatedAt: "" });
    if (!force && comparable === lastPublished && Date.now() - lastPublishedAt < GUI_STATE_HEARTBEAT_MS) return;
    const written = await writeWorkspaceFile(GUI_STATE_PATH, JSON.stringify(state, null, 2), "application/json", undefined, tabId);
    if (written.ok) {
      lastPublished = comparable;
      lastPublishedAt = Date.now();
    }
  }
  const schedulePublish = () => {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(() => { void publish(); }, 200);
  };

  /**
   * 확인 대기 중인 편집을 무효로 한다 — 연결이 끊긴 탭의 확인창이 적용·취소되면 지금 연결된 탭과
   * 공유 결과 파일이 엇갈린다(#279 리뷰). 아직 연결의 주인일 때만 결과를 거절로 남긴다. 소유권을
   * 잃었으면 결과는 새 주인이 연결하며 정리한다(`claim`).
   */
  function dropConfirm(writeRejected: boolean) {
    const notice = useAgentEditStore.getState().notice;
    if (notice?.kind !== "confirm") return;
    const message = "GUI 연결이 끊겨(홈 이동·다른 탭·새로고침) 확인을 기다리던 이 편집을 적용하지 않았습니다. gui-state.json을 다시 읽고 새 id로 요청하세요.";
    useAgentEditStore.setState({ notice: { kind: "rejected", requestId: notice.requestId, message } });
    if (writeRejected) void writeResult(notice.requestId, "rejected", message);
  }

  /** 잠금이 다른 탭으로 넘어갔다 — 이 탭은 더 이상 결과를 쓰지 않는다. */
  function loseConnection() {
    holder = false;
    useAgentEditStore.setState({ connected: false });
    dropConfirm(false);
  }

  function disconnect() {
    if (!holder) return;
    dropConfirm(true);
    holder = false;
    releaseRequestLock("gui", tabId); // 서버가 이 탭의 gui-state.json을 정리한다
    useAgentEditStore.setState({ connected: false });
  }

  async function claim() {
    if (stopped) return;
    // 진행 중인 확인보다 먼저 본다 — 그 사이 홈으로 가도 곧바로 연결을 푼다(#279 리뷰).
    if (!onEditor()) { disconnect(); return; }
    if (claiming) return;
    claiming = true;
    try {
      const outcome = await acquireRequestLock("gui", tabId, holder);
      const nowHolder = outcome === "acquired" || (holder && outcome === "unavailable");
      if (nowHolder && !holder) {
        // 이전 탭이 처리한 마지막 요청은 다시 적용하지 않는다. 연결 전부터 있던 다른 요청은 이
        // 연결이 공개한 상태로 만든 것이 아니므로 적용하지 않되, 결과는 남긴다 — 숨기면 에이전트가
        // 30초 기다린 뒤 "GUI가 연결되지 않았다"고 잘못 안내한다(#279 리뷰). 복원을 **먼저** 끝내고
        // 연결로 바꾼다 — 그 사이 폴링이 같은 요청을 다시 처리하지 않게.
        // 이전 결과가 "pending"(배경 변경 확인 대기)이면 끝난 요청이 아니다 — 그 확인창은 이전
        // 연결과 함께 사라졌으므로 거절로 끝낸다. 처리 완료로 치면 결과가 영원히 pending에 머문다(#279 리뷰).
        const previous = await readWorkspaceTextFile(AGENT_EDIT_RESULT_PATH);
        let handled: string | null = null;
        let unfinished: string | null = null;
        try {
          const body = previous ? JSON.parse(previous) as { requestId?: unknown; status?: unknown } : null;
          const id = typeof body?.requestId === "string" ? body.requestId : null;
          if (body?.status === "pending") unfinished = id;
          else handled = id;
        } catch { handled = null; }
        const pending = parseAgentEdit(await readWorkspaceTextFile(AGENT_EDIT_PATH));
        // 요청 파일의 요청이 우선이다 — 결과 파일은 하나라 마지막에 쓴 결과만 남는다.
        const waiting = "id" in pending && pending.id !== handled ? pending.id : unfinished;
        lastHandledId = waiting ?? handled;
        if (stopped || !onEditor()) { releaseRequestLock("gui", tabId); return; }
        holder = true;
        useAgentEditStore.setState({ connected: true });
        await publish(true);
        if (waiting !== null) {
          await writeResult(waiting, "rejected",
            "GUI 연결이 새로 맺어져(새로고침·홈 이동·다른 탭) 이 요청을 적용하지 않았습니다. gui-state.json을 다시 읽고 새 id로 요청하세요.");
        }
      } else if (!nowHolder && holder) {
        loseConnection();
      } else if (holder) {
        if (!onEditor()) { disconnect(); return; }
        await publish();
      }
    } finally {
      claiming = false;
    }
  }

  function apply(requestId: string, pageId: PageId, commands: Command[], summary: string | null) {
    const gate = useEditorStore.getState().applyGuardedTransaction(pageId, commands);
    if (!gate.ok) {
      const message = describeTransactionFailure(gate.failure);
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId, message } });
      void writeResult(requestId, "rejected", message);
      return;
    }
    const message = summary ?? describeCommands(commands);
    useAgentEditStore.setState({ notice: { kind: "applied", requestId, message, spec: useEditorStore.getState().spec } });
    void writeResult(requestId, "applied", message);
    void publish(true);
  }

  /** 적용 전 공통 검사. 거절이면 사유, 통과면 null. */
  function rejectReason(baseStateRevision: string, pageId: PageId): string | null {
    if (!onEditor()) {
      return "GUI가 에디터 화면이 아닙니다(홈 화면). 사용자가 문서를 연 뒤 다시 요청하세요.";
    }
    if (useSaveConflictStore.getState().paused) {
      return "GUI에 저장 충돌 대화상자가 열려 있습니다. 사용자가 먼저 해결한 뒤 다시 요청하세요.";
    }
    if (baseStateRevision !== currentStateRevision(tabId)) {
      return "요청을 만든 뒤 GUI 상태가 바뀌었습니다(편집·문서 또는 페이지 전환). gui-state.json을 다시 읽고 요청하세요.";
    }
    if (pageId !== useEditorStore.getState().activePageId) {
      return "요청의 pageId가 GUI의 활성 페이지와 다릅니다. gui-state.json의 pageId를 쓰세요.";
    }
    return null;
  }

  async function handle(text: string | null) {
    const parsed = parseAgentEdit(text);
    if (parsed.kind === "none" || parsed.kind === "unreadable") return;
    if (parsed.id === lastHandledId) return;
    // 처리 직전에 연결이 아직 이 탭인지 확인한다 — 연장이 늦어 잠금이 넘어갔다면 새 탭이 처리한다.
    if (await acquireRequestLock("gui", tabId, true) === "busy") {
      loseConnection();
      return;
    }
    lastHandledId = parsed.id;

    if (parsed.kind === "malformed") {
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: parsed.id, message: parsed.message } });
      await writeResult(parsed.id, "invalid", parsed.message);
      return;
    }
    if (parsed.kind === "invalid") {
      const message = describeCommandIssues(parsed.issues);
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: parsed.id, message } });
      await writeResult(parsed.id, "invalid", message);
      return;
    }

    const reason = rejectReason(parsed.baseStateRevision, parsed.pageId);
    if (reason !== null) {
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: parsed.id, message: reason } });
      await writeResult(parsed.id, "rejected", reason);
      return;
    }
    const state = useEditorStore.getState();
    const preview = runTransactionGates(state.spec, parsed.pageId, parsed.commands);
    if (!preview.ok) {
      const message = describeTransactionFailure(preview.failure);
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: parsed.id, message } });
      await writeResult(parsed.id, "rejected", message);
      return;
    }
    const names = changedBackgroundNodes(state.spec.pages[parsed.pageId], preview.screen);
    if (names.length > 0) {
      const message = parsed.summary ?? describeCommands(parsed.commands);
      useAgentEditStore.setState({
        notice: {
          kind: "confirm", requestId: parsed.id, message, names, pageId: parsed.pageId,
          commands: parsed.commands, baseStateRevision: parsed.baseStateRevision,
        },
      });
      await writeResult(parsed.id, "pending", "배경을 바꾸는 편집이라 GUI에서 사용자 확인을 기다립니다.");
      return;
    }
    apply(parsed.id, parsed.pageId, parsed.commands, parsed.summary);
  }

  async function poll() {
    if (stopped || !holder || claiming || polling) return;
    polling = true;
    try {
      const files = await listWorkspaceFiles(RUNTIME_DIR);
      if (files?.includes(AGENT_EDIT_FILE)) await handle(await readWorkspaceTextFile(AGENT_EDIT_PATH));
    } finally {
      polling = false;
    }
  }

  useAgentEditStore.setState({
    resolveConfirm: (accept) => { void resolveConfirm(accept); },
  });

  let resolving = false;
  async function resolveConfirm(accept: boolean) {
    const notice = useAgentEditStore.getState().notice;
    if (notice?.kind !== "confirm" || resolving) return;
    if (!holder) { dropConfirm(false); return; }
    // 확인을 기다리는 사이 잠금이 다른 탭으로 넘어갔을 수 있다(정지·연장 지연) — 쓰기 직전에 다시 본다.
    resolving = true;
    try {
      if (await acquireRequestLock("gui", tabId, true) === "busy") { loseConnection(); return; }
    } finally {
      resolving = false;
    }
    if (stopped || !holder || useAgentEditStore.getState().notice !== notice) return;
    if (!accept) {
      const message = "사용자가 GUI에서 이 편집을 적용하지 않기로 했습니다.";
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: notice.requestId, message } });
      void writeResult(notice.requestId, "rejected", message);
      return;
    }
    const reason = rejectReason(notice.baseStateRevision, notice.pageId);
    if (reason !== null) {
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: notice.requestId, message: reason } });
      void writeResult(notice.requestId, "rejected", reason);
      return;
    }
    apply(notice.requestId, notice.pageId, notice.commands, notice.message);
  }

  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted && holder) releaseRequestLock("gui", tabId, true);
  };
  const unsubscribeEditor = useEditorStore.subscribe((s, prev) => {
    if (s.spec !== prev.spec || s.activePageId !== prev.activePageId || s.selectedId !== prev.selectedId) schedulePublish();
  });
  const unsubscribeDocument = useDocumentStore.subscribe(schedulePublish);
  const unsubscribeNavigation = useNavigationStore.subscribe((s, prev) => {
    if (s.screen !== prev.screen) void claim();
  });

  void (async () => {
    if (!await isWorkspaceAvailable() || stopped) return;
    if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);
    await claim();
    tickers.push(startTicker(AGENT_CLAIM_MS, () => { void claim(); }));
    tickers.push(startTicker(AGENT_EDIT_POLL_MS, () => { void poll(); }));
  })();

  return () => {
    stopped = true;
    clearTimeout(publishTimer);
    for (const stopTicker of tickers) stopTicker();
    unsubscribeEditor();
    unsubscribeDocument();
    unsubscribeNavigation();
    if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide);
    disconnect();
  };
}
