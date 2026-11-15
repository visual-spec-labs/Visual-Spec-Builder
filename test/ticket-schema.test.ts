import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import type { Ticket } from "@/features/editor/ticket/types";
import { validateTicket, validateTickets } from "@/features/editor/ticket/validate";
import type { VisualSpec } from "@/features/editor/schema";

describe("Ticket Schema v0.1", () => {
  const tickets = compileTickets((dashboardCards as VisualSpec).screen);

  it("dashboard-cards의 compileTickets 결과 전체를 받는다", () => {
    expect(validateTickets(tickets)).toEqual({ valid: true, issues: [] });
  });

  it("Ticket 타입의 선택적 실패 사유를 받는다", () => {
    const failed: Ticket = { ...tickets[0], status: "failed", error: "생성 실패" };
    expect(validateTicket(failed)).toEqual({ valid: true, issues: [] });
    expect(validateTicket({ ...tickets[0], status: "failed" }).valid).toBe(true);
    expect(validateTicket({ ...failed, error: 1 }).valid).toBe(false);
  });

  it("유효하지 않은 status를 issues로 보고한다", () => {
    const result = validateTicket({ ...tickets[0], status: "blocked" });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "schema", path: "/status" })]),
    );
  });

  it("dependsOn의 문자열이 아닌 항목을 issues로 보고한다", () => {
    const result = validateTicket({ ...tickets[0], dependsOn: [42] });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "schema", path: "/dependsOn/0" })]),
    );
  });

  it("instances는 IR의 NodeId 패턴을 재사용한다", () => {
    expect(validateTicket({ ...tickets[0], instances: ["invalid id"] }).valid).toBe(false);
  });

  it("필수 필드 누락과 추가 필드를 거부한다", () => {
    expect(validateTicket({ id: "Card" }).valid).toBe(false);
    expect(validateTicket({ ...tickets[0], extra: true }).valid).toBe(false);
  });

  it("검증 중 예외가 나도 던지지 않고 issues를 돌려준다", () => {
    const hostile = new Proxy({}, { ownKeys: () => { throw new Error("boom"); } });
    expect(() => validateTicket(hostile)).not.toThrow();
    expect(validateTicket(hostile).valid).toBe(false);
  });
});
