import { describe, expect, it } from "vitest";

import type { Node } from "@/features/editor/schema";
import {
  buildParentMap,
  resolveClickTarget,
  resolveInsertParent,
} from "@/features/editor/ui/selection";

function frame(name: string, children: string[]): Node {
  return {
    type: "frame",
    name,
    box: { width: "fill", height: "auto" },
    layout: {
      direction: "column",
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: "start",
      crossAxis: "start",
    },
    children: children.map((node) => ({ node })),
  };
}

function text(name: string): Node {
  return {
    type: "text",
    name,
    box: { width: "auto", height: "auto" },
    content: name,
    color: "#111111",
    typography: {
      fontFamily: "Pretendard",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 24,
      letterSpacing: 0,
      textAlign: "left",
    },
  };
}

/** root > content > cardA > cardALabel — 3단계 중첩. */
const nodes: Record<string, Node> = {
  root: frame("Root", ["header", "content"]),
  header: frame("Header", ["headerTitle"]),
  headerTitle: text("Title"),
  content: frame("Content", ["cardA"]),
  cardA: frame("Card", ["cardALabel"]),
  cardALabel: text("Label"),
};

const root = "root";

describe("buildParentMap", () => {
  it("자식에서 부모를 거슬러 올라갈 수 있게 역맵을 만든다", () => {
    const parents = buildParentMap(nodes);

    expect(parents.get("cardALabel")).toBe("cardA");
    expect(parents.get("cardA")).toBe("content");
    expect(parents.get("content")).toBe("root");
    expect(parents.get("root")).toBeUndefined();
  });
});

describe("resolveClickTarget — 일반 클릭(최상위)", () => {
  it("3단계 안쪽을 클릭해도 root 바로 아래 조상을 선택한다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardALabel", deep: false }),
    ).toBe("content");
  });

  it("이미 최상위인 노드를 클릭하면 그대로 둔다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "header", deep: false }),
    ).toBe("header");
  });

  it("root 자신을 클릭하면 root를 선택한다", () => {
    expect(resolveClickTarget({ nodes, root, clickedId: root, deep: false })).toBe(
      root,
    );
  });
});

describe("resolveClickTarget — Cmd/Ctrl+클릭(상세 지정)", () => {
  it("실제로 클릭한 최하위 노드를 그대로 선택한다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardALabel", deep: true }),
    ).toBe("cardALabel");
  });

  it("중간 깊이의 노드도 클릭한 그대로 잡힌다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardA", deep: true }),
    ).toBe("cardA");
  });
});

describe("resolveClickTarget — 망가진 스펙 방어", () => {
  it("존재하지 않는 id면 root로 떨어진다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "없는노드", deep: false }),
    ).toBe(root);
  });

  it("부모가 없는 고아 노드는 자기 자신이 최상위다", () => {
    const orphaned = { ...nodes, floating: text("Floating") };

    expect(
      resolveClickTarget({
        nodes: orphaned,
        root,
        clickedId: "floating",
        deep: false,
      }),
    ).toBe("floating");
  });

  it("부모-자식이 순환해도 멈춘다", () => {
    // a > b > a. 검증기가 cycle로 잡는 스펙이지만 UI가 멈춰서는 안 된다.
    const cyclic: Record<string, Node> = {
      root: frame("Root", ["a"]),
      a: frame("A", ["b"]),
      b: frame("B", ["a"]),
    };

    expect(
      resolveClickTarget({ nodes: cyclic, root, clickedId: "b", deep: false }),
    ).toBe("a");
  });
});

describe("resolveInsertParent", () => {
  it("프레임을 클릭하면 그 프레임 안에 넣는다", () => {
    expect(resolveInsertParent({ nodes, root, clickedId: "cardA" })).toBe("cardA");
  });

  it("텍스트를 클릭하면 가장 가까운 조상 프레임에 넣는다", () => {
    // 텍스트 노드는 children이 없어 부모가 될 수 없다.
    expect(resolveInsertParent({ nodes, root, clickedId: "cardALabel" })).toBe(
      "cardA",
    );
  });

  it("대상을 찾을 수 없으면 root에 넣는다", () => {
    expect(resolveInsertParent({ nodes, root, clickedId: "없는노드" })).toBe(root);
  });
});
