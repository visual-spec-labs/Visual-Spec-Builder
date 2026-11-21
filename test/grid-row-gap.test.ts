import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { FrameNode } from "@/features/editor/schema";
import { previewFrameStyle } from "@/features/editor/ui/homePreview";
import { frameStyle } from "@/features/editor/ui/nodeStyles";

/**
 * grid 프레임의 **행 간격은 `layout.gap` 그대로여야 한다** (이슈 #509).
 *
 * `align-content`를 지정하지 않으면 CSS 기본값(`normal`)이 grid에서 stretch로 동작해 남는 세로
 * 공간을 auto 행 트랙에 균등 분배한다. 자식이 고정 높이면 늘어난 트랙 위쪽에 붙으므로 그 차이가
 * 행 사이 빈칸이 된다 — Chrome 실측으로 `gap: 12`인 3열 그리드의 행 간격이 62px였다.
 * 열 간격은 트랙이 `1fr`이라 늘 맞았고, 그래서 세로만 어긋나 보였다.
 *
 * 같은 화면을 그리는 곳이 셋이라 셋 다 본다 — 캔버스·홈 카드 미리보기·생성 코드(스킬).
 * 하나만 고치면 "캔버스에서는 맞는데 홈 썸네일이나 내보낸 코드에서는 벌어지는" 상태가 된다.
 */

function gridFrame(): FrameNode {
  return {
    type: "frame",
    name: "Grid",
    box: { width: "fill", height: "fill" },
    layout: {
      direction: "grid",
      columns: 3,
      gap: 12,
      padding: { top: 14, right: 14, bottom: 14, left: 14 },
      mainAxis: "start",
      crossAxis: "stretch",
    },
    children: [],
  };
}

function columnFrame(): FrameNode {
  return { ...gridFrame(), layout: { ...gridFrame().layout, direction: "column", columns: undefined } };
}

describe("grid 행 간격 (#509)", () => {
  it("캔버스는 남는 세로 공간을 행 트랙에 나눠 주지 않는다", () => {
    expect(frameStyle(gridFrame(), undefined).alignContent).toBe("start");
  });

  it("홈 카드 미리보기도 같은 규칙을 쓴다 — 썸네일과 캔버스가 달라지면 안 된다", () => {
    expect(previewFrameStyle(gridFrame(), undefined, () => null).alignContent).toBe("start");
  });

  it("row·column 프레임은 건드리지 않는다 — flex의 남는 공간 분배는 mainAxis가 정한다", () => {
    expect(frameStyle(columnFrame(), undefined).alignContent).toBeUndefined();
    expect(previewFrameStyle(columnFrame(), undefined, () => null).alignContent).toBeUndefined();
  });

  it("생성 코드 스킬도 같은 값을 적어 둔다 — 캔버스와 내보낸 코드가 같아야 한다", () => {
    const skill = readFileSync(new URL("../skills/visual-spec-to-react/SKILL.md", import.meta.url), "utf8");
    const examples = skill.split("\n").filter((line) => line.includes('className="grid grid-cols-'));

    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) expect(example).toContain("content-start");
  });
});
