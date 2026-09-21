import type { FrameNode, Node, NodeId, ScreenSpec } from "@/features/editor/schema";
import { generateNodeIds } from "@/features/editor/store/nodeId";
import { setByPath } from "@/features/editor/store/path";

import { isEditableNodePath, isEditableScreenPath } from "./editablePath";
import type { Command, CreateNodeCommand, DeleteNodeCommand, MoveNodeCommand, SetLayoutCommand, UpdateNodeCommand, UpdateScreenCommand } from "./types";

function isFrameNode(node: Node): node is FrameNode {
  return node.type === "frame";
}

function withNodes(screen: ScreenSpec, nodes: Record<NodeId, Node>): ScreenSpec {
  return { ...screen, nodes };
}

/**
 * `apply*` 함수 하나의 결과 — 바뀐(또는 안 바뀐) 화면과, 안 바뀌었다면 왜인지.
 *
 * 이유는 호출부가 같은 조건을 다시 재서 따로 뽑지 않고 판정이 실제로 일어나는
 * 이 자리에서 함께 낸다(docs/08-natural-language.md 4.2·8절 5번의 "정할 것" —
 * Command Engine 안에 두는 쪽을 택했다). 조건이 두 곳(여기와 호출부)에 있으면
 * 하나만 고치고 잊는 순간 이유 문자열이 실제 판정과 조용히 어긋난다.
 */
interface ApplyResult {
  screen: ScreenSpec;
  /** no-op이면 이유, 실제로 바뀌었으면 undefined. */
  reason?: string;
}

function applied(screen: ScreenSpec): ApplyResult {
  return { screen };
}

function noOp(screen: ScreenSpec, reason: string): ApplyResult {
  return { screen, reason };
}

/**
 * children 참조로 targetId를 갖고 있는 frame의 id. 없으면 undefined(= root이거나 고아).
 *
 * export하는 이유는 ui/layerDrop.ts의 collectSubtreeIds와 같다 — 복제(#151)가
 * 원본의 부모·순서를 알아야 그 바로 뒤에 끼워 넣을 수 있다.
 */
export function findParentId(
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
 * ui/layerDrop.ts(#123)도 레이어 트리 드래그의 순환 방지에 그대로 재사용한다.
 */
export function collectSubtreeIds(nodes: Record<NodeId, Node>, id: NodeId): Set<NodeId> {
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

function applyCreateNode(screen: ScreenSpec, command: CreateNodeCommand): ApplyResult {
  const { nodes } = screen;
  const parent = nodes[command.parentId];
  if (parent === undefined) {
    return noOp(screen, `parentId '${command.parentId}'가 없습니다`);
  }
  if (!isFrameNode(parent)) {
    return noOp(screen, `parentId '${command.parentId}'가 frame이 아닙니다`);
  }
  // 이미 있는 id는 덮어쓰지 않는다 — 호출자가 store/nodeId.ts의 generateNodeId로
  // 겹치지 않는 id를 먼저 만들어서 넘겨야 한다.
  if (Object.prototype.hasOwnProperty.call(nodes, command.id)) {
    return noOp(screen, `id '${command.id}'가 이미 있습니다`);
  }

  const nextNodes: Record<NodeId, Node> = {
    ...nodes,
    [command.parentId]: {
      ...parent,
      children: [...parent.children, { node: command.id }],
    },
    [command.id]: command.node,
  };

  return applied(withNodes(screen, nextNodes));
}

function applyUpdateNode(screen: ScreenSpec, command: UpdateNodeCommand): ApplyResult {
  const { nodes } = screen;
  const node = nodes[command.id];
  if (node === undefined) {
    return noOp(screen, `id '${command.id}'가 없습니다`);
  }
  // 대상이 있는지와 같은 무게로 경로도 본다(#146) — setByPath는 없는 키를 새로
  // 만들어서, 검사 없이 부르면 오타가 no-op이 아니라 스키마에 없는 필드가 된다.
  // 노드를 통째로 넘긴다: 경로 이름만이 아니라 "지금 값 위에 써도 결과가 스키마를
  // 만족하는가"까지 보기 때문이다(PR #147 리뷰).
  if (!isEditableNodePath(node, command.path)) {
    return noOp(screen, `path '${command.path}'는 이 노드에 쓸 수 없습니다`);
  }

  const nextNode = setByPath(node, command.path, command.value);
  return applied(withNodes(screen, { ...nodes, [command.id]: nextNode }));
}

function applyDeleteNode(screen: ScreenSpec, command: DeleteNodeCommand): ApplyResult {
  const { nodes, root } = screen;
  if (command.id === root) {
    return noOp(screen, "root는 지울 수 없습니다"); // root-missing이 된다
  }
  if (nodes[command.id] === undefined) {
    return noOp(screen, `id '${command.id}'가 없습니다`);
  }

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

  return applied(withNodes(screen, nextNodes));
}

function applyMoveNode(screen: ScreenSpec, command: MoveNodeCommand): ApplyResult {
  const { nodes, root } = screen;
  if (command.id === root) {
    return noOp(screen, "root는 옮길 수 없습니다");
  }

  const node = nodes[command.id];
  if (node === undefined) {
    return noOp(screen, `id '${command.id}'가 없습니다`);
  }
  const newParent = nodes[command.newParentId];
  if (newParent === undefined) {
    return noOp(screen, `newParentId '${command.newParentId}'가 없습니다`);
  }
  if (!isFrameNode(newParent)) {
    return noOp(screen, `newParentId '${command.newParentId}'가 frame이 아닙니다`);
  }

  // 자기 자신이나 자기 자손 밑으로는 옮길 수 없다 — cycle이 생긴다.
  const subtree = collectSubtreeIds(nodes, command.id);
  if (subtree.has(command.newParentId)) {
    return noOp(screen, `id '${command.id}'를 자기 자신이나 자손 밑으로 옮길 수 없습니다`);
  }

  const oldParentId = findParentId(nodes, command.id);
  let nextNodes = nodes;
  if (oldParentId !== undefined) {
    nextNodes = removeChildReference(nextNodes, oldParentId, command.id);
  }
  nextNodes = insertChildReference(nextNodes, command.newParentId, command.id, command.index);

  return applied(withNodes(screen, nextNodes));
}

function applySetLayout(screen: ScreenSpec, command: SetLayoutCommand): ApplyResult {
  const { nodes } = screen;
  const node = nodes[command.id];
  if (node === undefined) {
    return noOp(screen, `id '${command.id}'가 없습니다`);
  }
  if (!isFrameNode(node)) {
    // text/image/button/input은 layout이 없다
    return noOp(screen, `id '${command.id}'는 frame이 아니라 layout이 없습니다`);
  }

  return applied(withNodes(screen, { ...nodes, [command.id]: { ...node, layout: command.layout } }));
}

function applyUpdateScreen(screen: ScreenSpec, command: UpdateScreenCommand): ApplyResult {
  if (!isEditableScreenPath(screen, command.path)) {
    // applyUpdateNode와 같은 이유(#146)
    return noOp(screen, `path '${command.path}'는 화면에 쓸 수 없습니다`);
  }

  return applied(setByPath(screen, command.path, command.value));
}

/**
 * Command 하나를 화면(ScreenSpec) 하나에 적용해 새 화면과, no-op이면 그 이유를
 * 반환한다(불변, 순수 함수). `applyCommand`가 이 함수의 `.screen`만 꺼낸 얇은
 * 래퍼다 — 이유까지 필요한 호출부(dry-run, docs/08-natural-language.md 4.2 G2)는
 * 이 함수를 직접 쓴다.
 *
 * v0.1의 VisualSpec.screen이든 v0.2 ProjectSpec.pages[id]든 같은 ScreenSpec
 * 모양이라 이 함수 하나로 둘 다 쓴다 — 어느 페이지에 적용할지는 호출자(editorStore)
 * 책임이다. 이 함수 자신은 "페이지가 여러 장"이라는 개념을 아예 모른다.
 *
 * 대상이 없거나 규칙을 어기면(root 삭제/이동, frame 아닌 곳에 자식 추가, 순환,
 * 스키마에 없는 경로 등) 아무것도 하지 않고 같은 screen 참조를 그대로 돌려준다
 * — 예외를 던지지 않는다.
 * IR 불변조건(schema/validate.ts의 root-missing/orphan-node/cycle/multiple-parents)을
 * 깨는 조합은 애초에 만들어지지 않도록 여기서 막는다.
 */
export function applyCommandWithReason(screen: ScreenSpec, command: Command): ApplyResult {
  switch (command.type) {
    case "createNode":
      return applyCreateNode(screen, command);
    case "updateNode":
      return applyUpdateNode(screen, command);
    case "deleteNode":
      return applyDeleteNode(screen, command);
    case "moveNode":
      return applyMoveNode(screen, command);
    case "setLayout":
      return applySetLayout(screen, command);
    case "updateScreen":
      return applyUpdateScreen(screen, command);
  }
}

/** `applyCommandWithReason`에서 화면만 꺼낸다 — 이유가 필요 없는 기존 호출부 전부가 쓴다. */
export function applyCommand(screen: ScreenSpec, command: Command): ScreenSpec {
  return applyCommandWithReason(screen, command).screen;
}

/**
 * Command 여러 개를 순서대로 적용한다. 자연어 요청 하나가 낳은 Transaction을
 * 통째로 적용할 때 쓴다 — 결과를 history.pushHistory에 한 번만 넘기면
 * PRD 13장이 요구하는 "요청 하나 = Undo 한 번" 트랜잭션이 된다.
 */
export function applyTransaction(screen: ScreenSpec, commands: Command[]): ScreenSpec {
  return commands.reduce((current, command) => applyCommand(current, command), screen);
}

/**
 * 서브트리 하나(노드 자신 + 자손)를 id→Node 맵으로 담은 것.
 * 복제·클립보드(#151)가 "붙여넣을 내용"을 들고 다니는 모양이다.
 */
export interface NodeSubtree {
  rootId: NodeId;
  nodes: Record<NodeId, Node>;
}

/**
 * `sourceId`(+ 그 자손 전체)를 새 id로 복제하는 Command 묶음을 만든다(#151).
 * 대상이 없으면 null.
 *
 * **복제(원본과 같은 문서)와 붙여넣기(클립보드에서 온, 원본 id가 이제는 의미
 * 없는 서브트리)를 같은 함수로 푼다** — `sourceNodes`(서브트리 데이터·부모-자식
 * 관계를 읽을 곳)와 `liveNodes`(새 id가 겹치면 안 되는 대상 문서)를 따로 받는다.
 * 복제는 둘이 같은 맵이고, 붙여넣기는 `sourceNodes`가 클립보드의 작은 맵이다.
 *
 * 새 id가 여러 개 필요해 `generateNodeIds`(#151)로 한 번에 뽑는다 — 반복
 * 호출은 두 노드가 같은 빈 번호를 받을 수 있다(store/nodeId.ts 주석 참고).
 *
 * `collectSubtreeIds`가 Set에 부모를 자식보다 먼저 넣으므로(visit이 그 순서로
 * 쌓는다) 그 순서 그대로 createNode Command를 만든다 — 자식 Command가 가리킬
 * 새 부모가 그 시점에 이미 만들어져 있어야 한다(applyCreateNode는 부모가 없으면
 * no-op이다).
 *
 * createNode는 항상 자식 배열 끝에 붙으므로(applyCreateNode), 복제 루트를
 * 원하는 자리(`insertIndex`)에 놓는 moveNode Command를 마지막에 하나 더 둔다.
 * **새 Command 타입은 필요 없다** — 기존 createNode·moveNode의 조합이다.
 */
export function buildDuplicateCommands(
  sourceNodes: Record<NodeId, Node>,
  sourceId: NodeId,
  liveNodes: Record<NodeId, Node>,
  parentId: NodeId,
  insertIndex: number,
): { commands: Command[]; newRootId: NodeId } | null {
  if (sourceNodes[sourceId] === undefined) return null;

  const subtreeIds = [...collectSubtreeIds(sourceNodes, sourceId)];
  const newIds = generateNodeIds(
    subtreeIds.map((id) => sourceNodes[id].type),
    liveNodes,
  );
  const idMap = new Map(subtreeIds.map((oldId, i) => [oldId, newIds[i]]));

  const commands: Command[] = subtreeIds.map((oldId) => {
    const original = sourceNodes[oldId];
    const newId = idMap.get(oldId) as NodeId;
    // frame이면 children을 비운 채로 만든다 — applyCreateNode가 각 자식의
    // createNode Command를 적용할 때마다 새 부모의 children 끝에 자기 자신을
    // 스스로 추가한다(부모가 자식보다 먼저 만들어지는 순서 덕분에 가능하다).
    // 여기서 미리 채워 넣으면 그 자동 추가와 겹쳐 자식이 두 번씩 들어간다.
    const clonedNode: Node = isFrameNode(original)
      ? { ...original, children: [] }
      : { ...original };

    const newParentId =
      oldId === sourceId
        ? parentId
        : (idMap.get(findParentId(sourceNodes, oldId) as NodeId) as NodeId);

    return { type: "createNode", parentId: newParentId, id: newId, node: clonedNode };
  });

  const newRootId = idMap.get(sourceId) as NodeId;
  commands.push({ type: "moveNode", id: newRootId, newParentId: parentId, index: insertIndex });

  return { commands, newRootId };
}
