import type { Node, NodeId } from "@/features/editor/schema";

/**
 * 캔버스 클릭 지점을 "어떤 노드를 대상으로 삼을지"로 옮기는 순수 해석기.
 *
 * DOM 이벤트는 항상 가장 안쪽 요소에서 시작하므로(중첩된 자식이 부모를 덮는다),
 * 클릭한 노드 id 하나만으로는 사용자가 무엇을 고르려 했는지 알 수 없다.
 * 여기서 도구·수식키에 따라 대상을 다시 정한다. React에 의존하지 않아
 * 단위 테스트로 직접 검증할 수 있다.
 */
export type NodeMap = Record<string, Node>;

/**
 * child id → parent id 역맵.
 * 스펙은 부모가 자식을 가리키는 방향으로만 저장하므로, 조상을 거슬러 오르려면
 * 이 맵이 필요하다.
 */
export function buildParentMap(nodes: NodeMap): Map<NodeId, NodeId> {
  const parents = new Map<NodeId, NodeId>();

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    for (const child of node.children) {
      // 부모가 둘인 스펙(검증기가 multiple-parents로 잡는다)이 들어와도
      // 해석이 흔들리지 않도록 먼저 만난 부모를 유지한다.
      if (!parents.has(child.node)) {
        parents.set(child.node, id);
      }
    }
  }

  return parents;
}

/** root 바로 아래에 있는 최상위 조상. clickedId가 root면 root 자신. */
function topLevelAncestor(
  parents: Map<NodeId, NodeId>,
  root: NodeId,
  clickedId: NodeId,
): NodeId {
  if (clickedId === root) return root;

  const seen = new Set<NodeId>([clickedId]);
  let current = clickedId;

  for (;;) {
    const parent = parents.get(current);
    // 부모가 없으면(고아 노드) 더 오를 곳이 없고, 부모가 root면 여기가 최상위다.
    // 순환 스펙에서도 같은 노드를 두 번 밟는 순간 멈춘다.
    if (parent === undefined || parent === root || seen.has(parent)) {
      return current;
    }
    seen.add(parent);
    current = parent;
  }
}

export interface ClickTargetInput {
  nodes: NodeMap;
  root: NodeId;
  /** DOM 이벤트가 실제로 시작된 노드 — 언제나 가장 안쪽 노드다. */
  clickedId: NodeId;
  /** Cmd(macOS) / Ctrl(Windows)를 누른 클릭인지. 상세 지정 여부. */
  deep: boolean;
}

/**
 * 클릭 대상 노드를 정한다.
 * - 일반 클릭: root 바로 아래 최상위 조상 (그룹 단위로 잡는다)
 * - Cmd/Ctrl+클릭: 실제로 클릭한 최하위 노드 (중첩 안쪽을 상세 지정한다)
 */
export function resolveClickTarget({
  nodes,
  root,
  clickedId,
  deep,
}: ClickTargetInput): NodeId {
  if (nodes[clickedId] === undefined) return root;
  if (deep) return clickedId;
  return topLevelAncestor(buildParentMap(nodes), root, clickedId);
}

export interface InsertParentInput {
  nodes: NodeMap;
  root: NodeId;
  clickedId: NodeId;
}

/**
 * 새 노드를 넣을 부모 프레임. 클릭한 노드가 프레임이면 그 안에, 텍스트면
 * 가장 가까운 조상 프레임에 넣는다. 텍스트는 자식을 가질 수 없기 때문이다.
 */
export function resolveInsertParent({
  nodes,
  root,
  clickedId,
}: InsertParentInput): NodeId {
  const parents = buildParentMap(nodes);
  const seen = new Set<NodeId>();
  let current: NodeId | undefined = clickedId;

  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (nodes[current]?.type === "frame") return current;
    current = parents.get(current);
  }

  return root;
}
