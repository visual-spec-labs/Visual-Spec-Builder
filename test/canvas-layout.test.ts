import { describe, expect, it } from "vitest";

import {
  boxStyle,
  effectStyle,
  strokeAndShadowStyle,
} from "@/features/editor/ui/canvasLayout";

describe("boxStyle — 주축 Fill", () => {
  it("형제끼리 공간을 균등하게 나누도록 flex: 1 1 0 으로 옮긴다", () => {
    const style = boxStyle({ width: "fill", height: "auto" }, "row");

    expect(style.flexGrow).toBe(1);
    expect(style.flexShrink).toBe(1);
    expect(style.flexBasis).toBe(0);
    // width:100%로 두면 형제 너비를 침범하므로 명시적 너비를 주지 않는다.
    expect(style.width).toBeUndefined();
  });

  it("min-width를 0으로 풀어 콘텐츠 최소 너비가 형제를 밀어내지 못하게 한다", () => {
    // 이것이 없으면 한 카드의 좌우 패딩·폰트를 키울 때 형제 카드가 좁아진다.
    expect(boxStyle({ width: "fill", height: "auto" }, "row").minWidth).toBe(0);
    expect(boxStyle({ width: "auto", height: "fill" }, "column").minHeight).toBe(0);
  });

  it("세로 방향에서는 height가 주축이 된다", () => {
    const style = boxStyle({ width: "auto", height: "fill" }, "column");

    expect(style.flexGrow).toBe(1);
    expect(style.flexBasis).toBe(0);
    expect(style.height).toBeUndefined();
  });
});

describe("boxStyle — 교차축 Fill", () => {
  it("퍼센트가 아니라 align-self: stretch로 늘린다", () => {
    // height:100%는 부모 높이가 auto면 CSS 규격상 무시되어 아무 일도 안 일어난다.
    const style = boxStyle({ width: "fill", height: "fill" }, "column");

    expect(style.alignSelf).toBe("stretch");
    expect(style.width).toBe("auto");
  });

  it("가로 방향에서는 height가 교차축이 된다", () => {
    const style = boxStyle({ width: "fill", height: "fill" }, "row");

    expect(style.alignSelf).toBe("stretch");
    expect(style.height).toBe("auto");
  });
});

describe("boxStyle — Fixed / Hug", () => {
  it("Fixed는 공간이 모자라도 줄어들지 않는다", () => {
    const style = boxStyle({ width: 320, height: "auto" }, "row");

    expect(style.flexShrink).toBe(0);
    expect(style.flexBasis).toBe("320px");
    expect(style.width).toBe("320px");
  });

  it("Hug(auto)도 콘텐츠 크기를 유지한다", () => {
    const style = boxStyle({ width: "auto", height: "auto" }, "row");

    expect(style.flexGrow).toBe(0);
    expect(style.flexShrink).toBe(0);
    expect(style.width).toBe("auto");
  });
});

describe("boxStyle — 최상위 노드", () => {
  it("부모가 없으면 flex 아이템이 아니므로 퍼센트로 처리한다", () => {
    const style = boxStyle({ width: "fill", height: "fill" }, undefined);

    expect(style).toEqual({ width: "100%", height: "100%" });
  });
});

describe("boxStyle — grid 아이템", () => {
  it("최상위 노드와 동일하게 flex-grow/shrink 없이 width/height 그대로 쓴다", () => {
    // grid 컨테이너 쪽(displayStyle)의 최소 구현에 맞춘 대칭 — 정식 grid 배치는 후속 작업.
    const style = boxStyle({ width: "fill", height: 120 }, "grid");

    expect(style).toEqual({ width: "100%", height: "120px" });
  });
});

const RED = "#FF0000";
const SHADOW = { x: 0, y: 8, blur: 24, spread: -4, color: "#0F172A26" } as const;

describe("strokeAndShadowStyle", () => {
  it("둘 다 없으면 아무것도 내보내지 않는다", () => {
    expect(strokeAndShadowStyle(undefined, undefined)).toEqual({
      boxShadow: undefined,
      border: undefined,
      borderRadius: undefined,
    });
  });

  it("inside(기본값)는 CSS border 속성을 그대로 쓴다 — 기존 문서 렌더가 바뀌면 안 된다", () => {
    const style = strokeAndShadowStyle({ width: 2, color: RED, radius: 8 }, undefined);

    expect(style.border).toBe(`2px solid ${RED}`);
    expect(style.borderRadius).toBe(8);
    expect(style.boxShadow).toBeUndefined();
  });

  it("align을 inside로 명시해도 결과가 같다", () => {
    const withAlign = strokeAndShadowStyle(
      { width: 2, color: RED, radius: 8, align: "inside" },
      undefined,
    );
    const withoutAlign = strokeAndShadowStyle({ width: 2, color: RED, radius: 8 }, undefined);

    expect(withAlign).toEqual(withoutAlign);
  });

  it("outside는 box-shadow 고리로 그리고 CSS border를 쓰지 않는다", () => {
    const style = strokeAndShadowStyle(
      { width: 2, color: RED, radius: 8, align: "outside" },
      undefined,
    );

    expect(style.boxShadow).toBe(`0 0 0 2px ${RED}`);
    // border 속성을 같이 쓰면 박스가 2px 더 두꺼워져 고리와 겹친다.
    expect(style.border).toBeUndefined();
  });

  it("center는 절반씩 안팎으로 나눠 그린다", () => {
    const style = strokeAndShadowStyle(
      { width: 4, color: RED, radius: 0, align: "center" },
      undefined,
    );

    expect(style.boxShadow).toBe(`0 0 0 2px ${RED}, inset 0 0 0 2px ${RED}`);
  });

  it("두께 0이면 정렬과 무관하게 고리를 만들지 않는다", () => {
    const style = strokeAndShadowStyle(
      { width: 0, color: RED, radius: 12, align: "outside" },
      undefined,
    );

    expect(style.boxShadow).toBeUndefined();
    expect(style.borderRadius).toBe(12);
  });

  it("그림자만 있으면 그림자 하나만 내보낸다", () => {
    const style = strokeAndShadowStyle(undefined, SHADOW);

    expect(style.boxShadow).toBe("0px 8px 24px -4px #0F172A26");
  });

  it("테두리 고리와 그림자를 한 box-shadow로 합치고, 고리를 앞에 둔다", () => {
    // box-shadow는 먼저 적은 레이어가 위에 그려진다 — 테두리가 그림자에 묻히면 안 된다.
    const style = strokeAndShadowStyle(
      { width: 2, color: RED, radius: 8, align: "outside" },
      SHADOW,
    );

    expect(style.boxShadow).toBe(`0 0 0 2px ${RED}, 0px 8px 24px -4px #0F172A26`);
  });

  it("inside 테두리와 그림자는 서로 다른 칸을 쓴다", () => {
    const style = strokeAndShadowStyle({ width: 1, color: RED, radius: 4 }, SHADOW);

    expect(style.border).toBe(`1px solid ${RED}`);
    expect(style.boxShadow).toBe("0px 8px 24px -4px #0F172A26");
  });
});

describe("effectStyle", () => {
  it("값이 없으면 아무것도 내보내지 않는다", () => {
    expect(effectStyle(undefined, undefined)).toEqual({
      opacity: undefined,
      filter: undefined,
    });
  });

  it("opacity를 그대로 넘긴다", () => {
    expect(effectStyle(0.5, undefined).opacity).toBe(0.5);
  });

  it("blur를 filter로 옮긴다", () => {
    expect(effectStyle(undefined, 4).filter).toBe("blur(4px)");
  });

  it("blur 0은 filter를 붙이지 않는다 — 새 stacking context를 만들지 않기 위해서다", () => {
    expect(effectStyle(undefined, 0).filter).toBeUndefined();
  });
});
