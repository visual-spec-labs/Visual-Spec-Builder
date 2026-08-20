---
name: visual-spec-docs
description: Visual Spec의 스키마 계약·용어·범위·설계 근거를 확인해야 할 때 실행한다. "Size에 fill 써도 돼?", "스키마 파일 어디 있어?", "v0.1에서 뭐가 빠졌지?", "이 필드 필수야?", "MVP 범위가 어디까지야?", "동결됐다던데 바꿔도 돼?", "문서 좀 찾아줘"처럼 스키마·범위·문서에 대한 질문이거나, 기억에 의존해 답하려다 현재 버전과 어긋날 위험이 있을 때 쓴다. 답 자체를 담고 있지 않고 정본 파일과 문서를 찾아 읽는 경로만 준다.
---

# Visual Spec 문서·스키마 찾기

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

이 스킬은 **답을 담지 않는다.** 스키마는 바뀌고, 복붙해둔 지식은 그때부터 틀린 것을 가르친다.
여기서는 원문이 어디 있는지만 알려준다. 답은 파일을 열어서 만든다.

## 정본

`src/features/editor/schema/visual-spec.schema.json` 이 **유일한 진실 공급원**이다.
필드·필수 여부·허용값에 대한 판단은 전부 이 파일에서 나온다.

- `src/features/editor/schema/types.ts` — 정본에서 **생성된** 파일이다. 손으로 고치지 않는다.
- 타입과 `validateVisualSpec`은 개별 파일이 아니라 디렉터리 index를 거쳐 가져온다.
  ```ts
  import { validateVisualSpec, type VisualSpec } from "@/features/editor/schema";
  ```
- 실제 문서 예시는 `examples/` 에, 실패 예시는 `examples/invalid/` 에 있다.

## 문서 (`docs/`)

| 파일 | 답해주는 것 |
|---|---|
| `01-overview.md` | 이 제품이 무엇이고 설치부터 코드 구현까지 흐름이 어떻게 되는가 |
| `02-mvp-scope.md` | 이 기능이 범위 안인가 밖인가 — **범위 판단의 기준 문서** |
| `03-user-flow.md` | 사용자 경로와 Command Engine 등 내부 구조는 어떻게 나뉘는가 |
| `04-gui-spec.md` | 홈 화면·에디터 레이아웃과 각 패널이 어떤 데이터를 다루는가 |
| `05-schema.md` | 스키마 v0.1을 사람 말로 풀면 어떤 규칙인가 |
| `06-schema-freeze.md` | 무엇이 동결됐고, 바꾸려면 어떤 절차를 밟아야 하는가 |

`docs/skills/<이름>.md` 는 각 스킬의 사람용 설명 문서다.

## 설치된 사용자 입장에서 원문 얻기

문서 사이트는 없다. 사용자 프로젝트에는 `.claude/skills/` 아래 스킬만 설치되고
`docs/` 와 `src/` 는 없다. 원문이 필요하면 GitHub에서 직접 가져온다.

```
https://raw.githubusercontent.com/visual-spec-labs/Visual-Spec-Builder/develop/<저장소 기준 경로>
```

기본 브랜치는 `main` 이 아니라 `develop` 이다. `main` 으로는 `docs/` 와 `src/` 가 404 난다.

```
https://raw.githubusercontent.com/visual-spec-labs/Visual-Spec-Builder/develop/src/features/editor/schema/visual-spec.schema.json
https://raw.githubusercontent.com/visual-spec-labs/Visual-Spec-Builder/develop/docs/05-schema.md
```

## 워크플로

1. 필요한 개념을 한 문장으로 정한다. ("`box.width`에 뭘 넣을 수 있나")
2. 위 표에서 해당 문서를, 필드 판단이면 정본 스키마를 고른다.
3. 저장소 안이면 파일을 읽고, 밖이면 raw URL로 가져온다.
4. **읽은 내용으로 답한다.** 암기한 지식으로 답하지 않는다.
   읽지 못했으면 못 읽었다고 말한다. 추측해서 채우지 않는다.
