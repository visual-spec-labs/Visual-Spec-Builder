# visual-spec — 설명

`skills/visual-spec/SKILL.md`는 에이전트가 실행 시 참조하는 지시문이다.
사람이 이 스킬이 뭘 하는지 파악하려면 이 문서를 본다.

## 이 스킬이 하는 일

Visual Spec Builder 작업의 진입점이다. 절차도 스키마 지식도 담지 않고, 지금 상황에 맞는
스킬로 넘기는 분기표만 갖고 있다.

분기표 자체는 `skills/visual-spec/SKILL.md` 본문에 있다. 여기에 옮겨 적지 않는다 —
두 곳에 두면 한쪽이 먼저 낡는다.

허브가 따로 필요한 이유는 두 가지다.

**진입 시점에는 작업이 갈리지 않는다.** "화면 스펙 작업 하자"는 요청은 대상이
Visual Spec이라는 것만 알려줄 뿐, 작성인지 검증인지 코드 생성인지 문서 조회인지를
말해주지 않는다. 이때 아무 스킬이나 열면 틀린 절차를 밟는다.

**오진입이 회복된다.** 나머지 5개 스킬은 본문 첫 줄에 "이 스킬이 지금 상황에 맞지 않으면
허브를 대신 연다"는 역참조를 갖고 있다. 그래서 처음에 잘못 걸려도 막다른 길이 되지 않고
허브로 돌아와 다시 라우팅된다. 트리거가 완벽할 수 없다는 전제 위에 세운 구조다.

## 언제 실행되는가

`skills/visual-spec/SKILL.md`의 `description`에 적힌 조건과 매칭될 때 자동으로 붙거나,
사용자가 직접 이름을 불러 실행한다.

- "Visual Spec 좀 봐줘"
- "이 라이브러리 어떻게 쓰는 거야"
- "화면 스펙 작업 하자"
- 대상이 Visual Spec·Spec JSON이라는 것만 정해지고 어느 작업인지 아직 갈리지 않았을 때

## 어떻게 쓰는가

1. 하려는 일이 어느 스킬인지 모르겠으면 그냥 요청한다. 사용자가 스킬 이름을 알 필요는 없다.
2. 에이전트가 분기표에서 맞는 줄을 골라 그 스킬을 연다.
3. 열린 스킬이 상황에 맞지 않으면 다시 허브로 돌아와 재라우팅된다.

여러 줄에 걸리면 통상 순서는 작성 → 검증 → 대상 프로젝트 분석 → 코드 생성이다.

## 이 스킬이 하지 않는 것

- 실제 작업 (스펙 작성·검증·코드 생성은 전부 다른 스킬이 맡는다)
- 스키마 지식 제공 → [visual-spec-docs](./visual-spec-docs.md)가 맡는다
- 미구현 기능 안내. CLI(`npx visual-spec`), Command Engine, Export, GUI의 화면 생성·편집은
  아직 없다. 이 기능들의 사용법을 물으면 미구현이라고 답한다

## 연결된 스킬

- [visual-spec-authoring](./visual-spec-authoring.md) — Spec JSON을 쓰거나 고친다
- [visual-spec-validate](./visual-spec-validate.md) — 검증 실패를 해석한다
- [visual-spec-to-react](./visual-spec-to-react.md) — Spec을 React 코드로 옮긴다
- [analyze-target-project](./analyze-target-project.md) — 대상 프로젝트 관례를 파악한다
- [visual-spec-docs](./visual-spec-docs.md) — 스키마·문서 원문을 찾는다

분기표와 세부 조건은 `skills/visual-spec/SKILL.md` 본문을 본다.
