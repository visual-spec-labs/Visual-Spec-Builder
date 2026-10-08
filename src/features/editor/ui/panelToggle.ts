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

/**
 * 지금 펼쳐진 패널들의 폭이 지금 창 기준으로 여전히 괜찮은지 확인하고,
 * 아니면 줄인다(#287 리뷰 5차 대응). 위 두 함수의 보정은 **접힘→펼침이
 * 일어나는 순간**에만 걸린다 — 그런데 localStorage에 저장된 폭은 넓은
 * 모니터에서 만들어졌을 수 있고, 좁은 창에서 처음 앱을 열면(collapse/
 * expand를 한 번도 안 거치고) 그 넓은 값이 그대로 렌더부터 적용된다.
 * `EditorLayout.tsx`가 마운트될 때 한 번 불러 그 간극을 메운다.
 *
 * 창 폭 변화에 실시간으로 반응하는 자동 규칙은 만들지 않는다(docs/22
 * "결정" 6번과 같은 이유 — 언제 줄어들지 예측하기 어렵다) — 이 함수는
 * **마운트 시 한 번**만 불린다, 에디터를 쓰는 도중의 OS 창 크기 변경에는
 * 반응하지 않는다.
 *
 * 두 패널을 순서대로 보정할 때마다 `getState()`를 다시 불러야 한다 —
 * 트리를 먼저 깎으면 그 결과가 속성 쪽 "반대편 폭" 계산에 반영돼야
 * 하므로, 한 번 떠 둔 스냅샷을 재사용하면 안 된다.
 */
export function reconcilePanelWidths(): void {
  if (!useViewStore.getState().treeCollapsed) {
    const state = useViewStore.getState();
    const corrected = widthAfterExpand(
      state.treeWidth,
      window.innerWidth,
      effectivePanelWidth(state.propsCollapsed, state.propsWidth),
    );
    if (corrected !== state.treeWidth) state.setTreeWidth(corrected);
  }
  if (!useViewStore.getState().propsCollapsed) {
    const state = useViewStore.getState();
    const corrected = widthAfterExpand(
      state.propsWidth,
      window.innerWidth,
      effectivePanelWidth(state.treeCollapsed, state.treeWidth),
    );
    if (corrected !== state.propsWidth) state.setPropsWidth(corrected);
  }
  useViewStore.getState().commitPanelLayout();
}
