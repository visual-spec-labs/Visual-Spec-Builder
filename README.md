# Visual Spec Builder

React 프로젝트에 설치해 localhost에서 실행하는 GUI 도구다.
사용자는 자연어 또는 직접 조작으로 화면을 구성하고, 도구는 이를 JSON Visual Spec으로 저장한다.
Claude Code 또는 Codex는 해당 JSON을 읽어 실제 React 코드를 구현한다.

## 문서

위에서부터 순서대로 읽으면 전체가 파악된다.

| 문서 | 내용 |
|---|---|
| [01-overview.md](docs/01-overview.md) | 제품 정의, 전체 흐름, 핵심 원칙 |
| [02-mvp-scope.md](docs/02-mvp-scope.md) | 무엇을 만들고 무엇을 만들지 않는가 — **범위 판단의 기준** |
| [03-user-flow.md](docs/03-user-flow.md) | 사용자 경로, Command Engine 구조, 대표 플로우 3가지 |
| [04-gui-spec.md](docs/04-gui-spec.md) | 홈 화면과 에디터 화면 명세 |
| [05-schema.md](docs/05-schema.md) | JSON 스키마 v0.1 |
| [references.md](docs/references.md) | 오픈소스 조사 (craft.js, openpencil, onlook 등) |
| [open-questions.md](docs/open-questions.md) | 미확정 항목 |

설계 논의 기록은 [`docs/superpowers/specs/`](docs/superpowers/specs/)에 있다.

## 현재 구현 상태

스키마와 검증기만 구현되어 있다. GUI는 아직 없다.

```
schema/visual-spec.schema.json   JSON Schema 정본
src/types.ts                     스키마에서 생성한 TypeScript 타입
src/validate.ts                  검증기
examples/                        유효/무효 예시
```

```bash
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run generate:types
```

## 기획 원본

ClickUp 팀 문서가 원본이고 이 저장소 문서는 작업 기준이다.
각 문서 상단에 대응하는 ClickUp 페이지를 표기했다.

https://app.clickup.com/90182912883/v/o/s/901812110763
