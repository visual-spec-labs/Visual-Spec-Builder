import type { Border } from "@/features/editor/schema";

/** 테두리가 없던 노드에서 한 칸만 건드렸을 때 채워 넣을 기본값. */
export const BORDER_DEFAULT: Border = { width: 0, color: "#000000", radius: 0 };

/**
 * border는 스키마상 width·color·radius가 모두 필수다. 한 칸만 점 표기 경로로
 * 써넣으면 나머지가 빠진 반쪽 객체가 만들어져 스펙이 무효가 되고(Export 실패)
 * CSS도 "3px solid undefined"가 되어 테두리가 아예 안 그려진다.
 * 그래서 어느 칸을 바꾸든 항상 완전한 객체를 만들어 통째로 쓴다.
 */
export function mergeBorder(
  current: Border | undefined,
  patch: Partial<Border>,
): Border {
  return { ...BORDER_DEFAULT, ...current, ...patch };
}
