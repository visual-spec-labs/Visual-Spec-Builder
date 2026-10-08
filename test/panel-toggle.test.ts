import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PROPS_WIDTH, DEFAULT_TREE_WIDTH } from "@/features/editor/store/panelLayout";
import { useViewStore } from "@/features/editor/store/viewStore";
import {
  reconcilePanelWidths,
  togglePropsPanel,
  toggleTreePanel,
} from "@/features/editor/ui/panelToggle";

/**
 * `toggleTreePanel`/`togglePropsPanel`은 React 훅이 아니라 평범한 함수다
 * (`useViewStore.getState()`로 명령형으로 읽고 쓴다) — `MenuBar.tsx`의 View
 * 메뉴·`openExportPanel.ts`·`openTicketPanel.ts`가 전부 컴포넌트가 아니거나
 * 렌더와 무관한 시점에 불려서 `usePanelResize` 훅을 못 쓰기 때문이다(#287
 * 리뷰 4차 대응). 그래서 이 저장소에 렌더 테스트 인프라가 없어도 **이
 * 함수들 자체는** 스토어만 직접 조작해 그대로 테스트할 수 있다 —
 * `test/panel-handoff.test.ts`가 `openTicketPanel`을 테스트하는 것과 같은
 * 패턴이다.
 */
describe("toggleTreePanel/togglePropsPanel (#287 리뷰 4차 대응)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { innerWidth: 1024 });
    useViewStore.setState({
      treeCollapsed: false,
      treeWidth: DEFAULT_TREE_WIDTH,
      propsCollapsed: false,
      propsWidth: DEFAULT_PROPS_WIDTH,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("접는 방향은 폭을 안 건드리고 collapsed만 뒤집는다", () => {
    toggleTreePanel();
    expect(useViewStore.getState().treeCollapsed).toBe(true);
    expect(useViewStore.getState().treeWidth).toBe(DEFAULT_TREE_WIDTH);
  });

  it("펼치는 방향에서 저장된 폭이 상한 안이면 그대로 복원한다", () => {
    useViewStore.setState({ treeCollapsed: true });
    toggleTreePanel();
    expect(useViewStore.getState().treeCollapsed).toBe(false);
    expect(useViewStore.getState().treeWidth).toBe(DEFAULT_TREE_WIDTH);
  });

  it("리뷰가 재현한 경로 — 양쪽을 480으로 저장해 둔 뒤 메뉴로 펼치면 480/480이 그대로 복원되지 않는다", () => {
    // Properties를 접고 Layers를 480으로, Layers를 접고 Properties를 480으로
    // — 리뷰의 재현 순서와 같은 최종 저장 상태를 직접 만든다.
    useViewStore.setState({
      treeCollapsed: true,
      treeWidth: 480,
      propsCollapsed: false,
      propsWidth: 480,
    });

    // View ▸ Layers Panel(= toggleTreePanel, MenuBar.tsx가 바로 이 함수를 쓴다).
    toggleTreePanel();

    expect(useViewStore.getState().treeCollapsed).toBe(false);
    // 1024 - 480(반대쪽) - MIN_CANVAS_WIDTH(300) = 244 < MIN_PANEL_WIDTH(280)
    // 이라 280으로 깎인다 — widthAfterExpand와 같은 계산, 480이 그대로
    // 복원되지 않는다는 것만 이 테스트의 관심사다(정확한 상수는
    // test/panel-layout.test.ts의 widthAfterExpand가 고정한다).
    expect(useViewStore.getState().treeWidth).toBeLessThan(480);
    const canvasWidth = 1024 - useViewStore.getState().treeWidth - 480;
    expect(canvasWidth).toBeGreaterThan(64); // 고치기 전엔 64였다.
  });

  it("togglePropsPanel도 같은 보정을 한다(대칭)", () => {
    useViewStore.setState({
      treeCollapsed: false,
      treeWidth: 480,
      propsCollapsed: true,
      propsWidth: 480,
    });

    togglePropsPanel();

    expect(useViewStore.getState().propsCollapsed).toBe(false);
    expect(useViewStore.getState().propsWidth).toBeLessThan(480);
  });

  it("보정 없이도 되는 경우(기본값)는 폭을 그대로 둔다 — 불필요하게 줄이지 않는다", () => {
    useViewStore.setState({ treeCollapsed: true, propsCollapsed: false });
    toggleTreePanel();
    expect(useViewStore.getState().treeWidth).toBe(DEFAULT_TREE_WIDTH);
  });
});

/**
 * `reconcilePanelWidths`는 접힘→펼침을 한 번도 안 거치고 저장된 폭이 그대로
 * 렌더되는 경로(넓은 모니터에서 저장한 값을 좁은 창에서 처음 열 때)를
 * 다룬다(#287 리뷰 5차 대응) — `toggleTreePanel`/`togglePropsPanel`의 보정은
 * "토글이 일어날 때"만 걸리므로 이 경로를 못 잡는다. `EditorLayout.tsx`가
 * 마운트 시 한 번 부른다.
 */
describe("reconcilePanelWidths (#287 리뷰 5차 대응)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { innerWidth: 1024 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("양쪽 다 펼쳐진 채 480/480이 저장돼 있으면(접힘을 한 번도 안 거친 경로) 둘 다 Canvas 최소 폭을 지키게 깎는다", () => {
    useViewStore.setState({
      treeCollapsed: false,
      treeWidth: 480,
      propsCollapsed: false,
      propsWidth: 480,
    });

    reconcilePanelWidths();

    const { treeWidth, propsWidth } = useViewStore.getState();
    const canvasWidth = 1024 - treeWidth - propsWidth;
    expect(canvasWidth).toBeGreaterThanOrEqual(300);
  });

  it("접힌 패널의 저장된 폭은 안 건드린다 — 화면에 안 쓰이는 값이라 깎을 이유가 없다", () => {
    useViewStore.setState({
      treeCollapsed: true,
      treeWidth: 480,
      propsCollapsed: false,
      propsWidth: DEFAULT_PROPS_WIDTH,
    });

    reconcilePanelWidths();

    expect(useViewStore.getState().treeWidth).toBe(480);
  });

  it("기본값처럼 이미 괜찮으면 아무것도 안 바꾼다", () => {
    useViewStore.setState({
      treeCollapsed: false,
      treeWidth: DEFAULT_TREE_WIDTH,
      propsCollapsed: false,
      propsWidth: DEFAULT_PROPS_WIDTH,
    });

    reconcilePanelWidths();

    expect(useViewStore.getState().treeWidth).toBe(DEFAULT_TREE_WIDTH);
    expect(useViewStore.getState().propsWidth).toBe(DEFAULT_PROPS_WIDTH);
  });
});
