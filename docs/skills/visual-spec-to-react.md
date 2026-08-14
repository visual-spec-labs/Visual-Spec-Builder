# visual-spec-to-react — 설명

`.claude/skills/visual-spec-to-react/SKILL.md`는 에이전트가 실행 시 참조하는 지시문이다.
사람이 이 스킬이 뭘 하는지 파악하려면 이 문서를 본다. (`SKILL.md`는 `.gitignore`의
`.claude/` 규칙 이전부터 추적되던 예외 파일이라, 사람이 보는 설명 문서는 이 위치에 따로 둔다.)

## 이 스킬이 하는 일

Visual Spec JSON(`version`, `screen.root`, `screen.nodes` 구조)을 읽어 React(TSX) + Tailwind
코드를 직접 작성한다. JSON을 코드로 바꿔주는 별도의 변환 함수는 없다 — `SKILL.md`의 매핑
참고표를 보고 에이전트가 매번 새로 코드를 쓴다. 배경은
`docs/PROJECT_OVERVIEW.md`의 전체 흐름 중 "AI Agent가 실제 React 코드 생성" 단계다.

## 언제 실행되는가

`.claude/skills/visual-spec-to-react/SKILL.md`의 `description`에 적힌 조건과 매칭될 때
자동으로 붙거나, 사용자가 직접 이름을 불러 실행한다.

- "이 Visual Spec으로 화면 만들어줘"
- "이 JSON을 React 컴포넌트로 변환해줘"
- 대화나 첨부 파일에 Visual Spec 형태의 JSON이 있을 때

## 어떻게 쓰는가

1. Visual Spec JSON 파일을 대화에 준다 (경로 또는 첨부).
2. 위 표현 중 하나로 변환을 요청한다.
3. `validateVisualSpec` 검증을 통과하면 TSX 코드가 나온다. 실패하면 어떤 필드가 문제인지
   먼저 알려주고 멈춘다.
4. 대상 프로젝트 어디에 파일을 둘지 물어보면 답한다.

## 이 스킬이 하지 않는 것

- 결정론적 변환(항상 같은 입력 → 같은 출력이 코드 레벨로 보장되지는 않는다. 에이전트가
  매번 판단해서 쓴다)
- 대상 프로젝트 폴더 구조 자동 추론 (아래 로드맵 "대상 프로젝트 컨벤션 분석" 항목)
- 검증 실패 시 자동 수정
- 생성 후 코드 수정 반영

세부 매핑 규칙과 실행 순서는 `.claude/skills/visual-spec-to-react/SKILL.md` 본문을 본다.
설계 배경은 `docs/superpowers/specs/2026-08-11-visual-spec-to-react-codegen-design.md`에 있다.

---

## 스킬 로드맵 — 앞으로 만들어야 할 스킬 체크리스트

**초안이다.** `docs/PROJECT_OVERVIEW.md`의 전체 흐름을 기준으로 아직 스킬이 없는 구간을
뽑아본 것이지 팀이 합의한 목록이 아니다. 순서·우선순위·포함 여부는 팀이 정한다.

- [x] **Visual Spec → React 코드 생성** (`visual-spec-to-react`, 이 스킬) — JSON을 React/Tailwind
      코드로 변환한다.
- [ ] **대상 프로젝트 컨벤션 분석** — 대상 React 프로젝트의 폴더 구조, 라우팅 방식, 기존
      Tailwind 설정을 파악해 `visual-spec-to-react`가 파일 위치를 매번 묻지 않고 추론하게
      한다. (SKILL.md의 "파일 위치를 사용자에게 확인한다" 단계와 맞물림)
- [ ] **Visual Spec 검증 실패 안내** — `validateVisualSpec`이 낸 `issues`를 사람이 이해하기
      쉬운 말로 바꿔주고, 가능하면 어떤 값을 어떻게 고치면 되는지 짚어준다. 지금은 원본
      `issues` 배열을 그대로 보여주고 멈추기만 한다.
- [ ] **생성된 코드 수정 반영** — "결과 화면 확인" 이후 "버튼 색 바꿔줘" 같은 자연어 피드백을
      받아 Visual Spec 또는 이미 생성된 코드를 갱신한다. 현재는 처음 변환만 다룬다.
- [ ] **여러 화면 일괄 변환** — Visual Spec JSON 여러 개를 한 번에 코드로 변환한다. 지금은
      한 번에 하나씩만 처리한다.
- [ ] **기존 컴포넌트 재사용 감지** — 대상 프로젝트에 이미 있는 컴포넌트를 찾아 새로 만들지
      않고 재사용하도록 판단한다. (설계 문서 §1에서 명시적으로 범위 밖으로 뺀 항목)

새 스킬을 추가하면 이 목록에서 체크하고, 필요하면 `docs/skills/<이름>.md`로 같은 형식을
이어간다.
