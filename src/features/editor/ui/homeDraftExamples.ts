/**
 * 홈 화면 자연어 초안 패널의 예시 칩(#286). 클릭하면 `text`를 입력창에 그대로
 * 채운다 — 전송하지 않는다(`docs/21-home-screen-nl-draft.md` "결정" 참고).
 *
 * 첫 항목은 `examples/login-screen.json`·`docs/14-getting-started.md`가 이미
 * 쓰는 "로그인 화면" 설명과 결을 맞췄다 — 나중에 getting-started 문서를 봐도
 * 같은 종류의 화면을 가리킨다는 걸 알 수 있게 한다.
 */
export interface HomeDraftExample {
  label: string;
  text: string;
}

export const HOME_DRAFT_EXAMPLES: HomeDraftExample[] = [
  { label: "로그인 화면", text: "로그인 화면 — 이메일, 비밀번호 입력창과 로그인 버튼이 있는 화면" },
  { label: "대시보드", text: "대시보드 — 상단에 요약 카드 3개, 아래에 표가 있는 화면" },
  { label: "설정 화면", text: "설정 화면 — 좌측에 메뉴 목록, 우측에 토글 스위치 목록이 있는 화면" },
];
