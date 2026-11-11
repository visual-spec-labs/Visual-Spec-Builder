import { describe, expect, it, beforeEach } from "vitest";

import { initHistory } from "@/features/editor/command/history";
import { migrateV01 } from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { copySelection } from "@/features/editor/ui/clipboard";
import type { ActionEntry, MenuEntry } from "@/features/editor/ui/menuEntry";
import { buildNodeContextMenuEntries } from "@/features/editor/ui/nodeContextMenuEntries";
import { useResponsiveViewStore } from "@/features/editor/responsive/responsiveViewStore";
import fixture from "./fixtures/screen-relations-project.json";
import type { ProjectSpec } from "@/features/editor/schema";

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

  it("프레임을 위젯으로 만들고 인스턴스에서 원본으로 이동하거나 분리한다", () => {
    const project = structuredClone(fixture) as unknown as ProjectSpec;
    const host = project.pages.login;
    const root = host.nodes.root;
    if (root.type !== "frame") throw Error("fixture root");
    host.nodes.card = { ...structuredClone(root), name: "Card", box: { width: 200, height: 100 }, children: [] };
    root.children.push({ node: "card" });
    useEditorStore.getState().loadSpec(project);
    action(buildNodeContextMenuEntries("card"), "위젯으로 만들기").onSelect();
    const state = useEditorStore.getState();
    expect(state.spec.pages.login.nodes.card.type).toBe("instance");
    const instance = state.spec.pages.login.nodes.card;
    if (instance.type !== "instance") throw Error("instance");
    action(buildNodeContextMenuEntries("card"), "원본 위젯으로 이동").onSelect();
    expect(useEditorStore.getState().activePageId).toBe(instance.ref);
    useEditorStore.getState().selectPage("login");
    action(buildNodeContextMenuEntries("card"), "인스턴스 분리").onSelect();
    expect(useEditorStore.getState().spec.pages.login.nodes.card.type).toBe("frame");
  });

  it("반응형 미리보기에서는 위젯 추출을 비활성화한다", () => {
    const project = structuredClone(fixture) as unknown as ProjectSpec;
    project.pages.login.responsive = { breakpoints: { wide: { minWidthPx: 700 } }, overrides: {} };
    const root = project.pages.login.nodes.root;
    if (root.type !== "frame") throw Error("fixture root");
    project.pages.login.nodes.card = { ...structuredClone(root), box: { width: 200, height: 100 }, children: [] };
    root.children.push({ node: "card" });
    useEditorStore.getState().loadSpec(project);
    useResponsiveViewStore.getState().setWidth("login", 800);
    expect(action(buildNodeContextMenuEntries("card"), "위젯으로 만들기").disabled).toBe(true);
    useResponsiveViewStore.getState().reset();
  });
});
