import type { beginDocumentTransition } from "../ui/documentTransition";
import { create } from "zustand";
import { migrateV01, type ProjectSpec } from "@/features/editor/schema";
import { blankSpec } from "./blankSpec";
import { seedSpec } from "./seedSpec";
import { parseStoredDocument, type StoredDocument } from "./specStorage";

export const UNNAMED_DRAFT_PREFIX = "visual-spec:autosave:draft:";
const pristine = [blankSpec, seedSpec].map(spec => JSON.stringify(migrateV01(spec)));
export interface UnnamedDraft { key: string; raw: string; document: StoredDocument }
/** 목록용 — savedAt은 원문 밖 `<key>:meta`의 마지막 보관 시각(ms). 기록 이전 초안은 null이다(#351). */
export interface ListedUnnamedDraft extends UnnamedDraft { savedAt: number | null }
export function isRecoverableUnnamed(document: StoredDocument): boolean {
  return document.fileName === null && !pristine.includes(JSON.stringify(document.spec));
}
export type DraftResult = "ok" | "busy" | "changed" | "unavailable" | "cancelled";

/**
 * 마지막 보관 시각은 원문(raw)에 넣지 않는다(#351). Resume/Delete와 autosave baseline이 원문을
 * 그대로 비교하므로, 같은 내용인데 시각만 다른 원문이 CAS를 깨지 않도록 보조 키에 둔다.
 * 원문을 쓴 같은 `<key>` 잠금 안에서 원문 직후에 호출한다. 표시용이라 실패해도 원문 쓰기를 되돌리지 않는다.
 */
export function recordUnnamedDraftSaved(key: string, savedAt = Date.now()): void {
  try { localStorage.setItem(`${key}:meta`, JSON.stringify({ savedAt })); } catch { /* 시각만 없는 초안으로 남는다. */ }
}
function readSavedAt(key: string): number | null {
  try {
    const savedAt: unknown = JSON.parse(localStorage.getItem(`${key}:meta`) ?? "null")?.savedAt;
    return typeof savedAt === "number" && Number.isFinite(new Date(savedAt).getTime()) ? savedAt : null;
  } catch { return null; }
}
/** 최근 보관순, 시각 없는 초안은 끝, 같으면 키 순 — 결정적이다. */
function byRecent(a: ListedUnnamedDraft, b: ListedUnnamedDraft): number {
  if (a.savedAt !== b.savedAt) {
    if (a.savedAt === null) return 1;
    if (b.savedAt === null) return -1;
    return b.savedAt - a.savedAt;
  }
  return a.key.localeCompare(b.key);
}

/** No index to race or expire: the validated per-UUID cache is the recovery record. */
export function listUnnamedDrafts(): ListedUnnamedDraft[] {
  const drafts: ListedUnnamedDraft[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(UNNAMED_DRAFT_PREFIX) || key.slice(UNNAMED_DRAFT_PREFIX.length).includes(":")) continue;
      if (localStorage.getItem(`${key}:deleted`)) continue;
      const raw = localStorage.getItem(key);
      const document = parseStoredDocument(raw);
      if (raw && document && isRecoverableUnnamed(document)) drafts.push({ key, raw, document, savedAt: readSavedAt(key) });
    }
  } catch { /* Unavailable storage must not prevent editing. */ }
  return drafts.sort(byRecent);
}

/** UUID 없이 구분하기 위한 가벼운 요약(#351) — 페이지 수와 첫 페이지의 이름·화면 크기·레이어 수. */
export function summarizeUnnamedDraft(spec: ProjectSpec) {
  const first = spec.pages[spec.pageOrder[0]];
  return { pages: spec.pageOrder.length, firstPage: first.name, width: first.size.width,
    height: first.size.height, layers: Object.keys(first.nodes).length };
}

/** Deletion/retirement barriers prevent old session recovery from resurrecting a removed UUID. */
export function removeUnnamedDraft(draft: Pick<UnnamedDraft, "key" | "raw">): boolean {
  if (localStorage.getItem(draft.key) !== draft.raw) return false;
  localStorage.setItem(`${draft.key}:deleted`, "1");
  localStorage.removeItem(draft.key);
  try { localStorage.removeItem(`${draft.key}:meta`); } catch { /* 원문이 없으면 목록에 나오지 않는다. */ }
  return true;
}

type DraftTransition = ReturnType<typeof beginDocumentTransition>;

export interface BulkRemovalPlan { targets: ListedUnnamedDraft[]; excluded: number }
export interface BulkRemovalResult { removed: number; skipped: number; failed: number; excluded: number }

/** 다른 탭의 수명 잠금(`<key>:owner`)을 미리 본다. query 미지원이면 비우고, 실제 판정은 remove()의 소유권 검사가 맡는다. */
async function heldOwnerLocks(): Promise<Set<string>> {
  try {
    const state = await navigator.locks?.query?.();
    return new Set((state?.held ?? []).flatMap(lock => lock.name ? [lock.name] : []));
  } catch { return new Set(); }
}

/**
 * "모두 삭제…"(#351). 이 탭의 현재 초안과 다른 탭이 소유한 초안은 제외한다. 확인 전에는 아무것도
 * 쓰지 않고(취소는 null), 확인 뒤에는 개별 삭제와 같은 remove()를 초안마다 순차 호출해 잠금·CAS·
 * `:deleted` 장벽을 그대로 거친다. 그 사이 원문이 바뀌거나 소유된 초안은 그 항목만 건너뛴다.
 * UI의 전환을 모든 remove()에 공유한다. 새 전환이 시작되면 다음 항목이나 확인창을 열지 않는다.
 */
export async function removeAllUnnamedDrafts(confirm: (plan: BulkRemovalPlan) => Promise<boolean>, transition?: DraftTransition): Promise<BulkRemovalResult | null> {
  const activeKey = useUnnamedDraftStore.getState().active?.key;
  const drafts = listUnnamedDrafts();
  const owners = await heldOwnerLocks();
  if (transition && !transition.current()) return null;
  const targets = drafts.filter(draft => draft.key !== activeKey && !owners.has(`${draft.key}:owner`));
  const pendingActive = activeKey && !drafts.some(draft => draft.key === activeKey) ? 1 : 0;
  const result: BulkRemovalResult = { removed: 0, skipped: 0, failed: 0, excluded: drafts.length - targets.length + pendingActive };
  if (!targets.length) return result;
  if (!await confirm({ targets, excluded: result.excluded })) return null;
  for (const draft of targets) {
    if (transition && !transition.current()) return null;
    const outcome = await useUnnamedDraftStore.getState().remove(draft, transition);
    if (transition && !transition.current()) return null;
    if (outcome === "ok") result.removed++;
    else if (outcome === "unavailable") result.failed++;
    else result.skipped++;
  }
  return result;
}

export const useUnnamedDraftStore = create<{
  revision: number;
  active: UnnamedDraft | null;
  resume: (draft: UnnamedDraft) => Promise<DraftResult>;
  remove: (draft: UnnamedDraft, transition?: DraftTransition) => Promise<DraftResult>;
}>(() => ({ revision: 0, active: null, resume: async () => "unavailable", remove: async () => "unavailable" }));
export function notifyUnnamedDrafts() {
  useUnnamedDraftStore.setState(s => ({ revision: s.revision + 1 }));
}
