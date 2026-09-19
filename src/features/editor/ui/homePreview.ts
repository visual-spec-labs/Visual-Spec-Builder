import type { CSSProperties } from "react";

import type {
  ButtonNode,
  FrameNode,
  ImageNode,
  InputNode,
  TextNode,
} from "@/features/editor/schema";

import { boxStyle, radiusCss, type Direction } from "./canvasLayout";
import { imageUrlCss } from "./properties/imageSrc";

/**
 * 홈 화면 카드가 스펙을 축소해서 즉석 렌더할 때 쓰는 순수 스타일 계산.
 *
 * **이 파일이 따로 있는 근거는 2026-09-19(이슈 #148)로 절반이 무너졌다.**
 * 예전 이유는 "Canvas.tsx 는 임시 스탠드인이라 export 가 없고 select·드래그
 * 인터랙션에 묶여 있다"였는데, 그 스타일 함수들이 `nodeStyles.ts` 로 빠지면서
 * **export 되는 순수 함수가 됐다.** `previewDisplayStyle` 은 `nodeStyles.displayStyle`
 * 과 글자 하나까지 같고, `MAIN_AXIS`·`CROSS_AXIS` 표도 그대로 복사본이다.
 *
 * 남는 차이는 하나뿐이다 — 미리보기는 **인터랙션이 없어야 한다**(카드 클릭 하나로
 * 에디터에 들어가는 것 말고는). 지금 `nodeStyles` 쪽에도 인터랙션이 없으므로
 * 그 차이조차 실질적이지 않다.
 *
 * **합칠지는 별도로 판단한다.** 합치면 미리보기가 캔버스 렌더러의 변경을 그대로
 * 받게 되는데, `Canvas.tsx` 가 정식 구현으로 교체될 예정이라 그때 함께 보는 편이
 * 낫다. 지금 섣불리 합쳤다가 교체 작업에서 다시 갈라야 할 수 있다.
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
 * grid는 최소 구현이다 — Canvas.tsx의 displayStyle()과 같은 규칙(균등 N열
 * 자동 배치만, 셀 지정 없음, mainAxis/crossAxis 무시). 카드 미리보기는
 * Canvas.tsx와 별개 구현이라(위 주석 참고) 여기도 같이 맞춘다.
 */
function previewDisplayStyle(layout: FrameNode["layout"]): CSSProperties {
  if (layout.direction === "grid") {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${layout.columns ?? 1}, 1fr)`,
    };
  }
  return { display: "flex", flexDirection: layout.direction };
}

export function previewFrameStyle(
  node: FrameNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { layout } = node;
  return {
    ...previewDisplayStyle(layout),
    gap: layout.gap,
    paddingTop: layout.padding.top,
    paddingRight: layout.padding.right,
    paddingBottom: layout.padding.bottom,
    paddingLeft: layout.padding.left,
    justifyContent: MAIN_AXIS[layout.mainAxis],
    alignItems: CROSS_AXIS[layout.crossAxis],
    ...boxStyle(node.box, parentDirection),
    background: node.background?.color,
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: radiusCss(node.border?.radius),
    boxSizing: "border-box",
  };
}

export function previewTextStyle(
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
  };
}

export function previewImageStyle(
  node: ImageNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  return {
    ...boxStyle(node.box, parentDirection),
    backgroundImage: imageUrlCss(node.src),
    backgroundSize: node.fit === "fill" ? "100% 100%" : node.fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

export function previewButtonStyle(
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
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: radiusCss(node.border?.radius),
    boxSizing: "border-box",
  };
}

export function previewInputStyle(
  node: InputNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
    display: "flex",
    alignItems: "center",
    color: node.color,
    opacity: 0.6,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    background: node.background?.color,
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: radiusCss(node.border?.radius),
    boxSizing: "border-box",
  };
}

/**
 * 화면(콘텐츠) 크기를 카드 미리보기 박스 안에 통째로 넣는 축소 배율.
 * viewStore의 fitZoom과 같은 목적(안 잘리게 맞추기)이지만 그쪽은 %
 * 확대율 문자열이 아니라 여기서는 transform: scale에 바로 쓸 소수를 낸다.
 */
export function previewScale(
  contentWidth: number,
  contentHeight: number,
  boxWidth: number,
  boxHeight: number,
): number {
  if (contentWidth <= 0 || contentHeight <= 0) {
    return 1;
  }

  return Math.min(boxWidth / contentWidth, boxHeight / contentHeight);
}
