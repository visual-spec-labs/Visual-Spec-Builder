import { describe, expect, it } from "vitest";

import {
  fitZoom,
  ZOOM_DEFAULT,
  ZOOM_MIN,
  ZOOM_STEP,
} from "@/features/editor/store/viewStore";

const SCREEN = { width: 1440, height: 900 };

describe("fitZoom", () => {
  it("실측값이 없으면 기본 확대율로 둔다", () => {
    expect(fitZoom(null, SCREEN)).toBe(ZOOM_DEFAULT);
    expect(fitZoom({ width: 1000, height: 800 }, null)).toBe(ZOOM_DEFAULT);
  });

  it("아트보드가 잘리지 않도록 ZOOM_STEP 단위로 내림한다", () => {
    // 1190/1440 = 82.6%, 940/900 = 104% -> 좁은 쪽 82.6% -> 75%로 내림
    expect(fitZoom({ width: 1190, height: 940 }, SCREEN)).toBe(75);
  });

  it("세로가 더 좁으면 세로 기준으로 맞춘다", () => {
    // 1440/1440 = 100%, 480/900 = 53.3% -> 50%
    expect(fitZoom({ width: 1440, height: 480 }, SCREEN)).toBe(50);
  });

  it("뷰포트가 아트보드보다 크면 확대한다", () => {
    // 2880/1440 = 200%, 1800/900 = 200%
    expect(fitZoom({ width: 2880, height: 1800 }, SCREEN)).toBe(200);
  });

  it("뷰포트가 아주 좁아도 ZOOM_MIN 밑으로는 안 내려간다", () => {
    expect(fitZoom({ width: 50, height: 50 }, SCREEN)).toBe(ZOOM_MIN);
  });

  it("크기가 0이면 기본 확대율로 둔다", () => {
    expect(fitZoom({ width: 0, height: 0 }, SCREEN)).toBe(ZOOM_DEFAULT);
    expect(fitZoom({ width: 800, height: 600 }, { width: 0, height: 0 })).toBe(
      ZOOM_DEFAULT,
    );
  });

  it("항상 ZOOM_STEP의 배수를 돌려준다", () => {
    for (let width = 200; width <= 4000; width += 137) {
      expect(fitZoom({ width, height: width }, SCREEN) % ZOOM_STEP).toBe(0);
    }
  });
});
