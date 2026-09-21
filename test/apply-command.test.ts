import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import {
  applyCommand,
  applyCommandWithReason,
  applyTransaction,
  buildDuplicateCommands,
  findParentId,
} from "@/features/editor/command/applyCommand";
import type { Command } from "@/features/editor/command/types";
import { validateVisualSpec } from "@/features/editor/schema";
import type { FrameNode, ScreenSpec, VisualSpec } from "@/features/editor/schema";
import { getByPath } from "@/features/editor/store/path";

// applyCommand는 ScreenSpec을 받는다(#40) — v0.1 예제 JSON은 VisualSpec이라
// .screen만 떼어서 쓴다. v0.2 ProjectSpec의 pages[id]도 같은 ScreenSpec 모양이라
// 이 테스트가 그대로 그쪽 검증도 겸한다.
const SPEC = dashboardCards as VisualSpec;
const BASE = SPEC.screen;

/**
 * 결과 화면이 정본 스키마를 통과하는가.
 *
 * "원본과 다른 참조가 나왔다"만 보면 부족하다(PR #147 리뷰) — 중첩 경로로 필수
 * 필드를 지워도 새 참조는 똑같이 나오고, 그 상태가 정상 동작으로 굳는다.
 * 그래서 통과시키는 쪽을 검사할 때는 항상 이걸 건다.
 */
function screenIssues(screen: ScreenSpec): unknown[] {
  return validateVisualSpec({ ...SPEC, screen }).issues;
}

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

    // background는 필수 필드가 color 하나뿐이라, 없던 걸 새로 만들어도 결과가
    // 완전하다 — 그래서 중첩 경로인데도 통과한다(border와 갈리는 지점이다).
    const next = applyCommand(BASE, setBackground);
    expect(next.nodes.header).toMatchObject({ background: { color: "#123456" } });
    expect(screenIssues(next)).toEqual([]);

    const visible = applyCommand(BASE, setVisible);
    expect(visible.nodes.header).toMatchObject({ visible: false });
    expect(screenIssues(visible)).toEqual([]);

    const opacity = applyCommand(BASE, setOpacity);
    expect(opacity.nodes.headerTitle).toMatchObject({ opacity: 0.5 });
    expect(screenIssues(opacity)).toEqual([]);
  });

  /**
   * ui/Canvas.tsx · ui/LayerTree.tsx · ui/properties/*가 실제로 넘기는 경로 전수다.
   * 값도 그 호출부가 넘기는 모양으로 둔다 — 예전엔 전부 `1`을 넣고 "원본과 참조가
   * 다른지"만 봤는데, 그러면 `border: 1`처럼 스키마를 깨는 결과도 통과로 세어
   * 오염이 정상 동작으로 굳는다(PR #147 리뷰).
   *
   * border·shadow·모서리별 radius는 여기 낱개 경로가 없다. 패널이 낱개로 넘기지
   * 않고 properties/borderPatch.mergeBorder · shadowPatch.mergeShadow ·
   * radiusPatch.mergeCornerRadius로 완전한 객체를 만들어 통째로 넘기기 때문이다.
   */
  const FRAME_CALL_SITES: { path: string; value: unknown }[] = [
    { path: "box.width", value: 320 }, // Canvas 리사이즈
    { path: "box.height", value: 200 },
    { path: "name", value: "Renamed" }, // LayerTree 이름 편집
    { path: "visible", value: false }, // LayerTree 표시 토글
    { path: "layout.direction", value: "row" }, // LayoutSection
    { path: "layout.gap", value: 24 },
    { path: "layout.padding.top", value: 12 },
    { path: "background.color", value: "#123456" }, // BackgroundSection
    // BorderSection은 mergeBorder가 만든 완전한 Border를 통째로 넘긴다.
    { path: "border", value: { width: 2, color: "#FF0000", radius: 8 } },
    // 모서리별로 바꿀 때도 mergeCornerRadius가 네 칸을 다 채워서 넘긴다.
    {
      path: "border",
      value: {
        width: 1,
        color: "#E5E7EB",
        radius: { topLeft: 4, topRight: 12, bottomRight: 12, bottomLeft: 12 },
      },
    },
    // EffectsSection은 mergeShadow가 만든 완전한 Shadow를 통째로 넘긴다.
    { path: "shadow", value: { x: 0, y: 2, blur: 8, spread: 0, color: "#00000022" } },
    { path: "opacity", value: 0.5 },
    { path: "blur", value: 4 },
  ];

  it("기존 호출부가 쓰는 경로는 그대로 동작하고 결과가 스키마를 통과한다", () => {
    for (const { path, value } of FRAME_CALL_SITES) {
      const next = applyCommand(BASE, { type: "updateNode", id: "cardA", path, value });

      expect(next, path).not.toBe(BASE);
      expect(getByPath(next.nodes.cardA, path), path).toEqual(value);
      expect(screenIssues(next), path).toEqual([]);
    }
  });

  const TEXT_CALL_SITES: { path: string; value: unknown }[] = [
    { path: "content", value: "바뀐 내용" }, // ContentSection
    { path: "color", value: "#222222" }, // ColorSection
    { path: "typography.fontSize", value: 18 }, // TypographySection
    { path: "typography.textAlign", value: "center" },
  ];

  it("text 노드의 경로도 그대로 동작하고 결과가 스키마를 통과한다", () => {
    for (const { path, value } of TEXT_CALL_SITES) {
      const next = applyCommand(BASE, { type: "updateNode", id: "headerTitle", path, value });

      expect(next, path).not.toBe(BASE);
      expect(getByPath(next.nodes.headerTitle, path), path).toEqual(value);
      expect(screenIssues(next), path).toEqual([]);
    }
  });
});

/**
 * PR #147 리뷰: 경로 **이름**만 스키마와 맞춰보면 "지금 값 위에 썼을 때 결과가
 * 성립하는가"를 놓친다. 중간 값이 없거나 유니온의 비객체 분기면 setByPath가 빈
 * 객체를 만들어 내려가고, 그 자리의 필수 형제 필드가 통째로 사라진다.
 * 새 screen 참조는 그대로 나오므로 history에는 성공 단계로 쌓이는데 결과는 스키마
 * 검증에 실패한다 — #146이 잡으려던 조용한 오염의 다른 형태다.
 */
describe("applyCommand — updateNode 중첩 경로가 필수 형제 필드를 지우는 경우", () => {
  it("border가 없는 노드에 border.width만 쓰지 않는다", () => {
    const header = BASE.nodes.header;
    expect(header.type === "frame" && header.border).toBeUndefined();

    // 통과시키면 border: { width: 3 } — 필수 color·radius가 없다.
    const command: Command = {
      type: "updateNode",
      id: "header",
      path: "border.width",
      value: 3,
    };

    expect(applyCommand(BASE, command)).toBe(BASE);
  });

  it("radius가 숫자인 노드에 border.radius.topLeft만 쓰지 않는다", () => {
    const cardA = BASE.nodes.cardA;
    expect(cardA.type === "frame" && cardA.border?.radius).toBe(12);

    // 통과시키면 radius: { topLeft: 4 } — 나머지 모서리 셋이 없다.
    const command: Command = {
      type: "updateNode",
      id: "cardA",
      path: "border.radius.topLeft",
      value: 4,
    };

    expect(applyCommand(BASE, command)).toBe(BASE);
  });

  it("radius가 이미 모서리별 객체면 한 모서리만 바꾸는 건 통과한다", () => {
    // 경로 이름이 아니라 지금 값으로 가른다 — 여기서는 나머지 세 모서리가
    // 보존되므로 결과가 스키마를 만족한다.
    const corners = { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 };
    const perCorner: ScreenSpec = {
      ...BASE,
      nodes: {
        ...BASE.nodes,
        cardA: {
          ...(BASE.nodes.cardA as FrameNode),
          border: { width: 1, color: "#E5E7EB", radius: corners },
        },
      },
    };

    const next = applyCommand(perCorner, {
      type: "updateNode",
      id: "cardA",
      path: "border.radius.topLeft",
      value: 9,
    });

    expect(next).not.toBe(perCorner);
    expect(getByPath(next.nodes.cardA, "border.radius")).toEqual({ ...corners, topLeft: 9 });
    expect(screenIssues(next)).toEqual([]);
  });

  it("border가 있는 노드에 border.width 하나만 바꾸는 건 통과한다", () => {
    const next = applyCommand(BASE, {
      type: "updateNode",
      id: "cardA",
      path: "border.width",
      value: 3,
    });

    expect(getByPath(next.nodes.cardA, "border")).toEqual({
      width: 3,
      color: "#E5E7EB",
      radius: 12,
    });
    expect(screenIssues(next)).toEqual([]);
  });

  // 스키마의 properties를 `properties[key]`로 바로 읽으면 이 키들이 Object.prototype의
  // 것을 집어 "스키마에 선언된 속성"처럼 보인다. 그러면 additionalProperties: false인
  // 자리에 그 이름의 필드가 붙어 스펙이 무효가 된다.
  it("스키마 속성처럼 보이는 프로토타입 키를 막는다", () => {
    const paths = [
      "__proto__",
      "constructor",
      "toString",
      "__proto__.polluted",
      "border.__proto__.width",
      "constructor.name",
    ];

    for (const path of paths) {
      const command: Command = { type: "updateNode", id: "cardA", path, value: 1 };
      expect(applyCommand(BASE, command), path).toBe(BASE);
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

describe("findParentId", () => {
  it("children 참조로 갖고 있는 frame을 찾는다", () => {
    expect(findParentId(BASE.nodes, "cardA")).toBe("content");
    expect(findParentId(BASE.nodes, "cardALabel")).toBe("cardA");
  });

  it("root이거나 고아면 undefined다", () => {
    expect(findParentId(BASE.nodes, "root")).toBeUndefined();
  });
});

describe("buildDuplicateCommands — 복제·붙여넣기 Command 묶음(#151)", () => {
  it("서브트리 전체를 새 id로 복제하고 원본 뒤에 끼워 넣는 moveNode를 덧붙인다", () => {
    const built = buildDuplicateCommands(BASE.nodes, "cardA", BASE.nodes, "content", 1);
    expect(built).not.toBeNull();
    if (built === null) return;

    // cardA + cardALabel + cardAValue, 부모보다 자식이 나중이라 createNode
    // Command가 부모부터 나와야 자식의 parentId가 그 시점에 이미 존재한다.
    expect(built.commands).toHaveLength(4);
    const [createRoot, createLabel, createValue, move] = built.commands;
    expect(createRoot).toMatchObject({ type: "createNode", parentId: "content" });
    expect(createLabel).toMatchObject({ type: "createNode", parentId: built.newRootId });
    expect(createValue).toMatchObject({ type: "createNode", parentId: built.newRootId });
    expect(move).toEqual({
      type: "moveNode",
      id: built.newRootId,
      newParentId: "content",
      index: 1,
    });

    // 새 id는 원본과 겹치지 않고, frame 타입 접두사를 그대로 쓴다.
    expect(built.newRootId).not.toBe("cardA");
    expect(built.newRootId.startsWith("frame-")).toBe(true);
  });

  it("적용하면 자식 참조가 새 id를 가리키고 내용은 원본과 같다", () => {
    const built = buildDuplicateCommands(BASE.nodes, "cardA", BASE.nodes, "content", 1);
    if (built === null) throw new Error("built는 null이 아니어야 한다");

    const next = applyTransaction(BASE, built.commands);
    const duplicated = next.nodes[built.newRootId] as FrameNode;

    expect(duplicated.children).toHaveLength(2);
    expect(duplicated.background).toEqual((BASE.nodes.cardA as FrameNode).background);
    const [labelRef, valueRef] = duplicated.children;
    expect(next.nodes[labelRef.node]).toMatchObject({ content: "총 방문자" });
    expect(next.nodes[valueRef.node]).toMatchObject({ content: "12,480" });

    // 원본은 그대로 있고, content의 children이 [cardA, 복제본, cardB] 순서다.
    expect(next.nodes.cardA).toBe(BASE.nodes.cardA);
    expect(next.nodes.content).toMatchObject({
      children: [{ node: "cardA" }, { node: built.newRootId }, { node: "cardB" }],
    });

    expect(screenIssues(next)).toEqual([]);
  });

  it("liveNodes에 있는 id와는 겹치지 않는다", () => {
    // sourceNodes(클립보드)는 원본 id를 그대로 담고 있지만, 겹치면 안 되는
    // 대상은 liveNodes(지금 문서)다 — 붙여넣기가 실제로 쓰는 모양이다.
    const clipboardNodes = { cardA: BASE.nodes.cardA, cardALabel: BASE.nodes.cardALabel, cardAValue: BASE.nodes.cardAValue };
    const liveNodes = { ...BASE.nodes, "frame-1": BASE.nodes.cardA };

    const built = buildDuplicateCommands(clipboardNodes, "cardA", liveNodes, "content", 2);
    expect(built).not.toBeNull();
    expect(built?.newRootId).toBe("frame-2"); // frame-1이 이미 있으니 건너뛴다
  });

  it("대상이 없으면 null이다", () => {
    expect(buildDuplicateCommands(BASE.nodes, "missing", BASE.nodes, "content", 0)).toBeNull();
  });
});

describe("applyCommandWithReason — no-op 이유(#154)", () => {
  it("성공하면 이유가 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "updateNode",
      id: "cardA",
      path: "layout.gap",
      value: 40,
    });
    expect(result.reason).toBeUndefined();
    expect(result.screen).not.toBe(BASE);
  });

  it("createNode — parentId가 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "createNode",
      parentId: "없음",
      id: "x",
      node: NEW_TEXT_NODE,
    });
    expect(result.reason).toBe("parentId '없음'가 없습니다");
    expect(result.screen).toBe(BASE);
  });

  it("createNode — parentId가 frame이 아니다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "createNode",
      parentId: "headerTitle",
      id: "x",
      node: NEW_TEXT_NODE,
    });
    expect(result.reason).toBe("parentId 'headerTitle'가 frame이 아닙니다");
  });

  it("createNode — id가 이미 있다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "createNode",
      parentId: "content",
      id: "cardA",
      node: NEW_TEXT_NODE,
    });
    expect(result.reason).toBe("id 'cardA'가 이미 있습니다");
  });

  it("updateNode — id가 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "updateNode",
      id: "없음",
      path: "layout.gap",
      value: 1,
    });
    expect(result.reason).toBe("id '없음'가 없습니다");
  });

  it("updateNode — 경로를 쓸 수 없다(구조 필드)", () => {
    const result = applyCommandWithReason(BASE, {
      type: "updateNode",
      id: "cardA",
      path: "type",
      value: "text",
    });
    expect(result.reason).toBe("path 'type'는 이 노드에 쓸 수 없습니다");
  });

  it("deleteNode — root는 지울 수 없다", () => {
    const result = applyCommandWithReason(BASE, { type: "deleteNode", id: BASE.root });
    expect(result.reason).toBe("root는 지울 수 없습니다");
  });

  it("deleteNode — id가 없다", () => {
    const result = applyCommandWithReason(BASE, { type: "deleteNode", id: "없음" });
    expect(result.reason).toBe("id '없음'가 없습니다");
  });

  it("moveNode — root는 옮길 수 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "moveNode",
      id: BASE.root,
      newParentId: "content",
      index: 0,
    });
    expect(result.reason).toBe("root는 옮길 수 없습니다");
  });

  it("moveNode — id가 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "moveNode",
      id: "없음",
      newParentId: "content",
      index: 0,
    });
    expect(result.reason).toBe("id '없음'가 없습니다");
  });

  it("moveNode — newParentId가 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "moveNode",
      id: "cardA",
      newParentId: "없음",
      index: 0,
    });
    expect(result.reason).toBe("newParentId '없음'가 없습니다");
  });

  it("moveNode — newParentId가 frame이 아니다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "moveNode",
      id: "cardA",
      newParentId: "headerTitle",
      index: 0,
    });
    expect(result.reason).toBe("newParentId 'headerTitle'가 frame이 아닙니다");
  });

  it("moveNode — 자기 자손 밑으로는 못 옮긴다(순환)", () => {
    const result = applyCommandWithReason(BASE, {
      type: "moveNode",
      id: "content",
      newParentId: "cardA", // cardA는 content의 자손
      index: 0,
    });
    expect(result.reason).toBe(
      "id 'content'를 자기 자신이나 자손 밑으로 옮길 수 없습니다",
    );
  });

  it("setLayout — id가 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "setLayout",
      id: "없음",
      layout: (BASE.nodes.cardA as FrameNode).layout,
    });
    expect(result.reason).toBe("id '없음'가 없습니다");
  });

  it("setLayout — frame이 아니라 layout이 없다", () => {
    const result = applyCommandWithReason(BASE, {
      type: "setLayout",
      id: "headerTitle",
      layout: (BASE.nodes.cardA as FrameNode).layout,
    });
    expect(result.reason).toBe("id 'headerTitle'는 frame이 아니라 layout이 없습니다");
  });

  it("updateScreen — 경로를 쓸 수 없다(구조 필드)", () => {
    const result = applyCommandWithReason(BASE, {
      type: "updateScreen",
      path: "root",
      value: "없는id",
    });
    expect(result.reason).toBe("path 'root'는 화면에 쓸 수 없습니다");
  });

  it("applyCommand는 이 함수의 screen만 꺼낸 것과 같다", () => {
    const command: Command = { type: "updateNode", id: "cardA", path: "layout.gap", value: 7 };
    expect(applyCommand(BASE, command)).toEqual(applyCommandWithReason(BASE, command).screen);
  });
});
