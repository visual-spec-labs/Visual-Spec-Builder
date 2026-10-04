import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import {
  buildTicketRequest,
  parseTicketResponse,
  type TicketRequest,
} from "@/features/editor/ticket/ticketProtocol";
import { applyTicketResults } from "@/features/editor/ticket/ticketStatus";
import { compileTickets } from "@/features/editor/ticket/compileTickets";

const skill = readFileSync(new URL("../skills/visual-spec-ticket-response/SKILL.md", import.meta.url), "utf8");
const examples = [...skill.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]));
const request = examples[0] as TicketRequest;

// 스킬을 따르는 AI의 품질 검사가 아니라 배포 지시문의 예제가 실제 프로토콜과 맞는지 검사한다.
describe("티켓 응답 스킬 예제 계약 (#217)", () => {
  it("요청 예제는 유효한 화면이며 실제 compiler/request builder의 출력과 일치한다", () => {
    expect(validateVisualSpec({ version: "0.3", screen: request.page }).valid).toBe(true);
    expect(buildTicketRequest({
      id: request.id,
      pageId: request.pageId,
      page: request.page,
      tickets: compileTickets(request.page),
    })).toEqual(request);
  });

  it.each([
    { index: 1, status: "done" },
    { index: 2, status: "failed" },
  ])("$status 응답 예제는 실제 파서를 통과하고 해당 티켓 상태를 바꾼다", ({ index, status }) => {
    const response = examples[index];
    const parsed = parseTicketResponse(JSON.stringify(response), request.id);
    expect(parsed.kind).toBe("results");
    if (parsed.kind !== "results") throw new Error("응답 예제 파싱 실패");
    expect(parsed.results.map((result) => result.ticketId)).toEqual(request.tickets.map((ticket) => ticket.id));
    const tickets = applyTicketResults(compileTickets(request.page), parsed.results);
    expect(tickets[0].status).toBe(status);
    if (status === "failed") expect(tickets[0].error).toContain("권한 없음");
    expect(parseTicketResponse(JSON.stringify(response), "next-wave")).toEqual({ kind: "stale" });
  });
});
