import { beforeEach, describe, expect, it } from "vitest";
import { applyTransaction } from "@/features/editor/command/applyCommand";
import { buildGroupCommands, buildUngroupCommands } from "@/features/editor/command/groupCommands";
import { migrateV01, validateVisualSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { nodeGroupCommandForKey } from "@/features/editor/ui/canvasInput";
import { buildNodeContextMenuEntries } from "@/features/editor/ui/nodeContextMenuEntries";

import { resolveResponsiveScreen } from "@/features/editor/responsive/resolveResponsive";

const screen = () => useEditorStore.getState().spec.pages[useEditorStore.getState().activePageId];
beforeEach(() => useEditorStore.getState().loadSpec(migrateV01(seedSpec)));

describe("단일 노드 Group / Ungroup (#225)", () => {
  it("같은 형제 위치에 무장식 wrapper를 넣고 원본 트리로 정확히 돌아온다", () => {
    const original = screen();
    const before = JSON.stringify(original);
    const group = buildGroupCommands(original, "cardA")!;
    const grouped = applyTransaction(original, group.commands);
    expect(grouped.nodes.content.type === "frame" && grouped.nodes.content.children.map(c => c.node)).toEqual([group.selectedId, "cardB"]);
    const wrapper = grouped.nodes[group.selectedId];
    expect(wrapper.type === "frame" && wrapper.children).toEqual([{ node: "cardA" }]);
    expect(wrapper.box).toEqual(original.nodes.cardA.box);
    expect(grouped.nodes.cardA).toBe(original.nodes.cardA);
    expect(validateVisualSpec({ version: "0.3", screen: grouped }).valid).toBe(true);
    const ungrouped = applyTransaction(grouped, buildUngroupCommands(grouped, group.selectedId)!.commands);
    expect(ungrouped).toEqual(original);
    expect(JSON.stringify(original)).toBe(before);
  });
  it.each([240, "fill"] as const)("숨긴 %s 노드는 wrapper도 숨기고 해제·Undo로 복원한다", (width) => {
    const fixture = structuredClone(seedSpec);
    fixture.screen.nodes.cardA = { ...fixture.screen.nodes.cardA, visible: false,
      box: { width, height: 100 } };
    const store = useEditorStore;
    store.getState().loadSpec(fixture);
    const original = store.getState().spec;
    store.getState().groupNode("cardA");
    const groupId = store.getState().selectedId!;
    const grouped = store.getState().spec;
    expect(screen().nodes[groupId].visible).toBe(false);
    expect(screen().nodes.cardA.visible).toBe(false);
    expect(store.getState().history.past).toHaveLength(1);
    store.getState().ungroupNode(groupId);
    expect(store.getState().spec).toEqual(original);
    expect(store.getState().history.past).toHaveLength(2);
    store.getState().undo(); expect(store.getState().spec).toEqual(grouped);
    store.getState().undo(); expect(store.getState().spec).toEqual(original);
  });
  it.each([true, undefined])("visible=%s의 wrapper는 기존처럼 표시 필드를 생략한다", (visible) => {
    const original = screen();
    const input = { ...original, nodes: { ...original.nodes,
      cardA: { ...original.nodes.cardA, visible },
    } };
    const built = buildGroupCommands(input, "cardA")!;
    const grouped = applyTransaction(input, built.commands);
    expect(Object.hasOwn(grouped.nodes[built.selectedId], "visible")).toBe(false);
    expect(grouped.nodes.cardA).toBe(input.nodes.cardA);
  });
  it.each([false, true, undefined])("기반 visible=%s의 반응형 표시만 wrapper에 복사하고 해제·Undo한다", (visible) => {
    const fixture = structuredClone(seedSpec);
    fixture.screen.nodes.cardA.visible = visible;
    fixture.screen.responsive = {
      // 선언 순서 대신 폭 순서로 누적되어야 한다.
      breakpoints: { wide: { minWidthPx: 1200 }, tablet: { minWidthPx: 600 }, desktop: { minWidthPx: 900 } },
      overrides: {
        wide: { cardA: { visible: true } },
        tablet: { cardA: { visible: !visible, box: { width: 320 } }, cardB: { visible: false } },
        desktop: { cardA: { opacity: 0.5 }, cardALabel: { visible: false } },
      },
    };
    const store = useEditorStore;
    store.getState().loadSpec(fixture);
    const original = store.getState().spec;
    const originalScreen = screen();
    store.getState().groupNode("cardA");
    const groupId = store.getState().selectedId!;
    const grouped = store.getState().spec;
    expect(screen().nodes.cardA).toEqual(originalScreen.nodes.cardA);
    expect(screen().responsive?.overrides.tablet[groupId]).toEqual({ visible: !visible });
    expect(screen().responsive?.overrides.wide[groupId]).toEqual({ visible: true });
    expect(screen().responsive?.overrides.desktop[groupId]).toBeUndefined();
    for (const key of ["tablet", "desktop", "wide"]) {
      expect(screen().responsive?.overrides[key].cardA).toEqual(originalScreen.responsive?.overrides[key].cardA);
    }
    for (const width of [599, 600, 899, 900, 1199, 1200]) {
      const resolved = resolveResponsiveScreen(screen(), width);
      expect(resolved.nodes[groupId].visible !== false).toBe(resolved.nodes.cardA.visible !== false);
      expect(resolved.nodes.cardA).toEqual(resolveResponsiveScreen(originalScreen, width).nodes.cardA);
    }
    expect(validateVisualSpec({ version: "0.3", screen: screen() }).valid).toBe(true);
    expect(store.getState().history.past).toHaveLength(1);
    store.getState().ungroupNode(groupId);
    expect(store.getState().spec).toEqual(original);
    expect(store.getState().history.past).toHaveLength(2);
    expect(validateVisualSpec({ version: "0.3", screen: screen() }).valid).toBe(true);
    store.getState().undo(); expect(store.getState().spec).toEqual(grouped);
    store.getState().undo(); expect(store.getState().spec).toEqual(original);
    store.getState().redo(); expect(store.getState().spec).toEqual(grouped);
  });
  it("표시 override가 없으면 responsive 객체와 명령 수를 유지한다", () => {
    const original = screen();
    const input = { ...original, responsive: {
      breakpoints: { tablet: { minWidthPx: 600 } },
      overrides: { tablet: { cardA: { opacity: 0.5 } } },
    } };
    const built = buildGroupCommands(input, "cardA")!;
    expect(built.commands).toHaveLength(2);
    expect(applyTransaction(input, built.commands).responsive).toBe(input.responsive);
  });
  it("여러 자식은 frame 위치부터 순서대로 꺼내며 자손을 지우지 않는다", () => {
    const original = screen();
    const result = applyTransaction(original, buildUngroupCommands(original, "content")!.commands);
    expect(result.nodes.root.type === "frame" && result.nodes.root.children.map(c => c.node)).toEqual(["header", "cardA", "cardB"]);
    expect(result.nodes.content).toBeUndefined();
    for (const [id, node] of Object.entries(original.nodes)) {
      if (id !== "content" && id !== original.root) expect(result.nodes[id]).toBe(node);
    }
    expect(validateVisualSpec({ version: "0.3", screen: result }).valid).toBe(true);
  });
  it("빈 frame 해제는 그 frame만 지우고 부모를 선택한다", () => {
    const original = screen();
    const group = buildGroupCommands(original, "cardA")!;
    const empty = applyTransaction(original, [group.commands[0]]);
    const built = buildUngroupCommands(empty, group.selectedId)!;
    expect(built.selectedId).toBe("content");
    expect(applyTransaction(empty, built.commands)).toEqual(original);
  });
  it("root·없는 노드는 거부하고 leaf는 해제할 수 없다", () => {
    for (const id of [screen().root, "missing", "constructor"]) {
      expect(buildGroupCommands(screen(), id)).toBeNull();
      expect(buildUngroupCommands(screen(), id)).toBeNull();
    }
    expect(buildUngroupCommands(screen(), "title")).toBeNull();
  });
  it("중첩 그룹 ID는 충돌하지 않고 grid 부모의 wrapper는 column이다", () => {
    const original = screen();
    const content = original.nodes.content;
    if (content.type !== "frame") throw new Error("fixture");
    const grid = { ...original, nodes: { ...original.nodes, content: { ...content, layout: { ...content.layout, direction: "grid" as const, columns: 2 } } } };
    const first = buildGroupCommands(grid, "cardA")!;
    const grouped = applyTransaction(grid, first.commands);
    const wrapper = grouped.nodes[first.selectedId];
    expect(wrapper.type === "frame" && wrapper.layout.direction).toBe("column");
    const second = buildGroupCommands(grouped, first.selectedId)!;
    expect(second.selectedId).not.toBe(first.selectedId);
  });
  it("Group·Ungroup이 각각 Undo 한 단계이며 이전 편집과 Redo를 보존한다", () => {
    const store = useEditorStore;
    store.getState().setNodeField("cardA", "name", "Edited");
    const original = store.getState().spec;
    store.getState().groupNode("cardA");
    const groupId = store.getState().selectedId!;
    const grouped = store.getState().spec;
    expect(store.getState().history.past).toHaveLength(2);
    store.getState().enterFocus(groupId);
    store.getState().ungroupNode(groupId);
    expect(store.getState().history.past).toHaveLength(3);
    expect(store.getState().focusRootId).toBeNull();
    expect(store.getState().selectedId).toBe("cardA");
    expect(store.getState().spec).toEqual(original);
    store.getState().undo(); expect(store.getState().spec).toEqual(grouped);
    store.getState().undo(); expect(store.getState().spec).toEqual(original);
    store.getState().redo(); expect(store.getState().spec).toEqual(grouped);
  });
  it("불가능한 store 호출은 history와 선택을 바꾸지 않는다", () => {
    const before = useEditorStore.getState();
    before.groupNode(screen().root); before.ungroupNode(screen().root); before.ungroupNode("missing");
    expect(useEditorStore.getState()).toBe(before);
  });
  it("메뉴가 실제 액션을 호출하고 root는 두 항목을 비활성화한다", () => {
    const action = (id: string, label: string) => buildNodeContextMenuEntries(id).find(e => e.kind === "action" && e.label === label);
    for (const label of ["그룹 만들기", "그룹 해제"]) {
      expect(action(screen().root, label)).toMatchObject({ disabled: true });
    }
    const entry = action("cardA", "그룹 만들기");
    if (entry?.kind !== "action") throw new Error("menu missing");
    entry.onSelect();
    expect(screen().nodes[useEditorStore.getState().selectedId!].name).toBe("Group");
  });
});

describe("Group 키 판단", () => {
  const input = { code: "KeyG", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, contentEditable: false, canGroup: true, canUngroup: true };
  it("Ctrl/Cmd+G와 Shift+G를 구분한다", () => {
    expect(nodeGroupCommandForKey(input)).toBe("group");
    expect(nodeGroupCommandForKey({ ...input, ctrlKey: false, metaKey: true, shiftKey: true })).toBe("ungroup");
  });
  it("입력칸·Alt·부적합 대상에서는 기본 키 동작을 보존한다", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(nodeGroupCommandForKey({ ...input, tagName })).toBeNull();
    for (const patch of [{ contentEditable: true }, { altKey: true }, { canGroup: false }, { shiftKey: true, canUngroup: false }, { ctrlKey: false }, { code: "KeyD" }]) {
      expect(nodeGroupCommandForKey({ ...input, ...patch })).toBeNull();
    }
  });
});
