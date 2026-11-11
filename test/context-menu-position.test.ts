import { describe, expect, it } from "vitest";

import { clampToViewport } from "@/features/editor/ui/contextMenuPosition";

describe("clampToViewport — 컨텍스트 메뉴가 화면을 벗어나지 않게(#152)", () => {
  it("여유가 있으면 커서 좌표를 그대로 쓴다", () => {
    expect(clampToViewport(100, 100, 200, 150, 1200, 800)).toEqual({
      left: 100,
      top: 100,
    });
  });

  it("오른쪽으로 넘치면 왼쪽으로 뒤집는다", () => {
    expect(clampToViewport(1100, 100, 200, 150, 1200, 800)).toEqual({
      left: 900, // 1100 - 200
      top: 100,
    });
  });

  it("아래로 넘치면 위로 뒤집는다", () => {
    expect(clampToViewport(100, 750, 200, 150, 1200, 800)).toEqual({
      left: 100,
      top: 600, // 750 - 150
    });
  });

  it("양쪽 다 넘치면 둘 다 뒤집는다", () => {
    expect(clampToViewport(1100, 750, 200, 150, 1200, 800)).toEqual({
      left: 900,
      top: 600,
    });
  });

  it("뒤집어도 음수가 되면 0에서 멈춘다 — 메뉴가 뷰포트보다 클 때", () => {
    expect(clampToViewport(50, 50, 2000, 150, 1200, 800)).toEqual({
      left: 0,
      top: 50,
    });
  });
});
