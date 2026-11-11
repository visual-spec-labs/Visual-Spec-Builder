import { describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveViewStore } from "@/features/editor/responsive/responsiveViewStore";
import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";
import fixture from "./fixtures/screen-relations-project.json";

function load(invalid = true) {
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  if (invalid) delete project.pages.dashboard;
  if (invalid) project.pageOrder = project.pageOrder.filter(id => id !== "dashboard") as ProjectSpec["pageOrder"];
  useEditorStore.getState().loadSpec(project);
  return useEditorStore.getState();
}

describe("rejected recovery-document edits", () => {
  it("reports a rejected preset without changing spec or history", () => {
    const before = load();
    expect(validateProjectSpec(before.spec).valid).toBe(false);
    expect(before.setPageField("login", "size", { width: 390, height: 844 })).toBe(false);
    expect(useEditorStore.getState().spec).toBe(before.spec);
    expect(useEditorStore.getState().history).toBe(before.history);
  });
  it("returns the whole-project responsive failure to the caller", () => {
    const before = load();
    const message = before.setResponsive("login", { breakpoints: { tablet: { minWidthPx: 768 } }, overrides: {} });
    expect(message).toBeTruthy();
    expect(message).toBe(useResponsiveViewStore.getState().error);
    expect(useEditorStore.getState().spec).toBe(before.spec);
    expect(useEditorStore.getState().history).toBe(before.history);
  });
  it("reports successful commits and preserves one-step Undo", () => {
    const before = load(false);
    expect(before.setPageField("login", "size", { width: 390, height: 844 })).toBe(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec).toEqual(before.spec);
    expect(useEditorStore.getState().setResponsive("login", { breakpoints: { tablet: { minWidthPx: 768 } }, overrides: {} })).toBeNull();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec).toEqual(before.spec);
  });
});
