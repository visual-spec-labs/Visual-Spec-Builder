import { describe, expect, it } from "vitest";

import {
  measureSegments,
  segmentBadge,
} from "@/features/editor/ui/measureDistance";
import type { Rect } from "@/features/editor/ui/selectionRect";

/** left·top·width·height 를 짧게 적는다. 좌표는 전부 화면 px. */
function box(left: number, top: number, width: number, height: number): Rect {
  return { left, top, width, height };
}

describe("measureSegments — 떨어져 있을 때", () => {
  it("가로로만 떨어졌으면 가로 선 하나다", () => {
    // 세로로는 겹치므로 잴 거리가 없다.
    const segments = measureSegments(box(0, 0, 100, 60), box(140, 0, 100, 60), 1);

    expect(segments).toHaveLength(1);
    expect(segments[0].horizontal).toBe(true);
    expect(segments[0].value).toBe(40);
    expect(segments[0].left).toBe(100);
  });

  it("세로로만 떨어졌으면 세로 선 하나다", () => {
    const segments = measureSegments(box(0, 0, 100, 40), box(0, 70, 100, 40), 1);

    expect(segments).toHaveLength(1);
    expect(segments[0].horizontal).toBe(false);
    expect(segments[0].value).toBe(30);
  });

  it("대각선으로 떨어졌으면 가로·세로 하나씩이다", () => {
    const segments = measureSegments(box(0, 0, 50, 50), box(100, 100, 50, 50), 1);

    expect(segments).toHaveLength(2);
    expect(segments.filter((s) => s.horizontal)).toHaveLength(1);
    expect(segments.filter((s) => !s.horizontal)).toHaveLength(1);
  });

  it("어느 쪽을 먼저 넘겨도 결과가 같다 — 거리는 방향이 없다", () => {
    const a = box(0, 0, 100, 60);
    const b = box(140, 0, 100, 60);

    expect(measureSegments(a, b, 1)).toEqual(measureSegments(b, a, 1));
  });

  it("맞닿아 있으면 아무것도 재지 않는다", () => {
    expect(measureSegments(box(0, 0, 100, 60), box(100, 0, 100, 60), 1)).toEqual([]);
  });

  it("확대율로 나눠 스펙 px 을 낸다", () => {
    // 200% 에서 화면 80px 은 스펙 40px 이다.
    const segments = measureSegments(box(0, 0, 200, 120), box(280, 0, 200, 120), 2);

    expect(segments[0].value).toBe(40);
  });

  it("선은 겹치는 구간 한가운데에 놓는다 — 끝에 붙이면 허공을 가리킨다", () => {
    // 세로로 20..60 이 겹친다. 한가운데는 40 — 선의 **중심**이 거기여야 한다
    // (top 은 두께의 절반만큼 위다).
    const [segment] = measureSegments(box(0, 0, 100, 60), box(140, 20, 100, 60), 1);

    expect(segment.top + segment.height / 2).toBeCloseTo(40, 5);
  });
});

describe("measureSegments — 하나가 다른 하나를 품을 때", () => {
  // 부모 안에 자식. 왼쪽 20, 오른쪽 30, 위 10, 아래 40 떨어져 있다.
  const parent = box(0, 0, 200, 150);
  const child = box(20, 10, 150, 100);

  it("네 변까지의 거리를 한꺼번에 낸다 — 안쪽 여백을 재는 쓰임이다", () => {
    const segments = measureSegments(parent, child, 1);

    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.value).sort((a, b) => a - b)).toEqual([10, 20, 30, 40]);
  });

  it("품은 쪽을 나중에 넘겨도 같다", () => {
    expect(measureSegments(child, parent, 1)).toEqual(measureSegments(parent, child, 1));
  });

  it("딱 붙은 변은 재지 않는다", () => {
    // 왼쪽·위가 부모와 같은 자리다.
    const flush = box(0, 0, 150, 100);
    const segments = measureSegments(parent, flush, 1);

    expect(segments).toHaveLength(2);
    expect(segments.map((s) => s.value).sort((a, b) => a - b)).toEqual([50, 50]);
  });

  it("크기가 같으면 잴 것이 없다", () => {
    expect(measureSegments(parent, { ...parent }, 1)).toEqual([]);
  });
});

describe("measureSegments — 겹치되 품지 않을 때", () => {
  it("두 축 모두 겹치면 아무것도 재지 않는다", () => {
    // 서로 걸쳐 있으면 "떨어진 거리"라는 것이 없다.
    const segments = measureSegments(box(0, 0, 100, 100), box(50, 50, 100, 100), 1);

    expect(segments).toEqual([]);
  });
});

describe("measureSegments — 잴 수 없는 입력", () => {
  it("확대율이 0 이하면 나눗셈이 깨지므로 아무것도 내지 않는다", () => {
    expect(measureSegments(box(0, 0, 100, 60), box(140, 0, 100, 60), 0)).toEqual([]);
  });
});

describe("segmentBadge — 숫자를 놓을 자리", () => {
  it("선 한가운데다", () => {
    const [segment] = measureSegments(box(0, 0, 100, 60), box(140, 0, 100, 60), 1);

    expect(segmentBadge(segment).left).toBe(segment.left + segment.width / 2);
    expect(segmentBadge(segment).top).toBe(segment.top + segment.height / 2);
  });
});
