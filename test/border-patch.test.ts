import { describe, expect, it } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import { setByPath } from "@/features/editor/store/path";
import { seedSpec } from "@/features/editor/store/seedSpec";
import {
  isBlankBorder,
  mergeBorder,
} from "@/features/editor/ui/properties/borderPatch";

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

describe("isBlankBorder — 아무것도 그리지 않는 테두리", () => {
  it("두께 0에 반경 0이면 빈 것으로 본다", () => {
    // 패널이 테두리 없는 노드에서 칸 하나를 건드렸다 되돌린 모양이다.
    expect(isBlankBorder({ width: 0, color: "#000000", radius: 0 })).toBe(true);
  });

  it("모서리별 반경이 네 칸 모두 0이어도 빈 것이다", () => {
    // "개별" 모드로 전환만 하고 값을 안 넣은 모양.
    expect(
      isBlankBorder({
        width: 0,
        color: "#000000",
        radius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      }),
    ).toBe(true);
  });

  it("두께가 있으면 빈 것이 아니다", () => {
    expect(isBlankBorder({ width: 1, color: "#E5E7EB", radius: 0 })).toBe(false);
  });

  it("두께 0이어도 반경이 있으면 빈 것이 아니다 — 그림자·배경 모서리를 깎는다", () => {
    // examples/card-effects.json의 elevatedCard가 쓰는 실제 모양이다.
    // 두께로만 판정하면 이 카드의 둥근 그림자가 각지게 깨진다.
    expect(
      isBlankBorder({ width: 0, color: "#00000000", radius: 12 }),
    ).toBe(false);
  });

  it("모서리 하나만 있어도 빈 것이 아니다", () => {
    expect(
      isBlankBorder({
        width: 0,
        color: "#000000",
        radius: { topLeft: 20, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      }),
    ).toBe(false);
  });

  it("없는 테두리는 빈 것이다", () => {
    expect(isBlankBorder(undefined)).toBe(true);
  });

  it("색과 정렬은 판정에 넣지 않는다 — 두께 0이면 그릴 선이 없다", () => {
    expect(
      isBlankBorder({
        width: 0,
        color: "#FF0000",
        radius: 0,
        align: "outside",
      }),
    ).toBe(true);
  });
});

describe("빈 테두리를 지운 스펙", () => {
  it("border를 지운 값(undefined)이 검증을 통과한다", () => {
    // 패널은 setNodeField로 지우는데, setByPath는 키를 남기고 값만 undefined로
    // 둔다. Ajv가 이걸 없는 것으로 보는지 실제로 확인해 둔다 — 통과하지 않으면
    // 지우는 방식 자체를 바꿔야 한다.
    expect(validateVisualSpec(specWithHeaderBorder(undefined)).valid).toBe(true);
  });

  it("export되는 JSON에는 키 자체가 남지 않는다", () => {
    // Export는 JSON.stringify를 거치고, 값이 undefined인 키는 그때 빠진다.
    const spec = specWithHeaderBorder(undefined);
    const exported = JSON.parse(JSON.stringify(spec));

    expect("border" in exported.screen.nodes.header).toBe(false);
  });
});
