import type { Shadow } from "@/features/editor/schema";

/** 그림자를 처음 켰을 때 채워 넣을 기본값. Figma의 기본 드롭 섀도와 비슷한 값이다. */
export const SHADOW_DEFAULT: Shadow = {
  x: 0,
  y: 4,
  blur: 12,
  spread: 0,
  color: "#00000026",
};

/**
 * shadow는 스키마상 x·y·blur·spread·color가 모두 필수다. 한 칸만 점 표기 경로로
 * 써넣으면 반쪽 객체가 만들어져 스펙이 무효가 되고(Export 실패) CSS도
 * "0px 4px NaNpx"가 되어 그림자가 아예 안 그려진다.
 * 그래서 어느 칸을 바꾸든 항상 완전한 객체를 만들어 통째로 쓴다.
 *
 * borderPatch.mergeBorder와 같은 이유·같은 모양이다.
 */
export function mergeShadow(
  current: Shadow | undefined,
  patch: Partial<Shadow>,
): Shadow {
  return { ...SHADOW_DEFAULT, ...current, ...patch };
}
