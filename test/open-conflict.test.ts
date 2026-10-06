import { afterEach, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { openSpec } from "@/features/editor/ui/openSpecFromFile";
import { readWorkspaceSpecSnapshot } from "@/features/editor/ui/workspaceClient";
vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFiles: vi.fn(async () => ["next.json"]),
  readWorkspaceSpecSnapshot: vi.fn(),
}));
afterEach(() => { vi.unstubAllGlobals(); });
it("preflights a delayed storage conflict after Open finishes reading and preserves the old draft", async () => {
  const before = useEditorStore.getState().spec;
  useDocumentStore.getState().setFileName("original.json");
  vi.stubGlobal("window", { prompt: () => "1", alert: vi.fn() });
  vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue({ text: JSON.stringify({ ...before, name: "replacement" }), revision: "disk-revision" });
  const check = vi.fn(() => { useSaveConflictStore.setState({ paused: true }); return true; });
  useSaveConflictStore.setState({ paused: false, check });
  await openSpec();
  expect(check).toHaveBeenCalledOnce();
  expect(useEditorStore.getState().spec).toBe(before);
  expect(useDocumentStore.getState().fileName).toBe("original.json");
});
it("Open keeps the current document when its pending draft cannot be settled (#267)", async () => {
  const before = useEditorStore.getState().spec;
  useDocumentStore.getState().setFileName("original.json");
  vi.stubGlobal("window", { prompt: () => "1", alert: vi.fn() });
  vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue({ text: JSON.stringify({ ...before, name: "replacement" }), revision: "disk-revision" });
  const settle = vi.fn(async () => false);
  useSaveConflictStore.setState({ paused: false, check: () => false, settle });
  await openSpec();
  expect(settle).toHaveBeenCalledOnce();
  expect(useEditorStore.getState().spec).toBe(before);
  expect(useDocumentStore.getState().fileName).toBe("original.json");
});
