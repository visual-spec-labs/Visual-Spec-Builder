import { describe, expect, it } from "vitest";

import type { FrameNode } from "@/features/editor/schema";
import {
  DEFAULT_GRID_COLUMNS,
  gridColumnsValue,
  layoutWithDirection,
  showsCrossAxis,
  showsMainAxis,
} from "@/features/editor/ui/properties/layoutPatch";

type Layout = FrameNode["layout"];

/** 기본 세로 레이아웃. 케이스마다 필요한 칸만 덮어쓴다. */
function layout(patch: Partial<Layout> = {}): Layout {
  return {
    direction: "column",
    gap: 16,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    mainAxis: "start",
    crossAxis: "stretch",
    ...patch,
  };
}

describe("layoutWithDirection — 방향 바꾸기", () => {
  it("격자로 바꾸면 열 개수를 함께 채운다", () => {
    // 한 동작이니 한 번에 쓴다 — 따로 쓰면 Undo가 두 단계로 쌓인다.
    const next = layoutWithDirection(layout(), "grid");

    expect(next.direction).toBe("grid");
    expect(next.columns).toBe(DEFAULT_GRID_COLUMNS);
  });

  it("기본 열 개수는 1이 아니다 — 1열 격자는 세로와 결과가 같아 안 바뀐 것처럼 보인다", () => {
    expect(DEFAULT_GRID_COLUMNS).toBeGreaterThan(1);
  });

  it("이미 열 개수가 있으면 그대로 둔다", () => {
    const next = layoutWithDirection(layout({ direction: "row", columns: 4 }), "grid");

    expect(next.columns).toBe(4);
  });

  it("격자를 벗어나면 열 개수를 지운다 — row/column 에서는 뜻이 없는 값이다", () => {
    // 남겨 두면 export 된 JSON 을 읽는 쪽이 의미 있는 지정으로 오해한다.
    const next = layoutWithDirection(layout({ direction: "grid", columns: 3 }), "row");

    expect(next.direction).toBe("row");
    expect(next.columns).toBeUndefined();
    expect("columns" in next).toBe(false);
  });

  it("나머지 필드는 건드리지 않는다", () => {
    const before = layout({ gap: 24, mainAxis: "center", crossAxis: "end" });
    const next = layoutWithDirection(before, "grid");

    expect(next.gap).toBe(24);
    expect(next.mainAxis).toBe("center");
    expect(next.crossAxis).toBe("end");
    expect(next.padding).toEqual(before.padding);
  });

  it("원본을 바꾸지 않는다", () => {
    const before = layout();
    layoutWithDirection(before, "grid");

    expect(before.direction).toBe("column");
    expect(before.columns).toBeUndefined();
  });
});

describe("gridColumnsValue — 칸에 보여 줄 값", () => {
  it("값이 있으면 그대로다", () => {
    expect(gridColumnsValue(layout({ direction: "grid", columns: 3 }))).toBe(3);
  });

  it("값이 없으면 1이다 — 스키마가 정한 기본이고 실제로 1열로 그려진다", () => {
    expect(gridColumnsValue(layout({ direction: "grid" }))).toBe(1);
  });
});

describe("showsMainAxis — 주축 정렬 칸을 띄울지", () => {
  it("그리드에서는 감춘다 — 트랙이 1fr 이라 justify-content 가 밀 여백이 없다", () => {
    // 아무 일도 하지 않는 컨트롤을 띄우면 사용자가 눌러 보고 고장으로 판단한다.
    expect(showsMainAxis("grid")).toBe(false);
  });

  it("가로·세로에서는 띄운다", () => {
    expect(showsMainAxis("row")).toBe(true);
    expect(showsMainAxis("column")).toBe(true);
  });
});

describe("showsCrossAxis — 교차축 정렬 칸을 띄울지", () => {
  it("그리드에서도 띄운다 — align-items 는 grid 에서도 동작한다", () => {
    // 한때 주축과 함께 감췄는데 틀렸다. frameStyle 이 display:grid 뒤에
    // alignItems 를 조건 없이 얹으므로 화면이 실제로 달라진다. 감춰 두면
    // crossAxis: "start" 인 프레임을 그리드로 바꿨을 때 자식이 늘어나지 않는데
    // 되돌릴 컨트롤이 없다.
    expect(showsCrossAxis()).toBe(true);
  });

  it("어느 방향에서도 감추지 않는다", () => {
    expect(showsCrossAxis()).toBe(true);
  });
});
