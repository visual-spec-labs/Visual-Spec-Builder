import { describe, expect, it } from "vitest";

import {
  badgeAnchor,
  childCenters,
  gapStrips,
  sameStrip,
  stripAtPoint,
  stripBar,
} from "@/features/editor/ui/gapStrips";
import type { Rect } from "@/features/editor/ui/selectionRect";

/** left·top·width·height 를 짧게 적는다. 좌표는 전부 화면 px. */
function box(left: number, top: number, width: number, height: number): Rect {
  return { left, top, width, height };
}

describe("gapStrips — 가로 배치", () => {
  // 100 폭 카드 둘이 20 만큼 떨어져 있다.
  const row = [box(0, 0, 100, 60), box(120, 0, 100, 60)];

  it("자식 사이의 빈 띠를 하나 찾는다", () => {
    const strips = gapStrips(row, 1);

    expect(strips).toHaveLength(1);
    expect(strips[0]).toMatchObject({ left: 100, top: 0, width: 20, height: 60 });
  });

  it("가로로 벌어진 틈은 세로 띠다", () => {
    expect(gapStrips(row, 1)[0].vertical).toBe(true);
  });

  it("확대율로 나눠 스펙 px 을 낸다 — 화면 px 을 그대로 보여 주면 안 된다", () => {
    // 200% 로 확대하면 화면에서는 40px 이지만 스펙은 여전히 20px 이다.
    const zoomed = [box(0, 0, 200, 120), box(240, 0, 200, 120)];

    expect(gapStrips(zoomed, 2)[0].value).toBe(20);
  });

  it("셋이면 띠가 둘이다", () => {
    const three = [...row, box(240, 0, 100, 60)];

    expect(gapStrips(three, 1)).toHaveLength(2);
  });

  it("붙어 있으면 띠를 만들지 않는다 — 배지를 띄울 자리가 없다", () => {
    expect(gapStrips([box(0, 0, 100, 60), box(100, 0, 100, 60)], 1)).toEqual([]);
  });

  it("띠 높이는 두 자식이 겹치는 구간이다 — 허공에 뜨면 안 된다", () => {
    // 교차축 정렬이 stretch 가 아니면 높이가 달라진다.
    const uneven = [box(0, 0, 100, 60), box(120, 20, 100, 100)];
    const strip = gapStrips(uneven, 1)[0];

    expect(strip.top).toBe(20);
    expect(strip.height).toBe(40);
  });

  it("top 이 서로 달라도 같은 줄로 본다 — 교차축 center/end 정렬이 흔하다", () => {
    // top 이 같은지로 묶으면 높이가 제각각인 카드를 가운데 정렬한 배치가 전부
    // 딴 줄로 갈려, 세로 띠 대신 엉뚱한 가로 띠가 생긴다.
    const centered = [box(0, 20, 100, 40), box(120, 0, 100, 80)];
    const strips = gapStrips(centered, 1);

    expect(strips).toHaveLength(1);
    expect(strips[0].vertical).toBe(true);
  });
});

describe("gapStrips — 세로 배치", () => {
  const column = [box(0, 0, 100, 40), box(0, 60, 100, 40)];

  it("줄과 줄 사이에 가로 띠를 만든다", () => {
    const strips = gapStrips(column, 1);

    expect(strips).toHaveLength(1);
    expect(strips[0]).toMatchObject({ left: 0, top: 40, width: 100, height: 20 });
    expect(strips[0].vertical).toBe(false);
  });
});

describe("gapStrips — 그리드", () => {
  // 2열 × 2행. 가로 간격 20, 세로 간격 16.
  const grid = [
    box(0, 0, 100, 40),
    box(120, 0, 100, 40),
    box(0, 56, 100, 40),
    box(120, 56, 100, 40),
  ];

  it("줄 안의 세로 띠와 줄 사이의 가로 띠를 모두 찾는다", () => {
    const strips = gapStrips(grid, 1);

    // 줄마다 세로 띠 하나씩 2개 + 줄 사이 가로 띠 1개
    expect(strips).toHaveLength(3);
    expect(strips.filter((s) => s.vertical)).toHaveLength(2);
    expect(strips.filter((s) => !s.vertical)).toHaveLength(1);
  });

  it("가로·세로 간격을 각각 제 값으로 읽는다", () => {
    const strips = gapStrips(grid, 1);

    expect(strips.find((s) => s.vertical)?.value).toBe(20);
    expect(strips.find((s) => !s.vertical)?.value).toBe(16);
  });

  it("순서가 뒤섞여 들어와도 같은 결과다 — DOM 순서를 믿지 않는다", () => {
    const shuffled = [grid[3], grid[0], grid[2], grid[1]];

    expect(gapStrips(shuffled, 1)).toEqual(gapStrips(grid, 1));
  });

  it("소수 좌표가 1px 미만으로 흔들려도 같은 줄로 본다", () => {
    // 확대율이 소수면 getBoundingClientRect 가 딱 떨어지지 않는다.
    const jittered = [box(0, 0, 100, 40), box(120, 0.7, 100, 40)];

    expect(gapStrips(jittered, 1)).toHaveLength(1);
  });
});

describe("gapStrips — 만들지 않는 경우", () => {
  it("자식이 하나면 틈이 없다", () => {
    expect(gapStrips([box(0, 0, 100, 60)], 1)).toEqual([]);
  });

  it("자식이 없으면 빈 목록이다", () => {
    expect(gapStrips([], 1)).toEqual([]);
  });

  it("확대율이 0 이하면 나눗셈이 깨지므로 아무것도 내지 않는다", () => {
    expect(gapStrips([box(0, 0, 100, 60), box(120, 0, 100, 60)], 0)).toEqual([]);
  });
});

describe("stripAtPoint — 커서가 올라간 띠", () => {
  const strips = gapStrips([box(0, 0, 100, 60), box(120, 0, 100, 60)], 1);

  it("띠 안이면 찾는다", () => {
    expect(stripAtPoint(strips, 110, 30)).toBe(strips[0]);
  });

  it("띠 밖이면 null 이다", () => {
    expect(stripAtPoint(strips, 50, 30)).toBeNull();
    expect(stripAtPoint(strips, 110, 200)).toBeNull();
  });

  it("얇은 틈도 잡히도록 여유를 둔다", () => {
    // 20px 틈의 바로 바깥 2px. 여유가 없으면 커서를 정확히 맞춰야 한다.
    expect(stripAtPoint(strips, 98, 30)).toBe(strips[0]);
    expect(stripAtPoint(strips, 122, 30)).toBe(strips[0]);
  });

  it("여유를 벗어나면 놓는다", () => {
    expect(stripAtPoint(strips, 90, 30)).toBeNull();
  });

  it("띠가 없으면 null 이다", () => {
    expect(stripAtPoint([], 110, 30)).toBeNull();
  });
});

describe("sameStrip — 렌더 반복 막기", () => {
  const [strip] = gapStrips([box(0, 0, 100, 60), box(120, 0, 100, 60)], 1);

  it("같은 값이면 같다고 본다", () => {
    expect(sameStrip(strip, { ...strip })).toBe(true);
  });

  it("값이 다르면 다르다", () => {
    expect(sameStrip(strip, { ...strip, value: 99 })).toBe(false);
    expect(sameStrip(strip, { ...strip, left: 1 })).toBe(false);
  });

  it("둘 다 null 이면 같다", () => {
    expect(sameStrip(null, null)).toBe(true);
  });

  it("한쪽만 null 이면 다르다", () => {
    expect(sameStrip(strip, null)).toBe(false);
    expect(sameStrip(null, strip)).toBe(false);
  });
});

describe("stripBar — 틈 한가운데 막대", () => {
  it("세로 띠에는 세로 막대를 가운데 긋는다", () => {
    const [strip] = gapStrips([box(0, 0, 100, 60), box(120, 0, 100, 60)], 1);
    const bar = stripBar(strip);

    // 띠 전체를 칠하면 간격이 넓을 때 색면이 내용을 덮는다. 선 하나만 긋는다.
    expect(bar.width).toBeLessThan(strip.width);
    expect(bar.height).toBe(strip.height);
    expect(bar.left + bar.width / 2).toBe(strip.left + strip.width / 2);
  });

  it("가로 띠에는 가로 막대를 긋는다", () => {
    const [strip] = gapStrips([box(0, 0, 100, 40), box(0, 60, 100, 40)], 1);
    const bar = stripBar(strip);

    expect(bar.height).toBeLessThan(strip.height);
    expect(bar.width).toBe(strip.width);
    expect(bar.top + bar.height / 2).toBe(strip.top + strip.height / 2);
  });

  it("막대 두께는 확대율을 타지 않는다 — 바깥 상자에 그리기 때문이다", () => {
    const wide = gapStrips([box(0, 0, 200, 120), box(240, 0, 200, 120)], 2)[0];
    const narrow = gapStrips([box(0, 0, 100, 60), box(120, 0, 100, 60)], 1)[0];

    expect(stripBar(wide).width).toBe(stripBar(narrow).width);
  });
});

describe("badgeAnchor — 숫자를 놓을 자리", () => {
  const [vertical] = gapStrips([box(0, 100, 100, 60), box(120, 100, 100, 60)], 1);
  const [horizontal] = gapStrips([box(0, 0, 100, 40), box(0, 60, 100, 40)], 1);

  it("어느 방향이든 가로로는 틈 한가운데다", () => {
    expect(badgeAnchor(vertical).left).toBe(vertical.left + vertical.width / 2);
    expect(badgeAnchor(horizontal).left).toBe(horizontal.left + horizontal.width / 2);
  });

  it("세로 띠는 띠보다 위다 — 가운데 두면 좁은 가로축에서 글자를 가린다", () => {
    expect(badgeAnchor(vertical).top).toBeLessThan(vertical.top);
    expect(badgeAnchor(vertical).above).toBe(true);
  });

  it("가로 띠는 틈 **안**이다 — 위로 빼면 윗 카드 속으로 들어간다", () => {
    // strip.top 이 곧 윗 줄의 바닥이라, 위로 빼면 배지가 빈 곳이 아니라 윗
    // 자식을 덮는다. 세로 배치(기본값)가 내는 유일한 모양이라 한 식으로 쓰면
    // 가장 흔한 경우가 전부 틀린다(2026-09-19 리뷰).
    const anchor = badgeAnchor(horizontal);

    expect(anchor.above).toBe(false);
    expect(anchor.top).toBeGreaterThan(horizontal.top);
    expect(anchor.top).toBeLessThan(horizontal.top + horizontal.height);
  });
});

describe("childCenters — 아이템 한가운데 점", () => {
  it("자식마다 중심을 낸다", () => {
    const centers = childCenters([box(0, 0, 100, 60), box(120, 0, 100, 60)]);

    expect(centers).toEqual([
      { left: 50, top: 30 },
      { left: 170, top: 30 },
    ]);
  });

  it("자식이 없으면 빈 목록이다", () => {
    expect(childCenters([])).toEqual([]);
  });
});

describe("sameStrip — 방향도 본다", () => {
  it("좌표가 같아도 방향이 다르면 다르다", () => {
    // 그리드에서 행 간격과 열 간격이 같고 겹침이 정사각이면 좌표가 같아진다.
    // 같다고 보면 막대 모양과 배지 자리가 낡은 방향으로 남는다.
    const strip = gapStrips([box(0, 0, 100, 60), box(120, 0, 100, 60)], 1)[0];

    expect(sameStrip(strip, { ...strip, vertical: !strip.vertical })).toBe(false);
  });
});
