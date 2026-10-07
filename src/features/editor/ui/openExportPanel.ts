import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { useViewStore } from "@/features/editor/store/viewStore";

/**
 * Export 패널을 열고 현재 페이지를 훑는다. `MenuBar`(File ▸ Export Code)와
 * `TicketPanel`("모든 티켓 완료" 다음 행동) 둘이 쓴다(#283) — 패널 표시를 켜는
 * 것까지 포함해 한 곳에 모아 둔다.
 */
export function openExportPanel(): void {
  const { spec, activePageId, documentId } = useEditorStore.getState();
  const view = useViewStore.getState();
  if (!view.showPanels) view.togglePanels();
  void useExportStore.getState().open({
    documentId,
    pageId: activePageId,
    page: spec.pages[activePageId],
    projectName: spec.name,
  });
}
