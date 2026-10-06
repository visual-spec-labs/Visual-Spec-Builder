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

function currentState(tabId: string) {
  const { spec, activePageId, selectedId, documentId } = useEditorStore.getState();
  const { fileName, diskRevision } = useDocumentStore.getState();
  return buildGuiState({
    tabId, documentId, fileName, diskRevision, pageId: activePageId,
    page: spec.pages[activePageId], selectedId, now: new Date(),
  });
}

/** 지금 GUI 상태 버전. 편집 요청의 `baseStateRevision`과 비교한다. */
export function currentStateRevision(): string {
  const { spec, activePageId, documentId } = useEditorStore.getState();
  return computeStateRevision({
    documentId, fileName: useDocumentStore.getState().fileName,
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
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const timers: ReturnType<typeof setInterval>[] = [];

  async function writeResult(requestId: string, status: AgentEditStatus, message: string) {
    await writeWorkspaceFile(AGENT_EDIT_RESULT_PATH,
      JSON.stringify(buildAgentEditResult(requestId, status, message, currentStateRevision()), null, 2),
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

  async function claim() {
    if (stopped) return;
    const outcome = await acquireRequestLock("gui", tabId, holder);
    const nowHolder = outcome === "acquired" || (holder && outcome === "unavailable");
    if (nowHolder && !holder) {
      holder = true;
      // 새로 연결됐다 — 이전 탭(또는 새로고침 전의 이 탭)이 처리한 마지막 요청을 다시
      // 적용하지 않도록 결과 파일의 요청 id에서 이어간다.
      const previous = await readWorkspaceTextFile(AGENT_EDIT_RESULT_PATH);
      try { lastHandledId = previous ? (JSON.parse(previous) as { requestId?: string }).requestId ?? null : null; }
      catch { lastHandledId = null; }
      useAgentEditStore.setState({ connected: true });
      await publish(true);
    } else if (!nowHolder && holder) {
      holder = false;
      useAgentEditStore.setState({ connected: false });
    } else if (holder) {
      await publish();
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
    if (useSaveConflictStore.getState().paused) {
      return "GUI에 저장 충돌 대화상자가 열려 있습니다. 사용자가 먼저 해결한 뒤 다시 요청하세요.";
    }
    if (baseStateRevision !== currentStateRevision()) {
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
    if (stopped || !holder || polling) return;
    polling = true;
    try {
      const files = await listWorkspaceFiles(RUNTIME_DIR);
      if (files?.includes(AGENT_EDIT_FILE)) await handle(await readWorkspaceTextFile(AGENT_EDIT_PATH));
    } finally {
      polling = false;
    }
  }

  useAgentEditStore.setState({
    resolveConfirm: (accept) => {
      const notice = useAgentEditStore.getState().notice;
      if (notice?.kind !== "confirm") return;
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
    },
  });

  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted && holder) releaseRequestLock("gui", tabId, true);
  };
  const unsubscribeEditor = useEditorStore.subscribe((s, prev) => {
    if (s.spec !== prev.spec || s.activePageId !== prev.activePageId || s.selectedId !== prev.selectedId) schedulePublish();
  });
  const unsubscribeDocument = useDocumentStore.subscribe(schedulePublish);

  void (async () => {
    if (!await isWorkspaceAvailable() || stopped) return;
    if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);
    await claim();
    timers.push(setInterval(() => { void claim(); }, AGENT_CLAIM_MS));
    timers.push(setInterval(() => { void poll(); }, AGENT_EDIT_POLL_MS));
  })();

  return () => {
    stopped = true;
    clearTimeout(publishTimer);
    for (const timer of timers) clearInterval(timer);
    unsubscribeEditor();
    unsubscribeDocument();
    if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide);
    if (holder) releaseRequestLock("gui", tabId);
    holder = false;
    useAgentEditStore.setState({ connected: false });
  };
}
