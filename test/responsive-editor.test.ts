import { beforeEach, describe, expect, it } from "vitest";
import example from "../examples/responsive-cards.json";
import { migrateV01, validateProjectSpec, validateVisualSpec, type VisualSpec, type ProjectSpec, type FrameNode } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { initHistory } from "@/features/editor/command/history";
import { applyCommand } from "@/features/editor/command/applyCommand";
import { isEditableScreenPath } from "@/features/editor/command/editablePath";
import { activeBreakpoint, patchResponsiveNode, removeResponsiveOverride, resolveResponsiveScreen } from "@/features/editor/responsive/resolveResponsive";
import { useResponsiveViewStore } from "@/features/editor/responsive/responsiveViewStore";
import { editResponsiveNode } from "@/features/editor/responsive/editResponsive";

function setup() {
  const spec = migrateV01(structuredClone(example) as VisualSpec);
  const pageId = spec.pageOrder[0];
  useEditorStore.setState({ spec, activePageId: pageId, selectedId: null, history: initHistory({ spec, activePageId: pageId }) });
  useResponsiveViewStore.setState({ widths: {}, error: null });
  return { pageId, screen: spec.pages[pageId] };
}
beforeEach(setup);
describe("반응형 편집·미리보기 (#223)", () => {
  it.each([[767, null, 24, 48], [768, "tablet", 24, 32], [1023, "tablet", 24, 32], [1024, "desktop", 32, 32]])("폭 %s에서 경계 포함·누적·기본값을 해석한다", (width, expected, gap, left) => {
    const { screen } = setup();
    const before = JSON.stringify(screen);
    const result = resolveResponsiveScreen(screen, width as number);
    expect(activeBreakpoint(screen, width as number)).toBe(expected);
    const root = result.nodes[result.root] as FrameNode;
    expect(root.layout.gap).toBe(gap);
    expect(root.layout.padding.left).toBe(left);
    expect(JSON.stringify(screen)).toBe(before);
    expect(result.size).toBe(screen.size);
  });
  it("폭 전환은 문서·history를 바꾸지 않는다", () => {
    const { pageId } = setup(); const before = useEditorStore.getState();
    useResponsiveViewStore.getState().setWidth(pageId, 768);
    useResponsiveViewStore.getState().setWidth("other", 1200);
    expect(useEditorStore.getState().spec).toBe(before.spec);
    expect(useEditorStore.getState().history).toBe(before.history);
    expect(useResponsiveViewStore.getState().widths[pageId]).toBe(768);
  });
  it("전체 객체 컨트롤도 변경한 leaf만 override하고 기반은 보존한다", () => {
    const { screen } = setup(); const root = resolveResponsiveScreen(screen, 768).nodes[screen.root] as FrameNode;
    const next = patchResponsiveNode(screen, "tablet", screen.root, "layout", { ...root.layout, direction: "column" });
    expect(next.overrides.tablet[screen.root]).toEqual({ layout: { gap: 24, padding: { left: 32 }, direction: "column" } });
    expect((screen.nodes[screen.root] as FrameNode).layout.direction).toBe("row");
  });
  it("breakpoint 추가·삭제를 한 단계씩 되돌리며 다른 페이지는 바꾸지 않는다", () => {
    const { pageId, screen } = setup();
    const spec = useEditorStore.getState().spec;
    const withOther: ProjectSpec = { ...spec, pages: { ...spec.pages, other: structuredClone(screen) }, pageOrder: [...spec.pageOrder, "other"] };
    useEditorStore.setState({ spec: withOther, history: initHistory({ spec: withOther, activePageId: pageId }) });
    const added = { ...screen.responsive!, breakpoints: { ...screen.responsive!.breakpoints, wide: { minWidthPx: 1440 } } };
    const store = useEditorStore.getState();
    expect(store.setResponsive(pageId, added)).toBeNull();
    expect(useEditorStore.getState().history.past).toHaveLength(1);
    expect(useEditorStore.getState().spec.pages.other).toBe(withOther.pages.other);
    store.setResponsive(pageId, screen.responsive!);
    expect(useEditorStore.getState().history.past).toHaveLength(2);
    store.undo(); expect(useEditorStore.getState().spec.pages[pageId].responsive?.breakpoints.wide.minWidthPx).toBe(1440);
    store.undo(); expect(useEditorStore.getState().spec.pages[pageId]).toEqual(screen);
  });
  it("작은 폭의 변경은 더 큰 폭에만 상속되고 배열 제거는 해당 폭 이상에만 적용된다", () => {
    const { screen } = setup();
    const responsive = patchResponsiveNode(screen, "tablet", screen.root, "background", []);
    const edited = { ...screen, responsive };
    expect(resolveResponsiveScreen(edited, 767).nodes[screen.root]).toEqual(screen.nodes[screen.root]);
    expect((resolveResponsiveScreen(edited, 768).nodes[screen.root] as FrameNode).background).toEqual([]);
    expect((resolveResponsiveScreen(edited, 1024).nodes[screen.root] as FrameNode).background).toEqual([]);
    expect((screen.nodes[screen.root] as FrameNode).background?.length).toBeGreaterThan(0);
  });
  it("override 생성·삭제는 각각 Undo 한 단계이며 redo도 복원한다", () => {
    const { pageId, screen } = setup(); const store = useEditorStore.getState();
    const next = patchResponsiveNode(screen, "tablet", screen.root, "opacity", 0.5);
    expect(store.setResponsive(pageId, next)).toBeNull();
    expect(useEditorStore.getState().history.past).toHaveLength(1);
    store.setResponsive(pageId, removeResponsiveOverride(next, "tablet", screen.root, "opacity"));
    expect(useEditorStore.getState().history.past).toHaveLength(2);
    store.undo();
    expect(useEditorStore.getState().spec.pages[pageId].responsive).toEqual(next);
    store.undo(); expect(useEditorStore.getState().spec.pages[pageId]).toEqual(screen);
    store.redo(); expect(useEditorStore.getState().spec.pages[pageId].responsive).toEqual(next);
  });
  it("불투명도·blur 기본값 복귀를 명시값으로 덮어쓴다", () => {
    const { pageId, screen } = setup();
    editResponsiveNode(pageId, "tablet", screen.root, "opacity", undefined);
    editResponsiveNode(pageId, "tablet", screen.root, "blur", undefined);
    expect(useEditorStore.getState().spec.pages[pageId].responsive?.overrides.tablet[screen.root]).toMatchObject({ opacity: 1, blur: 0 });
  });
  it("동일값·무효 breakpoint·금지 속성은 문서나 history를 오염시키지 않는다", () => {
    const { pageId, screen } = setup(); const before = useEditorStore.getState();
    expect(before.setResponsive(pageId, screen.responsive!)).toBeNull();
    const invalid = { ...screen.responsive!, breakpoints: { a: { minWidthPx: 0 } } };
    expect(before.setResponsive(pageId, invalid)).not.toBeNull();
    editResponsiveNode(pageId, "tablet", screen.root, "name", "Wrong");
    expect(useEditorStore.getState().spec).toBe(before.spec);
    expect(useEditorStore.getState().history.past).toHaveLength(0);
  });
  it("노드 삭제는 모든 breakpoint의 참조를 정리하고 Undo로 복원한다", () => {
    const { pageId, screen } = setup(); const nodeId = (screen.nodes[screen.root] as FrameNode).children[0].node;
    const responsive = patchResponsiveNode(screen, "tablet", nodeId, "visible", false);
    useEditorStore.getState().setResponsive(pageId, responsive);
    useEditorStore.getState().removeNode(nodeId);
    const next = useEditorStore.getState().spec;
    expect(validateProjectSpec(next).valid).toBe(true);
    expect(next.pages[pageId].responsive?.overrides.tablet[nodeId]).toBeUndefined();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec.pages[pageId].responsive).toEqual(responsive);
  });
  it("복제는 새 노드 ID로 override도 보존한다", () => {
    const { pageId, screen } = setup(); const nodeId = (screen.nodes[screen.root] as FrameNode).children[0].node;
    useEditorStore.getState().setResponsive(pageId, patchResponsiveNode(screen, "tablet", nodeId, "visible", false));
    useEditorStore.getState().duplicateNode(nodeId);
    const state = useEditorStore.getState();
    expect(state.spec.pages[pageId].responsive?.overrides.tablet[state.selectedId!]).toEqual({ visible: false });
    expect(validateProjectSpec(state.spec).valid).toBe(true);
    expect(state.history.past).toHaveLength(2);
  });
  it("기반 border 삭제가 partial override를 깨면 거부하고 오류를 알린다", () => {
    const { pageId, screen } = setup(); const nodeId = (screen.nodes[screen.root] as FrameNode).children[0].node;
    useEditorStore.getState().setResponsive(pageId, patchResponsiveNode(screen, "tablet", nodeId, "border.width", 9));
    const before = useEditorStore.getState();
    before.setNodeField(nodeId, "border", undefined);
    expect(useEditorStore.getState().spec).toBe(before.spec);
    expect(useResponsiveViewStore.getState().error).toContain("상속·병합");
  });
  it("updateScreen은 전체 블록만 받고 같은 값·무효 참조는 no-op이다", () => {
    const { screen } = setup();
    expect(isEditableScreenPath(screen, "responsive")).toBe(true);
    expect(isEditableScreenPath(screen, "responsive.breakpoints.tablet.minWidthPx")).toBe(false);
    expect(applyCommand(screen, { type: "updateScreen", path: "responsive", value: screen.responsive })).toBe(screen);
    const value = { breakpoints: {}, overrides: { missing: {} } };
    expect(applyCommand(screen, { type: "updateScreen", path: "responsive", value })).toBe(screen);
    expect(validateVisualSpec({ version: "0.3", screen }).valid).toBe(true);
  });
  it("prototype 이름은 없는 override로 취급하고 원형을 바꾸지 않는다", () => {
    const { screen } = setup();
    const result = removeResponsiveOverride(screen.responsive!, "__proto__", "root");
    expect(result).toBe(screen.responsive);
    const custom = { ...screen, responsive: { breakpoints: JSON.parse('{"__proto__":{"minWidthPx":1}}'), overrides: {} } };
    const next = patchResponsiveNode(custom, "__proto__", "root", "opacity", 0.5);
    expect(Object.prototype.hasOwnProperty.call(next.overrides, "__proto__")).toBe(true);
    expect(Object.prototype).not.toHaveProperty("opacity");
  });
});

it("문서 교체는 재사용 page ID의 미리보기 폭과 오류를 비운다", () => {
  const { pageId } = setup();
  useResponsiveViewStore.getState().setWidth(pageId, 400);
  useResponsiveViewStore.getState().reportError("old error");
  useEditorStore.getState().loadSpec(structuredClone(example) as VisualSpec);
  expect(useResponsiveViewStore.getState().widths).toEqual({});
  expect(useResponsiveViewStore.getState().error).toBeNull();
});

it("scalar radius를 대체한 객체는 다른 override를 보존하며 한 번에 상속한다", async () => {
  const { overridePaths } = await import("@/features/editor/responsive/resolveResponsive");
  const { pageId, screen } = setup();
  const root = screen.nodes.root as FrameNode;
  root.border = { width: 1, color: "#000000", radius: 4 };
  const radius = { topLeft: 1, topRight: 2, bottomLeft: 3, bottomRight: 4 };
  const next = patchResponsiveNode(screen, "tablet", "root", "border.radius", radius);
  const paths = overridePaths(next.overrides.tablet.root, "", root);
  expect(paths).toContain("border.radius");
  expect(paths).not.toContain("border.radius.topLeft");
  const inherited = removeResponsiveOverride(next, "tablet", "root", "border.radius");
  expect(useEditorStore.getState().setResponsive(pageId, inherited)).toBeNull();
  expect((resolveResponsiveScreen({ ...screen, responsive: inherited }, 768).nodes.root as FrameNode).border?.radius).toBe(4);
  expect(inherited.overrides.tablet.root).toMatchObject({ layout: { padding: { left: 32 } } });
});

it("표현 고정은 생략된 기본값도 고정하여 후속 기반 편집을 상속하지 않는다", async () => {
  const { pinnedAppearance } = await import("@/features/editor/responsive/resolveResponsive");
  const { screen } = setup();
  const root = screen.nodes.root as FrameNode;
  delete root.background; delete root.border; delete root.opacity; delete root.blur; delete root.visible;
  const patch = pinnedAppearance(root);
  expect(patch).toMatchObject({ visible: true, opacity: 1, blur: 0, background: [], border: { width: 0, align: "inside" } });
  root.visible = false; root.opacity = 0.2; root.blur = 4; root.background = [{ type: "solid", color: "#FF0000" }];
  const edited = { ...screen, responsive: { breakpoints: { tablet: { minWidthPx: 768 } }, overrides: { tablet: { root: patch } } } };
  expect(validateVisualSpec({ version: "0.3", screen: edited }).valid).toBe(true);
  expect(resolveResponsiveScreen(edited, 768).nodes.root).toMatchObject({ visible: true, opacity: 1, blur: 0, background: [] });
});

it.each(["row", "grid"] as const)("%s breakpoint의 드롭 판정은 기반 column과 다른 보이는 형제 위치를 따른다", async (direction) => {
  const { resolveCanvasDrop } = await import("@/features/editor/ui/canvasDrop");
  const { screen } = setup();
  const root = screen.nodes.root as FrameNode;
  root.layout.direction = "column";
  const [a, b, c] = root.children.map((child) => child.node);
  root.children = [a, b, c].map((node) => ({ node }));
  for (const id of [a, b, c]) (screen.nodes[id] as FrameNode).children = [];
  screen.responsive = { breakpoints: { tablet: { minWidthPx: 768 } }, overrides: { tablet: { root: { layout: { direction, columns: 3 } } } } };
  const rects = { root: { left: 0, top: 0, width: 500, height: 200 }, [a]: { left: 10, top: 10, width: 100, height: 100 }, [b]: { left: 120, top: 10, width: 100, height: 100 }, [c]: { left: 230, top: 10, width: 100, height: 100 } };
  const input = { rootId: "root", dragId: a, rects, point: { x: 340, y: 20 } };
  expect(resolveCanvasDrop({ ...input, nodes: screen.nodes })?.index).toBe(0);
  expect(resolveCanvasDrop({ ...input, nodes: resolveResponsiveScreen(screen, 768).nodes })?.index).toBe(2);
});
