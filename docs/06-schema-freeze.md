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
- `button`
- `input`
- `layout` (`direction`: `row` | `column` | `grid`)
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
  ButtonNode,
  InputNode,
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
| Button 추가 | `nodes`에 `type: "button"` 항목 추가 — `content`(라벨), `typography`, `color` 필수 |
| Input 추가 | `nodes`에 `type: "input"` 항목 추가 — `placeholder`, `typography`, `color` 필수. 값 바인딩(`value`/`onChange`)은 없다 |
| 부모-자식 구조 | `FrameNode.children[].node`가 `nodes`의 key를 참조 |
| width / height | `box.width`, `box.height` — `number | "auto" | "fill"` |
| gap / padding | `layout.gap`, `layout.padding.{top,right,bottom,left}` |
| Grid 배치 | `layout.direction: "grid"` + `layout.columns`(선택, grid에서만 의미) — 균등 N열 자동 배치만 지원, 셀 지정 없음 |
| text content | `TextNode.content` |
| font size | `typography.fontSize` |
| color | `TextNode.color`, `background.color`, `border.color` — hex 문자열 |
| 표시 / 숨김 | `visible` (생략 시 `true`) |
| 그림자 | `FrameNode.shadow`(선택) — `x`·`y`·`blur`·`spread`·`color` 전부 필수 |
| 불투명도 | `opacity`(선택, 0..1. 생략 시 `1`) — `frame`·`text`·`image` |
| 레이어 블러 | `blur`(선택, px. 생략 시 `0`) — `frame`·`text`·`image` |
| 테두리 정렬 | `border.align`(선택, `inside`\|`center`\|`outside`. 생략 시 `inside`) |
| 모서리 반경 | `border.radius` — `number` 또는 `{topLeft,topRight,bottomRight,bottomLeft}` |

검증된 예제는 일곱이다.

| 파일 | 확인하는 것 |
|---|---|
| `examples/empty-title-screen.json` | 노드 2개짜리 최소 화면. 중앙 정렬 |
| `examples/login-screen.json` | 중첩 프레임, border, 부분 투명 색상 |
| `examples/dashboard-cards.json` | `Header > Title` + `Content > Card, Card` 2단 트리. `direction: row` 카드 배치 |
| `examples/header-content.json` | 고정 높이(px) 헤더 + `space-between` + `fill` 본문 + `visible: false` |
| `examples/image-hero.json` | `image` 노드 — `fill` 너비 + 고정 높이(px), `fit: "cover"` |
| `examples/form-grid.json` | `button`/`input` 노드 + `layout.direction: "grid"`(`columns: 2`) 레이블-입력 쌍 배치 |
| `examples/card-effects.json` | `shadow` · `border.align: "outside"` · 모서리별 `radius` · `opacity`/`blur` 카드 3장 |

`dashboard-cards.json`은 스키마가 한 화면에만 맞춰진 구조가 아님을 확인하기 위해 만들었다.

---

## 이 계약이 보장하지 않는 것

- **`Size`의 `"fill"` 의미.** 교차축에서 어떻게 해석할지 정하지 않았다. 스키마는 값만 허용한다. Renderer 구현 시점에 정한다.
- **v0.1 문서의 멀티 스크린.** `VisualSpec`은 여전히 파일 1개 = Screen 1개다. 여러 페이지가 필요하면 v0.2의 `ProjectSpec`을 쓴다(아래 참고).
- **`fontWeight`의 100 단위 제약.** JSON Schema는 강제하지만 생성된 TS 타입은 `number`다. 타입만으로는 못 막으니 `validateVisualSpec`을 거쳐야 한다.
- **편집 연산.** 노드 추가·삭제·이동·재부모화 함수는 없다. 지금은 각 화면이 직접 `nodes`를 다루므로 불변조건을 깨뜨릴 수 있다. `validateVisualSpec`은 예방 수단이 아니라 최후 방어선이다.
- **`ImageNode.src`가 가리키는 워크스페이스 assets 저장소.** 스키마는 문자열 참조만 정의한다. 실제로 파일을 어디에 저장하고 `src` 값을 어떻게 채우는지는 Import 기능(별도 이슈) 쪽 책임이며, 아직 워크스페이스 계층 자체가 저장소에 없다.
- **Grid의 셀 배치.** `layout.columns`만큼 균등한 열로 자동 배치할 뿐, 특정 자식을 특정 셀·여러 칸에 놓는 기능은 없다. `mainAxis`/`crossAxis`는 grid에서 무시된다. Canvas.tsx가 "임시 스탠드인"이라 정식 grid 배치는 그 교체 작업과 함께 다시 다룬다.
- **Button/Input의 상호작용.** `content`/`placeholder`는 표시용 텍스트일 뿐 `onClick`/`value`/`onChange` 같은 이벤트·바인딩은 정의하지 않는다. props/bindings는 MVP 제외 범위(`docs/05-schema.md`)에 그대로 속한다.

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

## 스타일 표현력 확장 (2026-09-04 추가)

단색 배경 + 균일 테두리로 제한돼 있던 표현을 넓혔다. #78 1단계.

**기존 문서는 깨지지 않는다.** 넷은 선택 필드 추가이고, 하나(`border.radius`)는 기존 타입을 넓히는 변경이라 숫자 갈래가 그대로 유효하다.

| 필드 | 어디에 | 없을 때 | CSS |
|---|---|---|---|
| `shadow` | `frame` | 그림자 없음 | `box-shadow` |
| `opacity` | `frame`·`text`·`image` | `1` | `opacity` |
| `blur` | `frame`·`text`·`image` | `0` | `filter: blur()` |
| `border.align` | `Border` (`frame`·`button`·`input` 공유) | `"inside"` | 아래 참고 |
| `border.radius` | 〃 | — (필수 필드, 타입만 넓어짐) | `border-radius` |

```jsonc
"shadow": { "x": 0, "y": 8, "blur": 24, "spread": -4, "color": "#0F172A26" },
"opacity": 0.5,
"blur": 2,
"border": {
  "width": 2, "color": "#6366F1", "align": "outside",
  "radius": { "topLeft": 20, "topRight": 20, "bottomRight": 4, "bottomLeft": 4 }
}
```

### 알아둘 것

- **`shadow`를 `text`에 두지 않았다.** 글자 모양을 따라가는 그림자는 `box-shadow`가 아니라 `filter: drop-shadow`라 성격이 다르다. 텍스트 그림자가 필요하면 별도 필드로 정의해야 한다.
- **`border.align`을 `outline`으로 그리지 않는다.** 캔버스가 선택 표시에 이미 `outline`을 쓰고 있어(`Canvas.tsx`의 `RenderNode`) 노드를 고르는 순간 둘 중 하나가 사라진다. `inside`는 CSS `border` 속성 그대로, `center`/`outside`는 `box-shadow` 고리로 그린다. `shadow`와 같은 칸을 쓰므로 `canvasLayout.strokeAndShadowStyle`이 한 문자열로 합성한다.
- **`inside`만 CSS `border` 속성을 유지하는 이유.** `box-shadow`는 레이아웃 박스를 차지하지 않는데, 기존 문서가 전부 `border` + `box-sizing: border-box`(= `inside`)로 그려져 있다. 여기서 갈아타면 안쪽 여백이 달라진다.
- **`blur`는 Layer blur만이다.** 자기 자신과 자식이 함께 흐려진다. 뒤 배경을 흐리는 Background blur(`backdrop-filter`)는 다른 기능이라 포함하지 않았다.
- **`opacity`/`blur`가 걸린 프레임 안에서는 선택 표시도 함께 흐려진다.** CSS `opacity`·`filter`가 자식 전체에 걸리기 때문이다. 선택 표시를 캔버스 오버레이로 분리해야 풀리는 구조적 문제라 별도 이슈로 둔다.
- **`button`·`input`에는 `shadow`·`opacity`·`blur`를 아직 두지 않았다.** 두 노드는 속성 패널이 없어 스키마에만 있고 편집할 수 없는 필드가 된다. `border.align`·모서리별 `radius`는 `Border` $def에 붙어서 두 노드도 함께 따라온다.
- **다중 채우기·그라디언트는 여기 없다.** `Background.color`를 배열/유니온으로 바꿔야 해서 기존 문서가 깨진다. 마이그레이션 합의가 필요하므로 #78 2단계로 분리했다.

---

## 변경 규칙

**이번 스프린트 동안 스키마를 함부로 바꾸지 않는다.**

바꿔야 한다면 아래를 지킨다.

1. 스키마 변경은 **별도 PR**로 올린다. 다른 기능 작업과 섞지 않는다.
2. **팀 합의**를 거친다. 최소 1명의 승인 없이 머지하지 않는다.
3. PR 본문에 무엇이 왜 바뀌는지, 기존 JSON 문서가 깨지는지를 적는다.
4. `visual-spec.schema.json`을 고쳤으면 `pnpm run generate:types`를 돌려 `types.ts`를 함께 커밋한다.
5. 예제와 테스트를 같이 갱신한다. `pnpm run typecheck`와 `pnpm test`가 통과해야 한다.

**선택 필드를 추가할 때 (2026-09-04 명문화)**

v0.1은 선택 필드가 `visible` 하나뿐이었고, "선택 필드는 `visible`만"이 암묵적 관행처럼 인용돼 왔다. 실제로 이 문서에 그런 문장이 있던 적은 없다. #75(`layout.columns`)와 #78(`shadow`·`opacity`·`blur`·`border.align`)이 잇따라 선택 필드를 늘리면서, 매번 "예외"라고 적는 대신 조건을 명시한다.

선택 필드는 **없을 때의 동작이 명확히 정의된 경우에만** 허용한다.

- 기본값을 스키마 `description`에 못박는다. `align` 없음 = `inside`, `opacity` 없음 = `1`, `blur` 없음 = `0`, `columns` 없음 = `1`열.
- 기본값이 **기존 문서의 현재 렌더와 같아야 한다.** 그래야 필드를 추가해도 이미 있는 JSON의 모양이 바뀌지 않는다.
- 기본값을 한 문장으로 못 적으면 필수 필드로 만들거나, 그 필드를 넣지 않는다.

객체를 통째로 받는 선택 필드(`shadow`, `border`, `background`)는 **내부 칸을 모두 필수로** 둔다. 한 칸만 채운 반쪽 객체는 스펙을 무효로 만들고 CSS도 깨뜨린다. 패널에서는 `borderPatch`·`shadowPatch`·`radiusPatch`의 merge 함수가 항상 완전한 객체를 만든다.

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
