import { describe, expect, it, beforeEach } from "vitest";

import {
  useViewStore,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "@/features/editor/store/viewStore";

describe("viewStore", () => {
  beforeEach(() => {
    useViewStore.setState({
      zoom: ZOOM_DEFAULT,
      showGrid: true,
      showPanels: true,
      viewport: null,
      content: null,
    });
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
    // fitToScreen이 82.63% 같은 값을 만들 수 있다. 여기서 Zoom In이 107%가 되면
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
});
