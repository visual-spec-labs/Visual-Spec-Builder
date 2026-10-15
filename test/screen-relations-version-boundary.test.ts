import { describe, expect, it } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import { AGENT_EDIT_PROTOCOL_VERSION, buildAgentEditResult, buildGuiState, computeStateRevision, parseAgentEdit } from "./fixtures/command-v01/agentEditProtocol";
import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";

import { validateTransaction } from "./fixtures/command-v01/validate";
import { NL_PROTOCOL_VERSION, parseNlResponse } from "./fixtures/command-v01/nlProtocol";

const project = fixture as unknown as ProjectSpec;

// S1-3 선행 계약 조사: 현재 v0.1 소비자의 실제 동작이다.
// 구현 PR에서 구 정본/parser fixture로 옮겨 이 호환성 근거를 유지한다.
const commands = [{ type: "updateNode", id: "root", path: "name", value: "Renamed" }];

describe("D10 구 소비자 버전 경계 조사", () => {
  it("기존 명령만 있어도 v0.2 Transaction 봉투는 구 G1에서 거부된다", () => {
    expect(validateTransaction({ commands }).valid).toBe(true);
    const result = validateTransaction({ version: "0.2", commands });
    expect(result).toMatchObject({ valid: false, issues: [{ code: "schema", path: "/" }] });
    expect(result.issues.some((issue) => issue.message.includes("version"))).toBe(true);
  });

  it("protocol 1에서 commandVersion만 추가하면 구 NL parser는 버전을 버리고 받는다", () => {
    expect(NL_PROTOCOL_VERSION).toBe(1);
    expect(parseNlResponse(JSON.stringify({
      protocol: 1, requestId: "current", commandVersion: "0.2", commands,
    }), "current")).toEqual({ kind: "commands", commands });
  });

  it("protocol 2는 새 명령 없이도 구 NL parser에서 적용 전에 거부된다", () => {
    const result = parseNlResponse(JSON.stringify({
      protocol: 2, requestId: "current", commandVersion: "0.2", commands,
    }), "current");
    expect(result).toMatchObject({ kind: "malformed", message: expect.stringContaining("버전") });
  });

  it("다른 요청의 새 버전 응답은 현재 요청의 오류로 표시하지 않는다", () => {
    expect(parseNlResponse(JSON.stringify({
      protocol: 2, requestId: "previous", commandVersion: "0.2", commands,
    }), "current")).toEqual({ kind: "stale" });
  });
});

// 직접 편집도 NL과 별개인 신뢰 경계다. 현재 parser와 공개 상태의 동작만 조사한다.
describe("직접 agent-edit 버전과 상태 경계 조사", () => {
  const request = {
    protocol: 1, id: "direct-edit", baseStateRevision: "observed", pageId: "login", commands,
  };

  it("구 직접 parser도 commandVersion만 추가하면 버전을 버리고 기존 명령을 받는다", () => {
    expect(AGENT_EDIT_PROTOCOL_VERSION).toBe(1);
    expect(parseAgentEdit(JSON.stringify({ ...request, commandVersion: "0.2" }))).toMatchObject({
      kind: "edit", id: request.id, commands,
    });
  });

  it("구 직접 parser는 protocol 2를 기존 명령만 있어도 거부한다", () => {
    const parsed = parseAgentEdit(JSON.stringify({ ...request, protocol: 2, commandVersion: "0.2" }));
    expect(parsed).toMatchObject({ kind: "malformed", id: request.id, message: expect.stringContaining("버전") });
    // bridge는 malformed를 invalid 결과로 게시하며 결과 builder는 구 protocol을 사용한다.
    expect(buildAgentEditResult(request.id, "invalid", "버전 불일치", "observed")).toMatchObject({
      protocol: 1, requestId: request.id, status: "invalid",
    });
  });

  it("현재 gui-state에는 Command 지원 capability가 없다", () => {
    const state = buildGuiState({
      tabId: "tab", documentId: 1, fileName: "flow.json", pageId: "login",
      page: project.pages.login, selectedId: null, diskRevision: null, now: new Date("2026-10-15T00:00:00Z"),
    });
    expect(state.protocol).toBe(1);
    expect(state).not.toHaveProperty("capabilities");
  });

  it("현재 direct-edit revision은 다른 페이지에서 추가된 유입 action을 감지하지 못한다", () => {
    const input = { tabId: "tab", documentId: 1, fileName: "flow.json", pageId: "login", page: project.pages.login };
    const changed = structuredClone(project);
    const source = changed.pages.resetPassword.nodes.closeButton;
    if (source.type !== "button") throw new Error("fixture closeButton must be a button");
    source.action = { type: "navigate", target: "login" };
    expect(validateProjectSpec(changed).valid).toBe(true);
    expect(changed.pages.resetPassword).not.toEqual(project.pages.resetPassword);
    expect(computeStateRevision({ ...input, page: changed.pages.login })).toBe(computeStateRevision(input));
    // 문서 교체는 같은 내용/프로젝트여도 세션 documentId로 구별된다.
    expect(computeStateRevision({ ...input, documentId: 2 })).not.toBe(computeStateRevision(input));
  });
});
