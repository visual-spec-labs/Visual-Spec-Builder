import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateV01 } from "@/features/editor/schema";
import type { ProjectSpec, VisualSpec } from "@/features/editor/schema";
import {
  loadStoredFileName,
  loadStoredSpec,
  saveSpecToStorage,
  SPEC_STORAGE_KEY,
} from "@/features/editor/store/specStorage";

import dashboardCards from "../examples/dashboard-cards.json";
import twoPageExample from "../examples/two-page-project.json";
import legacyTwoPage from "./fixtures/legacy/two-page-project.v0.2.json";

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

describe("specStorage (#128 → #185: 파일명도 함께 저장)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("저장한 프로젝트를 그대로 읽어온다", () => {
    saveSpecToStorage(validSpec, "customer-copy.json");
    expect(loadStoredSpec()).toEqual(validSpec);
  });

  it("저장된 값이 없으면 둘 다 undefined다", () => {
    expect(loadStoredSpec()).toBeUndefined();
    expect(loadStoredFileName()).toBeUndefined();
  });

  it("JSON으로 파싱되지 않는 값이 저장돼 있으면 둘 다 undefined다", () => {
    localStorage.setItem(SPEC_STORAGE_KEY, "이건 JSON이 아니다 {");
    expect(loadStoredSpec()).toBeUndefined();
    expect(loadStoredFileName()).toBeUndefined();
  });

  it("스키마 검증에 실패하는 값이 저장돼 있으면 둘 다 undefined다", () => {
    // required 필드(pages·pageOrder 등)가 빠진, 구조가 깨진 값.
    localStorage.setItem(
      SPEC_STORAGE_KEY,
      JSON.stringify({ fileName: "a.json", spec: { version: "0.3" } }),
    );
    expect(loadStoredSpec()).toBeUndefined();
    expect(loadStoredFileName()).toBeUndefined();
  });

  // #127: 갱신 전에 자동 저장된 0.2 문서. 변환을 빠뜨리면 위 "검증 실패" 경로로
  // 조용히 버려져 갱신 직후 첫 실행에서 작업이 사라진다.
  it("0.2 시절 자동 저장본은 0.3으로 변환돼 살아남는다", () => {
    localStorage.setItem(
      SPEC_STORAGE_KEY,
      JSON.stringify({ fileName: "admin.json", spec: legacyTwoPage }),
    );

    expect(loadStoredSpec()).toEqual(twoPageExample);
    expect(loadStoredSpec()?.version).toBe("0.3");
    expect(loadStoredFileName()).toBe("admin.json");
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
    expect(loadStoredFileName()).toBeUndefined();
    expect(() => saveSpecToStorage(validSpec, "customer-copy.json")).not.toThrow();
  });

  it("저장을 덮어쓰면 새 값으로 읽힌다", () => {
    saveSpecToStorage(validSpec, "customer-copy.json");

    const renamed: ProjectSpec = { ...validSpec, name: "renamed" };
    saveSpecToStorage(renamed, "renamed.json");

    expect(loadStoredSpec()).toEqual(renamed);
    expect(loadStoredFileName()).toBe("renamed.json");
  });

  describe("파일명(이슈 #185)", () => {
    it("저장한 파일명을 그대로 읽어온다", () => {
      saveSpecToStorage(validSpec, "customer-copy.json");
      expect(loadStoredFileName()).toBe("customer-copy.json");
    });

    it("null(한 번도 저장 안 한 세션)도 유효한 값으로 왕복한다 — undefined와 다르다", () => {
      saveSpecToStorage(validSpec, null);
      expect(loadStoredFileName()).toBeNull();
      // spec 내용은 정상 복원된다 — 파일명이 null이라고 spec까지 버리지 않는다.
      expect(loadStoredSpec()).toEqual(validSpec);
    });

    it("#128 시절 저장된 옛 형태(봉투 없이 ProjectSpec이 최상위)는 조용히 폐기된다", () => {
      localStorage.setItem(SPEC_STORAGE_KEY, JSON.stringify(validSpec));

      expect(loadStoredSpec()).toBeUndefined();
      expect(loadStoredFileName()).toBeUndefined();
    });

    it("fileName이 문자열도 null도 아니면 폐기된다", () => {
      localStorage.setItem(
        SPEC_STORAGE_KEY,
        JSON.stringify({ fileName: 42, spec: validSpec }),
      );

      expect(loadStoredFileName()).toBeUndefined();
      expect(loadStoredSpec()).toBeUndefined();
    });
  });
});
