import {
  effectivePanelWidth,
  widthAfterExpand,
} from "@/features/editor/store/panelLayout";
import { useViewStore } from "@/features/editor/store/viewStore";

/**
 * 레이어 트리·속성 패널 접힘을 토글한다 — 펼치는 방향이면 저장된 폭을 지금
 * 반대쪽 패널 기준으로 보정한 뒤 토글한다(#287 리뷰 4차 대응).
 *
 * **이 파일 하나가 "펼침" 경로의 단일 소스다.** 리뷰가 찾은 우회 경로들
 * (`MenuBar.tsx`의 View ▸ Layers/Properties Panel, `openExportPanel.ts`,
 * `openTicketPanel.ts`)은 전부 React 컴포넌트가 아니거나(모듈 최상위
 * 함수) 렌더와 무관한 시점에 불려서 `usePanelResize.ts`의 훅을 못 쓴다 —
 * 그래서 각자 `useViewStore.getState().toggleTreeCollapsed()`처럼 원본
 * 액션을 직접 불렀고, 폭 보정이 `usePanelResize`의 리액트 래퍼 안에만
 * 있어 그 경로들이 전부 비켜 갔다. 훅이 필요 없는 평범한 함수로 뽑아
 * `usePanelResize`를 포함한 **모든** 호출부가 이 함수를 거치게 한다.
 */
export function toggleTreePanel(): void {
  const state = useViewStore.getState();
  if (state.treeCollapsed) {
    const corrected = widthAfterExpand(
      state.treeWidth,
      window.innerWidth,
      effectivePanelWidth(state.propsCollapsed, state.propsWidth),
    );
    if (corrected !== state.treeWidth) state.setTreeWidth(corrected);
  }
  state.toggleTreeCollapsed();
}

export function togglePropsPanel(): void {
  const state = useViewStore.getState();
  if (state.propsCollapsed) {
    const corrected = widthAfterExpand(
      state.propsWidth,
      window.innerWidth,
      effectivePanelWidth(state.treeCollapsed, state.treeWidth),
    );
    if (corrected !== state.propsWidth) state.setPropsWidth(corrected);
  }
  state.togglePropsCollapsed();
}
