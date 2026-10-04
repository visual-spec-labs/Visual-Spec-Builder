import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import {
  parseStoredDocument, projectStorageKey, readRecovery, saveSpecToStorage,
  writeRecovery, type StoredDocument,
} from "@/features/editor/store/specStorage";

/** Browser lifecycle adapter; session recovery is written before any asynchronous save. */
export function startSpecAutosave() {
  const current = (): StoredDocument => ({ spec: useEditorStore.getState().spec,
    fileName: useDocumentStore.getState().fileName });
  const recovery = readRecovery();
  const untitledId = crypto.randomUUID();
  let document = current();
  let key = recovery?.key ?? projectStorageKey(document.fileName, untitledId);
  let baseline = recovery ? recovery.baseline : read(key);
  let conflicted = recovery?.conflicted ?? false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let generation = 0;
  let restoring = false;

  function read(storageKey: string): string | null {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }
  function preserve() {
    return writeRecovery({ document, key, baseline, conflicted });
  }
  function pause() {
    conflicted = true;
    clearTimeout(timer);
    preserve();
    useSaveConflictStore.setState({ paused: true });
  }
  function check() {
    if (read(key) !== baseline || read(`${key}:rename`) !== null) pause();
    return conflicted;
  }
  async function flush() {
    clearTimeout(timer);
    const expectedGeneration = generation;
    const save = () => {
      if (stopped || expectedGeneration !== generation || check()) return;
      const raw = JSON.stringify(document);
      try {
        localStorage.setItem(key, raw);
        baseline = raw;
        saveSpecToStorage(document.spec, document.fileName);
        preserve();
      } catch { /* The per-tab recovery and explicit download remain available. */ }
    };
    // Serializes the compare/write pair across tabs. No unlocked write fallback:
    // unsupported browsers retain session recovery and manual file download.
    if (typeof navigator !== "undefined" && navigator.locks) {
      try { await navigator.locks.request(key, save); }
      catch { useSaveConflictStore.setState({ unavailable: true }); }
    } else {
      useSaveConflictStore.setState({ unavailable: true });
    }
  }
  function changed() {
    if (restoring) return;
    const next = current();
    if (next.fileName !== document.fileName) {
      generation++;
      key = projectStorageKey(next.fileName, untitledId);
      baseline = read(key);
      if (baseline !== null && baseline !== JSON.stringify(next)) pause();
    }
    document = next;
    preserve();
    clearTimeout(timer);
    if (!conflicted) timer = setTimeout(() => { void flush(); }, 500);
  }
  function storage(event: StorageEvent) {
    if (event.storageArea !== localStorage) return;
    if (event.key === key || event.key === `${key}:rename` || event.key === null) check();
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    // Async lock acquisition cannot be relied on during unload. Recovery is synchronous.
    if (!preserve() || conflicted) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  function loadLatest(): boolean {
    const redirect = read(`${key}:rename`);
    const raw = redirect ?? read(key);
    let latest = parseStoredDocument(raw);
    if (redirect !== null && latest) {
      latest = parseStoredDocument(read(projectStorageKey(latest.fileName, untitledId))) ?? latest;
    }
    if (!latest) return false;
    restoring = true;
    generation++;
    clearTimeout(timer);
    const renamed = latest.fileName !== document.fileName;
    document = latest;
    if (renamed) key = projectStorageKey(latest.fileName, untitledId);
    baseline = renamed ? read(key) : raw;
    conflicted = false;
    useEditorStore.getState().loadSpec(latest.spec);
    if (latest.fileName === null) useDocumentStore.getState().clearFileName();
    else useDocumentStore.getState().setFileName(latest.fileName);
    restoring = false;
    preserve();
    useSaveConflictStore.setState({ paused: false });
    return true;
  }
  useSaveConflictStore.setState({ paused: conflicted, loadLatest, check });
  if (!recovery && baseline !== null && baseline !== JSON.stringify(document)) pause();
  check();
  preserve();
  const unsubscribeSpec = useEditorStore.subscribe((s, prev) => {
    if (s.spec !== prev.spec) changed();
  });
  const unsubscribeFile = useDocumentStore.subscribe((s, prev) => {
    if (s.fileName !== prev.fileName) changed();
  });
  window.addEventListener("storage", storage);
  window.addEventListener("beforeunload", beforeUnload);
  return () => {
    stopped = true;
    clearTimeout(timer);
    preserve();
    unsubscribeSpec();
    unsubscribeFile();
    window.removeEventListener("storage", storage);
    window.removeEventListener("beforeunload", beforeUnload);
  };
}
