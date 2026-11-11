import type { Radius } from "@/features/editor/schema";

/** 모서리별 반경. Radius 유니온의 객체 쪽. */
export type CornerRadius = Exclude<Radius, number>;

/** 네 모서리를 따로 정한 상태인지. */
export function isPerCorner(radius: Radius | undefined): radius is CornerRadius {
  return typeof radius === "object" && radius !== null;
}

/**
 * 전체 → 개별로 전환할 때 쓴다. 지금 값을 네 모서리에 그대로 펼쳐
 * 전환 순간에 모양이 바뀌지 않게 한다.
 */
export function toPerCorner(radius: Radius | undefined): CornerRadius {
  if (isPerCorner(radius)) return radius;

  const value = radius ?? 0;
  return { topLeft: value, topRight: value, bottomRight: value, bottomLeft: value };
}

/**
 * 개별 → 전체로 전환할 때 쓴다.
 *
 * 네 값이 다를 때는 좌상단을 택한다. 가장 큰 값을 쓰면 다른 모서리가 커지면서
 * 모양이 눈에 띄게 달라지고, 0을 쓰면 반경이 통째로 사라진다. 좌상단은 읽는
 * 순서상 첫 칸이라 사용자가 방금 본 값이다.
 */
export function toUniform(radius: Radius | undefined): number {
  if (radius === undefined) return 0;
  return isPerCorner(radius) ? radius.topLeft : radius;
}

/**
 * 모서리 하나만 바꾼 완전한 객체를 만든다.
 *
 * borderPatch.mergeBorder·shadowPatch.mergeShadow와 같은 이유다 — 스키마가 네 칸을
 * 모두 필수로 두고 있어, 한 칸만 점 표기 경로로 써넣으면 반쪽 객체가 만들어져
 * 스펙이 무효가 되고 CSS border-radius도 통째로 깨진다.
 */
export function mergeCornerRadius(
  current: Radius | undefined,
  patch: Partial<CornerRadius>,
): CornerRadius {
  return { ...toPerCorner(current), ...patch };
}
