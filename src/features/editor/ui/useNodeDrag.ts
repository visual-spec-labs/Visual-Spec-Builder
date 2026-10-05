import { resolveResponsiveScreen } from "@/features/editor/responsive/resolveResponsive";
import { useResponsiveViewStore } from "@/features/editor/responsive/responsiveViewStore";
import { useEffect, useState, type RefObject } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import type { NodeId } from "@/features/editor/schema";

import { resolveCanvasDrop, type CanvasDropTarget } from "./canvasDrop";
import { canStartNodeDrag, hasPassedDragThreshold } from "./canvasInput";
import { measureNodeRects } from "./canvasOverlays";
import { resolveDragTarget } from "./selection";
import { sameRect, type Rect } from "./selectionRect";

/** 끄는 동안 오버레이가 그릴 것. */
export interface NodeDragView {
  /** 끌기가 시작됐는가(임계값을 넘었고 아직 놓거나 취소하지 않았다). 커서가 이걸 본다. */
  dragging: boolean;
  /**
   * 놓으면 들어갈 자리. `line`은 형제 사이 삽입선, `area`는 빈 frame 전체 강조다.
   * 놓을 곳이 없으면(판정이 null) null — 놓아도 아무 일이 없다.
   */
  indicator: { rect: Rect; kind: "line" | "area" } | null;
  /** 들어갈 frame의 사각형. 삽입선만으로는 "어느 frame 안인가"가 안 보여 함께 그린다. */
  container: Rect | null;
}

const IDLE: NodeDragView = { dragging: false, indicator: null, container: null };

/**
 * 캔버스에서 노드를 끌어 형제 순서·부모를 바꾼다(#187).
 *
 * 스키마에 x/y가 없어(v0.1은 Auto Layout 전용) 좌표를 옮기는 게 아니라 "몇 번째
 * 자리인가"를 바꾼다. 자리는 `resolveCanvasDrop`이 정하고, 놓으면 `moveNode` 한 번
 * — Command Engine을 거치므로 Undo 도 한 단계다. 레이어 트리 끌기(#123)와 같은 동작을
 * 캔버스에서 하는 것이다.
 *
 * **시작·무시 판단은 canvasInput의 순수 함수가 한다**(`canStartNodeDrag`·
 * `hasPassedDragThreshold`). 여기는 리스너 배선과 동작만 있다 — jsdom이 없어 이
 * 훅은 테스트할 수 없으므로, 회귀가 나기 쉬운 판단은 전부 저쪽에 둔다.
 *
 * 흐름은 셋이다.
 *
 *   1. **pending** — 왼쪽 버튼으로 노드를 눌렀다. 아직 클릭인지 끌기인지 모른다.
 *      임계값 안에서 떼면 아무것도 안 하고 빠진다 — 뒤따르는 click 이 지금과 똑같이
 *      선택을 처리한다.
 *   2. **dragging** — 임계값을 넘었다. 그 노드를 선택하고, 매 프레임 사각형을 다시
 *      재서 놓을 자리를 판정한다. 놓으면 커밋하고 뒤따르는 click 을 죽인다.
 *   3. **cancelled** — 끄는 중에 Esc. 표시를 지우고 커밋하지 않는다. 버튼은 아직
 *      눌려 있으므로 mouseup 과 그 뒤 click 까지는 계속 붙잡고 있어야 한다.
 *
 * 무엇을 잡는지는 `resolveDragTarget`이 정한다. 기본은 클릭과 같은 규칙이다
 * (`handleNodeClick`과 같은 `clickBoundary` + `resolveClickTarget`) — 평소 클릭은 덩어리,
 * Ctrl/Cmd는 가장 안쪽, 더블클릭으로 들어간 문맥(#151)이면 그 안 자식. 단 이미 선택된
 * 노드 위에서 수식키 없이 끌면 그 선택된 노드를 끈다(피그마와 같다). 결과가 root면
 * 끌지 않는다(root는 옮길 수 없다).
 *
 * mousedown 에 preventDefault 를 걸지 않는다. 걸면 포커스가 옮겨 가지 않아, 속성 패널
 * 입력칸을 고치던 중 캔버스를 눌러도 blur(= 값 확정)가 일어나지 않는다. 대신 끄는
 * 동안의 글자 선택은 `selectstart`를 막아 처리한다.
 */
export function useNodeDrag(
  mainRef: RefObject<HTMLElement | null>,
  outerRef: RefObject<HTMLDivElement | null>,
  artboardRef: RefObject<HTMLDivElement | null>,
): NodeDragView {
  const [view, setView] = useState<NodeDragView>(IDLE);

  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;

    /** 지금 누르고 있는 끌기. 없으면 null. */
    let session: {
      dragId: NodeId;
      phase: "pending" | "dragging" | "cancelled";
      startX: number;
      startY: number;
      /** 마지막 커서 위치(뷰포트 좌표). 커서가 멈춘 채 스크롤·줌이 일어나도 다시 판정한다. */
      clientX: number;
      clientY: number;
      target: CanvasDropTarget | null;
      frame: number | null;
    } | null = null;

    function handleMouseDown(event: MouseEvent) {
      if (session !== null) return;

      const from = event.target instanceof Element ? event.target : null;
      const { activeTool, toolBeforeSpace } = useToolStore.getState();
      const allowed = canStartNodeDrag({
        button: event.button,
        tool: activeTool,
        spacePanning: toolBeforeSpace !== null,
        onResizeHandle: from?.closest("[data-resize-handle]") != null,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        tagName: from?.tagName,
        contentEditable: from instanceof HTMLElement && from.isContentEditable,
      });
      if (!allowed) return;

      const artboard = artboardRef.current;
      const hit = from?.closest("[data-node-id]");
      if (artboard === null || !(hit instanceof HTMLElement) || !artboard.contains(hit)) return;
      const clickedId = hit.dataset.nodeId;
      if (clickedId === undefined) return;

      const { spec, activePageId, focusRootId, selectedId } = useEditorStore.getState();
      const page = spec.pages[activePageId];
      const { nodes, root } = resolveResponsiveScreen(page, useResponsiveViewStore.getState().widths[activePageId] ?? page.size.width);
      const dragId = resolveDragTarget({
        nodes,
        root,
        clickedId,
        deep: event.metaKey || event.ctrlKey,
        focusRootId,
        selectedId,
      });
      if (dragId === root) return;

      session = {
        dragId,
        phase: "pending",
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        target: null,
        frame: null,
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      // capture — canvasKeys의 Esc(선택 해제)보다 먼저 받아 끌기 취소로만 끝낸다.
      window.addEventListener("keydown", handleKeyDown, { capture: true });
      window.addEventListener("blur", handleBlur);
      document.addEventListener("selectstart", preventSelect);
    }

    function handleMove(event: MouseEvent) {
      if (session === null) return;
      // 창 밖에서 버튼을 떼면 mouseup이 안 올 수 있다 — 팬·리사이즈와 같은 방어.
      // 어디에 놓았는지 모르므로 커밋하지 않는다.
      if (event.buttons === 0) {
        finish(false);
        return;
      }
      session.clientX = event.clientX;
      session.clientY = event.clientY;

      if (session.phase !== "pending") return;
      if (!hasPassedDragThreshold(event.clientX - session.startX, event.clientY - session.startY)) {
        return;
      }

      session.phase = "dragging";
      // 끄는 것이 무엇인지 선택 표시로 보여 준다. 원본 노드에 opacity 따위를 입히지
      // 않는 이유는 선택 표시를 문서 트리 밖에 그리는 이유(#90)와 같다.
      useEditorStore.getState().select(session.dragId);
      // 임계값을 넘기 전에 시작된 글자 선택이 남아 있으면 지운다.
      window.getSelection()?.removeAllRanges();
      // 놓은 뒤 브라우저가 합성하는 click 은 누른 곳과 뗀 곳의 공통 조상에서 터진다 —
      // 그대로 두면 handleNodeClick/handleBackgroundClick 이 방금 옮긴 선택을 바꾼다.
      // 리사이즈(startResize)와 같은 capture·once 패턴으로 한 번 죽인다.
      window.addEventListener("click", suppressClick, { capture: true, once: true });
      tick();
    }

    /**
     * 매 프레임 다시 재고 다시 판정한다.
     *
     * 이동 이벤트에서만 재면 커서를 멈춘 채 휠로 스크롤하거나 Ctrl+휠로 확대했을 때
     * 낡은 사각형이 남아 인디케이터가 엉뚱한 자리에 머문다(useRectOf 주석의 그 버그).
     * 끄는 동안에만 도는 루프이고, 결과가 같으면 상태를 바꾸지 않는다.
     */
    function tick() {
      if (session === null || session.phase !== "dragging") return;
      update();
      session.frame = requestAnimationFrame(tick);
    }

    function update() {
      const outer = outerRef.current;
      const artboard = artboardRef.current;
      if (session === null || outer === null || artboard === null) return;

      const rects = measureNodeRects(outer, artboard);
      const origin = outer.getBoundingClientRect();
      const { spec, activePageId } = useEditorStore.getState();
      const page = spec.pages[activePageId];
      const { nodes, root } = resolveResponsiveScreen(page, useResponsiveViewStore.getState().widths[activePageId] ?? page.size.width);

      const target = resolveCanvasDrop({
        nodes,
        rootId: root,
        dragId: session.dragId,
        point: { x: session.clientX - origin.left, y: session.clientY - origin.top },
        rects,
      });
      session.target = target;

      const container = target === null ? null : (rects[target.newParentId] ?? null);
      const next: NodeDragView = {
        dragging: true,
        indicator:
          target === null
            ? null
            : {
                rect: target.indicator,
                // 판정기는 빈 frame이면 그 frame 사각형을 그대로 돌려준다.
                kind: sameRect(target.indicator, container) ? "area" : "line",
              },
        container,
      };
      setView((prev) => (sameView(prev, next) ? prev : next));
    }

    function handleUp() {
      finish(true);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (session === null || session.phase !== "dragging" || event.key !== "Escape") return;
      // 선택 해제(canvasKeys의 deselect)까지 가지 않게 여기서 끝낸다.
      event.preventDefault();
      event.stopImmediatePropagation();
      stopLoop();
      session.phase = "cancelled";
      session.target = null;
      setView(IDLE);
    }

    function handleBlur() {
      // 창을 떠나면 버튼을 뗀 것도 모른다. 커밋 없이 끝낸다.
      finish(false);
    }

    function finish(commit: boolean) {
      if (session === null) return;
      const { dragId, phase, target } = session;
      stopLoop();
      session = null;

      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("selectstart", preventSelect);
      if (phase !== "pending") {
        // click 은 mouseup 뒤 같은 흐름에서 이어 온다 — 지금 떼면 못 잡는다. 오면 once 가
        // 스스로 떼고, 안 오면(창 밖에서 뗌·blur) 다음 매크로태스크에 뗀다. startResize와 같다.
        setTimeout(() => window.removeEventListener("click", suppressClick, { capture: true }), 0);
        setView(IDLE);
      }

      if (commit && phase === "dragging" && target !== null && !target.unchanged) {
        useEditorStore.getState().moveNode(dragId, target.newParentId, target.index);
      }
    }

    function stopLoop() {
      if (session?.frame != null) cancelAnimationFrame(session.frame);
      if (session !== null) session.frame = null;
    }

    main.addEventListener("mousedown", handleMouseDown);
    return () => {
      main.removeEventListener("mousedown", handleMouseDown);
      finish(false);
    };
  }, [mainRef, outerRef, artboardRef]);

  return view;
}

function suppressClick(event: MouseEvent) {
  event.stopPropagation();
}

function preventSelect(event: Event) {
  event.preventDefault();
}

function sameView(a: NodeDragView, b: NodeDragView): boolean {
  return (
    a.dragging === b.dragging &&
    sameRect(a.container, b.container) &&
    sameRect(a.indicator?.rect ?? null, b.indicator?.rect ?? null) &&
    a.indicator?.kind === b.indicator?.kind
  );
}
