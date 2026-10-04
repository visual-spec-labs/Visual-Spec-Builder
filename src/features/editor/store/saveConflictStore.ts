import { create } from "zustand";

/** Persistence UI state, deliberately separate from the IR/Command store. */
export const useSaveConflictStore = create<{
  paused: boolean;
  unavailable: boolean;
  loadLatest: () => boolean;
  check: () => boolean;
}>(() => ({ paused: false, unavailable: false, loadLatest: () => false, check: () => false }));
