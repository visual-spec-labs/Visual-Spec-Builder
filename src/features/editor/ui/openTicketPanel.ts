import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { useViewStore } from "@/features/editor/store/viewStore";

/**
 * 구현 티켓 패널을 열고 현재 페이지로 (다시) 컴파일한다. `MenuBar`("구현
 * 티켓")와 `ExportPanel`(생성된 코드가 없을 때의 다음 행동) 둘이 쓴다(#283) —
 * `openExportPanel.ts`와 같은 이유로 한 곳에 모아 둔다.
 *
 * **Export가 열려 있으면 같이 닫는다(#283 리뷰 대응).** `EditorLayout.tsx`는
 * 둘 다 열렸으면 Export를 우선 렌더링한다 — `ticketStore.isOpen`만 켜면 화면은
 * 그대로 Export인 채 뒤에서 티켓 계획만 다시 생성돼, 클릭해도 아무 일도 안
 * 일어난 것처럼 보인다. 반대 방향(Export를 열 때 티켓 패널은 안 닫는 것)은
 * `openExportPanel.ts`에 그대로 둔다 — Export가 우선순위를 가지므로 그쪽은
 * 이 문제가 없고, 닫았을 때 티켓 패널로 돌아가는 것도 `EditorLayout.tsx`가
 * 의도한 동작이다.
 */
export function openTicketPanel(): void {
  const { spec, activePageId } = useEditorStore.getState();
  const view = useViewStore.getState();
  if (!view.showPanels) view.togglePanels();
  // 전체 토글만 켜고 개별 접힘(#287)을 안 풀면, 패널이 32px 레일로 접힌 채
  // 티켓 목록이 그 좁은 칸에 그대로 렌더된다(자체 code-review 대응).
  if (view.propsCollapsed) view.togglePropsCollapsed();
  if (useExportStore.getState().isOpen) useExportStore.getState().close();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
}
