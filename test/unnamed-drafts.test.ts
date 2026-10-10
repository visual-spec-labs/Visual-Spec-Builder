import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { claimDraft } from "@/features/editor/ui/draftOwnership";
import {
  listUnnamedDrafts, recordUnnamedDraftSaved, removeAllUnnamedDrafts, summarizeUnnamedDraft, useUnnamedDraftStore,
} from "@/features/editor/store/unnamedDraftStore";
import { loadStoredSpec, readRecovery, serializeStoredDocument, writeRecovery, type StoredDocument } from "@/features/editor/store/specStorage";
import { startSpecAutosave } from "@/features/editor/ui/specAutosave";
import { beginDocumentTransition } from "@/features/editor/ui/documentTransition";
import { promptConfirm, usePromptDialogStore } from "@/features/editor/store/promptDialogStore";
import { blankSpec } from "@/features/editor/store/blankSpec";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; } };
}
function locks() {
  const requests: string[] = [];
  const held = new Map<string, Promise<unknown>>();
  return { requests, query: async () => ({ held: [...held.keys()].map(name => ({ name })), pending: [] }), request: async (key: string, options: unknown, callback?: (lock: object | null) => unknown) => {
    requests.push(key);
    if (callback && held.has(key)) return callback(null);
    while (held.has(key)) await held.get(key);
    const fn = callback ?? options as (lock: object) => unknown;
    let release!: () => void;
    held.set(key, new Promise<void>(resolve => { release = resolve; }));
    try { return await fn({ name: key }); }
    finally { held.delete(key); release(); }
  } };
}
let stop: (() => void) | undefined;
let initial: StoredDocument;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", storage()); vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("navigator", { locks: locks() });
  vi.stubGlobal("performance", { getEntriesByType: () => [{ type: "reload" }] });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: vi.fn(() => true), alert: vi.fn() });
  useEditorStore.getState().loadSpec(blankSpec);
  useDocumentStore.getState().clearFileName();
  useSaveConflictStore.setState({ paused: false, unavailable: false });
  useUnnamedDraftStore.setState({ active: null });
  initial = { fileName: null, spec: { ...useEditorStore.getState().spec, name: "Recover exact content" } };
});
afterEach(async () => { stop?.(); stop = undefined; await Promise.resolve(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function seed(id = "saved-uuid", document = initial) {
  const key = `visual-spec:autosave:draft:${id}`;
  const raw = serializeStoredDocument(document);
  localStorage.setItem(key, raw);
  return { key, raw, document };
}
async function edit() {
  useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "Edited content");
  await vi.advanceTimersByTimeAsync(600);
}

it("lists only validated edited unnamed documents, excluding named, pristine and auxiliary keys", () => {
  seed(); seed("blank", { fileName: null, spec: useEditorStore.getState().spec });
  seed("named", { ...initial, fileName: "named.json" }); seed("saved-uuid:owner");
  localStorage.setItem("visual-spec:autosave:draft:corrupt", "{");
  expect(listUnnamedDrafts().map(item => item.key)).toEqual(["visual-spec:autosave:draft:saved-uuid"]);
});
it("resume adopts the exact UUID/content from a named document and keeps identity through edit/reload", async () => {
  const draft = seed();
  useDocumentStore.getState().setFileName("existing.json");
  stop = startSpecAutosave();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("ok");
  expect(readRecovery()?.key).toBe(draft.key);
  expect(useEditorStore.getState().spec).toEqual(initial.spec);
  await edit();
  const snapshot = readRecovery()!;
  stop(); await Promise.resolve(); stop = startSpecAutosave();
  expect(readRecovery()?.key).toBe(draft.key);
  expect(readRecovery()?.document).toEqual(snapshot.document);
  expect(localStorage.getItem(draft.key)).toBe(serializeStoredDocument(snapshot.document));
});
it("same-tab Home resume preserves selection/history and does not replace the current document", async () => {
  stop = startSpecAutosave(); await edit();
  const before = useEditorStore.getState(); const draft = listUnnamedDrafts()[0];
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("ok");
  expect(useEditorStore.getState()).toBe(before);
});
it("other-tab ownership blocks both Resume and deletion without overwriting either document", async () => {
  const draft = seed(); const owner = claimDraft(draft.key); expect(await owner.ready).toBe(true);
  stop = startSpecAutosave(); const before = useEditorStore.getState().spec;
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("busy");
  expect(await useUnnamedDraftStore.getState().remove(draft)).toBe("busy");
  expect(useEditorStore.getState().spec).toBe(before); expect(localStorage.getItem(draft.key)).toBe(draft.raw);
  await owner.release();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("ok");
});
it("stale delete and resume cannot remove or adopt a newer cache revision", async () => {
  const draft = seed(); stop = startSpecAutosave(); seed("saved-uuid", { ...initial, spec: { ...initial.spec, name: "Newer" } });
  expect(await useUnnamedDraftStore.getState().remove(draft)).toBe("changed");
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("changed");
  expect(listUnnamedDrafts()[0].document.spec.name).toBe("Newer");
});
it("cancelled or stale transitions preserve source and target, including duplicate resume requests", async () => {
  const draft = seed(); stop = startSpecAutosave(); await edit();
  let finish!: (ok: boolean) => void;
  useSaveConflictStore.setState({ settle: () => new Promise<boolean>(resolve => { finish = resolve; }) });
  const pending = useUnnamedDraftStore.getState().resume(draft);
  await Promise.resolve(); await Promise.resolve();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("cancelled");
  finish(false); expect(await pending).toBe("cancelled");
  const source = readRecovery()!.key;
  const stale = useUnnamedDraftStore.getState().resume(draft);
  await Promise.resolve(); await Promise.resolve();
  useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "After dialog");
  finish(true); expect(await stale).toBe("cancelled");
  expect(readRecovery()?.key).toBe(source); expect(localStorage.getItem(draft.key)).toBe(draft.raw);
});
it("explicit deletion clears active recovery, blocks delayed saves and rejects old session resurrection", async () => {
  stop = startSpecAutosave(); await edit(); const prior = readRecovery()!; const draft = listUnnamedDrafts()[0];
  expect(await useUnnamedDraftStore.getState().remove(draft)).toBe("ok");
  expect(readRecovery()?.key).not.toBe(draft.key);
  await vi.advanceTimersByTimeAsync(1000);
  expect(localStorage.getItem(draft.key)).toBeNull(); expect(listUnnamedDrafts()).toEqual([]);
  writeRecovery(prior); expect(readRecovery()).toBeUndefined(); expect(loadStoredSpec()).not.toEqual(prior.document.spec);
});
it("failed Save keeps recovery; successful Save retires only the adopted source after filename adoption", async () => {
  stop = startSpecAutosave(); await edit(); const draft = listUnnamedDrafts()[0];
  const json = JSON.stringify(useEditorStore.getState().spec);
  expect(await useSaveConflictStore.getState().save("saved.json", json, async () => false)).toBe(false);
  expect(localStorage.getItem(draft.key)).toBe(draft.raw);
  expect(await useSaveConflictStore.getState().save("saved.json", json, async () => true)).toBe(true);
  expect(localStorage.getItem(draft.key)).toBe(draft.raw);
  useDocumentStore.getState().setFileName("saved.json", "revision");
  await vi.advanceTimersByTimeAsync(600);
  expect(localStorage.getItem(draft.key)).toBeNull(); expect(listUnnamedDrafts()).toEqual([]);
  expect(readRecovery()?.document.fileName).toBe("saved.json");
});
it("without Web Locks, recovery actions do not write or silently replace documents", async () => {
  const draft = seed(); vi.stubGlobal("navigator", {}); stop = startSpecAutosave();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("unavailable");
  expect(await useUnnamedDraftStore.getState().remove(draft)).toBe("unavailable");
  expect(localStorage.getItem(draft.key)).toBe(draft.raw);
});

it("StrictMode restart waits for its own asynchronous lock cleanup and retains one owner", async () => {
  const manager = locks();
  vi.stubGlobal("navigator", { locks: { request: (key: string, options: unknown, callback: (lock: object | null) => unknown) =>
    manager.request(key, options, async lock => { await Promise.resolve(); return callback(lock); }) } });
  const first = claimDraft("restart-fixture");
  const releasing = first.release();
  const replacement = claimDraft("restart-fixture");
  expect(await first.ready).toBe(false);
  expect(await replacement.ready).toBe(true);
  await releasing;
  const competitor = claimDraft("restart-fixture");
  expect(await competitor.ready).toBe(false);
  await competitor.release();
  await replacement.release();
});

it("Home can resume this tab before debounce or with blocked browser storage", async () => {
  vi.stubGlobal("navigator", {});
  stop = startSpecAutosave();
  useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "Session-only fixture");
  const draft = useUnnamedDraftStore.getState().active!;
  expect(draft).not.toBeNull();
  expect(listUnnamedDrafts()).toEqual([]);
  const before = useEditorStore.getState();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("ok");
  expect(useEditorStore.getState()).toBe(before);
  expect(readRecovery()?.key).toBe(draft.key);
});

it("edit then Undo cannot revive an old Resume approval even with the exact source spec object", async () => {
  const draft = seed(); stop = startSpecAutosave(); await edit();
  const before = useEditorStore.getState().spec;
  const source = readRecovery()!.key;
  let finish!: (ok: boolean) => void;
  useSaveConflictStore.setState({ settle: () => new Promise<boolean>(resolve => { finish = resolve; }) });
  const pending = useUnnamedDraftStore.getState().resume(draft);
  await Promise.resolve(); await Promise.resolve();
  useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "Transient edit");
  useEditorStore.getState().undo();
  expect(useEditorStore.getState().spec).toBe(before);
  finish(true);
  expect(await pending).toBe("cancelled");
  expect(readRecovery()?.key).toBe(source);
  expect(useEditorStore.getState().history.future).toHaveLength(1);
  expect(localStorage.getItem(draft.key)).toBe(draft.raw);
});

it("a returning tab refuses the same UUID owned by another tab and can reacquire it after close", async () => {
  const draft = seed();
  const other = claimDraft(draft.key);
  expect(await other.ready).toBe(true);
  useEditorStore.getState().loadSpec(draft.document.spec);
  writeRecovery({ document: draft.document, key: draft.key, baseline: draft.raw, conflicted: false });
  stop = startSpecAutosave();
  try {
    expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("busy");
    expect(readRecovery()?.key).toBe(draft.key);
    expect(localStorage.getItem(draft.key)).toBe(draft.raw);
  } finally { await other.release(); }
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("ok");
  await edit();
  expect(readRecovery()?.key).toBe(draft.key);
  expect(JSON.parse(localStorage.getItem(draft.key)!).spec).toEqual(useEditorStore.getState().spec);
  const write = vi.fn(async () => true);
  expect(await useSaveConflictStore.getState().save("reacquired.json", JSON.stringify(useEditorStore.getState().spec), write)).toBe(true);
  expect(write).toHaveBeenCalledOnce();
});

it("ownership retry never overwrites the newer owner revision, even before a storage event", async () => {
  const draft = seed(); const other = claimDraft(draft.key); expect(await other.ready).toBe(true);
  useEditorStore.getState().loadSpec(draft.document.spec);
  writeRecovery({ document: draft.document, key: draft.key, baseline: draft.raw, conflicted: false });
  stop = startSpecAutosave();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("busy");
  const newer = seed("saved-uuid", { ...initial, spec: { ...initial.spec, name: "Other owner revision" } });
  await other.release();
  expect(await useUnnamedDraftStore.getState().resume(draft)).toBe("changed");
  expect(useSaveConflictStore.getState().paused).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(localStorage.getItem(draft.key)).toBe(newer.raw);
  expect(useEditorStore.getState().spec).toEqual(draft.document.spec);
  expect(useSaveConflictStore.getState().loadLatest()).toBe(true);
  expect(await useUnnamedDraftStore.getState().resume(useUnnamedDraftStore.getState().active!)).toBe("ok");
  await edit();
  expect(JSON.parse(localStorage.getItem(draft.key)!).spec.name).toBe("Other owner revision");
});

it("Delete reacquires a failed startup claim after the owner closes, without requiring Resume", async () => {
  const draft = seed(); const other = claimDraft(draft.key); expect(await other.ready).toBe(true);
  useEditorStore.getState().loadSpec(draft.document.spec);
  writeRecovery({ document: draft.document, key: draft.key, baseline: draft.raw, conflicted: false });
  stop = startSpecAutosave();
  try {
    expect(await useUnnamedDraftStore.getState().remove(draft)).toBe("busy");
    expect(localStorage.getItem(draft.key)).toBe(draft.raw);
  } finally { await other.release(); }
  expect(await useUnnamedDraftStore.getState().remove(draft)).toBe("ok");
  await vi.advanceTimersByTimeAsync(1000);
  expect(localStorage.getItem(draft.key)).toBeNull();
  expect(readRecovery()?.key).not.toBe(draft.key);
});

it("Delete rechecks CAS after reacquiring ownership and waiting for the mutation lock", async () => {
  const manager = locks(); vi.stubGlobal("navigator", { locks: manager });
  const draft = seed(); const other = claimDraft(draft.key); expect(await other.ready).toBe(true);
  useEditorStore.getState().loadSpec(draft.document.spec);
  writeRecovery({ document: draft.document, key: draft.key, baseline: draft.raw, conflicted: false });
  stop = startSpecAutosave(); await other.release();
  let unlock!: () => void;
  const held = navigator.locks.request(draft.key, () => new Promise<void>(resolve => { unlock = resolve; }));
  const deleting = useUnnamedDraftStore.getState().remove(draft);
  await vi.waitFor(() => expect(manager.requests.filter(key => key === draft.key)).toHaveLength(2));
  const newer = seed("saved-uuid", { ...initial, spec: { ...initial.spec, name: "Changed while deletion waited" } });
  unlock(); await held;
  expect(await deleting).toBe("changed");
  expect(localStorage.getItem(draft.key)).toBe(newer.raw);
  expect(localStorage.getItem(`${draft.key}:deleted`)).toBeNull();
  expect(useEditorStore.getState().spec).toEqual(draft.document.spec);
});

it("records the save time outside the raw envelope and lists most recent first, untimed legacy drafts last", async () => {
  const older = seed("b-older"); recordUnnamedDraftSaved(older.key, 1000);
  const newer = seed("a-newer"); recordUnnamedDraftSaved(newer.key, 3000);
  seed("d-legacy"); seed("c-corrupt-meta"); localStorage.setItem("visual-spec:autosave:draft:c-corrupt-meta:meta", "{");
  expect(listUnnamedDrafts().map(item => [item.key.split(":").pop(), item.savedAt])).toEqual([
    ["a-newer", 3000], ["b-older", 1000], ["c-corrupt-meta", null], ["d-legacy", null]]);
  vi.setSystemTime(5000);
  stop = startSpecAutosave(); await edit();
  const [own] = listUnnamedDrafts();
  expect(own.key).toBe(readRecovery()!.key);
  expect(own.savedAt).toBe(5000 + 500); // debounce가 원문을 쓴 순간
  expect(own.raw).toBe(serializeStoredDocument(readRecovery()!.document));
  expect(Object.keys(JSON.parse(own.raw))).toEqual(["fileName", "spec"]);
});
it("summarizes page count, first page name/size and layer count", () => {
  const spec = initial.spec; const [first] = spec.pageOrder;
  const twoPages = { ...spec, pages: { ...spec.pages, second: spec.pages[first] }, pageOrder: [first, "second"] as [string, ...string[]] };
  expect(summarizeUnnamedDraft(twoPages)).toEqual({ pages: 2, firstPage: spec.pages[first].name, width: 1440, height: 900,
    layers: Object.keys(spec.pages[first].nodes).length });
});
it("the save-time record does not break Resume/Delete CAS and is cleaned with the deletion barrier", async () => {
  const draft = seed(); recordUnnamedDraftSaved(draft.key, 1000);
  stop = startSpecAutosave();
  expect(await useUnnamedDraftStore.getState().resume(listUnnamedDrafts()[0])).toBe("ok");
  vi.setSystemTime(9000); await edit();
  const [edited] = listUnnamedDrafts();
  expect(edited.key).toBe(draft.key); expect(edited.savedAt).toBeGreaterThan(1000);
  expect(await useUnnamedDraftStore.getState().resume(edited)).toBe("ok");
  expect(await useUnnamedDraftStore.getState().remove(edited)).toBe("ok");
  expect(localStorage.getItem(draft.key)).toBeNull();
  expect(localStorage.getItem(`${draft.key}:meta`)).toBeNull();
  expect(localStorage.getItem(`${draft.key}:deleted`)).toBe("1");
});
it("bulk delete excludes this tab's draft and other-tab owners, then removes the rest through remove()", async () => {
  stop = startSpecAutosave(); await edit();
  const active = useUnnamedDraftStore.getState().active!;
  const free = seed("free"); const owned = seed("owned"); const owner = claimDraft(owned.key); expect(await owner.ready).toBe(true);
  const confirm = vi.fn(async () => true);
  try {
    expect(await removeAllUnnamedDrafts(confirm)).toEqual({ removed: 1, skipped: 0, failed: 0, excluded: 2 });
    expect(confirm).toHaveBeenCalledWith({ targets: [expect.objectContaining({ key: free.key })], excluded: 2 });
    expect(localStorage.getItem(free.key)).toBeNull(); expect(localStorage.getItem(`${free.key}:deleted`)).toBe("1");
    expect(localStorage.getItem(owned.key)).toBe(owned.raw); expect(localStorage.getItem(active.key)).toBe(active.raw);
    expect(useUnnamedDraftStore.getState().active?.key).toBe(active.key);
  } finally { await owner.release(); }
});
it("bulk delete without lock query still refuses other-tab owners through remove()", async () => {
  const manager = locks(); vi.stubGlobal("navigator", { locks: { request: manager.request } });
  const owned = seed("owned"); const owner = claimDraft(owned.key); expect(await owner.ready).toBe(true);
  stop = startSpecAutosave();
  try {
    expect(await removeAllUnnamedDrafts(async () => true)).toEqual({ removed: 0, skipped: 1, failed: 0, excluded: 0 });
    expect(localStorage.getItem(owned.key)).toBe(owned.raw);
  } finally { await owner.release(); }
});
it("cancelled bulk delete changes nothing", async () => {
  const one = seed("one"); const two = seed("two"); stop = startSpecAutosave();
  expect(await removeAllUnnamedDrafts(async () => false)).toBeNull();
  expect(localStorage.getItem(one.key)).toBe(one.raw); expect(localStorage.getItem(two.key)).toBe(two.raw);
  expect(localStorage.getItem(`${one.key}:deleted`)).toBeNull(); expect(listUnnamedDrafts()).toHaveLength(2);
});
it("bulk delete skips only a draft whose raw changed after confirmation", async () => {
  const one = seed("one"); const two = seed("two"); stop = startSpecAutosave();
  const result = await removeAllUnnamedDrafts(async () => {
    seed("one", { ...initial, spec: { ...initial.spec, name: "Changed after confirmation" } });
    return true;
  });
  expect(result).toEqual({ removed: 1, skipped: 1, failed: 0, excluded: 0 });
  expect(JSON.parse(localStorage.getItem(one.key)!).spec.name).toBe("Changed after confirmation");
  expect(localStorage.getItem(`${one.key}:deleted`)).toBeNull();
  expect(localStorage.getItem(two.key)).toBeNull(); expect(localStorage.getItem(`${two.key}:deleted`)).toBe("1");
});

it.each([1e20, -1e20, 8640000000000001, -8640000000000001])("treats out-of-Date-range metadata %s as untimed", savedAt => {
  const draft = seed(); recordUnnamedDraftSaved(draft.key, savedAt);
  expect(listUnnamedDrafts()[0].savedAt).toBeNull();
});
it("counts the pending active draft exactly once in the bulk exclusion total", async () => {
  seed("free"); stop = startSpecAutosave();
  useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", "Pending write");
  const active = useUnnamedDraftStore.getState().active!;
  expect(localStorage.getItem(active.key)).toBeNull();
  const confirm = vi.fn(async () => true);
  expect(await removeAllUnnamedDrafts(confirm)).toEqual({ removed: 1, skipped: 0, failed: 0, excluded: 1 });
  expect(confirm).toHaveBeenCalledWith({ targets: [expect.anything()], excluded: 1 });
  expect(useUnnamedDraftStore.getState().active?.key).toBe(active.key);
});


it("does not open a stale bulk prompt after a delayed lock query", async () => {
  seed(); stop = startSpecAutosave();
  const manager = locks(); let release!: () => void;
  vi.stubGlobal("navigator", { locks: { ...manager, query: async () => {
    await new Promise<void>(resolve => { release = resolve; }); return manager.query();
  } } });
  const confirm = vi.fn(async () => true);
  const pending = removeAllUnnamedDrafts(confirm, beginDocumentTransition());
  beginDocumentTransition();
  const latest = promptConfirm({ title: "Latest Open", message: "Keep this prompt", signal: new AbortController().signal });
  const prompt = usePromptDialogStore.getState().state;
  release(); expect(await pending).toBeNull();
  expect(confirm).not.toHaveBeenCalled(); expect(usePromptDialogStore.getState().state).toBe(prompt);
  usePromptDialogStore.getState().resolve(null); expect(await latest).toBe(false);
});
it("keeps a newer prompt and all remaining drafts when bulk waits on a mutation lock", async () => {
  const manager = locks(); vi.stubGlobal("navigator", { locks: manager });
  const one = seed("a-one"); const two = seed("b-two"); stop = startSpecAutosave();
  let release!: () => void;
  const held = navigator.locks.request(one.key, () => new Promise<void>(resolve => { release = resolve; }));
  const pending = removeAllUnnamedDrafts(async () => true, beginDocumentTransition());
  await vi.waitFor(() => expect(manager.requests.filter(key => key === one.key)).toHaveLength(2));
  beginDocumentTransition();
  const latest = promptConfirm({ title: "Latest New", message: "Keep this prompt", signal: new AbortController().signal });
  const prompt = usePromptDialogStore.getState().state;
  release(); await held; expect(await pending).toBeNull();
  expect(usePromptDialogStore.getState().state).toBe(prompt);
  expect(manager.requests).not.toContain(`${two.key}:owner`);
  for (const draft of [one, two]) {
    expect(localStorage.getItem(draft.key)).toBe(draft.raw);
    expect(localStorage.getItem(`${draft.key}:deleted`)).toBeNull();
  }
  usePromptDialogStore.getState().resolve(null); expect(await latest).toBe(false);
});
