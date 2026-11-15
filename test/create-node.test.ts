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

    it("border.radius는 온전한 객체를 주면 통째로 바뀐다 (부분 객체는 컴파일 타임에 막힌다)", () => {
      // @ts-expect-error radius의 객체 변형은 모서리 4칸이 모두 필수다 — 반쪽만
      // 주면 deepMerge가 기본값(숫자)과 병합할 수 없어 필수 칸이 빠진 채로 통과한다.
      // 그래서 DeepPartial이 Radius 안까지 파고들지 않게 막아 뒀다(타입 레벨 회귀 테스트).
      createNode("frame", { border: { radius: { topLeft: 4 } } });

      const node = createNode("frame", {
        border: { radius: { topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4 } },
      });

      if (node.type !== "frame") throw new Error("frame이어야 한다");
      expect(node.border).toEqual({
        width: 1,
        color: "#E5E7EB",
        radius: { topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4 },
      });
    });

    it("기본값이 아예 없는 선택 필드(shadow)도 온전한 객체로만 채울 수 있다", () => {
      // @ts-expect-error Shadow도 모든 칸이 필수다. frame 기본값은 shadow를 아예
      // 만들지 않으므로(never seeded) 부분 객체를 주면 병합할 base 자체가 없다.
      createNode("frame", { shadow: { blur: 10 } });

      let spec = migrateV01(blankSpec);
      const pageId = spec.pageOrder[0];
      const page = spec.pages[pageId];
      const parent = page.nodes[page.root];
      if (parent.type !== "frame") throw new Error("root는 프레임이어야 한다");

      const id = generateNodeId("frame", page.nodes);
      const node = createNode("frame", {
        shadow: { x: 0, y: 2, blur: 10, spread: 0, color: "#00000020" },
      });

      spec = {
        ...spec,
        pages: {
          ...spec.pages,
          [pageId]: {
            ...page,
            nodes: {
              ...page.nodes,
              [id]: node,
              [page.root]: { ...parent, children: [...parent.children, { node: id }] },
            },
          },
        },
      };

      expect(validateProjectSpec(spec).issues).toEqual([]);
    });

    it("override 값이 명시적으로 undefined면 기본값을 지우지 않는다", () => {
      const node = createNode("text", { name: undefined, content: "안녕" });

      expect(node.name).toBe("Text");
      expect(node.content).toBe("안녕");
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
