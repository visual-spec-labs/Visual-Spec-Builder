import { describe, expect, it } from "vitest";

import type { FrameNode } from "@/features/editor/schema";
import {
  canEqualizeChildren,
  DEFAULT_GRID_COLUMNS,
  equalizeChildrenPatches,
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

describe("canEqualizeChildren — 자식 크기 균등 버튼을 켤지(#150)", () => {
  it("부모 주축이 fill이고 자식이 둘 이상이면 켠다", () => {
    expect(canEqualizeChildren("column", "fill", 2)).toBe(true);
    expect(canEqualizeChildren("row", 480, 3)).toBe(true);
  });

  it("부모 주축이 Hug(auto)면 끈다 — 채울 공간이 없어 자식이 0으로 무너진다", () => {
    // 시드 문서의 Card(direction: column, height: auto)에 그대로 적용하면
    // Label/Value 높이가 실제로 0이 된다 — 재현 확인 완료.
    expect(canEqualizeChildren("column", "auto", 2)).toBe(false);
  });

  it("그리드면 끈다 — 트랙이 이미 1fr이라 맞출 대상이 없다", () => {
    expect(canEqualizeChildren("grid", "fill", 2)).toBe(false);
  });

  it("자식이 하나뿐이거나 없으면 끈다", () => {
    expect(canEqualizeChildren("row", "fill", 1)).toBe(false);
    expect(canEqualizeChildren("row", "fill", 0)).toBe(false);
  });
});

describe("equalizeChildrenPatches — 자식 크기 균등 patch(#150)", () => {
  it("세로(column)에서는 자식의 높이를 fill로 맞춘다", () => {
    const patches = equalizeChildrenPatches("column", "fill", "cardA", [
      "cardALabel",
      "cardAValue",
    ]);

    expect(patches).toEqual([
      { id: "cardALabel", path: "box.height", value: "fill" },
      { id: "cardAValue", path: "box.height", value: "fill" },
      { id: "cardA", path: "layout.crossAxis", value: "stretch" },
    ]);
  });

  it("가로(row)에서는 자식의 너비를 fill로 맞춘다", () => {
    const patches = equalizeChildrenPatches("row", "fill", "cardA", [
      "cardALabel",
      "cardAValue",
    ]);

    expect(patches).toEqual([
      { id: "cardALabel", path: "box.width", value: "fill" },
      { id: "cardAValue", path: "box.width", value: "fill" },
      { id: "cardA", path: "layout.crossAxis", value: "stretch" },
    ]);
  });

  it("그리드에서는 빈 배열이다 — 트랙이 이미 1fr이라 맞출 대상이 없다", () => {
    // 호출부가 grid에서 버튼을 숨기더라도, 실수로 호출돼도 no-op이어야 한다.
    expect(
      equalizeChildrenPatches("grid", "fill", "cardA", ["cardALabel", "cardAValue"]),
    ).toEqual([]);
  });

  it("부모 주축이 Hug(auto)면 빈 배열이다 — 호출부 가드를 우회해도 안전해야 한다", () => {
    expect(
      equalizeChildrenPatches("column", "auto", "cardA", ["cardALabel", "cardAValue"]),
    ).toEqual([]);
  });

  it("자식이 없어도 부모 주축이 fill이면 부모의 crossAxis는 stretch로 맞춘다", () => {
    expect(equalizeChildrenPatches("column", "fill", "cardA", [])).toEqual([
      { id: "cardA", path: "layout.crossAxis", value: "stretch" },
    ]);
  });
});
