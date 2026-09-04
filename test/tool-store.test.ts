import { beforeEach, describe, expect, it } from "vitest";

import { useToolStore, type ToolId } from "@/features/editor/store/toolStore";

const ALL_TOOLS: ToolId[] = ["select", "frame", "text", "hand"];

describe("toolStore", () => {
  beforeEach(() => {
    useToolStore.setState({ activeTool: "select" });
  });

  it("기본 도구는 Select다", () => {
    expect(useToolStore.getState().activeTool).toBe("select");
  });

  it("도구 4종을 모두 활성화할 수 있다", () => {
    for (const tool of ALL_TOOLS) {
      useToolStore.getState().setActiveTool(tool);
      expect(useToolStore.getState().activeTool).toBe(tool);
    }
  });

  it("한 번에 하나만 활성이다 — 새로 고르면 앞의 도구는 꺼진다", () => {
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().setActiveTool("hand");

    const { activeTool } = useToolStore.getState();
    expect(activeTool).toBe("hand");
    expect(ALL_TOOLS.filter((tool) => tool === activeTool)).toHaveLength(1);
  });
});
