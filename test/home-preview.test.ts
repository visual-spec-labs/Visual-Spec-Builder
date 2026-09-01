import { describe, expect, it } from "vitest";

import { previewScale } from "@/features/editor/ui/homePreview";

describe("previewScale", () => {
  it("콘텐츠가 박스보다 크면 축소한다", () => {
    // 1440x900을 208x140 박스에 — 가로 기준 208/1440, 세로 기준 140/900 중 더 작은 쪽
    expect(previewScale(1440, 900, 208, 140)).toBeCloseTo(
      Math.min(208 / 1440, 140 / 900),
    );
  });

  it("콘텐츠가 박스보다 작으면 확대한다(잘리지 않게 맞춘다)", () => {
    expect(previewScale(100, 100, 208, 140)).toBeCloseTo(1.4);
  });

  it("콘텐츠 크기가 0 이하면 1을 반환한다", () => {
    expect(previewScale(0, 900, 208, 140)).toBe(1);
    expect(previewScale(1440, 0, 208, 140)).toBe(1);
    expect(previewScale(-10, 900, 208, 140)).toBe(1);
  });
});
