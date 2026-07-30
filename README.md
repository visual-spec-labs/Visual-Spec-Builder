# Visual Spec Builder

(https://app.clickup.com/90182912883/v/o/s/901812110763)

React 프로젝트에 설치해 localhost에서 실행하는 GUI 도구다.
사용자가 화면을 구성하면 JSON Visual Spec으로 저장하고, AI Agent가 그 JSON을 읽어 React 코드를 만든다.

자세한 배경은 `docs/PROJECT_OVERVIEW.md`를 본다.

## 현재 상태

Visual Spec Schema v0.1이 확정·동결됐다. GUI는 아직 없다.

- 지원: `screen`, `frame`, `text`, `layout`, `box`, `background`, `border`, `typography`
- 제외: `image`, `component`, `event`, `token`, `responsive`

변경 규칙과 계약의 전문은 **`docs/SCHEMA_V0.1_FREEZE.md`** 에 있다. 스키마를 건드리기 전에 반드시 읽는다.

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

```bash
npm ci
npm run generate:types   # 스키마 → src/features/editor/schema/types.ts
npm run typecheck        # tsc --noEmit
npm test                 # vitest
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
