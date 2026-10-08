import {
  effectivePanelWidth,
  maxResizableWidth,
  widthAfterExpand,
} from "@/features/editor/store/panelLayout";
import { useViewStore } from "@/features/editor/store/viewStore";

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
 */
export function usePanelResize(side: "tree" | "props") {
  const collapsed = useViewStore((s) => (side === "tree" ? s.treeCollapsed : s.propsCollapsed));
  const width = useViewStore((s) => (side === "tree" ? s.treeWidth : s.propsWidth));
  const otherCollapsed = useViewStore((s) => (side === "tree" ? s.propsCollapsed : s.treeCollapsed));
  const otherWidth = useViewStore((s) => (side === "tree" ? s.propsWidth : s.treeWidth));
  const rawSetWidth = useViewStore((s) => (side === "tree" ? s.setTreeWidth : s.setPropsWidth));
  const rawToggleCollapsed = useViewStore((s) =>
    side === "tree" ? s.toggleTreeCollapsed : s.togglePropsCollapsed,
  );
  const commitPanelLayout = useViewStore((s) => s.commitPanelLayout);

  const otherEffectiveWidth = effectivePanelWidth(otherCollapsed, otherWidth);

  // 창 폭 대비 동적 상한(#287 리뷰 대응) — 반대쪽 패널이 지금 쓰는 폭(접혀
  // 있으면 레일 폭)을 빼 Canvas 최소 폭을 지킨다.
  function setWidth(nextWidth: number) {
    rawSetWidth(Math.min(nextWidth, maxResizableWidth(window.innerWidth, otherEffectiveWidth)));
  }

  // 접힘→펼침도 같은 상한을 거친다(#287 리뷰 2차 대응, panelLayout.ts의
  // widthAfterExpand 참고) — toggle은 collapsed만 뒤집고 저장된 width는
  // 그대로 복원해 위 setWidth의 상한을 우회했었다. 폭을 먼저 고치고 나서
  // 토글해야 toggleCollapsed 자신의 저장 로직(panelLayoutOf)이 고친 폭을
  // 같이 저장한다.
  function toggleCollapsed() {
    if (collapsed) {
      const corrected = widthAfterExpand(width, window.innerWidth, otherEffectiveWidth);
      if (corrected !== width) rawSetWidth(corrected);
    }
    rawToggleCollapsed();
  }

  return { collapsed, width, setWidth, toggleCollapsed, commitPanelLayout };
}
