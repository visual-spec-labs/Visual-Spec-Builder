import { describe, expect, it } from "vitest";

import { validateTransaction } from "@/features/editor/command";
import { NL_PROTOCOL_VERSION, parseNlResponse } from "@/features/editor/nl/nlProtocol";

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
