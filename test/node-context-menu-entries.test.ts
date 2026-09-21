import { describe, expect, it, beforeEach } from "vitest";

import { initHistory } from "@/features/editor/command/history";
import { migrateV01 } from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { copySelection } from "@/features/editor/ui/clipboard";
import type { ActionEntry, MenuEntry } from "@/features/editor/ui/menuEntry";
import { buildNodeContextMenuEntries } from "@/features/editor/ui/nodeContextMenuEntries";

/** 지금 캔버스에 떠 있는 페이지(editor-store.test.ts와 같은 패턴). */
function activePage(): ScreenSpec {
  const { spec, activePageId } = useEditorStore.getState();
  return spec.pages[activePageId];
}

/** 테스트가 spec을 바꾸므로 시드 프로젝트로 매번 되돌린다. */
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

function action(entries: MenuEntry[], label: string): ActionEntry {
  const entry = entries.find((e) => e.kind === "action" && e.label === label);
  if (entry === undefined || entry.kind !== "action") {
    throw new Error(`"${label}" 항목을 찾지 못했다`);
  }
  return entry;
}

describe("buildNodeContextMenuEntries — 캔버스 컨텍스트 메뉴 항목(#152)", () => {
  beforeEach(resetToSeed);

  // 클립보드(ui/clipboard.ts)는 모듈 전역이라 파일 안에서 상태가 이어진다.
  // 이 테스트를 먼저 둬서 "아직 아무 것도 복사 안 한" 상태를 확인한다.
  it("클립보드가 비어 있으면 붙여넣기가 비활성화된다", () => {
    const entries = buildNodeContextMenuEntries("cardA");
    expect(action(entries, "붙여넣기").disabled).toBe(true);
  });

  it("복사하고 나면 붙여넣기가 활성화된다", () => {
    copySelection(activePage().nodes, "cardA");
    const entries = buildNodeContextMenuEntries("cardB");
    expect(action(entries, "붙여넣기").disabled).toBeFalsy();
  });

  it("일반 노드는 복제·복사·삭제가 활성화된다", () => {
    const entries = buildNodeContextMenuEntries("cardA");
    expect(action(entries, "복제").disabled).toBeFalsy();
    expect(action(entries, "복사").disabled).toBeFalsy();
    expect(action(entries, "삭제").disabled).toBeFalsy();
  });

  it("root는 복제·삭제·순서 바꾸기가 비활성화된다", () => {
    const entries = buildNodeContextMenuEntries(activePage().root);

    expect(action(entries, "복제").disabled).toBe(true);
    expect(action(entries, "삭제").disabled).toBe(true);
    expect(action(entries, "맨 앞으로 가져오기").disabled).toBe(true);
    expect(action(entries, "앞으로 가져오기").disabled).toBe(true);
    expect(action(entries, "뒤로 보내기").disabled).toBe(true);
    expect(action(entries, "맨 뒤로 보내기").disabled).toBe(true);
  });

  it("이미 맨 앞이면 앞으로 가는 항목이 비활성화된다", () => {
    // content의 children은 [cardA, cardB] — cardA가 맨 앞이다.
    const entries = buildNodeContextMenuEntries("cardA");
    expect(action(entries, "맨 앞으로 가져오기").disabled).toBe(true);
    expect(action(entries, "앞으로 가져오기").disabled).toBe(true);
    expect(action(entries, "뒤로 보내기").disabled).toBeFalsy();
    expect(action(entries, "맨 뒤로 보내기").disabled).toBeFalsy();
  });

  it("이미 맨 뒤면 뒤로 가는 항목이 비활성화된다", () => {
    const entries = buildNodeContextMenuEntries("cardB");
    expect(action(entries, "뒤로 보내기").disabled).toBe(true);
    expect(action(entries, "맨 뒤로 보내기").disabled).toBe(true);
    expect(action(entries, "맨 앞으로 가져오기").disabled).toBeFalsy();
    expect(action(entries, "앞으로 가져오기").disabled).toBeFalsy();
  });

  it("복제를 고르면 실제로 duplicateNode가 불린다", () => {
    const before = useEditorStore.getState().spec;
    action(buildNodeContextMenuEntries("cardA"), "복제").onSelect();

    expect(useEditorStore.getState().spec).not.toBe(before);
    const content = activePage().nodes.content;
    expect(content.type === "frame" && content.children).toHaveLength(3);
  });

  it("삭제를 고르면 실제로 removeNode가 불린다", () => {
    action(buildNodeContextMenuEntries("cardB"), "삭제").onSelect();

    expect(activePage().nodes.cardB).toBeUndefined();
  });

  it("맨 뒤로 보내기를 고르면 실제로 moveNode가 불린다", () => {
    action(buildNodeContextMenuEntries("cardA"), "맨 뒤로 보내기").onSelect();

    const content = activePage().nodes.content;
    expect(content.type === "frame" && content.children).toEqual([
      { node: "cardB" },
      { node: "cardA" },
    ]);
  });
});
