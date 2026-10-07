# Visual Spec Builder

체크아웃에서 localhost로 실행하는 화면 설계 GUI 도구다.
사용자는 자연어 또는 직접 조작으로 화면을 구성하고, 도구는 이를 JSON Visual Spec으로 저장한다.
Claude Code 또는 Codex는 해당 JSON을 읽어 실제 React 코드를 구현한다.

처음 실행한다면 [로그인 예제로 시작하기](docs/14-getting-started.md)를 따른다.
현재 패키지는 `private: true`이며, npm 배포 대신 저장소 체크아웃의 CLI를 사용한다.

## 문서

위에서부터 순서대로 읽으면 전체가 파악된다.

| 문서 | 내용 |
|---|---|
| [01-overview.md](docs/01-overview.md) | 제품 정의, 전체 흐름, 핵심 원칙 |
| [02-mvp-scope.md](docs/02-mvp-scope.md) | 무엇을 만들고 무엇을 만들지 않는가 — **범위 판단의 기준** |
| [03-user-flow.md](docs/03-user-flow.md) | 사용자 경로, Command Engine 구조, 대표 플로우 3가지 |
| [04-gui-spec.md](docs/04-gui-spec.md) | 홈 화면과 에디터 화면 명세 |
| [05-schema.md](docs/05-schema.md) | JSON 스키마 (현재 0.3) |
| [06-schema-freeze.md](docs/06-schema-freeze.md) | IR 스키마 동결 계약과 변경 절차 (v0.1에서 시작, 현재 0.3) — **스키마 수정 전 필독** |
| [07-implementation-status.md](docs/07-implementation-status.md) | 지금 무엇이 구현됐고 무엇이 남았는가 — **다음 할 일 판단의 근거** |
| [08-natural-language.md](docs/08-natural-language.md) | 자연어 → Command 변환 설계 |
| [09-command-schema-freeze.md](docs/09-command-schema-freeze.md) | Command 스키마 v0.1 동결 계약과 변경 절차 |
| [10-shortcuts.md](docs/10-shortcuts.md) | 편집기 단축키와 캔버스 조작 (실제 동작하는 것만) |
| [11-ticket-schema-freeze.md](docs/11-ticket-schema-freeze.md) | Ticket 스키마 v0.1 동결 계약과 변경 절차 |
| [12-responsive-ir-design.md](docs/12-responsive-ir-design.md) | 이슈 #181 반응형 IR 설계 결정과 후속 범위 |
| [13-background-fill-design.md](docs/13-background-fill-design.md) | 이슈 #127 배경 그라디언트·다중 채우기 설계 결정과 후속 범위 |
| [14-getting-started.md](docs/14-getting-started.md) | 설치 → GUI 편집·저장 → 외부 에이전트 → 코드 Export·앱 통합 |
| [15-workflow-qa.md](docs/15-workflow-qa.md) | 전체 흐름의 실제 검증 기록과 한계 |
| [16-responsive-codegen-qa.md](docs/16-responsive-codegen-qa.md) | 이슈 #224 반응형 React 코드 매핑 fixture 검증 기록과 한계 |
| [17-codegen-layout-qa.md](docs/17-codegen-layout-qa.md) | 이슈 #269 크기·줄바꿈 DOM 실측과 수동 fixture 검증 기록 |
| [18-export-asset-bundler-qa.md](docs/18-export-asset-bundler-qa.md) | 이슈 #270 이미지 정적 import의 개발·production 브라우저 로딩 검증 |
| [19-grid-codegen-qa.md](docs/19-grid-codegen-qa.md) | 이슈 #268 Grid 열·auto/fill·교차축 정렬의 Tailwind/브라우저 비교 |
| [EDITOR_STORE_CONTRACT.md](docs/EDITOR_STORE_CONTRACT.md) | 캔버스·레이어 트리·세부설정 패널이 공유하는 스토어 계약 |
| [DESIGN-TOKEN-RULES.md](docs/DESIGN-TOKEN-RULES.md) | 디자인 토큰 네이밍·구조·참조 규칙 |
| [references.md](docs/references.md) | 오픈소스 조사 (craft.js, openpencil, onlook 등) |
| [open-questions.md](docs/open-questions.md) | 미확정 항목 |
| [qa/](docs/qa/) | 개별 기능 QA 기록 ([탭 저장 충돌](docs/qa/tab-save-conflicts.md), [프로젝트 이름·파일명 변경](docs/qa/project-file-rename-qa.md)) |
| [skills/](docs/skills/) | 배포 스킬 7종(`skills/`)의 사람용 설명 |

설계 논의 기록은 [`docs/superpowers/specs/`](docs/superpowers/specs/)에 있다.

## 현재 구현 상태

문서 스키마 0.3과 검증기, 노드 5종의 GUI 편집·그룹화·Undo/Redo, CLI 작업공간 저장·복원,
solid·linear·image 다중 배경 편집, 반응형(breakpoint·override) 편집과 코드 생성 지침,
자연어 Command 적용, 구현 티켓 요청·응답, 생성 코드 ZIP Export가 구현돼 있다.
자연어 응답과 React 코드 생성은 별도로 실행한 Claude Code·Codex 등 외부 에이전트가 담당한다.
GUI가 에이전트 프로세스를 자동 실행하지 않는다. 남은 한계는 구현 현황을 참고한다.

MVP 구현 단위별 상세 현황, 확인된 결함, 다음에 할 만한 것은
**[`docs/07-implementation-status.md`](docs/07-implementation-status.md)** 에 있다.
이 절은 요약만 두고 자세한 내용은 그 문서 한 곳에서만 갱신한다.

디렉터리 구조는 아래와 같다.

```
bin/visual-spec.mjs              init·skills·GUI 실행 CLI
src/app/App.tsx                  홈/에디터 전환과 자동저장 연결
src/features/editor/schema/     스키마 정본·생성 타입·검증기·공개 index
src/features/editor/store/      프로젝트·페이지·선택·history·지속성
src/features/editor/command/    편집 명령 적용·외부 입력 검증
src/features/editor/ui/         홈·캔버스·트리·속성·자연어·티켓·Export UI
src/features/editor/nl/         자연어 요청·응답 파일 프로토콜
src/features/editor/ticket/     티켓 컴파일·상태·요청·응답
src/features/editor/export/     생성 코드·참조 검사와 ZIP 구성
src/features/workspace/         개발 서버 작업공간 파일 API
skills/                         외부 에이전트용 배포 스킬
docs/                           사용법·설계·계약·검증 기록
scripts/generate-types.mjs       스키마 → types.ts 생성
examples/                       유효/무효 예시
test/                           스키마·스토어·명령·CLI·렌더 판단기 등 테스트
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

Node 20 이상(CI는 20), pnpm 10.33.0을 사용한다 (`packageManager: pnpm@10.33.0`). npm으로 설치하지 않는다.

```bash
pnpm install --frozen-lockfile
pnpm dev                 # vite 개발 서버
pnpm run generate:types  # 스키마 → src/features/editor/schema/types.ts
pnpm run typecheck       # tsc -b
pnpm test                # vitest run
pnpm run lint            # eslint
pnpm run build           # vite build
pnpm run preview         # 빌드 결과 미리보기
```

스키마를 고쳤다면 `generate:types`를 돌려 `types.ts`를 함께 커밋한다.
`generate:types` 후 `git diff`가 비어 있지 않으면 `types.ts`가 정본과 어긋난 것이다.

## 예제

| 파일 | 내용 |
|---|---|
| `examples/empty-title-screen.json` | 노드 2개짜리 최소 화면 |
| `examples/login-screen.json` | 로그인 버튼·이메일/비밀번호 입력, 중첩 프레임·border·부분 투명 색상 |
| `examples/dashboard-cards.json` | `Header > Title` + `Content > Card, Card` 2단 트리 |
| `examples/header-content.json` | 고정 높이 헤더 + `space-between` + `fill` 본문 |
| `examples/invalid/` | 검증기가 잡아야 하는 잘못된 문서들 |

## 기획 원본

ClickUp 팀 문서가 원본이고 이 저장소 문서는 작업 기준이다.
각 문서 상단에 대응하는 ClickUp 페이지를 표기했다.

https://app.clickup.com/90182912883/v/o/s/901812110763
