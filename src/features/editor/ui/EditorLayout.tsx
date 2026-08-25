import { useViewStore } from "@/features/editor/store/viewStore";
import { Canvas } from "@/features/editor/ui/Canvas";
import { LayerTree } from "@/features/editor/ui/LayerTree";
import { MenuBar } from "@/features/editor/ui/MenuBar";
import { PropertiesPanel } from "@/features/editor/ui/PropertiesPanel";
import { Toolbar } from "@/features/editor/ui/Toolbar";

/**
 * 에디터 전체 레이아웃 골격.
 * docs/04-gui-spec.md의 5개 영역(상단 메뉴바 / 좌측 레이어 트리 / 중앙 캔버스 /
 * 우측 세부설정 패널 / 하단 도구 모음)을 CSS Grid로 배치한다.
 * View 메뉴의 Panels/Sidebars 토글에 따라 좌우 패널 컬럼을 접는다.
 */
export function EditorLayout() {
  const showPanels = useViewStore((s) => s.showPanels);

  const gridColsClass = showPanels
    ? "grid-cols-[var(--layout-tree-width)_1fr_var(--layout-props-width)]"
    : "grid-cols-[var(--layout-tree-width-collapsed)_1fr_var(--layout-props-width-collapsed)]";

  return (
    <div
      className={`relative grid h-screen w-screen ${gridColsClass} grid-rows-[var(--layout-menubar-height)_1fr] [grid-template-areas:'menu_menu_menu'_'tree_canvas_props'] bg-surface-sunken text-content`}
    >
      <MenuBar />
      {showPanels && <LayerTree />}
      <Canvas />
      {showPanels && <PropertiesPanel />}
      <Toolbar />
    </div>
  );
}
