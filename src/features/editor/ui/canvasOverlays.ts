import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import type { NodeId } from "@/features/editor/schema";

import {
  childCenters,
  gapStrips,
  sameStrip,
  type CenterMark,
  type GapStrip,
} from "./gapStrips";
import { clickBoundary, resolveClickTarget } from "./selection";
import { nodeSelector, relativeRect, sameRect, type Rect } from "./selectionRect";

/**
 * 캔버스 오버레이가 쓸 좌표를 내는 훅들. `Canvas.tsx` 에서 잘라 왔고 동작은
 * 바뀌지 않았다(2026-09-19·이슈 #148).
 *
 * **다시 재는 신호가 셋은 같고 둘은 다르다.** 묶은 기준은 "오버레이가 그릴 값을
 * 낸다"이지 구현이 같다는 뜻이 아니다 — 새 훅을 여기 더할 때 아래 표를 보고
 * 어느 쪽인지 정하면 된다.
 *
 * | 훅 | 다시 재는 신호 |
 * |---|---|
 * | `useSelectionRect` · `useGapStrips` · `useRectOf` | 매 렌더 + MutationObserver + ResizeObserver |
 * | `useArtboardHeight` | **ResizeObserver 만** — 자라는 원인이 자식 편집이라 자기 크기만 보면 된다 |
 * | `useHoverTarget` | **아무것도 안 잰다** — `mousemove` 로 노드 id 만 고른다. 재는 것은 그 id 를 받은 `useRectOf` 다 |
 *
 * 앞의 셋은 관찰 옵션(`style`·`childList`·`characterData`·`subtree`)까지 같아서,
 * 흩어져 있을 때는 그 이유를 적은 같은 주석이 세 벌이었다. 각 훅의 주석에 그대로
 * 남겨 두되 근거는 `useSelectionRect` 쪽이 정본이다.
 *
 * 이 파일은 DOM 타입을 쓴다 — `src/` 는 `tsconfig.app` 이 컴파일하므로 괜찮다.
 * DOM 을 못 쓰는 쪽은 `test/` 를 함께 컴파일하는 순수 모듈들이다
 * (`gapStrips.ts` · `selectionRect.ts` · `canvasInput.ts` 주석 참고).
 */

/**
 * 선택된 노드가 화면에서 차지하는 사각형을 재서 오버레이가 쓸 좌표로 돌려준다.
 *
 * 노드에 직접 표시를 얹지 않는 이유는 selectionRect.ts 주석에 있다.
 *
 * 다시 재야 하는 순간이 세 갈래다.
 *
 *   1. 선택·확대율·페이지·해상도가 바뀔 때 — 전부 Canvas 리렌더로 들어오므로 매
 *      렌더마다 잰다. 값이 그대로면 상태를 바꾸지 않아 렌더가 반복되지 않는다.
 *   2. 스펙 편집으로 배치가 밀릴 때 — Canvas는 노드를 하나하나 구독하지 않는다
 *      (각 RenderNode가 자기 노드만 구독한다). 그래서 패널에서 형제의 패딩이나
 *      글자를 바꿔도 여기는 다시 렌더되지 않는다. DOM 쪽 신호(MutationObserver)로
 *      받아야 한다 — 무엇을 보는지는 아래 observe 옵션 주석 참고.
 *   3. 이미지·폰트가 늦게 로드돼 대상 크기가 변할 때 — ResizeObserver로 본다.
 *
 * 스크롤은 목록에 없다. 대상과 기준을 같은 순간에 재면 오프셋이 상쇄된다.
 */
export function useSelectionRect(
  outerRef: RefObject<HTMLDivElement | null>,
  artboardRef: RefObject<HTMLDivElement | null>,
  selectedId: NodeId | null,
): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const artboard = artboardRef.current;
    // 숨긴 노드(visible: false)는 아예 그려지지 않아 여기서 null이 되고,
    // 표시도 함께 사라진다 — 안 보이는 것에 테두리만 남는 것보다 낫다.
    const target =
      outer === null || artboard === null || selectedId === null
        ? null
        : artboard.querySelector(nodeSelector(selectedId));

    const next =
      outer === null || target === null
        ? null
        : relativeRect(
            target.getBoundingClientRect(),
            outer.getBoundingClientRect(),
          );

    setRect((prev) => (sameRect(prev, next) ? prev : next));
  }, [outerRef, artboardRef, selectedId]);

  useLayoutEffect(measure);

  useLayoutEffect(() => {
    const artboard = artboardRef.current;
    if (artboard === null || selectedId === null) return;

    const target = artboard.querySelector(nodeSelector(selectedId));
    const resize = new ResizeObserver(measure);
    if (target !== null) resize.observe(target);

    // style 속성만 본다 — 캔버스의 배치 변화는 전부 인라인 스타일로 나타난다.
    // childList는 노드 추가·삭제, subtree는 형제/조상의 변화를 잡기 위해서다.
    //
    // characterData가 필요한 이유는 React의 텍스트 갱신 경로 때문이다. 자식이
    // 문자열 하나뿐인 엘리먼트를 고칠 때 setTextContent가 firstChild.nodeValue에
    // 직접 대입한다(react-dom의 빠른 경로). 이건 childList도 attributes도 아니라
    // 없으면 안 잡힌다 — 형제 텍스트가 길어지며 선택 노드를 밀어내는 경우가 그렇다
    // (선택 노드 자신은 크기가 안 변해 ResizeObserver도 울지 않는다).
    const mutation = new MutationObserver(measure);
    mutation.observe(artboard, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [artboardRef, measure, selectedId]);

  return rect;
}

/**
 * 선택한 프레임의 자식 사이에 생긴 빈 띠를 재서 돌려준다.
 *
 * 간격이 얼마인지 알려면 지금은 상세 패널의 `간격 (Gap)` 칸을 봐야 한다. 캔버스를
 * 보고 있는 동안 눈이 패널에 가 있지 않아서, 두 카드가 왜 저만큼 떨어졌는지
 * 확인하려면 시선을 옮겨야 한다. 피그마는 틈에 커서를 올리면 그 자리에 숫자를 띄운다.
 *
 * 다시 재는 시점은 `useSelectionRect` 와 같다(매 렌더 + Mutation/Resize). 자식의
 * 배치가 밀리는 사건과 선택 사각형이 밀리는 사건이 정확히 같은 집합이라, 두 훅이
 * 같은 신호를 본다.
 */
export function useGapStrips(
  outerRef: RefObject<HTMLDivElement | null>,
  artboardRef: RefObject<HTMLDivElement | null>,
  selectedId: NodeId | null,
  scale: number,
): { strips: GapStrip[]; centers: CenterMark[] } {
  const [measured, setMeasured] = useState<{
    strips: GapStrip[];
    centers: CenterMark[];
  }>(EMPTY_GAPS);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const artboard = artboardRef.current;
    const target =
      outer === null || artboard === null || selectedId === null
        ? null
        : artboard.querySelector(nodeSelector(selectedId));

    if (outer === null || target === null) {
      setMeasured((prev) => (prev.strips.length === 0 && prev.centers.length === 0 ? prev : EMPTY_GAPS));
      return;
    }

    // 직계 자식만 본다. querySelectorAll 로 하위 전체를 긁으면 손자까지 들어와
    // 엉뚱한 틈이 생긴다.
    const origin = outer.getBoundingClientRect();
    const children = Array.from(target.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .filter((child) => child.dataset.nodeId !== undefined)
      .map((child) => relativeRect(child.getBoundingClientRect(), origin));

    const next = { strips: gapStrips(children, scale), centers: childCenters(children) };
    setMeasured((prev) =>
      sameStrips(prev.strips, next.strips) && sameCenters(prev.centers, next.centers)
        ? prev
        : next,
    );
  }, [outerRef, artboardRef, selectedId, scale]);

  useLayoutEffect(measure);

  useLayoutEffect(() => {
    const artboard = artboardRef.current;
    if (artboard === null || selectedId === null) return;

    const target = artboard.querySelector(nodeSelector(selectedId));
    const resize = new ResizeObserver(measure);
    if (target !== null) resize.observe(target);

    const mutation = new MutationObserver(measure);
    mutation.observe(artboard, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [artboardRef, measure, selectedId]);

  return measured;
}

/** 잴 것이 없을 때 돌려줄 고정 객체. 매번 새로 만들면 상태가 늘 달라 보인다. */
const EMPTY_GAPS: { strips: GapStrip[]; centers: CenterMark[] } = {
  strips: [],
  centers: [],
};

/** 목록 전체가 같은가. 같으면 상태를 안 바꿔 렌더가 반복되지 않는다. */
function sameStrips(a: readonly GapStrip[], b: readonly GapStrip[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((strip, i) => sameStrip(strip, b[i]));
}

function sameCenters(a: readonly CenterMark[], b: readonly CenterMark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((mark, i) => mark.left === b[i].left && mark.top === b[i].top);
}

/**
 * 커서가 올라간 노드의 사각형. 클릭 전에 "이걸 고르게 된다"를 미리 보여 준다.
 *
 * **무엇을 강조할지는 클릭 규칙과 똑같다** — `resolveClickTarget` 을 그대로
 * 부른다. 강조된 것과 실제로 선택되는 것이 다르면 표시가 거짓말이 되므로,
 * 규칙을 두 벌 두지 않고 하나를 공유한다. 그래서 Ctrl/Cmd 를 누른 채 올리면
 * 강조도 안쪽 노드로 내려간다(상세 지정 미리보기).
 *
 * 선택된 노드에는 강조를 그리지 않는다 — 선택 표시가 이미 있어서 두 겹이 된다.
 */
export interface HoverTarget {
  /** 클릭하면 선택될 노드. 선택 미리보기(주황 1px)가 이걸 그린다. */
  selectId: NodeId | null;
  /** 커서 밑 최하위 노드. Alt 거리 재기가 이걸 잰다. */
  deepId: NodeId | null;
}

const NO_HOVER: HoverTarget = { selectId: null, deepId: null };

export function useHoverTarget(
  artboardRef: RefObject<HTMLDivElement | null>,
): { target: HoverTarget; onMove: (event: ReactMouseEvent) => void; onLeave: () => void } {
  const [target, setTarget] = useState<HoverTarget>(NO_HOVER);
  // 직전에 푼 입력. 같은 노드 위를 계속 지나갈 때 resolveClickTarget 을 다시
  // 부르지 않으려는 것이다 — 그 안의 buildParentMap 이 문서 전체를 순회하며
  // Map 을 새로 만드는데, mousemove 는 초당 수십 번 들어온다.
  // focusRootId 도 캐시 키에 넣는다 — 마우스가 멈춰 있는 동안 더블클릭으로
  // 문맥이 바뀌면(#151) 같은 clickedId·deep 이어도 강조 대상이 달라진다.
  const lastRef = useRef<{
    clickedId: string;
    deep: boolean;
    focusRootId: NodeId | null;
  } | null>(null);

  const clear = useCallback(() => {
    lastRef.current = null;
    setTarget((prev) => (prev === NO_HOVER ? prev : NO_HOVER));
  }, []);

  const onMove = useCallback(
    (event: ReactMouseEvent) => {
      const artboard = artboardRef.current;
      // 손 도구는 팬 전용이라 클릭해도 선택이 안 바뀐다 — 미리보기도 띄우지 않는다.
      // 끄는 중(버튼이 눌린 채)에도 띄우지 않는다 — 팬·리사이즈 내내 계산만 돈다.
      if (
        artboard === null ||
        event.buttons !== 0 ||
        useToolStore.getState().activeTool === "hand"
      ) {
        clear();
        return;
      }

      const from = event.target instanceof Element ? event.target : null;
      const hit = from?.closest("[data-node-id]");
      const clickedId = hit instanceof HTMLElement ? hit.dataset.nodeId : undefined;
      if (clickedId === undefined) {
        clear();
        return;
      }

      const deep = event.metaKey || event.ctrlKey;
      const { focusRootId } = useEditorStore.getState();
      const last = lastRef.current;
      if (
        last !== null &&
        last.clickedId === clickedId &&
        last.deep === deep &&
        last.focusRootId === focusRootId
      ) {
        return;
      }
      lastRef.current = { clickedId, deep, focusRootId };

      const { spec, activePageId } = useEditorStore.getState();
      const { nodes, root } = spec.pages[activePageId];
      // **Alt 를 deep 으로 치지 않는다.** Alt 는 피그마에서 거리 재기 전용
      // 수식키지 상세 선택이 아니다. 여기에 얹으면 강조된 노드와 클릭이 고르는
      // 노드가 갈라져, 주석과 docs/09-shortcuts.md 가 약속한 "강조된 것이 곧
      // 선택된다"가 깨진다. 재는 대상은 deepId 로 따로 들고 간다.
      //
      // 경계는 클릭 핸들러(Canvas.tsx)와 똑같이 clickBoundary 로 정한다(#151) —
      // 강조되는 것과 실제로 선택되는 것이 언제나 같아야 한다.
      const selectId = resolveClickTarget({
        nodes,
        root: clickBoundary(nodes, root, focusRootId, clickedId),
        clickedId,
        deep,
      });

      // **선택 여부를 여기서 접지 않는다.** 접어 두면 그 뒤에 selectedId 가 바뀌어도
      // 상태가 그대로라, 노드를 hover 한 채 클릭하면 1px 미리보기가 2px 선택 표시
      // 위에 겹친 채로 남는다(커서가 다른 노드로 넘어가야 사라졌다). 비교도
      // 접은 값과 안 접은 값을 견주게 돼 어긋난다. 판단은 렌더에서 한다.
      setTarget((prev) =>
        prev.selectId === selectId && prev.deepId === clickedId
          ? prev
          : { selectId, deepId: clickedId },
      );
    },
    [artboardRef, clear],
  );

  return { target, onMove, onLeave: clear };
}

/**
 * 노드 id 하나를 화면 사각형으로 옮긴다. 대상이 없으면 null.
 *
 * `useSelectionRect` 와 같은 신호를 본다 — 매 렌더 + Mutation/Resize. **id 만
 * 들고 있다가 여기서 재는 것이 핵심이다.** 예전에는 mousemove 에서 좌표까지
 * 함께 적어 두었는데, 그러면 Ctrl+휠로 확대해도(휠은 mousemove 가 아니다) 옛
 * 좌표가 그대로 남아 강조가 어긋난 자리에 머물렀다. 거리 재기는 갓 잰
 * 선택 사각형과 낡은 이 값을 섞어 **틀린 숫자**를 내보였다.
 */
export function useRectOf(
  outerRef: RefObject<HTMLDivElement | null>,
  artboardRef: RefObject<HTMLDivElement | null>,
  nodeId: NodeId | null,
): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const artboard = artboardRef.current;
    const target =
      outer === null || artboard === null || nodeId === null
        ? null
        : artboard.querySelector(nodeSelector(nodeId));

    const next =
      outer === null || target === null
        ? null
        : relativeRect(target.getBoundingClientRect(), outer.getBoundingClientRect());

    setRect((prev) => (sameRect(prev, next) ? prev : next));
  }, [outerRef, artboardRef, nodeId]);

  useLayoutEffect(measure);

  useLayoutEffect(() => {
    const artboard = artboardRef.current;
    if (artboard === null || nodeId === null) return;

    const target = artboard.querySelector(nodeSelector(nodeId));
    const resize = new ResizeObserver(measure);
    if (target !== null) resize.observe(target);

    const mutation = new MutationObserver(measure);
    mutation.observe(artboard, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [artboardRef, measure, nodeId]);

  return rect;
}

/**
 * 아트보드가 실제로 몇 px로 그려졌는지(세로) 잰다.
 *
 * 아트보드 높이가 `minHeight` 로 바뀌어 내용에 따라 자라므로(#86), 스크롤 범위를
 * 정하는 바깥 박스도 그 값을 따라가야 아래쪽 내용까지 스크롤된다.
 *
 * `offsetHeight` 는 `transform: scale` 의 영향을 받지 않는 레이아웃 높이라 확대율과
 * 무관한 값이 나온다 — 배율은 바깥 박스를 계산할 때 곱한다.
 *
 * `useLayoutEffect` 인 이유는 같은 파일의 `useSelectionRect` 와 같다 — 첫 측정이
 * 첫 페인트 뒤로 밀리면, 이미 4000px 인 문서를 열어도 한 프레임 동안 바깥 박스가
 * `size.height * scale` 로 남는다. File ▸ New/Open 으로 스펙을 갈아 끼울 때도
 * 이전 문서의 높이가 한 프레임 남는다.
 *
 * 자라는 원인이 자식 편집이라 ResizeObserver 만으로 충분하다. 선택 표시처럼
 * MutationObserver 까지 필요하지 않다 — 저쪽은 "크기는 그대로인데 위치만 밀리는"
 * 경우를 잡아야 했지만, 여기는 아트보드 자신의 크기 변화만 보면 된다.
 */
export function useArtboardHeight(ref: RefObject<HTMLDivElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;

    function report() {
      if (element === null) return;
      const next = Math.round(element.offsetHeight);
      setHeight((prev) => (prev === next ? prev : next));
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}
