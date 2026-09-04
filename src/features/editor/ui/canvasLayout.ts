import type { CSSProperties } from "react";

import type {
  Border,
  Box,
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
 * 테두리 정렬을 `outline`으로 구현하지 않는다 — 캔버스가 선택 표시에 이미
 * `outline`을 쓰고 있어(`Canvas.tsx`의 `RenderNode`), 노드를 고르는 순간 테두리와
 * 선택 표시 중 하나가 사라진다.
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
  // 최상위 노드는 flex 아이템이 아니다 — 고정 크기 래퍼 기준 퍼센트로 처리한다.
  // grid 아이템도 같은 취급이다: flex-grow/shrink 기반 주축/교차축 배분은 grid에
  // 뜻이 없다 — grid 컨테이너 쪽(frameStyle)의 최소 구현이라 아이템은 그냥
  // width/height 그대로 쓴다(fill→100%). 정식 grid 배치는 후속 작업.
  if (parentDirection === undefined || parentDirection === "grid") {
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
