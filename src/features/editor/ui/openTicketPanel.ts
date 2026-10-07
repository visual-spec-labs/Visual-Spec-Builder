import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { useViewStore } from "@/features/editor/store/viewStore";

/**
 * 구현 티켓 패널을 열고 현재 페이지로 (다시) 컴파일한다. `MenuBar`("구현
 * 티켓")와 `ExportPanel`(생성된 코드가 없을 때의 다음 행동) 둘이 쓴다(#283) —
 * `openExportPanel.ts`와 같은 이유로 한 곳에 모아 둔다.
 */
export function openTicketPanel(): void {
  const { spec, activePageId } = useEditorStore.getState();
  const view = useViewStore.getState();
  if (!view.showPanels) view.togglePanels();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
}
