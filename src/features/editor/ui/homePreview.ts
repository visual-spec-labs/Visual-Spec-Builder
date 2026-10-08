import type { CSSProperties } from "react";

import type {
  Background,
  ButtonNode,
  FrameNode,
  ImageNode,
  InputNode,
  TextNode,
} from "@/features/editor/schema";

import { backgroundStyle, boxStyle, radiusCss, type Direction } from "./canvasLayout";
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
 * 받게 된다. #236은 현재 DOM 렌더러를 유지하고 역할만 분리한다.
 * 홈 미리보기와 편집기 스타일 통합은 이번 순수 이동의 범위 밖이다.
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
  imageSrc: PreviewImageSrc,
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
    ...backgroundStyle(previewBackground(node.background, imageSrc)),
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

/**
 * 미리보기에 쓸 이미지 주소(#322). 원본 대신 카드 크기로 줄인 이미지의 blob URL을 주고,
 * null이면 아직 준비되지 않아 그 이미지를 그리지 않는다. `previewThumbnail.ts`가 만든다.
 */
export type PreviewImageSrc = (src: string) => string | null;

/**
 * 배경의 이미지 겹 src를 미리보기용(`imageSrc`)으로 바꾼다. 아직 준비되지 않은 겹은 뺀다 —
 * 원본을 잠깐이라도 그리면 그 디코드가 바로 #322가 없애려는 메모리다. 나머지 겹의 순서와
 * 맨 아래 단색은 그대로라 겹이 준비되는 대로 카드가 원래 모습으로 채워진다.
 */
export function previewBackground(
  background: Background | undefined,
  imageSrc: PreviewImageSrc,
): Background | undefined {
  if (background === undefined) return undefined;
  return background.flatMap((fill): Background => {
    if (fill.type !== "image") return [fill];
    const src = imageSrc(fill.src);
    return src === null ? [] : [{ ...fill, src }];
  });
}

/** 이미지 노드. 미리보기용 src가 아직 없으면 같은 크기의 빈 상자만 둔다. */
export function previewImageStyle(
  node: ImageNode,
  parentDirection: Direction | undefined,
  imageSrc: PreviewImageSrc,
): CSSProperties {
  const src = imageSrc(node.src);
  return {
    ...boxStyle(node.box, parentDirection),
    backgroundImage: src === null ? undefined : imageUrlCss(src),
    backgroundSize: node.fit === "fill" ? "100% 100%" : node.fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

export function previewButtonStyle(
  node: ButtonNode,
  parentDirection: Direction | undefined,
  imageSrc: PreviewImageSrc,
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
    ...backgroundStyle(previewBackground(node.background, imageSrc)),
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
  imageSrc: PreviewImageSrc,
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
    ...backgroundStyle(previewBackground(node.background, imageSrc)),
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
