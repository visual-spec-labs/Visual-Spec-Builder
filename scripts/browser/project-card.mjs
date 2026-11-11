// 홈 프로젝트 카드를 이름 글자 그대로 찾는다(PR #358 리뷰). 이름을 정규식 원문으로 쓰지 않는다.
// `Design (v2`는 정규식 오류, `A.B`·`A*B`는 다른 카드와 맞을 수 있었다.

/** 정규식 특수문자를 글자로 만든다. */
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 프로젝트 이름(spec.name)이 정확히 `name`인 홈 카드 버튼 하나를 연다.
 * 카드 제목 줄(HomeScreen.tsx ProjectCard의 첫 <p>)만 본다 — 미리보기에 그려진 글자는 비교하지 않는다.
 * 맞는 카드가 없거나 여러 개면 실패한다(first()로 임의의 카드를 고르지 않는다).
 */
export async function openProjectCard(page, name, { timeout = 20000 } = {}) {
  const title = page.locator(":scope > div > p:first-child", { hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`) });
  const cards = page.getByRole("button").filter({ has: title });
  await cards.first().waitFor({ timeout }).catch(() => {
    throw new Error(`이름이 정확히 ${JSON.stringify(name)}인 프로젝트 카드가 없습니다.`);
  });
  const count = await cards.count();
  if (count !== 1) throw new Error(`이름이 정확히 ${JSON.stringify(name)}인 프로젝트 카드가 ${count}개라 하나를 고를 수 없습니다.`);
  await cards.click();
}
