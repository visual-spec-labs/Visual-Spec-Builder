# Skill 카탈로그 & 로드맵

이 저장소에서 만든 Skill 목록과, 앞으로 더 만들어야 할 Skill 체크리스트다.
개별 스킬의 자세한 설명은 각 링크를 따라간다. 실제 실행되는 지시문은
`.claude/skills/<이름>/SKILL.md`에 있다 (여기 문서는 사람이 읽는 설명일 뿐이다).

**초안이다.** `docs/PROJECT_OVERVIEW.md`의 전체 흐름을 기준으로 아직 스킬이 없는 구간을
뽑아본 것이지 팀이 합의한 최종 목록이 아니다. 순서·우선순위·포함 여부는 팀이 정한다.

- [x] **[visual-spec-to-react](./visual-spec-to-react.md)** — Visual Spec JSON을
      React(TSX) + Tailwind 코드로 변환한다.
- [x] **[analyze-target-project](./analyze-target-project.md)** — 대상 React 프로젝트의
      폴더 구조·라우팅·Tailwind 설정을 분석해 `visual-spec-to-react`가 파일 위치를 매번
      묻지 않게 돕는다.
- [ ] **Visual Spec 검증 실패 안내** — `validateVisualSpec`이 낸 `issues`를 사람이 이해하기
      쉬운 말로 바꿔주고, 가능하면 어떤 값을 어떻게 고치면 되는지 짚어준다. 지금은 원본
      `issues` 배열을 그대로 보여주고 멈추기만 한다.
- [ ] **생성된 코드 수정 반영** — "결과 화면 확인" 이후 "버튼 색 바꿔줘" 같은 자연어 피드백을
      받아 Visual Spec 또는 이미 생성된 코드를 갱신한다. 현재는 처음 변환만 다룬다.
- [ ] **여러 화면 일괄 변환** — Visual Spec JSON 여러 개를 한 번에 코드로 변환한다. 지금은
      한 번에 하나씩만 처리한다.
- [ ] **기존 컴포넌트 재사용 감지** — 대상 프로젝트에 이미 있는 컴포넌트를 찾아 새로 만들지
      않고 재사용하도록 판단한다. (설계 문서 §1에서 명시적으로 범위 밖으로 뺀 항목)

새 스킬을 추가하면: `.claude/skills/<이름>/SKILL.md`를 만들고, `docs/skills/<이름>.md`에
설명을 쓰고, 이 목록에서 체크한다.
