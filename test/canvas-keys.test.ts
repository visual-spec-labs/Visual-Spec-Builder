import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore, type ToolId } from "@/features/editor/store/toolStore";
import { runEscapeCommand } from "@/features/editor/ui/canvasEscape";
import { viewCommandForKey } from "@/features/editor/ui/canvasInput";

describe("Esc 도구 복귀", () => {
  beforeEach(() => {
    useToolStore.setState({ activeTool: "select", toolBeforeSpace: null });
    useEditorStore.setState({ selectedId: "cardA", focusRootId: null });
  });

  it.each<ToolId>(["frame", "text", "hand"])("%s 도구에서는 선택을 유지하고 선택 도구로 돌아간다", (tool) => {
    useToolStore.getState().setActiveTool(tool);

    runEscapeCommand();

    expect(useToolStore.getState().activeTool).toBe("select");
    expect(useEditorStore.getState().selectedId).toBe("cardA");
  });

  it("선택 도구에서는 선택을 해제한다", () => {
    runEscapeCommand();

    expect(useToolStore.getState().activeTool).toBe("select");
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it("Esc 반복 keydown은 도구 복귀 뒤 선택을 해제하지 않는다", () => {
    useToolStore.getState().setActiveTool("frame");
    const key = { code: "Escape", ctrlKey: false, metaKey: false, altKey: false,
      shiftKey: false, tagName: "DIV", contentEditable: false };

    if (viewCommandForKey({ ...key, repeat: false }) === "deselect") runEscapeCommand();
    if (viewCommandForKey({ ...key, repeat: true }) === "deselect") runEscapeCommand();

    expect(useToolStore.getState().activeTool).toBe("select");
    expect(useEditorStore.getState().selectedId).toBe("cardA");
  });

  it("스페이스 임시 손 도구에서는 선택만 해제하고 스페이스를 떼면 원래 도구로 돌아간다", () => {
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().beginSpacePan();

    runEscapeCommand();

    expect(useEditorStore.getState().selectedId).toBeNull();
    expect(useToolStore.getState().activeTool).toBe("hand");
    expect(useToolStore.getState().toolBeforeSpace).toBe("frame");

    useToolStore.getState().endSpacePan();
    expect(useToolStore.getState().activeTool).toBe("frame");
    expect(useToolStore.getState().toolBeforeSpace).toBeNull();
  });
});
