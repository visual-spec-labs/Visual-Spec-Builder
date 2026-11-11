import { useLayoutEffect, useRef, useState } from "react";

import { clampToViewport } from "./contextMenuPosition";
import { MenuList, type MenuEntry } from "./menu";

/** 컨텍스트 메뉴가 뜬 자리(#152). */
export interface ContextMenuState {
  x: number;
  y: number;
}

/**
 * 커서(또는 키보드 트리거) 좌표에 뜨는 컨텍스트 메뉴.
 *
 * MenuBar의 드롭다운(MenuButton)과 항목 렌더링(MenuList)은 공유하지만
 * 앵커링은 다르다 — 저건 버튼 아래 고정, 이건 좌표 고정이라 뷰포트를 벗어날
 * 수 있다. 그래서 일단 `{x, y}`에 그린 뒤(0,0 크기로는 위치를 모르니) 실제
 * 렌더된 크기를 재서 `clampToViewport`로 넘치는 방향만 접는다 —
 * canvasZoom.ts가 확대 뒤 스크롤을 다시 재서 맞추는 것과 같은 방식이다.
 *
 * Esc는 MenuBar.tsx의 선례(2026-09-19 수정)를 그대로 따른다 — 열려 있는
 * 동안만 `document`에 리스너를 붙이고 `stopPropagation`으로 여기서 삼켜,
 * 캔버스의 window 리스너(선택 해제)까지 닿지 않게 한다.
 */
export function ContextMenu({
  state,
  entries,
  onClose,
}: {
  state: ContextMenuState;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: state.x,
    top: state.y,
  });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el === null) return;

    const rect = el.getBoundingClientRect();
    setPosition(
      clampToViewport(
        state.x,
        state.y,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
      ),
    );
    // state.x/y가 바뀌면(다른 노드를 다시 우클릭) 새 좌표로 다시 재야 한다.
  }, [state.x, state.y]);

  useLayoutEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // MenuBar.tsx와 같은 이유로 여기서 삼킨다 — 안 그러면 메뉴만 닫으려고
      // 누른 Escape가 캔버스 선택까지 함께 지운다.
      event.stopPropagation();
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      style={{ position: "fixed", left: position.left, top: position.top, zIndex: 20 }}
    >
      <MenuList entries={entries} onCloseMenu={onClose} />
    </div>
  );
}
