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
- 대상 프로젝트 폴더 구조 자동 추론 → [analyze-target-project](./analyze-target-project.md)가 맡는다
- 검증 실패 시 자동 수정
- 생성 후 코드 수정 반영

세부 매핑 규칙과 실행 순서는 `.claude/skills/visual-spec-to-react/SKILL.md` 본문을 본다.
설계 배경은 `docs/superpowers/specs/2026-08-11-visual-spec-to-react-codegen-design.md`에 있다.

앞으로 만들 스킬 체크리스트는 [analyze-target-project 문서](./analyze-target-project.md)에 있다.
