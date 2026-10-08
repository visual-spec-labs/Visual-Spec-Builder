import type { CSSProperties, MouseEvent } from "react";

import { useExportStore } from "@/features/editor/store/exportStore";
import { PANEL_RAIL_WIDTH } from "@/features/editor/store/panelLayout";
import { useViewStore } from "@/features/editor/store/viewStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { Canvas } from "@/features/editor/ui/Canvas";
import { shouldSuppressContextMenu } from "@/features/editor/ui/canvasInput";
import { ExportPanel } from "@/features/editor/ui/ExportPanel";
import { LayerTree } from "@/features/editor/ui/LayerTree";
import { MenuBar } from "@/features/editor/ui/MenuBar";
import { NaturalLanguageBar } from "@/features/editor/ui/NaturalLanguageBar";
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
 *
 * 캔버스 아래 **3열 전폭** 행 하나가 자연어 입력창이다(#155, docs/08 6.3 결정).
 * 높이가 `auto`인 이유는 그 행의 내용(적용 대상 · 입력칸 · 결과 한 줄)이 상태에
 * 따라 늘고 줄기 때문이다 — 고정 높이로 잡으면 결과 문장이 길 때 잘린다.
 * 좌우 패널을 접어도 이 행은 그대로 남는다(폭이 3열 전체라 컬럼 접힘과 무관하다).
 */
export function EditorLayout() {
  const showPanels = useViewStore((s) => s.showPanels);
  const treeCollapsed = useViewStore((s) => s.treeCollapsed);
  const treeWidth = useViewStore((s) => s.treeWidth);
  const propsCollapsed = useViewStore((s) => s.propsCollapsed);
  const propsWidth = useViewStore((s) => s.propsWidth);
  const showTickets = useTicketStore((s) => s.isOpen);
  // 코드 Export 패널이 구현 티켓 패널보다 앞선다 — 둘 다 열려 있으면 **방금 연 쪽**이
  // Export다(티켓을 보다가 내보내는 순서라서). 닫으면 그대로 티켓 패널로 돌아간다.
  const showExport = useExportStore((s) => s.isOpen);

  // 패널 폭은 이제 사용자가 드래그로 바꾸는 런타임 값이라 CSS 토큰(고정값 전용,
  // DESIGN-TOKEN-RULES.md)이 아니라 인라인 스타일로 계산한다 — Canvas.tsx의 노드
  // 크기·위치와 같은 자리다(#287, docs/22-panel-collapse-resize.md "결정" 5번).
  // 전체 토글(showPanels)이 꺼지면 0 — 개별 접힘(treeCollapsed/propsCollapsed)은
  // 레일 폭(PANEL_RAIL_WIDTH), 둘 다 아니면 사용자가 맞춘 폭이다.
  function columnWidth(collapsed: boolean, width: number): number {
    if (!showPanels) return 0;
    return collapsed ? PANEL_RAIL_WIDTH : width;
  }
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${columnWidth(treeCollapsed, treeWidth)}px 1fr ${columnWidth(propsCollapsed, propsWidth)}px`,
  };

  return (
    // overflow-hidden 이 필요하다. transform 은 레이아웃 박스를 바꾸지 않지만
    // **문서의 스크롤 영역은 넓힌다** — 하단 도구 모음이 숨을 때 아래로 밀려나면서
    // 페이지 전체가 스크롤 가능해지고, 한 번 더 내리면 앱이 통째로 위로 밀린다.
    // 앱 셸은 화면 크기에 딱 맞아야 하므로 여기서 잘라낸다.
    <div
      onContextMenu={handleContextMenu}
      style={gridStyle}
      className="relative grid h-screen w-screen overflow-hidden grid-rows-[var(--layout-menubar-height)_1fr_auto] [grid-template-areas:'menu_menu_menu'_'tree_canvas_props'_'ai_ai_ai'] bg-surface-sunken text-content"
    >
      <MenuBar />
      {showPanels && <LayerTree />}
      <Canvas />
      {showPanels &&
        (showExport ? <ExportPanel /> : showTickets ? <TicketPanel /> : <PropertiesPanel />)}
      <Toolbar />
      <NaturalLanguageBar />
    </div>
  );
}
