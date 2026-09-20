import type { MouseEvent } from "react";

import { useViewStore } from "@/features/editor/store/viewStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { Canvas } from "@/features/editor/ui/Canvas";
import { shouldSuppressContextMenu } from "@/features/editor/ui/canvasInput";
import { LayerTree } from "@/features/editor/ui/LayerTree";
import { MenuBar } from "@/features/editor/ui/MenuBar";
import { PropertiesPanel } from "@/features/editor/ui/PropertiesPanel";
import { Toolbar } from "@/features/editor/ui/Toolbar";
import { TicketPanel } from "@/features/editor/ui/TicketPanel";

/**
 * 브라우저 기본 우클릭 메뉴를 막는다 — 입력란만 빼고(#138).
 *
 * window 리스너가 아니라 앱 셸에 거는 이유는 **막히는 범위가 코드에서 보이기**
 * 때문이다. 나중에 캔버스에만 커스텀 메뉴를 붙일 때(후속 이슈) 어디까지가 이미
 * 막힌 영역인지 읽힌다.
 *
 * 개발자 도구의 "검사"가 우클릭으로 안 열리지만 F12·Ctrl+Shift+I 는 그대로다.
 */
function handleContextMenu(event: MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement | null;
  const suppress = shouldSuppressContextMenu(
    target?.tagName,
    target?.isContentEditable ?? false,
  );
  if (suppress) event.preventDefault();
}

/**
 * 에디터 전체 레이아웃 골격.
 * docs/04-gui-spec.md의 5개 영역(상단 메뉴바 / 좌측 레이어 트리 / 중앙 캔버스 /
 * 우측 세부설정 패널 / 하단 도구 모음)을 CSS Grid로 배치한다.
 * View 메뉴의 Panels/Sidebars 토글에 따라 좌우 패널 컬럼을 접는다.
 */
export function EditorLayout() {
  const showPanels = useViewStore((s) => s.showPanels);
  const showTickets = useTicketStore((s) => s.isOpen);

  const gridColsClass = showPanels
    ? "grid-cols-[var(--layout-tree-width)_1fr_var(--layout-props-width)]"
    : "grid-cols-[var(--layout-tree-width-collapsed)_1fr_var(--layout-props-width-collapsed)]";

  return (
    // overflow-hidden 이 필요하다. transform 은 레이아웃 박스를 바꾸지 않지만
    // **문서의 스크롤 영역은 넓힌다** — 하단 도구 모음이 숨을 때 아래로 밀려나면서
    // 페이지 전체가 스크롤 가능해지고, 한 번 더 내리면 앱이 통째로 위로 밀린다.
    // 앱 셸은 화면 크기에 딱 맞아야 하므로 여기서 잘라낸다.
    <div
      onContextMenu={handleContextMenu}
      className={`relative grid h-screen w-screen overflow-hidden ${gridColsClass} grid-rows-[var(--layout-menubar-height)_1fr] [grid-template-areas:'menu_menu_menu'_'tree_canvas_props'] bg-surface-sunken text-content`}
    >
      <MenuBar />
      {showPanels && <LayerTree />}
      <Canvas />
      {showPanels && (showTickets ? <TicketPanel /> : <PropertiesPanel />)}
      <Toolbar />
    </div>
  );
}
