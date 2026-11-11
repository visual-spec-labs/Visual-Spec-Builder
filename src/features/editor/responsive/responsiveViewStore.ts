import { create } from "zustand";

/** 미리보기 폭은 문서/Undo에 저장하지 않는 페이지별 뷰 상태다. */
export const useResponsiveViewStore = create<{
  widths: Record<string, number>;
  error: string | null;
  setWidth: (pageId: string, width: number) => void;
  reset: () => void;
  reportError: (message: string | null) => void;
}>((set) => ({
  widths: {}, error: null,
  reset: () => set({ widths: {}, error: null }),
  setWidth: (pageId, width) => {
    if (Number.isFinite(width) && width > 0) set((state) => ({ widths: { ...state.widths, [pageId]: width }, error: null }));
  },
  reportError: (error) => set({ error }),
}));
