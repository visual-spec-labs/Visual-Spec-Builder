# Visual Spec Schema v0.1 확정 및 동결

동결 시작: 2026-07-30

이 문서는 v0.1 계약이 무엇을 보장하고 무엇을 보장하지 않는지, 그리고 언제 바꿀 수 있는지를 적는다.

---

## 확정 범위

지원한다.

- `screen`
- `frame`
- `text`
- `layout`
- `box`
- `background`
- `border`
- `typography`

지원하지 않는다.

- `image`
- `component`
- `event`
- `token`
- `responsive`

`docs/VISUAL_SPEC_SCHEMA_V0.1.md`의 MVP 제외 범위도 그대로 유효하다.
`instance`, `props`, `bindings`, `variants`, `states`, `slots`, Tailwind 클래스 변환, React 코드 생성이 여기 해당한다.

---

## 정본과 공개 표면

정본은 `src/features/editor/schema/visual-spec.schema.json` 하나다.
TypeScript 타입은 이 파일에서 생성한다. `types.ts`를 손으로 고치지 않는다.

모든 팀원은 아래 경로에서만 타입을 가져온다.

```ts
import type {
  VisualSpec,
  ScreenSpec,
  Node,
  FrameNode,
  TextNode,
} from "@/features/editor/schema";
```

값으로 내보내는 것은 셋이다.

```ts
import {
  validateVisualSpec,      // (input: unknown) => ValidationResult, 절대 던지지 않는다
  assertVisualSpec,        // 실패 시 VisualSpecValidationError
  visualSpecJsonSchema,    // 스키마 JSON 원본
} from "@/features/editor/schema";
```

`src/features/editor/schema/` 바깥에서 `visual-spec.schema.json`을 직접 읽지 않는다.
`types.ts`나 `validate.ts`를 개별 파일로 import하지 않는다. 항상 디렉터리 index를 거친다.

---

## 이 계약이 보장하는 것

v0.1 타입으로 아래 GUI 조작 결과를 저장할 수 있다. 예제와 테스트로 확인했다.

| 조작 | 저장 위치 |
|---|---|
| Frame 추가 | `nodes`에 `type: "frame"` 항목 추가 |
| Text 추가 | `nodes`에 `type: "text"` 항목 추가 |
| 부모-자식 구조 | `FrameNode.children[].node`가 `nodes`의 key를 참조 |
| width / height | `box.width`, `box.height` — `number | "auto" | "fill"` |
| gap / padding | `layout.gap`, `layout.padding.{top,right,bottom,left}` |
| text content | `TextNode.content` |
| font size | `typography.fontSize` |
| color | `TextNode.color`, `background.color`, `border.color` — hex 문자열 |
| 표시 / 숨김 | `visible` (생략 시 `true`) |

검증된 예제는 넷이다.

| 파일 | 확인하는 것 |
|---|---|
| `examples/empty-title-screen.json` | 노드 2개짜리 최소 화면. 중앙 정렬 |
| `examples/login-screen.json` | 중첩 프레임, border, 부분 투명 색상 |
| `examples/dashboard-cards.json` | `Header > Title` + `Content > Card, Card` 2단 트리. `direction: row` 카드 배치 |
| `examples/header-content.json` | 고정 높이(px) 헤더 + `space-between` + `fill` 본문 + `visible: false` |

`dashboard-cards.json`은 스키마가 한 화면에만 맞춰진 구조가 아님을 확인하기 위해 만들었다.

---

## 이 계약이 보장하지 않는 것

- **`Size`의 `"fill"` 의미.** 교차축에서 어떻게 해석할지 정하지 않았다. 스키마는 값만 허용한다. Renderer 구현 시점에 정한다.
- **멀티 스크린.** 파일 1개 = Screen 1개다. 최상위에 `screens` 맵은 없다.
- **`fontWeight`의 100 단위 제약.** JSON Schema는 강제하지만 생성된 TS 타입은 `number`다. 타입만으로는 못 막으니 `validateVisualSpec`을 거쳐야 한다.
- **편집 연산.** 노드 추가·삭제·이동·재부모화 함수는 없다. 지금은 각 화면이 직접 `nodes`를 다루므로 불변조건을 깨뜨릴 수 있다. `validateVisualSpec`은 예방 수단이 아니라 최후 방어선이다.

---

## 변경 규칙

**이번 스프린트 동안 스키마를 함부로 바꾸지 않는다.**

바꿔야 한다면 아래를 지킨다.

1. 스키마 변경은 **별도 PR**로 올린다. 다른 기능 작업과 섞지 않는다.
2. **팀 합의**를 거친다. 최소 1명의 승인 없이 머지하지 않는다.
3. PR 본문에 무엇이 왜 바뀌는지, 기존 JSON 문서가 깨지는지를 적는다.
4. `visual-spec.schema.json`을 고쳤으면 `npm run generate:types`를 돌려 `types.ts`를 함께 커밋한다.
5. 예제와 테스트를 같이 갱신한다. `npm run typecheck`와 `npm test`가 통과해야 한다.

동결 해제 시점은 팀이 정한다. 스프린트 종료일은 이 문서에 적지 않았다 — 확정되면 여기에 기입한다.

**동결 대상이 아닌 것**

문서 오타 수정, 주석 추가, 예제 추가, 테스트 추가는 자유롭게 한다.
`description` 필드만 고치는 것도 자유다. 구조와 제약을 건드리는 변경만 위 절차를 따른다.

---

## 검증 방법

```bash
npm ci
npm run generate:types   # types.ts에 변화가 없어야 한다
npm run typecheck
npm test
```

`generate:types` 실행 후 `git diff`가 비어 있지 않다면 `types.ts`가 정본과 어긋난 것이다.
