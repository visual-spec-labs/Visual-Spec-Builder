import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { loadStoredSpec, saveSpecToStorage, parseStoredDocument, projectStorageKey, readRecovery, prepareProjectRename, publishProjectRename } from "@/features/editor/store/specStorage";
import { newSpec } from "@/features/editor/ui/newSpec";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { startSpecAutosave } from "@/features/editor/ui/specAutosave";
import { saveSpec, saveSpecAs, downloadConflictCopy } from "@/features/editor/ui/exportSpecAsJson";

function storage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); } };
}
let listeners: Map<string, (event: unknown) => void>;
let stop: (() => void) | undefined;
const initial = useEditorStore.getState().spec;
const key = projectStorageKey("same.json", "unused");
function remote(name: string, target = key) {
  const document = { fileName: "same.json", spec: { ...initial, name } };
  localStorage.setItem(target, JSON.stringify(document));
  return document;
}
function edit(name: string) { useEditorStore.getState().loadSpec({ ...initial, name }); }
function notify(target = key) { listeners.get("storage")?.({ key: target, storageArea: localStorage }); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, fn: () => void) => fn() } });
  listeners = new Map();
  vi.stubGlobal("window", { addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name), alert: vi.fn(), prompt: vi.fn(), confirm: vi.fn(() => true) });
  useEditorStore.getState().loadSpec(initial);
  useDocumentStore.getState().setFileName("same.json", "loaded-revision");
  useSaveConflictStore.setState({ paused: false, unavailable: false });
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("same-project autosave conflict preservation", () => {
  it("pauses queued autosave; memory and remote both survive cancel/unload", async () => {
    stop = startSpecAutosave();
    edit("my pending draft");
    const latest = remote("their latest"); notify();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState().paused).toBe(true);
    expect(useEditorStore.getState().spec.name).toBe("my pending draft");
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(latest);
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    listeners.get("beforeunload")?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(readRecovery()?.document.spec.name).toBe("my pending draft");
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(latest);
  });
  it("preflights under lock even when storage event is delayed", async () => {
    stop = startSpecAutosave(); edit("mine"); const latest = remote("theirs");
    await vi.advanceTimersByTimeAsync(500);
    expect(useSaveConflictStore.getState().paused).toBe(true);
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(latest);
  });
  it("ignores another project and sessionStorage events", async () => {
    stop = startSpecAutosave(); edit("mine"); remote("other", projectStorageKey("other.json", ""));
    notify(projectStorageKey("other.json", ""));
    listeners.get("storage")?.({ key, storageArea: sessionStorage });
    await vi.advanceTimersByTimeAsync(500);
    expect(useSaveConflictStore.getState().paused).toBe(false);
    expect(parseStoredDocument(localStorage.getItem(key))?.spec.name).toBe("mine");
  });
  it("reload restores the tab's draft and original comparison baseline", () => {
    stop = startSpecAutosave(); edit("mine"); remote("theirs"); notify(); stop();
    expect(loadStoredSpec()?.name).toBe("mine");
    stop = startSpecAutosave();
    expect(useSaveConflictStore.getState().paused).toBe(true);
    expect(useEditorStore.getState().spec.name).toBe("mine");
  });
  it("loads newest remote revision, resumes, and detects repeated conflicts", async () => {
    stop = startSpecAutosave(); edit("mine"); remote("first"); notify(); remote("second"); notify();
    expect(useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useEditorStore.getState().spec.name).toBe("second");
    expect(useSaveConflictStore.getState().paused).toBe(false);
    edit("my next edit"); await vi.advanceTimersByTimeAsync(500);
    expect(parseStoredDocument(localStorage.getItem(key))?.spec.name).toBe("my next edit");
    remote("third"); notify(); expect(useSaveConflictStore.getState().paused).toBe(true);
  });
  it("rename notification preserves draft until explicit adoption of the new save path", () => {
    stop = startSpecAutosave(); edit("mine");
    publishProjectRename("same.json", { ...initial, name: "renamed disk" }, "new.json"); notify(`${key}:rename`);
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec.name).toBe("mine");
    expect(useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useDocumentStore.getState().fileName).toBe("new.json");
    expect(useEditorStore.getState().spec.name).toBe("renamed disk");
  });
  it("opening stale disk content cannot overwrite an existing project autosave", async () => {
    useDocumentStore.getState().setFileName("other.json");
    stop = startSpecAutosave();
    const latest = remote("newer cached content");
    edit("stale disk"); useDocumentStore.getState().setFileName("same.json");
    await vi.advanceTimersByTimeAsync(500);
    expect(useSaveConflictStore.getState().paused).toBe(true);
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(latest);
    expect(useEditorStore.getState().spec.name).toBe("stale disk");
  });
  it("keeps a source draft paused and cannot adopt a pending rename or recreate its file", async () => {
    stop = startSpecAutosave(); edit("unsaved source draft");
    prepareProjectRename("same.json", initial, "new.json");
    notify(`${key}:rename`);
    expect(useSaveConflictStore.getState().paused).toBe(true);
    expect(useSaveConflictStore.getState().loadLatest()).toBe(false);
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec.name).toBe("unsaved source draft");
    const write = vi.fn(async () => true);
    expect(await useSaveConflictStore.getState().save("same.json", JSON.stringify(initial), write)).toBe(false);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem(key)).toBeNull();
    publishProjectRename("same.json", { ...initial, name: "confirmed rename" }, "new.json");
    expect(useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useDocumentStore.getState().fileName).toBe("new.json");
  });
  it("rename signaling never overwrites either project's existing autosave", () => {
    const oldDraft = remote("old unsaved");
    const newKey = projectStorageKey("new.json", "");
    const newDraft = remote("new unsaved", newKey);
    publishProjectRename("same.json", initial, "new.json");
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(oldDraft);
    expect(parseStoredDocument(localStorage.getItem(newKey))).toEqual(newDraft);
  });
  it("manual Save publishes before its pending HTTP write, under the autosave lock", async () => {
    stop = startSpecAutosave(); edit("mine before debounce");
    let finish: ((ok: boolean) => void) | undefined;
    const write = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const saving = useSaveConflictStore.getState().save("same.json", JSON.stringify(useEditorStore.getState().spec), write);
    expect(write).toHaveBeenCalledOnce();
    expect(parseStoredDocument(localStorage.getItem(key))?.spec.name).toBe("mine before debounce");
    finish?.(true); expect(await saving).toBe(true);
  });
  it("Save as rejects another project's cached edits before any file write", async () => {
    stop = startSpecAutosave(); edit("mine");
    const other = projectStorageKey("other.json", "");
    const theirs = remote("theirs", other);
    const write = vi.fn(async () => true);
    expect(await useSaveConflictStore.getState().save("other.json", JSON.stringify(useEditorStore.getState().spec), write)).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(parseStoredDocument(localStorage.getItem(other))).toEqual(theirs);
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec.name).toBe("mine");
  });
  it("rename back consumes each notice and can resume editing without a redirect cycle", async () => {
    stop = startSpecAutosave(); edit("mine");
    publishProjectRename("same.json", { ...initial, name: "B" }, "B.json"); notify(`${key}:rename`);
    expect(useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useSaveConflictStore.getState().check()).toBe(false);
    edit("B edit"); await vi.advanceTimersByTimeAsync(500);
    publishProjectRename("B.json", { ...initial, name: "A again" }, "same.json");
    notify(`${projectStorageKey("B.json", "")}:rename`);
    expect(useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec.name).toBe("A again");
    expect(useSaveConflictStore.getState().check()).toBe(false);
    edit("A resumed"); await vi.advanceTimersByTimeAsync(500);
    expect(parseStoredDocument(localStorage.getItem(key))?.spec.name).toBe("A resumed");
  });
  it("opening a recreated old path consumes historical rename notices without redirecting", () => {
    useDocumentStore.getState().setFileName("other.json"); stop = startSpecAutosave();
    publishProjectRename("same.json", initial, "B.json");
    edit("recreated A"); useDocumentStore.getState().setFileName("same.json");
    expect(useSaveConflictStore.getState().check()).toBe(false);
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec.name).toBe("recreated A");
  });
  it("successful Save as adopts its own canonical cache without a false conflict", async () => {
    stop = startSpecAutosave(); edit("mine");
    vi.mocked(window.prompt).mockReturnValue("new-copy.json");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, path: "specs/new-copy.json" }), {
      headers: { "x-visual-spec-workspace": "1" },
    })));
    await saveSpecAs(useEditorStore.getState().spec);
    expect(useDocumentStore.getState().fileName).toBe("new-copy.json");
    expect(useSaveConflictStore.getState().paused).toBe(false);
    expect(useSaveConflictStore.getState().check()).toBe(false);
  });
  it.each(["Save", "Save as"])("delayed %s completion never redirects a newly opened document", async (kind) => {
    stop = startSpecAutosave(); edit("snapshot A");
    vi.mocked(window.prompt).mockReturnValue("copy-C.json");
    let complete: ((response: Response) => void) | undefined;
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === "PUT") return await new Promise<Response>((resolve) => { complete = resolve; });
      return new Response("{}", { headers: { "x-visual-spec-workspace": "1" } });
    });
    vi.stubGlobal("fetch", fetch);
    const operation = kind === "Save" ? saveSpec(useEditorStore.getState().spec) : saveSpecAs(useEditorStore.getState().spec);
    await vi.waitFor(() => expect(complete).toBeDefined());
    edit("opened B"); useDocumentStore.getState().setFileName("B.json");
    complete?.(new Response(JSON.stringify({ ok: true, path: "specs/copy-C.json" }), { headers: { "x-visual-spec-workspace": "1" } }));
    await operation;
    expect(useDocumentStore.getState().fileName).toBe("B.json");
    expect(useEditorStore.getState().spec.name).toBe("opened B");
  });
  it("successful local rename back adopts stale target cache without replacing memory or pausing", async () => {
    stop = startSpecAutosave(); edit("original draft"); await vi.advanceTimersByTimeAsync(500);
    for (const [oldName, newName] of [["same.json", "B.json"], ["B.json", "same.json"]]) {
      publishProjectRename(oldName, initial, newName);
      useSaveConflictStore.getState().adoptRename(() => useDocumentStore.getState().setFileName(newName));
      expect(useSaveConflictStore.getState().check()).toBe(false);
      expect(useEditorStore.getState().spec.name).toBe("original draft");
    }
  });
  it("edits in the same document while Save as is pending keep the new path and newer draft", async () => {
    stop = startSpecAutosave();
    vi.mocked(window.prompt).mockReturnValue("copy.json");
    let complete: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === "PUT") return await new Promise<Response>((resolve) => { complete = resolve; });
      return new Response("{}", { headers: { "x-visual-spec-workspace": "1" } });
    }));
    const operation = saveSpecAs(useEditorStore.getState().spec);
    await vi.waitFor(() => expect(complete).toBeDefined());
    const editor = useEditorStore.getState();
    editor.setPageField(editor.activePageId, "name", "edit while saving");
    complete?.(new Response(JSON.stringify({ ok: true }), { headers: { "x-visual-spec-workspace": "1" } }));
    await operation;
    expect(useDocumentStore.getState().fileName).toBe("copy.json");
    expect(useEditorStore.getState().spec.pages[editor.activePageId].name).toBe("edit while saving");
    expect(useSaveConflictStore.getState().check()).toBe(false);
  });
  it("a queued Save is cancelled if another document opens before its lock is acquired", async () => {
    stop = startSpecAutosave();
    let run: (() => Promise<boolean>) | undefined;
    vi.stubGlobal("navigator", { locks: { request: (_key: string, fn: () => Promise<boolean>) => new Promise<boolean>((resolve) => {
      run = async () => { const result = await fn(); resolve(result); return result; };
    }) } });
    const fetch = vi.fn(async () => new Response("{}", { headers: { "x-visual-spec-workspace": "1" } }));
    vi.stubGlobal("fetch", fetch);
    const operation = saveSpec(useEditorStore.getState().spec);
    await vi.waitFor(() => expect(run).toBeDefined());
    edit("B"); useDocumentStore.getState().setFileName("B.json");
    await run?.(); await operation;
    expect(fetch.mock.calls.some((call: unknown[]) => (call[1] as RequestInit | undefined)?.method === "PUT")).toBe(false);
    expect(useDocumentStore.getState().fileName).toBe("B.json");
  });
  it("New creates a distinct untitled draft instead of conflicting with a previous New", async () => {
    stop = startSpecAutosave(); await newSpec();
    let editor = useEditorStore.getState(); editor.setPageField(editor.activePageId, "name", "first draft");
    await vi.advanceTimersByTimeAsync(500);
    const firstKey = readRecovery()!.key;
    await newSpec(); editor = useEditorStore.getState(); editor.setPageField(editor.activePageId, "name", "second draft");
    await vi.advanceTimersByTimeAsync(500);
    expect(readRecovery()!.key).not.toBe(firstKey);
    expect(parseStoredDocument(localStorage.getItem(firstKey))?.spec.pages[editor.activePageId].name).toBe("first draft");
    expect(useSaveConflictStore.getState().check()).toBe(false);
  });
  it("failed or throwing Save as releases its cache reservation for an edited retry", async () => {
    stop = startSpecAutosave();
    const target = projectStorageKey("retry.json", "");
    for (const write of [async () => false, async () => { throw new Error("network"); }]) {
      expect(await useSaveConflictStore.getState().save("retry.json", JSON.stringify(useEditorStore.getState().spec), write)).toBe(false);
      expect(localStorage.getItem(target)).toBeNull();
      edit("retry changed");
    }
    expect(await useSaveConflictStore.getState().save("retry.json", JSON.stringify(useEditorStore.getState().spec), async () => true)).toBe(true);
  });
  it("Save as completion checks a delayed source conflict before adopting its target", async () => {
    stop = startSpecAutosave();
    let finish!: (ok: boolean) => void;
    const saving = useSaveConflictStore.getState().save("copy.json", JSON.stringify(initial), () => new Promise<boolean>(resolve => { finish = resolve; }));
    remote("new source revision"); // deliberately no storage event
    finish(true);
    expect(await saving).toBe(false);
    expect(useSaveConflictStore.getState().paused).toBe(true);
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec).toEqual(initial);
  });
  it("copied untitled recovery gets an independent key without losing its contents", async () => {
    stop = startSpecAutosave(); await newSpec();
    edit("recovered draft");
    await vi.advanceTimersByTimeAsync(500);
    const original = readRecovery()!;
    stop(); stop = startSpecAutosave();
    expect(readRecovery()!.key).not.toBe(original.key);
    expect(useEditorStore.getState().spec.name).toBe("recovered draft");
    localStorage.setItem(original.key, JSON.stringify({ ...original.document, spec: { ...original.document.spec, name: "opener edit" } }));
    notify(original.key);
    expect(useSaveConflictStore.getState().paused).toBe(false);
  });
  it("closing before debounce requests confirmation even when session recovery succeeded", () => {
    stop = startSpecAutosave(); edit("pending close");
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    listeners.get("beforeunload")?.(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(readRecovery()?.document.spec.name).toBe("pending close");
  });
  it("pending first Save still warns until the durable startup document is updated", async () => {
    stop = startSpecAutosave();
    let finish!: (ok: boolean) => void;
    const saving = useSaveConflictStore.getState().save("same.json", JSON.stringify(initial), () => new Promise<boolean>(resolve => { finish = resolve; }));
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    listeners.get("beforeunload")?.(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    finish(true); await saving;
  });
  it("genuine reload keeps the untitled recovery key", async () => {
    stop = startSpecAutosave(); await newSpec(); await vi.advanceTimersByTimeAsync(500);
    const originalKey = readRecovery()!.key;
    stop();
    vi.stubGlobal("performance", { getEntriesByType: () => [{ type: "reload" }] });
    stop = startSpecAutosave();
    expect(readRecovery()!.key).toBe(originalKey);
  });
  it("disk CAS recovery fetches the disk revision instead of the stale same-origin cache", async () => {
    stop = startSpecAutosave(); edit("my preserved draft");
    useSaveConflictStore.getState().pause(true);
    const latest = { ...initial, name: "other origin disk" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(latest), {
      headers: { "x-visual-spec-workspace": "1", "x-visual-spec-revision": "latest-revision" },
    })));
    expect(await useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useEditorStore.getState().spec.name).toBe("other origin disk");
    expect(useDocumentStore.getState().diskRevision).toBe("latest-revision");
    expect(useSaveConflictStore.getState().paused).toBe(false);
  });
  it("failed disk recovery preserves paused draft and reload recovery flag", async () => {
    stop = startSpecAutosave(); edit("preserve disk conflict");
    useSaveConflictStore.getState().pause(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    expect(await useSaveConflictStore.getState().loadLatest()).toBe(false);
    expect(useEditorStore.getState().spec.name).toBe("preserve disk conflict");
    expect(readRecovery()?.diskConflict).toBe(true);
    expect(useSaveConflictStore.getState().paused).toBe(true);
  });
  it("unreadable/deleted latest never discards the draft or resumes", () => {
    stop = startSpecAutosave(); edit("mine"); localStorage.setItem(key, "broken"); notify();
    expect(useSaveConflictStore.getState().loadLatest()).toBe(false);
    expect(useEditorStore.getState().spec.name).toBe("mine");
    expect(useSaveConflictStore.getState().paused).toBe(true);
  });
  it("blocked recovery storage raises unload protection; unavailable locks never write unlocked", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => { throw new Error("full"); } });
    stop = startSpecAutosave(); edit("mine"); await vi.advanceTimersByTimeAsync(500);
    expect(localStorage.getItem(key)).toBeNull();
    expect(useSaveConflictStore.getState().unavailable).toBe(true);
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    listeners.get("beforeunload")?.(event); expect(event.preventDefault).toHaveBeenCalled();
  });
  it("paused Save/Save as cannot send workspace writes; a separate download keeps both copies", async () => {
    stop = startSpecAutosave(); edit("mine"); const theirs = remote("theirs"); notify();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await saveSpec(useEditorStore.getState().spec)).toBeNull();
    expect(await saveSpecAs(useEditorStore.getState().spec)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:copy");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const exported = downloadConflictCopy(useEditorStore.getState().spec);
    expect(exported.ok).toBe(true);
    if (exported.ok) expect(JSON.parse(exported.json).name).toBe("mine");
    expect(anchor.download).toMatch(/^conflict-copy-.*\.json$/);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(theirs);
    expect(useSaveConflictStore.getState().paused).toBe(true);
  });
});

describe("document switch before the autosave debounce (#267)", () => {
  function editPageName(name: string) {
    const editor = useEditorStore.getState();
    editor.setPageField(editor.activePageId, "name", name);
    return editor.activePageId;
  }
  it("New persists the pending draft of the outgoing file before replacing it", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("edited just now");
    expect(await newSpec()).toBe(true);
    expect(useDocumentStore.getState().fileName).toBeNull();
    expect(parseStoredDocument(localStorage.getItem(key))?.spec.pages[pageId].name).toBe("edited just now");
    // The cancelled timer of the old document must not write the new document into the old key.
    await vi.advanceTimersByTimeAsync(1000);
    expect(parseStoredDocument(localStorage.getItem(key))?.spec.pages[pageId].name).toBe("edited just now");
    // Reopening the stale disk copy surfaces the preserved draft instead of hiding it.
    useEditorStore.getState().loadSpec(initial);
    useDocumentStore.getState().setFileName("same.json", "loaded-revision");
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(useSaveConflictStore.getState().readDraft()?.pages[pageId].name).toBe("edited just now");
    expect(await useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("edited just now");
  });
  it("continuing with the opened file explicitly replaces the draft", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("draft to discard");
    expect(await newSpec()).toBe(true);
    useEditorStore.getState().loadSpec(initial);
    useDocumentStore.getState().setFileName("same.json", "loaded-revision");
    useSaveConflictStore.getState().discardDraft();
    expect(useSaveConflictStore.getState().paused).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(parseStoredDocument(localStorage.getItem(key))?.spec).toEqual(initial);
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe(initial.pages[pageId].name);
  });
  it("an edited untitled document asks before it is replaced; a fresh one does not", async () => {
    const confirm = vi.mocked(window.confirm);
    stop = startSpecAutosave(); await newSpec();
    confirm.mockClear();
    expect(await newSpec()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    const pageId = editPageName("untitled work");
    confirm.mockReturnValueOnce(false);
    expect(await newSpec()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("untitled work");
    expect(await newSpec()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it("a conflicting outgoing draft keeps the current document instead of switching", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("mine");
    const latest = remote("theirs"); // no storage event yet
    expect(await newSpec()).toBe(false);
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "remote" });
    expect(useDocumentStore.getState().fileName).toBe("same.json");
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("mine");
    expect(parseStoredDocument(localStorage.getItem(key))).toEqual(latest);
  });
  it("without safe autosave the switch requires an explicit discard", async () => {
    vi.stubGlobal("navigator", {});
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name), alert: vi.fn(), confirm });
    stop = startSpecAutosave();
    const pageId = editPageName("unsaved");
    expect(await newSpec()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("unsaved");
    confirm.mockReturnValue(true);
    expect(await newSpec()).toBe(true);
    expect(useDocumentStore.getState().fileName).toBeNull();
  });
  it("a fresh tab restoring stored untitled work asks before New; a stored blank does not (review)", async () => {
    const confirm = vi.mocked(window.confirm);
    useDocumentStore.getState().clearFileName();
    useEditorStore.getState().loadSpec({ ...initial, name: "only copy" });
    saveSpecToStorage(useEditorStore.getState().spec, null);
    stop = startSpecAutosave();
    confirm.mockReturnValueOnce(false);
    expect(await newSpec()).toBe(false);
    expect(useEditorStore.getState().spec.name).toBe("only copy");
    stop();
    saveSpecToStorage(useEditorStore.getState().spec, null); // the blank New below replaces it
    useEditorStore.getState().loadSpec(blankSpec);
    saveSpecToStorage(useEditorStore.getState().spec, null);
    confirm.mockClear();
    stop = startSpecAutosave();
    expect(await newSpec()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("an autosave based on an older disk revision is not offered as a draft of the newer file (review)", async () => {
    localStorage.setItem(key, JSON.stringify({ fileName: "same.json", spec: { ...initial, name: "older autosave" }, diskRevision: "old-revision" }));
    useDocumentStore.getState().clearFileName();
    stop = startSpecAutosave();
    useEditorStore.getState().loadSpec({ ...initial, name: "changed on disk" });
    useDocumentStore.getState().setFileName("same.json", "new-revision");
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "remote" });
  });
  it("the draft reason survives a reload of the paused tab (review)", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    editPageName("draft before reload");
    expect(await newSpec()).toBe(true);
    useEditorStore.getState().loadSpec(initial);
    useDocumentStore.getState().setFileName("same.json", "loaded-revision");
    expect(useSaveConflictStore.getState().reason).toBe("draft");
    stop();
    useSaveConflictStore.setState({ paused: false, reason: "remote" });
    vi.stubGlobal("performance", { getEntriesByType: () => [{ type: "reload" }] });
    stop = startSpecAutosave();
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
  });
});
