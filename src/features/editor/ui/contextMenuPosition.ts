/**
 * 컨텍스트 메뉴가 뷰포트를 벗어나지 않게 좌표를 접는다(#152).
 *
 * 커서 좌표에 그대로 띄우면 화면 오른쪽·아래 끝 근처에서 메뉴가 잘린다.
 * 메뉴 크기는 실제로 그려 봐야 알 수 있으므로(내용에 따라 다르다), 먼저
 * 커서 좌표로 그린 뒤 `getBoundingClientRect()`로 잰 크기를 이 함수에 넣어
 * 넘치는 방향으로만 뒤집는다 — canvasZoom.ts가 확대 뒤 스크롤을 다시 재서
 * 맞추는 것과 같은 "먼저 그리고 나서 재서 고친다" 방식이다.
 */
export function clampToViewport(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  const left = x + menuWidth > viewportWidth ? Math.max(0, x - menuWidth) : x;
  const top = y + menuHeight > viewportHeight ? Math.max(0, y - menuHeight) : y;
  return { left, top };
}
