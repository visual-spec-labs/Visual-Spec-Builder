import { usePersistenceStatusStore, type DraftObservation } from "@/features/editor/store/persistenceStatusStore";
import { beginDocumentTransition } from "./documentTransition";
import { promptConfirm } from "@/features/editor/store/promptDialogStore";
import { claimDraft } from "./draftOwnership";
import { isRecoverableUnnamed, listUnnamedDrafts, notifyUnnamedDrafts, recordUnnamedDraftSaved, removeUnnamedDraft, useUnnamedDraftStore, type DraftResult, type UnnamedDraft } from "@/features/editor/store/unnamedDraftStore";
import { migrateV01 } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { readWorkspaceSpecSnapshot } from "./workspaceClient";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore, type PauseReason } from "@/features/editor/store/saveConflictStore";
import {
  serializeStoredDocument, parseStoredDocument, projectStorageKey, readRecovery, saveSpecToStorage, loadStoredSpec,
  writeRecovery, SPEC_STORAGE_KEY, type StoredDocument,
} from "@/features/editor/store/specStorage";

/**
 * 바로 앞 인스턴스가 멈추며 넘긴 편집 여부(#297). React StrictMode(개발)·HMR은 자동저장을
 * 멈추자마자 다시 시작한다. 새 인스턴스가 저장소만 보고 판단하면 방금 앞 인스턴스가 쓴 탭
 * 복구를 "다른 세션에서 복원한 문서"로 읽는다. 같은 커밋 안의 재시작에만 쓰도록 마이크로태스크
 * 한 번 뒤에 버린다 — 진짜 새로고침·다른 탭은 이 값을 보지 못한다.
 */
let restartHandoff: { serialized: string; edited: boolean } | null = null;

/** 첫 실행 데모 문서(seedSpec)나 빈 New 그대로인 제목 없는 문서 — 잃을 것이 없다(#297). */
const PRISTINE_UNTITLED = [migrateV01(blankSpec), migrateV01(seedSpec)].map((spec) => JSON.stringify(spec));

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
  const reuseRecovery = restartHandoff !== null || document.fileName !== null || navigation?.type === "reload" || navigation?.type === "back_forward";
  const namedRecovery = reuseRecovery ? recovery : undefined;
  let key = document.fileName !== null ? projectStorageKey(document.fileName, untitledId)
    : namedRecovery?.key ?? projectStorageKey(null, untitledId);
  let ownerState: DraftObservation["owner"] = "pending";
  let sessionPreserved = false;
  let ownership = document.fileName === null ? claimOwnership(key) : undefined;
  let baseline = namedRecovery ? namedRecovery.baseline : read(key);
  let conflicted = recovery?.conflicted ?? false;
  let diskConflict = recovery?.diskConflict ?? false;
  let pauseReason: PauseReason = recovery?.reason === "draft" || recovery?.reason === "disk" ? recovery.reason : "remote";
  let renameBaseline = namedRecovery?.renameBaseline ?? null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let pendingTransition: AbortController | undefined;
  let generation = 0;
  let restoring = false;
  let ownedTarget: { key: string; raw: string } | undefined;
  // Open/홈 카드로 지금 파일을 다시 여는 중이다(#267 리뷰). 파일명이 그대로라 아래
  // changed()의 파일 전환 비교를 타지 않으므로, 불러온 직후 따로 초안과 비교한다.
  let recoveryBusy = false;
  let reopenKey: string | null = null;
  // 지금 문서에 디스크에 저장되지 않은 내용이 있을 수 있는가(#267). 없으면 잃을 것이
  // 없으므로 전환 시 묻지 않고, 같은 파일을 다시 열 때 초안과 비교하지도 않는다.
  // 편집·Undo/Redo에서 켜지고, 디스크에서 문서를 연 순간(loadSpec)과 초안 폐기에서 꺼진다.
  //
  // 시작 시점엔 history가 비어 있어 "이 탭의 편집"으로는 알 수 없다. 저장소(탭 복구나
  // 전역 캐시)에서 복원한 문서는 다른 세션에서 편집만 하고 저장하지 않은 초안일 수 있다
  // — sessionStorage가 없는 새 탭도 전역 캐시에서 복원한다(PR #294 리뷰). 그래서 복원한
  // 문서는 켜 둔다. 같은 파일을 다시 열 때의 비교는 내용 기준이라, 실제로 디스크와
  // 같으면 묻지 않는다. 제목 없는 문서는 빈 New나 첫 실행 데모 그대로면 잃을 것이 없다(#297).
  // 바로 앞 인스턴스가 넘긴 값이 있으면(같은 문서의 즉시 재시작) 저장소로 다시 추측하지 않는다.
  const handoff = restartHandoff;
  restartHandoff = null;
  let edited = handoff !== null && handoff.serialized === serializeStoredDocument(document)
    ? handoff.edited
    : loadStoredSpec() !== undefined &&
      (document.fileName !== null || !PRISTINE_UNTITLED.includes(JSON.stringify(document.spec)));

  function read(storageKey: string): string | null {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }
  function reportDraft() {
    usePersistenceStatusStore.setState({ draft: { documentId: useEditorStore.getState().documentId,
      spec: document.spec, fileName: document.fileName, session: sessionPreserved,
      shared: read(key) === serializeStoredDocument(document), owner: ownerState } });
  }
  function claimOwnership(draftKey: string) {
    ownerState = "pending";
    const claim = claimDraft(draftKey);
    void claim.ready.then(owned => {
      if (stopped || ownership !== claim) return;
      ownerState = owned ? "owned" : claim.status === "busy" ? "blocked" : "unavailable";
      reportDraft();
    });
    return claim;
  }
  function preserve() {
    const active = edited && isRecoverableUnnamed(document) ? { key, raw: serializeStoredDocument(document), document } : null;
    const previous = useUnnamedDraftStore.getState().active;
    if (previous?.key !== active?.key || previous?.raw !== active?.raw) useUnnamedDraftStore.setState({ active });
    sessionPreserved = writeRecovery({ document, key, baseline, conflicted, renameBaseline, diskConflict, reason: pauseReason });
    reportDraft();
    return sessionPreserved;
  }
  function pause(fromDisk = false, reason: PauseReason = fromDisk ? "disk" : "remote") {
    pendingTransition?.abort();
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
    if (document.fileName === null && !await ownership?.ready) return;
    const save = () => {
      if (stopped || expectedGeneration !== generation || check()) return;
      const raw = serializeStoredDocument(document);
      try {
        localStorage.setItem(key, raw);
        baseline = raw;
        // 마지막 보관 시각은 원문 밖 보조 키에 둔다 — 원문 CAS와 baseline은 그대로다(#351).
        if (isRecoverableUnnamed(document)) recordUnnamedDraftSaved(key);
        saveSpecToStorage(document.spec, document.fileName, document.diskRevision, key);
        notifyUnnamedDrafts();
        preserve();
      } catch { reportDraft(); /* The per-tab recovery and explicit download remain available. */ }
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
    pendingTransition?.abort();
    const next = current();
    if (next.fileName !== document.fileName) {
      generation++;
      const oldKey = key;
      const oldRaw = baseline;
      const oldOwnership = ownership;
      // Only an adopted successful workspace Save retires the unnamed recovery.
      const saved = document.fileName === null && ownedTarget?.key === projectStorageKey(next.fileName, untitledId);
      ownership = undefined;
      if (saved && oldRaw !== null && oldOwnership) {
        void oldOwnership.ready.then(async owned => {
          try {
            if (owned) await navigator.locks.request(oldKey, () => {
              removeUnnamedDraft({ key: oldKey, raw: oldRaw });
              notifyUnnamedDrafts();
            });
          } catch { /* Keep the recovery record if retirement storage fails. */ }
          finally { await oldOwnership.release(); }
        });
      } else oldOwnership?.release();
      if (next.fileName === null) untitledId = crypto.randomUUID();
      key = projectStorageKey(next.fileName, untitledId);
      if (next.fileName === null) ownership = claimOwnership(key);
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
    notifyUnnamedDrafts();
    if (event.key === key || event.key === `${key}:rename` || event.key === null) check();
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    // Async lock acquisition cannot be relied on during unload. Recovery is synchronous.
    const cached = parseStoredDocument(read(SPEC_STORAGE_KEY));
    if (!preserve() || conflicted || !cached || serializeStoredDocument(document) !== serializeStoredDocument(cached)) {
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
    // 자동저장본은 디스크에 저장되지 않은 내용이다 — 편집이 있는 상태로 이어받는다.
    return adoptLatest(latest, true);
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
    return adoptLatest({ fileName, spec, diskRevision: snapshot.revision }, false);
  }
  function adoptLatest(latest: StoredDocument, unsaved: boolean, restoreKey?: string): boolean {
    pendingTransition?.abort();
    restoring = true;
    generation++;
    clearTimeout(timer);
    const sameUntitled = latest.fileName === null && document.fileName === null;
    document = latest;
    if (restoreKey) key = restoreKey;
    else if (!sameUntitled) key = projectStorageKey(latest.fileName, untitledId);
    baseline = read(key);
    renameBaseline = read(`${key}:rename`);
    conflicted = false;
    diskConflict = false;
    edited = unsaved;
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
    if (document.fileName === null && !await ownership?.ready) return false;
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
  async function settle(nextFileName?: string | null, signal?: AbortSignal): Promise<boolean> {
    pendingTransition?.abort();
    const controller = new AbortController();
    pendingTransition = controller;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const expectedGeneration = generation;
    const expectedDocument = document;
    const valid = () => !stopped && !signal?.aborted && !controller.signal.aborted &&
      pendingTransition === controller && generation === expectedGeneration && document === expectedDocument;
    try {
      reopenKey = null;
      if (!valid()) return false;
      if (!conflicted && read(key) !== serializeStoredDocument(document)) await flush();
      if (!valid() || conflicted || check()) return false;
      let message: string | undefined;
      if (document.fileName === null && edited) {
        // Keeping an unnamed draft is the only allowed transition. A failed
        // durable write is never permission to lose it, even after confirmation.
        if (read(key) !== serializeStoredDocument(document)) {
          await promptConfirm({ title: "초안을 보관할 수 없습니다", signal: controller.signal,
            message: "현재 작업을 유지합니다. File → Export로 파일을 보관한 뒤 다시 시도하세요.", confirmLabel: "현재 작업 유지" });
          return false;
        }
        message = "이름 없는 초안을 이 브라우저에 보관한 뒤 이동합니다. Home의 보관한 초안에서 이어서 열 수 있습니다. 디스크 파일로 저장하려면 취소 후 File → Save를 사용하세요.";
      } else if (edited && read(key) !== serializeStoredDocument(document)) {
        message = "현재 문서의 변경 내용을 자동저장하지 못했습니다. 계속하면 저장되지 않은 변경이 사라집니다. File → Export로 먼저 보관하려면 취소하세요.";
      }
      if (message && !await promptConfirm({ title: "현재 문서를 떠나시겠습니까?", message, signal: controller.signal,
        confirmLabel: document.fileName === null ? "초안 보관 후 이동" : undefined })) return false;
      // React prompts yield: never apply an approval to a changed document or a remote revision.
      if (!valid() || conflicted || check()) return false;
      reopenKey = edited && typeof nextFileName === "string" && document.fileName !== null &&
        projectStorageKey(nextFileName, untitledId) === key ? key : null;
      return true;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (pendingTransition === controller) pendingTransition = undefined;
    }
  }
  // 편집한 파일을 다시 열면 자동저장에는 이 탭의 초안이 있다(settle이 방금 기록했다).
  // 다음 자동저장이 그 초안을 덮기 전에 초안과 방금 연 파일 내용 중 하나를 고르게 한다.
  // 디스크가 그 사이 바뀌었어도 초안은 이 탭의 것이므로 같은 선택이다 — "다른 탭의
  // 최신 내용"으로 안내하지 않는다. 내용이 같으면(편집을 되돌렸다) 묻지 않는다.
  function checkReopen() {
    if (conflicted || document.fileName === null || projectStorageKey(document.fileName, untitledId) !== key) return;
    const draft = parseStoredDocument(read(key));
    if (draft && JSON.stringify(draft.spec) !== JSON.stringify(document.spec)) pause(false, "draft");
  }
  // The opened file is older than its autosave draft: keep the opened content and
  // let the next autosave replace that draft. The dialog confirms the discard.
  function discardDraft() {
    edited = false;
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
    pendingTransition?.abort();
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
  async function recover(draft: UnnamedDraft, deleting: boolean, requestTransition?: ReturnType<typeof beginDocumentTransition>): Promise<DraftResult> {
    if (recoveryBusy || stopped) return "cancelled";
    recoveryBusy = true;
    const transition = requestTransition ?? beginDocumentTransition();
    let claim: ReturnType<typeof claimDraft> | undefined;
    const expectedGeneration = generation;
    const expectedDocument = serializeStoredDocument(current());
    try {
      const own = key === draft.key && document.fileName === null;
      // Reload/history can recover the UUID while another tab owns its lock.
      // Same identity is not ownership. Only unsupported Web Locks may use the
      // memory-only Resume path; Resume and confirmed Delete both retry failed
      // claims, then recheck the current document and original cache baseline.
      if (own) {
        if (!transition.current() || serializeStoredDocument(document) !== draft.raw) return "changed";
        if (!navigator.locks) return deleting ? "unavailable" : "ok";
        if (!await ownership?.ready) {
          if (!transition.current()) return "changed";
          await ownership?.release();
          if (!transition.current()) return "changed";
          ownership = claimOwnership(key);
          if (!await ownership.ready) return "busy";
          if (!transition.current()) return "changed";
          // A previous debounce may have stopped at the failed claim. Requeue
          // it only after ownership and the original cache baseline both pass.
          if (!deleting) {
            clearTimeout(timer);
            timer = setTimeout(() => { void flush(); }, 500);
          }
        }
        if (!transition.current() || serializeStoredDocument(document) !== draft.raw) return "changed";
        if (!deleting) return "ok";
      }
      if (!navigator.locks) return "unavailable";
      claim = own ? ownership : claimDraft(draft.key);
      if (!await claim?.ready) return "busy";
      if (!transition.current()) return "changed";
      if (!deleting && !own && !await transition.settle(null)) return "cancelled";
      if (!transition.current()) return "changed";
      return await navigator.locks.request(draft.key, () => {
        if (!transition.current() || stopped || expectedGeneration !== generation || expectedDocument !== serializeStoredDocument(current())) return "changed";
        if (read(draft.key) !== draft.raw || !listUnnamedDrafts().some(item => item.key === draft.key)) return "changed";
        if (deleting) {
          // An active editor owns this lock even while Home is visible. Reset it
          // before releasing ownership so a delayed autosave cannot recreate it.
          if (own && (check() || serializeStoredDocument(document) !== draft.raw)) return "changed";
          if (!removeUnnamedDraft(draft)) return "changed";
          if (own) {
            adoptLatest({ fileName: null, spec: migrateV01(blankSpec) }, false);
            ownership?.release();
            key = projectStorageKey(null, crypto.randomUUID());
            baseline = null;
            ownership = claimOwnership(key);
            preserve();
            saveSpecToStorage(document.spec, null, null, key);
          }
          notifyUnnamedDrafts();
        } else if (!own) {
          ownership?.release();
          ownership = claim;
          ownerState = "owned";
          claim = undefined;
          adoptLatest(draft.document, true, draft.key);
        }
        return "ok";
      });
    } catch { return "unavailable"; }
    finally {
      if (claim && claim !== ownership) await claim.release();
      recoveryBusy = false;
    }
  }
  useUnnamedDraftStore.setState({ resume: draft => recover(draft, false), remove: (draft, transition) => recover(draft, true, transition) });
  useSaveConflictStore.setState({ paused: conflicted, reason: pauseReason, loadLatest, check, pause, save, settle, discardDraft, readDraft, captureDocument, adoptRename });
  if (!recovery && baseline !== null && baseline !== serializeStoredDocument(document)) pause(false, draftOf(baseline, document));
  check();
  preserve();
  const unsubscribeSpec = useEditorStore.subscribe((s, prev) => {
    if (s.spec !== prev.spec) {
      // loadSpec/New/Open reset history; edits and undo/redo retain a history side.
      if (!restoring && s.history.past.length === 0 && s.history.future.length === 0) {
        generation++;
        edited = false;
        if (reopenKey !== null && reopenKey === key) {
          // Open은 loadSpec 다음 줄에서 setFileName(같은 이름, 디스크 리비전)을 부른다.
          // 그 리비전까지 반영된 뒤 비교해야 디스크가 바뀐 경우를 초안으로 오인하지 않는다.
          queueMicrotask(checkReopen);
        }
        reopenKey = null;
        if (useDocumentStore.getState().fileName === null) {
          ownership?.release();
          untitledId = crypto.randomUUID();
          key = projectStorageKey(null, untitledId);
          ownership = claimOwnership(key);
          baseline = null;
          renameBaseline = null;
        }
      } else if (!restoring) edited = true;
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
    pendingTransition?.abort();
    clearTimeout(timer);
    preserve();
    ownership?.release();
    const handed = { serialized: serializeStoredDocument(document), edited };
    restartHandoff = handed;
    queueMicrotask(() => { if (restartHandoff === handed) restartHandoff = null; });
    unsubscribeSpec();
    unsubscribeFile();
    window.removeEventListener("storage", storage);
    window.removeEventListener("beforeunload", beforeUnload);
  };
}
