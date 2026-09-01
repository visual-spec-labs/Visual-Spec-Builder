import type { NodeId, VisualSpec } from "@/features/editor/schema";

/**
 * Import로 가져온 노드를 붙일 부모를 정한다(순수 함수, 테스트 대상).
 * 선택된 노드가 frame이면 그 안에, 아니면(선택 없음 · text/image 선택 중)
 * 화면 root에 붙인다. root는 스키마상 항상 frame이다.
 */
export function resolveImportParent(
  spec: VisualSpec,
  selectedId: NodeId | null,
): NodeId {
  const selectedNode = selectedId === null ? undefined : spec.screen.nodes[selectedId];

  if (selectedNode !== undefined && selectedNode.type === "frame") {
    return selectedId as NodeId;
  }

  return spec.screen.root;
}
