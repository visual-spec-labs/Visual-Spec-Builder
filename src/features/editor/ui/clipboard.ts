import { collectSubtreeIds, type NodeSubtree } from "@/features/editor/command/applyCommand";
import type { Node, NodeId } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";

import { resolveInsertParent } from "./selection";

/**
 * 앱 안 클립보드(#151) — 시스템 클립보드를 안 쓴다.
 *
 * 시스템 클립보드로 가면 다른 탭·문서 사이에 붙여넣을 수 있어 좋지만, JSON
 * 직렬화와 신뢰 경계 문제가 함께 온다(이슈 논의, security-review 참고). 지금은
 * 앱 안에서만 도는 가장 작은 형태로 시작한다.
 *
 * "복사됨" 표시가 화면에 없어 렌더에 반영할 상태가 아니다 — Zustand로 두지 않고
 * 모듈 전역 변수로 둔다. canvasOverlays.ts의 `lastRef`와 같은 성격이다.
 */
let clipboard: NodeSubtree | null = null;

/** 클립보드에 뭔가 있는가. `Ctrl+V`를 받을지 canvasInput.ts가 미리 물어본다. */
export function hasClipboard(): boolean {
  return clipboard !== null;
}

/** 노드(와 그 자손)를 클립보드에 담는다. `Ctrl+C`가 부른다. */
export function copySelection(nodes: Record<NodeId, Node>, id: NodeId): void {
  const source = nodes[id];
  if (source === undefined) return;

  const picked: Record<NodeId, Node> = {};
  for (const subId of collectSubtreeIds(nodes, id)) {
    picked[subId] = nodes[subId];
  }
  // structuredClone: 스키마가 JSON-safe 값만 쓰므로 안전하다. 나중에 store의
  // nodes를 편집해도 클립보드에 남긴 스냅숏이 함께 바뀌지 않아야 한다.
  clipboard = structuredClone({ rootId: id, nodes: picked });
}

/**
 * 클립보드 내용을 지금 선택 기준으로 붙여넣는다. `Ctrl+V`가 부른다.
 *
 * 붙여넣을 위치는 새 규칙을 만들지 않고 `resolveInsertParent`를 그대로
 * 쓴다 — F/T 도구가 새 노드를 놓을 때(선택된 프레임 안, 없으면 가장 가까운
 * 조상 프레임, 그것도 없으면 root) 쓰는 것과 같은 규칙이다.
 */
export function pasteClipboard(): void {
  if (clipboard === null) return;

  const { spec, activePageId, selectedId, pasteNode } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];
  const parentId = resolveInsertParent({ nodes, root, clickedId: selectedId ?? root });

  pasteNode(structuredClone(clipboard), parentId);
}
