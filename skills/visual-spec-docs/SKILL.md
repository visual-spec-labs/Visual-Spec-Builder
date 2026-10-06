---
name: visual-spec-docs
description: Visual Spec의 스키마 계약·용어·범위·설계 근거를 확인해야 할 때 실행한다. "Size에 fill 써도 돼?", "스키마 파일 어디 있어?", "v0.1에서 뭐가 빠졌지?", "이 필드 필수야?", "MVP 범위가 어디까지야?", "동결됐다던데 바꿔도 돼?", "문서 좀 찾아줘"처럼 스키마·범위·문서에 대한 질문이거나, 기억에 의존해 답하려다 현재 버전과 어긋날 위험이 있을 때 쓴다. 답 자체를 담고 있지 않고 정본 파일과 문서를 찾아 읽는 경로만 준다.
---

# Visual Spec 문서·스키마 찾기

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

이 스킬은 **답을 담지 않는다.** 스키마는 바뀌고, 복붙해둔 지식은 그때부터 틀린 것을 가르친다.
여기서는 원문이 어디 있는지만 알려준다. 답은 파일을 열어서 만든다.

## 정본 — 어디서 읽는가

정본 스키마 `visual-spec.schema.json` 이 **유일한 진실 공급원**이다.
필드·필수 여부·허용값에 대한 판단은 전부 이 파일에서 나온다. 어디서 읽는지는 상황에 따라 다르다.

**사용자 프로젝트(스킬이 `.claude/skills/`·`.agents/skills/` 등에 설치된 경우)** — 함께 설치된
로컬 계약을 읽는다. 이 스킬 폴더 기준 `../visual-spec/contract/` 이고, 설치한 패키지와 **같은 버전**이다.
네트워크가 필요 없다.

| 경로(`../visual-spec/contract/` 기준) | 내용 |
|---|---|
| `README.md` | 이 사본의 버전과 CLI 사용법(`validate`·GUI 실행) |
| `LOCAL.md` | **이 기기의** CLI 실행 명령(경로). 기기마다 다르다 |
| `schema/visual-spec.schema.json` | Visual Spec IR 정본 스키마 |
| `schema/command.schema.json` | 자연어 응답의 Command 배열 스키마 |
| `schema/ticket.schema.json` | 구현 티켓 스키마 |
| `docs/05-schema.md` | 스키마(현재 0.3)를 사람 말로 푼 규칙 |
| `docs/08-natural-language.md` · `docs/09-command-schema-freeze.md` | 자연어 경로 설계 · Command 계약 |
| `docs/11-ticket-schema-freeze.md` · `docs/16-responsive-codegen-qa.md` | Ticket 계약 · 반응형 코드 생성 QA |
| `examples/` · `examples/invalid/` | 예제 스펙 · 일부러 틀린 예 |

스펙이 유효한지는 `LOCAL.md`(없으면 `README.md`)에 적힌 `validate` 명령으로 확인한다 — 앱이 파일을 열 때와 같은 검증이다.

**이 저장소 안(개발 중)** — 원본을 읽는다.

- `src/features/editor/schema/visual-spec.schema.json` — 정본. `types.ts` 는 여기서 **생성된** 파일이라 손으로 고치지 않는다.
- 타입과 `validateVisualSpec`은 디렉터리 index를 거쳐 가져온다: `import { validateVisualSpec } from "@/features/editor/schema";`
- 예시는 `examples/`, 실패 예시는 `examples/invalid/`.

## 로컬 계약에 없는 문서

아래 문서는 로컬 계약에 싣지 않았다. 저장소 안이면 `docs/` 에서 읽는다.

| 파일 | 답해주는 것 |
|---|---|
| `01-overview.md` | 이 제품이 무엇이고 설치부터 코드 구현까지 흐름이 어떻게 되는가 |
| `02-mvp-scope.md` | 이 기능이 범위 안인가 밖인가 — **범위 판단의 기준 문서** |
| `03-user-flow.md` | 사용자 경로와 Command Engine 등 내부 구조는 어떻게 나뉘는가 |
| `04-gui-spec.md` | 홈 화면·에디터 레이아웃과 각 패널이 어떤 데이터를 다루는가 |
| `06-schema-freeze.md` | 무엇이 동결됐고, 바꾸려면 어떤 절차를 밟아야 하는가 |

`docs/skills/<이름>.md` 는 각 스킬의 사람용 설명 문서다.

사용자 프로젝트에서 이 문서가 꼭 필요할 때만 GitHub 원문을 읽는다. 기본 브랜치는 `develop` 이다.

```
https://raw.githubusercontent.com/visual-spec-labs/Visual-Spec-Builder/develop/docs/<파일>
```

**이 원문은 설치한 패키지보다 새 버전일 수 있다.** 스키마·필드 판단은 여기서 하지 않고 로컬 계약으로
한다. 원문을 근거로 답했다면 "저장소 최신 문서 기준"이라고 함께 말한다.

## 워크플로

1. 필요한 개념을 한 문장으로 정한다. ("`box.width`에 뭘 넣을 수 있나")
2. 필드 판단이면 정본 스키마를, 아니면 위 표에서 문서를 고른다.
3. 사용자 프로젝트면 로컬 계약을, 저장소 안이면 원본을 읽는다.
4. **읽은 내용으로 답한다.** 암기한 지식으로 답하지 않는다.
   읽지 못했으면 못 읽었다고 말한다. 추측해서 채우지 않는다.
