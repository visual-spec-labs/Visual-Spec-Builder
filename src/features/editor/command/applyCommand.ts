import type { FrameNode, Node, NodeId, VisualSpec } from "@/features/editor/schema";
import { setByPath } from "@/features/editor/store/path";

import type { Command, CreateNodeCommand, DeleteNodeCommand, MoveNodeCommand, SetLayoutCommand, UpdateNodeCommand } from "./types";

function isFrameNode(node: Node): node is FrameNode {
  return node.type === "frame";
}

function withNodes(spec: VisualSpec, nodes: Record<NodeId, Node>): VisualSpec {
  return { ...spec, screen: { ...spec.screen, nodes } };
}

/** children 참조로 targetId를 갖고 있는 frame의 id. 없으면 undefined(= root이거나 고아). */
function findParentId(
  nodes: Record<NodeId, Node>,
  targetId: NodeId,
): NodeId | undefined {
  for (const [id, node] of Object.entries(nodes)) {
    if (isFrameNode(node) && node.children.some((child) => child.node === targetId)) {
      return id;
    }
  }
  return undefined;
}

/**
 * id 자신 + 모든 자손의 id 집합.
 * deleteNode의 연쇄 삭제, moveNode의 순환 방지(자기 자신/자손 밑으로 옮기는 것 차단)에 쓴다.
 */
function collectSubtreeIds(nodes: Record<NodeId, Node>, id: NodeId): Set<NodeId> {
  const result = new Set<NodeId>();

  function visit(nodeId: NodeId): void {
    if (result.has(nodeId)) return;
    result.add(nodeId);

    const node = nodes[nodeId];
    if (node !== undefined && isFrameNode(node)) {
      for (const child of node.children) {
        visit(child.node);
      }
    }
  }

  visit(id);
  return result;
}

function removeChildReference(
  nodes: Record<NodeId, Node>,
  parentId: NodeId,
  childId: NodeId,
): Record<NodeId, Node> {
  const parent = nodes[parentId];
  if (parent === undefined || !isFrameNode(parent)) return nodes;

  return {
    ...nodes,
    [parentId]: {
      ...parent,
      children: parent.children.filter((child) => child.node !== childId),
    },
  };
}

function insertChildReference(
  nodes: Record<NodeId, Node>,
  parentId: NodeId,
  childId: NodeId,
  index: number,
): Record<NodeId, Node> {
  const parent = nodes[parentId];
  if (parent === undefined || !isFrameNode(parent)) return nodes;

  const children = [...parent.children];
  const clampedIndex = Math.max(0, Math.min(index, children.length));
  children.splice(clampedIndex, 0, { node: childId });

  return { ...nodes, [parentId]: { ...parent, children } };
}

function applyCreateNode(spec: VisualSpec, command: CreateNodeCommand): VisualSpec {
  const { nodes } = spec.screen;
  const parent = nodes[command.parentId];
  if (parent === undefined || !isFrameNode(parent)) return spec;
  // 이미 있는 id는 덮어쓰지 않는다 — 호출자가 store/nodeId.ts의 generateNodeId로
  // 겹치지 않는 id를 먼저 만들어서 넘겨야 한다.
  if (Object.prototype.hasOwnProperty.call(nodes, command.id)) return spec;

  const nextNodes: Record<NodeId, Node> = {
    ...nodes,
    [command.parentId]: {
      ...parent,
      children: [...parent.children, { node: command.id }],
    },
    [command.id]: command.node,
  };

  return withNodes(spec, nextNodes);
}

function applyUpdateNode(spec: VisualSpec, command: UpdateNodeCommand): VisualSpec {
  const { nodes } = spec.screen;
  const node = nodes[command.id];
  if (node === undefined) return spec;

  const nextNode = setByPath(node, command.path, command.value);
  return withNodes(spec, { ...nodes, [command.id]: nextNode });
}

function applyDeleteNode(spec: VisualSpec, command: DeleteNodeCommand): VisualSpec {
  const { nodes, root } = spec.screen;
  if (command.id === root) return spec; // root는 지울 수 없다 — root-missing이 된다
  if (nodes[command.id] === undefined) return spec;

  const parentId = findParentId(nodes, command.id);
  // 자식까지 함께 지운다. 부모 참조만 지우면 자손이 nodes에 남아 orphan-node가 된다.
  const toRemove = collectSubtreeIds(nodes, command.id);

  let nextNodes = nodes;
  if (parentId !== undefined) {
    nextNodes = removeChildReference(nextNodes, parentId, command.id);
  }
  nextNodes = Object.fromEntries(
    Object.entries(nextNodes).filter(([id]) => !toRemove.has(id)),
  );

  return withNodes(spec, nextNodes);
}

function applyMoveNode(spec: VisualSpec, command: MoveNodeCommand): VisualSpec {
  const { nodes, root } = spec.screen;
  if (command.id === root) return spec; // root는 옮길 수 없다

  const node = nodes[command.id];
  const newParent = nodes[command.newParentId];
  if (node === undefined || newParent === undefined || !isFrameNode(newParent)) {
    return spec;
  }

  // 자기 자신이나 자기 자손 밑으로는 옮길 수 없다 — cycle이 생긴다.
  const subtree = collectSubtreeIds(nodes, command.id);
  if (subtree.has(command.newParentId)) return spec;

  const oldParentId = findParentId(nodes, command.id);
  let nextNodes = nodes;
  if (oldParentId !== undefined) {
    nextNodes = removeChildReference(nextNodes, oldParentId, command.id);
  }
  nextNodes = insertChildReference(nextNodes, command.newParentId, command.id, command.index);

  return withNodes(spec, nextNodes);
}

function applySetLayout(spec: VisualSpec, command: SetLayoutCommand): VisualSpec {
  const { nodes } = spec.screen;
  const node = nodes[command.id];
  if (node === undefined || !isFrameNode(node)) return spec; // text/image는 layout이 없다

  return withNodes(spec, { ...nodes, [command.id]: { ...node, layout: command.layout } });
}

/**
 * Command 하나를 spec에 적용해 새 spec을 반환한다(불변, 순수 함수).
 * 대상이 없거나 규칙을 어기면(root 삭제/이동, frame 아닌 곳에 자식 추가, 순환 등)
 * 아무것도 하지 않고 같은 spec 참조를 그대로 돌려준다 — 예외를 던지지 않는다.
 * IR 불변조건(schema/validate.ts의 root-missing/orphan-node/cycle/multiple-parents)을
 * 깨는 조합은 애초에 만들어지지 않도록 여기서 막는다.
 */
export function applyCommand(spec: VisualSpec, command: Command): VisualSpec {
  switch (command.type) {
    case "createNode":
      return applyCreateNode(spec, command);
    case "updateNode":
      return applyUpdateNode(spec, command);
    case "deleteNode":
      return applyDeleteNode(spec, command);
    case "moveNode":
      return applyMoveNode(spec, command);
    case "setLayout":
      return applySetLayout(spec, command);
  }
}

/**
 * Command 여러 개를 순서대로 적용한다. 자연어 요청 하나가 낳은 Transaction을
 * 통째로 적용할 때 쓴다 — 결과를 history.pushHistory에 한 번만 넘기면
 * PRD 13장이 요구하는 "요청 하나 = Undo 한 번" 트랜잭션이 된다.
 */
export function applyTransaction(spec: VisualSpec, commands: Command[]): VisualSpec {
  return commands.reduce((current, command) => applyCommand(current, command), spec);
}
