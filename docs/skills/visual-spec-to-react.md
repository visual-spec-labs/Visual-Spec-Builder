# visual-spec-to-react — 설명

`skills/visual-spec-to-react/SKILL.md`는 에이전트가 실행 시 참조하는 지시문이다.
사람이 이 스킬이 뭘 하는지 파악하려면 이 문서를 본다. (사람이 보는 설명 문서는 스킬 폴더가
아니라 `docs/skills/`에 따로 둔다.)

## 이 스킬이 하는 일

Visual Spec JSON(`version`, `screen.root`, `screen.nodes` 구조)을 읽어 React(TSX) + Tailwind
코드를 직접 작성한다. JSON을 코드로 바꿔주는 별도의 변환 함수는 없다 — `SKILL.md`의 매핑
참고표를 보고 에이전트가 매번 새로 코드를 쓴다. 배경은
`docs/01-overview.md`의 전체 흐름 중 "AI Agent가 실제 React 코드 생성" 단계다.

## 언제 실행되는가

`skills/visual-spec-to-react/SKILL.md`의 `description`에 적힌 조건과 매칭될 때
자동으로 붙거나, 사용자가 직접 이름을 불러 실행한다.

- "이 Visual Spec으로 화면 만들어줘"
- "이 JSON을 React 컴포넌트로 변환해줘"
- "이 JSON들 한번에 변환해줘", "examples 폴더에 있는 스펙 다 코드로 만들어줘"
- 대화나 첨부 파일에 Visual Spec 형태의 JSON이 있을 때

## 어떻게 쓰는가

1. Visual Spec JSON 파일을 대화에 준다 (경로 또는 첨부). 여러 개를 한 번에 줘도 된다.
2. 위 표현 중 하나로 변환을 요청한다.
3. `validateVisualSpec` 검증을 통과하면 TSX 코드가 나온다. 실패하면 어떤 필드가 문제인지
   먼저 알려주고 멈춘다.
4. 대상 프로젝트를 분석하거나 위치를 묻지 않는다 — 항상 고정 워크스페이스 경로
   (`.visual-spec/generated/pages/`, 분리된 컴포넌트는
   `.visual-spec/generated/components/`)에 쓴다. Visual Spec Builder는 라이브러리로
   설치돼 프로젝트마다 폴더 구조가 다르므로, 도구가 정한 경로를 쓰는 게 유일하게
   일반화되는 방식이다.

### 화면이 여러 컴포넌트로 쪼개질 때

화면 하나를 항상 파일 하나로 만들지는 않는다. root의 직계 자식(Header, Content 등)은
각각 별도 컴포넌트가 되고, 그 안에서 구조가 똑같이 반복되는 형제(카드 3개 등)가 있으면
그 반복 단위를 props를 받는 공용 컴포넌트로 뽑는다. 스키마엔 "컴포넌트"·"props" 개념이
없으므로(v0.1 제외 범위) 이건 코드 생성 시점의 판단이다. `@/` 별칭은 쓰지 않고 상대
경로로만 서로 import한다 — 어느 프로젝트에 export해도 그대로 동작해야 하기 때문이다.
자식 컴포넌트를 부모보다 먼저 만들고, 만들 때마다 진행 상황을 짧게 보고한다.

### 여러 화면을 한 번에 줬을 때

파일 하나씩 처리할 때와 다르게 동작하는 게 하나 있다 — 하나가 검증에 실패해도 나머지는
계속 변환한다. 실패한 파일만 표시로 남긴다. (위치는 4번과 같이 항상 고정이라 배치라고
따로 확인할 게 없다.)

끝나면 파일별로 성공/실패를 표로 보고한다. 표는 요약일 뿐이고, 실패한 파일의 `issues`
전체는 표 아래에 그대로 딸려 나온다 — 단일 파일 처리 때와 마찬가지로 원인을 감추지 않는다.

### 이미 생성한 파일을 다시 만들 때

[visual-spec-authoring](./visual-spec-authoring.md)이 후속 피드백("버튼 색 바꿔줘" 등)을
반영해 원본 스펙 JSON을 고치고 넘어온 경우다. 같은 스펙은 항상 같은 경로에 쓰이므로
원래 파일을 그대로 덮어쓴다. 결과는 새 코드 전체가 아니라 무엇이 바뀌었는지 diff로
요약해 보고한다.

## 이 스킬이 하지 않는 것

- 결정론적 변환(항상 같은 입력 → 같은 출력이 코드 레벨로 보장되지는 않는다. 에이전트가
  매번 판단해서 쓴다)
- 대상 프로젝트 폴더 구조 분석 (독립 작업공간 원칙상 필요하지 않다 — 항상 고정 경로에 쓴다)
- 검증 실패 시 자동 수정 → [visual-spec-validate](./visual-spec-validate.md)가 `issues` 해석을 맡는다
- Spec JSON 자체를 쓰거나 고치기, 피드백을 JSON 변경으로 해석하기 →
  [visual-spec-authoring](./visual-spec-authoring.md)이 맡는다. 이 스킬은 이미 고쳐진
  JSON을 받아 재생성만 한다

## 매핑에서 한 번 걸리는 곳 — `border.align`과 `shadow`

두 필드가 **`box-shadow` 한 칸을 공유한다.** 따로 쓰면 나중 것이 앞을 통째로 덮어쓰므로,
`SKILL.md`는 한 `shadow-[...]` 안에 쉼표로 합치고 테두리 고리를 앞에 적도록 정해뒀다.

`border.align`이 `outside`/`center`일 때는 `border-*`를 쓰지 않는다. `outline-*`도 쓰지
않는다 — 브라우저 포커스 링과 겹친다. 캔버스(`canvasLayout.strokeAndShadowStyle`)가 같은
이유로 같은 선택을 하고 있어, 캔버스와 생성 코드가 같은 모양을 낸다.

세부 매핑 규칙과 실행 순서는 `skills/visual-spec-to-react/SKILL.md` 본문을 본다.
설계 배경은 `docs/superpowers/specs/2026-08-11-visual-spec-to-react-codegen-design.md`에 있다.

어느 스킬로 가야 할지 모르겠으면 [visual-spec](./visual-spec.md) 허브로 돌아간다.
앞으로 만들 스킬 체크리스트는 [visual-spec 허브 문서](./visual-spec.md)에 있다.
