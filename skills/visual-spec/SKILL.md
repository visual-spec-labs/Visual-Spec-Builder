---
name: visual-spec
description: Visual Spec Builder 관련 요청인 것은 분명한데 어느 작업인지 아직 갈리지 않았을 때 실행한다. "Visual Spec 좀 봐줘", "스펙 JSON 관련해서 물어볼 게 있어", "이 라이브러리 어떻게 쓰는 거야", "화면 스펙 작업 하자", "visual-spec 이거 뭐야"처럼 대상이 Visual Spec·Spec JSON·visual-spec.schema.json·.visual-spec/specs 라는 것만 정해지고 작성인지 검증인지 코드 생성인지 문서 조회인지 정해지지 않은 요청에서 쓴다. 절차나 스키마 지식은 담고 있지 않고 맞는 스킬로 넘기는 분기표다.
---

# Visual Spec 스킬 분기표

Visual Spec Builder 작업의 진입점이다. 여기에는 절차도 스키마 지식도 없다.
아래에서 지금 상황에 맞는 줄을 골라 그 스킬을 연다.

| 지금 상황 | 열 스킬 |
|---|---|
| Visual Spec JSON을 새로 쓰거나 고쳐야 한다 | [visual-spec-authoring](../visual-spec-authoring/SKILL.md) |
| 이미 코드로 만든 화면에 "버튼 색 바꿔줘" 같은 후속 피드백이 왔다 | [visual-spec-authoring](../visual-spec-authoring/SKILL.md) (JSON을 고친 뒤 [visual-spec-to-react](../visual-spec-to-react/SKILL.md)로 재생성) |
| 검증이 실패했고 `issues`를 해석해 고쳐야 한다 | [visual-spec-validate](../visual-spec-validate/SKILL.md) |
| Spec을 React/Tailwind 코드로 구현해야 한다 | [visual-spec-to-react](../visual-spec-to-react/SKILL.md) |
| 스키마 계약·용어·문서 원문을 찾아봐야 한다 | [visual-spec-docs](../visual-spec-docs/SKILL.md) |
| 편집기 GUI를 켜 달라("Visual Spec 켜줘", "편집기 열어줘") | 아래 "GUI 켜기" 절 |
| GUI가 `.visual-spec/runtime/nl-request.json`을 써 뒀다(자연어 입력창 요청에 Command로 응답해야 한다) | [visual-spec-nl-response](../visual-spec-nl-response/SKILL.md) |

| GUI가 `.visual-spec/runtime/ticket-request.json`을 써 뒀다(구현 티켓 파일을 만들고 결과를 응답해야 한다) | [visual-spec-ticket-response](../visual-spec-ticket-response/SKILL.md) |

두 줄 이상 걸리면 통상 순서는 이렇다.
작성 → 검증 → 코드 생성. 코드는 대상 프로젝트를 분석하지 않고 항상 고정 워크스페이스
경로(`.visual-spec/generated/`)에 쓴다 — 프로젝트 분석 단계 자체가 없다.

## GUI 켜기

이 기기의 정확한 명령은 이 스킬 폴더의 `contract/LOCAL.md`에 있다(설치된 CLI의 경로). 없으면
`contract/README.md` "CLI 실행" 절을 따른다. 사용자 프로젝트 폴더(`.visual-spec/`이 있거나 만들 곳)에서 실행한다.

- GUI는 끝나지 않는 개발 서버다. **백그라운드로 띄우고**, 출력에 나온 `http://localhost:…` 주소를
  사용자에게 알려 준다. 기다리느라 대화를 막지 않는다.
- 이미 떠 있으면 새로 띄우지 않는다. 같은 작업공간을 두 번 띄우면 포트만 늘어난다.
- `.visual-spec/`이 없으면 먼저 `init`을 실행한다.
- 에이전트를 자동 실행하지 않는다 — GUI의 자연어 입력창 요청은 사용자가 이 대화로 다시 가져온다
  ([visual-spec-nl-response](../visual-spec-nl-response/SKILL.md)).

## 구현 상태는 이 문서가 아니라 07을 본다

이 절이 한동안 "CLI·Command Engine(자연어 명령)·Export·GUI의 화면 생성·편집은 아직
구현되지 않았다"고 적어 뒀는데 전부 낡았다 — CLI(이슈 #42·#104·#105), Command Engine과
GUI를 통한 자연어 편집·화면 생성(이슈 #73·#40·#154·#155·#183), Export(이슈 #157)가
2026-09-28 기준 전부 구현돼 있다. 구현 상태를 여기 다시 나열하지 않는다 — 매번 낡는다.
최신 상태는 `docs/07-implementation-status.md`를 확인한다. 이 문서는 로컬 계약에 없다 —
저장소 안이면 파일로 읽고, 사용자 프로젝트면 [visual-spec-docs](../visual-spec-docs/SKILL.md)의
GitHub 원문 절차로 읽되 설치한 패키지보다 새 내용일 수 있음을 함께 말한다.
스키마·검증·예제는 이 스킬 폴더의 `contract/`(설치한 패키지와 같은 버전)에 있다.
