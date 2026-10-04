import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useContextMenuStore } from "@/features/editor/store/contextMenuStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import type { PageId } from "@/features/editor/schema";

import { isScrolledToBottom, toolCursorClass } from "./canvasInput";
import { ContextMenu } from "./ContextMenu";
import {
  badgeAnchor,
  sameStrip,
  stripAtPoint,
  stripBar,
  type GapStrip,
} from "./gapStrips";
import { artboardBoxSize } from "./canvasLayout";
import { useCanvasKeys } from "./canvasKeys";
import {
  useArtboardHeight,
  useGapStrips,
  useHoverTarget,
  useRectOf,
  useSelectionRect,
} from "./canvasOverlays";
import {
  readZoomAnchor,
  useAltHeld,
  useZoomAnchor,
  type ZoomAnchor,
} from "./canvasZoom";
import { measureSegments, segmentBadge } from "./measureDistance";
import { buildNodeContextMenuEntries } from "./nodeContextMenuEntries";
import { useNodeDrag } from "./useNodeDrag";

import { RenderNode } from "./CanvasNode";
import { handleBackgroundClick } from "./canvasSelection";

/**
 * 중앙 DOM 캔버스(#236). 현재 렌더러를 유지하며 엔진 교체를 전제하지 않는다.
 * Canvas는 뷰포트·팬·줌·오버레이를 조립하고, 역할별 구현은 이웃에 둔다.
 * - CanvasNode: DOM 렌더 트리와 선택 노드 실측
 * - canvasSelection: 클릭·더블클릭·우클릭의 선택/삽입 배선
 * - CanvasResizeHandles: 리사이즈 핸들과 드래그 수명·Undo 묶음
 * - useNodeDrag/canvasDrop: 노드 드래그와 놓을 자리 판정
 * - canvasOverlays/canvasZoom/canvasKeys/nodeStyles: 측정·줌·키보드·CSS
 * 스펙 변경은 기존 editorStore Command 액션을 거친다.
 * 참고: docs/EDITOR_STORE_CONTRACT.md
 */

export function Canvas() {
  const activePageId = useEditorStore((state) => state.activePageId);
  const root = useEditorStore((state) => state.spec.pages[state.activePageId].root);
  const size = useEditorStore((state) => state.spec.pages[state.activePageId].size);
  const screenName = useEditorStore((state) => state.spec.pages[state.activePageId].name);
  const selectedId = useEditorStore((state) => state.selectedId);
  const activeTool = useToolStore((state) => state.activeTool);
  const zoom = useViewStore((s) => s.zoom);
  const showGrid = useViewStore((s) => s.showGrid);
  const viewport = useViewStore((s) => s.viewport);
  const mainRef = useRef<HTMLElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const selectionRect = useSelectionRect(outerRef, artboardRef, selectedId);
  // scale 은 아래에서 다시 쓰지만 여기서는 선언 전이라 zoom 으로 직접 계산한다.
  const { strips, centers } = useGapStrips(outerRef, artboardRef, selectedId, zoom / 100);
  const [hoveredStrip, setHoveredStrip] = useState<GapStrip | null>(null);
  const hover = useHoverTarget(artboardRef);
  const altHeld = useAltHeld();
  // 이미 선택된 노드에는 미리보기를 그리지 않는다(선택 표시와 두 겹이 된다).
  // 훅이 아니라 **여기서** 접는다 — 훅에 접어 두면 선택이 바뀌어도 커서가 다른
  // 노드로 넘어가기 전까지 낡은 값이 남는다.
  const previewId = hover.target.selectId === selectedId ? null : hover.target.selectId;
  // Alt 를 누르는 동안에는 선택 미리보기를 끄고 측정만 보여 준다. Alt 는 재기
  // 전용 수식키라 "이걸 고르게 된다"는 뜻이 아니다 — 둘을 함께 띄우면 주황
  // 미리보기가 클릭이 고를 노드와 달라 보인다.
  const previewRect = useRectOf(outerRef, artboardRef, altHeld ? null : previewId);
  const measureRect = useRectOf(outerRef, artboardRef, altHeld ? hover.target.deepId : null);
  const artboardHeight = useArtboardHeight(artboardRef);
  const contextMenuTarget = useContextMenuStore((s) => s.target);
  const anchorRef = useRef<ZoomAnchor | null>(null);
  useZoomAnchor(mainRef, outerRef, artboardRef, anchorRef, zoom);
  useCanvasKeys(mainRef, outerRef, artboardRef, anchorRef);
  const drag = useNodeDrag(mainRef, outerRef, artboardRef);

  // 띠에 pointer-events 를 주지 않고 좌표로 판정한다 — 오버레이가 마우스를 받으면
  // 틈을 클릭했을 때 아래 프레임이 선택되지 않는다(gapStrips.stripAtPoint 주석).
  const handleOverlayHover = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      // 노드 미리보기는 **틈 유무와 무관하다.** 예전에는 strips 가 비면 여기서
      // 곧장 빠져나가는 바람에, 프레임을 먼저 선택해 틈이 생겨야만 hover 표시가
      // 떴다 — "페이지 네모를 클릭해야 안쪽이 잡힌다"의 원인이었다.
      hover.onMove(event);

      const outer = outerRef.current;
      if (outer === null || strips.length === 0) {
        setHoveredStrip((prev) => (prev === null ? prev : null));
        return;
      }
      const origin = outer.getBoundingClientRect();
      const next = stripAtPoint(
        strips,
        event.clientX - origin.left,
        event.clientY - origin.top,
      );
      setHoveredStrip((prev) => (sameStrip(prev, next) ? prev : next));
    },
    [strips, hover],
  );

  const clearHoveredStrip = useCallback(() => {
    setHoveredStrip((prev) => (prev === null ? prev : null));
    hover.onLeave();
  }, [hover]);

  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;

    function handleWheel(event: WheelEvent) {
      // 일반 휠/트랙패드 스크롤은 overflow-auto 네이티브 스크롤(팬)에 맡긴다.
      // Ctrl+휠(트랙패드 핀치도 브라우저가 ctrlKey=true로 보낸다)만 줌으로 가로챈다.
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      const { zoom: before, zoomIn, zoomOut } = useViewStore.getState();
      // 확대하기 **전에** 커서 밑 지점을 적어 둔다. 확대가 끝난 뒤 그 지점이
      // 같은 화면 위치로 돌아오도록 스크롤을 맞춘다(useZoomAnchor).
      anchorRef.current = readZoomAnchor(outerRef.current, event.clientX, event.clientY);
      if (event.deltaY < 0) zoomIn();
      else zoomOut();
      // 400%/25% 끝에서 더 돌리면 값이 안 바뀌어 렌더도, useZoomAnchor 도 안 돈다.
      // 그대로 두면 앵커가 남아 **한참 뒤 다른 경로의 줌**(메뉴·Fit)이 그 옛 커서
      // 위치를 소비해 스크롤을 엉뚱한 데로 끌고 간다. 여기서 직접 지운다.
      if (useViewStore.getState().zoom === before) anchorRef.current = null;
    }

    // React의 JSX onWheel은 passive 리스너로 등록될 수 있어 preventDefault가
    // 안 먹는다 — { passive: false }로 직접 등록해야 브라우저 기본 페이지
    // 줌을 확실히 막을 수 있다.
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  // Hand 도구: 캔버스를 끌어서 화면을 이동(팬)한다.
  // 스크롤 컨테이너가 이미 main이므로 scrollLeft/Top만 옮기면 된다.
  useEffect(() => {
    const node = mainRef.current;
    if (node === null) return;

    /** 끌기 시작점. 끌고 있지 않으면 null. */
    let origin: {
      x: number;
      y: number;
      scrollLeft: number;
      scrollTop: number;
    } | null = null;

    function endPan() {
      if (origin === null) return;
      origin = null;
      setPanning(false);
    }

    function handleMouseDown(event: MouseEvent) {
      if (node === null) return;
      // 가운데 버튼은 **도구와 무관하게** 언제나 팬이다. 피그마·일러스트레이터가
      // 그렇고, 무엇을 그리다가도 손을 떼지 않고 화면을 옮길 수 있어야 한다.
      // 브라우저 기본 동작(자동 스크롤)은 아래 preventDefault 로 막는다.
      const middle = event.button === 1;
      if (!middle && useToolStore.getState().activeTool !== "hand") return;
      if (!middle && event.button !== 0) return;
      // 끄는 동안 텍스트가 선택되거나 드래그 고스트가 생기지 않게 막는다.
      event.preventDefault();

      origin = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop,
      };
      setPanning(true);
    }

    function handleMouseMove(event: MouseEvent) {
      if (node === null || origin === null) return;
      // 창 밖에서 버튼을 떼면 mouseup이 페이지로 오지 않는다. 버튼이 눌려 있지
      // 않은 이동을 보면 그때 끌기를 끝내야 커서가 grabbing에 갇히지 않는다.
      if (event.buttons === 0) {
        endPan();
        return;
      }
      // 종이를 손으로 끄는 방향 — 오른쪽으로 끌면 내용이 오른쪽으로 따라온다.
      node.scrollLeft = origin.scrollLeft - (event.clientX - origin.x);
      node.scrollTop = origin.scrollTop - (event.clientY - origin.y);
    }

    // 캔버스 밖으로 커서가 나가도 끌기가 이어지도록 이동·해제는 window에서 듣는다.
    // 끌기마다 붙였다 떼면 mouseup을 놓쳤을 때 리스너가 남으므로 여기서 한 번만
    // 등록하고, 정리도 이 effect가 책임진다.
    node.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endPan);
    return () => {
      node.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endPan);
    };
  }, []);

  // 뷰포트 실측값을 스토어에 올린다 — Fit to Screen이 이 값으로 확대율을 계산한다.
  useEffect(() => {
    const node = mainRef.current;
    if (node === null) return;

    function report() {
      if (node === null) return;
      const style = getComputedStyle(node);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      useViewStore.getState().setViewport({
        width: Math.max(0, node.clientWidth - padX),
        height: Math.max(0, node.clientHeight - padY),
      });
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // 실측 높이가 아니라 스펙 size를 올린다 — Fit이 맞추는 대상은 **첫 화면**이다.
  // size.height가 "첫 화면 높이"가 된 지금(#86) 4000px짜리 문서를 통째로 맞추면
  // 아무것도 안 보일 만큼 축소된다. 아래로 이어지는 내용은 스크롤이 맡는다.
  useEffect(() => {
    useViewStore.getState().setContent(size);
  }, [size]);

  // 캔버스가 맨 아래까지 내려가 있는지 스토어에 올린다 — 채우기 모드에서 하단
  // 도구 모음이 잠깐 비켜주는 신호다(Toolbar.tsx).
  //
  // 스크롤 말고도 아트보드가 자라거나 배율이 바뀌면 "맨 밑"인지가 달라지므로,
  // 그 값들이 바뀔 때도 다시 잰다.
  useEffect(() => {
    const node = mainRef.current;
    if (node === null) return;

    function report() {
      if (node === null) return;
      useViewStore
        .getState()
        .setCanvasAtBottom(
          isScrolledToBottom(node.scrollTop, node.clientHeight, node.scrollHeight),
        );
    }

    report();
    node.addEventListener("scroll", report, { passive: true });
    return () => node.removeEventListener("scroll", report);
  }, [zoom, artboardHeight, size]);

  // 처음 열었을 때는 Figma처럼 첫 화면(page.size)이 한눈에 들어오도록 맞춘다.
  // 100%로 시작하면 아트보드가 뷰포트보다 커서 캔버스 바탕이 안 보이고,
  // 아트보드가 "캔버스 위에 얹힌 오브젝트"로 읽히지 않는다.
  //
  // 페이지를 바꿀 때도 다시 맞춘다. 1440×900에서 390×844로 옮겼는데 확대율이
  // 그대로면 아트보드가 뷰포트 구석에 조그맣게 남는다.
  const fittedFor = useRef<PageId | null>(null);
  useEffect(() => {
    if (viewport === null) return;
    if (fittedFor.current === activePageId) return;
    fittedFor.current = activePageId;
    useViewStore.getState().fitToScreen();
  }, [viewport, activePageId, size]);

  const scale = zoom / 100;
  // 노드를 끄는 동안(#187)은 도구와 무관하게 쥔 손이다. 자손까지 강제하는 이유는
  // button·input 노드가 인라인 `cursor: default`를 가져 상속이 끊기기 때문이다.
  const cursorClass = drag.dragging
    ? "cursor-grabbing [&_*]:cursor-grabbing!"
    : toolCursorClass(activeTool, panning);

  // scrollbar-gutter는 세로 스크롤바 자리를 항상 비워둔다. 없으면 채우기 모드에서
  // 되먹임 진동이 난다: 스크롤바 등장 → clientWidth 감소 → 배율 축소 → 내용이 짧아져
  // 스크롤바 소멸 → clientWidth 복귀 → 다시 등장…이 무한 반복된다.
  return (
    // 배율 배지처럼 "스크롤을 따라가면 안 되는" 것을 얹으려면 스크롤 컨테이너
    // 바깥에 자리가 필요하다. overflow-auto 안의 absolute 는 내용과 함께 흘러간다.
    //
    // main 은 h-full 이 아니라 absolute inset-0 으로 이 상자를 덮는다. 퍼센트 높이는
    // 부모 높이가 확정돼야 풀리는데, 그게 어긋나면 main 이 캔버스 영역을 다 덮지
    // 못한다 — 안 덮인 자리에서는 Ctrl+휠이 main 에 닿지 않아 캔버스 줌 대신
    // 브라우저 페이지 줌이 일어난다. inset-0 은 그 조건을 안 탄다.
    <div className="relative overflow-hidden bg-surface-canvas [grid-area:canvas]">
      {/*
        격자는 스크롤 컨테이너 **바깥**이다. 안에 두면 absolute 라도 내용과 함께
        흘러가, 확대하거나 아래로 내리는 순간 격자가 화면 밖으로 빠져나가 맨바닥이
        드러난다(#86 으로 아트보드가 길어지면서 눈에 띄게 됐다). 여기 두면 뷰포트에
        붙어 있고, 캔버스 바탕색도 이 상자가 칠하므로 main 은 투명하게 둔다.

        TODO(캔버스 담당): 격자를 Figma처럼 "캔버스 평면에 깔린" 배경으로 바꿀 것.
        지금은 벽지처럼 제자리에 머물러 아트보드가 캔버스 위에 놓여 있다는 느낌이
        깨진다. 격자는 아트보드와 같은 변환(스크롤 오프셋 + 줌)을 받아야 하고, 칸
        크기도 줌에 비례해야 한다(--canvas-grid-size * scale). 스냅 기능은 아직
        없으며 순수 배경 표시다.
      */}
      {showGrid && (
        <div className="canvas-grid pointer-events-none absolute inset-0" />
      )}

      <main
        ref={mainRef}
        className={`absolute inset-0 overflow-auto p-8 [scrollbar-gutter:stable] ${cursorClass}`}
        onClick={handleBackgroundClick}
        onMouseMove={handleOverlayHover}
        onMouseLeave={clearHoveredStrip}
      >
      {/*
        바깥 박스는 "확대된 크기만큼의 자리"를 차지한다. transform: scale은 보이는
        크기만 바꾸고 레이아웃 박스는 그대로라, 이 박스가 없으면 스크롤 범위가
        확대율과 어긋난다(25%인데도 100% 크기의 빈 공간이 남는 식).
      */}
      <div
        ref={outerRef}
        className="relative mx-auto"
        style={artboardBoxSize(size, artboardHeight, scale)}
      >
        {/*
          Figma처럼 아트보드 위에 화면 이름을 띄운다. 경계를 알려주는 가장 강한
          단서라, 그림자만으로는 부족한 어두운 테마에서 특히 중요하다.
          확대율과 무관하게 항상 같은 크기로 보이도록 아트보드 바깥에 둔다.
        */}
        <span
          onClick={(event) => event.stopPropagation()}
          className="absolute bottom-full left-0 mb-1 max-w-full truncate text-xs text-content-muted"
        >
          {screenName}
        </span>
        {/*
          아트보드. **자기 배경을 칠하지 않는다** — 페이지 네모를 그리는 것은 root
          프레임의 background 이고, 여기는 크기·배율만 잡는 껍데기다. 둘 다 칠하면
          root 가 아트보드를 꽉 채우지 않는 순간(예: 캔버스에서 root 를 리사이즈해
          box.width 가 Fixed 로 바뀐 경우) 아트보드의 흰 네모가 root 네모 뒤로 드러나
          격자 위에 네모가 둘 겹쳐 보인다.

          폭은 페이지 size로 고정하고, **높이는 minHeight로만 잡아 내용에
          따라 세로로 자란다**(2026-09-11·이슈 #86).

          page.size.height 를 height 로 잠그면 내용이 넘칠 때 흰 아트보드는 거기서
          끝나고 자식만 밖으로 삐져나온다 — 랜딩페이지처럼 첫 화면보다 긴 문서를
          아예 만들 수 없었다. 스키마의 size 설명도 원래 "Screen 크기"(= 창 크기)라
          문서 높이를 뜻한 적이 없다. 코드를 그 문구에 맞춘 것이다.

          가로는 그대로 고정이다. 자식이 넘치면 Figma처럼 밖으로 삐져나가게 둔다.

          display: flex + column 인 이유는 root 때문이다. root 의 box.height 가
          "fill" 일 때 퍼센트로 옮기면 부모가 auto 높이라 CSS 규격상 무효가 되는데,
          flex 아이템으로 두면 canvasLayout.boxStyle 이 flex: 1 0 auto 로 번역해
          "짧으면 첫 화면을 채우고 길면 내용만큼" 이 둘 다 된다.

          scale은 Tailwind 클래스가 아니라 인라인 transform이다 — 확대율이 25% 배수가
          아닌 임의값(예: 57%)까지 가야 Fit/채우기가 여백 없이 정확히 맞는다. 바로 위
          width/height와 같은 부류(스펙에서 계산된 치수)이므로
          docs/DESIGN-TOKEN-RULES.md의 인라인 스타일 금지 예외에 해당한다.
        */}
        <div
          ref={artboardRef}
          className="relative flex flex-col bg-transparent shadow-modal origin-top-left"
          style={{
            width: size.width,
            minHeight: size.height,
            transform: `scale(${scale})`,
          }}
        >
          <RenderNode id={root} />
        </div>

        {/*
          선택 표시. 아트보드 안이 아니라 옆에 둔다 — 안에 두면 선택한 노드의
          opacity·blur를 이 표시까지 함께 받아 흐려진다(#90). 바깥 상자는 확대되지
          않으므로 좌표를 실측값 그대로 쓰고, 테두리도 어느 확대율에서나 2px이다.

          border가 아니라 outline인 이유는 경계 바깥에 그리기 위해서다 — border는
          사각형 안쪽을 2px 먹어 노드의 가장자리를 가린다.

          모서리 반경은 일부러 따라가지 않는다. outline은 요소의 border-radius를
          따라 그려지므로 반경을 얹으면 둥글게 만들 수 있지만, 선택 표시는 노드가
          차지한 영역을 알려주는 편집기 UI라 직사각형 바운딩 박스가 낫다(Figma도
          반경과 무관하게 직사각형으로 그린다).
        */}
        {selectionRect !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute outline-2 outline-offset-1 outline-primary"
            style={selectionRect}
          />
        )}

        {/*
          커서가 올라간 노드 미리보기. 클릭해야 비로소 무엇이 잡히는지 알 수 있던
          것을 올려만 봐도 알게 한다. 무엇을 강조할지는 useHoverRect 가 클릭 규칙
          (resolveClickTarget)을 그대로 불러 정한다 — 둘이 어긋나면 거짓말이 된다.

          선택 표시(2px 실선)와 구별되도록 1px 이고, 선택된 노드에는 그리지 않는다.
        */}
        {previewRect !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute outline-1 outline-offset-1 outline-primary/60"
            style={previewRect}
          />
        )}

        {/* 재는 대상은 빨간 테두리로 따로 표시한다 — 선택 미리보기와 뜻이 다르다. */}
        {measureRect !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute outline-1 outline-offset-1 outline-error"
            style={measureRect}
          />
        )}

        {/*
          Alt(윈도우)/Option(맥) 거리 재기. 지금까지는 두 요소가 얼마나 떨어져
          있는지 알 방법이 없었다 — 패널은 자기 크기와 패딩만 보여 줘서, 형제
          사이나 부모 안쪽 여백은 눈대중으로 맞춰야 했다.

          선택한 노드가 기준이고 커서가 올라간 노드까지를 잰다. 프레임을 고르고
          자식에 커서를 올리면 네 변까지의 거리가 한꺼번에 나온다(안쪽 여백).
          어느 노드를 잡을지는 useHoverRect 가 Alt 를 상세 지정으로 쳐서 정한다 —
          최상위 조상으로 올라가면 부모-자식 사이를 잴 수 없다.
        */}
        {selectionRect !== null &&
          measureRect !== null &&
          measureSegments(selectionRect, measureRect, scale).map((segment) => {
            const badge = segmentBadge(segment);
            return (
              <div key={`${segment.left}:${segment.top}:${segment.horizontal}`}>
                <div
                  aria-hidden
                  className="pointer-events-none absolute bg-error"
                  style={{
                    left: segment.left,
                    top: segment.top,
                    width: segment.width,
                    height: segment.height,
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-control bg-error px-1 py-0.5 text-[10px] font-medium leading-none text-text-on-status tabular-nums"
                  style={badge}
                >
                  {segment.value}
                </div>
              </div>
            );
          })}

        {/*
          노드 끌기(#187)의 놓을 자리. 다른 오버레이와 같은 바깥 상자에 그려 끄는 노드
          원본의 스타일을 건드리지 않는다(#90). 좌표는 resolveCanvasDrop 이 같은 기준으로
          준 값을 그대로 쓴다.

          들어갈 frame 은 점선으로 감싼다 — 삽입선만으로는 "몇 번째"는 보여도 "어느
          frame 안"인지는 안 보인다. 빈 frame 이면 그 frame 자체가 놓을 자리라 면으로
          칠하고 테두리를 실선으로 올린다.
        */}
        {drag.container !== null && drag.indicator?.kind !== "area" && (
          <div
            aria-hidden
            className="pointer-events-none absolute outline-1 outline-offset-1 outline-dashed outline-primary/60"
            style={drag.container}
          />
        )}
        {drag.indicator !== null && (
          <div
            aria-hidden
            className={`pointer-events-none absolute ${
              drag.indicator.kind === "area"
                ? "bg-primary/10 outline-2 outline-offset-1 outline-primary"
                : "rounded-full bg-primary"
            }`}
            style={drag.indicator.rect}
          />
        )}

        {/*
          자식 한가운데 점. 어디까지가 한 아이템인지 알려 준다 — 배경색이 없는
          자식은 경계가 안 보여서, 틈만 표시하면 그 틈이 무엇과 무엇 사이인지
          알 수 없다. 선택한 프레임의 직계 자식에만 찍는다.
        */}
        {centers.map((mark) => (
          <div
            key={`${mark.left}:${mark.top}`}
            aria-hidden
            className="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50"
            style={{ left: mark.left, top: mark.top }}
          />
        ))}

        {/*
          자식 사이의 틈. 띠 전체를 칠하지 않고 **가운데 막대 하나**만 긋는다 —
          간격이 넓을 때 색면이 커지면 내용을 덮는다(피그마도 선 하나다).

          숫자는 막대 **바로 위**에 띄운다. 틈 한가운데 놓았더니 간격이 좁을 때
          배지가 양옆 내용 위로 삐져나가 글자를 가렸다. 위로 올리면 틈의 폭과
          무관하게 항상 빈 곳에 놓인다.

          값은 스펙 px 이라 확대해도 안 변하고, 배지·막대도 확대되지 않는 바깥
          상자에 있어 어느 배율에서나 같은 크기로 읽힌다.
        */}
        {strips.map((strip) => {
          const hovered = sameStrip(strip, hoveredStrip);
          const bar = stripBar(strip);
          const badge = badgeAnchor(strip);
          return (
            <div key={`${strip.left}:${strip.top}:${strip.vertical}`}>
              <div
                aria-hidden
                className={`pointer-events-none absolute rounded-full ${
                  hovered ? "bg-primary" : "bg-primary/35"
                }`}
                style={bar}
              />
              {hovered && (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -translate-x-1/2 rounded-control bg-primary px-1.5 py-0.5 text-xs font-medium text-text-on-accent tabular-nums ${
                    // 세로 띠는 좁은 축이 가로라 띠 위로 빼고, 가로 띠는 좁은 축이
                    // 세로라 틈 한가운데에 둔다(badgeAnchor 주석).
                    badge.above ? "-translate-y-full" : "-translate-y-1/2"
                  }`}
                  style={{ left: badge.left, top: badge.top }}
                >
                  {strip.value}
                </div>
              )}
            </div>
          );
        })}
      </div>

      </main>

      {/*
        표시 전용 배지. 스크롤 컨테이너 **바깥**에 둔다 — 안에 두면 absolute 라도
        내용과 함께 흘러가서, 아트보드가 길어진 뒤(#86) 스크롤을 내리면 배율이
        화면 밖으로 사라진다. pointer-events-none 이라 클릭은 캔버스로 내려가고,
        바깥에 있으니 바탕 클릭 핸들러(노드 생성)에도 닿지 않는다.
      */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
        <span className="rounded-control bg-surface-raised px-2 py-1 text-xs text-content-muted shadow-card">
          {Math.round(zoom)}%
        </span>
      </div>

      {/*
        컨텍스트 메뉴(#152)는 여기 둔다 — transform이 걸린 조상(아트보드) 밖이라
        position: fixed가 진짜 뷰포트 기준으로 뜬다. transform이 있는 조상 안에
        두면 fixed가 그 조상 기준으로 다시 잡혀 커서 좌표와 어긋난다.
      */}
      {contextMenuTarget !== null && (
        <ContextMenu
          state={contextMenuTarget}
          entries={buildNodeContextMenuEntries(contextMenuTarget.nodeId)}
          onClose={() => useContextMenuStore.getState().close()}
        />
      )}
    </div>
  );
}
