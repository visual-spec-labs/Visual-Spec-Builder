import { useMemo } from "react";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveViewStore } from "./responsiveViewStore";
import { activeBreakpoint, resolveResponsiveScreen } from "./resolveResponsive";

export function useResponsiveScreen() {
  const pageId = useEditorStore((state) => state.activePageId);
  const screen = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const preview = useResponsiveViewStore((state) => state.widths[pageId]);
  const width = preview ?? screen.size.width;
  const resolved = useMemo(() => resolveResponsiveScreen(screen, width), [screen, width]);
  return { pageId, screen, resolved, width, breakpoint: activeBreakpoint(screen, width) };
}
