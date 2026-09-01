import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import { applyCommand, applyTransaction } from "@/features/editor/command/applyCommand";
import type { Command } from "@/features/editor/command/types";
import type { VisualSpec } from "@/features/editor/schema";

const BASE = dashboardCards as VisualSpec;

const NEW_TEXT_NODE = {
  type: "text",
  name: "New",
  box: { width: "auto", height: "auto" },
  content: "새 텍스트",
  color: "#000000",
  typography: {
    fontFamily: "Pretendard",
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 20,
    letterSpacing: 0,
    textAlign: "left",
  },
} as const;

describe("applyCommand — createNode", () => {
  it("frame 부모의 children 끝에 추가하고 노드를 정의한다", () => {
    const command: Command = {
      type: "createNode",
      parentId: "header",
      id: "newText",
      node: NEW_TEXT_NODE,
    };
    const next = applyCommand(BASE, command);

    expect(next.screen.nodes.newText).toEqual(NEW_TEXT_NODE);
    expect(next.screen.nodes.header).toMatchObject({
      children: [{ node: "headerTitle" }, { node: "newText" }],
    });
    expect(next).not.toBe(BASE); // 불변
  });

  it("부모가 없거나 frame이 아니면 아무 것도 하지 않는다", () => {
    const missingParent: Command = {
      type: "createNode",
      parentId: "nope",
      id: "newText",
      node: NEW_TEXT_NODE,
    };
    const nonFrameParent: Command = {
      type: "createNode",
      parentId: "headerTitle", // text 노드
      id: "newText",
      node: NEW_TEXT_NODE,
    };

    expect(applyCommand(BASE, missingParent)).toBe(BASE);
    expect(applyCommand(BASE, nonFrameParent)).toBe(BASE);
  });

  it("이미 있는 id는 덮어쓰지 않는다", () => {
    const command: Command = {
      type: "createNode",
      parentId: "header",
      id: "cardA", // 이미 존재
      node: NEW_TEXT_NODE,
    };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });
});

describe("applyCommand — updateNode", () => {
  it("점 표기 경로로 값을 바꾼다(불변)", () => {
    const command: Command = {
      type: "updateNode",
      id: "cardA",
      path: "layout.gap",
      value: 40,
    };
    const next = applyCommand(BASE, command);

    const cardA = next.screen.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(40);
    expect(BASE.screen.nodes.cardA.type === "frame" && BASE.screen.nodes.cardA.layout.gap).toBe(8);
  });

  it("없는 노드는 아무 것도 하지 않는다", () => {
    const command: Command = { type: "updateNode", id: "nope", path: "layout.gap", value: 1 };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });
});

describe("applyCommand — deleteNode", () => {
  it("부모의 children 참조와 노드 정의를 함께 지운다", () => {
    const next = applyCommand(BASE, { type: "deleteNode", id: "cardA" });

    expect(next.screen.nodes.cardA).toBeUndefined();
    expect(next.screen.nodes.content).toMatchObject({ children: [{ node: "cardB" }] });
  });

  it("자손까지 연쇄로 지운다 — orphan을 남기지 않는다", () => {
    const next = applyCommand(BASE, { type: "deleteNode", id: "content" });

    expect(next.screen.nodes.content).toBeUndefined();
    expect(next.screen.nodes.cardA).toBeUndefined();
    expect(next.screen.nodes.cardALabel).toBeUndefined();
    expect(next.screen.nodes.cardAValue).toBeUndefined();
    expect(next.screen.nodes.cardB).toBeUndefined();
  });

  it("root는 지울 수 없다", () => {
    expect(applyCommand(BASE, { type: "deleteNode", id: BASE.screen.root })).toBe(BASE);
  });

  it("없는 노드는 아무 것도 하지 않는다", () => {
    expect(applyCommand(BASE, { type: "deleteNode", id: "nope" })).toBe(BASE);
  });
});

describe("applyCommand — moveNode", () => {
  it("다른 부모로 옮긴다", () => {
    const next = applyCommand(BASE, {
      type: "moveNode",
      id: "cardA",
      newParentId: "header",
      index: 0,
    });

    expect(next.screen.nodes.content).toMatchObject({ children: [{ node: "cardB" }] });
    expect(next.screen.nodes.header).toMatchObject({
      children: [{ node: "cardA" }, { node: "headerTitle" }],
    });
  });

  it("같은 부모 안에서 순서를 바꾼다", () => {
    const next = applyCommand(BASE, {
      type: "moveNode",
      id: "cardB",
      newParentId: "content",
      index: 0,
    });

    expect(next.screen.nodes.content).toMatchObject({
      children: [{ node: "cardB" }, { node: "cardA" }],
    });
  });

  it("자기 자신 밑으로는 옮길 수 없다(순환 방지)", () => {
    const command: Command = {
      type: "moveNode",
      id: "content",
      newParentId: "cardA", // content의 자손
      index: 0,
    };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });

  it("root는 옮길 수 없다", () => {
    const command: Command = {
      type: "moveNode",
      id: BASE.screen.root,
      newParentId: "header",
      index: 0,
    };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });

  it("frame이 아닌 곳으로는 옮길 수 없다", () => {
    const command: Command = {
      type: "moveNode",
      id: "cardA",
      newParentId: "headerTitle", // text
      index: 0,
    };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });
});

describe("applyCommand — setLayout", () => {
  it("frame 노드의 layout을 통째로 바꾼다", () => {
    const newLayout = {
      direction: "row",
      gap: 99,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: "center",
      crossAxis: "center",
    } as const;
    const next = applyCommand(BASE, { type: "setLayout", id: "cardA", layout: newLayout });

    const cardA = next.screen.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout).toEqual(newLayout);
  });

  it("text/image 노드에는 적용하지 않는다(layout이 없다)", () => {
    const command: Command = {
      type: "setLayout",
      id: "headerTitle",
      layout: {
        direction: "row",
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "start",
      },
    };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });
});

describe("applyTransaction", () => {
  it("여러 Command를 순서대로 적용한다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 1 },
      { type: "deleteNode", id: "cardB" },
      {
        type: "createNode",
        parentId: "content",
        id: "cardC",
        node: NEW_TEXT_NODE,
      },
    ];
    const next = applyTransaction(BASE, commands);

    const cardA = next.screen.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(1);
    expect(next.screen.nodes.cardB).toBeUndefined();
    expect(next.screen.nodes.cardC).toEqual(NEW_TEXT_NODE);
    expect(next.screen.nodes.content).toMatchObject({
      children: [{ node: "cardA" }, { node: "cardC" }],
    });
  });

  it("빈 목록이면 같은 참조를 그대로 돌려준다", () => {
    expect(applyTransaction(BASE, [])).toBe(BASE);
  });
});
