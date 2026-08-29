import { describe, expect, it } from "vitest";

import { boxStyle } from "@/features/editor/ui/canvasLayout";

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
