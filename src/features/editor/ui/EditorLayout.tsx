import { Canvas } from "@/features/editor/ui/Canvas";
import { LayerTree } from "@/features/editor/ui/LayerTree";
import { MenuBar } from "@/features/editor/ui/MenuBar";
import { PropertiesPanel } from "@/features/editor/ui/PropertiesPanel";
import { Toolbar } from "@/features/editor/ui/Toolbar";

/**
 * 에디터 전체 레이아웃 골격.
 * gui-spec.md의 5개 영역(상단 메뉴바 / 좌측 레이어 트리 / 중앙 캔버스 /
 * 우측 세부설정 패널 / 하단 도구 모음)을 CSS Grid로 배치한다.
 * 지금 단계에서는 기능 없이 자리만 잡는다.
 */
export function EditorLayout() {
  return (
    <div className="grid h-screen w-screen grid-cols-[240px_1fr_280px] grid-rows-[48px_1fr_56px] [grid-template-areas:'menu_menu_menu'_'tree_canvas_props'_'tool_tool_tool'] bg-neutral-100 text-neutral-800">
      <MenuBar />
      <LayerTree />
      <Canvas />
      <PropertiesPanel />
      <Toolbar />
    </div>
  );
}
