import { describe, expect, it } from "vitest";

import {
  buildNlRequest,
  parseNlResponse,
  NL_PROTOCOL_VERSION,
  NL_REQUEST_PATH,
  NL_RESPONSE_PATH,
} from "@/features/editor/nl/nlProtocol";
import { resolveWorkspaceFile } from "@/features/workspace/workspacePath";
import type { Command } from "@/features/editor/command/types";
import type { ScreenSpec } from "@/features/editor/schema";

/**
 * 자연어 요청/응답 규약 (이슈 #155).
 *
 * 응답은 **바깥에서 온 값**이다 — 에이전트가 무엇을 쓰든 GUI는 예외로 죽지 않고
 * 판정을 내야 한다. 그래서 이 파일의 절반은 "망가진 입력"이다.
 */

const page: ScreenSpec = {
  name: "Home",
  size: { width: 390, height: 844 },
  root: "root",
  nodes: {
    root: {
      type: "frame",
      name: "Screen",
      box: { width: "fill", height: "fill" },
      layout: {
        direction: "column",
        gap: 8,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "stretch",
      },
      background: [{ type: "solid", color: "#FFFFFF" }],
      children: [],
    },
  },
};

const gapCommand: Command = { type: "updateNode", id: "root", path: "layout.gap", value: 24 };

function responseText(body: unknown): string {
  return JSON.stringify(body);
}

describe("buildNlRequest", () => {
  it("규약 버전과 응답 자리를 요청에 함께 싣는다", () => {
    const request = buildNlRequest({
      id: "req-1",
      instruction: "간격을 24로 해줘",
      scope: { kind: "node", nodeId: "root", label: "현재 선택 요소: Screen" },
      pageId: "home",
      page,
    });

    expect(request).toMatchObject({
      protocol: NL_PROTOCOL_VERSION,
      id: "req-1",
      instruction: "간격을 24로 해줘",
      pageId: "home",
      responsePath: NL_RESPONSE_PATH,
    });
    // 에이전트가 노드 id와 현재 값을 여기서 읽는다 — 요약본이 아니라 그대로다.
    expect(request.page).toBe(page);
  });
});

describe("요청·응답 경로는 미들웨어 화이트리스트를 통과한다", () => {
  // 경로 문자열을 손으로 적어 두고 화이트리스트와 어긋나면 GUI가 조용히
  // 403만 받는다. 규약 상수를 실제 경로 해석기에 그대로 물려 고정한다.
  const ROOT = "/tmp/proj/.visual-spec";

  it.each([NL_REQUEST_PATH, NL_RESPONSE_PATH])("%s", (path) => {
    expect(resolveWorkspaceFile(ROOT, path).ok).toBe(true);
  });
});

describe("parseNlResponse — 기다림을 끝낼지 판정한다", () => {
  it("파일이 아직 없으면 stale 이다 — 계속 기다린다", () => {
    expect(parseNlResponse(null, "req-1")).toEqual({ kind: "stale" });
  });

  it("requestId 가 다르면 stale 이다 — 낡은 응답을 이번 답으로 쓰지 않는다", () => {
    const text = responseText({
      protocol: NL_PROTOCOL_VERSION,
      requestId: "req-0",
      commands: [gapCommand],
    });

    expect(parseNlResponse(text, "req-1")).toEqual({ kind: "stale" });
  });

  it("낡은 응답에 담긴 오류도 이번 요청의 실패로 보여주지 않는다", () => {
    const text = responseText({
      protocol: NL_PROTOCOL_VERSION,
      requestId: "req-0",
      error: "못 하겠습니다",
    });

    expect(parseNlResponse(text, "req-1")).toEqual({ kind: "stale" });
  });

  it("JSON이 아니면 malformed — 예외를 던지지 않는다", () => {
    const result = parseNlResponse("{ 이건 JSON이 아니다", "req-1");

    expect(result.kind).toBe("malformed");
  });

  it("객체가 아니면 malformed", () => {
    expect(parseNlResponse("[]", "req-1").kind).toBe("malformed");
    expect(parseNlResponse("42", "req-1").kind).toBe("malformed");
    expect(parseNlResponse("null", "req-1").kind).toBe("malformed");
  });

  it("규약 버전이 다르면 malformed — 조용히 이상한 Command를 만들지 않는다", () => {
    const text = responseText({ protocol: 99, requestId: "req-1", commands: [gapCommand] });
    const result = parseNlResponse(text, "req-1");

    expect(result.kind).toBe("malformed");
    if (result.kind === "malformed") expect(result.message).toContain("99");
  });

  it("에이전트가 못 하겠다고 답하면 그 문장을 그대로 낸다", () => {
    const text = responseText({
      protocol: NL_PROTOCOL_VERSION,
      requestId: "req-1",
      error: "어떤 노드를 말하는지 모르겠습니다.",
    });

    expect(parseNlResponse(text, "req-1")).toEqual({
      kind: "agentError",
      message: "어떤 노드를 말하는지 모르겠습니다.",
    });
  });

  it("commands 가 없으면 G1에서 걸린다", () => {
    const text = responseText({ protocol: NL_PROTOCOL_VERSION, requestId: "req-1" });
    const result = parseNlResponse(text, "req-1");

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") expect(result.issues.length).toBeGreaterThan(0);
  });

  it("Command 스키마를 어기면 G1에서 걸린다 — 없는 type", () => {
    const text = responseText({
      protocol: NL_PROTOCOL_VERSION,
      requestId: "req-1",
      commands: [{ type: "deleteEverything" }],
    });

    expect(parseNlResponse(text, "req-1").kind).toBe("invalid");
  });

  it("빈 배열도 G1에서 걸린다 — Transaction 은 최소 하나를 요구한다", () => {
    const text = responseText({
      protocol: NL_PROTOCOL_VERSION,
      requestId: "req-1",
      commands: [],
    });

    expect(parseNlResponse(text, "req-1").kind).toBe("invalid");
  });

  it("규약과 스키마를 모두 지키면 Command 배열을 그대로 돌려준다", () => {
    const text = responseText({
      protocol: NL_PROTOCOL_VERSION,
      requestId: "req-1",
      commands: [gapCommand],
    });

    expect(parseNlResponse(text, "req-1")).toEqual({ kind: "commands", commands: [gapCommand] });
  });
});
