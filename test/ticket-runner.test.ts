import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedSpec } from "@/features/editor/store/seedSpec";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import type { TicketBatchOutcome } from "@/features/editor/ticket/ticketAgentClient";
import { requestTicketBatch } from "@/features/editor/ticket/ticketAgentClient";
import { cancelTicketRun, runAllTickets, runOneTicket } from "@/features/editor/ui/ticketRunner";

/**
 * `ui/ticketRunner.ts`의 웨이브 오케스트레이션(자동 이어가기·실패 차단·취소) (이슈 #184).
 *
 * `requestTicketBatch`(I/O 폴링)는 `nl/nlAgentClient.ts`가 그렇듯 전용 테스트를 두지
 * 않는다(`pnpm dev` 수동 검증) — 여기서는 그걸 대체해 오케스트레이션 로직만 본다.
 * `ticketAgentClient.ts`가 `ui/workspaceClient.ts`(fetch)를 거치므로 이 파일은
 * `tsconfig.uitest.json`(DOM 타입 포함) 아래서 검사한다(`document-path.test.ts`와 같은
 * 이유 — `tsconfig.node.json`의 exclude·이 프로젝트의 include 참고).
 */
vi.mock("@/features/editor/ticket/ticketAgentClient", () => ({
  createTicketRequestId: () => "req-test",
  requestTicketBatch: vi.fn(),
}));

const mockedRequestTicketBatch = vi.mocked(requestTicketBatch);

function doneResult(ticketId: string): { ticketId: string; status: "done" } {
  return { ticketId, status: "done" };
}

function failedResult(ticketId: string, message: string) {
  return { ticketId, status: "failed" as const, message };
}

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
  mockedRequestTicketBatch.mockReset();
}

describe("ticketRunner (#184)", () => {
  beforeEach(reset);

  it("readyTickets가 없으면 runAllTickets는 아무 것도 보내지 않는다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    // seedSpec 티켓 전부를 수동으로 done 처리 — 더 이상 pending이 없다.
    for (const ticket of useTicketStore.getState().tickets) {
      useTicketStore.getState().markStatus(ticket.id, "done");
    }

    await runAllTickets();

    expect(mockedRequestTicketBatch).not.toHaveBeenCalled();
    expect(useTicketStore.getState().running).toBe(false);
  });

  it("runAllTickets가 의존 웨이브(Header·Card → Content → DashboardPage)를 자동으로 이어간다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);

    mockedRequestTicketBatch
      .mockResolvedValueOnce({
        kind: "response",
        result: { kind: "results", results: [doneResult("Header"), doneResult("Card")] },
      } satisfies TicketBatchOutcome)
      .mockResolvedValueOnce({
        kind: "response",
        result: { kind: "results", results: [doneResult("Content")] },
      } satisfies TicketBatchOutcome)
      .mockResolvedValueOnce({
        kind: "response",
        result: { kind: "results", results: [doneResult("DashboardPage")] },
      } satisfies TicketBatchOutcome);

    await runAllTickets();

    const state = useTicketStore.getState();
    expect(state.tickets.every((ticket) => ticket.status === "done")).toBe(true);
    expect(state.running).toBe(false);
    expect(state.runError).toBeNull();
    expect(mockedRequestTicketBatch).toHaveBeenCalledTimes(3);

    const wave1Tickets = mockedRequestTicketBatch.mock.calls[0][0].tickets.map((t) => t.id).sort();
    const wave2Tickets = mockedRequestTicketBatch.mock.calls[1][0].tickets.map((t) => t.id);
    const wave3Tickets = mockedRequestTicketBatch.mock.calls[2][0].tickets.map((t) => t.id);
    expect(wave1Tickets).toEqual(["Card", "Header"]);
    expect(wave2Tickets).toEqual(["Content"]);
    expect(wave3Tickets).toEqual(["DashboardPage"]);
  });

  it("실패한 티켓의 후행은 절대 요청되지 않는다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);

    mockedRequestTicketBatch.mockResolvedValueOnce({
      kind: "response",
      result: {
        kind: "results",
        results: [doneResult("Header"), failedResult("Card", "props 추론 실패")],
      },
    } satisfies TicketBatchOutcome);

    await runAllTickets();

    const state = useTicketStore.getState();
    expect(state.tickets.find((t) => t.id === "Header")?.status).toBe("done");
    expect(state.tickets.find((t) => t.id === "Card")).toMatchObject({
      status: "failed",
      error: "props 추론 실패",
    });
    // Content는 Card에, DashboardPage는 Header·Content에 의존한다 — 둘 다 대기로 남는다.
    expect(state.tickets.find((t) => t.id === "Content")?.status).toBe("pending");
    expect(state.tickets.find((t) => t.id === "DashboardPage")?.status).toBe("pending");
    expect(state.running).toBe(false);
    expect(mockedRequestTicketBatch).toHaveBeenCalledTimes(1);
  });

  it("runOneTicket은 티켓 하나만 보내고 다음 웨이브로 자동으로 이어가지 않는다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);
    // Content가 준비되도록 Header·Card를 먼저 수동으로 끝내 둔다(에이전트를 거치지 않고).
    useTicketStore.getState().markStatus("Header", "done");
    useTicketStore.getState().markStatus("Card", "done");

    mockedRequestTicketBatch.mockResolvedValueOnce({
      kind: "response",
      result: { kind: "results", results: [doneResult("Content")] },
    } satisfies TicketBatchOutcome);

    await runOneTicket("Content");

    const state = useTicketStore.getState();
    expect(state.tickets.find((t) => t.id === "Content")?.status).toBe("done");
    // DashboardPage는 이제 Header·Content 둘 다 done이라 준비됐지만, runOneTicket은
    // 그 웨이브를 자동으로 보내지 않는다.
    expect(state.tickets.find((t) => t.id === "DashboardPage")?.status).toBe("pending");
    expect(state.running).toBe(false);
    expect(mockedRequestTicketBatch).toHaveBeenCalledTimes(1);
  });

  it("cancelTicketRun 이후 cancelled로 응답하면 그 웨이브를 pending으로 되돌린다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);

    let resolveOutcome: (value: TicketBatchOutcome) => void = () => {};
    mockedRequestTicketBatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOutcome = resolve;
        }),
    );

    const runPromise = runAllTickets();
    // 요청이 나간 뒤(동기 부분이 끝난 뒤) 해당 웨이브가 in-progress인지 먼저 확인한다.
    expect(useTicketStore.getState().running).toBe(true);
    expect(useTicketStore.getState().tickets.find((t) => t.id === "Header")?.status).toBe(
      "in-progress",
    );

    cancelTicketRun();
    resolveOutcome({ kind: "cancelled" });
    await runPromise;

    const state = useTicketStore.getState();
    expect(state.running).toBe(false);
    expect(state.tickets.find((t) => t.id === "Header")?.status).toBe("pending");
    expect(state.tickets.find((t) => t.id === "Card")?.status).toBe("pending");
    expect(mockedRequestTicketBatch).toHaveBeenCalledTimes(1);
  });

  it("전송 실패(unavailable 등)면 웨이브를 pending으로 되돌리고 runError를 남긴다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);

    mockedRequestTicketBatch.mockResolvedValueOnce({
      kind: "unavailable",
      message: "작업공간에 연결돼 있지 않습니다.",
    } satisfies TicketBatchOutcome);

    await runAllTickets();

    const state = useTicketStore.getState();
    expect(state.running).toBe(false);
    expect(state.runError).toBe("작업공간에 연결돼 있지 않습니다.");
    expect(state.tickets.find((t) => t.id === "Header")?.status).toBe("pending");
  });

  it("재컴파일하면(sourcePage 참조 변경) 진행 중이던 응답을 버린다", async () => {
    useTicketStore.getState().compile("page1", seedSpec.screen);

    let resolveOutcome: (value: TicketBatchOutcome) => void = () => {};
    mockedRequestTicketBatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOutcome = resolve;
        }),
    );

    const runPromise = runAllTickets();
    expect(useTicketStore.getState().running).toBe(true);

    // TicketPanel의 "다시 생성"과 같은 순서: 재컴파일이 running·runError를 먼저 초기화한다.
    useTicketStore.getState().compile("page1", seedSpec.screen);
    expect(useTicketStore.getState().running).toBe(false);
    expect(useTicketStore.getState().tickets.every((ticket) => ticket.status === "pending")).toBe(
      true,
    );

    // 낡은 웨이브의 응답이 뒤늦게 와도 새로 컴파일된 tickets를 건드리지 않는다.
    resolveOutcome({
      kind: "response",
      result: { kind: "results", results: [doneResult("Header"), doneResult("Card")] },
    });
    await runPromise;

    const state = useTicketStore.getState();
    expect(state.running).toBe(false);
    expect(state.tickets.every((ticket) => ticket.status === "pending")).toBe(true);
  });
});
