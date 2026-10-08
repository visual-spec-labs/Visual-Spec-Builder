import { effectivePanelWidth, maxResizableWidth } from "@/features/editor/store/panelLayout";
import { useViewStore } from "@/features/editor/store/viewStore";
import { toggleTreePanel, togglePropsPanel } from "@/features/editor/ui/panelToggle";

/**
 * 레이어 트리·속성 패널이 공유하는 접기/폭 상태 배선(#287, 자체 code-review
 * 대응으로 `LayerTree.tsx`·`PropertiesPanel.tsx`의 중복을 뽑았다).
 *
 * `window.innerWidth`를 읽는 자리도 여기 하나로 모은다 — `viewStore.ts`
 * (`store/`)는 DOM 타입 없는 `tsconfig.node.json`으로도 검사되는 테스트가
 * 가져다 쓰므로 `window`를 직접 못 읽는다("window·document를 만지는 코드는
 * ui/에만 둔다"는 이 저장소 경계, `viewStore.ts`의 `setTreeWidth` 주석
 * 참고). 두 패널 각각에 같은 계산을 복사해 두면 나중에 또 고칠 때
 * 한쪽만 고치고 잊기 쉬워, 이 훅 하나로 합쳤다.
 *
 * 접힘 토글 자체(펼치는 방향의 폭 보정 포함)는 `panelToggle.ts`에 있다 —
 * `MenuBar.tsx`의 View 메뉴·`openExportPanel.ts`·`openTicketPanel.ts`는
 * 컴포넌트가 아니거나 렌더와 무관한 시점에 불려서 이 훅을 못 쓰므로,
 * 리액트와 무관한 평범한 함수로 따로 둬야 그 호출부들도 같은 보정을
 * 쓸 수 있다(#287 리뷰 4차 대응 — 훅 안에만 있던 보정을 그 호출부들이
 * 비켜 갔었다).
 */
export function usePanelResize(side: "tree" | "props") {
  const collapsed = useViewStore((s) => (side === "tree" ? s.treeCollapsed : s.propsCollapsed));
  const width = useViewStore((s) => (side === "tree" ? s.treeWidth : s.propsWidth));
  const otherCollapsed = useViewStore((s) => (side === "tree" ? s.propsCollapsed : s.treeCollapsed));
  const otherWidth = useViewStore((s) => (side === "tree" ? s.propsWidth : s.treeWidth));
  const rawSetWidth = useViewStore((s) => (side === "tree" ? s.setTreeWidth : s.setPropsWidth));
  const commitPanelLayout = useViewStore((s) => s.commitPanelLayout);

  // 창 폭 대비 동적 상한(#287 리뷰 대응) — 반대쪽 패널이 지금 쓰는 폭(접혀
  // 있으면 레일 폭)을 빼 Canvas 최소 폭을 지킨다.
  function setWidth(nextWidth: number) {
    const max = maxResizableWidth(
      window.innerWidth,
      effectivePanelWidth(otherCollapsed, otherWidth),
    );
    rawSetWidth(Math.min(nextWidth, max));
  }

  const toggleCollapsed = side === "tree" ? toggleTreePanel : togglePropsPanel;

  return { collapsed, width, setWidth, toggleCollapsed, commitPanelLayout };
}
