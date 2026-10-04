import type {
  Background,
  Fill,
  GradientStop,
  LinearFill,
} from "@/features/editor/schema";

/**
 * 배경 패널(BackgroundSection)의 쓰기 — 채우기 겹 목록을 바꾼 **완전한 배열**을 만든다.
 *
 * 배열은 점 표기 경로로 한 칸만 쓸 수 없어(`background.0.color`는 editablePath가
 * 거부한다) 통째로 쓴다. borderPatch·shadowPatch가 객체를 통째로 만드는 것과 같은
 * 이유다(docs/13-background-fill-design.md "Command와 패널"). 패널은 여기서 만든
 * 배열을 `setNodeField(id, "background", next)` 한 번으로 커밋한다.
 *
 * 모든 함수는 **바뀐 게 없으면 받은 배열을 그대로 돌려준다**(같은 참조). 호출부가
 * 참조 비교로 커밋을 건너뛰게 하려는 것이다 — 같은 값 쓰기가 빈 undo 단계를 쌓지
 * 않게 하는 #209의 가드를 배열 커밋에서도 지킨다(unchangedCommit.ts 참고). 범위를
 * 벗어난 인덱스, 끝에서의 이동, 2개뿐인 stop 삭제처럼 할 수 없는 조작도 같은 길로
 * "안 바뀜"이 된다.
 *
 * 배경 없음은 생략(`undefined`)과 `[]` 둘 다 같은 뜻이라(docs/13) 입력으로 둘 다
 * 받는다. 마지막 겹을 지우면 `[]`가 된다.
 *
 * 이름을 docs/13이 가칭으로 부른 `fillsPatch`로 바꾸지 않은 이유: 필드·섹션 이름이
 * `background`/`BackgroundSection`이고, command/editablePath.ts 머리말이 배경 쓰기의
 * 자리로 이 파일을 가리킨다.
 */

/** "추가"가 맨 위에 넣는 solid 겹의 색. 흰 카드 위에서도 보이도록 옅은 회색이다. */
export const FILL_DEFAULT_COLOR = "#D9D9D9";

/** solid → linear 전환의 각도. 위에서 아래(CSS `linear-gradient`의 기본 방향)다. */
export const LINEAR_DEFAULT_ANGLE = 180;

/** 칸 이름과 스키마 갈래 이름을 같이 쓴다. */
export type FillType = Fill["type"];

/** 맨 위(배열 앞)에 solid 한 겹을 더한다. */
export function addFill(current: Background | undefined): Background {
  return [{ type: "solid", color: FILL_DEFAULT_COLOR }, ...(current ?? [])];
}

/** 겹 하나를 지운다. 마지막 겹이면 `[]`가 된다. */
export function removeFill(
  current: Background | undefined,
  index: number,
): Background | undefined {
  if (current === undefined || !hasIndex(current, index)) return current;
  return current.filter((_, i) => i !== index);
}

/**
 * 겹을 한 칸 위(배열 앞)나 아래로 옮긴다. 이미 끝이면 그대로다 — 패널은 그 버튼을
 * 비활성으로 보여준다(`canMoveFill`).
 */
export function moveFill(
  current: Background | undefined,
  index: number,
  direction: "up" | "down",
): Background | undefined {
  if (current === undefined || !canMoveFill(current, index, direction)) return current;

  const target = direction === "up" ? index - 1 : index + 1;
  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function canMoveFill(
  current: Background,
  index: number,
  direction: "up" | "down",
): boolean {
  if (!hasIndex(current, index)) return false;
  return direction === "up" ? index > 0 : index < current.length - 1;
}

/**
 * 겹의 종류를 바꾼다. 화면이 갑자기 달라지지 않게 지금 색에서 출발한다.
 *
 * - solid → linear: 그 색에서 **같은 색의 투명**(알파 00)으로 위에서 아래로 흐른다.
 *   시작점이 원래 단색과 같아 전환 직후에도 겹이 그대로 이어져 보인다. `transparent`
 *   (투명한 검정)가 아니라 같은 색의 투명인 이유는, 알파를 미리 곱하지 않고 섞는
 *   번역기(코드 생성·다른 렌더러)에서 중간이 회색으로 탁해지지 않게 하려는 것이다.
 * - linear → solid: 첫 stop(시작점)의 색. 나머지 stop과 각도는 사라지지만 Undo 한
 *   단계로 되돌릴 수 있다.
 */
export function changeFillType(
  current: Background | undefined,
  index: number,
  type: FillType,
): Background | undefined {
  const fill = fillAt(current, index);
  if (current === undefined || fill === undefined || fill.type === type) return current;

  const next: Fill =
    fill.type === "solid"
      ? {
          type: "linear",
          angle: LINEAR_DEFAULT_ANGLE,
          stops: [
            { color: fill.color, at: 0 },
            { color: transparentOf(fill.color), at: 1 },
          ],
        }
      : { type: "solid", color: fill.stops[0].color };

  return replaceFill(current, index, next);
}

/** solid 겹의 색. */
export function setSolidColor(
  current: Background | undefined,
  index: number,
  color: string,
): Background | undefined {
  const fill = fillAt(current, index);
  if (current === undefined || fill?.type !== "solid" || fill.color === color) return current;
  return replaceFill(current, index, { ...fill, color });
}

/**
 * linear 겹의 각도. 스키마 범위 `[0, 360)` 밖이면 쓰지 않는다 — 칸이 먼저 빨간
 * 테두리로 막지만(NumberField `maxExclusive`), 무효 배열이 스펙에 들어가는 길은
 * 여기서도 닫는다.
 */
export function setLinearAngle(
  current: Background | undefined,
  index: number,
  angle: number,
): Background | undefined {
  const fill = fillAt(current, index);
  if (current === undefined || fill?.type !== "linear" || fill.angle === angle) return current;
  if (!(angle >= 0 && angle < 360)) return current;
  return replaceFill(current, index, { ...fill, angle });
}

/** stop 하나의 색. */
export function setStopColor(
  current: Background | undefined,
  fillIndex: number,
  stopIndex: number,
  color: string,
): Background | undefined {
  const fill = fillAt(current, fillIndex);
  if (current === undefined || fill?.type !== "linear") return current;

  const stop = fill.stops[stopIndex] as GradientStop | undefined;
  if (stop === undefined || stop.color === color) return current;

  const stops = fill.stops.map((s, i) => (i === stopIndex ? { ...s, color } : s));
  return replaceFill(current, fillIndex, { ...fill, stops: asStops(stops) });
}

/**
 * stop 하나의 위치. 칸의 %(0~100)를 받아 `at`(0~1)으로 저장하고, stop을 위치순으로
 * 다시 정렬한다 — validator의 `gradient-stop-order`를 패널이 깨지 않는다.
 *
 * 정렬은 안정 정렬이라 같은 위치의 stop끼리는 원래 순서를 지킨다(같은 `at` 두 개는
 * 딱 끊기는 경계라 순서가 곧 뜻이다). 옮긴 stop이 정렬 뒤 몇 번째인지는
 * `stopIndexAfterPosition`이 같은 규칙으로 답한다.
 */
export function setStopPosition(
  current: Background | undefined,
  fillIndex: number,
  stopIndex: number,
  percent: number,
): Background | undefined {
  const fill = fillAt(current, fillIndex);
  if (current === undefined || fill?.type !== "linear") return current;

  const stop = fill.stops[stopIndex] as GradientStop | undefined;
  const at = atFromPercent(percent);
  if (stop === undefined || stop.at === at || !(at >= 0 && at <= 1)) return current;

  const stops = fill.stops
    .map((s, i) => (i === stopIndex ? { ...s, at } : s))
    .sort((a, b) => a.at - b.at);
  return replaceFill(current, fillIndex, { ...fill, stops: asStops(stops) });
}

/**
 * `setStopPosition`으로 옮긴 stop이 정렬 뒤 놓일 자리. 패널이 stop 칸의 React key를
 * 그 자리로 따라 옮겨, 타이핑 중 stop이 자리를 바꿔도 포커스와 타이핑 묶음(burst)이
 * 그 stop을 따라가게 한다.
 *
 * 나머지 stop이 이미 정렬돼 있다고 본다 — 패널은 늘 정렬된 목록만 쓰고, 정렬이
 * 틀린 문서는 validator가 열기 전에 막는다.
 */
export function stopIndexAfterPosition(
  stops: readonly GradientStop[],
  stopIndex: number,
  percent: number,
): number {
  const at = atFromPercent(percent);
  let index = 0;
  stops.forEach((s, i) => {
    if (i === stopIndex) return;
    // 안정 정렬: 원래 앞에 있던 같은 위치의 stop은 앞에 남는다.
    if (s.at < at || (s.at === at && i < stopIndex)) index += 1;
  });
  return index;
}

/**
 * stop을 하나 더한다. 가장 넓은 빈 구간의 가운데에 그 구간 시작 stop의 색으로 넣는다.
 *
 * 정렬된 자리에 끼워 넣으므로 순서가 깨지지 않고, 기존 stop과 같은 위치에 겹쳐
 * 놓이지 않아(겹치면 딱 끊기는 경계가 되고 목록에서 둘을 구분하기 어렵다) 바로
 * 위치를 고칠 수 있다. 색은 새로 지어내지 않고 이웃 색을 빌린다.
 */
export function addStop(
  current: Background | undefined,
  fillIndex: number,
): Background | undefined {
  const fill = fillAt(current, fillIndex);
  if (current === undefined || fill?.type !== "linear") return current;

  let gapStart = 0;
  for (let i = 1; i < fill.stops.length - 1; i += 1) {
    const gap = fill.stops[i + 1].at - fill.stops[i].at;
    const widest = fill.stops[gapStart + 1].at - fill.stops[gapStart].at;
    if (gap > widest) gapStart = i;
  }

  const left = fill.stops[gapStart];
  const right = fill.stops[gapStart + 1];
  const added: GradientStop = { color: left.color, at: roundAt((left.at + right.at) / 2) };
  const stops = [
    ...fill.stops.slice(0, gapStart + 1),
    added,
    ...fill.stops.slice(gapStart + 1),
  ];
  return replaceFill(current, fillIndex, { ...fill, stops: asStops(stops) });
}

/** stop 하나를 지운다. 스키마가 2개 이상을 요구하므로 2개 미만으로는 줄이지 않는다. */
export function removeStop(
  current: Background | undefined,
  fillIndex: number,
  stopIndex: number,
): Background | undefined {
  const fill = fillAt(current, fillIndex);
  if (current === undefined || fill?.type !== "linear" || !canRemoveStop(fill)) return current;
  if (!hasIndex(fill.stops, stopIndex)) return current;

  const stops = fill.stops.filter((_, i) => i !== stopIndex);
  return replaceFill(current, fillIndex, { ...fill, stops: asStops(stops) });
}

export function canRemoveStop(fill: LinearFill): boolean {
  return fill.stops.length > 2;
}

/**
 * 스키마의 `at`(0~1)을 칸에 보여줄 %로. 부동소수 오차를 정리한다 — 0.29 × 100은
 * 28.999999999999996이라 그대로 보이면 사용자가 친 값과 달라 보인다.
 *
 * 넷째 자리(%)에서 반올림하는 규칙은 캔버스가 CSS에 적는 `cssNumber`
 * (ui/canvasLayout.ts)와 같다 — 패널에 보이는 수와 캔버스에 그려지는 수가 같다.
 */
export function percentFromAt(at: number): number {
  return Math.round(at * 1_000_000) / 10_000;
}

/** 칸의 %를 스키마의 `at`(0~1)으로. 12.3 / 100 같은 나눗셈의 오차도 같은 규칙으로 정리한다. */
export function atFromPercent(percent: number): number {
  return roundAt(percent / 100);
}

/**
 * `at`을 소수 여섯째 자리(%로 넷째 자리)에서 반올림한다. 정수로 반올림한 뒤 나누는
 * 이유는 `cssNumber`와 같다 — 결과가 그 십진수에 가장 가까운 double이라 JSON에
 * 그대로 짧게 적힌다.
 */
function roundAt(at: number): number {
  return Math.round(at * 1_000_000) / 1_000_000;
}

/** `#RRGGBB` 또는 `#RRGGBBAA`의 알파만 00으로 바꾼다. 대소문자는 받은 그대로 둔다. */
function transparentOf(color: string): string {
  return `${color.slice(0, 7)}00`;
}

function fillAt(current: Background | undefined, index: number): Fill | undefined {
  return current !== undefined && hasIndex(current, index) ? current[index] : undefined;
}

function hasIndex(list: readonly unknown[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < list.length;
}

function replaceFill(current: Background, index: number, fill: Fill): Background {
  return current.map((f, i) => (i === index ? fill : f));
}

/**
 * 배열 연산을 거친 stop 목록을 스키마의 "2개 이상" 튜플 타입으로 되돌린다. 부르는
 * 쪽이 개수를 보장한다 — 늘리거나 바꾸기만 하거나, 지울 때는 `canRemoveStop`을 먼저 본다.
 */
function asStops(stops: GradientStop[]): LinearFill["stops"] {
  return stops as LinearFill["stops"];
}
