import { collectSubtreeIds, findParentId } from "@/features/editor/command/applyCommand";
import type { FrameNode, Layout, Node, NodeId } from "@/features/editor/schema";

import { groupIntoBands } from "./gapStrips";
import type { Rect } from "./selectionRect";

export interface CanvasDropInput {
  nodes: Record<NodeId, Node>;
  rootId: NodeId;
  /** 드래그 중인 노드. */
  dragId: NodeId;
  /** 커서 위치. rects와 같은 좌표계여야 한다. */
  point: { x: number; y: number };
  /**
   * 노드별 사각형. 오버레이와 같은 기준(확대되지 않은 바깥 상자)의 화면 px을 넘기면
   * 인디케이터를 그대로 그릴 수 있다. 렌더되지 않은 노드(visible: false)는 빠져 있어도 된다.
   */
  rects: Record<NodeId, Rect>;
}

export interface CanvasDropTarget {
  newParentId: NodeId;
  /** moveNode에 그대로 넘길 값 — 드래그 노드를 뺀 형제 목록 기준이라 보정이 필요 없다. */
  index: number;
  /** 삽입선(얇은 사각형) 또는 빈 프레임 강조 영역. rects와 같은 좌표계. */
  indicator: Rect;
  /** 지금 자리와 같다 — 호출부가 커밋을 생략한다. */
  unchanged: boolean;
}

/** 삽입선 두께(화면 px). gapStrips의 막대처럼 확대되지 않는 바깥 상자에 그려 배율을 타지 않는다. */
const INDICATOR_THICKNESS = 2;

/**
 * 자식 frame의 가장자리 띠 두께 — 부모 주축 방향 크기에 대한 비율과 상한(화면 px).
 *
 * 카드처럼 자식 frame이 부모를 거의 다 덮으면 커서가 늘 어느 카드 "안"에 있게 되어,
 * 안으로 들어가는 판정만 남고 카드끼리 순서를 바꿀 길이 없어진다. 그래서 양 끝 띠에서는
 * 그 frame 안으로 들어가지 않고 부모 안의 앞/뒤 자리로 본다.
 *
 * - 25%: 양쪽 띠를 합쳐 절반, 가운데 절반은 "안으로 넣기"로 남는다. 두 동작이 같은
 *   넓이를 갖는 가장 단순한 나눔이다.
 * - 상한 24px: 화면을 거의 채우는 큰 섹션 frame이면 25%가 수백 px이 되어 안으로 넣기가
 *   어려워진다. 커서로 노리기 편한 폭(Figma의 리오더 감도와 비슷한 수준)에서 멈춘다.
 */
const EDGE_BAND_RATIO = 0.25;
const EDGE_BAND_MAX_PX = 24;

/**
 * 삽입 위치를 고르는 축.
 *
 * grid는 열이 1개(columns 생략 포함)면 세로 배치와 똑같이 보이므로 column으로 다룬다 —
 * 줄마다 자식이 하나뿐이라 "같은 줄 안에서 x로 비교"하면 커서의 좌우 위치로 앞/뒤가
 * 갈려 위아래로 쌓인 모양과 어긋난다.
 */
type DropAxis = "row" | "column" | "grid";

/** 판정에 쓰는 형제 하나. `order`는 드래그 노드를 뺀 형제 목록에서의 위치다. */
interface Sibling extends Rect {
  id: NodeId;
  order: number;
}

/**
 * 캔버스에서 드래그 중인 노드를 point에 놓았을 때 moveNode에 넘길 (부모, 위치)와
 * 드롭 인디케이터를 정하는 순수 판정기(#187). 레이어 트리 쪽 선례는 layerDrop.ts(#123)다.
 * React/DOM에 의존하지 않아 단위 테스트로 직접 검증한다.
 *
 * 스키마에 x/y가 없어(v0.1은 Auto Layout 전용, docs/06) "놓은 좌표"가 아니라 "몇 번째
 * 자리인가"를 정한다.
 *
 * 1. 컨테이너 = point를 품은 가장 깊은 frame. frame이 아닌 노드 위면 그 부모 frame이다.
 *    드래그 노드의 서브트리는 후보에서 뺀다(순환 방지 — collectSubtreeIds로 moveNode와
 *    기준을 맞춘다). 바깥부터 내려가며, 자식 frame이라도 부모 주축 방향의 가장자리 띠
 *    안이면 그 안으로 들어가지 않는다(EDGE_BAND_RATIO 참고).
 * 2. 컨테이너 안에서 드래그 노드를 뺀 형제들의 중심과 비교해 자리를 정한다. row는 x,
 *    column은 y, grid는 줄로 묶어 커서가 속한(없으면 가장 가까운) 줄 안에서 x로 본다.
 *
 * root를 끌거나, point가 root 밖이거나, root 사각형이 없으면 null이다.
 */
export function resolveCanvasDrop({
  nodes,
  rootId,
  dragId,
  point,
  rects,
}: CanvasDropInput): CanvasDropTarget | null {
  if (dragId === rootId || nodes[dragId] === undefined) return null;

  const root = nodes[rootId];
  const rootRect: Rect | undefined = rects[rootId];
  if (root === undefined || root.type !== "frame") return null;
  if (rootRect === undefined || !contains(rootRect, point)) return null;

  const excluded = collectSubtreeIds(nodes, dragId);
  const containerId = findContainer(nodes, rootId, excluded, point, rects);
  const container = nodes[containerId] as FrameNode;

  // moveNode는 옛 부모에서 먼저 빼고 새 부모에 꽂는다. 드래그 노드를 미리 뺀 목록에서
  // 자리를 세면 같은 부모 안에서 옮길 때의 한 칸 보정(layerDrop.ts)이 필요 없다.
  const order = container.children.map((child) => child.node).filter((id) => id !== dragId);
  const siblings = measuredSiblings(order, rects);

  const placement =
    siblings.length === 0
      ? // 보이는 형제가 없으면 자리를 가를 기준이 없다 — 끝에 붙이고 frame 전체를 강조한다.
        { index: order.length, indicator: rects[containerId] }
      : placeAmong(siblings, point, dropAxis(container.layout));

  const currentParentId = findParentId(nodes, dragId);
  const currentIndex =
    currentParentId === undefined
      ? -1
      : (nodes[currentParentId] as FrameNode).children.findIndex((child) => child.node === dragId);

  return {
    newParentId: containerId,
    index: placement.index,
    indicator: placement.indicator,
    unchanged: currentParentId === containerId && currentIndex === placement.index,
  };
}

/** root에서 출발해 point를 품은 자식 frame으로 내려간다. 더 못 내려가면 거기가 컨테이너다. */
function findContainer(
  nodes: Record<NodeId, Node>,
  rootId: NodeId,
  excluded: ReadonlySet<NodeId>,
  point: { x: number; y: number },
  rects: Record<NodeId, Rect>,
): NodeId {
  let containerId = rootId;
  // 잘못된 문서(자식 참조가 순환)에서도 멈추도록 지나온 frame을 기억한다.
  const visited = new Set<NodeId>([rootId]);

  for (;;) {
    const container = nodes[containerId] as FrameNode;
    const hitId = childAtPoint(container, excluded, point, rects);
    if (hitId === null || visited.has(hitId)) return containerId;

    const hit = nodes[hitId];
    if (hit === undefined || hit.type !== "frame") return containerId;
    if (inEdgeBand(rects[hitId], point, dropAxis(container.layout))) return containerId;

    visited.add(hitId);
    containerId = hitId;
  }
}

/**
 * point를 품은 자식. 드래그 서브트리와 사각형이 없는 자식은 건너뛴다.
 * 겹치면(음수 gap 등) 나중 자식이 위에 그려지므로 뒤에서부터 찾는다.
 */
function childAtPoint(
  container: FrameNode,
  excluded: ReadonlySet<NodeId>,
  point: { x: number; y: number },
  rects: Record<NodeId, Rect>,
): NodeId | null {
  for (let i = container.children.length - 1; i >= 0; i -= 1) {
    const id = container.children[i].node;
    const rect: Rect | undefined = rects[id];
    if (excluded.has(id) || rect === undefined) continue;
    if (contains(rect, point)) return id;
  }
  return null;
}

/** point가 rect의 부모 주축 방향 양 끝 띠 안인가. grid는 줄 안에서 x로 비교하므로 가로 끝을 본다. */
function inEdgeBand(rect: Rect, point: { x: number; y: number }, axis: DropAxis): boolean {
  const horizontal = axis !== "column";
  const start = horizontal ? rect.left : rect.top;
  const size = horizontal ? rect.width : rect.height;
  const at = horizontal ? point.x : point.y;
  const band = Math.min(size * EDGE_BAND_RATIO, EDGE_BAND_MAX_PX);
  return at < start + band || at > start + size - band;
}

/**
 * 사각형이 있는 형제만 남긴다. 없는 형제(숨김 등)는 비교에서 빠지지만 `order`에는
 * 원래 자리가 그대로 남아 index 계산에 들어간다.
 */
function measuredSiblings(order: readonly NodeId[], rects: Record<NodeId, Rect>): Sibling[] {
  const siblings: Sibling[] = [];
  order.forEach((id, index) => {
    const rect: Rect | undefined = rects[id];
    if (rect === undefined) return;
    // 새 객체로 만든다 — groupIntoBands가 객체를 그대로 담아 돌려주므로 꼬리표가 따라온다.
    siblings.push({ ...rect, id, order: index });
  });
  return siblings;
}

function placeAmong(
  siblings: readonly Sibling[],
  point: { x: number; y: number },
  axis: DropAxis,
): { index: number; indicator: Rect } {
  if (axis !== "grid") return placeInLine(siblings, point, axis === "row");

  const band = nearestBand(groupIntoBands(siblings), point.y);
  // 줄 안은 읽기 순서(왼쪽→오른쪽)다.
  return placeInLine([...band].sort((a, b) => a.left - b.left), point, true);
}

/**
 * 한 줄로 늘어선 형제 사이의 자리. point가 중심보다 앞이면 그 형제 앞이다.
 *
 * index는 "바로 앞 형제 다음"으로 센다(맨 앞이면 첫 형제 자리). 사이에 사각형이 없는
 * 형제가 끼어 있으면 그 형제는 새 노드 뒤로 밀린다 — 보이는 앞 형제에 붙는 쪽이 놓은
 * 자리와 가깝다.
 */
function placeInLine(
  line: readonly Sibling[],
  point: { x: number; y: number },
  horizontal: boolean,
): { index: number; indicator: Rect } {
  const at = horizontal ? point.x : point.y;
  const before = line.findIndex((s) =>
    horizontal ? at < s.left + s.width / 2 : at < s.top + s.height / 2,
  );
  const slot = before === -1 ? line.length : before;

  const prev: Sibling | undefined = line[slot - 1];
  const next: Sibling | undefined = line[slot];
  const index = prev === undefined ? line[0].order : prev.order + 1;

  return { index, indicator: insertionLine(prev, next, horizontal) };
}

/**
 * 두 형제 사이 틈의 가운데에 긋는 선. 한쪽이 없으면(처음/끝) 남은 형제의 바깥 모서리에
 * 긋는다. 가로 배치면 세로선, 세로 배치면 가로선이고, 길이는 두 형제의 교차축 범위를 덮는다.
 */
function insertionLine(prev: Rect | undefined, next: Rect | undefined, horizontal: boolean): Rect {
  const present = [prev, next].filter((r): r is Rect => r !== undefined);

  if (horizontal) {
    const x =
      prev !== undefined && next !== undefined
        ? (prev.left + prev.width + next.left) / 2
        : prev !== undefined
          ? prev.left + prev.width
          : present[0].left;
    const top = Math.min(...present.map((r) => r.top));
    const bottom = Math.max(...present.map((r) => r.top + r.height));
    return { left: x - INDICATOR_THICKNESS / 2, top, width: INDICATOR_THICKNESS, height: bottom - top };
  }

  const y =
    prev !== undefined && next !== undefined
      ? (prev.top + prev.height + next.top) / 2
      : prev !== undefined
        ? prev.top + prev.height
        : present[0].top;
  const left = Math.min(...present.map((r) => r.left));
  const right = Math.max(...present.map((r) => r.left + r.width));
  return { left, top: y - INDICATOR_THICKNESS / 2, width: right - left, height: INDICATOR_THICKNESS };
}

/** y가 속한 줄. 줄 사이 틈이나 위아래 여백이면 세로 거리가 가장 가까운 줄(같으면 위 줄). */
function nearestBand<T extends Rect>(bands: readonly T[][], y: number): T[] {
  let best = bands[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const band of bands) {
    const top = Math.min(...band.map((r) => r.top));
    const bottom = Math.max(...band.map((r) => r.top + r.height));
    const distance = y < top ? top - y : y > bottom ? y - bottom : 0;
    if (distance < bestDistance) {
      best = band;
      bestDistance = distance;
    }
  }
  return best;
}

function dropAxis(layout: Layout): DropAxis {
  if (layout.direction === "grid") return (layout.columns ?? 1) > 1 ? "grid" : "column";
  return layout.direction;
}

function contains(rect: Rect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}
