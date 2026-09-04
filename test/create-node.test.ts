import { describe, expect, it } from "vitest";

import { migrateV01, validateProjectSpec } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { createNode } from "@/features/editor/store/createNode";
import { generateNodeId } from "@/features/editor/store/nodeId";

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

  it("호출할 때마다 새 객체를 만든다", () => {
    // 같은 객체를 공유하면 한쪽을 편집할 때 다른 노드까지 바뀐다.
    expect(createNode("frame")).not.toBe(createNode("frame"));
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
});
