import { describe, expect, it } from "vitest";

import { applyCommand } from "@/features/editor/command/applyCommand";
import type { FrameNode, Layout, Node, NodeId, ScreenSpec, TextNode } from "@/features/editor/schema";
import { resolveCanvasDrop } from "@/features/editor/ui/canvasDrop";
import type { CanvasDropTarget } from "@/features/editor/ui/canvasDrop";
import { resolveLayerDrop } from "@/features/editor/ui/layerDrop";
import type { Rect } from "@/features/editor/ui/selectionRect";

/** left·top·width·height 를 짧게 적는다. 좌표는 전부 화면 px. */
function box(left: number, top: number, width: number, height: number): Rect {
  return { left, top, width, height };
}

function frame(direction: Layout["direction"], children: NodeId[], columns?: number): FrameNode {
  return {
    type: "frame",
    name: "Frame",
    box: { width: "fill", height: "auto" },
    layout: {
      direction,
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: "start",
      crossAxis: "start",
      ...(columns === undefined ? {} : { columns }),
    },
    children: children.map((node) => ({ node })),
  };
}

function text(): TextNode {
  return {
    type: "text",
    name: "Text",
    box: { width: "auto", height: "auto" },
    content: "텍스트",
    color: "#000000",
    typography: {
      fontFamily: "Pretendard",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
      textAlign: "left",
    },
  };
}

interface Fixture {
  nodes: Record<NodeId, Node>;
  rects: Record<NodeId, Rect>;
}

/** 판정 결과를 실제 moveNode로 적용했을 때 그 부모의 자식 순서. */
function orderAfterMove(fixture: Fixture, dragId: NodeId, target: CanvasDropTarget): NodeId[] {
  const screen: ScreenSpec = {
    name: "test",
    size: { width: 1000, height: 1000 },
    root: "root",
    nodes: fixture.nodes,
  };
  const next = applyCommand(screen, {
    type: "moveNode",
    id: dragId,
    newParentId: target.newParentId,
    index: target.index,
  });
  return (next.nodes[target.newParentId] as FrameNode).children.map((child) => child.node);
}

function drop(fixture: Fixture, dragId: NodeId, x: number, y: number): CanvasDropTarget | null {
  return resolveCanvasDrop({ ...fixture, rootId: "root", dragId, point: { x, y } });
}

/**
 * root(column) > list(direction) > a, b, c
 *              > src(column)     > m       ← 다른 부모에서 끌어오는 노드
 *
 * list의 자식은 list 위아래 가장자리 띠(24px) 바깥에 둔다 — root가 column이라 list의
 * 위아래 띠에 걸리면 list 안이 아니라 root의 형제 자리로 판정된다.
 */
function lineFixture(direction: "row" | "column"): Fixture {
  const items =
    direction === "column"
      ? { a: box(0, 50, 200, 40), b: box(0, 110, 200, 40), c: box(0, 170, 200, 40) }
      : { a: box(50, 50, 100, 100), b: box(200, 50, 100, 100), c: box(350, 50, 100, 100) };
  return {
    nodes: {
      root: frame("column", ["list", "src"]),
      list: frame(direction, ["a", "b", "c"]),
      a: text(),
      b: text(),
      c: text(),
      src: frame("column", ["m"]),
      m: text(),
    },
    rects: {
      root: box(0, 0, 800, 800),
      list: direction === "column" ? box(0, 0, 200, 300) : box(0, 0, 600, 200),
      ...items,
      src: box(0, 320, 200, 100),
      m: box(0, 340, 100, 40),
    },
  };
}

describe("resolveCanvasDrop — column", () => {
  const fixture = lineFixture("column");

  it("첫 형제 중심보다 위면 맨 앞이고, 선은 그 형제 위 모서리에 긋는다", () => {
    expect(drop(fixture, "m", 100, 60)).toEqual({
      newParentId: "list",
      index: 0,
      indicator: box(0, 49, 200, 2),
      unchanged: false,
    });
  });

  it("두 형제 사이면 그 사이 자리이고, 선은 틈 한가운데다", () => {
    // a(50~90) 와 b(110~150) 사이 틈의 가운데는 100.
    expect(drop(fixture, "m", 100, 100)).toMatchObject({
      newParentId: "list",
      index: 1,
      indicator: box(0, 99, 200, 2),
    });
  });

  it("마지막 형제 중심보다 아래면 맨 끝이고, 선은 그 형제 아래 모서리다", () => {
    expect(drop(fixture, "m", 100, 260)).toMatchObject({
      newParentId: "list",
      index: 3,
      indicator: box(0, 209, 200, 2),
    });
  });
});

describe("resolveCanvasDrop — row", () => {
  const fixture = lineFixture("row");

  it("맨 앞 — 세로선을 첫 형제 왼쪽 모서리에 긋는다", () => {
    expect(drop(fixture, "m", 60, 100)).toMatchObject({
      newParentId: "list",
      index: 0,
      indicator: box(49, 50, 2, 100),
    });
  });

  it("가운데 — 두 형제 사이 틈의 한가운데", () => {
    // a 오른쪽 150, b 왼쪽 200 → 175.
    expect(drop(fixture, "m", 175, 100)).toMatchObject({
      newParentId: "list",
      index: 1,
      indicator: box(174, 50, 2, 100),
    });
  });

  it("맨 끝 — 마지막 형제 오른쪽 모서리", () => {
    expect(drop(fixture, "m", 550, 100)).toMatchObject({
      newParentId: "list",
      index: 3,
      indicator: box(449, 50, 2, 100),
    });
  });
});

describe("resolveCanvasDrop — grid", () => {
  // 2열 그리드. 순서(읽기 순서)는 g1 g2 / g3 g4.
  function gridFixture(columns?: number): Fixture {
    return {
      nodes: {
        root: frame("column", ["grid", "src"]),
        grid: frame("grid", ["g1", "g2", "g3", "g4"], columns),
        g1: text(),
        g2: text(),
        g3: text(),
        g4: text(),
        src: frame("column", ["m"]),
        m: text(),
      },
      rects: {
        root: box(0, 0, 800, 800),
        grid: box(0, 0, 400, 300),
        g1: box(20, 20, 160, 100),
        g2: box(220, 20, 160, 100),
        g3: box(20, 140, 160, 100),
        g4: box(220, 140, 160, 100),
        src: box(0, 320, 200, 100),
        m: box(0, 340, 100, 40),
      },
    };
  }
  const fixture = gridFixture(2);

  it("맨 앞 — 첫 줄 첫 칸 앞", () => {
    expect(drop(fixture, "m", 25, 50)).toMatchObject({
      newParentId: "grid",
      index: 0,
      indicator: box(19, 20, 2, 100),
    });
  });

  it("가운데 — 커서가 속한 줄 안에서 x로 자리를 고른다", () => {
    // 둘째 줄의 g3·g4 사이 → g3 다음(index 3).
    expect(drop(fixture, "m", 200, 190)).toMatchObject({
      newParentId: "grid",
      index: 3,
      indicator: box(199, 140, 2, 100),
    });
  });

  it("줄 끝을 넘으면 그 줄 마지막 칸 다음이다 — 다음 줄 첫 칸 앞과 같은 index", () => {
    expect(drop(fixture, "m", 390, 70)).toMatchObject({
      newParentId: "grid",
      index: 2,
      indicator: box(379, 20, 2, 100),
    });
  });

  it("맨 끝 — 마지막 줄 마지막 칸 다음", () => {
    expect(drop(fixture, "m", 390, 200)).toMatchObject({
      newParentId: "grid",
      index: 4,
      indicator: box(379, 140, 2, 100),
    });
  });

  it("줄 사이 틈이면 세로로 가장 가까운 줄을 쓴다", () => {
    // y=135 는 첫 줄 바닥(120)에서 15, 둘째 줄 천장(140)에서 5 → 둘째 줄의 g3 앞.
    expect(drop(fixture, "m", 50, 135)).toMatchObject({ newParentId: "grid", index: 2 });
  });

  it("columns 가 1(또는 생략)이면 세로 배치처럼 y로 고른다", () => {
    // 1열이면 줄마다 하나라 x로 가르면 좌우 위치로 앞뒤가 갈린다. 1열 배치를 흉내 낸다.
    const single = gridFixture(undefined);
    single.rects = {
      ...single.rects,
      g1: box(20, 30, 160, 50),
      g2: box(20, 90, 160, 50),
      g3: box(20, 150, 160, 50),
      g4: box(20, 210, 160, 50),
    };
    // g1 중심(y 55)보다 위지만 x는 g1 중심(100)보다 오른쪽 — 줄 안에서 x로 갈랐다면
    // g1 다음(index 1)이 됐을 것이다.
    expect(drop(single, "m", 170, 40)).toMatchObject({
      newParentId: "grid",
      index: 0,
      indicator: box(20, 29, 160, 2),
    });
  });
});

describe("resolveCanvasDrop — 같은 부모 안 이동은 moveNode 적용 후 기대 순서가 된다", () => {
  const fixture = lineFixture("column");

  it("앞 → 뒤: a 를 맨 끝으로", () => {
    const target = drop(fixture, "a", 100, 260);
    expect(target).toMatchObject({ newParentId: "list", index: 2, unchanged: false });
    expect(orderAfterMove(fixture, "a", target!)).toEqual(["b", "c", "a"]);
  });

  it("앞 → 뒤: a 를 b·c 사이로", () => {
    // b 중심 130, c 중심 190 사이.
    const target = drop(fixture, "a", 100, 160);
    expect(target).toMatchObject({ newParentId: "list", index: 1 });
    expect(orderAfterMove(fixture, "a", target!)).toEqual(["b", "a", "c"]);
  });

  it("뒤 → 앞: c 를 맨 앞으로", () => {
    const target = drop(fixture, "c", 100, 60);
    expect(target).toMatchObject({ newParentId: "list", index: 0 });
    expect(orderAfterMove(fixture, "c", target!)).toEqual(["c", "a", "b"]);
  });

  it("뒤 → 앞: c 를 a·b 사이로", () => {
    const target = drop(fixture, "c", 100, 100);
    expect(target).toMatchObject({ newParentId: "list", index: 1 });
    expect(orderAfterMove(fixture, "c", target!)).toEqual(["a", "c", "b"]);
  });

  it("드래그 노드를 뺀 목록 기준 index 는 layerDrop 의 한 칸 보정과 같은 값이다", () => {
    // "c 앞에 놓기" = 레이어 트리에서 c 행에 놓기. 두 판정기가 같은 index 를 내야
    // 같은 moveNode 가 나간다(앞→뒤는 보정이 걸리는 쪽).
    const forward = resolveLayerDrop({
      nodes: fixture.nodes,
      dragId: "a",
      dragParentId: "list",
      targetId: "c",
      targetParentId: "list",
    });
    expect(drop(fixture, "a", 100, 160)).toMatchObject(forward!);

    // 뒤→앞은 보정이 없는 쪽. "a 앞에 놓기" = a 행에 놓기.
    const backward = resolveLayerDrop({
      nodes: fixture.nodes,
      dragId: "c",
      dragParentId: "list",
      targetId: "a",
      targetParentId: "list",
    });
    expect(drop(fixture, "c", 100, 60)).toMatchObject(backward!);
  });
});

/**
 * 카드처럼 자식 frame이 부모를 거의 다 덮는 배치.
 * root(column) > content(row) > cardA(column) > la
 *                             > cardB(column) > lb
 */
const CARDS: Fixture = {
  nodes: {
    root: frame("column", ["content"]),
    content: frame("row", ["cardA", "cardB"]),
    cardA: frame("column", ["la"]),
    la: text(),
    cardB: frame("column", ["lb"]),
    lb: text(),
  },
  rects: {
    root: box(0, 0, 800, 800),
    content: box(0, 0, 800, 300),
    cardA: box(20, 20, 300, 260),
    la: box(40, 40, 100, 30),
    cardB: box(340, 20, 300, 260),
    lb: box(360, 40, 100, 30),
  },
};

describe("resolveCanvasDrop — 자식 frame 과 가장자리 띠", () => {
  it("자식 frame 가운데면 그 안으로 들어간다", () => {
    expect(drop(CARDS, "cardB", 170, 150)).toMatchObject({
      newParentId: "cardA",
      index: 1, // la(중심 y 55) 다음
      unchanged: false,
    });
  });

  it("자식 frame 의 부모 주축 앞쪽 띠면 그 frame 앞 형제 자리다 — 카드 B 를 카드 A 앞으로", () => {
    const target = drop(CARDS, "cardB", 30, 150);
    expect(target).toEqual({
      newParentId: "content",
      index: 0,
      indicator: box(19, 20, 2, 260),
      unchanged: false,
    });
    expect(orderAfterMove(CARDS, "cardB", target!)).toEqual(["cardB", "cardA"]);
  });

  it("뒤쪽 띠면 그 frame 뒤 자리다 — 카드 A 를 카드 B 뒤로", () => {
    // cardB 오른쪽 띠: 616~640.
    const target = drop(CARDS, "cardA", 630, 150);
    expect(target).toMatchObject({ newParentId: "content", index: 1, unchanged: false });
    expect(orderAfterMove(CARDS, "cardA", target!)).toEqual(["cardB", "cardA"]);
  });

  it("띠 두께는 24px 에서 멈춘다 — 큰 frame 은 25% 가 아니라 24px 만 띠다", () => {
    // cardA 폭 300 의 25% 는 75. 상한이 없으면 x=60 은 띠라 content 로 갔을 것이다.
    expect(drop(CARDS, "cardB", 60, 150)).toMatchObject({ newParentId: "cardA" });
  });

  it("띠는 부모 주축 방향만 본다 — row 부모면 위아래 끝은 띠가 아니다", () => {
    // cardA 위쪽 가장자리 근처지만 content 가 row 라 세로 끝은 띠가 아니다.
    // (root 는 column 이라 content 의 위아래 띠는 content 기준 0~24 / 276~300 이다.)
    expect(drop(CARDS, "cardB", 170, 30)).toMatchObject({ newParentId: "cardA", index: 0 });
  });
});

describe("resolveCanvasDrop — 빈 frame", () => {
  const fixture: Fixture = {
    nodes: {
      root: frame("column", ["empty", "src"]),
      empty: frame("row", []),
      src: frame("column", ["m"]),
      m: text(),
    },
    rects: {
      root: box(0, 0, 800, 800),
      empty: box(0, 0, 300, 100),
      src: box(0, 120, 200, 100),
      m: box(0, 140, 100, 40),
    },
  };

  it("빈 frame 안으로 넣고, 그 frame 사각형 전체를 강조한다", () => {
    expect(drop(fixture, "m", 150, 50)).toEqual({
      newParentId: "empty",
      index: 0,
      indicator: box(0, 0, 300, 100),
      unchanged: false,
    });
  });
});

describe("resolveCanvasDrop — 자기 자신·자손", () => {
  it("자기 자손 위에 놓아도 자기 서브트리 안으로는 들어가지 않는다", () => {
    // la 는 cardA 의 자식. cardA 를 끌어 la 위에 놓으면 cardA 를 건너뛰고 content 가 컨테이너다.
    const target = drop(CARDS, "cardA", 90, 55);
    expect(target).toMatchObject({ newParentId: "content", index: 0, unchanged: true });
  });

  it("자기 자신 위면 지금 자리 그대로다(unchanged)", () => {
    const fixture = lineFixture("column");
    expect(drop(fixture, "b", 100, 130)).toMatchObject({
      newParentId: "list",
      index: 1,
      unchanged: true,
    });
  });

  it("자손을 품은 frame 을 끌면 그 서브트리 전체가 후보에서 빠진다", () => {
    // content 를 끌어 cardA 가운데에 놓으면 root 가 컨테이너다.
    expect(drop(CARDS, "content", 170, 150)).toMatchObject({ newParentId: "root", index: 0 });
  });
});

describe("resolveCanvasDrop — null", () => {
  const fixture = lineFixture("column");

  it("root 를 끌면 null", () => {
    expect(drop(fixture, "root", 100, 100)).toBeNull();
  });

  it("point 가 root 사각형 밖이면 null", () => {
    expect(drop(fixture, "m", 900, 100)).toBeNull();
    expect(drop(fixture, "m", 100, -1)).toBeNull();
  });

  it("root 사각형이 없으면 null", () => {
    const rects = { ...fixture.rects };
    delete rects.root;
    expect(drop({ nodes: fixture.nodes, rects }, "m", 1, 1)).toBeNull();
  });

  it("없는 노드를 끌면 null", () => {
    expect(drop(fixture, "ghost", 100, 100)).toBeNull();
  });
});

describe("resolveCanvasDrop — unchanged", () => {
  const fixture = lineFixture("column");

  it("지금 자리 바로 앞/뒤 틈에 놓으면 unchanged", () => {
    // b 는 index 1. a·b 사이(100)도, b·c 사이(160)도 b 를 뺀 목록에서는 index 1 이다.
    expect(drop(fixture, "b", 100, 100)).toMatchObject({ index: 1, unchanged: true });
    expect(drop(fixture, "b", 100, 160)).toMatchObject({ index: 1, unchanged: true });
  });

  it("다른 부모로 가면 index 가 같아도 unchanged 가 아니다", () => {
    // m 은 src 의 index 0. list 의 index 0 으로 가는 것은 이동이다.
    expect(drop(fixture, "m", 100, 60)).toMatchObject({ index: 0, unchanged: false });
  });
});

describe("resolveCanvasDrop — 사각형이 없는 형제(숨김 등)", () => {
  // list.children = [h1, a, h2, b] — h1·h2 는 렌더되지 않아 사각형이 없다.
  const fixture: Fixture = {
    nodes: {
      root: frame("column", ["list", "src"]),
      list: frame("column", ["h1", "a", "h2", "b"]),
      h1: text(),
      a: text(),
      h2: text(),
      b: text(),
      src: frame("column", ["m"]),
      m: text(),
    },
    rects: {
      root: box(0, 0, 800, 800),
      list: box(0, 0, 200, 300),
      a: box(0, 50, 200, 40),
      b: box(0, 110, 200, 40),
      src: box(0, 320, 200, 100),
      m: box(0, 340, 100, 40),
    },
  };

  it("비교에서는 빠지지만 순서 계산에는 남는다 — 맨 앞은 보이는 첫 형제 자리", () => {
    expect(drop(fixture, "m", 100, 60)).toMatchObject({ newParentId: "list", index: 1 });
  });

  it("사이에 끼어 있으면 보이는 앞 형제 바로 다음이다", () => {
    // a 와 b 사이 → a(1) 다음인 2. h2 는 새 노드 뒤로 밀린다.
    const target = drop(fixture, "m", 100, 100);
    expect(target).toMatchObject({ newParentId: "list", index: 2 });
    expect(orderAfterMove(fixture, "m", target!)).toEqual(["h1", "a", "m", "h2", "b"]);
  });

  it("맨 끝 — 보이는 마지막 형제 다음", () => {
    expect(drop(fixture, "m", 100, 200)).toMatchObject({ newParentId: "list", index: 4 });
  });

  it("보이는 형제가 하나도 없으면 끝에 붙이고 frame 을 강조한다", () => {
    const hidden: Fixture = {
      nodes: fixture.nodes,
      rects: {
        root: fixture.rects.root,
        list: fixture.rects.list,
        src: fixture.rects.src,
        m: fixture.rects.m,
      },
    };
    expect(drop(hidden, "m", 100, 100)).toMatchObject({
      newParentId: "list",
      index: 4,
      indicator: box(0, 0, 200, 300),
    });
  });
});
