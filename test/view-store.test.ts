import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";

import {
  DEFAULT_PROPS_WIDTH,
  DEFAULT_TREE_WIDTH,
  loadPanelLayout,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
} from "@/features/editor/store/panelLayout";
import {
  useViewStore,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "@/features/editor/store/viewStore";

/** test/panel-layout.test.ts와 같은 최소 구현 — savePanelLayout이 실제로 쓸 곳이 필요하다. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("viewStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    useViewStore.setState({
      zoom: ZOOM_DEFAULT,
      showGrid: true,
      showPanels: true,
      treeCollapsed: false,
      treeWidth: DEFAULT_TREE_WIDTH,
      propsCollapsed: false,
      propsWidth: DEFAULT_PROPS_WIDTH,
      viewport: null,
      content: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zoomIn은 ZOOM_STEP만큼 늘리고 ZOOM_MAX에서 멈춘다", () => {
    useViewStore.setState({ zoom: ZOOM_MAX - ZOOM_STEP });
    useViewStore.getState().zoomIn();
    expect(useViewStore.getState().zoom).toBe(ZOOM_MAX);

    useViewStore.getState().zoomIn();
    expect(useViewStore.getState().zoom).toBe(ZOOM_MAX);
  });

  it("zoomOut은 ZOOM_STEP만큼 줄이고 ZOOM_MIN에서 멈춘다", () => {
    useViewStore.setState({ zoom: ZOOM_MIN + ZOOM_STEP });
    useViewStore.getState().zoomOut();
    expect(useViewStore.getState().zoom).toBe(ZOOM_MIN);

    useViewStore.getState().zoomOut();
    expect(useViewStore.getState().zoom).toBe(ZOOM_MIN);
  });

  it("눈금에서 벗어난 확대율은 다음/이전 눈금으로 붙는다", () => {
    // fitToScreen이 57% 같은 값을 만들 수 있다. 여기서 Zoom In이 82%가 되면
    // 눈금이 영영 어긋난 채로 남는다.
    useViewStore.setState({ zoom: 57 });
    useViewStore.getState().zoomIn();
    expect(useViewStore.getState().zoom).toBe(75);

    useViewStore.setState({ zoom: 57 });
    useViewStore.getState().zoomOut();
    expect(useViewStore.getState().zoom).toBe(50);
  });

  it("실측값을 못 받았으면 fitToScreen은 기본 확대율로 되돌린다", () => {
    useViewStore.setState({ zoom: ZOOM_MAX });
    useViewStore.getState().fitToScreen();
    expect(useViewStore.getState().zoom).toBe(ZOOM_DEFAULT);
  });

  it("실측값이 있으면 아트보드가 다 들어오는 확대율로 맞춘다", () => {
    useViewStore.setState({
      zoom: ZOOM_MAX,
      viewport: { width: 1190, height: 940 },
      content: { width: 1440, height: 900 },
    });
    useViewStore.getState().fitToScreen();
    expect(useViewStore.getState().zoom).toBe(82.63);
  });

  it("toggleGrid는 showGrid를 반전한다", () => {
    useViewStore.getState().toggleGrid();
    expect(useViewStore.getState().showGrid).toBe(false);

    useViewStore.getState().toggleGrid();
    expect(useViewStore.getState().showGrid).toBe(true);
  });

  it("togglePanels는 showPanels를 반전한다", () => {
    useViewStore.getState().togglePanels();
    expect(useViewStore.getState().showPanels).toBe(false);

    useViewStore.getState().togglePanels();
    expect(useViewStore.getState().showPanels).toBe(true);
  });

  it("toggleTreeCollapsed/togglePropsCollapsed는 각자의 접힘 상태만 반전한다 — 서로 안 건드린다(#287)", () => {
    useViewStore.getState().toggleTreeCollapsed();
    expect(useViewStore.getState().treeCollapsed).toBe(true);
    expect(useViewStore.getState().propsCollapsed).toBe(false);

    useViewStore.getState().togglePropsCollapsed();
    expect(useViewStore.getState().treeCollapsed).toBe(true);
    expect(useViewStore.getState().propsCollapsed).toBe(true);
  });

  it("setTreeWidth/setPropsWidth는 MIN_PANEL_WIDTH..MAX_PANEL_WIDTH로 자른다(#287)", () => {
    useViewStore.getState().setTreeWidth(1);
    expect(useViewStore.getState().treeWidth).toBe(MIN_PANEL_WIDTH);

    useViewStore.getState().setPropsWidth(9999);
    expect(useViewStore.getState().propsWidth).toBe(MAX_PANEL_WIDTH);
  });

  it("패널 상태 변경은 localStorage에 남아 다음 로드에 읽힌다(#287)", () => {
    useViewStore.getState().toggleTreeCollapsed();
    useViewStore.getState().setPropsWidth(420);

    expect(loadPanelLayout()).toEqual({
      treeCollapsed: true,
      treeWidth: DEFAULT_TREE_WIDTH,
      propsCollapsed: false,
      propsWidth: 420,
    });
  });
});
