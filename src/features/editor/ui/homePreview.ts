import type { CSSProperties } from "react";

import type { FrameNode, ImageNode, TextNode } from "@/features/editor/schema";

import { boxStyle, type Direction } from "./canvasLayout";

/**
 * 홈 화면 카드가 스펙을 축소해서 즉석 렌더할 때 쓰는 순수 스타일 계산.
 * Canvas.tsx의 frameStyle/textStyle/imageStyle과 같은 모양이지만 그쪽은
 * "⚠️ 임시 스탠드인"이라 export가 없고 select/드래그 등 인터랙션에 묶여
 * 있다 — 카드 미리보기는 클릭 하나(에디터로 이동) 말고는 인터랙션이
 * 없으므로 여기서 따로 최소한으로 다시 만든다. Canvas.tsx가 정식
 * 구현으로 교체돼도 이 파일은 영향받지 않는다.
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

export function previewFrameStyle(
  node: FrameNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { layout } = node;
  return {
    display: "flex",
    flexDirection: layout.direction,
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
    borderRadius: node.border?.radius,
    boxSizing: "border-box",
    overflow: "hidden",
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
    overflow: "hidden",
  };
}

export function previewImageStyle(
  node: ImageNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  return {
    ...boxStyle(node.box, parentDirection),
    backgroundImage: `url(${node.src})`,
    backgroundSize: node.fit === "fill" ? "100% 100%" : node.fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
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
