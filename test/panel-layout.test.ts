import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clampPanelWidth,
  DEFAULT_PANEL_LAYOUT,
  effectivePanelWidth,
  loadPanelLayout,
  MAX_PANEL_WIDTH,
  maxResizableWidth,
  MIN_CANVAS_WIDTH,
  MIN_PANEL_WIDTH,
  PANEL_RAIL_WIDTH,
  parsePanelLayout,
  savePanelLayout,
  widthAfterExpand,
} from "@/features/editor/store/panelLayout";

/**
 * localStorage 최소 구현. vitest는 environment: "node"라 이 API 자체가
 * 전역에 없다(panelLayout.ts의 try/catch가 실제로 다루는 상황이기도 하다) —
 * spec-storage.test.ts와 같은 패턴으로 직접 흉내 낸다.
 */
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

describe("clampPanelWidth (#287)", () => {
  it("범위 안의 값은 그대로 둔다", () => {
    expect(clampPanelWidth(300)).toBe(300);
  });

  it("MIN_PANEL_WIDTH보다 작으면 MIN_PANEL_WIDTH로 올린다", () => {
    expect(clampPanelWidth(1)).toBe(MIN_PANEL_WIDTH);
  });

  it("MAX_PANEL_WIDTH보다 크면 MAX_PANEL_WIDTH로 내린다", () => {
    expect(clampPanelWidth(9999)).toBe(MAX_PANEL_WIDTH);
  });
});

describe("effectivePanelWidth (#287)", () => {
  it("펼친 패널은 저장된 폭 그대로다", () => {
    expect(effectivePanelWidth(false, 350)).toBe(350);
  });

  it("접힌 패널은 저장된 폭과 무관하게 레일 폭이다", () => {
    expect(effectivePanelWidth(true, 350)).toBe(PANEL_RAIL_WIDTH);
  });
});

describe("maxResizableWidth (#287 리뷰 대응 — 양쪽 MAX로 끌어도 Canvas 최소 폭을 지킨다)", () => {
  it("넉넉한 창에서는 MAX_PANEL_WIDTH 그대로다", () => {
    // 1920 - 350(반대쪽) - MIN_CANVAS_WIDTH = 1920-350-300=1270, MAX보다 커서
    // 상한에 안 걸린다 — clampPanelWidth가 그 뒤에 다시 480으로 자른다.
    expect(maxResizableWidth(1920, 350)).toBeGreaterThanOrEqual(MAX_PANEL_WIDTH);
  });

  it("최소 지원 폭(1024px)에서 반대쪽이 기본값(350)이면 그만큼 깎는다", () => {
    expect(maxResizableWidth(1024, 350)).toBe(1024 - 350 - MIN_CANVAS_WIDTH);
  });

  it("그 374도 MAX_PANEL_WIDTH(480)보다 작아 실제로 더 못 늘린다 — 이슈가 지적한 '양쪽 480이면 Canvas 64px' 시나리오가 재현되지 않는다", () => {
    const max = maxResizableWidth(1024, 350);
    expect(max).toBeLessThan(MAX_PANEL_WIDTH);
  });

  it("창이 아주 좁아 반대쪽+Canvas 최소 폭만으로도 넘치면 MIN_PANEL_WIDTH 밑으로는 안 내려간다", () => {
    expect(maxResizableWidth(100, 350)).toBe(MIN_PANEL_WIDTH);
  });
});

describe("widthAfterExpand (#287 리뷰 2차 대응 — 접힘→펼침이 저장된 폭을 복원할 때도 상한을 지킨다)", () => {
  it("상한 안이면 저장된 폭을 그대로 복원한다", () => {
    expect(widthAfterExpand(350, 1920, 32)).toBe(350);
  });

  it("실제 리뷰 재현 — 양쪽을 480으로 끌어 둔 뒤 1024px 창에서 마지막으로 펼치면 저장된 480이 아니라 지금 상한으로 깎인다", () => {
    // 레이어 트리를 저장된 480으로 펼치려는데, 속성 패널이 이미 480으로 펼쳐져
    // 있다 — maxResizableWidth(1024, 480) = max(280, 1024-480-300=244) = 280.
    expect(widthAfterExpand(480, 1024, 480)).toBe(280);
  });

  it("상한이 저장된 폭보다 크면(=안전하면) 그대로 둔다 — 불필요하게 줄이지 않는다", () => {
    expect(widthAfterExpand(300, 1024, 32)).toBe(300);
  });
});

describe("parsePanelLayout (#287)", () => {
  it("null이면 기본값이다", () => {
    expect(parsePanelLayout(null)).toEqual(DEFAULT_PANEL_LAYOUT);
  });

  it("JSON으로 파싱되지 않으면 기본값이다", () => {
    expect(parsePanelLayout("이건 JSON이 아니다 {")).toEqual(DEFAULT_PANEL_LAYOUT);
  });

  it("필드가 빠졌으면 전체를 기본값으로 되돌린다 — 부분 복구하지 않는다", () => {
    expect(parsePanelLayout(JSON.stringify({ treeCollapsed: true }))).toEqual(
      DEFAULT_PANEL_LAYOUT,
    );
  });

  it("필드 타입이 다르면 기본값이다", () => {
    expect(
      parsePanelLayout(
        JSON.stringify({ treeCollapsed: "yes", treeWidth: 300, propsCollapsed: false, propsWidth: 350 }),
      ),
    ).toEqual(DEFAULT_PANEL_LAYOUT);
  });

  it("유효한 값은 그대로 읽되 폭은 clampPanelWidth를 거친다", () => {
    const stored = { treeCollapsed: true, treeWidth: 10, propsCollapsed: false, propsWidth: 9999 };
    expect(parsePanelLayout(JSON.stringify(stored))).toEqual({
      treeCollapsed: true,
      treeWidth: MIN_PANEL_WIDTH,
      propsCollapsed: false,
      propsWidth: MAX_PANEL_WIDTH,
    });
  });
});

describe("loadPanelLayout/savePanelLayout (#287)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("저장한 값을 그대로 읽어온다", () => {
    const state = { treeCollapsed: true, treeWidth: 320, propsCollapsed: true, propsWidth: 400 };
    savePanelLayout(state);
    expect(loadPanelLayout()).toEqual(state);
  });

  it("저장된 값이 없으면 기본값이다", () => {
    expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
  });

  it("localStorage 접근이 실패해도(프라이빗 모드 등) 예외 없이 기본값을 돌려준다", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("접근 불가");
      },
    });
    expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
  });

  it("저장 실패도 조용히 무시한다", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("용량 초과");
      },
    });
    expect(() => savePanelLayout(DEFAULT_PANEL_LAYOUT)).not.toThrow();
  });
});
