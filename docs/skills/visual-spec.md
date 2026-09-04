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

여러 줄에 걸리면 통상 순서는 작성 → 검증 → 코드 생성이다. 코드는 대상 프로젝트를
분석하지 않고 항상 고정 워크스페이스 경로(`.visual-spec/generated/`)에 쓴다 —
Visual Spec Builder가 라이브러리로 설치돼 프로젝트마다 다른 구조에서 쓰이기 때문이다.

## 이 스킬이 하지 않는 것

- 실제 작업 (스펙 작성·검증·코드 생성은 전부 다른 스킬이 맡는다)
- 스키마 지식 제공 → [visual-spec-docs](./visual-spec-docs.md)가 맡는다
- 미구현 기능 안내. CLI(`npx visual-spec`), Command Engine, Export, GUI의 화면 생성·편집은
  아직 없다. 이 기능들의 사용법을 물으면 미구현이라고 답한다

## 연결된 스킬

- [visual-spec-authoring](./visual-spec-authoring.md) — Spec JSON을 쓰거나 고친다
- [visual-spec-validate](./visual-spec-validate.md) — 검증 실패를 해석한다
- [visual-spec-to-react](./visual-spec-to-react.md) — Spec을 React 코드로 옮긴다
- [visual-spec-docs](./visual-spec-docs.md) — 스키마·문서 원문을 찾는다

분기표와 세부 조건은 `skills/visual-spec/SKILL.md` 본문을 본다.

---

## 스킬 로드맵 — 앞으로 만들어야 할 스킬 체크리스트

**초안이다.** 팀이 합의한 최종 목록이 아니다. `PRD 1차`, `Visual Spec Builder MVP` 문서,
`component-architecture.md`(`vsb-*` 패키지 분해)를 근거로 정리했다. 순서·우선순위·
포함 여부는 팀이 정한다.

- [x] **[visual-spec-to-react](./visual-spec-to-react.md)** — Visual Spec JSON을
      React(TSX) + Tailwind 코드로 변환한다.
- [x] **[Visual Spec 검증 실패 안내](./visual-spec-validate.md)** — `validateVisualSpec`이 낸
      `issues`를 사람이 이해하기 쉬운 말로 바꿔주고, 어떤 값을 어떻게 고치면 되는지 짚어준다.
- [x] **[visual-spec](./visual-spec.md)** — 어느 작업인지 아직 갈리지 않은 요청을 받아
      맞는 스킬로 넘기는 허브. 오진입해도 여기로 돌아와 재라우팅된다.
- [x] **[visual-spec-docs](./visual-spec-docs.md)** — 스키마 계약·범위·설계 근거의 원문
      위치를 알려준다. 지식을 복붙해두지 않고 찾는 경로만 준다.
- [x] **[visual-spec-authoring](./visual-spec-authoring.md)** — Visual Spec JSON을 새로 쓰거나
      고친다. v0.1은 `frame`, `text`, `image` 셋만 지원한다.
- [x] **생성된 코드 수정 반영** — [visual-spec-authoring](./visual-spec-authoring.md)(JSON
      수정)과 [visual-spec-to-react](./visual-spec-to-react.md)(재생성)의 연결로 처리했다.
- [x] **여러 화면 일괄 변환** — [visual-spec-to-react](./visual-spec-to-react.md)의 배치
      처리 절로 흡수됐다.
- [x] ~~**analyze-target-project**~~ — 대상 프로젝트 폴더 구조를 분석해 생성 위치를
      추론하는 스킬이었다. "독립 작업공간" 원칙(생성 코드는 항상 고정 경로에 쓰고, 대상
      프로젝트 구조를 분석하지 않는다)과 어긋나 제거했다 (#33).
- [x] **고정 워크스페이스 경로 전환** — `visual-spec-to-react`가 대상 프로젝트를 묻지 않고
      항상 `.visual-spec/generated/`에 쓰도록 바꿨다 (#33).
- [x] **Ticket Compiler / 컴포넌트별 파일 분리 생성 + 상대 경로 import 규칙** —
      `visual-spec-to-react`에 "컴포넌트 단위로 분리 생성한다" 절을 추가했다 (#35).
      root의 직계 자식을 컴포넌트 후보로 보고, 구조가 반복되는 형제는 props를 받는
      공용 컴포넌트로 뽑는다(스키마엔 없는 개념이라 코드 생성 시점의 판단). 자식을
      부모보다 먼저 만들고, `@/` 대신 상대 경로로만 import한다. `component-architecture.md`의
      `vsb-ticket-compiler`를 근거로 삼았다. 이 규칙을 `src/features/editor/ticket/`에
      순수 함수(`compileTickets` — 반복 형제 그룹화, 의존성 순서, 최소 상태 관리)로도
      옮겼다(#74) — 스킬 지시문과 코드가 같은 규칙을 따르는지 테스트로 고정된다.
- [x] **Button/Input 노드 타입 + Grid 레이아웃 스킬 반영** — v0.1 스키마에 `button`·`input`
      노드와 `layout.direction: "grid"`가 추가되면서(#75) `visual-spec-authoring`·
      `visual-spec-to-react`·`visual-spec-validate` 세 스킬을 갱신했다. `oneOf` 갈래가
      셋에서 다섯으로 늘어난 만큼 `visual-spec-validate`의 잡음-걷어내기 규칙(갈래별
      이슈 개수, 예제 실측치)도 다시 셌다 — #70/#71(image)이 세운 선례를 그대로 따랐다.
- [ ] **기존 컴포넌트 재사용 감지** — 대상 프로젝트에 이미 있는 컴포넌트를 찾아 새로 만들지
      않고 재사용하도록 판단한다. (원래 설계 문서 §1에서 범위 밖으로 뺀 항목. "독립
      작업공간" 원칙과도 긴장 관계라 재검토 필요)
- [ ] **[막힘] Command 기반 편집으로 전환** — `visual-spec-authoring`은 지금 JSON을 텍스트로
      직접 고친다. PRD 16장 원칙("GUI와 자연어는 동일한 Command Engine API만 호출한다")과
      어긋나는 임시방편이다. `command.schema.ts`(다른 트랙, Command Engine)가 나와야
      제대로 고칠 수 있다.

새 스킬을 추가하면 이 목록에서 체크하고, 필요하면 `docs/skills/<이름>.md`로 같은 형식을
이어간다.
