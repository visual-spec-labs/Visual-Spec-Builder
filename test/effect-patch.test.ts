import { describe, expect, it } from "vitest";

import {
  blurFromInput,
  opacityFromPercent,
  percentFromOpacity,
} from "@/features/editor/ui/properties/effectPatch";

describe("opacityFromPercent", () => {
  it("100%는 지정 없음으로 지운다 — 아무 효과도 없는 값이 스펙에 남으면 안 된다", () => {
    expect(opacityFromPercent(100)).toBeUndefined();
  });

  it("%를 0..1로 옮긴다", () => {
    expect(opacityFromPercent(35)).toBe(0.35);
    expect(opacityFromPercent(50)).toBe(0.5);
  });

  it("0%는 지우지 않는다 — 완전 투명은 의미 있는 지정이다", () => {
    expect(opacityFromPercent(0)).toBe(0);
  });
});

describe("percentFromOpacity", () => {
  it("값이 없으면 100%로 본다", () => {
    expect(percentFromOpacity(undefined)).toBe(100);
  });

  it("0..1을 %로 옮기고 반올림한다", () => {
    expect(percentFromOpacity(0.35)).toBe(35);
    expect(percentFromOpacity(0)).toBe(0);
    expect(percentFromOpacity(0.333)).toBe(33);
  });

  it("칸에 보여준 값을 그대로 되돌리면 원래 값으로 돌아온다", () => {
    for (const percent of [0, 1, 35, 50, 99]) {
      expect(percentFromOpacity(opacityFromPercent(percent))).toBe(percent);
    }
  });
});

describe("blurFromInput", () => {
  it("0은 지정 없음으로 지운다 — filter를 안 붙이는 것과 결과가 같다", () => {
    expect(blurFromInput(0)).toBeUndefined();
  });

  it("0이 아니면 그대로 쓴다", () => {
    expect(blurFromInput(4)).toBe(4);
    expect(blurFromInput(0.5)).toBe(0.5);
  });
});
