import { describe, expect, it } from "vitest";

import { HOME_DRAFT_EXAMPLES } from "@/features/editor/ui/homeDraftExamples";

describe("HOME_DRAFT_EXAMPLES (#286)", () => {
  it("예시가 비어 있지 않고, 라벨·본문 모두 빈 문자열이 아니다", () => {
    expect(HOME_DRAFT_EXAMPLES.length).toBeGreaterThan(0);
    for (const example of HOME_DRAFT_EXAMPLES) {
      expect(example.label.trim()).not.toBe("");
      expect(example.text.trim()).not.toBe("");
    }
  });

  it("라벨이 서로 겹치지 않는다 — 칩 목록의 React key로 쓰인다", () => {
    const labels = HOME_DRAFT_EXAMPLES.map((example) => example.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
