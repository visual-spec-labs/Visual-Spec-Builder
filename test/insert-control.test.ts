import { beforeEach, describe, expect, it } from "vitest";

import { canUndo, initHistory } from "@/features/editor/command/history";
import { migrateV01, validateProjectSpec } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { createNode } from "@/features/editor/store/createNode";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import { insertControl, insertWidget, widgetInsertEntries } from "@/features/editor/ui/insertControl";
import fixture from "./fixtures/screen-relations-project.json";
import type { ProjectSpec } from "@/features/editor/schema";

const page = () => {
  const { spec, activePageId } = useEditorStore.getState();
  return spec.pages[activePageId];
};

beforeEach(() => {
  const spec = migrateV01(structuredClone(blankSpec));
  const activePageId = spec.pageOrder[0];
  useEditorStore.setState({ spec, activePageId, selectedId: null, history: initHistory({ spec, activePageId }) });
  useToolStore.getState().setActiveTool("select");
});

describe("Insert → Button/Input", () => {
  it.each(["button", "input"] as const)("빈 화면에 %s를 추가하고 선택하며 Undo/Redo 한 단계다", (kind) => {
    const before = useEditorStore.getState().spec;
    insertControl(kind);
    const { spec, selectedId } = useEditorStore.getState();
    expect(selectedId).not.toBeNull();
    expect(page().nodes[selectedId!].type).toBe(kind);
    expect(page().nodes.root).toMatchObject({ children: [{ node: selectedId }] });
    expect(validateProjectSpec(spec).valid).toBe(true);
    expect(before.pages[before.pageOrder[0]].nodes.root).toMatchObject({ children: [] });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec).toEqual(before);
    expect(canUndo(useEditorStore.getState().history)).toBe(false);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().spec).toEqual(spec);
  });

  it("선택한 프레임에 넣고 비프레임 선택은 부모에 넣으며 중복 id를 만들지 않는다", () => {
    useEditorStore.getState().insertNode("root", "nested", createNode("frame"));
    insertControl("button");
    const buttonId = useEditorStore.getState().selectedId;
    insertControl("input");
    const inputId = useEditorStore.getState().selectedId;
    insertControl("button");
    const secondButtonId = useEditorStore.getState().selectedId;
    expect(new Set([buttonId, inputId, secondButtonId]).size).toBe(3);
    expect(page().nodes.nested).toMatchObject({ children: [
      { node: buttonId }, { node: inputId }, { node: secondButtonId },
    ] });
    expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
  });

  it("클릭 시점의 활성 페이지에만 추가하며 활성 도구를 유지한다", () => {
    const firstPage = page();
    useEditorStore.getState().addPage();
    useToolStore.getState().setActiveTool("hand");
    insertControl("input");
    expect(Object.values(page().nodes).filter((node) => node.type === "input")).toHaveLength(1);
    expect(Object.values(firstPage.nodes)).toHaveLength(1);
    expect(useToolStore.getState().activeTool).toBe("hand");
  });
});

describe("Insert → Widget", () => {
  beforeEach(() => useEditorStore.getState().loadSpec(structuredClone(fixture) as unknown as ProjectSpec));

  it("offers each shared widget and inserts an instance into the selected frame with one Undo step", () => {
    const entries = widgetInsertEntries();
    const widget = entries.find((entry) => entry.kind === "action" && entry.label.includes("notificationWidget"));
    expect(widget?.kind).toBe("action");
    if (widget?.kind !== "action") return;
    const before = useEditorStore.getState().spec;
    widget.onSelect();
    const { spec, selectedId, activePageId } = useEditorStore.getState();
    expect(spec.pages[activePageId].nodes[selectedId!]).toMatchObject({ type: "instance", ref: "notificationWidget" });
    expect(validateProjectSpec(spec).valid).toBe(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec).toEqual(before);
  });

  it("ignores missing and non-widget references", () => {
    const before = useEditorStore.getState().spec;
    insertWidget("missing");
    insertWidget("login");
    expect(useEditorStore.getState().spec).toBe(before);
  });
});
