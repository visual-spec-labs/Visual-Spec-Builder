import type { Background } from "@/features/editor/schema";

/**
 * 지금 패널이 다룰 수 있는 배경인가 — 겹이 없거나 solid 한 겹(#127 스키마 전환 단계).
 *
 * `background`는 0.3에서 채우기 겹 배열이 됐지만 패널은 아직 색 칸 하나다. 겹 목록
 * 편집(추가·삭제·이동, linear 각도·stop)은 다음 단계라, 그 전에는 0.2까지 편집할
 * 수 있던 모양 — 배경 없음 또는 단색 하나 — 만 연다. linear 겹이나 여러 겹을 색 칸
 * 하나로 덮어쓰면 손으로 쓴 그라디언트가 말없이 사라지므로 편집을 막는다.
 */
export type SolidBackgroundView =
  | { editable: true; color: string | undefined }
  | { editable: false };

export function solidBackgroundView(
  background: Background | undefined,
): SolidBackgroundView {
  if (background === undefined || background.length === 0) {
    return { editable: true, color: undefined };
  }

  const [only] = background;
  if (background.length === 1 && only.type === "solid") {
    return { editable: true, color: only.color };
  }

  return { editable: false };
}

/**
 * 색 칸의 커밋을 완전한 `background` 배열로 만든다. 배열은 점 표기 경로로
 * 한 칸만 쓸 수 없어(`background.0.color`는 editablePath가 거부한다) 통째로 쓴다 —
 * borderPatch·shadowPatch가 객체를 통째로 만드는 것과 같은 이유다.
 *
 * 색이 그대로면 **받은 배열을 그대로 돌려준다**(같은 참조). 호출부가 참조 비교로
 * 커밋을 건너뛰게 하려는 것이다 — 같은 값 쓰기가 빈 undo 단계를 쌓지 않게 하는
 * #209의 가드를 배열 커밋에서도 지킨다(unchangedCommit.ts 참고).
 *
 * 편집할 수 없는 배경(`solidBackgroundView`가 false)에는 부르지 않는다.
 */
export function solidBackgroundPatch(
  current: Background | undefined,
  color: string,
): Background {
  const view = solidBackgroundView(current);
  if (current !== undefined && view.editable && view.color === color) {
    return current;
  }
  return [{ type: "solid", color }];
}
