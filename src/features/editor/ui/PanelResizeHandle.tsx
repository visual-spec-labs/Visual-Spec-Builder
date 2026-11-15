import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";

import { MIN_PANEL_WIDTH } from "@/features/editor/store/panelLayout";

/** 키보드로 한 번 누를 때 늘고 주는 폭(px). */
const KEYBOARD_STEP = 16;

/**
 * 레이어 트리·속성 패널이 공유하는 드래그 리사이즈 핸들(#287).
 *
 * `CanvasResizeHandles.tsx`와 같은 mousedown → window mousemove/mouseup
 * 구조다 — 다만 그쪽은 줌 배율 보정과 undo 묶음(`createResizeGesture`)이
 * 필요한 캔버스 노드 크기 조절이고, 이쪽은 화면 크롬(패널 폭)이라 그런
 * 보정이 필요 없다. 드래그 중에는 전역 리스너만 쓰고, 뗄 때 정리한다.
 *
 * `side`가 드래그 방향의 부호를 가른다 — 레이어 트리는 오른쪽 경계라 오른쪽
 * 으로 끌수록 넓어지고(`side="right"`), 속성 패널은 왼쪽 경계라 왼쪽으로
 * 끌수록 넓어진다(`side="left"`).
 */
export function PanelResizeHandle({
  side,
  width,
  maxWidth,
  onResize,
  onCommit,
  label,
}: {
  side: "left" | "right";
  width: number;
  /**
   * 지금 창 폭·반대쪽 패널 기준의 실제 상한(#287 리뷰 5차 대응,
   * `usePanelResize.ts`의 `maxWidth` 참고) — `aria-valuemax`에 정적
   * `MAX_PANEL_WIDTH`를 그대로 공표하면, 반대쪽 패널 때문에 실제로는
   * 더 못 늘어나는데도 스크린 리더가 "더 늘릴 수 있다"고 말해 버린다.
   */
  maxWidth: number;
  /** 드래그 중(mousemove)·키 조절마다 부른다 — state만 바꾼다(저장 안 함). */
  onResize: (nextWidth: number) => void;
  /** 드래그가 끝나거나(mouseup) 키 조절 한 번이 끝났을 때 한 번 불러 저장한다. */
  onCommit: () => void;
  label: string;
}) {
  const sign = side === "right" ? 1 : -1;

  // 드래그 도중 이 컴포넌트가 언마운트되면(패널이 접히거나, 홈으로 나가거나,
  // showPanels가 꺼지는 등) window 리스너는 DOM 노드의 생사와 무관하므로
  // 그대로 남아 mousemove마다 계속 폭을 바꾼다(#287 리뷰 대응 — "비차단
  // 관찰"). 지금 드래그를 끝내는 함수를 ref에 쥐고 있다가 언마운트 시
  // 한 번 불러 정리한다.
  const endDragRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => endDragRef.current?.();
  }, []);

  function handleMouseDown(event: ReactMouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: MouseEvent) {
      if (moveEvent.buttons === 0) {
        end();
        return;
      }
      onResize(startWidth + sign * (moveEvent.clientX - startX));
    }

    // mousedown에서 stopPropagation해도 뒤이어 브라우저가 합성하는 click은
    // 막지 못한다(`CanvasResizeHandles.tsx`와 같은 이유) — 레이어 트리를
    // 넓히는 드래그는 커서가 바로 Canvas 쪽으로 넘어가며 끝나기 쉬운데, 그
    // 자리에서 뜨는 click이 Canvas의 배경 클릭(선택 해제) 또는 Frame/Text
    // 도구의 새 노드 삽입을 건드린다(자체 code-review 대응). capture
    // 단계에서 한 번만 가로채 죽인다.
    function suppressClick(clickEvent: MouseEvent) {
      clickEvent.stopPropagation();
    }

    function end() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", end);
      endDragRef.current = null;
      // 드래그 내내 mousemove마다 localStorage에 쓰지 않는다(자체 code-review
      // 대응) — 끝났을 때 한 번만 저장한다.
      onCommit();
      // click은 mouseup 뒤 브라우저가 같은 동기 흐름 안에서 이어서 내보낸다 —
      // 그 click을 잡아야 하니 여기서 곧바로 떼면 안 된다. once가 실제로
      // 클릭이 오면 스스로 정리하고, 클릭이 안 오는 예외 상황을 대비해 다음
      // 매크로태스크에서 한 번 더 방어적으로 뗀다.
      setTimeout(() => window.removeEventListener("click", suppressClick, { capture: true }), 0);
    }

    endDragRef.current = () => {
      end();
      window.removeEventListener("click", suppressClick, { capture: true });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", end);
    window.addEventListener("click", suppressClick, { capture: true, once: true });
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowLeft") {
      onResize(width - (side === "right" ? KEYBOARD_STEP : -KEYBOARD_STEP));
    } else if (event.key === "ArrowRight") {
      onResize(width + (side === "right" ? KEYBOARD_STEP : -KEYBOARD_STEP));
    } else {
      return;
    }
    event.preventDefault();
    // 키 입력 한 번은 그 자체로 완결된 조절이다(드래그처럼 연속 이벤트가
    // 아니다) — 바로 저장한다.
    onCommit();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      // 부모 <aside>가 overflow-hidden이라(자체 code-review 대응) 경계 바깥으로
      // 반쯤 튀어나오게 두면(translate-x-1/2 등) 그 바깥 절반은 클릭도 hover도
      // 안 먹는다 — 패널 안쪽에 완전히 들어오도록 translate 없이 right-0/left-0
      // 그대로 둔다.
      className={`absolute top-0 bottom-0 z-10 w-1 cursor-ew-resize ${
        side === "right" ? "right-0" : "left-0"
      } hover:bg-primary focus-visible:bg-primary focus-visible:outline-none`}
    />
  );
}
