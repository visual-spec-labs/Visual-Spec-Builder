/* 이 파일은 visual-spec.schema.json 에서 자동 생성됩니다. */
/* 손으로 수정하지 마세요. 재생성: pnpm generate:types */

export type NodeId = string;
export type Node = FrameNode | TextNode | ImageNode | ButtonNode | InputNode;
/**
 * number | "auto" | "fill". number는 minimum 0, px로 해석.
 */
export type Size = number | ("auto" | "fill");
/**
 * #RRGGBB 또는 #RRGGBBAA
 */
export type Color = string;
/**
 * 모서리 반경. 숫자 하나면 네 모서리가 같고, 객체면 모서리별로 다르다. 객체 쪽은 네 칸이 모두 필수다 — 한 칸만 쓴 반쪽 객체는 CSS border-radius를 통째로 깨뜨린다.
 */
export type Radius =
  | number
  | {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    };
/**
 * 테두리를 박스 경계 기준 어디에 그릴지. 없으면 "inside"로 본다 — 지금까지 CSS border + box-sizing: border-box 로 그려온 방식이 곧 inside라, 기본값을 이렇게 두면 기존 문서의 렌더가 바뀌지 않는다.
 */
export type StrokeAlign = "inside" | "center" | "outside";
/**
 * 0=완전 투명, 1=불투명. 자식까지 함께 투명해진다(CSS opacity와 같다).
 */
export type Opacity = number;
/**
 * 레이어 블러 반경(px). 자기 자신과 자식이 함께 흐려진다(CSS filter: blur). 뒤 배경을 흐리는 backdrop-filter 는 다른 기능이라 여기 포함하지 않는다.
 */
export type Blur = number;

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
  shadow?: Shadow;
  opacity?: Opacity;
  blur?: Blur;
  children: ChildReference[];
}
export interface Box {
  width: Size;
  height: Size;
}
export interface Layout {
  direction: "row" | "column" | "grid";
  gap: number;
  padding: Padding;
  mainAxis: "start" | "center" | "end" | "space-between";
  crossAxis: "start" | "center" | "end" | "stretch";
  /**
   * direction이 "grid"일 때만 의미가 있는 열 개수. 없으면 1열로 본다. row/column에 이 필드를 강제하면 기존 예제·테스트가 전부 깨지는데, grid에만 뜻이 있는 값을 매번 채우게 하는 것도 부자연스럽다. 선택 필드 추가 조건은 06-schema-freeze.md '변경 규칙' 참고.
   */
  columns?: number;
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
  radius: Radius;
  align?: StrokeAlign;
}
/**
 * 드롭 섀도 하나(Figma의 Drop shadow). CSS box-shadow 로 옮긴다. 텍스트에는 두지 않는다 — 글자 모양을 따라가는 그림자는 box-shadow가 아니라 filter: drop-shadow 라 성격이 다르다.
 */
export interface Shadow {
  /**
   * 가로 오프셋(px). 양수는 오른쪽.
   */
  x: number;
  /**
   * 세로 오프셋(px). 양수는 아래.
   */
  y: number;
  /**
   * 번짐 반경(px).
   */
  blur: number;
  /**
   * 확장(px). 음수면 줄어든다.
   */
  spread: number;
  color: Color;
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
  opacity?: Opacity;
  blur?: Blur;
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
  opacity?: Opacity;
  blur?: Blur;
}
export interface ButtonNode {
  type: "button";
  name: string;
  visible?: boolean;
  box: Box;
  /**
   * 버튼 라벨.
   */
  content: string;
  typography: Typography;
  color: Color;
  background?: Background;
  border?: Border;
}
export interface InputNode {
  type: "input";
  name: string;
  visible?: boolean;
  box: Box;
  /**
   * MVP는 표시용 placeholder 텍스트만 있다. value·onChange 같은 바인딩은 없다(props/bindings는 MVP 제외 범위).
   */
  placeholder: string;
  typography: Typography;
  color: Color;
  background?: Background;
  border?: Border;
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
