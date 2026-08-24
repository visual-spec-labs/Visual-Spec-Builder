import { Canvas } from "@/features/editor/ui/Canvas";
import { LayerTree } from "@/features/editor/ui/LayerTree";
import { MenuBar } from "@/features/editor/ui/MenuBar";
import { PropertiesPanel } from "@/features/editor/ui/PropertiesPanel";
import { Toolbar } from "@/features/editor/ui/Toolbar";

/**
 * 에디터 전체 레이아웃 골격.
 * docs/04-gui-spec.md의 5개 영역(상단 메뉴바 / 좌측 레이어 트리 / 중앙 캔버스 /
 * 우측 세부설정 패널 / 하단 도구 모음)을 CSS Grid로 배치한다.
 * 지금 단계에서는 기능 없이 자리만 잡는다.
 */
export function EditorLayout() {
  return (
    <div className="relative grid h-screen w-screen grid-cols-[var(--layout-tree-width)_1fr_var(--layout-props-width)] grid-rows-[var(--layout-menubar-height)_1fr] [grid-template-areas:'menu_menu_menu'_'tree_canvas_props'] bg-surface-sunken text-content">
      <MenuBar />
      <LayerTree />
      <Canvas />
      <PropertiesPanel />
      <Toolbar />
    </div>
  );
}
