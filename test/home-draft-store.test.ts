import { beforeEach, describe, expect, it } from "vitest";

import { useHomeDraftStore } from "@/features/editor/store/homeDraftStore";

describe("homeDraftStore (#286)", () => {
  beforeEach(() => {
    useHomeDraftStore.setState({ draft: null });
  });

  it("처음엔 보류 중인 초안이 없다", () => {
    expect(useHomeDraftStore.getState().consumeDraft()).toBeNull();
  });

  it("setDraft로 적재한 값을 consumeDraft로 그대로 돌려받는다", () => {
    useHomeDraftStore.getState().setDraft("로그인 화면");
    expect(useHomeDraftStore.getState().consumeDraft()).toBe("로그인 화면");
  });

  it("consumeDraft는 값을 돌려주며 비운다 — 두 번째 호출은 null이다", () => {
    useHomeDraftStore.getState().setDraft("로그인 화면");
    useHomeDraftStore.getState().consumeDraft();
    expect(useHomeDraftStore.getState().consumeDraft()).toBeNull();
    expect(useHomeDraftStore.getState().draft).toBeNull();
  });
});
