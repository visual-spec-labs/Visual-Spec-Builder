import { beforeEach, describe, expect, it } from "vitest";

import { initHistory } from "@/features/editor/command/history";
import { migrateV01 } from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { resizedValue } from "@/features/editor/ui/canvasLayout";
import {
  createResizeGesture,
  type ResizeTarget,
} from "@/features/editor/ui/resizeGesture";

describe("createResizeGesture (#207)", () => {
  it("첫 변경은 새 단계, 그다음부터는 같은 단계에 병합한다", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    expect(gesture.commits({ width: 110 })).toEqual([
      { axis: "width", value: 110, continueEdit: false },
    ]);
    expect(gesture.commits({ width: 120 })).toEqual([
      { axis: "width", value: 120, continueEdit: true },
    ]);
  });

  it("우하단(se)은 너비·높이를 한 단계로 묶는다 — 높이부터 병합", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    expect(gesture.commits({ width: 110, height: 60 })).toEqual([
      { axis: "width", value: 110, continueEdit: false },
      { axis: "height", value: 60, continueEdit: true },
    ]);
    expect(gesture.commits({ width: 120, height: 70 })).toEqual([
      { axis: "width", value: 120, continueEdit: true },
      { axis: "height", value: 70, continueEdit: true },
    ]);
  });

  it("움직이지 않으면(시작 크기 그대로) 커밋하지 않는다", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    expect(gesture.commits({ width: 100 })).toEqual([]);
    expect(gesture.commits({ width: 100, height: 50 })).toEqual([]);
  });

  it("값이 그대로인 이동 뒤의 첫 변경도 새 단계다 — 남의 단계를 덮어쓰지 않는다", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    gesture.commits({ width: 100 }); // 반올림 등으로 크기가 안 바뀐 이동

    expect(gesture.commits({ width: 101 })).toEqual([
      { axis: "width", value: 101, continueEdit: false },
    ]);
  });

  it("se에서 한 축만 바뀌면 그 축만 커밋하고, 그 축이 단계를 연다", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    expect(gesture.commits({ width: 100, height: 60 })).toEqual([
      { axis: "height", value: 60, continueEdit: false },
    ]);
    expect(gesture.commits({ width: 105, height: 60 })).toEqual([
      { axis: "width", value: 105, continueEdit: true },
    ]);
  });

  it("직전 값과 같은 이동은 건너뛰고 단계는 그대로 이어 간다", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    gesture.commits({ width: 110 });
    expect(gesture.commits({ width: 110 })).toEqual([]);
    expect(gesture.commits({ width: 115 })).toEqual([
      { axis: "width", value: 115, continueEdit: true },
    ]);
  });

  it("움직였다가 시작 크기로 돌아오는 이동은 커밋한다(같은 단계에 병합)", () => {
    const gesture = createResizeGesture({ width: 100, height: 50 });

    gesture.commits({ width: 130 });

    expect(gesture.commits({ width: 100 })).toEqual([
      { axis: "width", value: 100, continueEdit: true },
    ]);
  });

  it("제스처마다 따로 추적한다 — 새 제스처의 첫 변경은 다시 새 단계다", () => {
    const first = createResizeGesture({ width: 100, height: 50 });
    first.commits({ width: 120 });

    const second = createResizeGesture({ width: 120, height: 50 });
    expect(second.commits({ width: 140 })).toEqual([
      { axis: "width", value: 140, continueEdit: false },
    ]);
  });
});

/** 지금 캔버스에 떠 있는 페이지. editor-store.test.ts의 같은 헬퍼와 같다. */
function activePage(): ScreenSpec {
  const { spec, activePageId } = useEditorStore.getState();
  return spec.pages[activePageId];
}

/** 테스트가 spec을 누적으로 바꾸므로 시드 프로젝트로 매번 되돌린다. */
function resetToSeed(): void {
  const spec = migrateV01(seedSpec);
  useEditorStore.setState({
    spec,
    activePageId: spec.pageOrder[0],
    selectedId: null,
    history: initHistory({ spec, activePageId: spec.pageOrder[0] }),
  });
}

function historyStepCount(): number {
  return useEditorStore.getState().history.past.length;
}

type Edge = "e" | "s" | "se";

/**
 * 리사이즈 드래그 한 번을 흉내 낸다 — Canvas.tsx `startResize`의 `handleMove`
 * 배선 그대로다: 끈 거리로 목표 크기를 구하고, 판단기가 고른 커밋만 순서대로
 * 스토어에 보낸다. 노드면 box, root면 page.size에 쓴다.
 *
 * 컴포넌트를 렌더하지 않는 이유는 edit-burst.test.ts와 같다 — 이 저장소에는
 * 컴포넌트 테스트 도구가 없고 vitest environment가 node다.
 */
function dragResize(
  target: { kind: "node"; id: string } | { kind: "page" },
  edge: Edge,
  start: { width: number; height: number },
  moves: ReadonlyArray<{ dx: number; dy: number }>,
): void {
  const gesture = createResizeGesture(start);
  const { activePageId } = useEditorStore.getState();

  for (const { dx, dy } of moves) {
    const next: ResizeTarget = {};
    if (edge === "e" || edge === "se") next.width = resizedValue(start.width, dx, 1);
    if (edge === "s" || edge === "se") next.height = resizedValue(start.height, dy, 1);

    const { setNodeField, setPageField } = useEditorStore.getState();
    for (const { axis, value, continueEdit } of gesture.commits(next)) {
      if (target.kind === "page") {
        setPageField(activePageId, `size.${axis}`, value, continueEdit);
      } else {
        setNodeField(target.id, `box.${axis}`, value, continueEdit);
      }
    }
  }
}

describe("리사이즈 드래그 한 번 = Undo 한 단계 (#207, 스토어 회귀)", () => {
  beforeEach(resetToSeed);

  const MOVES = [
    { dx: 5, dy: 3 },
    { dx: 12, dy: 8 },
    { dx: 30, dy: 20 },
  ];

  it("다른 편집 A 뒤 se 리사이즈 — undo 한 번에 A 직후, 두 번에 A 이전", () => {
    const original = activePage().nodes.cardA;
    useEditorStore.getState().setNodeField("cardA", "layout.gap", 40); // 편집 A
    const afterA = activePage().nodes.cardA;

    dragResize({ kind: "node", id: "cardA" }, "se", { width: 200, height: 80 }, MOVES);

    expect(activePage().nodes.cardA.box).toEqual({ width: 230, height: 100 });
    expect(historyStepCount()).toBe(2);

    useEditorStore.getState().undo();
    expect(activePage().nodes.cardA).toBe(afterA);

    useEditorStore.getState().undo();
    expect(activePage().nodes.cardA).toBe(original);
  });

  it.each(["e", "s"] as const)("%s 핸들도 끌기 한 번이 한 단계다", (edge) => {
    useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
    const afterA = activePage().nodes.cardA;

    dragResize({ kind: "node", id: "cardA" }, edge, { width: 200, height: 80 }, MOVES);

    expect(historyStepCount()).toBe(2);
    useEditorStore.getState().undo();
    expect(activePage().nodes.cardA).toBe(afterA);
  });

  it("root(아트보드) 리사이즈도 page.size에 한 단계로 쌓인다", () => {
    const pageId = useEditorStore.getState().activePageId;
    useEditorStore.getState().setPageField(pageId, "name", "Renamed"); // 편집 A

    dragResize({ kind: "page" }, "se", { width: 1440, height: 900 }, MOVES);

    expect(activePage().size).toEqual({ width: 1470, height: 920 });
    expect(historyStepCount()).toBe(2);

    useEditorStore.getState().undo();
    expect(activePage().size).toEqual({ width: 1440, height: 900 });
    expect(activePage().name).toBe("Renamed");

    useEditorStore.getState().undo();
    expect(activePage().name).toBe("DashboardPage");
  });

  it("핸들만 누르고 떼면(이동 없음) A가 그대로 남는다", () => {
    useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
    const afterA = activePage().nodes.cardA;

    dragResize({ kind: "node", id: "cardA" }, "se", { width: 200, height: 80 }, [
      { dx: 0, dy: 0 },
    ]);

    expect(activePage().nodes.cardA).toBe(afterA); // Fill/Hug도 그대로
    expect(historyStepCount()).toBe(1);
  });

  it("크기가 안 바뀐 이동 뒤에 끌어도 A를 덮어쓰지 않는다", () => {
    useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
    const afterA = activePage().nodes.cardA;

    dragResize({ kind: "node", id: "cardA" }, "e", { width: 200, height: 80 }, [
      { dx: 0, dy: 7 }, // e 핸들은 세로 이동을 무시한다 — 너비 그대로
      { dx: 10, dy: 7 },
      { dx: 20, dy: 7 },
    ]);

    expect(historyStepCount()).toBe(2);
    useEditorStore.getState().undo();
    expect(activePage().nodes.cardA).toBe(afterA);
  });

  it("끌었다가 시작 크기로 되돌아와도 단계는 하나다", () => {
    dragResize({ kind: "page" }, "e", { width: 1440, height: 900 }, [
      { dx: 50, dy: 0 },
      { dx: 0, dy: 0 },
    ]);

    expect(activePage().size.width).toBe(1440);
    expect(historyStepCount()).toBe(1);
  });
});
