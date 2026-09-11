import type { Node } from "@/features/editor/schema";

/**
 * 노드 타입별로 어떤 속성 섹션을 띄울지 정하는 표.
 *
 * 섹션을 노드 타입에 묶인 통짜 컴포넌트(FrameProperties·TextProperties)로 두던
 * 것을 이 표로 바꿨다(#92). 그렇게 두면 새 노드 타입이 생길 때마다 섹션을
 * 복사하거나 포기하게 되는데, 실제로 네 번 반복됐다 — #67(image) · #69(Import) ·
 * #83(button·input) · #88(image에 opacity·blur). 세 타입은 스키마에 필드가 있는데도
 * "지원하지 않습니다" 한 줄만 뜨는 상태로 남아 있었다.
 *
 * 표를 한 곳에 모으면 빈 칸이 눈에 보인다. button·input에 effects가 없는 것은
 * 빠뜨린 게 아니라 스키마에 opacity·blur가 아직 없어서다(그 이유가 "패널이 없어서"
 * 였으므로, 이 작업이 그 순환을 끊는다 — 스키마 확장은 동결 규칙을 타야 하니
 * 별도 작업이다).
 */
export type SectionId =
  | "content"
  | "layout"
  | "size"
  | "typography"
  | "color"
  | "background"
  | "border"
  | "effects";

export type NodeType = Node["type"];

/**
 * 화면에 뜨는 순서 그대로다. 위에서부터 "무엇인가(content) → 얼마나 큰가(size) →
 * 어떻게 보이는가(나머지)" 순으로 둔다.
 */
const SECTIONS: Record<NodeType, readonly SectionId[]> = {
  frame: ["layout", "size", "background", "border", "effects"],
  text: ["content", "size", "typography", "color", "effects"],
  image: ["content", "size", "effects"],
  button: ["content", "size", "typography", "color", "background", "border"],
  input: ["content", "size", "typography", "color", "background", "border"],
};

/** 이 타입의 노드에 띄울 섹션 목록. 순서가 곧 화면 순서다. */
export function sectionsFor(type: NodeType): readonly SectionId[] {
  return SECTIONS[type];
}

/** 표에 등록된 노드 타입 전부. 새 타입을 빠뜨렸는지 검사할 때 쓴다. */
export function coveredNodeTypes(): NodeType[] {
  return Object.keys(SECTIONS) as NodeType[];
}

/**
 * 그림자는 frame에만 있다. 글자 모양을 따라가는 그림자는 box-shadow가 아니라
 * filter: drop-shadow라 성격이 달라 text에 두지 않았고, button·input은 스키마에
 * shadow 필드 자체가 없다.
 */
export function hasShadow(type: NodeType): boolean {
  return type === "frame";
}
