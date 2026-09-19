import type { Rect } from "./selectionRect";

/**
 * 자식 사이의 빈 띠 하나. 좌표는 화면 px(오버레이가 그대로 쓴다), `value`는
 * 스펙 px(사용자에게 보여 줄 숫자)이다. 둘을 섞지 않으려고 이름을 갈라 둔다.
 */
export interface GapStrip {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 이 띠의 두께를 스펙 px로 환산한 값. 배지에 찍힌다. */
  value: number;
  /** 가로로 벌어진 틈인가(세로 띠). 배지 위치를 잡는 데 쓴다. */
  vertical: boolean;
}

/**
 * 같은 줄로 보려면 세로로 이만큼은 겹쳐야 한다(화면 px).
 *
 * `top`이 같은지로 묶으면 안 된다 — 교차축 정렬이 `center`나 `end`면 같은 줄의
 * 형제끼리도 `top`이 다르다. 높이가 제각각인 카드를 가운데 정렬한 흔한 배치가
 * 전부 딴 줄로 갈려 엉뚱한 가로 띠가 생긴다.
 *
 * 겹침으로 보면 그리드의 줄바꿈은 그대로 갈린다 — 줄 사이에는 간격이 있어
 * 위 줄의 바닥과 아래 줄의 천장이 겹치지 않기 때문이다.
 */
const ROW_OVERLAP_MIN = 2;

/** 이보다 얇은 틈은 띠로 만들지 않는다 — 배지를 띄울 자리도 안 나온다. */
const MIN_GAP_PX = 1;

/**
 * 선택한 프레임의 자식들 사이에 생긴 빈 띠를 찾는다.
 *
 * 스펙의 `layout.gap`을 그대로 보여 주지 않고 **실제로 벌어진 거리를 잰다.**
 * `mainAxis: "space-between"`이면 남는 공간이 자식 사이로 나뉘어 들어가 실제
 * 간격이 `gap`보다 크고, 그럴 때 스펙값을 띄우면 화면과 다른 숫자를 말하게 된다.
 * 사용자가 알고 싶은 것은 "지금 저기가 몇 px 떠 있나"다.
 *
 * row·column·grid를 한 알고리즘으로 처리한다. 자식을 **줄(band)** 로 묶고
 * 나면 셋의 차이가 사라지기 때문이다 — row는 줄이 하나, column은 줄마다 자식이
 * 하나, grid는 줄도 자식도 여럿일 뿐이다.
 *
 * @param children 자식들의 사각형. 오버레이와 같은 기준(바깥 상자)의 화면 px.
 * @param scale    확대율. 화면 px을 스펙 px로 되돌리는 데 쓴다.
 */
export function gapStrips(children: readonly Rect[], scale: number): GapStrip[] {
  if (children.length < 2 || scale <= 0) return [];

  const bands = groupIntoBands(children);
  const strips: GapStrip[] = [];

  for (const band of bands) {
    strips.push(...horizontalGaps(band, scale));
  }
  for (let i = 0; i < bands.length - 1; i += 1) {
    const strip = verticalGap(bands[i], bands[i + 1], scale);
    if (strip !== null) strips.push(strip);
  }

  return strips;
}

/** 세로로 겹치는 자식끼리 한 줄로 묶는다. grid의 줄바꿈이 여기서 드러난다. */
function groupIntoBands(children: readonly Rect[]): Rect[][] {
  const sorted = [...children].sort((a, b) => a.top - b.top || a.left - b.left);
  const bands: Rect[][] = [];
  // 줄이 지금까지 차지한 세로 구간. 키 큰 자식이 들어오면 함께 늘어난다.
  let bandBottom = Number.NEGATIVE_INFINITY;

  for (const child of sorted) {
    const last = bands[bands.length - 1];
    if (last !== undefined && child.top < bandBottom - ROW_OVERLAP_MIN) {
      last.push(child);
      bandBottom = Math.max(bandBottom, child.top + child.height);
    } else {
      bands.push([child]);
      bandBottom = child.top + child.height;
    }
  }

  return bands;
}

/** 한 줄 안에서 이웃한 자식 사이의 세로 띠들. */
function horizontalGaps(band: readonly Rect[], scale: number): GapStrip[] {
  const sorted = [...band].sort((a, b) => a.left - b.left);
  const strips: GapStrip[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const left = sorted[i].left + sorted[i].width;
    const width = sorted[i + 1].left - left;
    if (width < MIN_GAP_PX) continue;

    // 띠의 높이는 두 자식이 겹치는 구간이다. 교차축 정렬이 stretch가 아니면
    // 높이가 달라지는데, 겹치는 데까지만 그려야 띠가 허공에 뜨지 않는다.
    const top = Math.max(sorted[i].top, sorted[i + 1].top);
    const bottom = Math.min(
      sorted[i].top + sorted[i].height,
      sorted[i + 1].top + sorted[i + 1].height,
    );
    if (bottom <= top) continue;

    strips.push({
      left,
      top,
      width,
      height: bottom - top,
      value: Math.round(width / scale),
      vertical: true,
    });
  }

  return strips;
}

/** 줄과 줄 사이의 가로 띠. 겹치는 가로 구간에만 그린다. */
function verticalGap(upper: readonly Rect[], lower: readonly Rect[], scale: number): GapStrip | null {
  const top = Math.max(...upper.map((r) => r.top + r.height));
  const height = Math.min(...lower.map((r) => r.top)) - top;
  if (height < MIN_GAP_PX) return null;

  const left = Math.max(
    Math.min(...upper.map((r) => r.left)),
    Math.min(...lower.map((r) => r.left)),
  );
  const right = Math.min(
    Math.max(...upper.map((r) => r.left + r.width)),
    Math.max(...lower.map((r) => r.left + r.width)),
  );
  if (right <= left) return null;

  return {
    left,
    top,
    width: right - left,
    height,
    value: Math.round(height / scale),
    vertical: false,
  };
}

/** 얇은 띠도 잡히도록 판정에만 더해 주는 여유(화면 px). 그리는 크기는 그대로다. */
const HIT_TOLERANCE = 3;

/**
 * 커서가 올라가 있는 띠. 없으면 null.
 *
 * 띠에 `pointer-events`를 주지 않고 좌표로 판정하는 이유는 **클릭을 뺏지 않기
 * 위해서**다. 오버레이가 마우스를 받으면 틈을 클릭했을 때 아래 프레임이 선택되지
 * 않는다. 지금 되던 동작을 표시 기능 하나 때문에 망가뜨릴 수는 없다.
 *
 * 겹치는 띠가 있으면 먼저 찾은 것을 쓴다 — 여유를 3px만 두어 실제로는 거의 안 겹친다.
 */
export function stripAtPoint(
  strips: readonly GapStrip[],
  x: number,
  y: number,
): GapStrip | null {
  for (const strip of strips) {
    const withinX = x >= strip.left - HIT_TOLERANCE && x <= strip.left + strip.width + HIT_TOLERANCE;
    const withinY = y >= strip.top - HIT_TOLERANCE && y <= strip.top + strip.height + HIT_TOLERANCE;
    if (withinX && withinY) return strip;
  }
  return null;
}

/** 틈 한가운데 그을 막대의 두께(화면 px). 확대해도 굵어지지 않는다. */
const BAR_THICKNESS = 2;

/**
 * 틈 한가운데의 얇은 막대.
 *
 * 띠 전체를 칠하면 간격이 넓을 때 색면이 너무 커져 내용을 덮는다. 피그마처럼
 * 가운데 선 하나만 그어 "여기가 틈이다"를 가리킨다. 막대는 확대되지 않는 바깥
 * 상자에 있으므로 두께가 배율을 타지 않는다.
 */
export function stripBar(strip: GapStrip): Rect {
  if (strip.vertical) {
    return {
      left: strip.left + strip.width / 2 - BAR_THICKNESS / 2,
      top: strip.top,
      width: BAR_THICKNESS,
      height: strip.height,
    };
  }
  return {
    left: strip.left,
    top: strip.top + strip.height / 2 - BAR_THICKNESS / 2,
    width: strip.width,
    height: BAR_THICKNESS,
  };
}

/** 배지와 막대 사이 간격(화면 px). */
const BADGE_OFFSET = 6;

/** 배지를 놓을 자리. `above` 면 호출부가 이 점 **위로** 배지를 띄운다. */
export interface BadgeAnchor {
  left: number;
  top: number;
  above: boolean;
}

/**
 * 숫자 배지를 놓을 자리. **방향마다 다르다.**
 *
 * 틈은 한쪽으로만 좁다. 좁은 쪽으로 배지를 놓으면 양옆 내용 위로 삐져나가 글자를
 * 가리고, 넓은 쪽에는 얼마든지 들어간다. 그래서 좁은 축을 피해서 놓는다.
 *
 *   - **세로 띠**(가로로 벌어진 틈) — 좁은 축이 가로다. 한가운데 두면 배지가
 *     좌우 내용을 덮는다(실제로 값 위에 얹혔다). 띠 **위**로 뺀다.
 *   - **가로 띠**(세로로 벌어진 틈) — 좁은 축이 세로다. 위로 빼면 `strip.top`이
 *     곧 윗 줄의 바닥이라 **윗 카드 안으로 들어간다.** 가로는 줄 너비만큼 넓으니
 *     틈 한가운데에 둔다.
 *
 * 두 번째가 세로 배치(기본값)에서 나오는 유일한 모양이라, 한 식으로 쓰면 가장
 * 흔한 경우가 전부 틀린다(2026-09-19 리뷰에서 잡힘 — 그전 테스트는 세로 띠만 봤다).
 */
export function badgeAnchor(strip: GapStrip): BadgeAnchor {
  if (strip.vertical) {
    return { left: strip.left + strip.width / 2, top: strip.top - BADGE_OFFSET, above: true };
  }
  return {
    left: strip.left + strip.width / 2,
    top: strip.top + strip.height / 2,
    above: false,
  };
}

/** 자식 한가운데 찍을 점. 오버레이가 여기에 작은 표시를 놓는다. */
export interface CenterMark {
  left: number;
  top: number;
}

/**
 * 자식마다 한가운데 점을 낸다.
 *
 * 어디까지가 한 아이템인지 알려 주는 표시다 — 배경색이 없는 자식은 경계가 안
 * 보여서, 틈만 표시하면 그 틈이 무엇과 무엇 사이인지 알 수 없다.
 */
export function childCenters(children: readonly Rect[]): CenterMark[] {
  return children.map((child) => ({
    left: child.left + child.width / 2,
    top: child.top + child.height / 2,
  }));
}

/** 두 띠가 같은가. 같은 값이면 상태를 안 바꿔 렌더가 반복되지 않게 한다. */
export function sameStrip(a: GapStrip | null, b: GapStrip | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height &&
    a.value === b.value &&
    // 방향도 봐야 한다. 정사각 틈(그리드에서 행 간격과 열 간격이 같고 겹침이
    // 정사각일 때)이면 좌표가 같아지는데, 막대 모양과 배지 자리가 방향으로
    // 갈리므로 같다고 보면 낡은 방향이 남는다.
    a.vertical === b.vertical
  );
}
