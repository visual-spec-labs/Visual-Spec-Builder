import { describe, expect, it } from "vitest";

import {
  isPerCorner,
  mergeCornerRadius,
  toPerCorner,
  toUniform,
} from "@/features/editor/ui/properties/radiusPatch";

const CORNERS = { topLeft: 12, topRight: 8, bottomRight: 4, bottomLeft: 0 } as const;

describe("isPerCorner", () => {
  it("숫자와 값 없음은 전체 모드다", () => {
    expect(isPerCorner(12)).toBe(false);
    expect(isPerCorner(0)).toBe(false);
    expect(isPerCorner(undefined)).toBe(false);
  });

  it("객체는 개별 모드다", () => {
    expect(isPerCorner(CORNERS)).toBe(true);
  });
});

describe("toPerCorner", () => {
  it("전체 → 개별 전환에서 모양이 바뀌지 않는다", () => {
    expect(toPerCorner(12)).toEqual({
      topLeft: 12,
      topRight: 12,
      bottomRight: 12,
      bottomLeft: 12,
    });
  });

  it("값이 없으면 0으로 채운다", () => {
    expect(toPerCorner(undefined)).toEqual({
      topLeft: 0,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    });
  });

  it("이미 개별이면 그대로 둔다", () => {
    expect(toPerCorner(CORNERS)).toEqual(CORNERS);
  });
});

describe("toUniform", () => {
  it("개별 → 전체 전환은 좌상단을 택한다", () => {
    // 최댓값을 쓰면 다른 모서리가 커지며 모양이 크게 달라지고,
    // 0을 쓰면 반경이 통째로 사라진다.
    expect(toUniform(CORNERS)).toBe(12);
  });

  it("이미 숫자면 그대로 둔다", () => {
    expect(toUniform(8)).toBe(8);
  });

  it("값이 없으면 0이다", () => {
    expect(toUniform(undefined)).toBe(0);
  });

  it("전체 → 개별 → 전체를 오가면 값이 보존된다", () => {
    expect(toUniform(toPerCorner(16))).toBe(16);
  });
});

describe("mergeCornerRadius", () => {
  it("한 모서리만 바꿔도 네 칸이 모두 있는 객체를 만든다", () => {
    const radius = mergeCornerRadius(12, { bottomLeft: 0 });

    expect(radius).toEqual({ topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 0 });
    expect(Object.keys(radius).sort()).toEqual([
      "bottomLeft",
      "bottomRight",
      "topLeft",
      "topRight",
    ]);
  });

  it("값이 없던 상태에서도 완전한 객체를 만든다", () => {
    expect(mergeCornerRadius(undefined, { topLeft: 8 })).toEqual({
      topLeft: 8,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 0,
    });
  });

  it("기존 모서리 값을 보존한다", () => {
    expect(mergeCornerRadius(CORNERS, { topRight: 20 })).toEqual({
      ...CORNERS,
      topRight: 20,
    });
  });
});
