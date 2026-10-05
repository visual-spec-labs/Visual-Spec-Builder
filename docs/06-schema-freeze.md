# 06. Visual Spec IR 스키마 동결 계약과 변경 절차

동결 시작: 2026-07-30

이 문서는 v0.1 계약이 무엇을 보장하고 무엇을 보장하지 않는지, 그리고 언제 바꿀 수 있는지를 적는다.

> **현재 버전은 0.3이다 (2026-10-05 기준).** 정본 `src/features/editor/schema/visual-spec.schema.json`의
> `VisualSpec`·`ProjectSpec` 모두 `version: "0.3"`이다. 동결은 v0.1에서 시작했고, 이후 변경은 아래
> "변경 규칙" 절차를 거쳐 절 단위로 추가됐다 — [v0.2 — ProjectSpec](#v02--projectspec-2026-09-01-추가)(#60),
> [v0.3 — 배경 채우기 겹 배열](#v03--배경-채우기-겹-배열-2026-10-04-추가-127)(#127),
> 그리고 버전을 올리지 않은 선택 확장인 [반응형](#반응형-선택-확장--222-pr-제안)(#245)과
> [이미지 배경](#이미지-배경-추가-계약-235-팀-리뷰-필요)(#254·#257). 각 절은 추가 당시의 기록이므로
> 본문의 "v0.1" 표기는 그 시점 기준으로 읽는다. 제목은 버전을 빼고 이 문서의 역할로 바꿨다(파일 경로는 그대로).

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
- `background` (채우기 겹 배열 `Fill[]` — `solid`·`linear`·`image`. 0.3부터, 아래 "v0.3" 절)
- `border` (`align`, 모서리별 `radius` 포함)
- `typography`
- `shadow` · `opacity` · `blur`
- `ScreenSpec.responsive` — 선택적 breakpoint·노드별 표현 override. 아래 반응형 확장 계약 참고.

지원하지 않는다.

- `component`
- `event`
- `token`
- 배경의 `radial` 채우기와 겹 표시 토글 — 정본에 없다. `solid`·`linear` 여러 겹은 정본(아래 "v0.3" 절 — `Background`가 `Fill[]`)·캔버스·패널·스킬이 모두 지원한다(#127 후속 1~5단계, 결정은 [13-background-fill-design.md](13-background-fill-design.md)). `image` 겹도 정본(#254)·편집·렌더·Export(#257)가 지원한다(아래 "이미지 배경 추가 계약" 절). 둘 다 기존 문서를 깨지 않는 추가 변경이라 필요해질 때 따로 연다.

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
  Background,    // Fill[] — 0.3
  Fill,          // SolidFill | LinearFill | ImageFill
  SolidFill,
  LinearFill,
  GradientStop,
  Responsive,
  Breakpoint,
  NodeOverride, // FrameOverride | TextOverride | ImageOverride | ButtonOverride | InputOverride
  PartialBox, PartialLayout, PartialPadding, PartialBorder, PartialRadius, PartialTypography,
} from "@/features/editor/schema";
```

값으로 내보내는 것은 일곱이다. 셋은 v0.1부터 있었고,

```ts
import {
  validateVisualSpec,      // (input: unknown) => ValidationResult, 절대 던지지 않는다
  assertVisualSpec,        // 실패 시 VisualSpecValidationError
  visualSpecJsonSchema,    // 스키마 JSON 원본
} from "@/features/editor/schema";
```

셋은 v0.2에서 늘었다. 아래 v0.2 절 참고.

```ts
import {
  validateProjectSpec,     // (input: unknown) => ValidationResult, 절대 던지지 않는다
  migrateV01,              // (spec: VisualSpec) => ProjectSpec
  toVisualSpec,            // (page: ScreenSpec) => VisualSpec
} from "@/features/editor/schema";
```

하나는 0.3에서 늘었다. 아래 v0.3 절 참고.

```ts
import {
  migrateToV03,            // (input: unknown) => unknown — 0.1·0.2 문서를 0.3으로. 검증 전에 부른다
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
| color | `TextNode.color`, `border.color`, 배경 겹의 색(`SolidFill.color`·`GradientStop.color`) — hex 문자열 |
| 배경 | `background` — 채우기 겹 배열(`Fill[]`, 앞이 위). 단색은 `[{ type: "solid", color }]`, 생략·`[]`은 배경 없음 (0.3) |
| 표시 / 숨김 | `visible` (생략 시 `true`) |
| 그림자 | `FrameNode.shadow`(선택) — `x`·`y`·`blur`·`spread`·`color` 전부 필수 |
| 불투명도 | `opacity`(선택, 0..1. 생략 시 `1`) — `frame`·`text`·`image` |
| 레이어 블러 | `blur`(선택, px. 생략 시 `0`) — `frame`·`text`·`image` |
| 테두리 정렬 | `border.align`(선택, `inside`\|`center`\|`outside`. 생략 시 `inside`) |
| 모서리 반경 | `border.radius` — `number` 또는 `{topLeft,topRight,bottomRight,bottomLeft}` |

검증된 예제는 여덟이다(프로젝트 예제 `two-page-project.json`은 아래 v0.2 절). #127 1단계에서 그때 있던 여덟(화면 일곱 + 프로젝트 하나) 모두 `migrateToV03`로 0.3이 됐다 — 손으로 고치지 않았다. `gradient-hero.json`은 #127 5단계에서 처음부터 0.3으로 썼다.

| 파일 | 확인하는 것 |
|---|---|
| `examples/empty-title-screen.json` | 노드 2개짜리 최소 화면. 중앙 정렬 |
| `examples/login-screen.json` | 중첩 프레임, border, 부분 투명 색상, 이메일·비밀번호 placeholder input 2개와 로그인 button(인증 동작 없음) |
| `examples/dashboard-cards.json` | `Header > Title` + `Content > Card, Card` 2단 트리. `direction: row` 카드 배치 |
| `examples/header-content.json` | 고정 높이(px) 헤더 + `space-between` + `fill` 본문 + `visible: false` |
| `examples/image-hero.json` | `image` 노드 — `fill` 너비 + 고정 높이(px), `fit: "cover"` |
| `examples/form-grid.json` | `button`/`input` 노드 + `layout.direction: "grid"`(`columns: 2`) 레이블-입력 쌍 배치 |
| `examples/card-effects.json` | `shadow` · `border.align: "outside"` · 모서리별 `radius` · `opacity`/`blur` 카드 3장 |
| `examples/gradient-hero.json` | `linear` 배경 — 여러 겹(반투명 오버레이 + linear, 반투명 오버레이 + 맨 아래 solid), 버튼 linear, 딱 끊기는 stop(같은 `at` 두 개), 각도 180·90·112.5 |

`dashboard-cards.json`은 스키마가 한 화면에만 맞춰진 구조가 아님을 확인하기 위해 만들었다.

---

## 이 계약이 보장하지 않는 것

- **화면 문서의 멀티 스크린.** `VisualSpec`은 여전히 파일 1개 = Screen 1개다. 여러 페이지가 필요하면 `ProjectSpec`을 쓴다(아래 참고).
- **`fontWeight`의 100 단위 제약.** JSON Schema는 강제하지만 생성된 TS 타입은 `number`다. 타입만으로는 못 막으니 `validateVisualSpec`을 거쳐야 한다.
- **편집 연산.** 노드 추가·삭제·이동·재부모화 함수는 없다. 지금은 각 화면이 직접 `nodes`를 다루므로 불변조건을 깨뜨릴 수 있다. `validateVisualSpec`은 예방 수단이 아니라 최후 방어선이다.
- **`ImageNode.src`가 가리키는 워크스페이스 assets 저장소.** 스키마는 문자열 참조만 정의한다. 실제로 파일을 어디에 저장하고 `src` 값을 어떻게 채우는지는 Import 기능 쪽 책임이다. **이 항목은 2026-09-18 이슈 #133으로 해소됐다** — 아래 "assets 저장소 연결" 참고.
- **Grid의 셀 배치.** `layout.columns`만큼 균등한 열로 자동 배치할 뿐, 특정 자식을 특정 셀·여러 칸에 놓는 기능은 없다. `mainAxis`/`crossAxis`는 grid에서 무시된다. 현재 DOM 렌더러를 유지한다(#236). 명시적 grid 셀 배치는 별도 스키마 설계·팀 리뷰가 필요하다.
- **Button/Input의 상호작용.** `content`/`placeholder`는 표시용 텍스트일 뿐 `onClick`/`value`/`onChange` 같은 이벤트·바인딩은 정의하지 않는다. props/bindings는 MVP 제외 범위(`docs/05-schema.md`)에 그대로 속한다.

---

## `fill`의 교차축 의미 확정 (2026-09-11 추가, 이슈 #46)

동결 당시 "이 계약이 보장하지 않는 것"에 있던 항목이다 — 원문은 이랬다.

> `Size`의 `"fill"` 의미. 교차축에서 어떻게 해석할지 정하지 않았다. 스키마는 값만 허용한다. Renderer 구현 시점에 정한다.

그 Renderer(`src/features/editor/ui/canvasLayout.ts`의 `boxStyle()`)가 이미 만들어졌고, 해석도 이미 정해져 동작하고 있었다 — 다만 그 결정이 이 문서를 거치지 않았다. 여기서 그 결정을 문서로 옮긴다. **#119 시점에는 코드를 바꾸지 않았다** — 그때 구현이 맞았다. 최상위 노드의 세로만 그 직후 이슈 #86 으로 달라졌고, 아래 절에 따로 적는다.

```
주축(부모 layout.direction과 같은 축) fill  →  flex-grow: 1; flex-shrink: 1; flex-basis: 0
교차축 fill                                →  align-self: stretch
부모가 없는 최상위 노드(아트보드의 root)     →  box 를 보지 않는다. 항상 width: 100% + flex: 1 0 auto
grid 아이템(flex 배분 자체가 뜻이 없음)      →  width/height: 100%(교차축과 동일 취급)
```

### 왜 이 해석인가

- **주축을 `width: 100%`로 옮기면 안 되는 이유.** flex 아이템의 기본값 `min-width: auto`(row 기준) 때문에 각 아이템이 자기 콘텐츠의 최소 크기 밑으로 줄어들지 않는다. 그러면 **한 자식의 패딩·폰트를 키우면 형제의 너비까지 끌려간다** — 실제로 이슈 #54로 제보된 "형제 요소에 간섭" 버그가 이것이었고, #55에서 `flex: 1 1 0` + `min-width/height: 0`으로 고쳤다.
- **교차축을 퍼센트로 옮기면 안 되는 이유.** 부모 크기가 `auto`(Hug)일 때 CSS 규격상 퍼센트 값이 무시되어 아무 일도 일어나지 않는다. `align-self: stretch`는 부모 크기와 무관하게 동작한다.

### 최상위 노드의 세로 fill은 flex다 (2026-09-11 갱신, 이슈 #86)

이 절을 처음 쓸 때(#119) 최상위 노드는 `width/height: 100%` 였다. 그 직후 이슈 #86 이
**아트보드를 내용에 따라 세로로 자라는 문서로** 바꾸면서 세로만 달라졌다.

아트보드 높이가 `height` 에서 `min-height` 로 바뀌자, root 의 `height: 100%` 가
**바로 위 "교차축을 퍼센트로 옮기면 안 되는 이유"와 같은 함정**에 걸렸다 — 부모 높이가
`auto` 면 퍼센트가 CSS 규격상 무시된다. 그러면 root 배경이 내용 높이에서 끊기고 첫 화면
아래로 캔버스 바탕이 비친다. 그래서 아트보드를 세로 flex 컨테이너로 만들고 root 를 그
아이템으로 두었다.

```
flex-grow: 1    내용이 첫 화면보다 짧으면 남은 높이를 채운다
flex-shrink: 0  길면 줄지 않고 아트보드를 밀어낸다(1이면 min-height 안으로 쭈그러든다)
flex-basis: auto 기준은 내용 높이
```

가로는 그대로 `100%` 다 — 아트보드 폭은 `page.size.width` 로 고정이라 퍼센트가 통한다.

**그리고 root 는 자기 `box` 를 아예 보지 않는다.** 페이지 크기를 정하는 것은
`page.size` 하나여야 하는데, root 가 `box` 를 따로 갖고 둘이 어긋나면 아트보드
경계와 root 네모가 따로 놀아 격자 위에 네모가 둘 겹쳐 보인다. 캔버스에서 root 를
리사이즈하면(PR #99 의 핸들) `box.width` 가 `"fill"` 에서 고정 숫자로 바뀌어 실제로
그 상태가 만들어졌다 — 그래서 `boxStyle` 은 root 의 `box` 를 무시한다. 리사이즈 핸들은
root 에도 그대로 있지만, root 를 끌면 `box` 가 아니라 **`page.size`(해상도)** 를 바꾼다 —
root 는 곧 페이지라 끄는 대상이 페이지 크기인 것이 맞고, 그래야 패널의 해상도 칸도 함께 움직인다.
`examples/` 9개와 `seedSpec`·`blankSpec` 의 root 는 전부 이미 `fill`·`fill` 이라
**grid 아이템은 이 변경에서 빠졌다.** flex 아이템이 아니라 배분 자체가 뜻이 없어서이고,
`test/canvas-layout.test.ts` 가 그 갈라짐을 케이스로 고정한다.

`size.height` 의 의미는 [`05-schema.md`](05-schema.md)의 Screen 항목 참고 — 문서 높이가
아니라 첫 화면 높이다. 정본 스키마는 바뀌지 않았다.

`test/canvas-layout.test.ts`가 이 동작을 케이스로 고정하고 있다 — 결정은 실패를 겪고 나온 것이라 근거가 코드와 테스트 양쪽에 있다.

### 매핑 참고표는 이미 맞았다

`skills/visual-spec-to-react/SKILL.md`의 매핑 참고표(`box.width`/`height` = `"fill"` 행 3개 — 주축/교차축/root)는 이 결정과 이미 일치한다. 이슈 본문은 "매핑 참고표에 이 경우가 없다"고 지적했지만, 확인해보니 이미 들어와 있었다(스킬이 먼저 맞고, 06 문서만 못 따라간 상태였다) — 그래서 이 PR은 스킬 파일을 고치지 않았다.

---

## v0.2 — ProjectSpec (2026-09-01 추가)

파일 1개에 페이지 여러 개를 담기 위해 최상위 타입을 **하나 더** 두었다. #60.

> 버전 표기는 0.3에서 바뀌었다 — 지금은 두 타입 모두 `"0.3"`이고, 화면/프로젝트는 버전이 아니라 키(`screen`/`pages`)로 가른다. 아래 "v0.3" 절. 이 절은 v0.2 당시의 기록이다.

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
- **`border.align`을 `outline`으로 그리지 않는다.** 브라우저 포커스 링과 겹치고, `box-shadow`로 그려야 `shadow`와 한 문자열에 합칠 수 있다. `inside`는 CSS `border` 속성 그대로, `center`/`outside`는 `box-shadow` 고리로 그린다. `shadow`와 같은 칸을 쓰므로 `canvasLayout.strokeAndShadowStyle`이 한 문자열로 합성한다. (2026-09-04 이 규칙을 정할 때의 이유는 "캔버스가 선택 표시에 이미 `outline`을 쓰고 있어서"였다. 2026-09-08·이슈 #90으로 선택 표시가 캔버스 오버레이로 빠져 그 충돌은 없어졌지만, 위 두 이유가 남아 규칙은 그대로다.)
- **`inside`만 CSS `border` 속성을 유지하는 이유.** `box-shadow`는 레이아웃 박스를 차지하지 않는데, 기존 문서가 전부 `border` + `box-sizing: border-box`(= `inside`)로 그려져 있다. 여기서 갈아타면 안쪽 여백이 달라진다.
- **`blur`는 Layer blur만이다.** 자기 자신과 자식이 함께 흐려진다. 뒤 배경을 흐리는 Background blur(`backdrop-filter`)는 다른 기능이라 포함하지 않았다.
- **`opacity`/`blur`가 걸린 프레임 안에서는 선택 표시도 함께 흐려진다.** CSS `opacity`·`filter`가 자식 전체에 걸리기 때문이다. 선택 표시를 캔버스 오버레이로 분리해야 풀리는 구조적 문제라 별도 이슈로 둔다.
- **`button`·`input`에는 `shadow`·`opacity`·`blur`를 아직 두지 않았다.** 두 노드는 속성 패널이 없어 스키마에만 있고 편집할 수 없는 필드가 된다. `border.align`·모서리별 `radius`는 `Border` $def에 붙어서 두 노드도 함께 따라온다.
- **다중 채우기·그라디언트는 여기 없다.** `Background.color`를 배열/유니온으로 바꿔야 해서 기존 문서가 깨진다. 마이그레이션 합의가 필요하므로 #78 2단계로 분리했다. → #127이 [13](13-background-fill-design.md)에서 정하고 0.3에서 스키마를 바꿨다(아래 "v0.3" 절).

---

## assets 저장소 연결 — `ImageNode.src`가 다시 경로가 됐다 (2026-09-18 추가, 이슈 #133)

동결 당시 "이 계약이 보장하지 않는 것"에 있던 항목이다 — 원문은 이랬다.

> **`ImageNode.src`가 가리키는 워크스페이스 assets 저장소.** … 아직 워크스페이스 계층 자체가 저장소에 없다. 그래서 `ui/importImageFromFile.ts`는 **파일 전체를 base64 data URI로 스펙 안에 담는 우회**를 택했다 … 워크스페이스 assets 저장소가 생기면 경로/assetId로 되돌리는 문제로 다시 다룬다. **미해결 항목으로 남는다.**

이슈 #133이 그 저장소를 만들었다. Vite 개발 서버에 `.visual-spec/` 파일 입출력 미들웨어가
붙어서, File ▸ Import가 이미지를 `.visual-spec/assets/`에 **파일로 저장하고 `src`에는
`assets/hero.png` 같은 상대 경로를 넣는다.** 예고한 대로 되돌린 것이다.

**스키마는 바뀌지 않았다.** `src`는 그대로 "비지 않은 문자열"이고 `description`만 갱신했다
(`description`만 고치는 것은 동결 대상이 아니다 — 아래 변경 규칙 참고). 세 형태(상대 경로 ·
`assetId` · data URI)를 다 받는다는 계약도 그대로다.

**data URI는 계속 유효하다.** 두 가지 이유로 남긴다.

- **기존 스펙 호환.** #133 이전에 Import한 스펙에는 data URI가 그대로 들어 있다. 그 문서들이
  계속 열리고 그려져야 한다 — `ui/properties/imageSrc.ts`가 두 형태를 구분해서, 경로는 작업공간
  파일 라우트로 바꾸고 data URI는 손대지 않는다.
- **폴백.** 작업공간이 없거나(개발 서버 미들웨어 없이 뜬 빌드 결과물) assets 화이트리스트 밖
  확장자(`.heic` 등)면 Import는 예전처럼 data URI로 담는다. 기능이 사라지는 것보다 낫다.

읽는 쪽은 여전히 `src`의 형태를 스스로 구분해야 한다. 그 점은 동결 당시와 같다.

---

## v0.3 — 배경 채우기 겹 배열 (2026-10-04 추가, #127)

[13-background-fill-design.md](13-background-fill-design.md)의 결정 중 1단계(스키마 전환)를 반영했다. **기존 JSON 문서가 깨지는 변경이다** — 앱이 열 때 자동 변환한다.

| 무엇 | 0.1·0.2 | 0.3 |
|---|---|---|
| `VisualSpec.version` | `"0.1"` | `"0.3"` |
| `ProjectSpec.version` | `"0.2"` | `"0.3"` |
| `background` | `{ "color": c }` | `[{ "type": "solid", "color": c }]` — `Fill[]`, 앞이 위, 빈 배열 허용 |

```jsonc
"background": [
  { "type": "linear", "angle": 180, "stops": [
      { "color": "#0F172A00", "at": 0 },
      { "color": "#0F172ACC", "at": 1 }
  ] },
  { "type": "solid", "color": "#6366F1" }
]
```

- **새 `$defs`.** `Fill`(`SolidFill` | `LinearFill`의 `oneOf`), `SolidFill`, `LinearFill`(`angle` `[0, 360)` · `stops` 2개 이상), `GradientStop`(`color` · `at` 0..1). 생성 타입도 같은 이름으로 공개된다(위 "정본과 공개 표면").
- **버전은 IR 세대를 뜻한다.** 화면 문서와 프로젝트 문서가 같은 `"0.3"`을 쓰고, 둘은 키(`screen`/`pages`)로 가른다. `store/loadSpec.ts`의 판정도 키 기준이 됐다.
- **변환은 입구 두 곳에서 한다.** `parseSpecJson`(Open·홈 목록)과 `specStorage`의 자동 저장 복원이 `migrateToV03` → 새 검증기 순서로 읽는다. 변환은 버전과 키가 짝이 맞는 문서(`0.1`+`screen`, `0.2`+`pages`)의 "문자열 `color` 하나만 가진" `background`만 바꾸고, 그 밖의 값은 그대로 둬 검증이 보고하게 한다. `validateVisualSpec`·`validateProjectSpec` 자체는 변환하지 않는다 — 0.1·0.2 문서를 직접 넣으면 무효다.
- **저장은 항상 0.3이다.** 열기는 파일을 다시 쓰지 않는다. 처음 저장할 때 0.3이 된다.
- **`IssueCode` 8종 → 9종.** stop의 `at` 오름차순(같은 값 허용)은 배열 원소끼리 비교하는 문법이 없어 두 검증기가 `gradient-stop-order`로 잡는다.
- **`migrateV01`·`toVisualSpec`은 이름을 유지한다.** 공개 API라서다. 입출력은 0.3이다.
- **구버전은 0.3 문서를 못 읽는다.** 갱신 전 빌드와, `npx visual-spec skills`로 복사해 둔 옛 스킬 사본이 해당한다 — 스킬은 다시 복사해야 한다.
- **그리기·편집·코드 생성.** 캔버스와 홈 미리보기는 13의 후속 2단계부터 `linear` 겹과 여러 겹을 그린다. 패널은 3단계부터 겹을 추가·삭제·위/아래 이동·종류 전환하고 linear의 각도·stop을 편집한다. 스킬은 4단계부터 그라디언트 작성·NL 편집·코드 생성을 가르친다. 실물은 `examples/gradient-hero.json`(5단계)이다.

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

객체를 통째로 받는 선택 필드(`shadow`, `border`)는 **내부 칸을 모두 필수로** 둔다. 한 칸만 채운 반쪽 객체는 스펙을 무효로 만들고 CSS도 깨뜨린다. 패널에서는 `borderPatch`·`shadowPatch`·`radiusPatch`의 merge 함수가 항상 완전한 객체를 만든다. `background`는 0.3부터 배열이라 같은 생각을 겹 단위로 적용한다 — 겹(`SolidFill`·`LinearFill`·`GradientStop`)의 칸은 모두 필수이고, 배열은 경로로 한 칸만 쓰지 못해 항상 통째로 쓴다(`backgroundPatch`).

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


## 반응형 선택 확장 — #222 PR 제안

현재 상태: 아래 제안은 #245로 병합됐다. 구조·제약을 다시 변경할 때는 위 변경 규칙을 따른다.

정본의 `ScreenSpec.responsive`를 선택 필드로 추가한다. **문서 버전 0.3 유지가 이 PR의
리뷰 제안**이며, 최소 1명의 팀 승인 없이 병합하지 않는다. 기존 0.3 문서는 변환 없이 새
검증기를 통과한다. 확장 전 0.3 validator는 `additionalProperties: false` 때문에
`responsive`가 있는 새 문서를 거부한다. 같은 버전이라는 이유로 양방향 호환을 보장하지
않는다. 기존 0.1/0.2 문서는 이전과 같이 입구에서 0.3 변환 후 검증한다.

- 생략 시 기존 단일 레이아웃이다. 블록을 쓸 때 `breakpoints`와 `overrides` 두 맵은 필수이며
  빈 맵은 허용한다. ID 형식은 NodeId와 같은 영문·숫자·밑줄·하이픈이다.
- breakpoint 폭은 양의 CSS px이고 페이지 안에서 중복되지 않는다. 숫자 폭 오름차순으로
  기본 노드 위에 override를 누적한다. 선언되지 않은 breakpoint나 없는 노드는 거부한다.
- 타입별 `FrameOverride`, `TextOverride`, `ImageOverride`, `ButtonOverride`, `InputOverride`가
  해당 노드에 정의된 표현 속성만 받는다. `shadow`는 이번 범위 밖이며 정체성·내용·트리는
  바꿀 수 없다. 공통 `NodeOverride`는 이들 중 하나지만, 실제 노드 타입과의 대응은 의미
  검증이 보장한다.
- `PartialBox/Layout/Padding/Border/Radius/Typography`는 생략한 칸을 상속한다. **기본 노드의
  필수 칸 규칙을 완화하지 않는다.** 모든 breakpoint 적용 결과가 완전한 노드여야 한다.
  기반에 border가 없으면 `{border:{width:2}}`는 무효이고, color·radius도 제공해야 한다.
  숫자 radius를 corner 객체로 바꾸면 네 모서리를 전부 제공해야 하며, 이미 corner 객체인
  경우에는 한 모서리만 바꿀 수 있다. 숫자에서 다른 모서리 값을 추측하지 않는다.
- 배열은 통째로 교체한다. `background: []`는 배경 제거, 생략은 상속이다. 개별 fill과
  stop은 여전히 완전해야 하고 stop 오름차순 검사도 적용된다. `null` 삭제 연산은 없다.
- 새 IssueCode: `responsive-breakpoint-missing`, `responsive-node-missing`,
  `responsive-duplicate-width`, `responsive-node-property`, `responsive-effective-node`.
  오류 경로는 `screen/responsive` 또는 `pages/<id>/responsive` 아래 override를 가리킨다.
- 맵 키는 객체에서 고유하다. 원문 JSON에 같은 키를 두 번 썼는지는 `JSON.parse` 후에는
  복원할 수 없어 이 객체 validator의 검증 범위 밖이다.

`examples/responsive-cards.json`과 `test/responsive-schema.test.ts`가 계약 예제다.
GUI·캔버스·Command 편집·코드 생성 지원은 #223/#224에서 별도로 구현했다(#247·#248·#252 병합).
이 절은 스키마 계약만 다룬다.


## 이미지 배경 추가 계약 (#235, 팀 리뷰 필요)

현재 상태: 아래 계약은 스키마 #254와 기능 #257로 병합됐다. 향후 계약 변경의 리뷰 규칙은 유지한다.

`Fill`에 `{ type: "image", src, fit }`를 추가한다. `fit`은 `cover`·`contain`·`fill`
셋뿐이며 중앙 정렬·반복 없음이다. frame/button/input 및 해당 responsive background
전체 배열에서 같은 계약을 쓴다. repeat와 위치 조절은 이번 범위에 없다.

`src`는 기존 ImageNode처럼 비지 않은 문자열이며 assets 상대 경로, assetId, 기존 data URI를
보존한다. assetId는 기존 경로 해석과 동일하게 다룬다(별도 자산 레지스트리 없음).
ImageNode 자체를 배경으로 삽입하지 않는다. leaf 노드의 box/선택/자식 구조와 배경 겹은
역할이 다르므로 src/fit 및 이미지 URL 해석만 공유한다.

추가 유니온 갈래이므로 version은 0.3을 유지한다. 기존 0.3 solid/linear 문서는 변경하지
않으며 `migrateToV03`의 기존 0.1/0.2 단색 마이그레이션도 유지한다. 구버전 앱은 image
갈래를 읽지 못하므로 이미지 배경을 사용한 파일은 새 버전에서 연다.

**정본·생성 타입·계약 테스트 PR은 기능 PR과 분리하고 병합 전에 팀 스키마 리뷰가 필요하다.**
스키마 PR의 기존 UI 타입 가드는 후속 기능 PR의 renderer/편집 지원을 대신하지 않는다.
