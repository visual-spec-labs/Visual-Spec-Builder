import { describe, expect, it } from "vitest";

import {
  applyTicketResults,
  isAllDone,
  isReady,
  markTicketStatus,
  readyTickets,
} from "@/features/editor/ticket/ticketStatus";
import type { Ticket } from "@/features/editor/ticket/types";

/**
 * 티켓 상태 전이 순수 함수 (이슈 #74 원안 + #184가 더한 `applyTicketResults`·
 * `markTicketStatus`의 error 처리). 지금까지 이 파일은 `test/ticket-store.test.ts`를
 * 통해서만 간접적으로 덮여 있었다 — #184에서 로직이 늘어난 김에 전용 테스트를 둔다.
 */

function ticket(overrides: Partial<Ticket> & Pick<Ticket, "id">): Ticket {
  return {
    componentName: overrides.id,
    kind: "component",
    instances: [],
    dependsOn: [],
    status: "pending",
    ...overrides,
  };
}

describe("isReady / readyTickets", () => {
  it("dependsOn이 비어 있으면 바로 준비된 것으로 본다", () => {
    const tickets = [ticket({ id: "Header" })];

    expect(isReady(tickets, tickets[0])).toBe(true);
    expect(readyTickets(tickets)).toEqual(tickets);
  });

  it("dependsOn이 전부 done이어야 준비된 것으로 본다", () => {
    const done = ticket({ id: "Card", status: "done" });
    const page = ticket({ id: "Page", dependsOn: ["Card"] });

    expect(isReady([done, page], page)).toBe(true);
  });

  it("dependsOn 중 하나라도 done이 아니면 준비되지 않는다", () => {
    const pending = ticket({ id: "Card" });
    const page = ticket({ id: "Page", dependsOn: ["Card"] });

    expect(isReady([pending, page], page)).toBe(false);
    expect(readyTickets([pending, page])).toEqual([pending]);
  });

  it("의존 티켓이 실패해도 준비된 것으로 보지 않는다 — 실패는 done이 아니다", () => {
    const failed = ticket({ id: "Card", status: "failed", error: "실패" });
    const page = ticket({ id: "Page", dependsOn: ["Card"] });

    expect(isReady([failed, page], page)).toBe(false);
  });

  it("이미 pending이 아닌 티켓은 readyTickets에서 빠진다", () => {
    const inProgress = ticket({ id: "Header", status: "in-progress" });

    expect(readyTickets([inProgress])).toEqual([]);
  });

  it("의존 티켓이 목록에 없으면 아직 안 끝난 것으로 본다", () => {
    const page = ticket({ id: "Page", dependsOn: ["Missing"] });

    expect(isReady([page], page)).toBe(false);
  });
});

describe("isAllDone", () => {
  it("전부 done이면 true", () => {
    expect(isAllDone([ticket({ id: "A", status: "done" }), ticket({ id: "B", status: "done" })])).toBe(
      true,
    );
  });

  it("하나라도 failed면 false", () => {
    expect(
      isAllDone([ticket({ id: "A", status: "done" }), ticket({ id: "B", status: "failed" })]),
    ).toBe(false);
  });

  it("하나라도 pending·in-progress면 false", () => {
    expect(isAllDone([ticket({ id: "A", status: "done" }), ticket({ id: "B" })])).toBe(false);
  });

  it("빈 배열은 false다 — Array.every의 공허 참을 '티켓 없음 = 완료'로 잘못 읽지 않는다(#283)", () => {
    expect(isAllDone([])).toBe(false);
  });
});

describe("markTicketStatus", () => {
  it("id가 가리키는 티켓 하나만 불변 업데이트한다", () => {
    const before = [ticket({ id: "A" }), ticket({ id: "B" })];
    const after = markTicketStatus(before, "A", "done");

    expect(after).not.toBe(before);
    expect(after[0].status).toBe("done");
    expect(after[1]).toBe(before[1]);
  });

  it("failed로 바꾸면서 error를 함께 남길 수 있다", () => {
    const after = markTicketStatus([ticket({ id: "A" })], "A", "failed", "props 추론 실패");

    expect(after[0]).toMatchObject({ status: "failed", error: "props 추론 실패" });
  });

  it("failed가 아닌 상태로 바꾸면 낡은 error를 지운다", () => {
    const before = [ticket({ id: "A", status: "failed", error: "이전 실패" })];
    const after = markTicketStatus(before, "A", "pending");

    expect(after[0].error).toBeUndefined();
  });

  it("없는 id는 그대로 둔다", () => {
    const before = [ticket({ id: "A" })];
    const after = markTicketStatus(before, "Missing", "done");

    expect(after).toEqual(before);
  });
});

describe("applyTicketResults", () => {
  it("results의 ticketId와 일치하는 티켓만 상태를 반영한다", () => {
    const before = [ticket({ id: "Header" }), ticket({ id: "Card" })];
    const after = applyTicketResults(before, [{ ticketId: "Header", status: "done" }]);

    expect(after[0]).toMatchObject({ status: "done" });
    expect(after[1]).toBe(before[1]);
  });

  it("failed 결과는 message를 error로 옮긴다", () => {
    const before = [ticket({ id: "Card" })];
    const after = applyTicketResults(before, [
      { ticketId: "Card", status: "failed", message: "import 경로가 어긋남" },
    ]);

    expect(after[0]).toMatchObject({ status: "failed", error: "import 경로가 어긋남" });
  });

  it("results에 없는 티켓은 손대지 않는다", () => {
    const before = [ticket({ id: "Header" }), ticket({ id: "Card" })];
    const after = applyTicketResults(before, [{ ticketId: "Header", status: "done" }]);

    expect(after[1]).toBe(before[1]);
  });

  it("results에 있지만 tickets에 없는 id는 무시한다", () => {
    const before = [ticket({ id: "Header" })];
    const after = applyTicketResults(before, [{ ticketId: "Ghost", status: "done" }]);

    expect(after).toEqual(before);
  });
});
