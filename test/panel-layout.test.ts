import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clampPanelWidth,
  DEFAULT_PANEL_LAYOUT,
  loadPanelLayout,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  parsePanelLayout,
  savePanelLayout,
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
