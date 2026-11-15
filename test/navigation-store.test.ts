import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigationStore } from "@/features/editor/store/navigationStore";

describe("navigationStore", () => {
  beforeEach(() => {
    useNavigationStore.setState({ screen: "home" });
  });

  it("시작 화면은 홈이다", () => {
    expect(useNavigationStore.getState().screen).toBe("home");
  });

  it("openEditor로 에디터로 전환한다", () => {
    useNavigationStore.getState().openEditor();
    expect(useNavigationStore.getState().screen).toBe("editor");
  });

  it("openHome으로 다시 홈으로 전환한다", () => {
    useNavigationStore.getState().openEditor();
    useNavigationStore.getState().openHome();
    expect(useNavigationStore.getState().screen).toBe("home");
  });

  it("현재 history 항목에서 새로고침은 에디터를 복원하고 새 탭은 홈에서 시작한다", async () => {
    const currentTabHistory = {
      state: { unrelated: "preserved" } as Record<string, unknown>,
      replaceState(state: Record<string, unknown>) { this.state = state; },
    };
    vi.stubGlobal("window", { history: currentTabHistory });
    try {
      vi.resetModules();
      const { useNavigationStore: firstLoad } = await import("@/features/editor/store/navigationStore");
      firstLoad.getState().openEditor();
      expect(currentTabHistory.state).toEqual({ unrelated: "preserved", visualSpecActiveScreen: "editor" });

      vi.resetModules();
      const { useNavigationStore: reload } = await import("@/features/editor/store/navigationStore");
      expect(reload.getState().screen).toBe("editor");

      vi.stubGlobal("window", { history: { state: null, replaceState() {} } });
      vi.resetModules();
      const { useNavigationStore: newTab } = await import("@/features/editor/store/navigationStore");
      expect(newTab.getState().screen).toBe("home");
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
