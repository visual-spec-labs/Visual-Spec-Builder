import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";

export function runEscapeCommand(): void {
  const { activeTool, toolBeforeSpace, setActiveTool } = useToolStore.getState();
  if (toolBeforeSpace === null && activeTool !== "select") {
    setActiveTool("select");
    return;
  }
  useEditorStore.getState().select(null);
}
