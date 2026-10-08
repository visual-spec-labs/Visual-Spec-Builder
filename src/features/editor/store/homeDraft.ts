/**
 * 홈 화면의 자연어 초안 작성 패널 ↔ 에디터 전용 전달 통로(#286).
 *
 * 모듈 바깥 상태가 필요한 이유는 `navigationStore.ts`와 같다 — `App.tsx`가
 * `screen === "home" ? <HomeScreen/> : <EditorLayout/>`로 두 화면을 완전히
 * 다른 서브트리로 마운트/언마운트하므로, 홈에서 입력한 문구를 React
 * props/context로 에디터에 넘길 자리가 없다.
 *
 * zustand `create()`를 쓰지 않는다 — 두 호출부(`HomeScreen.tsx`·
 * `NaturalLanguageBar.tsx`) 모두 반응형 훅(`useXxxStore(selector)`)이 아니라
 * `getState()`류의 명령형 접근만 쓴다(자체 code-review 대응). 리렌더를 구독할
 * 곳이 없으면 zustand의 구독 장치는 간접 비용만 더한다 — `ticketRunner.ts`의
 * 모듈 스코프 `activeCancel`과 같은 자리의 상태다.
 *
 * `draft`를 "쓰고 한 번 읽으면 사라지는" 값으로 둔다 — `consumeHomeDraft`가
 * 읽으면서 바로 비운다. 비우지 않으면 사용자가 에디터 ↔ 홈을 오갈 때마다 같은
 * 옛 문구가 `NaturalLanguageBar`에 계속 다시 채워진다.
 */
let draft: string | null = null;

export function setHomeDraft(text: string): void {
  draft = text;
}

/** 값을 돌려주면서 비운다. 없으면 `null`. */
export function consumeHomeDraft(): string | null {
  const value = draft;
  draft = null;
  return value;
}
