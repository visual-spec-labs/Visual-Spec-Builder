# 06. Visual Spec Schema v0.1 확정 및 동결

동결 시작: 2026-07-30

이 문서는 v0.1 계약이 무엇을 보장하고 무엇을 보장하지 않는지, 그리고 언제 바꿀 수 있는지를 적는다.

---

## 확정 범위

지원한다.

- `screen`
- `frame`
- `text`
- `image`
- `layout`
- `box`
- `background`
- `border`
- `typography`

지원하지 않는다.

- `component`
- `event`
- `token`
- `responsive`

[`docs/05-schema.md`](05-schema.md)의 MVP 제외 범위도 그대로 유효하다.
`instance`, `props`, `bindings`, `variants`, `states`, `slots`, Tailwind 클래스 변환, React 코드 생성이 여기 해당한다.

---

## 정본과 공개 표면

정본은 `src/features/editor/schema/visual-spec.schema.json` 하나다.
TypeScript 타입은 이 파일에서 생성한다. `types.ts`를 손으로 고치지 않는다.

모든 팀원은 아래 경로에서만 타입을 가져온다.

```ts
import type {
  VisualSpec,
  ProjectSpec,
  ScreenSpec,
  PageId,
  Node,
  FrameNode,
  TextNode,
  ImageNode,
} from "@/features/editor/schema";
```

값으로 내보내는 것은 여섯이다. 셋은 v0.1부터 있었고,

```ts
import {
  validateVisualSpec,      // (input: unknown) => ValidationResult, 절대 던지지 않는다
  assertVisualSpec,        // 실패 시 VisualSpecValidationError
  visualSpecJsonSchema,    // 스키마 JSON 원본
} from "@/features/editor/schema";
```

나머지 셋은 v0.2에서 늘었다. 아래 v0.2 절 참고.

```ts
import {
  validateProjectSpec,     // (input: unknown) => ValidationResult, 절대 던지지 않는다
  migrateV01,              // (spec: VisualSpec) => ProjectSpec
  toVisualSpec,            // (page: ScreenSpec) => VisualSpec
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
| Image 추가 | `nodes`에 `type: "image"` 항목 추가 — `src`(워크스페이스 assets 참조)와 `fit`(`cover`\|`contain`\|`fill`) 필수 |
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
| `examples/image-hero.json` | `image` 노드 — `fill` 너비 + 고정 높이(px), `fit: "cover"` |

`dashboard-cards.json`은 스키마가 한 화면에만 맞춰진 구조가 아님을 확인하기 위해 만들었다.

---

## 이 계약이 보장하지 않는 것

- **`Size`의 `"fill"` 의미.** 교차축에서 어떻게 해석할지 정하지 않았다. 스키마는 값만 허용한다. Renderer 구현 시점에 정한다.
- **v0.1 문서의 멀티 스크린.** `VisualSpec`은 여전히 파일 1개 = Screen 1개다. 여러 페이지가 필요하면 v0.2의 `ProjectSpec`을 쓴다(아래 참고).
- **`fontWeight`의 100 단위 제약.** JSON Schema는 강제하지만 생성된 TS 타입은 `number`다. 타입만으로는 못 막으니 `validateVisualSpec`을 거쳐야 한다.
- **편집 연산.** 노드 추가·삭제·이동·재부모화 함수는 없다. 지금은 각 화면이 직접 `nodes`를 다루므로 불변조건을 깨뜨릴 수 있다. `validateVisualSpec`은 예방 수단이 아니라 최후 방어선이다.
- **`ImageNode.src`가 가리키는 워크스페이스 assets 저장소.** 스키마는 문자열 참조만 정의한다. 실제로 파일을 어디에 저장하고 `src` 값을 어떻게 채우는지는 Import 기능(별도 이슈) 쪽 책임이며, 아직 워크스페이스 계층 자체가 저장소에 없다.

---

## v0.2 — ProjectSpec (2026-09-01 추가)

파일 1개에 페이지 여러 개를 담기 위해 최상위 타입을 **하나 더** 두었다. #60.

**`VisualSpec`은 바뀌지 않았다.** 두 타입이 나란히 존재한다.

| 타입 | 뜻 | version |
|---|---|---|
| `VisualSpec` | 화면 파일 1개 | `"0.1"` |
| `ProjectSpec` | 프로젝트 파일 = 페이지 여러 개 | `"0.2"` |

```jsonc
{
  "version": "0.2",
  "name": "admin-console",
  "pages": { "login": { …ScreenSpec }, "dashboard": { …ScreenSpec } },
  "pageOrder": ["login", "dashboard"]
}
```

`pages`의 각 항목은 **기존 `ScreenSpec` 그대로**다. `$def` 정의가 바뀌지 않았으므로 v0.1 문서는 계속 유효하다. 예제 `examples/two-page-project.json` 참고.

`pageOrder`가 따로 있는 이유는 JSON 객체 키 순서가 보장되지 않기 때문이다. `nodes` 맵 + `children` 배열과 같은 "엔티티는 맵, 순서는 배열" 관용구를 한 단계 위에 적용한다.

**공개 표면에 셋이 늘었다.**

```ts
import {
  validateProjectSpec,  // (input: unknown) => ValidationResult, 절대 던지지 않는다
  migrateV01,           // (spec: VisualSpec) => ProjectSpec, 페이지 1개로 넓힌다
  toVisualSpec,         // (page: ScreenSpec) => VisualSpec, 역함수
} from "@/features/editor/schema";
```

`validateVisualSpec`과 `assertVisualSpec`은 시그니처·동작 모두 그대로다.

### 알아둘 것

- **`pageOrder`와 `pages` 키의 일치는 JSON Schema로 검사할 수 없다.** 배열 항목이 객체 키를 참조하는 문법이 없다. `validateProjectSpec`이 `page-order-mismatch` 코드로 따로 잡는다 (`IssueCode` 7종 → 8종).
- **`ProjectSpec`은 정본 스키마의 루트가 아니라 `$defs` 항목이다.** 루트를 v0.1로 유지하기 위해서다. 그래서 `generate:types`가 같은 파일을 두 번 컴파일한다 — 이 생성기는 루트에서 참조되지 않는 `$def`를 방출하지 않기 때문이다. `scripts/generate-types.mjs` 주석 참고.
- **스토어와 UI는 아직 `VisualSpec`을 쓴다.** 활성 페이지 개념은 #61에서 들어간다.

---

## 변경 규칙

**이번 스프린트 동안 스키마를 함부로 바꾸지 않는다.**

바꿔야 한다면 아래를 지킨다.

1. 스키마 변경은 **별도 PR**로 올린다. 다른 기능 작업과 섞지 않는다.
2. **팀 합의**를 거친다. 최소 1명의 승인 없이 머지하지 않는다.
3. PR 본문에 무엇이 왜 바뀌는지, 기존 JSON 문서가 깨지는지를 적는다.
4. `visual-spec.schema.json`을 고쳤으면 `pnpm run generate:types`를 돌려 `types.ts`를 함께 커밋한다.
5. 예제와 테스트를 같이 갱신한다. `pnpm run typecheck`와 `pnpm test`가 통과해야 한다.

동결 해제 시점은 팀이 정한다. 스프린트 종료일은 이 문서에 적지 않았다 — 확정되면 여기에 기입한다.

**동결 대상이 아닌 것**

문서 오타 수정, 주석 추가, 예제 추가, 테스트 추가는 자유롭게 한다.
`description` 필드만 고치는 것도 자유다. 구조와 제약을 건드리는 변경만 위 절차를 따른다.

---

## 검증 방법

```bash
pnpm install
pnpm run generate:types   # types.ts에 변화가 없어야 한다
pnpm run typecheck
pnpm test
```

`generate:types` 실행 후 `git diff`가 비어 있지 않다면 `types.ts`가 정본과 어긋난 것이다.
