import type { VisualSpec } from "@/features/editor/schema";

/**
 * File > New가 로드하는 빈 스펙. root frame 하나, 자식 없음.
 * 화면 크기는 seedSpec과 동일한 기본 데스크톱 캔버스(1440×900)를 따른다.
 */
export const blankSpec: VisualSpec = {
  version: "0.1",
  screen: {
    name: "Untitled",
    size: { width: 1440, height: 900 },
    root: "root",
    nodes: {
      root: {
        type: "frame",
        name: "Screen",
        box: { width: "fill", height: "fill" },
        layout: {
          direction: "column",
          gap: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          mainAxis: "start",
          crossAxis: "stretch",
        },
        children: [],
      },
    },
  },
};
