import type { TicketResultItem } from "./ticketProtocol";
import type { Ticket, TicketStatus } from "./types";

/**
 * 최소한의 티켓 상태 관리. 저장소는 없다 — compileTickets가 만든 배열을
 * 호출자(에이전트 실행 루프, 또는 나중에 GUI 상태 패널)가 들고 있다가 이
 * 함수들로 불변 업데이트한다.
 */

/**
 * id가 가리키는 티켓 하나만 상태를 바꾼 새 배열을 반환한다. 없는 id는 그대로 둔다.
 *
 * `error`는 `status`가 `"failed"`일 때만 남는다 — 다른 상태로 바뀌면(사람이 드롭다운으로
 * 되돌리든, 재실행이 성공하든) 지운다. 낡은 실패 사유가 다음 성공 뒤에도 화면에 남는
 * 것을 막는다(이슈 #184).
 */
export function markTicketStatus(
  tickets: Ticket[],
  id: string,
  status: TicketStatus,
  error?: string,
): Ticket[] {
  return tickets.map((ticket) =>
    ticket.id === id
      ? { ...ticket, status, error: status === "failed" ? error : undefined }
      : ticket,
  );
}

/**
 * 에이전트 응답의 `results`를 티켓 배열에 반영한다(이슈 #184). 순수 함수 — 여러 티켓을
 * 한 번에 갱신한다는 점만 `markTicketStatus`와 다르다.
 *
 * `results`에 없는 티켓은 손대지 않는다 — 응답은 그 웨이브에 실었던 티켓만 담는다.
 * `results`에 있지만 `tickets`에 없는 id는 무시한다(`markTicketStatus`와 같은 관용 —
 * 응답이 바깥에서 온 값이라 티켓 배열과 어긋날 수 있다).
 */
export function applyTicketResults(tickets: Ticket[], results: TicketResultItem[]): Ticket[] {
  const byId = new Map(results.map((result) => [result.ticketId, result]));
  return tickets.map((ticket) => {
    const result = byId.get(ticket.id);
    if (result === undefined) return ticket;
    return { ...ticket, status: result.status, error: result.status === "failed" ? result.message : undefined };
  });
}

/**
 * 이 티켓이 지금 시작해도 되는지 — dependsOn 전부가 "done"인지 본다.
 * 의존 티켓이 tickets 목록에 없으면(잘못 만들어진 경우) 아직 안 끝난 것으로 본다.
 */
export function isReady(tickets: Ticket[], ticket: Ticket): boolean {
  return ticket.dependsOn.every(
    (dependsOnId) => tickets.find((candidate) => candidate.id === dependsOnId)?.status === "done",
  );
}

/** 지금 시작할 수 있는(대기 중이면서 의존성이 다 끝난) 티켓들. */
export function readyTickets(tickets: Ticket[]): Ticket[] {
  return tickets.filter((ticket) => ticket.status === "pending" && isReady(tickets, ticket));
}

/** 전부 done이면 true. 하나라도 failed가 있으면 완료로 치지 않는다. */
export function isAllDone(tickets: Ticket[]): boolean {
  return tickets.every((ticket) => ticket.status === "done");
}
