import type { Ticket, TicketStatus } from "./types";

/**
 * 최소한의 티켓 상태 관리. 저장소는 없다 — compileTickets가 만든 배열을
 * 호출자(에이전트 실행 루프, 또는 나중에 GUI 상태 패널)가 들고 있다가 이
 * 함수들로 불변 업데이트한다.
 */

/** id가 가리키는 티켓 하나만 상태를 바꾼 새 배열을 반환한다. 없는 id는 그대로 둔다. */
export function markTicketStatus(
  tickets: Ticket[],
  id: string,
  status: TicketStatus,
): Ticket[] {
  return tickets.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket));
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
