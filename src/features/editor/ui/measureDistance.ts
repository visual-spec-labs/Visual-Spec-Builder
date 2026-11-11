import type { Rect } from "./selectionRect";

/**
 * 두 노드 사이를 잰 선 하나. 좌표는 화면 px(오버레이가 그대로 쓴다), `value`는
 * 스펙 px(사용자에게 보여 줄 숫자)이다. 섞이지 않게 이름을 갈라 둔다.
 */
export interface MeasureSegment {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 잰 거리를 스펙 px로 환산한 값. */
  value: number;
  /** 가로로 잰 선인가(눕힌 선). 배지를 어디 놓을지 정하는 데 쓴다. */
  horizontal: boolean;
}

/** 이보다 짧은 거리는 재지 않는다 — 맞닿아 있다는 뜻이고 배지 놓을 자리도 없다. */
const MIN_DISTANCE_PX = 1;

/** 선 두께(화면 px). 확대해도 굵어지지 않는다 — 바깥 상자에 그리기 때문이다. */
const LINE_THICKNESS = 1;

/**
 * 선택한 노드와 커서가 올라간 노드 사이의 거리를 잰다.
 *
 * 피그마의 Alt(윈도우)/Option(맥) 측정이다. 지금은 두 요소가 얼마나 떨어져 있는지
 * 알 방법이 없다 — 패널은 **자기 크기와 패딩**만 보여 주고, 형제 사이나 부모 안쪽
 * 여백은 눈대중으로 맞춰야 한다.
 *
 * 두 갈래로 갈린다.
 *
 *   1. **하나가 다른 하나를 품고 있으면** 네 변까지의 거리를 모두 낸다. 프레임을
 *      고르고 자식에 커서를 올리는 경우가 여기다 — 안쪽 여백을 재는 가장 흔한 쓰임이다.
 *   2. **떨어져 있으면** 떨어진 축만 낸다. 가로로만 떨어졌으면 가로 선 하나,
 *      대각선으로 떨어졌으면 가로·세로 하나씩이다. 겹친 축은 거리가 0이라 재지 않는다.
 *
 * 선을 놓는 위치는 **겹치는 구간의 한가운데**다. 그래야 선이 두 노드를 실제로
 * 잇는 것처럼 보인다 — 끝에 붙이면 허공을 가리킨다.
 */
export function measureSegments(
  from: Rect,
  to: Rect,
  scale: number,
): MeasureSegment[] {
  if (scale <= 0) return [];

  if (contains(from, to)) return insetSegments(from, to, scale);
  if (contains(to, from)) return insetSegments(to, from, scale);

  const segments: MeasureSegment[] = [];
  const horizontal = axisGap(
    { start: from.left, end: from.left + from.width },
    { start: to.left, end: to.left + to.width },
  );
  const vertical = axisGap(
    { start: from.top, end: from.top + from.height },
    { start: to.top, end: to.top + to.height },
  );

  if (horizontal !== null) {
    // 세로로 겹치는 구간 한가운데에 선을 놓는다. 안 겹치면 두 구간 사이의 중간이다.
    const y = crossCenter(
      { start: from.top, end: from.top + from.height },
      { start: to.top, end: to.top + to.height },
    );
    const segment = line(horizontal.start, y, horizontal.size, scale, true);
    if (segment !== null) segments.push(segment);
  }
  if (vertical !== null) {
    const x = crossCenter(
      { start: from.left, end: from.left + from.width },
      { start: to.left, end: to.left + to.width },
    );
    const segment = line(x, vertical.start, vertical.size, scale, false);
    if (segment !== null) segments.push(segment);
  }

  return segments;
}

interface Span {
  start: number;
  end: number;
}

/** outer가 inner를 완전히 품고 있는가. 같은 크기면 품은 것으로 본다. */
function contains(outer: Rect, inner: Rect): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.left + outer.width >= inner.left + inner.width &&
    outer.top + outer.height >= inner.top + inner.height
  );
}

/** 품은 경우 — 네 변까지의 거리. 안쪽 여백을 재는 쓰임이다. */
function insetSegments(outer: Rect, inner: Rect, scale: number): MeasureSegment[] {
  const centerX = inner.left + inner.width / 2;
  const centerY = inner.top + inner.height / 2;

  return [
    line(outer.left, centerY, inner.left - outer.left, scale, true),
    line(
      inner.left + inner.width,
      centerY,
      outer.left + outer.width - (inner.left + inner.width),
      scale,
      true,
    ),
    line(centerX, outer.top, inner.top - outer.top, scale, false),
    line(
      centerX,
      inner.top + inner.height,
      outer.top + outer.height - (inner.top + inner.height),
      scale,
      false,
    ),
  ].filter((segment): segment is MeasureSegment => segment !== null);
}

/** 한 축에서 벌어진 구간. 겹쳐 있으면 null(거리가 0이라 잴 것이 없다). */
function axisGap(a: Span, b: Span): { start: number; size: number } | null {
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  const size = second.start - first.end;
  if (size < MIN_DISTANCE_PX) return null;
  return { start: first.end, size };
}

/** 두 구간이 겹치면 겹치는 부분의 한가운데, 안 겹치면 둘 사이의 한가운데. */
function crossCenter(a: Span, b: Span): number {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  if (end > start) return (start + end) / 2;
  return (Math.min(a.end, b.end) + Math.max(a.start, b.start)) / 2;
}

/** 길이가 의미 있을 때만 선을 만든다. */
function line(
  x: number,
  y: number,
  length: number,
  scale: number,
  horizontal: boolean,
): MeasureSegment | null {
  if (length < MIN_DISTANCE_PX) return null;

  return horizontal
    ? {
        left: x,
        top: y - LINE_THICKNESS / 2,
        width: length,
        height: LINE_THICKNESS,
        value: Math.round(length / scale),
        horizontal,
      }
    : {
        left: x - LINE_THICKNESS / 2,
        top: y,
        width: LINE_THICKNESS,
        height: length,
        value: Math.round(length / scale),
        horizontal,
      };
}

/** 숫자 배지를 놓을 점 — 선의 한가운데다. 호출부가 translate(-50%, -50%)로 맞춘다. */
export function segmentBadge(segment: MeasureSegment): { left: number; top: number } {
  return {
    left: segment.left + segment.width / 2,
    top: segment.top + segment.height / 2,
  };
}
