# visual-spec-nl-response — 설명

`skills/visual-spec-nl-response/SKILL.md`는 에이전트가 실행 시 참조하는 지시문이다.
사람이 이 스킬이 뭘 하는지 파악하려면 이 문서를 본다.

## 이 스킬이 하는 일

Visual Spec Builder **GUI**(`npx visual-spec`)가 자연어 입력창(`NaturalLanguageBar`)에서
받은 요청을 `.visual-spec/runtime/nl-request.json`에 써 두면, 그걸 읽고 **Command 배열**을
`.visual-spec/runtime/nl-response.json`에 써서 답한다. 산출물은 스펙 JSON 문서 전체가 아니라
지금 화면(`ScreenSpec`)에 적용할 편집 명령 묶음이다 — GUI가 그걸 받아 검증(G1–G3, "관문 셋")을
거쳐 캔버스에 반영하고 Undo 한 단계로 묶는다(이슈 #155·#183).

이 경로가 왜 따로 있는지는 `docs/08-natural-language.md`가 설계 근거를 담고 있다 — 요약하면
GUI는 LLM을 직접 부르지 않고(앱이 API 키를 들고 있지 않다), 사람이 옆에 띄워 둔 에이전트가
그 자리를 대신한다. `.visual-spec/runtime/` 파일 교환이 GUI와 에이전트 사이의 유일한 통로다.

## `visual-spec-authoring`과 헷갈리지 않기

둘 다 "자연어로 화면을 만들거나 고친다"처럼 들리지만 다른 작업이다.

- **파일을 콕 집어** "이 JSON 고쳐줘", "새 스펙 파일 만들어줘"라고 하면
  → [visual-spec-authoring](./visual-spec-authoring.md) (산출물: 스펙 JSON 파일)
- **GUI가 `nl-request.json`을 이미 써 둔 상태**라면(사용자가 GUI 안에서 자연어 입력창에
  요청을 넣은 것) → 이 스킬 (산출물: Command 배열)

노드 타입 5종 제약, `layout`/`typography` 필드를 전부 채우는 규칙, 자주 틀리는 지점
(child-missing·orphan-node 등) 같은 **Visual Spec 자체의 지식은 이 스킬에 없다** —
`visual-spec-authoring`이 이미 갖고 있는 걸 그대로 참조한다. 이 스킬이 더하는 건 "그 지식을
Command 배열이라는 다른 그릇에 담는 법"이다.

## 왜 기본값 표가 있는가

`store/createNode.ts`(이슈 #182)가 앱 내부에서 노드 5종의 기본값을 부분 덮어쓰기로 채워
주지만, **그 함수는 이 경로를 안 탄다** — `nl-response.json`은 GUI가 실행 중인 브라우저
바깥, 다른 프로젝트에서 쓰일 수 있는 텍스트 파일이라 이 저장소의 TypeScript 함수를 부를 수
없다. 그래서 SKILL.md 본문에 그 함수와 같은 기본값을 **JSON으로 그대로 옮겨** 뒀다 — 매번
새로 디자인하지 않고 복사해서 채우게 하려는 것이다. "생략해도 되는 필드"가 아니라 "복사해서
쓸 값"이라는 차이를 SKILL.md가 명시한다 — 응답 JSON 자체는 여전히 완전한 `Node`여야
G1(Command 스키마 검사)을 통과한다.

## 언제 실행되는가

- `.visual-spec/runtime/nl-request.json` 파일이 있다는 것 자체가 트리거다
- "GUI에서 보낸 요청 처리해줘", "nl-request 봐줘"
- 사용자가 Visual Spec GUI를 띄워 두고 자연어 입력창에 이미 요청을 넣은 상황

## 어떻게 쓰는가

1. `nl-request.json`을 읽는다 — `scope`(대상)·`page`(현재 스펙 전체)를 특히 눈여겨본다
2. 요청을 Command 배열로 옮긴다. 새 노드가 필요하면 SKILL.md의 기본값 표에서 시작해 요청이
   말한 스타일로 바꾼다
3. `{ protocol, requestId, commands }`(또는 표현할 수 없으면 `error`)를 `responsePath`에 쓴다
4. 검증은 GUI가 한다 — 실패하면 입력창 옆에 이유가 뜨고 사용자가 다시 요청한다

## 이 스킬이 하지 않는 것

- Visual Spec 자체의 지식(뼈대·관용구·노드 타입 제약) → [visual-spec-authoring](./visual-spec-authoring.md)이 맡는다
- Command 배열의 검증 → GUI 코드(G1–G3)가 한다, 이 스킬이 다시 하지 않는다
- 새 **페이지** 생성, 비활성 페이지·전체 프로젝트 대상, 계획 미리보기·승인, 멀티턴 대화 맥락
  (`docs/08-natural-language.md` 7.2가 MVP에서 뺀 범위 — SKILL.md "표현할 수 없는 것" 참고)
- 스펙을 React 코드로 옮기는 것 → [visual-spec-to-react](./visual-spec-to-react.md)가 맡는다

Command 6종의 필드, 기본값 표, 예제는 `skills/visual-spec-nl-response/SKILL.md` 본문을 본다.
어느 스킬로 가야 할지 모르겠으면 [visual-spec](./visual-spec.md) 허브로 돌아간다.
