import type { CSSProperties } from "react";

import type {
  Background,
  Border,
  Box,
  Fill,
  FrameNode,
  Radius,
  Shadow,
  Size,
} from "@/features/editor/schema";

export type Direction = FrameNode["layout"]["direction"];

/**
 * 모서리 반경을 CSS border-radius로 옮긴다.
 *
 * 숫자 하나면 그대로 넘긴다(React가 px를 붙인다). 모서리별이면 CSS가 정한 순서
 * — 좌상 → 우상 → 우하 → 좌하 — 로 네 값을 적는다.
 */
export function radiusCss(radius: Radius | undefined): string | number | undefined {
  if (radius === undefined || typeof radius === "number") return radius;

  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
}

/**
 * 테두리와 그림자를 함께 CSS로 옮긴다.
 *
 * 한 함수인 이유는 둘이 `box-shadow` 한 칸을 두고 다투기 때문이다. 따로 쓰면
 * 나중에 쓴 쪽이 앞을 통째로 덮어쓴다.
 *
 * 테두리 정렬을 `outline`으로 구현하지 않는다 — 브라우저 포커스 링과 겹치고,
 * `box-shadow`라야 그림자와 한 문자열로 합칠 수 있다. (2026-09-04에 이 규칙을 정할
 * 때의 이유는 "캔버스가 선택 표시에 이미 `outline`을 쓰고 있어서"였는데, #90으로
 * 선택 표시가 오버레이로 빠지면서 그 충돌은 없어졌다. 위 두 이유가 남아 결론은 같다.)
 *
 * `inside`만 CSS `border` 속성을 그대로 쓴다. `box-shadow`는 레이아웃 박스를
 * 차지하지 않는데, 지금까지 `border` + `box-sizing: border-box`로 그려온 기존
 * 문서가 전부 `inside`라 여기서 `box-shadow`로 갈아타면 안쪽 여백이 달라진다.
 */
export function strokeAndShadowStyle(
  border: Border | undefined,
  shadow: Shadow | undefined,
): CSSProperties {
  const insideBorder = border !== undefined && (border.align ?? "inside") === "inside";
  const layers = [strokeRing(border), dropShadow(shadow)].filter(
    (layer): layer is string => layer !== undefined,
  );

  return {
    // 테두리 고리를 그림자보다 앞에 둔다 — box-shadow는 먼저 적은 것이 위에 그려진다.
    boxShadow: layers.length > 0 ? layers.join(", ") : undefined,
    border: insideBorder ? `${border.width}px solid ${border.color}` : undefined,
    borderRadius: radiusCss(border?.radius),
  };
}

/** inside가 아닌 정렬을 box-shadow 고리로 그린다. inside와 두께 0은 CSS border가 맡는다. */
function strokeRing(border: Border | undefined): string | undefined {
  if (border === undefined || border.width <= 0) return undefined;

  const align = border.align ?? "inside";
  if (align === "inside") return undefined;
  if (align === "outside") return `0 0 0 ${border.width}px ${border.color}`;

  // center는 절반씩 안팎으로 나눠 그린다.
  const half = border.width / 2;
  return `0 0 0 ${half}px ${border.color}, inset 0 0 0 ${half}px ${border.color}`;
}

function dropShadow(shadow: Shadow | undefined): string | undefined {
  if (shadow === undefined) return undefined;
  return `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`;
}

/**
 * 배경 채우기 겹을 CSS로 옮긴다(#127). 노드 타입을 모르는 순수 함수다 —
 * frame·button·input의 캔버스(`nodeStyles.ts`)와 홈 미리보기(`homePreview.ts`)가
 * 모두 이 함수를 부른다.
 *
 * 규칙은 docs/13-background-fill-design.md "캔버스 번역"이다.
 * - **모든 겹을 `background-image` 쉼표 목록 하나로 그린다.** 배열 앞이 위라
 *   CSS가 먼저 적은 겹을 위에 그리는 순서와 같다 — 뒤집지 않는다. solid는
 *   `linear-gradient(c, c)`로 바꾼다. 단색과 똑같이 그려진다.
 * - **`background-color`도 `background` 축약도 쓰지 않는다.** `background-color`는
 *   언제나 맨 아래 한 겹뿐이라 목록 중간의 solid를 그릴 수 없다. 축약은 같은
 *   스타일 객체의 `backgroundImage` 같은 개별 속성과 섞이면 React가 다시 그릴 때
 *   충돌한다.
 * - **`background-origin: border-box`를 함께 낸다.** 0.2까지의 `background: color`는
 *   테두리 밑까지 한 장으로 칠했다(`background-clip` 기본값이 border-box). 이미지
 *   겹은 기본적으로 padding 상자 기준으로 놓이고, 테두리 밑은 그 타일이 반복돼
 *   채운다. 단색 타일이라 보이는 결과는 같겠지만 "한 장"이 아니라 "이어 붙인 여러
 *   장"이다. 기준을 상자 전체로 옮기면 옛 렌더와 같은 한 장이 되고 반복에 기대지
 *   않는다. 다음 단계의 그라디언트도 이 기준이어야 이음매 없이 상자 전체에 걸린다.
 * - 생략·빈 배열은 아무 속성도 내지 않는다 — 배경이 없던 노드와 같다.
 *
 * **linear 겹은 아직 그리지 않는다**(스키마 전환 단계 — 그라디언트 렌더는 다음
 * 단계에서 이 함수에 갈래를 더한다). 그 겹만 빠지고 나머지 겹은 그려진다.
 */
export function backgroundStyle(background: Background | undefined): CSSProperties {
  const layers = (background ?? [])
    .map(fillLayer)
    .filter((layer): layer is string => layer !== undefined);

  if (layers.length === 0) {
    return { backgroundImage: undefined, backgroundOrigin: undefined };
  }
  return { backgroundImage: layers.join(", "), backgroundOrigin: "border-box" };
}

/** 겹 하나를 `background-image` 목록의 한 항목으로. 아직 못 그리는 종류는 undefined. */
function fillLayer(fill: Fill): string | undefined {
  switch (fill.type) {
    case "solid":
      return `linear-gradient(${fill.color}, ${fill.color})`;
    case "linear":
      return undefined;
  }
}

/**
 * 투명도와 레이어 블러. 둘 다 자기 자신과 자식에게 함께 걸린다(Figma의 Layer blur).
 * 뒤 배경을 흐리는 backdrop-filter는 다른 기능이라 여기서 다루지 않는다.
 *
 * blur 0은 `filter`를 아예 내보내지 않는다 — `filter`가 있으면 새 stacking context가
 * 생겨 자식의 쌓임 순서가 달라지므로, 효과가 없을 때는 붙이지 않는 편이 안전하다.
 */
export function effectStyle(
  opacity: number | undefined,
  blur: number | undefined,
): CSSProperties {
  return {
    opacity,
    filter: blur !== undefined && blur > 0 ? `blur(${blur}px)` : undefined,
  };
}

/**
 * 리사이즈 드래그의 새 크기를 계산한다.
 *
 * 캔버스 전체가 `transform: scale(zoom)`으로 확대돼 있어 마우스가 움직인 화면
 * px과 스펙이 쓰는 px이 다르다 — 화면 이동량을 줌 배율로 나눠야 실제 스펙
 * px 변화량이 나온다. 결과는 최소 1px로 자른다 — 0 이하 크기는 노드가 안
 * 보이거나(0) 스키마의 `Size` 제약(`minimum: 0`) 경계에 걸린다.
 */
export function resizedValue(start: number, deltaScreenPx: number, zoom: number): number {
  return Math.max(1, Math.round(start + deltaScreenPx / zoom));
}

/** Size를 그대로 CSS 길이 문자열로 옮긴다(퍼센트 해석은 호출부 책임). */
export function sizeToCss(size: Size): string {
  if (size === "fill") return "100%";
  if (size === "auto") return "auto";
  return `${size}px`;
}

/**
 * Figma의 Fixed / Hug(auto) / Fill을 flex 속성으로 옮긴다.
 *
 * 주축의 Fill을 `width: 100%`로 번역하면 안 된다. flex 아이템의 기본값
 * `min-width: auto` 때문에 각 아이템이 자기 콘텐츠 최소 크기 밑으로 줄지 않아,
 * 한 자식의 패딩·폰트를 키우면 형제의 너비까지 끌려간다. `flex: 1 1 0` +
 * `min-*: 0`이라야 형제끼리 공간을 균등하게 나눠 갖는다.
 *
 * 교차축의 Fill은 `align-self: stretch`다. 퍼센트로 쓰면 부모 크기가 auto일 때
 * CSS 규격상 무시되어 아무 일도 일어나지 않는다.
 */
export function boxStyle(
  box: Box,
  parentDirection: Direction | undefined,
): CSSProperties {
  // 최상위 노드는 곧 페이지다 — **자기 box 를 보지 않고 항상 아트보드를 채운다.**
  //
  // 페이지 크기를 정하는 것은 `page.size` 하나여야 한다. root 가 box 를 따로 갖고
  // 둘이 어긋나면 화면에 네모가 둘 겹쳐 보인다 — 아트보드 경계(그림자)와 root 네모가
  // 따로 논다. 실제로 캔버스에서 root 를 리사이즈하면(PR #99 의 핸들) box.width 가
  // "fill" 에서 고정 숫자로 바뀌어 그 상태가 만들어졌다. 여기서 box 를 무시하면
  // 그런 상태가 애초에 생기지 않는다 — examples 9개와 seedSpec·blankSpec 의 root 는
  // 전부 이미 fill·fill 이라 정상 문서의 렌더는 달라지지 않는다.
  //
  // 세로를 퍼센트가 아니라 flex 로 두는 이유는 아트보드가 내용에 따라 자라기
  // 때문이다(2026-09-11·이슈 #86) — 부모 높이가 auto 면 자식의 퍼센트 높이는 CSS
  // 규격상 무효라 root 배경이 내용 높이에서 끊긴다. `flex: 1 0 auto` 는 짧으면 첫
  // 화면을 채우고(grow) 길면 내용 높이를 그대로 쓴다(basis auto + shrink 0).
  if (parentDirection === undefined) {
    return { width: "100%", flexGrow: 1, flexShrink: 0, flexBasis: "auto" };
  }

  // grid 아이템: flex-grow/shrink 기반 주축/교차축 배분은 grid에 뜻이 없다 —
  // grid 컨테이너 쪽(frameStyle)의 최소 구현이라 아이템은 그냥 width/height
  // 그대로 쓴다(fill→100%). 정식 grid 배치는 후속 작업.
  if (parentDirection === "grid") {
    return { width: sizeToCss(box.width), height: sizeToCss(box.height) };
  }

  const isRow = parentDirection === "row";
  const main = isRow ? box.width : box.height;
  const cross = isRow ? box.height : box.width;
  const style: CSSProperties = {};

  if (main === "fill") {
    style.flexGrow = 1;
    style.flexShrink = 1;
    style.flexBasis = 0;
  } else if (main === "auto") {
    style.flexGrow = 0;
    style.flexShrink = 0;
    style.flexBasis = "auto";
  } else {
    // Fixed는 공간이 모자라도 줄어들지 않아야 한다(기본 flex-shrink:1이면 쭈그러든다).
    style.flexGrow = 0;
    style.flexShrink = 0;
    style.flexBasis = `${main}px`;
  }

  const mainSize = main === "fill" ? undefined : sizeToCss(main);
  const crossStretch = cross === "fill";
  const crossSize = crossStretch ? "auto" : sizeToCss(cross);

  if (isRow) {
    style.minWidth = 0;
    style.width = mainSize;
    style.height = crossSize;
  } else {
    style.minHeight = 0;
    style.height = mainSize;
    style.width = crossSize;
  }
  if (crossStretch) {
    style.alignSelf = "stretch";
  }

  return style;
}

/**
 * 아트보드를 감싼 바깥 박스의 크기.
 *
 * `transform: scale` 은 레이아웃 박스를 바꾸지 않아, 스크롤 범위를 정하는 것은 이
 * 바깥 박스다. 예전에는 `page.size` 를 그대로 배율만 곱했는데, 아트보드가 내용에
 * 따라 세로로 자라게 되면서(#86) 스펙 높이로는 **아래쪽 내용까지 스크롤할 수 없다.**
 *
 * 그래서 높이는 실측값을 쓴다. 아직 못 쟀으면 스펙 높이로 시작한다 — 첫 페인트에서
 * 박스가 튀지 않게 하려는 것이고, 아트보드에 `min-height: size.height` 가 걸려 있어
 * 실측값은 항상 스펙 높이 이상이다.
 *
 * 가로는 실측하지 않는다. 아트보드 폭은 `page.size.width` 로 고정이고, 자식이 넘쳐도
 * Figma처럼 밖으로 삐져나가게 두는 쪽이 의도다.
 */
export function artboardBoxSize(
  size: { width: number; height: number },
  measuredHeight: number | null,
  scale: number,
): { width: number; height: number } {
  const height = Math.max(size.height, measuredHeight ?? size.height);
  return { width: size.width * scale, height: height * scale };
}
