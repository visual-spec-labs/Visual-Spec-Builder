import { beforeEach, describe, expect, it } from "vitest";

import { useToolStore, type ToolId } from "@/features/editor/store/toolStore";

const ALL_TOOLS: ToolId[] = ["select", "frame", "text", "hand"];

describe("toolStore", () => {
  beforeEach(() => {
    useToolStore.setState({ activeTool: "select", toolBeforeSpace: null });
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

describe("toolStore — 스페이스 임시 팬", () => {
  beforeEach(() => {
    useToolStore.setState({ activeTool: "select", toolBeforeSpace: null });
  });

  it("누르면 손 도구가 되고 직전 도구를 기억한다", () => {
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().beginSpacePan();

    expect(useToolStore.getState().activeTool).toBe("hand");
    expect(useToolStore.getState().toolBeforeSpace).toBe("frame");
  });

  it("떼면 쓰던 도구로 돌아온다", () => {
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().beginSpacePan();
    useToolStore.getState().endSpacePan();

    expect(useToolStore.getState().activeTool).toBe("frame");
    expect(useToolStore.getState().toolBeforeSpace).toBeNull();
  });

  it("키 반복으로 여러 번 눌려도 기억한 도구가 덮이지 않는다", () => {
    // 키를 누르고 있으면 keydown 이 반복해서 들어온다. 두 번째에 "hand" 가
    // 저장되면 떼도 손 도구로 돌아와 **영영 빠져나갈 수 없다.**
    useToolStore.getState().setActiveTool("text");
    useToolStore.getState().beginSpacePan();
    useToolStore.getState().beginSpacePan();
    useToolStore.getState().beginSpacePan();

    expect(useToolStore.getState().toolBeforeSpace).toBe("text");

    useToolStore.getState().endSpacePan();
    expect(useToolStore.getState().activeTool).toBe("text");
  });

  it("누르지 않았는데 떼면 아무 일도 없다", () => {
    // keyup 과 window blur 양쪽에서 부르므로 중복 호출이 정상 경로다.
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().endSpacePan();
    useToolStore.getState().endSpacePan();

    expect(useToolStore.getState().activeTool).toBe("frame");
    expect(useToolStore.getState().toolBeforeSpace).toBeNull();
  });

  it("손 도구에서 시작하면 복귀도 손 도구다", () => {
    // H 로 손 도구를 켜 둔 채 스페이스를 눌렀다 떼는 경우.
    useToolStore.getState().setActiveTool("hand");
    useToolStore.getState().beginSpacePan();
    useToolStore.getState().endSpacePan();

    expect(useToolStore.getState().activeTool).toBe("hand");
  });

  it("도구를 명시적으로 고르면 임시 팬이 취소된다", () => {
    // 노드를 만들면 캔버스가 setActiveTool("select") 로 되돌린다. 그 뒤에 스페이스를
    // 떼었다고 방금 고른 도구를 빼앗으면 안 된다.
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().beginSpacePan();
    useToolStore.getState().setActiveTool("text");

    expect(useToolStore.getState().toolBeforeSpace).toBeNull();

    useToolStore.getState().endSpacePan();
    expect(useToolStore.getState().activeTool).toBe("text");
  });

  it("누르고 있는 동안에도 한 번에 하나만 활성이다", () => {
    useToolStore.getState().setActiveTool("frame");
    useToolStore.getState().beginSpacePan();

    const { activeTool } = useToolStore.getState();
    expect(ALL_TOOLS.filter((tool) => tool === activeTool)).toHaveLength(1);
  });
});
