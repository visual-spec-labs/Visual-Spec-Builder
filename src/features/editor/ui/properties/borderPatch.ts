import type { Border, Radius } from "@/features/editor/schema";

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

/**
 * 이 border가 화면에 아무것도 그리지 않는가. 참이면 패널이 필드를 통째로 지운다.
 *
 * 효과 필드와 기준을 맞추기 위한 것이다 — 불투명도 100%·블러 0·그림자 끄기는
 * 이미 필드를 지운다(effectPatch). 아무 효과도 없는 값이 스펙에 남으면 export된
 * JSON에 따라다니고, 그걸 읽는 쪽(생성기·리뷰어·AI)이 의미 있는 지정으로 오해한다.
 *
 * **두께만 보면 안 된다.** 두께가 0이어도 반경은 여전히 일한다 — 배경과 그림자의
 * 모서리를 깎는다. `examples/card-effects.json`의 elevatedCard가
 * `{ width: 0, color: "#00000000", radius: 12 }`로 그림자만 둥글게 만드는 실제
 * 사례다. 두께로만 판정하면 그 카드의 모양이 깨진다.
 *
 * 색과 정렬은 보지 않는다. 두께가 0이면 그릴 선이 없어 둘 다 결과에 영향이 없다.
 * 다만 지울 때 함께 사라지므로, 두께를 0으로 내렸다 올리면 색은 기본값으로
 * 돌아온다 — 그림자 토글을 껐다 켤 때 값이 초기화되는 것과 같은 성질이다.
 */
export function isBlankBorder(border: Border | undefined): boolean {
  if (border === undefined) return true;
  if (border.width > 0) return false;
  return isZeroRadius(border.radius);
}

/** 네 모서리가 모두 0인가. 숫자 하나로 적힌 경우와 모서리별 객체를 함께 본다. */
function isZeroRadius(radius: Radius): boolean {
  if (typeof radius === "number") return radius === 0;

  return (
    radius.topLeft === 0 &&
    radius.topRight === 0 &&
    radius.bottomRight === 0 &&
    radius.bottomLeft === 0
  );
}
