import { composeColor } from "./colorValue";

/**
 * 입력칸의 커밋이 스펙 값을 그대로 두는지 판단한다(#209).
 *
 * `useDraftInput`은 파싱이 성공하면 키 입력마다 커밋하는데, 값이 그대로인
 * 입력(간격 16 칸 맨 앞에 "0"을 넣은 "016" 등)까지 커밋하면 두 가지가 생긴다.
 * - 스토어는 같은 값 쓰기도 새 단계로 쌓는다(`setByPath`가 늘 새 객체를 만들어
 *   `pushHistory`의 같은-참조 검사를 통과한다) — 포커스를 빼고 Ctrl+Z를 누르면
 *   화면이 그대로인 빈 단계가 하나 되돌아간다.
 * - 입력칸의 burst는 그 커밋으로 이미 시작돼, 뒤따르는 입력이 `continueEdit:
 *   true`로 올라간다. 스토어가 그 커밋을 no-op으로 버리는 경우라면(값 비교로
 *   단계를 건너뛰게 바뀌는 등) 직전 *남의* 체크포인트를 덮어쓴다.
 * 그래서 값이 그대로면 커밋도 burst도 시작하지 않는다 — `TextField`(#132)의
 * `next === shown` 가드, `resizeGesture.ts`(#207)의 "직전 값과 같으면 커밋 안 함"과
 * 같은 생각이다.
 *
 * **비교 대상은 입력칸에 보이는 값이 아니라 스펙에 저장된 값이다.** 커밋이 실제로
 * 보낼 값을 만들어 저장된 값과 `Object.is`로 견준다 — "스토어에 보내도 스펙이
 * 안 바뀌는가"를 그대로 묻는 것이라, 둘이 어긋나는 경우는 전부 커밋하는 쪽(안전한
 * 쪽)으로 떨어진다. 보이는 값을 같은 경로로 왕복시켜(`parse(toDraft(value))`)
 * 비교하면 아래 세 곳에서 틀린다.
 * - SizeField의 Fill/Hug: 칸에는 실측 px가 보인다. 같은 숫자를 치는 것은
 *   Fill/Hug → Fixed **실제 변경**이다. 저장된 값은 "fill"/"auto"라 숫자와 다르다.
 * - ColorField의 hex 대소문자: 칸에는 늘 대문자로 보이지만 파일에서 온 값은
 *   소문자일 수 있다. `composeColor`가 대문자로 만들어 보내므로 저장값이 "#ff0000"이면
 *   "#FF0000"을 쳐도 스펙 문자열이 바뀐다 → 커밋한다. 저장값이 대문자면 사용자가
 *   "ff0000"처럼 소문자로 쳐도 보낼 값이 같다 → 커밋 안 한다.
 * - ColorField 불투명도의 반올림: "#FF000081"은 51%로 보이지만 51%를 다시 조립하면
 *   "#FF000082"다. 스펙이 바뀌므로 커밋한다.
 */

/** NumberField·SizeField — 보낼 숫자가 저장된 값과 같은가. SizeField는 `Size` 유니온을 그대로 넘긴다. */
export function isUnchangedNumber(next: number, current: unknown): boolean {
  return Object.is(next, current);
}

/** ColorField — hex·불투명도(%)로 조립할 색 문자열이 저장된 값과 같은가. */
export function isUnchangedColor(
  hex: string,
  opacity: number,
  current: string | undefined,
): boolean {
  return Object.is(composeColor(hex, opacity), current);
}
