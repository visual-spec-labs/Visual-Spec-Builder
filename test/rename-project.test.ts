import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { publishProjectRename } from "@/features/editor/store/specStorage";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { renameProject } from "@/features/editor/ui/renameProject";
import { readWorkspaceTextFile } from "@/features/editor/ui/workspaceClient";
import { WORKSPACE_MARKER_HEADER } from "@/features/workspace/protocol";

vi.mock("@/features/editor/store/specStorage", async (original) => ({
  ...await original<typeof import("@/features/editor/store/specStorage")>(), publishProjectRename: vi.fn(),
}));
vi.mock("@/features/editor/ui/workspaceClient", () => ({ readWorkspaceTextFile: vi.fn() }));
const fetchMock = vi.fn();
const lockMock = vi.fn(async (_key: string, action: () => Promise<unknown>) => action());
beforeEach(() => {
  vi.resetAllMocks();
  useSaveConflictStore.setState({ paused: false, check: () => false });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { locks: { request: lockMock } });
  useEditorStore.getState().loadSpec(blankSpec);
  useDocumentStore.getState().setFileName("old.json");
  vi.mocked(readWorkspaceTextFile).mockResolvedValue(JSON.stringify(blankSpec));
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, path: "specs/New.json" }), {
    headers: { [WORKSPACE_MARKER_HEADER]: "1" },
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("home rename", () => {
  it("preserves unsaved edits, selection and history, including undo/redo after rename", async () => {
    const editor = useEditorStore.getState();
    const pageId = editor.activePageId;
    editor.setPageField(pageId, "name", "unsaved edit");
    editor.select(editor.spec.pages[pageId].root);
    const before = useEditorStore.getState();
    expect(await renameProject("old.json", "New")).toEqual({ ok: true, path: "specs/New.json" });
    const after = useEditorStore.getState();
    expect(after.spec.pages).toBe(before.spec.pages);
    expect(after.selectedId).toBe(before.selectedId);
    expect(after.history.past).toHaveLength(before.history.past.length);
    expect(after.spec.name).toBe("New");
    expect(publishProjectRename).toHaveBeenCalledWith("old.json", expect.objectContaining({ name: "New" }), "New.json");
    expect(useDocumentStore.getState().fileName).toBe("New.json");
    after.undo();
    expect(useEditorStore.getState().spec.name).toBe("New");
    expect(useEditorStore.getState().spec.pages[pageId].name).not.toBe("unsaved edit");
    after.redo();
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("unsaved edit");
  });
  it("preserves redo entries while synchronizing their project names", async () => {
    const editor = useEditorStore.getState();
    const pageId = editor.activePageId;
    editor.setPageField(pageId, "name", "redo draft");
    editor.undo();
    await renameProject("old.json", "New");
    expect(useEditorStore.getState().history.future).toHaveLength(1);
    editor.redo();
    expect(useEditorStore.getState().spec.name).toBe("New");
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("redo draft");
  });
  it("does not change another active document", async () => {
    useDocumentStore.getState().setFileName("other.json");
    const before = useEditorStore.getState();
    await renameProject("old.json", "New");
    expect(useEditorStore.getState()).toBe(before);
    expect(useDocumentStore.getState().fileName).toBe("other.json");
  });
  it.each([409, 500])("preserves draft/path on HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "failed" }), { status, headers: { [WORKSPACE_MARKER_HEADER]: "1" } }));
    const before = useEditorStore.getState();
    expect((await renameProject("old.json", "New")).ok).toBe(false);
    expect(useEditorStore.getState()).toBe(before);
    expect(publishProjectRename).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().fileName).toBe("old.json");
  });
  it("preserves memory on uncertain network outcome", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const before = useEditorStore.getState();
    expect((await renameProject("old.json", "New")).ok).toBe(false);
    expect(useEditorStore.getState()).toBe(before);
    expect(publishProjectRename).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().fileName).toBe("old.json");
  });
  it("acquires sorted source and destination locks before reading disk", async () => {
    await renameProject("old.json", "New");
    expect(lockMock.mock.calls.map(([key]) => key)).toEqual([
      "visual-spec:autosave:file:New.json", "visual-spec:autosave:file:old.json",
    ]);
    expect(lockMock.mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(readWorkspaceTextFile).mock.invocationCallOrder[0]);
  });
  it("deduplicates same-file locks and checks conflicts only after acquiring them", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, path: "specs/old.json" }), {
      headers: { [WORKSPACE_MARKER_HEADER]: "1" },
    }));
    await renameProject("old.json", "old");
    expect(lockMock).toHaveBeenCalledTimes(1);
    lockMock.mockImplementationOnce(async (_key, action) => {
      useSaveConflictStore.setState({ paused: true });
      return action();
    });
    vi.mocked(readWorkspaceTextFile).mockClear();
    expect((await renameProject("old.json", "old")).ok).toBe(false);
    expect(readWorkspaceTextFile).not.toHaveBeenCalled();
  });
  it("refuses safely when Web Locks are unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const before = useEditorStore.getState();
    expect((await renameProject("old.json", "New")).ok).toBe(false);
    expect(readWorkspaceTextFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useEditorStore.getState()).toBe(before);
  });
  it("does not send invalid names or missing source", async () => {
    expect((await renameProject("old.json", "../New")).ok).toBe(false);
    vi.mocked(readWorkspaceTextFile).mockResolvedValue(null);
    expect((await renameProject("old.json", "New")).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
