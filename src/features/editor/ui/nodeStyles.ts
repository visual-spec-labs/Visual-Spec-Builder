import type { CSSProperties } from "react";

import type {
  ButtonNode,
  FrameNode,
  ImageNode,
  InputNode,
  TextNode,
} from "@/features/editor/schema";

import { boxStyle, effectStyle, strokeAndShadowStyle, type Direction } from "./canvasLayout";
import { imageUrlCss } from "./properties/imageSrc";

/**
 * 노드 하나를 CSS 로 옮기는 함수들 — 타입마다 하나씩.
 *
 * `canvasLayout.ts` 와 나눠 둔 경계는 **무엇을 아는가**다. 저쪽은 `Box` 하나를
 * flex 속성으로 옮기는 순수 계산이라 노드 타입을 모르고 `test/` 에서 직접
 * 테스트한다. 여기는 노드 타입별로 그 조각들을 조립한다.
 *
 * `Canvas.tsx` 에서 잘라 온 것이고 동작은 바뀌지 않았다(2026-09-19·이슈 #148).
 */

const MAIN_AXIS: Record<string, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
};

const CROSS_AXIS: Record<string, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

/**
 * grid는 최소 구현이다 — 열 N개짜리 균등 그리드로만 그린다(자동 배치, 아이템별
 * 셀 지정 없음). mainAxis/crossAxis는 grid에 뜻이 없어 무시한다. 정식 구현은
 * 후속 작업(이 파일 자체가 "임시 스탠드인" — 위 주석 참고).
 */
export function displayStyle(layout: FrameNode["layout"]): CSSProperties {
  if (layout.direction === "grid") {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${layout.columns ?? 1}, 1fr)`,
    };
  }
  return { display: "flex", flexDirection: layout.direction };
}

export function frameStyle(
  node: FrameNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { layout } = node;
  return {
    ...displayStyle(layout),
    gap: layout.gap,
    paddingTop: layout.padding.top,
    paddingRight: layout.padding.right,
    paddingBottom: layout.padding.bottom,
    paddingLeft: layout.padding.left,
    justifyContent: MAIN_AXIS[layout.mainAxis],
    alignItems: CROSS_AXIS[layout.crossAxis],
    ...boxStyle(node.box, parentDirection),
    background: node.background?.color,
    ...strokeAndShadowStyle(node.border, node.shadow),
    ...effectStyle(node.opacity, node.blur),
    boxSizing: "border-box",
  };
}

export function textStyle(
  node: TextNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
    color: node.color,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    whiteSpace: "pre-wrap",
    ...effectStyle(node.opacity, node.blur),
  };
}

export function imageStyle(
  node: ImageNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  return {
    ...boxStyle(node.box, parentDirection),
    backgroundImage: imageUrlCss(node.src),
    backgroundSize: node.fit === "fill" ? "100% 100%" : node.fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    ...effectStyle(node.opacity, node.blur),
  };
}

/** frame(배경/테두리) + text(타이포그래피)를 합친 모양 — 최소 구현. 클릭 동작은 없다(인터랙션은 v0.1 제외). */
export function buttonStyle(
  node: ButtonNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: node.color,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    background: node.background?.color,
    // button·input에는 shadow 필드가 아직 없다(속성 패널이 없어 편집할 수 없다).
    // Border는 공유하므로 정렬만 같은 합성기로 처리한다.
    ...strokeAndShadowStyle(node.border, undefined),
    boxSizing: "border-box",
    cursor: "default",
  };
}

/**
 * placeholder 텍스트만 흐리게 보여준다 — 실제 입력 상호작용은 없다(value/onChange는
 * 스키마에 없음).
 *
 * 흐리게 만드는 opacity는 요소가 아니라 글자에 건다(아래 render의 span). 요소에 걸면
 * 배경색·테두리색까지 60%로 섞여 패널에서 고른 색이 그대로 안 나오고, 자식으로 들어가는
 * 리사이즈 핸들까지 흐려진다.
 */
export function inputStyle(
  node: InputNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
    display: "flex",
    alignItems: "center",
    color: node.color,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    background: node.background?.color,
    ...strokeAndShadowStyle(node.border, undefined),
    boxSizing: "border-box",
  };
}

/**
 * 선택된 노드가 실제로 몇 px로 그려졌는지 재서 스토어에 올린다.
 * transform: scale은 offsetWidth/Height에 영향을 주지 않으므로 줌과 무관한 실측값이다.
 */