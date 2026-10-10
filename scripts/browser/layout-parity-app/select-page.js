// main.jsx가 ?page=<이름>으로 app/pages/<이름>.tsx(또는 .jsx)를 고른다. 이름은 확장자를 뺀 파일 이름과
// 글자 그대로 같아야 한다. layout-parity.mjs는 여기에 스펙 표시 이름이 아니라 page 티켓의 componentName을 넘긴다.

/** import.meta.glob 결과(경로 → 불러오기 함수)에서 이름이 같은 페이지 하나를 고른다. 없으면 null. */
export function selectPageModule(pages, name) {
  return Object.entries(pages).find(([path]) => path.replace(/^.*\/|\.[jt]sx$/g, "") === name)?.[1] ?? null;
}
