import { create } from "zustand";

/**
 * 캔버스 뷰(줌·그리드·패널 표시) 전용 스토어.
 * IR/선택 상태를 다루는 editorStore와 분리한다 — docs/EDITOR_STORE_CONTRACT.md의
 * 4-멤버 계약은 spec/selection 전용이며, 줌·그리드·패널은 IR이 아닌 순수 UI 상태다.
 */
export const ZOOM_MIN = 25;
export const ZOOM_MAX = 400;
export const ZOOM_STEP = 25;
export const ZOOM_DEFAULT = 100;

export interface ViewState {
  /** 캔버스 확대율(%). ZOOM_MIN..ZOOM_MAX. */
  zoom: number;
  /** 캔버스 격자 표시 여부. */
  showGrid: boolean;
  /** 좌우 패널(레이어 트리·세부설정) 동시 표시 여부. */
  showPanels: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  /**
   * 화면 크기에 맞게 캔버스를 조정한다.
   * 지금은 실제 노드 바운딩 박스가 없어 기본 확대율로 리셋한다.
   * 캔버스 렌더링이 생기면 실제 콘텐츠 크기 기반 계산으로 교체한다.
   */
  fitToScreen: () => void;
  toggleGrid: () => void;
  togglePanels: () => void;
}

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export const useViewStore = create<ViewState>((set) => ({
  zoom: ZOOM_DEFAULT,
  showGrid: true,
  showPanels: true,
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),
  fitToScreen: () => set({ zoom: ZOOM_DEFAULT }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  togglePanels: () => set((state) => ({ showPanels: !state.showPanels })),
}));
