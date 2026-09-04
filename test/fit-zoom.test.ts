import { describe, expect, it } from "vitest";

import {
  fitZoom,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/features/editor/store/viewStore";

const SCREEN = { width: 1440, height: 900 };

describe("fitZoom", () => {
  it("실측값이 없으면 기본 확대율로 둔다", () => {
    expect(fitZoom(null, SCREEN)).toBe(ZOOM_DEFAULT);
    expect(fitZoom({ width: 1000, height: 800 }, null)).toBe(ZOOM_DEFAULT);
  });

  it("좁은 축 기준으로 정확히 맞춘다 — 25% 눈금으로 내리지 않는다", () => {
    // 1190/1440 = 82.6%, 940/900 = 104% -> 좁은 쪽 82.63%
    expect(fitZoom({ width: 1190, height: 940 }, SCREEN)).toBe(82.63);
  });

  it("세로가 더 좁으면 세로 기준으로 맞춘다", () => {
    // 1440/1440 = 100%, 480/900 = 53.33%
    expect(fitZoom({ width: 1440, height: 480 }, SCREEN)).toBe(53.33);
  });

  it("어떤 뷰포트에서도 아트보드를 넘지 않는다", () => {
    for (let width = 200; width <= 4000; width += 137) {
      const zoom = fitZoom({ width, height: 100_000 }, SCREEN);
      if (zoom > ZOOM_MIN && zoom < ZOOM_MAX) {
        expect((SCREEN.width * zoom) / 100).toBeLessThanOrEqual(width);
      }
    }
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

  describe("width 모드", () => {
    it("세로를 무시하고 가로만 맞춘다 — 세로는 스크롤에 맡긴다", () => {
      // contain이면 480/900 = 53%지만, width 모드는 1440/1440 = 100%
      expect(fitZoom({ width: 1440, height: 480 }, SCREEN, "width")).toBe(100);
    });

    it("아트보드보다 넓은 뷰포트도 가로를 꽉 채운다", () => {
      // 1728/1440 = 120%
      expect(fitZoom({ width: 1728, height: 300 }, SCREEN, "width")).toBe(120);
    });

    it("모바일 해상도를 넓은 뷰포트에 띄우면 크게 확대한다", () => {
      // 1170/390 = 300%
      expect(
        fitZoom({ width: 1170, height: 600 }, { width: 390, height: 844 }, "width"),
      ).toBe(300);
    });
  });
});
