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

export interface Dimensions {
  width: number;
  height: number;
}

export interface ViewState {
  /** 캔버스 확대율(%). ZOOM_MIN..ZOOM_MAX. */
  zoom: number;
  /** 캔버스 격자 표시 여부. */
  showGrid: boolean;
  /** 좌우 패널(레이어 트리·세부설정) 동시 표시 여부. */
  showPanels: boolean;
  /** 캔버스 뷰포트의 실측 크기(여백 제외). 캔버스가 올려준다. */
  viewport: Dimensions | null;
  /** 화면(아트보드) 크기. 캔버스가 spec.screen.size를 올려준다. */
  content: Dimensions | null;
  setViewport: (viewport: Dimensions) => void;
  setContent: (content: Dimensions) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /**
   * 아트보드 전체가 뷰포트에 들어오도록 확대율을 맞춘다.
   * 아직 실측값을 못 받았으면 기본 확대율로 리셋한다.
   */
  fitToScreen: () => void;
  toggleGrid: () => void;
  togglePanels: () => void;
}

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

/** 아트보드가 뷰포트 안에 다 들어오는 최대 확대율(ZOOM_STEP 단위로 내림). */
export function fitZoom(
  viewport: Dimensions | null,
  content: Dimensions | null,
): number {
  if (
    viewport === null ||
    content === null ||
    content.width <= 0 ||
    content.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return ZOOM_DEFAULT;
  }

  const ratio = Math.min(
    viewport.width / content.width,
    viewport.height / content.height,
  );
  // 올림하면 아트보드 가장자리가 잘리므로 내림한다.
  return clampZoom(Math.floor((ratio * 100) / ZOOM_STEP) * ZOOM_STEP);
}

/** 같은 크기면 새 객체를 만들지 않는다 — ResizeObserver가 자주 부른다. */
function sameSize(a: Dimensions | null, b: Dimensions): boolean {
  return a !== null && a.width === b.width && a.height === b.height;
}

export const useViewStore = create<ViewState>((set) => ({
  zoom: ZOOM_DEFAULT,
  showGrid: true,
  showPanels: true,
  viewport: null,
  content: null,
  setViewport: (viewport) =>
    set((state) => (sameSize(state.viewport, viewport) ? state : { viewport })),
  setContent: (content) =>
    set((state) => (sameSize(state.content, content) ? state : { content })),
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom + ZOOM_STEP) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom - ZOOM_STEP) })),
  fitToScreen: () =>
    set((state) => ({ zoom: fitZoom(state.viewport, state.content) })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  togglePanels: () => set((state) => ({ showPanels: !state.showPanels })),
}));
