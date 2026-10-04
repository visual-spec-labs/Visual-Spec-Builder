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
  let renameBaseline = recovery?.renameBaseline ?? null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let generation = 0;
  let restoring = false;

  function read(storageKey: string): string | null {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }
  function preserve() {
    return writeRecovery({ document, key, baseline, conflicted, renameBaseline });
  }
  function pause() {
    conflicted = true;
    clearTimeout(timer);
    preserve();
    useSaveConflictStore.setState({ paused: true });
  }
  function check() {
    if (read(key) !== baseline || read(`${key}:rename`) !== renameBaseline) pause();
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
      renameBaseline = read(`${key}:rename`);
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
    const notice = read(`${key}:rename`);
    const redirect = notice !== renameBaseline ? notice : null;
    let latest = parseStoredDocument(redirect ?? read(key));
    if (redirect !== null && latest) {
      const cache = read(projectStorageKey(latest.fileName, untitledId));
      const announcedCache: unknown = JSON.parse(redirect).cachedRevision;
      if (cache !== announcedCache) latest = parseStoredDocument(cache) ?? latest;
    }
    if (!latest) return false;
    restoring = true;
    generation++;
    clearTimeout(timer);
    document = latest;
    key = projectStorageKey(latest.fileName, untitledId);
    baseline = read(key);
    renameBaseline = read(`${key}:rename`);
    conflicted = false;
    useEditorStore.getState().loadSpec(latest.spec);
    if (latest.fileName === null) useDocumentStore.getState().clearFileName();
    else useDocumentStore.getState().setFileName(latest.fileName);
    restoring = false;
    preserve();
    useSaveConflictStore.setState({ paused: false });
    return true;
  }
  async function save(fileName: string, json: string, write: () => Promise<boolean>): Promise<boolean> {
    const target = projectStorageKey(fileName, untitledId);
    const raw = JSON.stringify({ fileName, spec: JSON.parse(json) });
    if (typeof navigator === "undefined" || !navigator.locks) {
      window.alert("안전한 탭 간 파일 저장을 사용할 수 없습니다. File → Export로 별도 다운로드하세요.");
      return false;
    }
    try {
      return await navigator.locks.request(target, async () => {
        if (stopped || check()) return false;
        const previous = read(target);
        if (target !== key && previous !== null && previous !== raw) {
          window.alert("다른 탭의 자동저장이 있는 파일입니다. 다른 파일명을 선택하거나 해당 프로젝트를 열어 충돌을 먼저 해결하세요.");
          return false;
        }
        // Publish before the network write, under the same lock as autosave. A
        // second tab pressing Save inside the debounce cannot pass a stale check.
        localStorage.setItem(target, raw);
        if (target === key) { baseline = raw; preserve(); }
        return await write();
      });
    } catch {
      window.alert("안전하게 저장할 수 없습니다. 초안은 유지됩니다. File → Export로 별도 다운로드하세요.");
      return false;
    }
  }
  useSaveConflictStore.setState({ paused: conflicted, loadLatest, check, save });
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
