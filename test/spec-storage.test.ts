import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateV01 } from "@/features/editor/schema";
import type { ProjectSpec, VisualSpec } from "@/features/editor/schema";
import {
  loadStoredSpec,
  saveSpecToStorage,
  SPEC_STORAGE_KEY,
} from "@/features/editor/store/specStorage";

import dashboardCards from "../examples/dashboard-cards.json";

const validSpec: ProjectSpec = migrateV01(dashboardCards as VisualSpec);

/**
 * localStorage 최소 구현. vitest는 environment: "node"라 이 API 자체가
 * 전역에 없다(specStorage.ts의 try/catch가 실제로 다루는 상황이기도 하다) —
 * 정상 동작을 테스트하려면 직접 흉내 내야 한다.
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

describe("specStorage (#128)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("저장한 프로젝트를 그대로 읽어온다", () => {
    saveSpecToStorage(validSpec);
    expect(loadStoredSpec()).toEqual(validSpec);
  });

  it("저장된 값이 없으면 undefined다", () => {
    expect(loadStoredSpec()).toBeUndefined();
  });

  it("JSON으로 파싱되지 않는 값이 저장돼 있으면 undefined다", () => {
    localStorage.setItem(SPEC_STORAGE_KEY, "이건 JSON이 아니다 {");
    expect(loadStoredSpec()).toBeUndefined();
  });

  it("스키마 검증에 실패하는 값이 저장돼 있으면 undefined다", () => {
    // required 필드(pages·pageOrder 등)가 빠진, 구조가 깨진 값.
    localStorage.setItem(SPEC_STORAGE_KEY, JSON.stringify({ version: "0.2" }));
    expect(loadStoredSpec()).toBeUndefined();
  });

  it("localStorage 접근이 막혀 있으면(프라이빗 모드 등) 조용히 undefined/no-op이다", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    expect(loadStoredSpec()).toBeUndefined();
    expect(() => saveSpecToStorage(validSpec)).not.toThrow();
  });

  it("저장을 덮어쓰면 새 값으로 읽힌다", () => {
    saveSpecToStorage(validSpec);

    const renamed: ProjectSpec = { ...validSpec, name: "renamed" };
    saveSpecToStorage(renamed);

    expect(loadStoredSpec()).toEqual(renamed);
  });
});
