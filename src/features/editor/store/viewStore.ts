import { create } from "zustand";

/**
 * 캔버스 뷰(줌·그리드·패널 표시) 전용 스토어.
 * IR/선택 상태를 다루는 editorStore와 분리한다 — docs/EDITOR_STORE_CONTRACT.md의
 * 4-멤버 계약은 spec/selection 전용이며, 줌·그리드·패널은 IR이 아닌 순수 UI 상태다.
 */
export const ZOOM_MIN = 25;
export const ZOOM_MAX = 400;
/** 버튼·휠 줌이 움직이는 단위(%). fitToScreen은 이 단위에 묶이지 않는다. */
export const ZOOM_STEP = 25;
export const ZOOM_DEFAULT = 100;

/**
 * 아트보드를 뷰포트에 앉히는 방식.
 * - "contain": 아트보드 전체가 들어오게(Figma식). 비율이 다르면 한쪽에 여백이 남는다.
 * - "width":   가로만 맞추고 세로는 스크롤. 브라우저 창에 띄운 웹페이지와 같은 거동이다.
 */
export type FitMode = "contain" | "width";

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
  /**
   * 채우기 모드. 켜면 아트보드가 캔버스 뷰포트 가로를 꽉 채우고,
   * 여백·격자·그림자·이름표가 빠져 뷰포트 자체가 한 장의 웹페이지처럼 보인다.
   * 페이지 해상도는 그대로 남는다 — 논리 크기(CSS px)일 뿐이고 뷰가 배율로 늘린다.
   */
  fillViewport: boolean;
  /** 캔버스 뷰포트의 실측 크기(여백 제외). 캔버스가 올려준다. */
  viewport: Dimensions | null;
  /** 화면(아트보드) 크기. 캔버스가 활성 페이지의 size를 올려준다. */
  content: Dimensions | null;
  setViewport: (viewport: Dimensions) => void;
  setContent: (content: Dimensions) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /**
   * 아트보드가 뷰포트에 맞도록 확대율을 다시 계산한다.
   * 아직 실측값을 못 받았으면 기본 확대율로 리셋한다.
   */
  fitToScreen: () => void;
  toggleGrid: () => void;
  togglePanels: () => void;
  toggleFillViewport: () => void;
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
  mode: FitMode = "contain",
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

  const ratio =
    mode === "width"
      ? viewport.width / content.width
      : Math.min(viewport.width / content.width, viewport.height / content.height);

  // 올림하면 아트보드 가장자리가 잘리므로 내림한다.
  return clampZoom(Math.floor(ratio * 10_000) / 100);
}

/** 같은 크기면 새 객체를 만들지 않는다 — ResizeObserver가 자주 부른다. */
function sameSize(a: Dimensions | null, b: Dimensions): boolean {
  return a !== null && a.width === b.width && a.height === b.height;
}

function fitZoomFor(state: ViewState): number {
  return fitZoom(
    state.viewport,
    state.content,
    state.fillViewport ? "width" : "contain",
  );
}

export const useViewStore = create<ViewState>((set) => ({
  zoom: ZOOM_DEFAULT,
  showGrid: true,
  showPanels: true,
  fillViewport: false,
  viewport: null,
  content: null,
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
  fitToScreen: () => set((state) => ({ zoom: fitZoomFor(state) })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  togglePanels: () => set((state) => ({ showPanels: !state.showPanels })),
  // 모드를 바꾸면 맞추는 기준(가로만 ↔ 전체)이 달라지므로 확대율도 같이 다시 잡는다.
  toggleFillViewport: () =>
    set((state) => {
      const next = { ...state, fillViewport: !state.fillViewport };
      return { fillViewport: next.fillViewport, zoom: fitZoomFor(next) };
    }),
}));
