/* 이 파일은 schema/visual-spec.schema.json 에서 자동 생성됩니다. */
/* 손으로 수정하지 마세요. 재생성: npm run generate:types */

export type NodeId = string;
export type Node = FrameNode | TextNode;
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
  screen: Screen;
}
export interface Screen {
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
