import type { ChildReference, Node, NodeId, ScreenSpec } from "@/features/editor/schema";

import type { Ticket } from "./types";

/**
 * screen.name·node.name을 컴포넌트 이름으로 옮긴다.
 * (design 문서 `docs/superpowers/specs/2026-08-11-visual-spec-to-react-codegen-design.md`
 * §6 "컴포넌트 이름 규칙"을 코드로 옮긴 것 — 지금까지는 스킬 지시문에만 있었다.)
 * 영문자·숫자가 아닌 문자를 단어 경계로 보고 각 단어 첫 글자만 대문자로 올린다.
 * 숫자로 시작하거나 단어가 하나도 안 남으면 앞에 "Screen"을 붙인다.
 */
export function toPascalCase(name: string): string {
  const pascal = name
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

  if (pascal.length === 0) return "Screen";
  return /^[0-9]/.test(pascal) ? `Screen${pascal}` : pascal;
}

/**
 * 노드의 "모양"만 담은 키 — 형제가 같은 컴포넌트인지 비교할 때 쓴다.
 * TextNode.content, ImageNode.src처럼 인스턴스마다 달라도 되는 값(장차 props가
 * 될 값)은 일부러 뺀다. 나머지가 하나라도 다르면 다른 컴포넌트로 본다 —
 * 색상·타이포그래피 같은 스타일 차이까지 props로 자동 추출하지 않는다(v0.1은
 * 보수적으로 간다. 잘못 합치는 것보다 안 합치는 게 안전하다).
 */
function structuralKey(node: Node, nodes: Record<NodeId, Node>): string {
  if (node.type === "text") {
    return JSON.stringify({ t: "text", box: node.box, color: node.color, typography: node.typography });
  }

  if (node.type === "image") {
    return JSON.stringify({ t: "image", box: node.box, fit: node.fit });
  }

  // ButtonNode.content, InputNode.placeholder도 TextNode.content와 같은 이유로 뺀다 —
  // 인스턴스마다 달라도 되는 값(장차 props가 될 값)이다.
  if (node.type === "button") {
    return JSON.stringify({
      t: "button",
      box: node.box,
      typography: node.typography,
      color: node.color,
      background: node.background,
      border: node.border,
    });
  }

  if (node.type === "input") {
    return JSON.stringify({
      t: "input",
      box: node.box,
      typography: node.typography,
      color: node.color,
      background: node.background,
      border: node.border,
    });
  }

  return JSON.stringify({
    t: "frame",
    box: node.box,
    layout: node.layout,
    background: node.background,
    border: node.border,
    children: node.children.map((child) => {
      const childNode = nodes[child.node];
      return childNode === undefined ? null : structuralKey(childNode, nodes);
    }),
  });
}

/** 형제 중 구조가 같은(모양이 겹치는) 것끼리 묶는다. 2개 이상 묶인 그룹만 "반복"으로 친다. */
function groupRepeatedSiblings(
  children: ChildReference[],
  nodes: Record<NodeId, Node>,
): NodeId[][] {
  const buckets = new Map<string, NodeId[]>();

  for (const child of children) {
    const node = nodes[child.node];
    if (node === undefined) continue;

    const key = structuralKey(node, nodes);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [child.node]);
    } else {
      bucket.push(child.node);
    }
  }

  return [...buckets.values()].filter((group) => group.length >= 2);
}

/**
 * IR을 컴포넌트 구현 티켓 목록으로 분해한다(순수 함수).
 *
 * 규칙은 `skills/visual-spec-to-react/SKILL.md`의 "컴포넌트 단위로 분리 생성한다"
 * 절 그대로다 — 여기서 새로 정하지 않는다.
 *
 * 1. root의 직계 자식은 각각 하나의 컴포넌트 티켓이 된다(반복 여부와 무관하게).
 * 2. 그 자식의 하위 자식들 중 구조가 같은 형제가 2개 이상이면, 그 반복 단위를
 *    별도 컴포넌트 티켓으로 먼저 뽑는다(1번 티켓이 그 티켓에 의존한다).
 *    더 깊은 단계의 반복은 v0.1에서 다루지 않는다 — 아직 실제로 필요한 예제가
 *    없다(examples/dashboard-cards.json은 이 깊이까지만 있다).
 * 3. screen.root 자신은 "page" 티켓이 되어, 1번에서 만든 티켓 전부에 의존한다.
 *
 * 반환 배열의 순서 자체가 이미 유효한 실행 순서다(자식이 부모보다 먼저) —
 * 별도로 위상 정렬할 필요가 없다.
 */
export function compileTickets(screen: ScreenSpec): Ticket[] {
  const { root, nodes } = screen;
  const rootNode = nodes[root];
  if (rootNode === undefined || rootNode.type !== "frame") return [];

  const tickets: Ticket[] = [];
  const usedIds = new Set<string>();

  function reserveId(base: string): string {
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  const rootChildTicketIds: string[] = [];

  for (const child of rootNode.children) {
    const childNode = nodes[child.node];
    if (childNode === undefined) continue;

    const nestedTicketIds: string[] = [];

    if (childNode.type === "frame") {
      for (const group of groupRepeatedSiblings(childNode.children, nodes)) {
        const firstInstance = nodes[group[0]];
        const baseName = firstInstance === undefined ? "Component" : toPascalCase(firstInstance.name);
        const id = reserveId(baseName);

        tickets.push({
          id,
          componentName: id,
          kind: "component",
          instances: group,
          dependsOn: [],
          status: "pending",
        });
        nestedTicketIds.push(id);
      }
    }

    const id = reserveId(toPascalCase(childNode.name));
    tickets.push({
      id,
      componentName: id,
      kind: "component",
      instances: [child.node],
      dependsOn: nestedTicketIds,
      status: "pending",
    });
    rootChildTicketIds.push(id);
  }

  const pageId = reserveId(toPascalCase(screen.name));
  tickets.push({
    id: pageId,
    componentName: pageId,
    kind: "page",
    instances: [root],
    dependsOn: rootChildTicketIds,
    status: "pending",
  });

  return tickets;
}
