import { describe, expect, it } from "vitest";

import { consumeHomeDraft, setHomeDraft } from "@/features/editor/store/homeDraft";

describe("store/homeDraft (#286)", () => {
  it("처음엔 보류 중인 초안이 없다", () => {
    expect(consumeHomeDraft()).toBeNull();
  });

  it("setHomeDraft로 적재한 값을 consumeHomeDraft로 그대로 돌려받는다", () => {
    setHomeDraft("로그인 화면");
    expect(consumeHomeDraft()).toBe("로그인 화면");
  });

  it("consumeHomeDraft는 값을 돌려주며 비운다 — 두 번째 호출은 null이다", () => {
    setHomeDraft("로그인 화면");
    consumeHomeDraft();
    expect(consumeHomeDraft()).toBeNull();
  });
});
