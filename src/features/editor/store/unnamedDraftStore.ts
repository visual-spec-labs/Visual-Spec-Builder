import { create } from "zustand";
import { migrateV01 } from "@/features/editor/schema";
import { blankSpec } from "./blankSpec";
import { seedSpec } from "./seedSpec";
import { parseStoredDocument, type StoredDocument } from "./specStorage";

export const UNNAMED_DRAFT_PREFIX = "visual-spec:autosave:draft:";
const pristine = [blankSpec, seedSpec].map(spec => JSON.stringify(migrateV01(spec)));
export interface UnnamedDraft { key: string; raw: string; document: StoredDocument }
export function isRecoverableUnnamed(document: StoredDocument): boolean {
  return document.fileName === null && !pristine.includes(JSON.stringify(document.spec));
}
export type DraftResult = "ok" | "busy" | "changed" | "unavailable" | "cancelled";

/** No index to race or expire: the validated per-UUID cache is the recovery record. */
export function listUnnamedDrafts(): UnnamedDraft[] {
  const drafts: UnnamedDraft[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(UNNAMED_DRAFT_PREFIX) || key.slice(UNNAMED_DRAFT_PREFIX.length).includes(":")) continue;
      if (localStorage.getItem(`${key}:deleted`)) continue;
      const raw = localStorage.getItem(key);
      const document = parseStoredDocument(raw);
      if (raw && document && isRecoverableUnnamed(document)) drafts.push({ key, raw, document });
    }
  } catch { /* Unavailable storage must not prevent editing. */ }
  return drafts.sort((a, b) => a.key.localeCompare(b.key));
}

/** Deletion/retirement barriers prevent old session recovery from resurrecting a removed UUID. */
export function removeUnnamedDraft(draft: Pick<UnnamedDraft, "key" | "raw">): boolean {
  if (localStorage.getItem(draft.key) !== draft.raw) return false;
  localStorage.setItem(`${draft.key}:deleted`, "1");
  localStorage.removeItem(draft.key);
  return true;
}

export const useUnnamedDraftStore = create<{
  revision: number;
  active: UnnamedDraft | null;
  resume: (draft: UnnamedDraft) => Promise<DraftResult>;
  remove: (draft: UnnamedDraft) => Promise<DraftResult>;
}>(() => ({ revision: 0, active: null, resume: async () => "unavailable", remove: async () => "unavailable" }));
export function notifyUnnamedDrafts() {
  useUnnamedDraftStore.setState(s => ({ revision: s.revision + 1 }));
}
