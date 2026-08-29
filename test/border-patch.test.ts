import { describe, expect, it } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import { setByPath } from "@/features/editor/store/path";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { mergeBorder } from "@/features/editor/ui/properties/borderPatch";

/** 테두리가 아직 없는 노드(Header)에 패널이 값을 하나 써넣은 스펙을 만든다. */
function specWithHeaderBorder(border: unknown) {
  const spec = structuredClone(seedSpec);
  spec.screen.nodes.header = setByPath(
    spec.screen.nodes.header,
    "border",
    border,
  );
  return spec;
}

describe("border가 없던 노드에서 한 칸만 편집할 때", () => {
  it("두께만 바꿔도 색·반경이 채워진 완전한 객체가 된다", () => {
    expect(mergeBorder(undefined, { width: 3 })).toEqual({
      width: 3,
      color: "#000000",
      radius: 0,
    });
  });

  it("모서리 반경만 바꾸면 두께 0으로 남아 테두리가 보이지 않는다", () => {
    expect(mergeBorder(undefined, { radius: 12 })).toEqual({
      width: 0,
      color: "#000000",
      radius: 12,
    });
  });

  it("기존 값이 있으면 건드린 칸만 덮어쓴다", () => {
    const current = { width: 1, color: "#E5E7EB", radius: 12 };

    expect(mergeBorder(current, { width: 4 })).toEqual({
      width: 4,
      color: "#E5E7EB",
      radius: 12,
    });
  });

  it("결과 스펙이 검증을 통과한다 (Export 가능)", () => {
    const spec = specWithHeaderBorder(mergeBorder(undefined, { width: 3 }));

    expect(validateVisualSpec(spec).valid).toBe(true);
  });

  it("반쪽 객체였다면 검증에 실패했을 것이다 — 회귀 방지", () => {
    // 예전 동작: setNodeField("border.width", 3) → { width: 3 }
    const result = validateVisualSpec(specWithHeaderBorder({ width: 3 }));

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) => issue.message.includes("color")),
    ).toBe(true);
  });
});
