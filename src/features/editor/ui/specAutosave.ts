import { migrateV01 } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { readWorkspaceSpecSnapshot } from "./workspaceClient";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore, type PauseReason } from "@/features/editor/store/saveConflictStore";
import {
  serializeStoredDocument, parseStoredDocument, projectStorageKey, readRecovery, saveSpecToStorage, loadStoredSpec,
  writeRecovery, SPEC_STORAGE_KEY, type StoredDocument,
} from "@/features/editor/store/specStorage";

/** Browser lifecycle adapter; session recovery is written before any asynchronous save. */
export function startSpecAutosave() {
  const current = (): StoredDocument => ({ spec: useEditorStore.getState().spec,
    fileName: useDocumentStore.getState().fileName, diskRevision: useDocumentStore.getState().diskRevision });
  const recovery = readRecovery();
  let untitledId = crypto.randomUUID();
  let document = current();
  // A new browsing context may inherit sessionStorage from its opener. Only
  // actual reload/history restoration reuses an untitled shared-storage key.
  const navigation = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
  const reuseRecovery = document.fileName !== null || navigation?.type === "reload" || navigation?.type === "back_forward";
  const namedRecovery = reuseRecovery ? recovery : undefined;
  let key = document.fileName !== null ? projectStorageKey(document.fileName, untitledId)
    : namedRecovery?.key ?? projectStorageKey(null, untitledId);
  let baseline = namedRecovery ? namedRecovery.baseline : read(key);
  let conflicted = recovery?.conflicted ?? false;
  let diskConflict = recovery?.diskConflict ?? false;
  let pauseReason: PauseReason = recovery?.reason === "draft" ? "draft" : "remote";
  let renameBaseline = namedRecovery?.renameBaseline ?? null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let generation = 0;
  let restoring = false;
  let ownedTarget: { key: string; raw: string } | undefined;
  // Open/홈 카드로 지금 파일을 다시 여는 중이다(#267 리뷰). 파일명이 그대로라 아래
  // changed()의 파일 전환 비교를 타지 않으므로, 불러온 직후 따로 초안과 비교한다.
  let reopenKey: string | null = null;
  // An untitled draft has no file to reopen it from; switching away must ask (#267).
  // At startup the history is empty, so judge by content: anything restored from
  // storage that is not a blank New may be the user's only copy.
  let untitledEdited = document.fileName === null && loadStoredSpec() !== undefined &&
    JSON.stringify(document.spec) !== JSON.stringify(migrateV01(blankSpec));

  function read(storageKey: string): string | null {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }
  function preserve() {
    return writeRecovery({ document, key, baseline, conflicted, renameBaseline, diskConflict, reason: pauseReason });
  }
  function pause(fromDisk = false, reason: PauseReason = "remote") {
    diskConflict ||= fromDisk;
    conflicted = true;
    pauseReason = reason;
    clearTimeout(timer);
    preserve();
    useSaveConflictStore.setState({ paused: true, reason });
  }
  // The autosave is an unsaved draft of the opened file only when it was based on
  // the same disk revision. Otherwise the disk moved on too (#267 review): keep
  // the conflict wording, whose default does not replace the newer disk content.
  function draftOf(stored: string, opened: StoredDocument): PauseReason {
    const revision = parseStoredDocument(stored)?.diskRevision;
    return revision && revision === opened.diskRevision ? "draft" : "remote";
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
      const raw = serializeStoredDocument(document);
      try {
        localStorage.setItem(key, raw);
        baseline = raw;
        saveSpecToStorage(document.spec, document.fileName, document.diskRevision);
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
      if (next.fileName === null) untitledId = crypto.randomUUID();
      key = projectStorageKey(next.fileName, untitledId);
      baseline = read(key);
      renameBaseline = read(`${key}:rename`);
      if (baseline !== null && baseline !== serializeStoredDocument(next) &&
        !(ownedTarget?.key === key && ownedTarget.raw === baseline)) pause(false, draftOf(baseline, next));
      ownedTarget = undefined;
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
    if (!preserve() || conflicted || serializeStoredDocument(document) !== read(SPEC_STORAGE_KEY)) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  function loadLatest(): boolean | Promise<boolean> {
    if (diskConflict) return loadLatestDisk();
    const notice = read(`${key}:rename`);
    const redirect = notice !== renameBaseline ? notice : null;
    let latest = parseStoredDocument(redirect ?? read(key));
    if (redirect !== null && latest) {
      const cache = read(projectStorageKey(latest.fileName, untitledId));
      const announcedCache: unknown = JSON.parse(redirect).cachedRevision;
      if (cache !== announcedCache) latest = parseStoredDocument(cache) ?? latest;
    }
    if (!latest) return false;
    return adoptLatest(latest);
  }
  async function loadLatestDisk(): Promise<boolean> {
    const fileName = document.fileName;
    const expectedGeneration = generation;
    if (fileName === null) return false;
    const snapshot = await readWorkspaceSpecSnapshot(`specs/${fileName}`);
    if (!snapshot || stopped || generation !== expectedGeneration) return false;
    const parsed = parseSpecJson(snapshot.text);
    if (!parsed.ok) return false;
    const spec = "screen" in parsed.spec ? migrateV01(parsed.spec) : parsed.spec;
    return adoptLatest({ fileName, spec, diskRevision: snapshot.revision });
  }
  function adoptLatest(latest: StoredDocument): boolean {
    restoring = true;
    generation++;
    clearTimeout(timer);
    const sameUntitled = latest.fileName === null && document.fileName === null;
    document = latest;
    if (!sameUntitled) key = projectStorageKey(latest.fileName, untitledId);
    baseline = read(key);
    renameBaseline = read(`${key}:rename`);
    conflicted = false;
    diskConflict = false;
    untitledEdited = latest.fileName === null;
    useEditorStore.getState().loadSpec(latest.spec);
    if (latest.fileName === null) useDocumentStore.getState().clearFileName();
    else useDocumentStore.getState().setFileName(latest.fileName, latest.diskRevision ?? null);
    restoring = false;
    preserve();
    useSaveConflictStore.setState({ paused: false });
    return true;
  }
  async function save(fileName: string, json: string, write: () => Promise<boolean>): Promise<boolean> {
    const expectedGeneration = generation;
    const target = projectStorageKey(fileName, untitledId);
    const raw = serializeStoredDocument({ fileName, spec: JSON.parse(json),
      diskRevision: fileName === document.fileName ? document.diskRevision : null });
    if (typeof navigator === "undefined" || !navigator.locks) {
      window.alert("안전한 탭 간 파일 저장을 사용할 수 없습니다. File → Export로 별도 다운로드하세요.");
      return false;
    }
    try {
      return await navigator.locks.request(target, async () => {
        if (stopped || generation !== expectedGeneration || check()) return false;
        const previous = read(target);
        if (target !== key && previous !== null && previous !== raw) {
          window.alert("다른 탭의 자동저장이 있는 파일입니다. 다른 파일명을 선택하거나 해당 프로젝트를 열어 충돌을 먼저 해결하세요.");
          return false;
        }
        // Publish before the network write, under the same lock as autosave. A
        // second tab pressing Save inside the debounce cannot pass a stale check.
        localStorage.setItem(target, raw);
        if (target !== key) ownedTarget = { key: target, raw };
        if (target === key) { baseline = raw; preserve(); }
        let written = false;
        try { written = await write(); }
        finally {
          // A failed Save as must not reserve a target that was never written.
          // Compare before rollback so a later revision is never removed.
          if (!written && target !== key && read(target) === raw) {
            if (previous === null) localStorage.removeItem(target);
            else localStorage.setItem(target, previous);
          }
          if (!written) ownedTarget = undefined;
        }
        // Source tabs can change while this target's HTTP write is pending.
        // Keep the source draft paused; never adopt the target on that conflict.
        if (!written || generation !== expectedGeneration || check()) {
          ownedTarget = undefined;
          return false;
        }
        return true;
      });
    } catch {
      window.alert("안전하게 저장할 수 없습니다. 초안은 유지됩니다. File → Export로 별도 다운로드하세요.");
      return false;
    }
  }
  // New/Open/home replace the document synchronously, so a debounced draft would
  // be dropped with the cancelled timer (#267). Persist it under the lock first.
  async function settle(nextFileName?: string | null): Promise<boolean> {
    if (!conflicted && read(key) !== serializeStoredDocument(document)) await flush();
    if (stopped || conflicted || check()) return false;
    reopenKey = typeof nextFileName === "string" && document.fileName !== null &&
      projectStorageKey(nextFileName, untitledId) === key ? key : null;
    if (document.fileName === null && untitledEdited) {
      return window.confirm("저장하지 않은 제목 없는 문서입니다. 계속하면 이 문서의 내용은 다시 열 수 없습니다. 먼저 File → Save로 저장하려면 취소하세요.");
    }
    if (read(key) === serializeStoredDocument(document)) return true;
    return window.confirm("현재 문서의 변경 내용을 자동저장하지 못했습니다. 계속하면 저장되지 않은 변경이 사라집니다. File → Export로 먼저 보관하려면 취소하세요.");
  }
  // A reopened file whose autosave differs is the same choice as opening it from
  // another document: the draft must be offered, not overwritten by the next autosave.
  function checkReopen() {
    if (conflicted || document.fileName === null || projectStorageKey(document.fileName, untitledId) !== key) return;
    const stored = read(key);
    if (stored !== null && stored !== serializeStoredDocument(document)) pause(false, draftOf(stored, document));
  }
  // The opened file is older than its autosave draft: keep the opened content and
  // let the next autosave replace that draft. The dialog confirms the discard.
  function discardDraft() {
    conflicted = false;
    diskConflict = false;
    baseline = read(key);
    renameBaseline = read(`${key}:rename`);
    preserve();
    useSaveConflictStore.setState({ paused: false });
    clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, 500);
  }
  const readDraft = () => parseStoredDocument(read(key))?.spec;
  const captureDocument = () => {
    const expectedGeneration = generation;
    return () => !stopped && generation === expectedGeneration;
  };
  const adoptRename = (update: () => void) => {
    restoring = true;
    try { update(); } finally { restoring = false; }
    generation++;
    document = current();
    key = projectStorageKey(document.fileName, untitledId);
    baseline = read(key);
    renameBaseline = read(`${key}:rename`);
    preserve();
    clearTimeout(timer);
    if (!conflicted) timer = setTimeout(() => { void flush(); }, 500);
  };
  useSaveConflictStore.setState({ paused: conflicted, reason: pauseReason, loadLatest, check, pause, save, settle, discardDraft, readDraft, captureDocument, adoptRename });
  if (!recovery && baseline !== null && baseline !== serializeStoredDocument(document)) pause(false, draftOf(baseline, document));
  check();
  preserve();
  const unsubscribeSpec = useEditorStore.subscribe((s, prev) => {
    if (s.spec !== prev.spec) {
      // loadSpec/New/Open reset history; edits and undo/redo retain a history side.
      if (!restoring && s.history.past.length === 0 && s.history.future.length === 0) {
        generation++;
        untitledEdited = false;
        if (reopenKey !== null && reopenKey === key) {
          // Open은 loadSpec 다음 줄에서 setFileName(같은 이름, 디스크 리비전)을 부른다.
          // 그 리비전까지 반영된 뒤 비교해야 디스크가 바뀐 경우를 초안으로 오인하지 않는다.
          queueMicrotask(checkReopen);
        }
        reopenKey = null;
        if (useDocumentStore.getState().fileName === null) {
          untitledId = crypto.randomUUID();
          key = projectStorageKey(null, untitledId);
          baseline = null;
          renameBaseline = null;
        }
      } else if (!restoring) untitledEdited = true;
      changed();
    }
  });
  const unsubscribeFile = useDocumentStore.subscribe((s, prev) => {
    if (s.fileName !== prev.fileName || s.diskRevision !== prev.diskRevision) changed();
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
