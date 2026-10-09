import { afterEach, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { usePromptDialogStore } from "@/features/editor/store/promptDialogStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { newSpec } from "@/features/editor/ui/newSpec";
import { openSpec } from "@/features/editor/ui/openSpecFromFile";
import { readWorkspaceSpecSnapshot } from "@/features/editor/ui/workspaceClient";
vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFiles: vi.fn(async () => ["next.json"]),
  readWorkspaceSpecSnapshot: vi.fn(),
}));
afterEach(() => { vi.unstubAllGlobals(); });

/** `openSpec`은 `window.prompt`가 아니라 `promptPick` 모달을 쓴다(#288). */
async function answerOpenPrompt(fileName: string): Promise<void> {
  await vi.waitFor(() => expect(usePromptDialogStore.getState().state.kind).toBe("pick"));
  usePromptDialogStore.getState().resolve(fileName);
}

it("preflights a delayed storage conflict after Open finishes reading and preserves the old draft", async () => {
  const before = useEditorStore.getState().spec;
  useDocumentStore.getState().setFileName("original.json");
  vi.stubGlobal("window", { alert: vi.fn() });
  let conflict = false;
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(async () => {
    conflict = true;
    return { text: JSON.stringify({ ...before, name: "replacement" }), revision: "disk-revision" };
  });
  const check = vi.fn(() => { if (conflict) useSaveConflictStore.setState({ paused: true }); return conflict; });
  useSaveConflictStore.setState({ paused: false, check });
  const pending = openSpec();
  await answerOpenPrompt("next.json");
  await pending;
  expect(check).toHaveReturnedWith(true);
  expect(useEditorStore.getState().spec).toBe(before);
  expect(useDocumentStore.getState().fileName).toBe("original.json");
});
it("Open keeps the current document when its pending draft cannot be settled (#267)", async () => {
  const before = useEditorStore.getState().spec;
  useDocumentStore.getState().setFileName("original.json");
  vi.stubGlobal("window", { alert: vi.fn() });
  vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue({ text: JSON.stringify({ ...before, name: "replacement" }), revision: "disk-revision" });
  const settle = vi.fn(async () => false);
  useSaveConflictStore.setState({ paused: false, check: () => false, settle });
  const pending = openSpec();
  await answerOpenPrompt("next.json");
  await pending;
  expect(settle).toHaveBeenCalledOnce();
  expect(useEditorStore.getState().spec).toBe(before);
  expect(useDocumentStore.getState().fileName).toBe("original.json");
});

it.each(["new", "edit"])("a late Open response cannot replace a newer %s", async (action) => {
  const before = useEditorStore.getState().spec;
  useSaveConflictStore.setState({ paused: false, check: () => false, settle: async () => true });
  let finish!: (value: { text: string; revision: string }) => void;
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const opening = openSpec();
  await answerOpenPrompt("next.json");
  await vi.waitFor(() => expect(finish).toBeDefined());
  if (action === "new") expect(await newSpec()).toBe(true);
  else useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "new edit");
  const expected = useEditorStore.getState().spec;
  finish({ text: JSON.stringify({ ...before, name: "stale response" }), revision: "old" });
  await opening;
  expect(useEditorStore.getState().spec).toBe(expected);
});

it.each(["edit-undo", "same-spec-load"])("a delayed Open rejects %s ABA even with the original spec reference", async (action) => {
  const before = useEditorStore.getState().spec;
  useEditorStore.getState().loadSpec(before);
  const documentId = useEditorStore.getState().documentId;
  useDocumentStore.getState().setFileName("original.json");
  useSaveConflictStore.setState({ paused: false, check: () => false, settle: async () => true });
  let finish!: (value: { text: string; revision: string }) => void;
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const opening = openSpec();
  await answerOpenPrompt("next.json");
  await vi.waitFor(() => expect(finish).toBeDefined());
  if (action === "edit-undo") {
    useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "ABA edit");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().history.future).toHaveLength(1);
    expect(useEditorStore.getState().documentId).toBe(documentId);
  } else {
    useEditorStore.getState().loadSpec(before);
    expect(useEditorStore.getState().documentId).toBeGreaterThan(documentId);
  }
  expect(useEditorStore.getState().spec).toBe(before);
  const expected = useEditorStore.getState();
  finish({ text: JSON.stringify({ ...before, name: "stale B" }), revision: "old" });
  await opening;
  expect(useEditorStore.getState()).toBe(expected);
  expect(useDocumentStore.getState().fileName).toBe("original.json");
});
