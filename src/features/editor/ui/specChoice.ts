/**
 * File ▸ Open 에서 `.visual-spec/specs/` 목록 중 하나를 고르는 판단(순수 함수, DOM 없음
 * — 테스트 대상). 부수효과가 있는 prompt·fetch는 `openSpecFromFile.ts`에 남긴다.
 * `ui/canvasLayout.ts`·`ui/homePreview.ts`와 같은 자리다 — ui/ 아래지만 DOM을 모른다.
 */

/**
 * prompt에 적힌 답을 목록의 파일 이름으로 해석한다. 못 찾으면 null.
 *
 * 번호(`2`)와 이름(`home.json`) 둘 다 받는다. 목록을 번호와 함께 보여주는데 번호를
 * 안 받으면 긴 이름을 그대로 옮겨 적어야 하고, 이름만 받으면 목록을 세어야 한다.
 * `.json`은 붙이든 말든 통과시킨다 — Save as의 `resolveFilename`이 같은 편의를 준다.
 */
export function resolveSpecChoice(
  input: string,
  names: readonly string[],
): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed);
    return index >= 1 && index <= names.length ? names[index - 1] : null;
  }

  const wanted = trimmed.toLowerCase();
  return (
    names.find((name) => name.toLowerCase() === wanted) ??
    names.find((name) => name.toLowerCase() === `${wanted}.json`) ??
    null
  );
}
