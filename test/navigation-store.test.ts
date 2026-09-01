import { beforeEach, describe, expect, it } from "vitest";

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
});
