import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrateV01 } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { DesignStylesSection } from "@/features/editor/ui/properties/DesignStylesSection";

vi.mock("@/features/editor/store/editorStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/store/editorStore")>();
  const store = actual.useEditorStore;
  return { ...actual, useEditorStore: Object.assign(
    <T,>(selector: (state: ReturnType<typeof store.getState>) => T) => selector(store.getState()), store,
  ) };
});
vi.mock("@/features/editor/ui/properties/PropertySection", () => ({
  PropertySection: ({ children }: { children: React.ReactNode }) => createElement("section", null, children),
}));

beforeEach(() => useEditorStore.getState().loadSpec(migrateV01(seedSpec)));

function renderSelection(id: string) {
  useEditorStore.getState().select(id);
  return renderToStaticMarkup(createElement(DesignStylesSection));
}

describe("design style selection display", () => {
  it("shows an unlinked choice on another node, while preserving the linked node through Undo/Redo", () => {
    const editor = useEditorStore.getState();
    const pageId = editor.activePageId;
    const first = editor.spec.pages[pageId].nodes.headerTitle;
    if (first.type !== "text") throw new Error("fixture needs headerTitle text");
    const styleId = editor.createColorStyle("Brand", first.color, pageId, "headerTitle", "color");
    expect(styleId).not.toBeNull();

    const linked = renderSelection("headerTitle");
    expect(linked).toContain("현재 연결: Brand");
    expect(linked).toContain(`value="${styleId}" selected=""`);

    const unlinked = renderSelection("cardALabel");
    expect(unlinked).toContain("현재 연결: 없음");
    expect(unlinked).toContain('<option value="" selected="">연결 없음 · 스타일 선택</option>');
    const second = useEditorStore.getState().spec.pages[pageId].nodes.cardALabel;
    expect("styleRefs" in second ? second.styleRefs : undefined).toBeUndefined();

    useEditorStore.getState().undo();
    expect(renderSelection("headerTitle")).toContain("현재 연결: 없음");
    useEditorStore.getState().redo();
    expect(renderSelection("headerTitle")).toContain("현재 연결: Brand");
  });
});
