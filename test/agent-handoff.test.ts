import { describe, expect, it } from "vitest";

import { buildNlAgentInstruction, buildTicketAgentInstruction } from "@/features/editor/ui/agentHandoff";
import { NL_REQUEST_PATH } from "@/features/editor/nl/nlProtocol";
import { TICKET_REQUEST_PATH } from "@/features/editor/ticket/ticketProtocol";
import { WORKSPACE_DIR_NAME } from "@/features/workspace/protocol";

/**
 * 수동 에이전트에게 건넬 지시문(#283)이 실제 프로토콜 경로 상수를 그대로 담고
 * 있는지 고정한다 — 경로가 바뀌었는데 이 문구만 옛 경로를 말하는 회귀를 잡는다.
 */
describe("agentHandoff — 지시문이 실제 경로 상수를 담는다(#283)", () => {
  it("buildNlAgentInstruction은 nl-request 경로와 스킬 이름을 포함한다", () => {
    const instruction = buildNlAgentInstruction();
    expect(instruction).toContain("visual-spec-nl-response");
    expect(instruction).toContain(`${WORKSPACE_DIR_NAME}/${NL_REQUEST_PATH}`);
  });

  it("buildTicketAgentInstruction은 ticket-request 경로와 스킬 이름을 포함한다", () => {
    const instruction = buildTicketAgentInstruction();
    expect(instruction).toContain("visual-spec-ticket-response");
    expect(instruction).toContain("visual-spec-to-react");
    expect(instruction).toContain(`${WORKSPACE_DIR_NAME}/${TICKET_REQUEST_PATH}`);
  });

  it("둘 다 설치 위치(.claude/ 또는 .agents/)를 특정하지 않는다 — GUI는 어느 에이전트가 설치됐는지 모른다", () => {
    expect(buildNlAgentInstruction()).not.toMatch(/\.claude\/|\.agents\//);
    expect(buildTicketAgentInstruction()).not.toMatch(/\.claude\/|\.agents\//);
  });
});
