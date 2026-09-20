import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";

import { createNode, type NodeKind } from "@/features/editor/store/createNode";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { useMeasureStore } from "@/features/editor/store/measureStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import type { Box, NodeId, PageId } from "@/features/editor/schema";

import { isScrolledToBottom, toolCursorClass } from "./canvasInput";
import {
  badgeAnchor,
  sameStrip,
  stripAtPoint,
  stripBar,
  type GapStrip,
} from "./gapStrips";
import { artboardBoxSize, resizedValue, type Direction } from "./canvasLayout";
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
import {
  buttonStyle,
  frameStyle,
  imageStyle,
  inputStyle,
  textStyle,
} from "./nodeStyles";
import { resolveClickTarget, resolveInsertParent } from "./selection";

/**
 * 중앙 캔버스.
 *
 * ⚠️ 임시 스탠드인: 패널 편집이 즉시 반영되는지 눈으로 확인하려고 만든 최소 렌더러.
 * 팀원(캔버스 담당)이 정식 구현으로 교체할 예정. 계약은 spec을 읽고, 클릭 시 select(),
 * 드래그/리사이즈 시 setNodeField를 부르면 된다. 참고: docs/EDITOR_STORE_CONTRACT.md
 *
 * 이 주석은 **이 파일에 있어야 한다.** `docs/07-implementation-status.md` 와
 * `docs/06-schema-freeze.md`, 그리고 `ui/homePreview.ts` 가 "Canvas.tsx 상단 주석이
 * 스스로를 임시 스탠드인이라 밝힌다"를 근거로 삼는다 — 옮기거나 지우면 네 곳이
 * 한꺼번에 거짓이 된다(2026-09-19·이슈 #148 분할 때 실제로 그랬다).
 *
 * 분할된 이웃들: `nodeStyles.ts`(노드 타입별 CSS 조립) · `canvasOverlays.ts`(측정 훅)
 * · `canvasZoom.ts`(줌 앵커·Alt) · `canvasKeys.ts`(키보드 배선).
 */

/**
 * 선택된 노드가 실제로 몇 px로 그려졌는지 재서 스토어에 올린다.
 * transform: scale은 offsetWidth/Height에 영향을 주지 않으므로 줌과 무관한 실측값이다.
 */
function useReportMeasuredSize(
  ref: RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    const element = ref.current;
    if (!active || element === null) return;

    function report() {
      if (element === null) return;
      useMeasureStore.getState().setSize({
        width: Math.round(element.offsetWidth),
        height: Math.round(element.offsetHeight),
      });
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      observer.disconnect();
      useMeasureStore.getState().setSize(null);
    };
  }, [ref, active]);
}

/** 새 노드를 만들어 부모에 붙이고, 도구를 Select로 되돌린다. */
function insertNewNode(kind: NodeKind, parentId: NodeId) {
  const { spec, activePageId, insertNode } = useEditorStore.getState();
  const { nodes } = spec.pages[activePageId];
  insertNode(parentId, generateNodeId(kind, nodes), createNode(kind));
  // 피그마와 같은 흐름 — 하나 만들면 바로 그것을 만질 수 있게 선택 도구로 돌아온다.
  useToolStore.getState().setActiveTool("select");
}

/**
 * 노드를 클릭했을 때 활성 도구에 따라 무엇을 할지 정한다.
 *
 * 스토어를 구독하는 대신 getState로 읽는다 — 재귀 렌더 트리의 모든 노드에
 * 핸들러를 내려보내거나 도구가 바뀔 때마다 트리 전체를 다시 그리지 않기 위해서다.
 */
function handleNodeClick(clickedId: NodeId, event: ReactMouseEvent) {
  // 중첩된 부모의 핸들러까지 함께 실행되면 어느 노드를 클릭했는지 알 수 없다.
  event.stopPropagation();

  const tool = useToolStore.getState().activeTool;
  if (tool === "hand") return; // 팬 전용 도구 — 선택을 바꾸지 않는다

  const { spec, activePageId, select } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];

  if (tool === "frame" || tool === "text") {
    insertNewNode(tool, resolveInsertParent({ nodes, root, clickedId }));
    return;
  }

  // Select 도구 — Cmd(macOS) / Ctrl(Windows)를 누르면 상세 지정(최하위)
  select(
    resolveClickTarget({
      nodes,
      root,
      clickedId,
      deep: event.metaKey || event.ctrlKey,
    }),
  );
}

/** 아트보드 바깥(캔버스 바탕)을 클릭했을 때. */
function handleBackgroundClick() {
  const tool = useToolStore.getState().activeTool;
  if (tool === "hand") return;

  const { spec, activePageId, select } = useEditorStore.getState();

  if (tool === "frame" || tool === "text") {
    insertNewNode(tool, spec.pages[activePageId].root);
    return;
  }

  select(null);
}

/** 우측(e) · 하단(s) · 우하단(se) 세 방향만 지원한다 — ResizeHandles 주석 참고. */
type ResizeEdge = "e" | "s" | "se";

const RESIZE_HANDLE_SIZE = 8;

/**
 * 리사이즈 드래그를 시작한다. Hand 도구 팬(위 useEffect)과 달리 끄는 동안만
 * 필요한 리스너라 mousedown 시점에 등록하고 mouseup에서 바로 정리한다 — 매
 * 렌더마다 새로 붙였다 뗄 이유가 없는 팬과는 수명이 다르다.
 *
 * 마우스 이동량은 화면 px다. 캔버스 전체가 transform: scale로 확대돼 있어
 * 화면 px과 스펙 px이 다르므로, 시작 시점의 줌 배율로 나눠 보정한다(줌을
 * 끄는 도중에 바꾸는 경로가 없어 시작 값 하나로 충분하다).
 *
 * Fill/Hug처럼 스펙에 숫자가 없는 상태에서 시작하면 measureStore의 실측값을
 * 시작 크기로 삼는다 — SizeField.tsx가 Fixed로 전환할 때 쓰는 것과 같은 값이다.
 * setNodeField가 숫자를 쓰는 순간 box.width/height는 자동으로 Fixed가 된다.
 */
function startResize(event: ReactMouseEvent, id: NodeId, edge: ResizeEdge, box: Box) {
  event.preventDefault();
  event.stopPropagation();

  const zoom = useViewStore.getState().zoom / 100;
  const measured = useMeasureStore.getState().size;

  // root 를 끌면 노드의 box 가 아니라 **페이지 해상도(page.size)** 를 바꾼다.
  //
  // root 는 곧 페이지이고 크기를 정하는 곳은 page.size 하나다(boxStyle 이 root 의
  // box 를 보지 않는 것과 같은 이유). box 에 쓰면 스펙만 바뀌고 화면은 그대로여서
  // 끌어도 아무 일이 안 일어난 것처럼 보인다. 해상도에 쓰면 아트보드가 실제로
  // 커지고 패널의 해상도 칸도 함께 움직인다 — Figma 에서 아트보드를 끄는 것과 같다.
  const { spec, activePageId } = useEditorStore.getState();
  const page = spec.pages[activePageId];
  const isRoot = page.root === id;

  const startWidth = isRoot
    ? page.size.width
    : typeof box.width === "number"
      ? box.width
      : (measured?.width ?? 100);
  const startHeight = isRoot
    ? page.size.height
    : typeof box.height === "number"
      ? box.height
      : (measured?.height ?? 100);
  const startX = event.clientX;
  const startY = event.clientY;

  function handleMove(moveEvent: MouseEvent) {
    // 창 밖에서 버튼을 떼면 mouseup이 여기까지 안 온다 — 팬과 같은 방어.
    if (moveEvent.buttons === 0) {
      end();
      return;
    }

    const { setNodeField, setPageField } = useEditorStore.getState();

    if (edge === "e" || edge === "se") {
      const width = resizedValue(startWidth, moveEvent.clientX - startX, zoom);
      if (isRoot) setPageField(activePageId, "size.width", width);
      else setNodeField(id, "box.width", width);
    }
    if (edge === "s" || edge === "se") {
      const height = resizedValue(startHeight, moveEvent.clientY - startY, zoom);
      if (isRoot) setPageField(activePageId, "size.height", height);
      else setNodeField(id, "box.height", height);
    }
  }

  // mousedown에서 stopPropagation해도 뒤이어 브라우저가 합성하는 click은 막지
  // 못한다. 커서가 드래그 도중 노드 밖(형제나 배경)으로 나가 있으면 그 click이
  // handleNodeClick/handleBackgroundClick을 건드려 방금 만든 선택을 지워버린다
  // — capture 단계에서 한 번만 가로채 죽인다.
  function suppressClick(clickEvent: MouseEvent) {
    clickEvent.stopPropagation();
  }

  function end() {
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", end);
    // click은 mouseup 뒤 브라우저가 같은 동기 흐름 안에서 이어서 내보낸다 —
    // 그 click을 잡아야 하니 여기서 곧바로 떼면 안 된다. once가 실제로 클릭이
    // 오면 스스로 정리하고, 클릭이 안 오는 예외 상황(예: 이 tick 안에 다른
    // 코드가 이벤트 흐름을 끊는 경우)을 대비해 다음 매크로태스크에서 한 번 더
    // 방어적으로 뗀다 — 이미 스스로 떼졌으면 그냥 no-op이다.
    setTimeout(() => window.removeEventListener("click", suppressClick, { capture: true }), 0);
  }

  window.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", end);
  window.addEventListener("click", suppressClick, { capture: true, once: true });
}

const RESIZE_HANDLE_BASE: CSSProperties = {
  position: "absolute",
  background: "#F97316",
  borderRadius: 2,
};

/**
 * 선택된 노드에만 오버레이로 그리는 리사이즈 핸들.
 *
 * 우측·하단·우하단 세 방향만 있다 — 스키마에 x/y(절대좌표)가 없어 노드는 항상
 * 부모 레이아웃 흐름(flex) 안에서만 위치가 정해진다. 좌측·상단으로 "자라는"
 * 핸들을 만들면 실제로는 크기만 커지고 화면상 위치는 그대로라(옮길 좌표 필드가
 * 없다) Figma를 흉내 낸 값싼 흉내가 시각적으로 거짓말을 하게 된다. 그래서
 * box-model이 그대로 지원하는 방향만 남겼다.
 *
 * 부모 요소(RenderNode의 각 분기)가 `position: relative`여야 좌표가 그 노드
 * 기준으로 앉는다 — `resizeAnchor`가 선택 시 같이 얹어준다.
 */
function ResizeHandles({ id, box }: { id: NodeId; box: Box }) {
  const half = RESIZE_HANDLE_SIZE / 2;
  return (
    <>
      <div
        data-resize-handle="e"
        onMouseDown={(event) => startResize(event, id, "e", box)}
        style={{
          ...RESIZE_HANDLE_BASE,
          top: "50%",
          right: -half,
          width: RESIZE_HANDLE_SIZE,
          height: RESIZE_HANDLE_SIZE * 3,
          transform: "translateY(-50%)",
          cursor: "ew-resize",
        }}
      />
      <div
        data-resize-handle="s"
        onMouseDown={(event) => startResize(event, id, "s", box)}
        style={{
          ...RESIZE_HANDLE_BASE,
          left: "50%",
          bottom: -half,
          width: RESIZE_HANDLE_SIZE * 3,
          height: RESIZE_HANDLE_SIZE,
          transform: "translateX(-50%)",
          cursor: "ns-resize",
        }}
      />
      <div
        data-resize-handle="se"
        onMouseDown={(event) => startResize(event, id, "se", box)}
        style={{
          ...RESIZE_HANDLE_BASE,
          right: -half,
          bottom: -half,
          width: RESIZE_HANDLE_SIZE,
          height: RESIZE_HANDLE_SIZE,
          cursor: "nwse-resize",
        }}
      />
    </>
  );
}

function RenderNode({
  id,
  parentDirection,
}: {
  id: NodeId;
  /** 부모 프레임의 레이아웃 방향. 최상위 노드는 부모가 없어 undefined. */
  parentDirection?: Direction;
}) {
  const node = useEditorStore(
    (state) => state.spec.pages[state.activePageId].nodes[id],
  );
  const selectedId = useEditorStore((state) => state.selectedId);
  const ref = useRef<HTMLDivElement>(null);
  const selected = selectedId === id;

  useReportMeasuredSize(ref, selected && node?.visible !== false);

  if (node === undefined || node.visible === false) {
    return null;
  }

  // position: relative는 리사이즈 핸들(ResizeHandles)이 이 노드 기준으로 앉기
  // 위한 것 — 선택 안 됐을 때는 핸들도 안 그리니 필요 없다. 선택 시각 표시
  // 자체는 이 값이 아니라 아래 useSelectionRect 기반 오버레이가 맡는다.
  const resizeAnchor = selected ? { position: "relative" as const } : {};

  if (node.type === "text") {
    return (
      <div
        ref={ref}
        // 스펙상의 노드 id를 DOM에 그대로 남긴다 — 중첩 안쪽을 상세 지정했을 때
        // 어떤 item이 잡혔는지 개발자 도구에서 바로 확인할 수 있다.
        data-node-id={id}
        style={{ ...textStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        {node.content}
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  if (node.type === "image") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...imageStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  if (node.type === "button") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...buttonStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        {node.content}
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  if (node.type === "input") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...inputStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        <span style={{ opacity: 0.6 }}>{node.placeholder}</span>
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-node-id={id}
      style={{ ...frameStyle(node, parentDirection), ...resizeAnchor }}
      onClick={(event) => handleNodeClick(id, event)}
    >
      {node.children.map((child) => (
        <RenderNode
          key={child.node}
          id={child.node}
          parentDirection={node.layout.direction}
        />
      ))}
      {selected && <ResizeHandles id={id} box={node.box} />}
    </div>
  );
}

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
  const anchorRef = useRef<ZoomAnchor | null>(null);
  useZoomAnchor(mainRef, outerRef, artboardRef, anchorRef, zoom);
  useCanvasKeys(mainRef, outerRef, anchorRef);

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
  const cursorClass = toolCursorClass(activeTool, panning);

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
    </div>
  );
}
