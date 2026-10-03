import { describe, expect, it } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import type { Background } from "@/features/editor/schema";
import {
  solidBackgroundPatch,
  solidBackgroundView,
} from "@/features/editor/ui/properties/backgroundPatch";

import loginScreen from "../examples/login-screen.json";

const LINEAR = {
  type: "linear",
  angle: 180,
  stops: [
    { color: "#00000000", at: 0 },
    { color: "#000000CC", at: 1 },
  ],
} as const;

describe("solidBackgroundView", () => {
  it("배경이 없으면 빈 색으로 편집할 수 있다", () => {
    expect(solidBackgroundView(undefined)).toEqual({ editable: true, color: undefined });
    expect(solidBackgroundView([])).toEqual({ editable: true, color: undefined });
  });

  it("solid 한 겹이면 그 색을 편집한다", () => {
    expect(solidBackgroundView([{ type: "solid", color: "#4F46E5" }])).toEqual({
      editable: true,
      color: "#4F46E5",
    });
  });

  it.each([
    ["linear 한 겹", [LINEAR]],
    [
      "solid 두 겹",
      [
        { type: "solid", color: "#FFFFFF" },
        { type: "solid", color: "#000000" },
      ],
    ],
    ["linear 위 solid", [{ type: "solid", color: "#FFFFFF" }, LINEAR]],
  ] as const)("%s은 편집할 수 없다 — 색 칸 하나로 덮으면 겹이 사라진다", (_name, background) => {
    expect(solidBackgroundView(background as unknown as Background)).toEqual({ editable: false });
  });
});

describe("solidBackgroundPatch", () => {
  it("배경이 없던 노드에 solid 한 겹 배열을 만든다", () => {
    expect(solidBackgroundPatch(undefined, "#123456")).toEqual([
      { type: "solid", color: "#123456" },
    ]);
    expect(solidBackgroundPatch([], "#123456")).toEqual([{ type: "solid", color: "#123456" }]);
  });

  it("solid 한 겹의 색을 바꾼 새 배열을 만든다(원본은 그대로)", () => {
    const current: Background = [{ type: "solid", color: "#FFFFFF" }];
    const next = solidBackgroundPatch(current, "#123456");

    expect(next).toEqual([{ type: "solid", color: "#123456" }]);
    expect(next).not.toBe(current);
    expect(current).toEqual([{ type: "solid", color: "#FFFFFF" }]);
  });

  // #209: 같은 값 커밋은 빈 undo 단계를 쌓는다. 같은 참조를 돌려줘야 호출부가
  // 참조 비교로 커밋을 건너뛸 수 있다.
  it("색이 그대로면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [{ type: "solid", color: "#FFFFFF" }];

    expect(solidBackgroundPatch(current, "#FFFFFF")).toBe(current);
  });

  it("대소문자만 달라도 스펙 문자열이 바뀌므로 새 배열이다", () => {
    const current: Background = [{ type: "solid", color: "#ffffff" }];

    expect(solidBackgroundPatch(current, "#FFFFFF")).not.toBe(current);
  });

  it("만들어진 배경은 스키마 검증을 통과한다", () => {
    const spec = structuredClone(loginScreen);
    (spec.screen.nodes.root as { background?: unknown }).background = solidBackgroundPatch(
      undefined,
      "#12345680",
    );

    expect(validateVisualSpec(spec)).toEqual({ valid: true, issues: [] });
  });
});
