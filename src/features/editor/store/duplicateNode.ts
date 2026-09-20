import type { Command } from "@/features/editor/command/types";
import type { Node, NodeId } from "@/features/editor/schema";

import { generateNodeId } from "./nodeId";

/** 복제·붙여넣기가 옮겨 심을 노드 한 덩어리. 잘라낸 서브트리 그대로다. */
export interface NodeSubtree {
  /** 덩어리의 꼭대기. `nodes` 안에 반드시 있다. */
  rootId: NodeId;
  /** 꼭대기와 그 자손 전부. 바깥을 가리키는 자식 참조는 없다. */
  nodes: Record<NodeId, Node>;
}

function isFrame(node: Node | undefined): node is Extract<Node, { type: "frame" }> {
  return node?.type === "frame";
}

/**
 * 한 노드와 그 자손을 통째로 떼어 낸다. 없는 id면 null.
 *
 * 복사(`Ctrl+C`)와 복제(`Ctrl+D`)가 같은 것을 필요로 한다 — 원본이 그 뒤에
 * 지워지거나 바뀌어도 붙여넣을 수 있어야 하므로 **그 시점의 사본**을 든다.
 */
export function collectSubtree(
  nodes: Record<NodeId, Node>,
  rootId: NodeId,
): NodeSubtree | null {
  if (nodes[rootId] === undefined) return null;

  const out: Record<NodeId, Node> = {};
  const stack: NodeId[] = [rootId];

  while (stack.length > 0) {
    const id = stack.pop() as NodeId;
    // 순환 스펙(검증기가 잡는다)이 들어와도 무한히 돌지 않는다.
    if (out[id] !== undefined) continue;

    const node = nodes[id];
    if (node === undefined) continue;
    out[id] = node;

    if (isFrame(node)) {
      for (const child of node.children) stack.push(child.node);
    }
  }

  return { rootId, nodes: out };
}

/** 노드 종류에서 새 id 의 앞자리를 고른다 — `frame-3` 처럼 읽히게. */
function prefixOf(node: Node): string {
  return node.type;
}

/**
 * 서브트리를 `parentId` 밑에 새 id 로 심는 Command 목록.
 *
 * **새 Command 타입을 만들지 않는다.** `createNode` 를 자손 수만큼 낸 뒤
 * 호출부가 `applyTransaction` 으로 한 번에 적용하면 Undo 도 한 단계다 —
 * Command 스키마는 #153 에서 v0.1 로 동결됐고, 복제는 기존 명령의 조합으로
 * 표현되므로 굳이 건드릴 이유가 없다.
 *
 * 순서가 중요하다. `applyCreateNode` 는 부모가 이미 있어야 자식을 붙이므로
 * **위에서 아래로**(전위 순회) 내보낸다.
 *
 * 새 id 는 `existing` 에 이미 만든 것을 쌓아 가며 뽑는다. `generateNodeId` 는
 * 빈 번호를 재사용하므로, 누적하지 않으면 같은 배치 안에서 같은 id 가 두 번
 * 나와 두 번째 `createNode` 가 조용히 무시된다.
 */
export function duplicateCommands(
  subtree: NodeSubtree,
  parentId: NodeId,
  existing: Record<NodeId, unknown>,
): { commands: Command[]; newRootId: NodeId } {
  const taken: Record<NodeId, true> = {};
  for (const id of Object.keys(existing)) taken[id] = true;

  const idMap = new Map<NodeId, NodeId>();
  const commands: Command[] = [];

  /** 이 노드의 새 id 를 정해 두고(아직 만들지는 않는다) 돌려준다. */
  function assign(oldId: NodeId): NodeId {
    const known = idMap.get(oldId);
    if (known !== undefined) return known;

    const source = subtree.nodes[oldId];
    const fresh = generateNodeId(source === undefined ? "node" : prefixOf(source), taken);
    taken[fresh] = true;
    idMap.set(oldId, fresh);
    return fresh;
  }

  const newRootId = assign(subtree.rootId);

  const stack: { oldId: NodeId; newParentId: NodeId }[] = [
    { oldId: subtree.rootId, newParentId: parentId },
  ];
  const emitted = new Set<NodeId>();

  while (stack.length > 0) {
    const { oldId, newParentId } = stack.shift() as {
      oldId: NodeId;
      newParentId: NodeId;
    };
    if (emitted.has(oldId)) continue;
    emitted.add(oldId);

    const source = subtree.nodes[oldId];
    if (source === undefined) continue;

    const newId = assign(oldId);

    if (isFrame(source)) {
      // **자식 목록을 비워서 낸다.** `createNode` 는 만든 노드를 부모의 children
      // 끝에 붙이므로, 원본의 목록을 그대로 실어 보내면 자식의 createNode 가
      // 한 번 더 붙여 목록이 두 배가 된다. 비워 두면 자손들이 순서대로 채운다.
      commands.push({
        type: "createNode",
        parentId: newParentId,
        id: newId,
        node: { ...source, children: [] },
      });
      for (const child of source.children) {
        stack.push({ oldId: child.node, newParentId: newId });
      }
    } else {
      commands.push({ type: "createNode", parentId: newParentId, id: newId, node: source });
    }
  }

  return { commands, newRootId };
}

/**
 * 복제한 덩어리를 원본 **바로 뒤**로 옮기는 Command. 옮길 곳이 없으면 null.
 *
 * `createNode` 는 자식 목록 끝에 붙인다. 카드 세 장 중 가운데를 복제했는데
 * 사본이 맨 뒤로 가면 눈으로 쫓기 어렵다 — 같은 트랜잭션 안에서 한 칸 옮기면
 * Undo 는 여전히 한 단계다.
 */
export function placeAfterCommand(
  nodes: Record<NodeId, Node>,
  parentId: NodeId,
  originalId: NodeId,
  newId: NodeId,
): Command | null {
  const parent = nodes[parentId];
  if (!isFrame(parent)) return null;

  const index = parent.children.findIndex((child) => child.node === originalId);
  if (index < 0) return null;

  return { type: "moveNode", id: newId, newParentId: parentId, index: index + 1 };
}
