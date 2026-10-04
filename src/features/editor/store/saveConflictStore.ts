import { create } from "zustand";

/** Persistence UI state, deliberately separate from the IR/Command store. */
export const useSaveConflictStore = create<{
  paused: boolean;
  unavailable: boolean;
  loadLatest: () => boolean;
  check: () => boolean;
  captureDocument: () => () => boolean;
  adoptRename: (update: () => void) => void;
  save: (fileName: string, json: string, write: () => Promise<boolean>) => Promise<boolean>;
}>(() => ({ paused: false, unavailable: false, loadLatest: () => false, check: () => false, captureDocument: () => () => true, adoptRename: (update) => update(),
  save: (_fileName, _json, write) => write() }));
