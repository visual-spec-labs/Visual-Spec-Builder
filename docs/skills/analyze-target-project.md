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

앞으로 만들 스킬 전체 목록은 [스킬 카탈로그](./README.md)를 본다.
