/**
 * 텍스트를 OS 클립보드에 복사한다(#283).
 *
 * `navigator.clipboard`는 보안 컨텍스트(https 또는 localhost)에서만 있고,
 * 권한이 거부될 수도 있다 — 둘 다 예외를 던지는 대신 `false`를 돌려준다.
 * 호출부가 "복사됨"/"복사 실패"를 잠깐 보여주고 되돌리는 식으로 쓴다
 * (이 함수는 그 타이머를 갖지 않는다 — 순수하게 복사만 한다).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || navigator.clipboard === undefined) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
