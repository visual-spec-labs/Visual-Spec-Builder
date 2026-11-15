/**
 * 불투명도·블러 칸의 입력을 스펙에 쓸 값으로 옮긴다.
 *
 * 항등값(불투명도 100%, 블러 0)이면 필드를 지운다(undefined). 아무 효과도 없는
 * 값이 스펙에 남으면 export된 JSON에 따라다니고, 그걸 읽는 쪽(생성기·리뷰어)이
 * 의미 있는 지정으로 오해한다. 그림자 토글을 끌 때 필드를 지우는 것과 같은 이유다.
 *
 * 순수 함수로 둔 이유는 이 레포에 jsdom이 없어 컴포넌트 렌더 테스트를 못 쓰기
 * 때문이다 — 패널 로직 중 검증 가능한 부분은 여기로 뺀다.
 */

/** 칸의 % 값(0..100)을 스키마의 0..1로 옮긴다. 100%는 지정 없음과 같다. */
export function opacityFromPercent(percent: number): number | undefined {
  return percent === 100 ? undefined : percent / 100;
}

/** 스키마의 0..1을 칸에 보여줄 %로 옮긴다. 값이 없으면 100%로 본다. */
export function percentFromOpacity(opacity: number | undefined): number {
  return opacity === undefined ? 100 : Math.round(opacity * 100);
}

/** 블러 0은 지정 없음과 같다 — CSS filter를 붙이지 않는 것과 결과가 같다. */
export function blurFromInput(value: number): number | undefined {
  return value === 0 ? undefined : value;
}
