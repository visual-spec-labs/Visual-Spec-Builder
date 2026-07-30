import { describe, expect, it } from "vitest";

import childMissing from "../examples/invalid/child-missing.json";
import cycle from "../examples/invalid/cycle.json";
import multipleParents from "../examples/invalid/multiple-parents.json";
import orphanNode from "../examples/invalid/orphan-node.json";
import rootMissing from "../examples/invalid/root-missing.json";
import rootNotFrame from "../examples/invalid/root-not-frame.json";
import loginScreen from "../examples/login-screen.json";
import { validateVisualSpec } from "../src/index";

describe("validateVisualSpec", () => {
  it("유효한 로그인 화면 예제를 통과시킨다", () => {
    expect(validateVisualSpec(loginScreen)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it.each([
    ["root-missing", rootMissing],
    ["root-not-frame", rootNotFrame],
    ["child-missing", childMissing],
    ["cycle", cycle],
    ["multiple-parents", multipleParents],
    ["orphan-node", orphanNode],
  ] as const)("%s 예제는 해당 오류 코드 하나만 반환한다", (code, input) => {
    const result = validateVisualSpec(input);

    expect(result.valid).toBe(false);
    // 무효 예제는 원인이 하나뿐이어야 한다. 잡음이 섞이면 예제나 검증기가 잘못된 것이다.
    expect(result.issues.map((issue) => issue.code)).toEqual([code]);
  });

  it.each([null, "invalid", [], {}])(
    "잘못된 입력 %#에도 예외를 던지지 않고 invalid를 반환한다",
    (input) => {
      expect(() => validateVisualSpec(input)).not.toThrow();
      expect(validateVisualSpec(input).valid).toBe(false);
    },
  );
});
