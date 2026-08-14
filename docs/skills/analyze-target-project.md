# analyze-target-project — 설명

`.claude/skills/analyze-target-project/SKILL.md`는 에이전트가 실행 시 참조하는 지시문이다.
사람이 이 스킬이 뭘 하는지 파악하려면 이 문서를 본다.

## 이 스킬이 하는 일

대상 React 프로젝트를 읽어 폴더 구조, 라우팅 방식, Tailwind 설정(커스텀 폰트/컬러),
컴포넌트 배치 관례를 요약한다. 분석 결과를 파일로 저장하지 않는다 — 대화 세션 안에서만
참고한다.

이 스킬을 만든 이유는 [visual-spec-to-react](./visual-spec-to-react.md)가 코드를 생성할 때마다
"파일을 어디에 둘지" 사용자에게 매번 묻기 때문이다. 먼저 프로젝트를 분석해두면 그 질문을
줄이고, 프로젝트에 이미 등록된 폰트가 있으면 `visual-spec-to-react`의 `fontFamily` 매핑도
더 정확해진다.

## 언제 실행되는가

- "이 프로젝트 구조 파악해줘"
- "컴포넌트 어디에 두는 프로젝트야?"
- `visual-spec-to-react`가 파일 위치를 판단해야 하는데 아직 프로젝트를 분석한 적이 없을 때
  (먼저 실행하는 게 자연스럽다)

## 어떻게 쓰는가

1. 분석할 대상 프로젝트 경로에서 실행을 요청한다.
2. `package.json`, `tsconfig`, `vite.config`/`next.config`, `tailwind.config`(또는 v4 `@theme`)를
   읽어 라우팅 방식·폴더 관례·Tailwind 커스텀 설정을 요약해 보여준다.
3. 이어서 `visual-spec-to-react`를 실행하면 이 요약을 참고해 파일 위치를 제안한다. 다만
   최종 확정은 여전히 사용자에게 확인받는다 — 자동으로 결정하지 않는다.

## 이 스킬이 하지 않는 것

- 분석 결과 캐싱/파일 저장 (매번 새로 분석한다)
- 파일 위치 자동 확정
- 프로젝트 코드/설정 자동 수정

세부 실행 순서는 `.claude/skills/analyze-target-project/SKILL.md` 본문을 본다.

---

## 스킬 로드맵 — 앞으로 만들어야 할 스킬 체크리스트

**초안이다.** `docs/PROJECT_OVERVIEW.md`의 전체 흐름을 기준으로 아직 스킬이 없는 구간을
뽑아본 것이지 팀이 합의한 목록이 아니다. 순서·우선순위·포함 여부는 팀이 정한다.

- [x] **[visual-spec-to-react](./visual-spec-to-react.md)** — Visual Spec JSON을
      React(TSX) + Tailwind 코드로 변환한다.
- [x] **analyze-target-project** (이 스킬) — 대상 React 프로젝트의 폴더 구조·라우팅·Tailwind
      설정을 분석해 `visual-spec-to-react`가 파일 위치를 매번 묻지 않게 돕는다.
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
