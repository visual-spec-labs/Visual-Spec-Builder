import { create } from "zustand";
import type { ProjectSpec } from "@/features/editor/schema";

/**
 * remote: another tab changed the open project. draft: the opened file is older than its autosave draft.
 * disk: Save found the file changed on disk by something else (an agent, git, another tool — #279).
 */
export type PauseReason = "remote" | "draft" | "disk";

/** Persistence UI state, deliberately separate from the IR/Command store. */
export const useSaveConflictStore = create<{
  paused: boolean;
  reason: PauseReason;
  unavailable: boolean;
  loadLatest: () => boolean | Promise<boolean>;
  check: () => boolean;
  pause: (diskConflict?: boolean) => void;
  captureDocument: () => () => boolean;
  adoptRename: (update: () => void) => void;
  save: (fileName: string, json: string, write: () => Promise<boolean>) => Promise<boolean>;
  /** Before replacing the document: persist its pending draft; false keeps the current document. */
  /** `nextFileName`: 열려는 파일. 지금 파일을 다시 여는 경우 초안 비교에 쓴다. */
  settle: (nextFileName?: string | null, signal?: AbortSignal) => Promise<boolean>;
  /** reason "draft" only: keep the opened content; the autosave draft is replaced. */
  discardDraft: () => void;
  readDraft: () => ProjectSpec | undefined;
}>((set) => ({ paused: false, reason: "remote", discardDraft: () => set({ paused: false }), readDraft: () => undefined, unavailable: false, loadLatest: () => false, check: () => false, pause: () => set({ paused: true, reason: "remote" }), captureDocument: () => () => true, adoptRename: (update) => update(),
  save: (_fileName, _json, write) => write(), settle: async () => true }));
