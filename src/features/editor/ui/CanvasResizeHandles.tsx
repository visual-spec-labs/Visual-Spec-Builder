import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { Box, NodeId } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useMeasureStore } from "@/features/editor/store/measureStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import { resizedValue } from "./canvasLayout";
import { clearToolbarFocusHandoff } from "./canvasSelection";
import { createResizeGesture, type ResizeTarget } from "./resizeGesture";

/** 우측(e) · 하단(s) · 우하단(se) 세 방향만 지원한다 — ResizeHandles 주석 참고. */
type ResizeEdge = "e" | "s" | "se";

const RESIZE_HANDLE_SIZE = 8;

/**
 * 리사이즈 드래그를 시작한다. Hand 도구 팬(Canvas의 useEffect)과 달리 끄는 동안만
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
  // 리사이즈 핸들을 끄는 것도 캔버스 포인터 조작의 재개다 — 선택은 바뀌지
  // 않지만(이미 선택된 노드에만 핸들이 뜬다) 클릭 없이 바로 끌 수 있어
  // canvasSelection.ts의 네 핸들러를 거치지 않는다(#275 리뷰 6차 대응).
  clearToolbarFocusHandoff();

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
  // 끌기 한 번 = undo 한 단계(#207). 값이 바뀐 첫 커밋만 새 단계를 만든다.
  const gesture = createResizeGesture({ width: startWidth, height: startHeight });

  function handleMove(moveEvent: MouseEvent) {
    // 창 밖에서 버튼을 떼면 mouseup이 여기까지 안 온다 — 팬과 같은 방어.
    if (moveEvent.buttons === 0) {
      end();
      return;
    }

    const target: ResizeTarget = {};
    if (edge === "e" || edge === "se") {
      target.width = resizedValue(startWidth, moveEvent.clientX - startX, zoom);
    }
    if (edge === "s" || edge === "se") {
      target.height = resizedValue(startHeight, moveEvent.clientY - startY, zoom);
    }

    const { setNodeField, setPageField } = useEditorStore.getState();
    for (const { axis, value, continueEdit } of gesture.commits(target)) {
      if (isRoot) setPageField(activePageId, `size.${axis}`, value, continueEdit);
      else setNodeField(id, `box.${axis}`, value, continueEdit);
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
export function ResizeHandles({ id, box }: { id: NodeId; box: Box }) {
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

