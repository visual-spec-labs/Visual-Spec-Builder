import type { CSSProperties } from "react";

import type { Box, FrameNode, Size } from "@/features/editor/schema";

export type Direction = FrameNode["layout"]["direction"];

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
