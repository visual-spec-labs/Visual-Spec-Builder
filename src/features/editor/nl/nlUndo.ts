/**
 * 자연어 결과 줄의 `[되돌리기]` (#448 B-11).
 *
 * 스토어 `undo`는 선택을 늘 비운다 — 되돌린 트리에 그 노드가 없을 수 있어서다. 자연어 편집은
 * 고른 노드를 그대로 두고 값만 바꾸는 일이 많아, 비우면 되돌린 값을 보려고 노드를 다시 골라야 했다.
 * 그래서 이 버튼은 되돌린 뒤에도 **같은 페이지에 같은 노드가 남아 있을 때만** 선택을 되살린다.
 * 노드가 사라졌거나(추가를 되돌림) 페이지가 바뀌었으면 스토어 원칙대로 비운 채 둔다.
 *
 * 컴포넌트 밖에 둔 이유는 `nlScope.ts`와 같다(vitest environment가 `node`).
 */

import { useEditorStore } from "@/features/editor/store/editorStore";

export function undoNlEdit(): void {
  const before = useEditorStore.getState();
  const keep = before.selectedId;
  const pageId = before.activePageId;
  before.undo();

  const after = useEditorStore.getState();
  if (keep === null || after.activePageId !== pageId) return;
  if (after.spec.pages[pageId]?.nodes[keep] === undefined) return;
  after.select(keep);
}
