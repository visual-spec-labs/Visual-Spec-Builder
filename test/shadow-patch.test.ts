import { describe, expect, it } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import {
  mergeShadow,
  SHADOW_DEFAULT,
} from "@/features/editor/ui/properties/shadowPatch";

import loginScreen from "../examples/login-screen.json";

describe("mergeShadow", () => {
  it("그림자가 없던 노드에서 한 칸만 바꿔도 완전한 객체를 만든다", () => {
    const shadow = mergeShadow(undefined, { y: 10 });

    expect(shadow).toEqual({ ...SHADOW_DEFAULT, y: 10 });
    expect(Object.keys(shadow).sort()).toEqual(["blur", "color", "spread", "x", "y"]);
  });

  it("기존 값을 보존하고 patch만 덮어쓴다", () => {
    const current = { x: 2, y: 4, blur: 8, spread: 1, color: "#111111" } as const;

    expect(mergeShadow(current, { blur: 20 })).toEqual({ ...current, blur: 20 });
  });

  it("빈 patch는 기존 값을 그대로 돌려준다", () => {
    const current = { x: 2, y: 4, blur: 8, spread: 1, color: "#111111" } as const;

    expect(mergeShadow(current, {})).toEqual(current);
  });

  it("만들어진 그림자는 스키마 검증을 통과한다", () => {
    const spec = structuredClone(loginScreen);
    (spec.screen.nodes.root as { shadow?: unknown }).shadow = mergeShadow(undefined, {
      spread: -4,
    });

    expect(validateVisualSpec(spec)).toEqual({ valid: true, issues: [] });
  });

  it("칸이 빠진 그림자는 검증에서 걸린다 — mergeShadow가 막으려는 상황이다", () => {
    const spec = structuredClone(loginScreen);
    (spec.screen.nodes.root as { shadow?: unknown }).shadow = { y: 4 };

    expect(validateVisualSpec(spec).valid).toBe(false);
  });
});
