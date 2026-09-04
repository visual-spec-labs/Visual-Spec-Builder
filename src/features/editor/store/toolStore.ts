import { create } from "zustand";

/**
 * 하단 도구 모음의 활성 도구 전용 스토어.
 *
 * IR/선택 상태를 다루는 editorStore와 분리한다 — 활성 도구는 스펙에 저장되지
 * 않는 순수 UI 상태라서 viewStore(줌·그리드·패널)와 같은 층에 속한다.
 * 활성 도구를 값 하나로 두었으므로 "한 번에 하나만 활성"은 구조적으로 보장된다.
 */
export type ToolId = "select" | "frame" | "text" | "hand";

export interface ToolState {
  /** 지금 선택된 도구. 캔버스가 이 값으로 클릭·드래그 동작을 바꾼다. */
  activeTool: ToolId;
  setActiveTool: (tool: ToolId) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),
}));
