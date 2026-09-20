import { describe, expect, it } from "vitest";

import type { Node } from "@/features/editor/schema";
import {
  collectSubtree,
  duplicateCommands,
  placeAfterCommand,
} from "@/features/editor/store/duplicateNode";

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

/** root > content > (cardA > cardALabel, cardB) */
function makeNodes(): Record<string, Node> {
  return {
    root: frame("Root", ["content"]),
    content: frame("Content", ["cardA", "cardB"]),
    cardA: frame("Card A", ["cardALabel"]),
    cardALabel: text("Label"),
    cardB: frame("Card B", []),
  };
}

describe("collectSubtree", () => {
  it("노드와 자손을 전부 담는다", () => {
    const subtree = collectSubtree(makeNodes(), "cardA");

    expect(subtree?.rootId).toBe("cardA");
    expect(Object.keys(subtree?.nodes ?? {}).sort()).toEqual(["cardA", "cardALabel"]);
  });

  it("바깥 형제는 담지 않는다", () => {
    const subtree = collectSubtree(makeNodes(), "cardA");

    expect(subtree?.nodes.cardB).toBeUndefined();
    expect(subtree?.nodes.root).toBeUndefined();
  });

  it("없는 id면 null을 준다", () => {
    expect(collectSubtree(makeNodes(), "nope")).toBeNull();
  });

  it("자식이 없는 노드도 자기 자신 하나를 담는다", () => {
    const subtree = collectSubtree(makeNodes(), "cardALabel");

    expect(Object.keys(subtree?.nodes ?? {})).toEqual(["cardALabel"]);
  });

  it("순환 참조가 있어도 끝난다", () => {
    // 검증기가 막는 모양이지만, 깨진 문서를 열었을 때 멈추지 않아야 한다.
    const nodes = makeNodes();
    nodes.cardALabel = frame("Cycle", ["cardA"]);

    const subtree = collectSubtree(nodes, "cardA");

    expect(Object.keys(subtree?.nodes ?? {}).sort()).toEqual(["cardA", "cardALabel"]);
  });
});

describe("duplicateCommands", () => {
  it("부모를 자식보다 먼저 만든다", () => {
    const nodes = makeNodes();
    const subtree = collectSubtree(nodes, "cardA");
    const { commands, newRootId } = duplicateCommands(subtree!, "content", nodes);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({ type: "createNode", id: newRootId });
  });

  it("새 id는 기존 id와 겹치지 않는다", () => {
    const nodes = makeNodes();
    const subtree = collectSubtree(nodes, "cardA");
    const { commands } = duplicateCommands(subtree!, "content", nodes);

    for (const command of commands) {
      expect(nodes[(command as { id: string }).id]).toBeUndefined();
    }
  });

  it("한 배치 안에서 같은 id를 두 번 내지 않는다", () => {
    const nodes = makeNodes();
    const subtree = collectSubtree(nodes, "content");
    const { commands } = duplicateCommands(subtree!, "root", nodes);

    const ids = commands.map((command) => (command as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("frame 은 자식 목록을 비워서 낸다 — 자손의 createNode 가 채운다", () => {
    // 원본 목록을 그대로 실으면 자식이 한 번 더 붙어 children 이 두 배가 된다.
    const nodes = makeNodes();
    const subtree = collectSubtree(nodes, "cardA");
    const { commands } = duplicateCommands(subtree!, "content", nodes);

    const copiedRoot = commands[0] as { node: Node };
    expect(copiedRoot.node.type === "frame" && copiedRoot.node.children).toEqual([]);
  });

  it("자식도 새 id 로 함께 만든다 — 원본의 자식을 같이 가리키지 않는다", () => {
    const nodes = makeNodes();
    const subtree = collectSubtree(nodes, "cardA");
    const { commands, newRootId } = duplicateCommands(subtree!, "content", nodes);

    const child = commands[1] as { parentId: string; id: string };
    expect(child.parentId).toBe(newRootId);
    expect(child.id).not.toBe("cardALabel");
  });

  it("첫 명령의 부모는 넘긴 parentId다", () => {
    const nodes = makeNodes();
    const subtree = collectSubtree(nodes, "cardALabel");
    const { commands } = duplicateCommands(subtree!, "cardB", nodes);

    expect(commands[0]).toMatchObject({ type: "createNode", parentId: "cardB" });
  });
});

describe("placeAfterCommand", () => {
  it("원본 바로 뒤 자리로 옮긴다", () => {
    const nodes = makeNodes();

    expect(placeAfterCommand(nodes, "content", "cardA", "new-1")).toEqual({
      type: "moveNode",
      id: "new-1",
      newParentId: "content",
      index: 1,
    });
  });

  it("부모가 frame이 아니면 null이다", () => {
    expect(placeAfterCommand(makeNodes(), "cardALabel", "cardA", "new-1")).toBeNull();
  });

  it("원본이 그 부모의 자식이 아니면 null이다", () => {
    expect(placeAfterCommand(makeNodes(), "content", "root", "new-1")).toBeNull();
  });
});
