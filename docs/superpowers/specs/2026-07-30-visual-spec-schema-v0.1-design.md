# Visual Spec Schema v0.1 — 구현 설계

작성일: 2026-07-30
대상: `docs/05-schema.md`의 MVP 계약을 실제 JSON Schema와 TypeScript 타입으로 구현한다.

이 문서는 4개 에이전트가 병렬로 구현하기 위한 **단일 계약서**다.
필드 하나라도 이 문서와 다르게 구현하면 통합이 깨진다.

---

## 1. 범위

> **구현 후 변경 사항.** 팀 피드백에 따라 스키마 모듈을 `src/features/editor/schema/`로 옮기고
> `Screen` 타입을 `ScreenSpec`으로 바꿨다. JSON 문서 구조는 그대로다.
> 아래 본문의 `schema/`, `src/types.ts` 같은 경로는 설계 당시 기준이며,
> 현재 위치와 확정된 계약은 `docs/06-schema-freeze.md`를 본다.

구현한다.

- `visual-spec.schema.json` (JSON Schema draft 2020-12) — **정본**
- `types.ts` — 위 스키마에서 생성한 TypeScript 타입
- `validate.ts` — 구조 검증 + JSON Schema로 표현 불가능한 참조 무결성 검증
- 테스트와 예제 JSON

구현하지 않는다. (`docs/05-schema.md`의 MVP 제외 범위)

ImageNode, InstanceNode, ComponentSpec, TokenSet, props, bindings, events,
variants, states, slots, 반응형, Tailwind 클래스 변환, React 코드 생성, GUI 자체.

---

## 2. 확정된 설계 결정

| 항목 | 결정 |
|---|---|
| 정본 | `schema/visual-spec.schema.json`. TS 타입은 여기서 **생성**한다. 손으로 고치지 않는다. |
| 레이아웃 모델 | Auto Layout 전용. 절대좌표(x/y) 없음. `children` 순서가 곧 배치 순서. |
| 색상 | hex 문자열 `#RRGGBB` 또는 `#RRGGBBAA` |
| 치수 | 단위 없는 `number`, px로 해석 |
| 문서 단위 | 파일 1개 = Screen 1개 |
| 미지정 속성 | 모든 객체 `additionalProperties: false` |
| 선택 필드 | `visible`만 선택. 나머지 전부 필수. (Inspector가 항상 전체 값을 기록한다) |

---

## 3. 데이터 모델

### 3.1 최상위

```ts
interface VisualSpec {
  version: "0.1";
  screen: ScreenSpec;
}

interface ScreenSpec {
  name: string;                              // minLength 1
  size: { width: number; height: number };   // 둘 다 exclusiveMinimum 0
  root: NodeId;                              // nodes에 존재하는 key
  nodes: Record<NodeId, Node>;               // minProperties 1
}
```

`nodes` 객체의 key가 노드 ID다. 노드 내부에 `id`를 중복 저장하지 않는다. (확정 규칙)

```
NodeId  =  /^[A-Za-z0-9_-]+$/     // minLength 1
```

JSON Schema 표현:

```json
"nodes": {
  "type": "object",
  "minProperties": 1,
  "propertyNames": { "pattern": "^[A-Za-z0-9_-]+$" },
  "additionalProperties": { "$ref": "#/$defs/Node" }
}
```

### 3.2 노드

`type`으로 판별하는 discriminated union이다.

```ts
type Node = FrameNode | TextNode;

interface FrameNode {
  type: "frame";
  name: string;              // minLength 1
  visible?: boolean;         // default true
  box: Box;
  layout: Layout;
  background?: Background;
  border?: Border;
  children: ChildReference[];   // 비어 있어도 됨
}

interface TextNode {
  type: "text";
  name: string;              // minLength 1
  visible?: boolean;         // default true
  box: Box;
  content: string;           // 빈 문자열 허용
  typography: Typography;
  color: Color;              // 글자 색
}

interface ChildReference {
  node: NodeId;
}
```

`TextNode`는 `children`을 갖지 않는다. `background`/`border`도 갖지 않는다 (MVP).

JSON Schema에서 `Node`는 `oneOf`로 두 정의를 잇되, 각각 `type`에 `const`를 건다.

### 3.3 값 타입

```ts
type Size = number | "auto" | "fill";        // number는 minimum 0

interface Box {
  width: Size;
  height: Size;
}

type Color = string;   // pattern ^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$

interface Padding {
  top: number; right: number; bottom: number; left: number;   // 각 minimum 0
}

interface Layout {
  direction: "row" | "column";
  gap: number;                                                 // minimum 0
  padding: Padding;
  mainAxis: "start" | "center" | "end" | "space-between";
  crossAxis: "start" | "center" | "end" | "stretch";
}

interface Background {
  color: Color;              // MVP는 단색만
}

interface Border {
  width: number;             // minimum 0
  color: Color;
  radius: number;            // minimum 0, 네 모서리 균일
}

interface Typography {
  fontFamily: string;        // minLength 1
  fontSize: number;          // exclusiveMinimum 0
  fontWeight: number;        // integer, 100~900, multipleOf 100
  lineHeight: number;        // exclusiveMinimum 0, px
  letterSpacing: number;     // px, 음수 허용
  textAlign: "left" | "center" | "right";
}
```

`Border.style`은 두지 않는다. MVP는 solid 고정이다.

---

## 4. 참조 무결성 검증

JSON Schema는 문서 내 상호 참조를 검사하지 못한다. `validateVisualSpec()`이 스키마 통과 후 추가로 검사한다.

| 코드 | 조건 |
|---|---|
| `root-missing` | `screen.root`가 `screen.nodes`의 key가 아님 |
| `root-not-frame` | root 노드의 `type`이 `"frame"`이 아님 |
| `child-missing` | 어떤 `children[].node`가 `nodes`에 없음 |
| `cycle` | 자식 참조를 따라가면 순환이 생김 |
| `multiple-parents` | 같은 노드를 두 곳 이상에서 참조 |
| `orphan-node` | root에서 도달할 수 없는 노드가 존재 |
| `schema` | JSON Schema 위반 (Ajv가 낸 오류) |

순환이 있으면 도달성 계산이 무한 루프에 빠질 수 있다. 방문 집합으로 막는다.

`orphan-node` 검사는 도달성 계산의 출발점이 성립할 때만 의미가 있다.
따라서 `cycle` 또는 `root-missing`이 검출되면 `orphan-node` 검사를 건너뛴다.

`root-missing`을 건너뛰기 대상에 넣는 이유는 이렇다. `nodes`는 `minProperties: 1`이라 비어 있을 수 없는데
`root`가 그중 어느 key도 가리키지 않으면 모든 노드가 자동으로 도달 불가가 된다.
건너뛰지 않으면 `root-missing` 하나만 내는 문서를 만들 수 없고, 실제 원인 하나가 노드 수만큼의
`orphan-node` 잡음에 묻힌다.

`root-not-frame`은 건너뛰기 대상이 아니다. root 노드 자체는 존재하므로 도달성 계산이 성립한다.
(root가 `text`면 자식이 없어 다른 노드가 전부 orphan이 되지만, 그건 문서의 실제 결함이다.)

---

## 5. 공개 API

에이전트 간 계약이다. 시그니처를 바꾸지 않는다.

```ts
// src/validate.ts
export type IssueCode =
  | "schema"
  | "root-missing"
  | "root-not-frame"
  | "child-missing"
  | "cycle"
  | "multiple-parents"
  | "orphan-node";

export interface ValidationIssue {
  code: IssueCode;
  path: string;      // JSON Pointer. 예: "/screen/nodes/title/children/0/node"
  message: string;   // 한국어
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];   // valid가 true면 빈 배열
}

export function validateVisualSpec(input: unknown): ValidationResult;

// 실패 시 VisualSpecValidationError를 던진다. error.issues로 접근.
export function assertVisualSpec(input: unknown): asserts input is VisualSpec;

export class VisualSpecValidationError extends Error {
  readonly issues: ValidationIssue[];
}
```

```ts
// src/index.ts
export * from "./types";
export * from "./validate";
export { default as visualSpecJsonSchema } from "../schema/visual-spec.schema.json";
```

`validateVisualSpec`은 절대 던지지 않는다. 잘못된 입력(`null`, 문자열, 배열)도 `valid: false`로 돌려준다.

---

## 6. 프로젝트 구성

루트 단일 패키지다. 모노레포로 나누지 않는다.

```
package.json
tsconfig.json          ← "@/*" → "src/*" 경로 별칭
vitest.config.ts       ← 같은 별칭을 resolve.alias 로 재선언
scripts/generate-types.mjs
src/features/editor/schema/
  visual-spec.schema.json   ← 정본
  types.ts                  ← 생성물이지만 커밋한다
  validate.ts
  index.ts                  ← 팀이 import 하는 유일한 진입점
examples/*.json
examples/invalid/*.json
test/*.test.ts
```

의존성.

- `ajv` v8 — draft 2020-12는 `ajv/dist/2020`에서 import한다. 기본 `ajv` 엔트리는 draft-07이라 동작하지 않는다.
- `ajv-formats` 불필요 (format 키워드를 쓰지 않는다)
- `json-schema-to-typescript` — devDependency
- `typescript`, `vitest` — devDependency

`package.json` 스크립트.

```json
{
  "scripts": {
    "generate:types": "node scripts/generate-types.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

`tsconfig.json`은 `strict: true`, `resolveJsonModule: true`, `module`/`moduleResolution`은 `NodeNext`,
`noEmit: true`. `include`에 `src`, `schema`, `test`, `examples`를 모두 넣는다.
`src/index.ts`가 `schema/*.json`을 import하므로 `rootDir`은 지정하지 않는다.

---

## 7. 작업 분할

파일이 겹치지 않는다. 각자 자기 칸만 만든다.

| 담당 | 파일 |
|---|---|
| Claude-A | `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` 보강, `schema/visual-spec.schema.json` |
| Codex-A | `scripts/generate-types.mjs`, `src/types.ts`, `src/index.ts` |
| Codex-B | `src/validate.ts` |
| Claude-B | `test/**`, `examples/**` |

브랜치는 `Yumesa2025/telescopefish`, 워크트리는
`C:/Users/stven/orca/workspaces/TeamVisualSpec/telescopefish`.

통합과 리뷰는 오케스트레이터가 맡는다.

---

## 8. 예제

`examples/login-screen.json` — 유효한 문서. 스키마의 모든 필드를 최소 한 번씩 사용한다.

```json
{
  "version": "0.1",
  "screen": {
    "name": "Login",
    "size": { "width": 390, "height": 844 },
    "root": "root",
    "nodes": {
      "root": {
        "type": "frame",
        "name": "Screen",
        "box": { "width": "fill", "height": "fill" },
        "layout": {
          "direction": "column",
          "gap": 16,
          "padding": { "top": 24, "right": 20, "bottom": 24, "left": 20 },
          "mainAxis": "start",
          "crossAxis": "stretch"
        },
        "background": { "color": "#FFFFFF" },
        "children": [{ "node": "title" }, { "node": "card" }]
      },
      "title": {
        "type": "text",
        "name": "Title",
        "box": { "width": "fill", "height": "auto" },
        "content": "로그인",
        "color": "#111111",
        "typography": {
          "fontFamily": "Pretendard",
          "fontSize": 24,
          "fontWeight": 700,
          "lineHeight": 32,
          "letterSpacing": -0.5,
          "textAlign": "left"
        }
      },
      "card": {
        "type": "frame",
        "name": "Card",
        "visible": true,
        "box": { "width": "fill", "height": "auto" },
        "layout": {
          "direction": "column",
          "gap": 12,
          "padding": { "top": 16, "right": 16, "bottom": 16, "left": 16 },
          "mainAxis": "center",
          "crossAxis": "stretch"
        },
        "background": { "color": "#F5F5F5FF" },
        "border": { "width": 1, "color": "#00000020", "radius": 8 },
        "children": [{ "node": "hint" }]
      },
      "hint": {
        "type": "text",
        "name": "Hint",
        "box": { "width": "auto", "height": "auto" },
        "content": "계정 정보를 입력하세요",
        "color": "#666666",
        "typography": {
          "fontFamily": "Pretendard",
          "fontSize": 14,
          "fontWeight": 400,
          "lineHeight": 20,
          "letterSpacing": 0,
          "textAlign": "center"
        }
      }
    }
  }
}
```

무효 예제는 4절의 코드마다 하나씩 만든다.

---

## 9. 남은 판단

- **멀티 스크린.** `docs/05-schema.md`의 "노드 ID는 한 Screen 안에서 고유하다"는
  Screen이 여럿임을 전제하는 표현이다. v0.1은 파일 1개 = Screen 1개로 간다.
  필요해지면 최상위를 `screens: Record<ScreenId, Screen>`로 바꾼다. 노드 ID 규칙은 그대로 성립한다.
- **Size의 `"fill"`.** 부모가 `direction: "row"`일 때 자식의 `width: "fill"`은 주축을 채운다는 뜻이다.
  교차축에서의 `"fill"` 해석은 Renderer 구현 시점에 정한다. v0.1 스키마는 값만 허용하고 의미는 강제하지 않는다.
