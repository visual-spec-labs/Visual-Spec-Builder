import { collectSubtreeIds } from "@/features/editor/command/applyCommand";
import type { Node, NodeId } from "@/features/editor/schema";

export interface ResolveLayerDropInput {
  nodes: Record<NodeId, Node>;
  /** 드래그 중인 노드. */
  dragId: NodeId;
  /** 드래그 중인 노드의 현재 부모. */
  dragParentId: NodeId;
  /** 드롭한 행. */
  targetId: NodeId;
  /** targetId의 부모. targetId가 root면 null — root도 frame이라 "안으로" 분기를 타므로 문제 없다. */
  targetParentId: NodeId | null;
}

export interface LayerDropTarget {
  newParentId: NodeId;
  index: number;
}

/**
 * 레이어 트리 드래그를 targetId 행에 놓았을 때 moveNode에 넘길 (부모, 위치)를 정하는
 * 순수 해석기(#123). React/DOM에 의존하지 않아 단위 테스트로 직접 검증한다.
 *
 * - targetId가 **frame**이면 그 프레임의 자식 끝에 재부모화한다("안으로 넣기").
 *   root도 frame이라 여기로 들어와, 중첩된 노드를 최상위로 옮기는 것도 이 분기로 된다.
 * - frame이 **아니면** 그 노드가 속한 부모 안에서 그 자리로 순서를 바꾼다(#110의 기존 규칙을
 *   그대로 재사용). 그 부모가 dragParentId와 달라도 이제 허용한다 — 결과적으로 그것도
 *   재부모화다(예: 다른 프레임의 자식 옆에 끼워 넣기).
 *
 * 자기 자신이나 자기 자손(frame이면 그 서브트리 전체) 위에 놓는 건 순환이 생기므로 null을
 * 돌려준다. moveNode/applyMoveNode가 실제 적용 시점에 다시 막지만(collectSubtreeIds를
 * 그대로 재사용해 기준을 하나로 맞췄다), 드롭 가능 표시 자체를 안 띄우려면 여기서도 먼저
 * 걸러야 한다.
 */
export function resolveLayerDrop({
  nodes,
  dragId,
  dragParentId,
  targetId,
  targetParentId,
}: ResolveLayerDropInput): LayerDropTarget | null {
  const dragSubtree = collectSubtreeIds(nodes, dragId);
  if (dragSubtree.has(targetId)) return null; // 자기 자신도 이 집합에 포함된다

  const targetNode = nodes[targetId];
  if (targetNode === undefined) return null;

  if (targetNode.type === "frame") {
    return { newParentId: targetId, index: targetNode.children.length };
  }

  if (targetParentId === null) return null; // 이론상 안 나옴 — frame이 아니면 root일 수 없다

  const parent = nodes[targetParentId];
  if (parent === undefined || parent.type !== "frame") return null;

  const toIndex = parent.children.findIndex((child) => child.node === targetId);
  if (toIndex === -1) return null;

  // moveNode는 옛 부모에서 먼저 빼고 새 부모에 꽂는다 — 같은 부모 안에서 옮기면 그
  // 제거로 자기보다 뒤에 있던 자리가 한 칸 당겨지므로, 그만큼 보정해야 "놓은 자리에
  // 정확히 들어간다." 부모가 다르면 제거가 다른 배열에서 일어나 보정이 필요 없다.
  const dragParent = nodes[dragParentId];
  const fromIndex =
    dragParentId === targetParentId && dragParent !== undefined && dragParent.type === "frame"
      ? dragParent.children.findIndex((child) => child.node === dragId)
      : -1;
  const index = fromIndex !== -1 && fromIndex < toIndex ? toIndex - 1 : toIndex;

  return { newParentId: targetParentId, index };
}
