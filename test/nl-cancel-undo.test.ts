import { beforeEach, describe, expect, it } from "vitest";

import { initHistory } from "@/features/editor/command/history";
import { migrateV01 } from "@/features/editor/schema";
import { describeCancel } from "@/features/editor/nl/nlMessage";
import { undoNlEdit } from "@/features/editor/nl/nlUndo";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";

function resetToSeed(): void {
  const spec = migrateV01(seedSpec);
  useEditorStore.setState({
    spec,
    activePageId: spec.pageOrder[0],
    selectedId: null,
    focusRootId: null,
    history: initHistory({ spec, activePageId: spec.pageOrder[0] }),
  });
}

describe("자연어 취소 안내 (#448 B-6)", () => {
  it("응답 대기 중 취소는 화면이 그대로이고 에이전트는 계속 돌 수 있다고 알린다", () => {
    const message = describeCancel("waiting");

    expect(message).toContain("요청을 취소했습니다");
    expect(message).toContain("화면은 바뀌지 않았습니다");
    expect(message).toContain("에이전트는 계속 작업할 수 있으니");
    expect(message).toContain("늦게 온 응답은 반영하지 않습니다");
  });

  it("배경 확인의 적용 취소는 적용하지 않았다고만 알린다", () => {
    const message = describeCancel("confirmation");

    expect(message).toContain("배경 변경을 적용하지 않았습니다");
    expect(message).not.toContain("에이전트");
  });
});

describe("자연어 되돌리기 뒤 선택 (#448 B-11)", () => {
  beforeEach(resetToSeed);

  it("되돌린 뒤에도 남아 있는 노드는 선택을 유지한다", () => {
    const store = useEditorStore.getState();
    store.select("cardA");
    store.applyGuardedTransaction(store.activePageId, [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 },
    ]);

    undoNlEdit();

    const after = useEditorStore.getState();
    const cardA = after.spec.pages[after.activePageId].nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).not.toBe(4);
    expect(after.selectedId).toBe("cardA");
  });

  it("되돌려서 사라진 노드는 선택을 비운다", () => {
    useEditorStore.getState().select("cardA");
    useEditorStore.getState().duplicateNode("cardA");
    const copy = useEditorStore.getState().selectedId;
    expect(copy).not.toBe("cardA");

    undoNlEdit();

    const after = useEditorStore.getState();
    expect(after.spec.pages[after.activePageId].nodes[copy!]).toBeUndefined();
    expect(after.selectedId).toBeNull();
  });

  it("되돌릴 것이 없으면 선택을 건드리지 않는다", () => {
    useEditorStore.getState().select("cardA");

    undoNlEdit();

    expect(useEditorStore.getState().selectedId).toBe("cardA");
  });
});
