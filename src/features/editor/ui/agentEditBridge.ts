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
import { REQUEST_LOCK_TTL_MS, RUNTIME_DIR } from "@/features/workspace/protocol";

import {
  acquireRequestLock,
  isWorkspaceAvailable,
  listWorkspaceFiles,
  readWorkspaceTextFile,
  readWorkspaceTextFileStrict,
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

/** 연결을 풀 때 확인창 거절 결과 쓰기를 기다리는 최대 시간. 그 뒤엔 기다리지 않고 잠금을 푼다. */
export const RELEASE_WRITE_WAIT_MS = 3000;
/**
 * 브리지의 작업공간 요청 하나를 기다리는 최대 시간. 넘으면 요청을 취소하고 실패로 친다 — 응답 없는
 * 요청 하나가 연결 확인·폴링을 무기한 멈추면 새로고침 전까지 연결이 멈추거나 "연결됨"으로 잘못
 * 보인다(PR #303 리뷰).
 */
export const BRIDGE_IO_TIMEOUT_MS = 5000;
/**
 * 소유권 확인 응답을 믿을 수 있는 최대 왕복 시간 — 잠금 기한의 절반. 보낸 뒤 이보다 늦게 받은
 * "주인 맞음"은 그 사이(탭 정지·잠자기) 잠금이 넘어갔을 수 있으므로 적용 근거로 쓰지 않는다.
 */
export const LOCK_CHECK_FRESH_MS = REQUEST_LOCK_TTL_MS / 2;

/** `run`을 최대 `BRIDGE_IO_TIMEOUT_MS`만 기다린다. 넘으면 요청을 취소하고 `fallback`을 돌려준다. */
async function timed<T>(run: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(fallback); }, BRIDGE_IO_TIMEOUT_MS);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** 처리 직전 소유권 확인. 늦게 받은 "주인 맞음"은 믿지 않고 `unavailable`로 친다. */
async function checkLock(owner: string): Promise<"acquired" | "busy" | "unavailable"> {
  const sentAt = Date.now();
  const outcome = await timed((signal) => acquireRequestLock("gui", owner, true, signal), "unavailable" as const);
  return outcome === "acquired" && Date.now() - sentAt > LOCK_CHECK_FRESH_MS ? "unavailable" : outcome;
}

/** 이 연결이 처리 여부를 알 수 없는 요청의 결과 문구. 결과에는 `uncertain: true`가 함께 실린다. */
export const UNCERTAIN_MESSAGE =
  "GUI 연결이 새로 맺어져(새로고침·홈 이동·다른 탭) 이 요청이 이전 연결에서 적용됐는지 확인할 수 없습니다. "
  + "적용됐을 수 있으니 gui-state.json을 다시 읽어 원하는 변경이 이미 반영됐는지 먼저 확인하고, 반영되지 않았을 때만 새 id로 다시 요청하세요.";

export function startAgentEditBridge(): () => void {
  const tabId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `gui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  /**
   * 지금 연결의 잠금 주인 id(fencing 토큰). 연결이 끝날 때(해제·상실) 바꾼다 — 탭 id를 그대로 쓰면
   * A→B→A로 다시 연결했을 때 지난 연결에서 늦게 도착한 결과 쓰기를 서버가 "주인"으로 받아들여
   * 그 사이 B가 쓴 결과를 덮는다(PR #303 리뷰). 서버는 쓰는 순간 잠금 주인과 이 값을 대조한다.
   * 상태 버전(stateRevision)에도 들어가 지난 연결에서 읽은 상태로 만든 요청은 맞지 않는다.
   */
  let connectionSeq = 0;
  let owner = `${tabId}:${connectionSeq}`;
  /**
   * 다음 연결은 새 주인 id로. 연결에 실패한 잡기 시도마다 바꾸지는 않는다 — 시간 초과로 취소했지만
   * 서버에선 잡힌 잠금을 다음 시도가 같은 id로 이어받아야 한다. 새 id로 바꾸면 그 잠금이 주인
   * 없이 30초 남아 이 탭도 다른 탭도 연결하지 못한다(PR #303 셀프 리뷰).
   */
  function rotateOwner() {
    connectionSeq += 1;
    owner = `${tabId}:${connectionSeq}`;
  }
  let stopped = false;
  let holder = false;
  /**
   * 연결 세대 — 연결을 맺거나 풀거나 잃을 때마다 오른다. 잠금 요청이 오가는 사이 세대가 바뀌었으면
   * 그 응답은 지난 연결의 것이다. 해제가 이미 끝나 버린 뒤 도착한 연장 응답, 연결을 잃은 뒤 도착한
   * 처리 직전 확인 응답으로 연결을 되살리거나 편집을 적용하지 않는다(PR #303 리뷰).
   */
  let epoch = 0;
  let lastPublished = "";
  let lastPublishedAt = 0;
  let lastHandledId: string | null = null;
  let polling = false;
  let claiming = false;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const tickers: (() => void)[] = [];
  /** 에디터 화면일 때만 연결한다 — 홈에서는 보이지 않는 문서에 편집이 적용된다(#279 리뷰). */
  const onEditor = () => useNavigationStore.getState().screen === "editor";

  /**
   * 결과 파일은 서버가 연결 잠금의 주인일 때만 쓴다(PR #303 리뷰) — 연결을 잃은 줄 아직 모르는
   * 탭이 옛 요청의 결과로 새 주인의 결과를 덮지 않게.
   *
   * 결과 쓰기는 **보낸 순서대로** 한 줄로 처리한다 — 확인 대기("pending")를 쓰는 사이 홈으로 가
   * 거절을 쓰면 두 요청이 경쟁해 결과가 pending으로 남을 수 있다(PR #303 셀프 리뷰).
   *
   * 서버가 잠금 주인이 아니라고 거부했으면(409 — 이 쓰기는 버전 확인을 하지 않으므로 409는 잠금이
   * 다른 탭에 넘어갔거나 만료된 경우다) 이 연결로는 결과를 알릴 수 없으므로 연결을 잃은 것으로 처리하고 떠 있는 확인창도
   * 거둔다. 일시 오류(네트워크·5xx)는 연결을 유지한다 — 잃은 것으로 치면 다시 잡을 때 이미 적용한
   * 요청을 "적용하지 않음"으로 알려 에이전트가 같은 편집을 다시 보낼 수 있다. 연장의
   * "unavailable"과 같은 정책이다(PR #303 셀프 리뷰).
   */
  let resultChain: Promise<unknown> = Promise.resolve();
  /**
   * 이 탭이 마지막으로 쓰려던 결과. 409로 연결을 잃은 뒤 **같은 탭이** 다시 잡으면(잠금 만료 —
   * 잠자기·서버 장애가 30초를 넘김) 요청 파일엔 그 요청이 남아 있다. 이 탭이 이미 적용한 요청을
   * "적용하지 않음"으로 알리면 에이전트가 같은 편집을 다시 보내 두 번 적용된다(PR #303 셀프 리뷰).
   */
  let lastResult: { requestId: string; status: AgentEditStatus; message: string; uncertain: boolean } | null = null;
  /**
   * 마지막 결과를 일시 오류로 쓰지 못했다 — 연결된 동안 다음 회차가 다시 쓴다(PR #303 셀프 리뷰).
   * **한 연결 안에서만** 뜻이 있다. 연결을 맺거나 잃을 때 지운다 — 남겨 두면 다시 연결한 뒤 지난
   * 연결의 옛 결과가 그 사이 다른 탭이 쓴 새 요청의 결과를 덮는다. 같은 탭이 다시 잡을 때 자기
   * 요청의 결과를 다시 쓰는 일은 `lastResult`로 따로 한다.
   */
  let lastResultUnsent = false;
  async function writeResult(
    requestId: string, status: AgentEditStatus, message: string, uncertain = false,
    /** 연결을 풀며 쓸 때는 풀리는(지난) 연결의 주인 id로 쓴다 — 새 id는 아직 잠금을 쥐지 않았다. */
    asOwner = owner,
  ): Promise<boolean> {
    lastResult = { requestId, status, message, uncertain };
    const epochAt = epoch;
    const writeOwner = asOwner;
    const body = JSON.stringify(buildAgentEditResult(requestId, status, message, currentStateRevision(writeOwner), uncertain), null, 2);
    // 줄에서 기다리는 사이 다음 연결이 시작됐으면 지난 연결의 쓰기는 시작하지 않는다. 시작했더라도
    // 서버가 지난 주인 id를 거부한다.
    const run = resultChain.then(() => writeOwner === owner || unreleased.has(writeOwner)
      ? timed((signal) => writeWorkspaceFile(AGENT_EDIT_RESULT_PATH, body, "application/json", undefined, writeOwner, signal),
        { ok: false as const, error: "시간 초과" })
      : { ok: false as const, error: "지난 연결의 결과 쓰기" });
    resultChain = run.catch(() => undefined);
    const written = await run;
    // 지난 연결에서 보낸 쓰기가 늦게 끝났으면 이 연결의 표시를 건드리지 않는다(PR #303 셀프 리뷰).
    if (epoch === epochAt && lastResult?.requestId === requestId && lastResult.status === status) lastResultUnsent = !written.ok;
    if (!written.ok && written.status === 409 && holder && epoch === epochAt) loseConnection();
    return written.ok;
  }

  async function publish(force = false) {
    if (stopped || !holder) return;
    const state = currentState(owner);
    const comparable = JSON.stringify({ ...state, updatedAt: "" });
    if (!force && comparable === lastPublished && Date.now() - lastPublishedAt < GUI_STATE_HEARTBEAT_MS) return;
    const written = await timed((signal) => writeWorkspaceFile(GUI_STATE_PATH, JSON.stringify(state, null, 2), "application/json", undefined, owner, signal),
      { ok: false as const, error: "시간 초과" });
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
  async function dropConfirm(writeRejected: boolean, asOwner = owner) {
    const notice = useAgentEditStore.getState().notice;
    if (notice?.kind !== "confirm") return;
    const message = "GUI 연결이 끊겨(홈 이동·다른 탭·새로고침) 확인을 기다리던 이 편집을 적용하지 않았습니다. gui-state.json을 다시 읽고 새 id로 요청하세요.";
    useAgentEditStore.setState({ notice: { kind: "rejected", requestId: notice.requestId, message } });
    if (writeRejected) await writeResult(notice.requestId, "rejected", message, false, asOwner);
  }

  /** 잠금이 다른 탭으로 넘어갔다 — 이 탭은 더 이상 결과를 쓰지 않는다. */
  function loseConnection() {
    epoch += 1;
    rotateOwner();
    lastResultUnsent = false;
    holder = false;
    lockMaybeHeld = false; // 잠금은 이미 다른 탭 것이다 — 닫을 때 풀면 그 탭의 잠금을 건드린다
    useAgentEditStore.setState({ connected: false });
    void dropConfirm(false);
  }

  /**
   * 서버 잠금을 쥐고 있을 수 있는가. `holder`보다 넓다 — 최초 연결의 복원을 읽는 동안과 연결을
   * 풀며 거절 결과를 쓰는 동안에도 잠금은 이 탭 것이다. 그 사이 탭을 닫으면 해제를 보내야
   * 다른 탭이 잠금 기한(30초)을 기다리지 않는다(PR #303 셀프 리뷰).
   */
  let lockMaybeHeld = false;
  /** 풀기로 했지만 아직 해제를 보내지 않은 지난 연결의 주인 id(거절 결과 쓰기를 기다리는 중). */
  const unreleased = new Set<string>();
  /**
   * 이 연결의 잠금을 푼다. 잠금을 푸는 모든 경로(연결 종료, 최초 연결 취소)가 이걸 지난다.
   * `before`(확인창 거절 결과 쓰기)는 해제 전에 하되 최대 `RELEASE_WRITE_WAIT_MS`만 기다린다 —
   * 응답 없는 결과 쓰기 하나가 해제를 무기한 막지 않게(PR #303 리뷰). 그보다 늦게 도착한 쓰기는
   * 서버가 주인이 아니라고 거부하고, 같은 탭이 다시 잡으면 기억한 결과(`lastResult`)로 다시 쓴다.
   *
   * 다시 잡기는 해제를 기다리지 않는다. 연결마다 주인 id가 달라 늦게 도착한 해제는 새 연결의 잠금과
   * gui-state.json을 지우지 못한다(서버는 주인이 같을 때만 지운다). 지난 연결의 잠금이 아직 남아
   * 있으면 새로 잡기는 busy이고, 해제가 도착하거나 기한(30초)이 지나면 다음 회차가 잡는다.
   */
  function releaseLock(before?: (releaseOwner: string) => Promise<void>): void {
    epoch += 1;
    const releaseOwner = owner;
    rotateOwner();
    // 새 주인 id는 아직 아무것도 쥐지 않았다. 지난 id의 잠금은 해제를 보낼 때까지 따로 기억해,
    // 그 사이 탭을 닫아도 풀리게 한다.
    lockMaybeHeld = false;
    unreleased.add(releaseOwner);
    void (async () => {
      try {
        if (before) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([before(releaseOwner), new Promise<void>((resolve) => { timer = setTimeout(resolve, RELEASE_WRITE_WAIT_MS); })]);
          clearTimeout(timer);
        }
      } finally {
        unreleased.delete(releaseOwner);
        await releaseRequestLock("gui", releaseOwner); // 서버가 이 연결의 gui-state.json을 정리한다
      }
    })();
  }

  function disconnect() {
    if (!holder) {
      // 연결은 못 했지만 시간 초과된 잡기가 서버에선 잡혔을 수 있다 — 홈으로 가면 다시 잡지 않으므로
      // 여기서 풀어야 30초 동안 아무 탭도 연결하지 못하는 일이 없다(PR #303 셀프 리뷰). 잡기가 오가는
      // 중이면 그 응답을 받은 쪽(claim)이 푼다.
      if (lockMaybeHeld && !claiming) releaseLock();
      return;
    }
    holder = false;
    useAgentEditStore.setState({ connected: false });
    // 거절 결과를 **먼저** 쓰고 잠금을 푼다 — 서버가 쓰는 순간 주인인지 본다. 이미 다른 탭에
    // 넘어갔으면 쓰기가 거부돼 새 주인의 결과를 덮지 않는다(PR #303 리뷰).
    releaseLock((releaseOwner) => dropConfirm(true, releaseOwner));
  }

  async function claim() {
    if (stopped) return;
    // 진행 중인 확인보다 먼저 본다 — 그 사이 홈으로 가도 곧바로 연결을 푼다(#279 리뷰).
    if (!onEditor()) { disconnect(); return; }
    if (claiming) return;
    claiming = true;
    try {
      if (!holder && !await timed((signal) => isWorkspaceAvailable(signal), false)) return;
      if (stopped || !onEditor()) return;
      const epochBefore = epoch;
      // 요청을 보내는 순간부터 잠금을 쥐었을 수 있다 — 그 사이 탭을 닫아도 해제를 보낸다.
      if (!holder) lockMaybeHeld = true;
      const outcome = await timed((signal) => acquireRequestLock("gui", owner, holder, signal), "unavailable" as const);
      if (!holder && outcome === "busy" && epoch === epochBefore) lockMaybeHeld = false;
      // 잡기가 오가는 사이 홈으로 갔거나 멈췄는데 잡혔을 수 있다(시간 초과) — 다시 잡지 않으므로 푼다.
      if (!holder && outcome !== "acquired" && lockMaybeHeld && (stopped || !onEditor())) { releaseLock(); return; }
      // 잡는 요청이 오가는 사이 연결을 풀었다(홈 이동) — 해제가 아직 오가든 이미 끝났든 이 응답은
      // 지난 연결의 것이다. 다음 회차가 새 주인 id로 다시 잡는다(PR #303 리뷰).
      if (epoch !== epochBefore) return;
      if (outcome === "acquired") lockMaybeHeld = true;
      const nowHolder = outcome === "acquired" || (holder && outcome === "unavailable");
      if (nowHolder && !holder) {
        // 이전 탭이 처리한 마지막 요청은 다시 적용하지 않는다. 연결 전부터 있던 다른 요청은 이
        // 연결이 공개한 상태로 만든 것이 아니므로 적용하지 않되, 결과는 남긴다 — 숨기면 에이전트가
        // 30초 기다린 뒤 "GUI가 연결되지 않았다"고 잘못 안내한다(#279 리뷰). 복원을 **먼저** 끝내고
        // 연결로 바꾼다 — 그 사이 폴링이 같은 요청을 다시 처리하지 않게.
        // 이전 결과가 "pending"(배경 변경 확인 대기)이면 끝난 요청이 아니다 — 그 확인창은 이전
        // 연결과 함께 사라졌으므로 거절로 끝낸다. 처리 완료로 치면 결과가 영원히 pending에 머문다(#279 리뷰).
        // 읽기 실패를 "파일 없음"으로 치면 이미 처리한 요청을 새 요청으로 보고 다시 처리해 확정 거절로
        // 결과를 덮는다(PR #303 리뷰). 둘 중 하나라도 읽지 못했으면 이번엔 연결하지 않고 잠금을 푼다 —
        // 다음 회차가 다시 잡아 복원한다.
        const readFailed = { ok: false as const };
        const previousRead = await timed((signal) => readWorkspaceTextFileStrict(AGENT_EDIT_RESULT_PATH, signal), readFailed);
        const requestRead = previousRead.ok
          ? await timed((signal) => readWorkspaceTextFileStrict(AGENT_EDIT_PATH, signal), readFailed) : previousRead;
        if (!previousRead.ok || !requestRead.ok) { releaseLock(); return; }
        const previous = previousRead.text;
        let handled: string | null = null;
        let unfinished: string | null = null;
        try {
          const body = previous ? JSON.parse(previous) as { requestId?: unknown; status?: unknown } : null;
          const id = typeof body?.requestId === "string" ? body.requestId : null;
          if (body?.status === "pending") unfinished = id;
          else handled = id;
        } catch { handled = null; }
        const pending = parseAgentEdit(requestRead.text);
        // 요청 파일의 요청이 우선이다 — 결과 파일은 하나라 마지막에 쓴 결과만 남는다.
        let waiting = "id" in pending && pending.id !== handled ? pending.id : unfinished;
        // 이 탭이 이미 처리하고 결과만 못 알린 요청이면 거절 대신 그 결과를 다시 쓴다. 이 탭에서 확인을
        // 기다리던 요청이면 확인창이 연결과 함께 사라졌고 적용하지 않은 게 확실하다(적용했다면 마지막
        // 결과가 applied다). 그 밖의 요청은 이전 연결(다른 탭·새로고침 전)이 적용했는지 이 연결은 알 수
        // 없다 — "적용하지 않았다"고 단정하면 에이전트가 다시 보내 두 번 적용된다(PR #303 리뷰).
        const mine = lastResult !== null && lastResult.requestId === waiting ? lastResult : null;
        const own = mine !== null && mine.status !== "pending" ? mine : null;
        const ownPending = mine !== null && mine.status === "pending";
        if (own !== null) waiting = null;
        lastHandledId = own?.requestId ?? waiting ?? handled;
        if (stopped || !onEditor()) { releaseLock(); return; } // 복원을 읽는 사이 홈으로 갔다
        epoch += 1;
        lastResultUnsent = false;
        // 지난 연결의 쓰기를 기다리지 않는다 — 응답 없는 요청 하나가 새 연결의 결과를 묶지 않게.
        // 지난 연결의 쓰기는 주인 id가 달라 서버가 거부하므로 순서가 섞여도 새 결과를 덮지 못한다.
        resultChain = Promise.resolve();
        holder = true;
        useAgentEditStore.setState({ connected: true });
        await publish(true);
        if (own !== null) {
          await writeResult(own.requestId, own.status, own.message, own.uncertain);
        } else if (waiting !== null && ownPending) {
          await writeResult(waiting, "rejected",
            "GUI 연결이 새로 맺어져(홈 이동 등) 확인을 기다리던 이 편집은 적용되지 않았습니다. gui-state.json을 다시 읽고 새 id로 요청하세요.");
        } else if (waiting !== null) {
          await writeResult(waiting, "rejected", UNCERTAIN_MESSAGE, true);
        }
      } else if (!nowHolder && holder) {
        loseConnection();
      } else if (holder) {
        if (!onEditor()) { disconnect(); return; }
        await publish();
        // 일시 오류로 못 쓴 결과를 다시 쓴다 — 요청은 이미 처리해 폴링이 다시 보지 않으므로, 그대로
        // 두면 에이전트가 결과를 못 받고 같은 편집을 다시 보낼 수 있다.
        if (lastResultUnsent && lastResult !== null && epoch === epochBefore) {
          await writeResult(lastResult.requestId, lastResult.status, lastResult.message, lastResult.uncertain);
        }
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
    if (baseStateRevision !== currentStateRevision(owner)) {
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
    if (parsed.id === lastHandledId || !holder) return;
    // 처리 직전에 연결이 아직 이 탭인지 확인한다 — 연장이 늦어 잠금이 넘어갔다면 새 탭이 처리한다.
    const epochBefore = epoch;
    const outcome = await checkLock(owner);
    // 확인을 기다리는 사이 연결이 바뀌었다(주기 연장이 잃음을 먼저 확인, 홈 이동) — 이 응답이
    // 성공이어도 지난 연결의 것이다. 적용하지 않는다(PR #303 리뷰).
    if (stopped || epoch !== epochBefore || !holder) return;
    if (outcome === "busy") {
      loseConnection();
      return;
    }
    // 소유권을 확인하지 못했으면(일시 오류) 이번엔 처리하지 않고 다음 폴링에서 다시 본다 — 그 사이
    // 잠금이 다른 탭으로 넘어갔다면 그 탭과 함께 두 번 적용된다(PR #303 리뷰).
    if (outcome !== "acquired") return;
    lastHandledId = parsed.id;
    // 확인을 기다리던 앞 요청이 있으면 결과 없이 덮지 않는다 — 적용하지 않은 것으로 확정해 알린다.
    // 그대로 덮으면 그 요청의 결과가 영원히 pending에 머문다(PR #303 리뷰).
    const waitingConfirm = useAgentEditStore.getState().notice;
    if (waitingConfirm?.kind === "confirm") {
      const message = "확인을 기다리는 동안 새 편집 요청이 와서 이 편집은 적용하지 않았습니다. 필요하면 gui-state.json을 다시 읽고 새 id로 요청하세요.";
      useAgentEditStore.setState({ notice: { kind: "rejected", requestId: waitingConfirm.requestId, message } });
      void writeResult(waitingConfirm.requestId, "rejected", message);
    }

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
      const files = await timed((signal) => listWorkspaceFiles(RUNTIME_DIR, { signal }), null);
      if (files?.includes(AGENT_EDIT_FILE)) await handle(await timed((signal) => readWorkspaceTextFile(AGENT_EDIT_PATH, signal), null));
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
    const epochBefore = epoch;
    let outcome;
    try {
      outcome = await checkLock(owner);
    } finally {
      resolving = false;
    }
    if (stopped || epoch !== epochBefore || !holder || useAgentEditStore.getState().notice !== notice) return;
    if (outcome === "busy") { loseConnection(); return; }
    // 소유권을 확인하지 못했으면(일시 오류) 적용도 거절도 하지 않는다 — 확인창을 그대로 두고 사용자가
    // 다시 누를 수 있게 한다. 그 사이 잠금이 넘어갔다면 두 탭에서 적용될 수 있다(PR #303 리뷰).
    if (outcome !== "acquired") return;
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
    if (event.persisted) return;
    if (holder || lockMaybeHeld) void releaseRequestLock("gui", owner, true);
    for (const pending of unreleased) void releaseRequestLock("gui", pending, true);
  };
  const unsubscribeEditor = useEditorStore.subscribe((s, prev) => {
    if (s.spec !== prev.spec || s.activePageId !== prev.activePageId || s.selectedId !== prev.selectedId) schedulePublish();
  });
  const unsubscribeDocument = useDocumentStore.subscribe(schedulePublish);
  const unsubscribeNavigation = useNavigationStore.subscribe((s, prev) => {
    if (s.screen !== prev.screen) void claim();
  });

  // 최초 서버 확인·연결이 실패하거나 지연돼도 재시도와 탭 종료 처리는 살아 있어야 한다.
  if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);
  tickers.push(startTicker(AGENT_CLAIM_MS, () => { void claim(); }));
  tickers.push(startTicker(AGENT_EDIT_POLL_MS, () => { void poll(); }));
  void claim();

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
