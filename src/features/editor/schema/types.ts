/* 이 파일은 visual-spec.schema.json 에서 자동 생성됩니다. */
/* 손으로 수정하지 마세요. 재생성: pnpm generate:types */

export type NodeId = string;
export type Node = FrameNode | TextNode | ImageNode;
/**
 * number | "auto" | "fill". number는 minimum 0, px로 해석.
 */
export type Size = number | ("auto" | "fill");
/**
 * #RRGGBB 또는 #RRGGBBAA
 */
export type Color = string;

/**
 * Visual Spec Schema v0.1 — 파일 1개 = Screen 1개. Auto Layout 전용, 절대좌표 없음.
 */
export interface VisualSpec {
  version: "0.1";
  screen: ScreenSpec;
}
export interface ScreenSpec {
  name: string;
  /**
   * Screen 크기. width/height 모두 exclusiveMinimum 0.
   */
  size: {
    width: number;
    height: number;
  };
  root: NodeId;
  nodes: {
    [k: string]: Node;
  };
}
export interface FrameNode {
  type: "frame";
  name: string;
  visible?: boolean;
  box: Box;
  layout: Layout;
  background?: Background;
  border?: Border;
  children: ChildReference[];
}
export interface Box {
  width: Size;
  height: Size;
}
export interface Layout {
  direction: "row" | "column";
  gap: number;
  padding: Padding;
  mainAxis: "start" | "center" | "end" | "space-between";
  crossAxis: "start" | "center" | "end" | "stretch";
}
export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
/**
 * MVP는 단색만
 */
export interface Background {
  color: Color;
}
/**
 * MVP는 solid 고정, 네 모서리 균일
 */
export interface Border {
  width: number;
  color: Color;
  radius: number;
}
export interface ChildReference {
  node: NodeId;
}
export interface TextNode {
  type: "text";
  name: string;
  visible?: boolean;
  box: Box;
  content: string;
  typography: Typography;
  color: Color;
}
export interface Typography {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right";
}
export interface ImageNode {
  type: "image";
  name: string;
  visible?: boolean;
  box: Box;
  /**
   * 워크스페이스 assets에 저장된 이미지를 가리키는 상대 경로 또는 assetId.
   */
  src: string;
  /**
   * MVP는 object-fit 방식만.
   */
  fit: "cover" | "contain" | "fill";
}

export type PageId = string;

/**
 * Visual Spec v0.2 — 파일 1개 = 프로젝트 1개(페이지 여러 개). 각 페이지는 v0.1의 ScreenSpec 그대로다.
 */
export interface ProjectSpec {
  version: "0.2";
  name: string;
  pages: {
    [k: string]: ScreenSpec;
  };
  /**
   * pages의 키와 정확히 일치해야 한다. JSON Schema로는 표현할 수 없어 validateProjectSpec이 page-order-mismatch로 검사한다.
   *
   * @minItems 1
   */
  pageOrder: [PageId, ...PageId[]];
}
