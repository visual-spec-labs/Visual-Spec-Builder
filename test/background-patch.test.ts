import { describe, expect, it } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import type { Background, LinearFill } from "@/features/editor/schema";
import {
  addFill,
  addStop,
  atFromPercent,
  canMoveFill,
  changeFillType,
  FILL_DEFAULT_COLOR,
  LINEAR_DEFAULT_ANGLE,
  moveFill,
  percentFromAt,
  removeFill,
  removeStop,
  setLinearAngle,
  setSolidColor,
  setStopColor,
  setStopPosition,
  stopIndexAfterPosition,
} from "@/features/editor/ui/properties/backgroundPatch";

import loginScreen from "../examples/login-screen.json";

const WHITE = { type: "solid", color: "#FFFFFF" } as const;
const BLACK = { type: "solid", color: "#000000" } as const;

function linear(...stops: [string, number][]): LinearFill {
  return {
    type: "linear",
    angle: 180,
    stops: stops.map(([color, at]) => ({ color, at })) as LinearFill["stops"],
  };
}

const SCRIM = linear(["#00000000", 0], ["#000000CC", 1]);

/** 패널이 만든 배경이 스키마·stop 정렬 검사를 통과하는지 본다. */
function expectValid(background: Background | undefined) {
  const spec = structuredClone(loginScreen);
  (spec.screen.nodes.root as { background?: unknown }).background = background;
  expect(validateVisualSpec(spec)).toEqual({ valid: true, issues: [] });
}

describe("겹 추가·삭제", () => {
  it("추가는 맨 위(배열 앞)에 solid 한 겹을 넣는다", () => {
    expect(addFill(undefined)).toEqual([{ type: "solid", color: FILL_DEFAULT_COLOR }]);
    expect(addFill([])).toEqual([{ type: "solid", color: FILL_DEFAULT_COLOR }]);

    const current: Background = [WHITE];
    expect(addFill(current)).toEqual([{ type: "solid", color: FILL_DEFAULT_COLOR }, WHITE]);
    expect(current).toEqual([WHITE]);
  });

  it("삭제는 그 겹만 뺀다", () => {
    expect(removeFill([WHITE, SCRIM, BLACK], 1)).toEqual([WHITE, BLACK]);
  });

  it("마지막 겹을 지우면 []가 된다 — 생략과 같은 '배경 없음'", () => {
    expect(removeFill([WHITE], 0)).toEqual([]);
    expectValid([]);
  });

  it("없는 자리를 지우면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [WHITE];
    expect(removeFill(current, 1)).toBe(current);
    expect(removeFill(current, -1)).toBe(current);
    expect(removeFill(undefined, 0)).toBeUndefined();
  });
});

describe("겹 이동", () => {
  const current: Background = [WHITE, SCRIM, BLACK];

  it("위로는 배열 앞쪽으로, 아래로는 뒤쪽으로 한 칸 옮긴다", () => {
    expect(moveFill(current, 1, "up")).toEqual([SCRIM, WHITE, BLACK]);
    expect(moveFill(current, 1, "down")).toEqual([WHITE, BLACK, SCRIM]);
    expect(current).toEqual([WHITE, SCRIM, BLACK]);
  });

  it("끝에서는 움직이지 않고 받은 배열을 그대로 돌려준다", () => {
    expect(moveFill(current, 0, "up")).toBe(current);
    expect(moveFill(current, 2, "down")).toBe(current);
  });

  it("canMoveFill은 끝에서 거짓이다 — 패널이 그 버튼을 비활성으로 둔다", () => {
    expect(canMoveFill(current, 0, "up")).toBe(false);
    expect(canMoveFill(current, 0, "down")).toBe(true);
    expect(canMoveFill(current, 2, "up")).toBe(true);
    expect(canMoveFill(current, 2, "down")).toBe(false);
    expect(canMoveFill([WHITE], 0, "up")).toBe(false);
    expect(canMoveFill([WHITE], 0, "down")).toBe(false);
  });
});

describe("종류 전환", () => {
  it("solid → linear는 그 색에서 같은 색의 투명으로 위에서 아래로 흐른다", () => {
    const next = changeFillType([{ type: "solid", color: "#4F46E5" }], 0, "linear");

    expect(next).toEqual([
      {
        type: "linear",
        angle: LINEAR_DEFAULT_ANGLE,
        stops: [
          { color: "#4F46E5", at: 0 },
          { color: "#4F46E500", at: 1 },
        ],
      },
    ]);
    expectValid(next);
  });

  it("알파가 있는 색도 알파만 00으로 바꾼다", () => {
    const next = changeFillType([{ type: "solid", color: "#4F46E580" }], 0, "linear");

    expect((next?.[0] as LinearFill).stops).toEqual([
      { color: "#4F46E580", at: 0 },
      { color: "#4F46E500", at: 1 },
    ]);
  });

  it("linear → solid는 첫 stop의 색을 쓴다", () => {
    const next = changeFillType([linear(["#FF0000", 0], ["#0000FF", 1])], 0, "solid");

    expect(next).toEqual([{ type: "solid", color: "#FF0000" }]);
  });

  it("다른 겹은 건드리지 않는다", () => {
    const next = changeFillType([SCRIM, WHITE], 1, "linear");

    expect(next?.[0]).toBe(SCRIM);
    expect(next?.[1].type).toBe("linear");
  });

  it("같은 종류를 고르면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [WHITE, SCRIM];

    expect(changeFillType(current, 0, "solid")).toBe(current);
    expect(changeFillType(current, 1, "linear")).toBe(current);
  });
});

describe("solid 색", () => {
  it("그 겹의 색만 바꾼 새 배열을 만든다(원본은 그대로)", () => {
    const current: Background = [WHITE, BLACK];
    const next = setSolidColor(current, 1, "#123456");

    expect(next).toEqual([WHITE, { type: "solid", color: "#123456" }]);
    expect(current).toEqual([WHITE, BLACK]);
  });

  // #209: 같은 값 커밋은 빈 undo 단계를 쌓는다. 같은 참조를 돌려줘야 호출부가
  // 참조 비교로 커밋을 건너뛸 수 있다.
  it("색이 그대로면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [WHITE];
    expect(setSolidColor(current, 0, "#FFFFFF")).toBe(current);
  });

  it("대소문자만 달라도 스펙 문자열이 바뀌므로 새 배열이다", () => {
    const current: Background = [{ type: "solid", color: "#ffffff" }];
    expect(setSolidColor(current, 0, "#FFFFFF")).not.toBe(current);
  });

  it("linear 겹에는 쓰지 않는다", () => {
    const current: Background = [SCRIM];
    expect(setSolidColor(current, 0, "#123456")).toBe(current);
  });
});

describe("linear 각도", () => {
  it("각도를 바꾼다", () => {
    expect(setLinearAngle([SCRIM], 0, 90)).toEqual([{ ...SCRIM, angle: 90 }]);
    expect(setLinearAngle([SCRIM], 0, 0)).toEqual([{ ...SCRIM, angle: 0 }]);
    expect(setLinearAngle([SCRIM], 0, 359.5)).toEqual([{ ...SCRIM, angle: 359.5 }]);
  });

  it("[0, 360) 밖은 쓰지 않는다 — 360은 0과 같은 방향이라 스키마가 막는다", () => {
    const current: Background = [SCRIM];

    expect(setLinearAngle(current, 0, 360)).toBe(current);
    expect(setLinearAngle(current, 0, -1)).toBe(current);
    expect(setLinearAngle(current, 0, Number.NaN)).toBe(current);
  });

  it("각도가 그대로이거나 solid 겹이면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [SCRIM, WHITE];

    expect(setLinearAngle(current, 0, 180)).toBe(current);
    expect(setLinearAngle(current, 1, 90)).toBe(current);
  });
});

describe("stop 색", () => {
  it("그 stop의 색만 바꾼다", () => {
    expect(setStopColor([SCRIM], 0, 1, "#FF0000")).toEqual([
      linear(["#00000000", 0], ["#FF0000", 1]),
    ]);
  });

  it("색이 그대로이거나 없는 stop이면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [SCRIM];

    expect(setStopColor(current, 0, 0, "#00000000")).toBe(current);
    expect(setStopColor(current, 0, 2, "#FF0000")).toBe(current);
  });
});

describe("stop 위치", () => {
  it("%를 at(0~1)으로 저장한다", () => {
    expect(setStopPosition([SCRIM], 0, 1, 75)).toEqual([
      linear(["#00000000", 0], ["#000000CC", 0.75]),
    ]);
  });

  it("위치순으로 다시 정렬한다 — validator의 gradient-stop-order를 깨지 않는다", () => {
    const current: Background = [linear(["#FF0000", 0], ["#00FF00", 0.5], ["#0000FF", 1])];
    const next = setStopPosition(current, 0, 0, 80);

    expect(next).toEqual([linear(["#00FF00", 0.5], ["#FF0000", 0.8], ["#0000FF", 1])]);
    expectValid(next);
  });

  it("같은 위치는 원래 순서를 지킨다(안정 정렬) — 딱 끊기는 경계의 뜻이 유지된다", () => {
    const current: Background = [linear(["#FF0000", 0], ["#00FF00", 0.5], ["#0000FF", 1])];

    expect(setStopPosition(current, 0, 2, 50)).toEqual([
      linear(["#FF0000", 0], ["#00FF00", 0.5], ["#0000FF", 0.5]),
    ]);
    expect(setStopPosition(current, 0, 0, 50)).toEqual([
      linear(["#FF0000", 0.5], ["#00FF00", 0.5], ["#0000FF", 1]),
    ]);
  });

  it("stopIndexAfterPosition은 정렬 뒤 그 stop의 자리를 같은 규칙으로 답한다", () => {
    const fill = linear(["#FF0000", 0], ["#00FF00", 0.5], ["#0000FF", 1]);

    expect(stopIndexAfterPosition(fill.stops, 0, 80)).toBe(1);
    expect(stopIndexAfterPosition(fill.stops, 0, 30)).toBe(0);
    expect(stopIndexAfterPosition(fill.stops, 2, 10)).toBe(1);
    expect(stopIndexAfterPosition(fill.stops, 2, 0)).toBe(1);
    expect(stopIndexAfterPosition(fill.stops, 0, 50)).toBe(0);
    expect(stopIndexAfterPosition(fill.stops, 2, 50)).toBe(2);

    // setStopPosition이 실제로 그 자리에 놓는지 맞춰 본다.
    for (const [stopIndex, percent] of [
      [0, 80],
      [2, 10],
      [2, 0],
      [0, 50],
    ] as const) {
      const next = setStopPosition([fill], 0, stopIndex, percent);
      const moved = (next?.[0] as LinearFill).stops[
        stopIndexAfterPosition(fill.stops, stopIndex, percent)
      ];
      expect(moved).toEqual({ ...fill.stops[stopIndex], at: atFromPercent(percent) });
    }
  });

  it("0~100% 밖은 쓰지 않는다", () => {
    const current: Background = [SCRIM];

    expect(setStopPosition(current, 0, 1, 101)).toBe(current);
    expect(setStopPosition(current, 0, 0, -1)).toBe(current);
  });

  it("위치가 그대로면 받은 배열을 그대로 돌려준다", () => {
    const current: Background = [linear(["#000000", 0], ["#FFFFFF", 0.29])];

    expect(setStopPosition(current, 0, 1, 29)).toBe(current);
  });
});

describe("% 변환과 부동소수", () => {
  it("at을 %로 보일 때 오차를 정리한다", () => {
    // 0.29 * 100 = 28.999999999999996, 0.1 * 100 = 10.000000000000002
    expect(percentFromAt(0.29)).toBe(29);
    expect(percentFromAt(0.1)).toBe(10);
    expect(percentFromAt(0.123456)).toBe(12.3456);
  });

  it("%를 at으로 옮길 때도 오차를 정리한다", () => {
    expect(atFromPercent(29)).toBe(0.29);
    expect(atFromPercent(12.3)).toBe(0.123);
    expect(atFromPercent(33.33333)).toBe(0.333333);
  });

  it("%와 at은 왕복해도 같은 값이다", () => {
    for (const percent of [0, 7, 12.3, 29, 33.3333, 57, 100]) {
      expect(percentFromAt(atFromPercent(percent))).toBe(percent);
    }
  });
});

describe("stop 추가·삭제", () => {
  it("가장 넓은 빈 구간의 가운데에 그 구간 시작 stop의 색으로 넣는다", () => {
    expect(addStop([SCRIM], 0)).toEqual([
      linear(["#00000000", 0], ["#00000000", 0.5], ["#000000CC", 1]),
    ]);
    expect(addStop([linear(["#FF0000", 0], ["#00FF00", 0.2], ["#0000FF", 1])], 0)).toEqual([
      linear(["#FF0000", 0], ["#00FF00", 0.2], ["#00FF00", 0.6], ["#0000FF", 1]),
    ]);
  });

  it("추가한 결과는 정렬돼 있고 검증을 통과한다", () => {
    const next = addStop([linear(["#FF0000", 0.1], ["#00FF00", 0.3])], 0);

    expect(next).toEqual([linear(["#FF0000", 0.1], ["#FF0000", 0.2], ["#00FF00", 0.3])]);
    expectValid(next);
  });

  it("stop 하나를 지운다", () => {
    const current: Background = [linear(["#FF0000", 0], ["#00FF00", 0.5], ["#0000FF", 1])];

    expect(removeStop(current, 0, 1)).toEqual([linear(["#FF0000", 0], ["#0000FF", 1])]);
  });

  it("2개 미만으로는 줄이지 않는다 — 스키마가 2개 이상을 요구한다", () => {
    const current: Background = [SCRIM];

    expect(removeStop(current, 0, 0)).toBe(current);
  });

  it("solid 겹에는 stop을 더하지도 빼지도 않는다", () => {
    const current: Background = [WHITE];

    expect(addStop(current, 0)).toBe(current);
    expect(removeStop(current, 0, 0)).toBe(current);
  });
});
