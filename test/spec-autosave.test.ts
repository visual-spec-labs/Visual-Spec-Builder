import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { loadStoredSpec, parseStoredDocument, projectStorageKey, readRecovery, publishProjectRename } from "@/features/editor/store/specStorage";
import { startSpecAutosave } from "@/features/editor/ui/specAutosave";
import { saveSpec, saveSpecAs, downloadConflictCopy } from "@/features/editor/ui/exportSpecAsJson";

function storage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); } };
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
    removeEventListener: (name: string) => listeners.delete(name), alert: vi.fn(), prompt: vi.fn() });
  useEditorStore.getState().loadSpec(initial);
  useDocumentStore.getState().setFileName("same.json");
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
