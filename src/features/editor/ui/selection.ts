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

/**
 * `resolveClickTarget`에 넘길 `root`를 정한다 — 더블클릭으로 들어간 프레임
 * (`focusRootId`)이 있으면 그걸 경계로, 없으면 진짜 root를 경계로 쓴다(#151).
 *
 * **`focusRootId`가 있어도 `clickedId`가 그 서브트리 밖이면 진짜 root로
 * 물러난다.** `topLevelAncestor`는 부모를 거슬러 올라가다 경계를 못 만나면
 * 끝까지(진짜 root까지) 오른다 — 문맥 밖의 형제 가지를 클릭했을 때 이 경로를
 * 타면 "문서 전체"가 잡혀 버린다(카드 안에 들어가 있는데 헤더를 클릭했더니
 * 페이지 전체가 선택되는 것과 같다). 이슈가 정한 문맥 이탈 트리거는
 * Esc·바깥 클릭·페이지 전환 셋뿐이고 "다른 가지를 클릭"은 그중 하나가
 * 아니다 — 그래서 문맥을 벗어나는 게 아니라 "문맥이 원래 못 미치는 곳"으로
 * 보고, 문맥이 없을 때와 같은 결과(진짜 root 경계)로 돌려보낸다.
 */
export function clickBoundary(
  nodes: NodeMap,
  root: NodeId,
  focusRootId: NodeId | null,
  clickedId: NodeId,
): NodeId {
  if (focusRootId === null) return root;
  if (focusRootId === clickedId) return focusRootId;

  const parents = buildParentMap(nodes);
  const seen = new Set<NodeId>();
  let current: NodeId | undefined = clickedId;

  while (current !== undefined && !seen.has(current)) {
    if (current === focusRootId) return focusRootId;
    seen.add(current);
    current = parents.get(current);
  }

  return root;
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

/**
 * 같은 부모 안에서 다음(`"next"`) · 이전(`"prev"`) 형제 id(#151, `Tab`/`Shift+Tab`).
 * 대상이 없으면(root거나 고아라 부모가 없는 경우, 또는 부모가 지금 스펙에
 * 없거나 frame이 아닌 깨진 경우) null.
 *
 * **`focusRootId`(진입 문맥)를 보지 않는다.** 형제는 지금 선택된 노드의
 * 실제 트리 부모로만 정해지는 사실이라 — 진입 여부가 무엇을 클릭이 고를지는
 * 바꿔도 이미 고른 다음의 "누가 형제인가"는 바꾸지 않는다.
 *
 * 끝에서는 반대쪽 끝으로 **순환한다** — 멈추면 "다음이 없다"는 신호가 없어
 * 눌러도 반응이 없는 것처럼 보인다. 형제가 자기 하나뿐이면 자기 자신을 돌려준다.
 */
export function siblingId(
  nodes: NodeMap,
  id: NodeId,
  direction: "next" | "prev",
): NodeId | null {
  const parentId = buildParentMap(nodes).get(id);
  if (parentId === undefined) return null;

  const parent = nodes[parentId];
  if (parent === undefined || parent.type !== "frame") return null;

  const siblings = parent.children.map((child) => child.node);
  const index = siblings.indexOf(id);
  if (index === -1) return null;

  const delta = direction === "next" ? 1 : -1;
  return siblings[(index + delta + siblings.length) % siblings.length];
}
