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
| [06-schema-freeze.md](docs/06-schema-freeze.md) | v0.1 동결 계약과 변경 절차 — **스키마 수정 전 필독** |
| [07-implementation-status.md](docs/07-implementation-status.md) | 지금 무엇이 구현됐고 무엇이 남았는가 — **다음 할 일 판단의 근거** |
| [references.md](docs/references.md) | 오픈소스 조사 (craft.js, openpencil, onlook 등) |
| [open-questions.md](docs/open-questions.md) | 미확정 항목 |

설계 논의 기록은 [`docs/superpowers/specs/`](docs/superpowers/specs/)에 있다.

## 현재 구현 상태

스키마와 검증기는 구현이 끝났고 v0.1로 동결됐다.
GUI는 Vite + React 에디터 앱의 **레이아웃 골격까지만** 있다. 각 영역은 자리만 잡은 상태이고 편집 기능은 아직 없다.
Command Engine, 자연어 변환, CLI, Export는 아직 없다.

MVP 구현 단위별 상세 현황, 확인된 결함, 다음에 할 만한 것은
**[`docs/07-implementation-status.md`](docs/07-implementation-status.md)** 에 있다.
이 절은 요약만 두고 자세한 내용은 그 문서 한 곳에서만 갱신한다.

디렉터리 구조는 아래와 같다.

```
src/features/editor/schema/      스키마 정본·생성 타입·검증기·공개 index
src/features/editor/ui/          에디터 5개 영역 컴포넌트와 EditorLayout
src/app/App.tsx                  앱 진입점이 EditorLayout을 렌더한다
scripts/generate-types.mjs       스키마 → types.ts 생성
examples/                        유효/무효 예시
test/                            스키마·검증기·공개 API 테스트
```

스키마가 지원하는 범위와 변경 규칙의 전문은 **[`docs/06-schema-freeze.md`](docs/06-schema-freeze.md)** 에 있다.
스키마를 건드리기 전에 반드시 읽는다.

## 팀원이 알아야 할 것

타입은 아래 한 경로에서만 가져온다.

```ts
import type {
  VisualSpec,
  ScreenSpec,
  Node,
  FrameNode,
  TextNode,
} from "@/features/editor/schema";

import { validateVisualSpec } from "@/features/editor/schema";
```

`src/features/editor/schema/` 안의 개별 파일(`types.ts`, `validate.ts`, `visual-spec.schema.json`)을
직접 import하지 않는다. 항상 디렉터리 index를 거친다.

`types.ts`는 `visual-spec.schema.json`에서 생성한 파일이다. 손으로 고치지 않는다.

## 개발

패키지 매니저는 pnpm이다 (`packageManager: pnpm@10.33.0`). npm으로 설치하지 않는다.

```bash
pnpm install
pnpm dev                 # vite 개발 서버
pnpm run generate:types  # 스키마 → src/features/editor/schema/types.ts
pnpm run typecheck       # tsc -b
pnpm test                # vitest run
pnpm run build           # vite build
pnpm run preview         # 빌드 결과 미리보기
```

스키마를 고쳤다면 `generate:types`를 돌려 `types.ts`를 함께 커밋한다.
`generate:types` 후 `git diff`가 비어 있지 않으면 `types.ts`가 정본과 어긋난 것이다.

## 예제

| 파일 | 내용 |
|---|---|
| `examples/empty-title-screen.json` | 노드 2개짜리 최소 화면 |
| `examples/login-screen.json` | 중첩 프레임, border, 부분 투명 색상 |
| `examples/dashboard-cards.json` | `Header > Title` + `Content > Card, Card` 2단 트리 |
| `examples/header-content.json` | 고정 높이 헤더 + `space-between` + `fill` 본문 |
| `examples/invalid/` | 검증기가 잡아야 하는 잘못된 문서들 |

## 기획 원본

ClickUp 팀 문서가 원본이고 이 저장소 문서는 작업 기준이다.
각 문서 상단에 대응하는 ClickUp 페이지를 표기했다.

https://app.clickup.com/90182912883/v/o/s/901812110763
