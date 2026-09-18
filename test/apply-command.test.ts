import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import { applyCommand, applyTransaction } from "@/features/editor/command/applyCommand";
import type { Command } from "@/features/editor/command/types";
import type { VisualSpec } from "@/features/editor/schema";

// applyCommand는 ScreenSpec을 받는다(#40) — v0.1 예제 JSON은 VisualSpec이라
// .screen만 떼어서 쓴다. v0.2 ProjectSpec의 pages[id]도 같은 ScreenSpec 모양이라
// 이 테스트가 그대로 그쪽 검증도 겸한다.
const BASE = (dashboardCards as VisualSpec).screen;

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

    expect(next.nodes.newText).toEqual(NEW_TEXT_NODE);
    expect(next.nodes.header).toMatchObject({
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

    const cardA = next.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(40);
    expect(BASE.nodes.cardA.type === "frame" && BASE.nodes.cardA.layout.gap).toBe(8);
  });

  it("없는 노드는 아무 것도 하지 않는다", () => {
    const command: Command = { type: "updateNode", id: "nope", path: "layout.gap", value: 1 };
    expect(applyCommand(BASE, command)).toBe(BASE);
  });

  // #146: 대상만 보고 경로를 안 보면 setByPath가 없는 키를 새로 만들어서
  // 오타가 no-op이 아니라 IR 오염이 된다.
  it("스키마에 없는 경로는 아무 것도 하지 않는다", () => {
    const typo: Command = { type: "updateNode", id: "cardA", path: "layot.gap", value: 40 };
    const deepTypo: Command = { type: "updateNode", id: "cardA", path: "layout.gapp", value: 40 };
    const unknownRoot: Command = { type: "updateNode", id: "cardA", path: "rotation", value: 40 };

    expect(applyCommand(BASE, typo)).toBe(BASE);
    expect(applyCommand(BASE, deepTypo)).toBe(BASE);
    expect(applyCommand(BASE, unknownRoot)).toBe(BASE);
  });

  it("경로를 노드 타입별로 본다 — text 노드에는 layout이 없다", () => {
    const onText: Command = {
      type: "updateNode",
      id: "headerTitle", // text
      path: "layout.gap",
      value: 40,
    };
    const onFrame: Command = { type: "updateNode", id: "cardA", path: "layout.gap", value: 40 };

    expect(applyCommand(BASE, onText)).toBe(BASE);
    expect(applyCommand(BASE, onFrame)).not.toBe(BASE);
  });

  it("구조 필드(type·children)는 경로가 있어도 바꾸지 않는다", () => {
    const changeType: Command = { type: "updateNode", id: "cardA", path: "type", value: "text" };
    const changeChildren: Command = {
      type: "updateNode",
      id: "cardA",
      path: "children",
      value: [],
    };

    expect(applyCommand(BASE, changeType)).toBe(BASE);
    expect(applyCommand(BASE, changeChildren)).toBe(BASE);
  });

  // 경로 판정을 "지금 값이 있는지"로 했다면 막혔을 호출들이다 — 선택 필드를
  // 처음 설정하는 건 레이어 트리 표시 토글·배경/효과 섹션의 정상 동작이다.
  it("값이 아직 없는 선택 필드도 새로 설정한다", () => {
    const header = BASE.nodes.header;
    expect(header.type === "frame" && header.background).toBeUndefined();

    const setBackground: Command = {
      type: "updateNode",
      id: "header",
      path: "background.color",
      value: "#123456",
    };
    const setVisible: Command = {
      type: "updateNode",
      id: "header",
      path: "visible",
      value: false,
    };
    const setOpacity: Command = {
      type: "updateNode",
      id: "headerTitle",
      path: "opacity",
      value: 0.5,
    };

    const next = applyCommand(BASE, setBackground);
    expect(next.nodes.header).toMatchObject({ background: { color: "#123456" } });
    expect(applyCommand(BASE, setVisible).nodes.header).toMatchObject({ visible: false });
    expect(applyCommand(BASE, setOpacity).nodes.headerTitle).toMatchObject({ opacity: 0.5 });
  });

  it("기존 호출부가 쓰는 경로는 그대로 동작한다", () => {
    // ui/Canvas.tsx · properties/*가 실제로 넘기는 경로들.
    const paths = [
      "box.width",
      "box.height",
      "name",
      "visible",
      "layout.direction",
      "layout.gap",
      "layout.padding.top",
      "background.color",
      "border",
      "border.radius.topLeft",
      "shadow",
      "opacity",
      "blur",
    ];

    for (const path of paths) {
      const command: Command = { type: "updateNode", id: "cardA", path, value: 1 };
      expect(applyCommand(BASE, command), path).not.toBe(BASE);
    }
  });

  it("text 노드의 경로도 그대로 동작한다", () => {
    for (const path of ["content", "color", "typography.fontSize", "typography.textAlign"]) {
      const command: Command = { type: "updateNode", id: "headerTitle", path, value: 1 };
      expect(applyCommand(BASE, command), path).not.toBe(BASE);
    }
  });
});

describe("applyCommand — updateScreen", () => {
  it("노드가 아니라 화면 자신의 필드를 점 표기 경로로 바꾼다(불변)", () => {
    const command: Command = { type: "updateScreen", path: "size.width", value: 1920 };
    const next = applyCommand(BASE, command);

    expect(next.size).toEqual({ width: 1920, height: 900 });
    expect(BASE.size.width).toBe(1440); // 원본 불변
    expect(next.nodes).toBe(BASE.nodes); // 안 건드린 가지는 동일 참조
  });

  it("이름도 같은 방식으로 바꾼다", () => {
    const command: Command = { type: "updateScreen", path: "name", value: "Renamed" };
    const next = applyCommand(BASE, command);

    expect(next.name).toBe("Renamed");
  });

  it("size를 통째로 바꾸는 경로도 동작한다", () => {
    // properties/PageProperties.tsx의 해상도 프리셋이 이 경로를 쓴다.
    const command: Command = {
      type: "updateScreen",
      path: "size",
      value: { width: 390, height: 844 },
    };
    expect(applyCommand(BASE, command).size).toEqual({ width: 390, height: 844 });
  });

  // #146: 검사가 없으면 screen.siz = { width: 1920 } 이라는 스키마에 없는
  // 필드가 붙은 새 객체가 만들어지고, 새 객체라서 no-op으로 안 보인다.
  it("스키마에 없는 경로는 아무 것도 하지 않는다", () => {
    const typo: Command = { type: "updateScreen", path: "siz.width", value: 1920 };
    const deepTypo: Command = { type: "updateScreen", path: "size.widht", value: 1920 };
    const unknownRoot: Command = { type: "updateScreen", path: "resolution", value: 1920 };

    expect(applyCommand(BASE, typo)).toBe(BASE);
    expect(applyCommand(BASE, deepTypo)).toBe(BASE);
    expect(applyCommand(BASE, unknownRoot)).toBe(BASE);
  });

  it("구조 필드(root·nodes)는 경로가 있어도 바꾸지 않는다", () => {
    // 통째로 갈아 끼우면 createNode·deleteNode가 지키는 불변조건을 우회한다.
    const changeRoot: Command = { type: "updateScreen", path: "root", value: "nope" };
    const changeNodes: Command = { type: "updateScreen", path: "nodes", value: {} };

    expect(applyCommand(BASE, changeRoot)).toBe(BASE);
    expect(applyCommand(BASE, changeNodes)).toBe(BASE);
  });
});

describe("applyCommand — deleteNode", () => {
  it("부모의 children 참조와 노드 정의를 함께 지운다", () => {
    const next = applyCommand(BASE, { type: "deleteNode", id: "cardA" });

    expect(next.nodes.cardA).toBeUndefined();
    expect(next.nodes.content).toMatchObject({ children: [{ node: "cardB" }] });
  });

  it("자손까지 연쇄로 지운다 — orphan을 남기지 않는다", () => {
    const next = applyCommand(BASE, { type: "deleteNode", id: "content" });

    expect(next.nodes.content).toBeUndefined();
    expect(next.nodes.cardA).toBeUndefined();
    expect(next.nodes.cardALabel).toBeUndefined();
    expect(next.nodes.cardAValue).toBeUndefined();
    expect(next.nodes.cardB).toBeUndefined();
  });

  it("root는 지울 수 없다", () => {
    expect(applyCommand(BASE, { type: "deleteNode", id: BASE.root })).toBe(BASE);
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

    expect(next.nodes.content).toMatchObject({ children: [{ node: "cardB" }] });
    expect(next.nodes.header).toMatchObject({
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

    expect(next.nodes.content).toMatchObject({
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
      id: BASE.root,
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

    const cardA = next.nodes.cardA;
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

    const cardA = next.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(1);
    expect(next.nodes.cardB).toBeUndefined();
    expect(next.nodes.cardC).toEqual(NEW_TEXT_NODE);
    expect(next.nodes.content).toMatchObject({
      children: [{ node: "cardA" }, { node: "cardC" }],
    });
  });

  it("빈 목록이면 같은 참조를 그대로 돌려준다", () => {
    expect(applyTransaction(BASE, [])).toBe(BASE);
  });
});
