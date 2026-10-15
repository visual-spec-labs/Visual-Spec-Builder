import { useEditorStore } from "@/features/editor/store/editorStore";
import { incomingActions, canRemovePage } from "@/features/editor/store/pageRemoval";
import type { PageId } from "@/features/editor/schema";

/** Confirmation authorizes only this document snapshot and its reviewed impact. */
export async function confirmPageRemoval(
  pageId: PageId,
  confirm: (message: string) => boolean | Promise<boolean> = (message) => window.confirm(message),
  notify: (message: string) => void = (message) => window.alert(message),
): Promise<boolean> {
  const before = useEditorStore.getState();
  if (!canRemovePage(before.spec, pageId)) { notify("일반 page는 최소 한 장 남아야 합니다."); return false; }
  const incoming = incomingActions(before.spec, pageId);
  const message = `"${before.spec.pages[pageId].name}" 페이지를 삭제할까요?\n함께 제거할 연결 ${incoming.length}개` +
    incoming.map((source) => `\n• ${source.pageName} (${source.pageId}) / ${source.nodeName} (${source.nodeId})`).join("");
  let stale = false;
  // Permanent invalidation also catches edit → Undo, even if the original spec reference returns.
  const unsubscribe = useEditorStore.subscribe((state) => {
    if (state.spec !== before.spec || state.documentId !== before.documentId || state.spec.projectId !== before.spec.projectId) stale = true;
  });
  try {
    if (!await confirm(message)) return false;
    const current = useEditorStore.getState();
    if (stale || current.spec !== before.spec || current.documentId !== before.documentId) {
      notify("확인을 기다리는 동안 문서 또는 삭제 영향이 바뀌었습니다. 최신 연결 목록을 다시 확인한 뒤 삭제하세요.");
      return false;
    }
    // No await between comparison and the store's atomic candidate/validation/commit.
    current.removePage(pageId, { spec: before.spec, documentId: before.documentId });
    return useEditorStore.getState().spec !== before.spec;
  } finally { unsubscribe(); }
}
