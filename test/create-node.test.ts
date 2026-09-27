import { describe, expect, it } from "vitest";

import { migrateV01, validateProjectSpec } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { createNode, type NodeKind } from "@/features/editor/store/createNode";
import { generateNodeId } from "@/features/editor/store/nodeId";

const ALL_KINDS: readonly NodeKind[] = ["frame", "text", "image", "button", "input"];

describe("createNode", () => {
  it("프레임은 자식이 없는 빈 프레임이다", () => {
    const node = createNode("frame");

    expect(node.type).toBe("frame");
    if (node.type !== "frame") throw new Error("frame이어야 한다");
    expect(node.children).toEqual([]);
    // auto로 두면 캔버스에서 만든 빈 프레임이 0×0이 되어 보이지 않는다.
    expect(node.box).toEqual({ width: 200, height: 120 });
  });

  it("텍스트는 내용을 가진 채로 만들어진다", () => {
    const node = createNode("text");

    expect(node.type).toBe("text");
    if (node.type !== "text") throw new Error("text여야 한다");
    expect(node.content.length).toBeGreaterThan(0);
  });

  it.each(ALL_KINDS)("%s: 인자 없이 만들어도 완전한 노드다", (kind) => {
    const node = createNode(kind);
    expect(node.type).toBe(kind);
  });

  it("호출할 때마다 새 객체를 만든다", () => {
    // 같은 객체를 공유하면 한쪽을 편집할 때 다른 노드까지 바뀐다.
    expect(createNode("frame")).not.toBe(createNode("frame"));
  });

  it.each(ALL_KINDS)("%s: 인자 없이 만든 노드끼리도 참조를 공유하지 않는다", (kind) => {
    const a = createNode(kind);
    const b = createNode(kind);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("만들어진 노드를 붙인 스펙이 검증을 통과한다", () => {
    let spec = migrateV01(blankSpec);

    for (const kind of ["frame", "text"] as const) {
      const pageId = spec.pageOrder[0];
      const page = spec.pages[pageId];
      const parent = page.nodes[page.root];
      if (parent.type !== "frame") throw new Error("root는 프레임이어야 한다");

      const id = generateNodeId(kind, page.nodes);
      spec = {
        ...spec,
        pages: {
          ...spec.pages,
          [pageId]: {
            ...page,
            nodes: {
              ...page.nodes,
              [id]: createNode(kind),
              [page.root]: {
                ...parent,
                children: [...parent.children, { node: id }],
              },
            },
          },
        },
      };
    }

    expect(validateProjectSpec(spec).issues).toEqual([]);
  });

  describe("부분 덮어쓰기", () => {
    it("일부 필드만 주면 나머지는 기본값으로 채운다 (button)", () => {
      const node = createNode("button", { content: "제출" });

      expect(node.content).toBe("제출");
      if (node.type !== "button") throw new Error("button이어야 한다");
      // content 말고는 기본값 그대로다.
      expect(node.name).toBe("Button");
      expect(node.typography.fontFamily).toBe("Pretendard");
    });

    it("중첩 객체는 칸 단위로 병합된다 (typography 일부만 덮어써도 나머지는 기본값)", () => {
      const node = createNode("text", { typography: { fontSize: 24 } });

      if (node.type !== "text") throw new Error("text여야 한다");
      expect(node.typography.fontSize).toBe(24);
      // 나머지 typography 필드는 기본값을 그대로 유지한다.
      expect(node.typography.fontFamily).toBe("Pretendard");
      expect(node.typography.fontWeight).toBe(400);
      expect(node.typography.lineHeight).toBe(24);
    });

    it("layout처럼 더 깊은 중첩(padding)도 칸 단위로 병합된다", () => {
      const node = createNode("frame", { layout: { gap: 24, padding: { top: 0 } } });

      if (node.type !== "frame") throw new Error("frame이어야 한다");
      expect(node.layout.gap).toBe(24);
      expect(node.layout.padding).toEqual({ top: 0, right: 16, bottom: 16, left: 16 });
      // padding 말고 다른 layout 필드는 그대로다.
      expect(node.layout.direction).toBe("column");
      expect(node.layout.mainAxis).toBe("start");
    });

    it("box.width 같은 union 대표값은 병합하지 않고 통째로 교체한다", () => {
      const node = createNode("frame", { box: { width: "fill" } });

      if (node.type !== "frame") throw new Error("frame이어야 한다");
      expect(node.box).toEqual({ width: "fill", height: 120 });
    });

    it("원본 기본값 객체를 변형하지 않는다", () => {
      const before = createNode("frame");
      createNode("frame", { layout: { gap: 999 } });
      const after = createNode("frame");

      expect(before).toEqual(after);
    });

    it.each(ALL_KINDS)("%s: 부분 값만 줘도 validateProjectSpec을 통과한다", (kind) => {
      let spec = migrateV01(blankSpec);
      const pageId = spec.pageOrder[0];
      const page = spec.pages[pageId];
      const parent = page.nodes[page.root];
      if (parent.type !== "frame") throw new Error("root는 프레임이어야 한다");

      const id = generateNodeId(kind, page.nodes);
      const overrides = { name: `Test${kind}` };
      const node = createNode(kind, overrides);

      spec = {
        ...spec,
        pages: {
          ...spec.pages,
          [pageId]: {
            ...page,
            nodes: {
              ...page.nodes,
              [id]: node,
              [page.root]: {
                ...parent,
                children: [...parent.children, { node: id }],
              },
            },
          },
        },
      };

      expect(validateProjectSpec(spec).issues).toEqual([]);
    });
  });
});
