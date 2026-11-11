import { beforeEach, describe, expect, it } from "vitest";

import { seedSpec } from "@/features/editor/store/seedSpec";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { readyTickets } from "@/features/editor/ticket/ticketStatus";

/**
 * `running`/`runError`의 실제 오케스트레이션(웨이브 체이닝·취소)은
 * `ui/ticketRunner.ts`가 맡는다(`test/ticket-runner.test.ts`) — 이 파일은 `fetch`를
 * 끌어들이지 않는 순수 상태(`tickets`·`compile`·`markStatus`·`close`)만 본다.
 */
function reset(): void {
  useTicketStore.setState({
    tickets: [],
    sourcePageId: null,
    sourcePage: null,
    isOpen: false,
    running: false,
    runError: null,
    generation: 0,
  });
}

describe("ticketStore (#156)", () => {
  beforeEach(reset);

  it("현재 화면을 컴파일하고 패널을 연다", () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);

    const state = useTicketStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.sourcePageId).toBe("page1");
    expect(state.sourcePage).toBe(seedSpec.screen);
    expect(state.tickets.length).toBeGreaterThan(0);
  });

  it("compileTickets가 정한 의존 순서와 초기 상태를 그대로 둔다", () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    const { tickets } = useTicketStore.getState();

    expect(tickets.every((ticket) => ticket.status === "pending")).toBe(true);
    expect(readyTickets(tickets).length).toBeGreaterThan(0);
    expect(tickets.at(-1)?.kind).toBe("page");
  });

  it("티켓 상태 하나만 불변 업데이트한다", () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    const before = useTicketStore.getState().tickets;
    const first = before[0];

    useTicketStore.getState().markStatus(first.id, "done");

    const after = useTicketStore.getState().tickets;
    expect(after).not.toBe(before);
    expect(after[0]).toEqual({ ...first, status: "done" });
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it("다시 컴파일하면 수동 상태를 초기화한다", () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    const id = useTicketStore.getState().tickets[0].id;
    useTicketStore.getState().markStatus(id, "done");

    useTicketStore.getState().compile("page1", seedSpec.screen);

    expect(useTicketStore.getState().tickets[0].status).toBe("pending");
  });

  it("다시 컴파일하면 running·runError도 초기화한다(#184) — 낡은 웨이브의 흔적을 남기지 않는다", () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    useTicketStore.setState({ running: true, runError: "이전 웨이브 오류" });

    useTicketStore.getState().compile("page1", seedSpec.screen);

    const state = useTicketStore.getState();
    expect(state.running).toBe(false);
    expect(state.runError).toBeNull();
  });

  it("닫아도 계획은 보존해 다시 열 때 이어갈 수 있다", () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    const tickets = useTicketStore.getState().tickets;

    useTicketStore.getState().close();

    expect(useTicketStore.getState().isOpen).toBe(false);
    expect(useTicketStore.getState().tickets).toBe(tickets);
  });
});
