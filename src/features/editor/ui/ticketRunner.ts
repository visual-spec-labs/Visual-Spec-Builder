/**
 * 티켓 실행 오케스트레이션 — 웨이브 요청/응답 왕복과 자동 체이닝, 취소 (이슈 #184).
 *
 * `store/ticketStore.ts`가 아니라 여기 있는 이유는 `tsconfig.uitest.json` 머리말의
 * 규칙 때문이다: DOM 타입(`fetch`·`Response` 등)을 만지는 코드는 `ui/`에만 두고,
 * `store/`는 DOM 없는 `tsconfig.node.json`으로 검사해 그 경계를 타입 단계에서
 * 강제한다. `ticket/ticketAgentClient.ts`(`requestTicketBatch`)가 `ui/workspaceClient.ts`
 * 를 거쳐 `fetch`를 쓰므로, 이 오케스트레이션을 스토어 액션으로 넣으면 스토어가
 * DOM을 끌고 들어와 그 경계가 깨진다. `nl/nlAgentClient.ts`가 store가 아니라
 * `ui/NaturalLanguageBar.tsx`에서만 쓰이는 것과 같은 이유다.
 *
 * 다만 자연어 쪽과 달리 실행은 **컴포넌트가 사라져도 이어져야 한다** — 티켓 패널을
 * 닫아도(`ticketStore.isOpen`이 꺼져 `TicketPanel`이 unmount돼도) 진행 중이던 웨이브는
 * 계속 진행되고, 다시 열면 최신 상태를 그대로 본다. 그래서 취소 토큰을 컴포넌트의
 * `useRef`가 아니라 이 모듈의 스코프에 둔다 — `useTicketStore`는 zustand 스토어라
 * 어차피 컴포넌트 생명주기와 무관하게 살아 있고, 여기서 `getState`/`setState`로
 * 직접 읽고 쓴다. 대기 연장(`extendTicketWait`)도 같은 이유로 모듈 스코프의 대기 객체를
 * 본다 — 패널을 닫았다 다시 열어도 같은 요청을 연장한다(#284).
 *
 * **응답 수용과 출력 수용을 묶는다(#284).** 응답이 이 요청의 것이어도 그 사이 취소했거나
 * 재컴파일했으면 결과도 출력도 받지 않는다. 받을 때는 `ui/ticketOutputAcceptance.ts`가
 * 이 요청의 임시 출력만 `generated/`로 확정하고, 출력이 없는 `done`은 `failed`로 바꾼다.
 * 상태 전이표와 경계는 docs/26.
 */

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import {
  createTicketRequestId,
  requestTicketBatch,
  type TicketCancelToken,
} from "@/features/editor/ticket/ticketAgentClient";
import { createAgentRequestWait, type AgentRequestWait } from "@/features/editor/ui/agentRequestWait";
import { acceptTicketOutputs } from "@/features/editor/ui/ticketOutputAcceptance";
import {
  applyTicketResults,
  isReady,
  markTicketStatus,
  readyTickets,
} from "@/features/editor/ticket/ticketStatus";
import type { Ticket } from "@/features/editor/ticket/types";

/** 진행 중인 웨이브의 취소 토큰. 없으면(null) 아무 웨이브도 돌고 있지 않다. */
let activeCancel: TicketCancelToken | null = null;
/** 진행 중인 웨이브 요청의 대기(기한·연장). 끝난 대기는 스스로 연장을 거절한다. */
let activeWait: AgentRequestWait | null = null;
let activePromotion: { token: TicketCancelToken; release: () => void } | null = null;

// "실행"이 아니라 "전달"이다(#283 리뷰 대응) — GUI는 에이전트를 실행하지 않고
// 요청을 전달할 뿐이다. 패널의 다른 문구는 이미 "전달"로 바뀌었는데 이 상수만
// 옛 "실행" 표현이 남아 있었다.
export const STALE_TICKET_MESSAGE = "화면이 바뀌었습니다. 현재 스펙으로 티켓을 다시 생성해야 전달할 수 있습니다.";

/**
 * 티켓을 만든 뒤 편집·페이지 전환·문서 전환이 있었으면 true다(이슈 #271).
 *
 * 편집은 페이지 객체를 새로 만들므로 참조로 가른다. 문서 전환은 참조만으로 못
 * 가른다 — New를 두 번 하면 같은 `blankSpec` 화면 객체를 다시 쓴다(PR #295 리뷰) —
 * 그래서 `editorStore.documentId`를 함께 본다. Undo는 문서를 바꾸지 않으므로 다시
 * 실행할 수 있다. 패널의 안내문만으로는 막지 못한다 — 버튼이 아닌 경로(다음 웨이브
 * 자동 이어가기, 다른 호출자)도 낡은 `sourcePage`를 요청 파일에 그대로 쓴다.
 */
export function isTicketPlanStale(): boolean {
  const { sourcePageId, sourcePage, sourceDocumentId } = useTicketStore.getState();
  const { activePageId, spec, documentId } = useEditorStore.getState();
  return sourceDocumentId !== documentId || sourcePageId !== activePageId ||
    sourcePage !== spec.pages[activePageId];
}

function revertToPending(waveTickets: Ticket[]): void {
  useTicketStore.setState((state) => ({
    tickets: waveTickets.reduce(
      (tickets, ticket) => markTicketStatus(tickets, ticket.id, "pending"),
      state.tickets,
    ),
  }));
}

/**
 * 웨이브 하나(티켓 여러 개)를 요청하고 응답을 반영한다. `chain`이 true면 응답 반영
 * 뒤 `readyTickets`를 다시 계산해 비어있지 않은 동안 재귀한다(`runAllTickets`가
 * 쓴다) — 의존 순서를 지키며 사람 손 없이 끝까지 진행된다. `chain`이 false면
 * 한 웨이브로 끝낸다(`runOneTicket`이 쓴다).
 *
 * 응답을 받은 뒤 `generation`이 시작 시점과 같은지 확인한다 — 다르면(그 사이
 * 재컴파일됐으면) 지금 `tickets` 배열이 이 웨이브가 보낸 티켓들과 이미 무관하므로
 * 응답을 버린다. `sourcePage` **참조** 비교가 아니라 `generation`(정수 카운터)을
 * 쓰는 이유는, 내용이 같은 페이지로 재컴파일해도(예: 그냥 "다시 생성"을 다시 누름)
 * `sourcePage`가 우연히 같은 참조일 수 있어서다(`store/ticketStore.ts`의 `generation`
 * 주석 참고). `ticketStore.compile`이 재컴파일 때 `running`/`runError`를 직접
 * 초기화해 두므로, 여기서 상태를 더 건드리지 않아도 UI는 깨끗한 상태로 보인다.
 */
async function runWave(waveTickets: Ticket[], chain: boolean): Promise<void> {
  const { sourcePageId, sourcePage, generation } = useTicketStore.getState();
  if (sourcePageId === null || sourcePage === null || waveTickets.length === 0) return;
  // 첫 웨이브와 자동으로 이어지는 다음 웨이브 모두 여기서 막는다(#271). 응답을 기다리는
  // 동안 편집했다면 이미 받은 결과는 그 요청(이전 스펙)의 사실이라 반영하지만, 바뀐
  // 화면을 이전 스펙으로 이어서 구현하지는 않는다. 안내는 `runError`에 남기지 않는다 —
  // Undo로 같은 페이지 객체에 돌아오면 다시 실행할 수 있으므로, 패널이 현재 낡음을
  // 매번 계산해 보여준다.
  if (isTicketPlanStale()) {
    activeCancel = null;
    activeWait = null;
    useTicketStore.setState({ running: false, runError: null, runErrorRetryable: false, wait: null });
    return;
  }

  const cancelToken: TicketCancelToken = { cancelled: false };
  activeCancel = cancelToken;
  // 진행 보고는 이 웨이브가 아직 현재일 때만 스토어에 쓴다 — 재컴파일 뒤 이전 루프가 끝나기 전
  // 마지막 회차를 돌며 새 계획의 화면을 덮지 않게 한다.
  const wait = createAgentRequestWait((progress) => {
    if (activeWait === wait && useTicketStore.getState().generation === generation) {
      useTicketStore.setState({ wait: progress });
    }
  });
  activeWait = wait;
  const requestId = createTicketRequestId();

  useTicketStore.setState((state) => ({
    tickets: waveTickets.reduce(
      (tickets, ticket) => markTicketStatus(tickets, ticket.id, "in-progress"),
      state.tickets,
    ),
    running: true,
    runError: null,
    runErrorRetryable: false,
    wait: { phase: "saving", deadline: null },
  }));

  const outcome = await requestTicketBatch(
    { id: requestId, pageId: sourcePageId, page: sourcePage, tickets: waveTickets },
    cancelToken,
    wait,
    true,
  );

  if (useTicketStore.getState().generation !== generation) {
    if (outcome.kind === "response") outcome.lock?.release();
    return;
  }
  if (activeWait === wait) activeWait = null;
  useTicketStore.setState({ wait: null });

  // 응답을 읽은 회차와 취소 클릭이 엇갈릴 수 있다. 사용자가 취소했으면 그 요청의 응답도 출력도
  // 받지 않는다 — 취소는 "이 요청의 결과를 수용하지 않는다"는 뜻이다(docs/26).
  if (outcome.kind === "cancelled" || cancelToken.cancelled) {
    if (outcome.kind === "response") outcome.lock?.release();
    revertToPending(waveTickets);
    useTicketStore.setState({ running: false });
    activeCancel = null;
    return;
  }

  if (outcome.kind !== "response") {
    revertToPending(waveTickets);
    // timeout·lockLost일 때만 "재시도" 안내가 뜻이 있다(#283 리뷰 대응) — 둘 다
    // 요청 파일은 이미 썼는데 더 이상 누구도 응답을 기다리지 않는 상태라 "다시
    // 눌러 새 요청을 만들라"가 맞다. unavailable·busy(요청 전 잠금 충돌)·
    // writeFailed는 애초에 요청이 안 쓰였거나 다른 탭이 잠금을 쥐고 있어, 같은
    // 문구가 실제 원인과 안 맞는다. connectionLost(#284)도 요청은 이미 썼으므로 서버를 되살린 뒤
    // 새 요청을 만드는 것이 다음 행동이다.
    useTicketStore.setState({
      running: false,
      runError: outcome.message,
      runErrorRetryable:
        outcome.kind === "timeout" || outcome.kind === "lockLost" || outcome.kind === "connectionLost",
    });
    activeCancel = null;
    return;
  }

  if (outcome.result.kind !== "results") {
    outcome.lock?.release();
    revertToPending(waveTickets);
    useTicketStore.setState({
      running: false,
      runError:
        outcome.result.kind === "malformed" ? outcome.result.message : "이번 요청의 응답이 아닙니다.",
      runErrorRetryable: false,
    });
    activeCancel = null;
    return;
  }

  // 이 요청의 임시 출력만 확정한다. 확정은 요청에 실었던 입력(sourcePage)으로 기록한다 — 그
  // 사이 편집했다면 Export가 지문 차이로 "오래됨"을 보인다(결과 반영 정책은 #271 그대로).
  const promotion = { token: cancelToken, release: () => outcome.lock?.release() };
  activePromotion = promotion;
  // Recompilation can start a new run while an old PUT body is still in flight.
  // Revoke the old lease immediately; the server fences that delayed write.
  const unsubscribe = useTicketStore.subscribe((state) => {
    if (state.generation !== generation) promotion.release();
  });
  const acceptance = await acceptTicketOutputs({
    requestId,
    pageId: sourcePageId,
    page: sourcePage,
    waveTickets,
    results: outcome.result.results,
    isCurrent: () => !cancelToken.cancelled && useTicketStore.getState().generation === generation,
    renew: () => outcome.lock?.renew(true) ?? Promise.resolve(false),
  }).finally(() => {
    unsubscribe();
    promotion.release();
    if (activePromotion === promotion) activePromotion = null;
  });
  // 확정하는 사이 재컴파일됐으면 지금 tickets는 이 웨이브와 무관하다. 확정한 파일은 그 요청 입력의
  // 사실로 기록돼 있고 Export가 판정한다.
  if (useTicketStore.getState().generation !== generation) return;

  const results = acceptance.results;
  useTicketStore.setState((state) => ({
    tickets: applyTicketResults(state.tickets, results),
    ...(acceptance.manifestError === null ? {} : { acceptanceWarning: acceptance.manifestError }),
  }));

  if (chain && !cancelToken.cancelled) {
    const nextWave = readyTickets(useTicketStore.getState().tickets);
    if (nextWave.length > 0) {
      await runWave(nextWave, true);
      return;
    }
  }

  activeCancel = null;
  useTicketStore.setState({ running: false });
}

/** 준비된 티켓 전부를 한 웨이브로 보내고, 응답이 오면 다음 웨이브로 자동으로 이어간다. */
export async function runAllTickets(): Promise<void> {
  if (useTicketStore.getState().running) return;
  const wave = readyTickets(useTicketStore.getState().tickets);
  if (wave.length === 0) return;
  await runWave(wave, true);
}

/** 티켓 하나만 웨이브 크기 1로 보낸다 — 끝나도 다음 웨이브로 이어가지 않는다. */
export async function runOneTicket(id: string): Promise<void> {
  if (useTicketStore.getState().running) return;
  const { tickets } = useTicketStore.getState();
  const ticket = tickets.find((candidate) => candidate.id === id);
  if (ticket === undefined || ticket.status !== "pending" || !isReady(tickets, ticket)) return;
  await runWave([ticket], false);
}

/**
 * 진행 중인 웨이브를 멈춘다. 다음 폴링 차례에 반영된다(즉시가 아니다). GUI가 기다림을 멈추고 그
 * 요청의 결과를 받지 않는 것이지, 외부 에이전트를 멈추는 것은 아니다(docs/26).
 */
export function cancelTicketRun(): void {
  if (activeCancel !== null) {
    activeCancel.cancelled = true;
    if (activePromotion?.token === activeCancel) activePromotion.release();
  }
}

/**
 * 진행 중인 요청의 기한을 미룬다(#284). 같은 요청 ID 그대로다 — 새 요청은 "에이전트에 전달"을 다시
 * 누를 때만 생긴다. 끝난 요청이면 false.
 */
export function extendTicketWait(): boolean {
  return activeWait?.extend() ?? false;
}
