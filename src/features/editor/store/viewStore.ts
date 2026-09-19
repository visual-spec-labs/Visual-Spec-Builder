import { create } from "zustand";

/**
 * 캔버스 뷰(줌·그리드·패널 표시) 전용 스토어.
 * IR/선택 상태를 다루는 editorStore와 분리한다 — docs/EDITOR_STORE_CONTRACT.md의
 * 계약은 spec/selection 전용이며, 줌·그리드·패널은 IR이 아닌 순수 UI 상태다.
 */
export const ZOOM_MIN = 25;
export const ZOOM_MAX = 400;
/** 버튼·휠 줌이 움직이는 단위(%). fitToScreen은 이 단위에 묶이지 않는다. */
export const ZOOM_STEP = 25;
export const ZOOM_DEFAULT = 100;

export interface Dimensions {
  width: number;
  height: number;
}

export interface ViewState {
  /**
   * 캔버스 확대율(%). ZOOM_MIN..ZOOM_MAX.
   * 버튼/휠 줌은 ZOOM_STEP 눈금 위에 있지만 fitToScreen은 82.63 같은 값도 낸다 —
   * 표시할 때만 반올림한다.
   */
  zoom: number;
  /** 캔버스 격자 표시 여부. */
  showGrid: boolean;
  /** 좌우 패널(레이어 트리·세부설정) 동시 표시 여부. */
  showPanels: boolean;
  /** 캔버스 뷰포트의 실측 크기(여백 제외). 캔버스가 올려준다. */
  viewport: Dimensions | null;
  /** 화면(아트보드) 크기. 캔버스가 활성 페이지의 size를 올려준다. */
  content: Dimensions | null;
  /**
   * 캔버스가 세로로 끝까지 내려가 있는가. 캔버스가 스크롤할 때마다 올린다.
   * 채우기 모드에서 하단 도구 모음을 잠깐 치우는 데 쓴다 — 맨 아래에서는
   * 아트보드의 하단 리사이즈 핸들이 도구 모음에 가린다.
   */
  canvasAtBottom: boolean;
  setCanvasAtBottom: (atBottom: boolean) => void;
  setViewport: (viewport: Dimensions) => void;
  setContent: (content: Dimensions) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /**
   * 확대율을 직접 지정한다(ZOOM_MIN..ZOOM_MAX로 자른다).
   *
   * `zoomIn`/`zoomOut`이 ZOOM_STEP 눈금에 붙는 것과 달리 눈금을 타지 않는다 —
   * "100%로" 같은 단축키가 57%에서 75%로 가버리면 안 된다.
   */
  setZoom: (zoom: number) => void;
  /**
   * `content`가 뷰포트에 맞도록 확대율을 다시 계산한다.
   * 아직 실측값을 못 받았으면 기본 확대율로 리셋한다.
   *
   * `content`는 캔버스가 올리는 **페이지 스펙 크기**(= 첫 화면)다. 아트보드는 내용에
   * 따라 그보다 세로로 길어질 수 있는데(#86), Fit은 그 전체가 아니라 첫 화면을
   * 맞춘다 — 4000px짜리 문서를 통째로 맞추면 아무것도 안 보일 만큼 축소된다.
   */
  fitToScreen: () => void;
  toggleGrid: () => void;
  togglePanels: () => void;
}

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

/**
 * 아트보드가 뷰포트에 맞는 최대 확대율(%).
 *
 * ZOOM_STEP 단위로 내리지 않는다 — 1920×1080을 1100px 뷰포트에 넣으면 실제 배율은
 * 57%인데 50%로 내리면 캔버스에 눈에 띄는 여백이 남는다.
 *
 * 정수 %로도 내리지 않는다. 1920px 아트보드에서 1%p는 19px이고, 채우기 모드에서는
 * 그만큼이 아트보드 옆 캔버스 바탕색 띠로 그대로 보인다. 아트보드가 잘리지 않도록
 * 소수점 두 자리에서만 버린다(1920px 기준 오차 0.2px 미만).
 */
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
  return clampZoom(Math.floor(ratio * 10_000) / 100);
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
  canvasAtBottom: false,
  setCanvasAtBottom: (atBottom) =>
    set((state) => (state.canvasAtBottom === atBottom ? state : { canvasAtBottom: atBottom })),
  setViewport: (viewport) =>
    set((state) => (sameSize(state.viewport, viewport) ? state : { viewport })),
  setContent: (content) =>
    set((state) => (sameSize(state.content, content) ? state : { content })),
  // fitToScreen이 57% 같은 값을 만들 수 있으므로 더하고 빼는 대신 다음/이전 눈금으로
  // 붙인다. 57%에서 Zoom In은 82%가 아니라 75%다.
  zoomIn: () =>
    set((state) => ({
      zoom: clampZoom((Math.floor(state.zoom / ZOOM_STEP) + 1) * ZOOM_STEP),
    })),
  zoomOut: () =>
    set((state) => ({
      zoom: clampZoom((Math.ceil(state.zoom / ZOOM_STEP) - 1) * ZOOM_STEP),
    })),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  fitToScreen: () => set((state) => ({ zoom: fitZoom(state.viewport, state.content) })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  togglePanels: () => set((state) => ({ showPanels: !state.showPanels })),
}));
