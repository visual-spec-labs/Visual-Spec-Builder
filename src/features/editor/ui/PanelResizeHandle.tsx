import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "@/features/editor/store/panelLayout";

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
  onResize,
  onCommit,
  label,
}: {
  side: "left" | "right";
  width: number;
  /** 드래그 중(mousemove)·키 조절마다 부른다 — state만 바꾼다(저장 안 함). */
  onResize: (nextWidth: number) => void;
  /** 드래그가 끝나거나(mouseup) 키 조절 한 번이 끝났을 때 한 번 불러 저장한다. */
  onCommit: () => void;
  label: string;
}) {
  const sign = side === "right" ? 1 : -1;

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

    function end() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", end);
      // 드래그 내내 mousemove마다 localStorage에 쓰지 않는다(자체 code-review
      // 대응) — 끝났을 때 한 번만 저장한다.
      onCommit();
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", end);
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
      aria-valuemax={MAX_PANEL_WIDTH}
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
