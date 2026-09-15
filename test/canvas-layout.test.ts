import { describe, expect, it } from "vitest";

import {
  artboardBoxSize,
  boxStyle,
  effectStyle,
  radiusCss,
  resizedValue,
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

describe("boxStyle — 최상위 노드(아트보드의 root)", () => {
  const FILL = { width: "fill", height: "fill" } as const;

  it("항상 아트보드를 채운다 — 가로 100% + flex: 1 0 auto", () => {
    expect(boxStyle(FILL, undefined)).toEqual({
      width: "100%",
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: "auto",
    });
  });

  it("root의 box를 보지 않는다 — 어떤 값이 와도 결과가 같다", () => {
    // 페이지 크기를 정하는 것은 page.size 하나다. root가 box를 따로 갖고 둘이
    // 어긋나면 아트보드 경계와 root 네모가 따로 놀아 격자 위에 네모가 둘 보인다.
    // 캔버스에서 root를 리사이즈하면(PR #99) box.width가 Fixed로 바뀌어 실제로
    // 그 상태가 만들어졌다 — 여기서 box를 무시해 애초에 생기지 않게 한다.
    const expected = boxStyle(FILL, undefined);

    expect(boxStyle({ width: 984, height: 900 }, undefined)).toEqual(expected);
    expect(boxStyle({ width: "auto", height: "auto" }, undefined)).toEqual(expected);
    expect(boxStyle({ width: 320, height: "fill" }, undefined)).toEqual(expected);
  });

  it("grow는 1이라 내용이 첫 화면보다 짧아도 남은 높이를 채운다", () => {
    expect(boxStyle(FILL, undefined).flexGrow).toBe(1);
  });

  it("shrink는 0이라 내용이 첫 화면보다 길면 줄지 않고 아트보드를 밀어낸다", () => {
    // shrink가 1이면 min-height 안으로 다시 쭈그러들어 문서가 못 자란다.
    expect(boxStyle(FILL, undefined).flexShrink).toBe(0);
  });

  it("세로를 퍼센트로 두지 않는다 — 부모가 auto 높이면 CSS 규격상 무효다", () => {
    expect(boxStyle(FILL, undefined).height).toBeUndefined();
  });
});

describe("boxStyle — grid 아이템", () => {
  it("flex-grow/shrink 없이 width/height 그대로 쓴다", () => {
    // grid 컨테이너 쪽(displayStyle)의 최소 구현에 맞춘 대칭 — 정식 grid 배치는 후속 작업.
    const style = boxStyle({ width: "fill", height: 120 }, "grid");

    expect(style).toEqual({ width: "100%", height: "120px" });
  });

  it("세로 Fill은 최상위와 달리 퍼센트 그대로다 — grid 아이템은 flex 아이템이 아니다", () => {
    // #86으로 최상위 분기만 flex로 갈렸다. 둘을 한 분기로 묶어 두면 grid까지
    // 끌려가므로 여기서 갈라진 것을 고정한다.
    expect(boxStyle({ width: "fill", height: "fill" }, "grid")).toEqual({
      width: "100%",
      height: "100%",
    });
  });
});

describe("artboardBoxSize — 스크롤 범위", () => {
  const SIZE = { width: 1440, height: 900 };

  it("실측 전에는 스펙 크기로 시작한다 — 첫 페인트에서 박스가 튀지 않게", () => {
    expect(artboardBoxSize(SIZE, null, 1)).toEqual({ width: 1440, height: 900 });
  });

  it("아트보드가 자라면 그 높이를 따라간다 — 아래쪽 내용까지 스크롤된다", () => {
    expect(artboardBoxSize(SIZE, 3200, 1)).toEqual({ width: 1440, height: 3200 });
  });

  it("확대율을 곱한다 — transform: scale은 레이아웃 박스를 안 바꾼다", () => {
    expect(artboardBoxSize(SIZE, 3200, 0.5)).toEqual({ width: 720, height: 1600 });
  });

  it("실측값이 스펙 높이보다 작아도 스펙 높이 밑으로는 안 내려간다", () => {
    // 아트보드에 min-height가 걸려 있어 실제로는 생기지 않지만, 측정이 한 박자
    // 늦어 옛 값이 남아 있는 순간에 스크롤 범위가 줄어들면 안 된다.
    expect(artboardBoxSize(SIZE, 400, 1).height).toBe(900);
  });

  it("가로는 실측하지 않는다 — 자식이 넘쳐도 Figma처럼 밖으로 삐져나간다", () => {
    expect(artboardBoxSize(SIZE, 5000, 2).width).toBe(2880);
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

describe("radiusCss", () => {
  it("값이 없으면 아무것도 내보내지 않는다", () => {
    expect(radiusCss(undefined)).toBeUndefined();
  });

  it("숫자 하나는 그대로 넘긴다 — React가 px를 붙인다", () => {
    expect(radiusCss(12)).toBe(12);
    expect(radiusCss(0)).toBe(0);
  });

  it("모서리별은 CSS 순서(좌상 → 우상 → 우하 → 좌하)로 적는다", () => {
    const css = radiusCss({ topLeft: 12, topRight: 8, bottomRight: 4, bottomLeft: 0 });

    expect(css).toBe("12px 8px 4px 0px");
  });

  it("네 값이 같으면 숫자 하나와 같은 모양을 그린다", () => {
    expect(radiusCss({ topLeft: 6, topRight: 6, bottomRight: 6, bottomLeft: 6 })).toBe(
      "6px 6px 6px 6px",
    );
  });
});

describe("resizedValue", () => {
  it("100% 줌에서는 화면 이동량이 그대로 더해진다", () => {
    expect(resizedValue(200, 50, 1)).toBe(250);
    expect(resizedValue(200, -50, 1)).toBe(150);
  });

  it("줌 배율만큼 나눠서 스펙 px로 바꾼다", () => {
    // 50% 줌에서 화면 100px 이동은 스펙 200px 이동과 같다 — 확대된 만큼
    // 화면에서는 적게 움직여도 스펙 값은 크게 바뀐다.
    expect(resizedValue(200, 100, 0.5)).toBe(400);
    // 200% 줌에서는 반대로 화면 100px 이동이 스펙 50px 이동일 뿐이다.
    expect(resizedValue(200, 100, 2)).toBe(250);
  });

  it("결과가 정수가 아니면 반올림한다", () => {
    expect(resizedValue(100, 10, 3)).toBe(Math.round(100 + 10 / 3));
  });

  it("0 이하로 줄어들지 않는다 — 최소 1px", () => {
    expect(resizedValue(10, -100, 1)).toBe(1);
    expect(resizedValue(0, 0, 1)).toBe(1);
  });
});
