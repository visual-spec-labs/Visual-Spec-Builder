import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import { togglePropsPanel } from "@/features/editor/ui/panelToggle";

/**
 * Export 패널을 열고 현재 페이지를 훑는다. `MenuBar`(File ▸ Export Code)와
 * `TicketPanel`("모든 티켓 완료" 다음 행동) 둘이 쓴다(#283) — 패널 표시를 켜는
 * 것까지 포함해 한 곳에 모아 둔다.
 */
export function openExportPanel(): void {
  const { spec, activePageId, documentId } = useEditorStore.getState();
  const view = useViewStore.getState();
  if (!view.showPanels) view.togglePanels();
  // 전체 토글만 켜고 개별 접힘(#287)을 안 풀면, 패널이 32px 레일로 접힌 채
  // Export 내용이 그 좁은 칸에 그대로 렌더된다(자체 code-review 대응).
  // togglePropsCollapsed가 아니라 togglePropsPanel을 쓴다 — 펼치는 방향이면
  // 저장된 폭을 Canvas 최소 폭 기준으로 보정한다(#287 리뷰 4차 대응).
  if (view.propsCollapsed) togglePropsPanel();
  void useExportStore.getState().open({
    documentId,
    pageId: activePageId,
    page: spec.pages[activePageId],
    projectName: spec.name,
    fileName: useDocumentStore.getState().fileName,
  });
}
