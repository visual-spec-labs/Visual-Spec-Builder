---
name: visual-spec-to-react
description: Visual Spec JSON(version, screen.root, screen.nodes 구조)을 React/Tailwind 컴포넌트 코드로 변환한다. "이 Visual Spec으로 화면 만들어줘", "이 JSON을 React 컴포넌트로 변환해줘", "login-screen.json 코드로 구현해줘"처럼 Visual Spec을 구현해달라는 요청, "이 JSON들 한번에 변환해줘", "examples 폴더에 있는 스펙 다 코드로 만들어줘"처럼 여러 개를 한 번에 요청하는 경우, visual-spec-authoring이 후속 피드백을 반영해 스펙을 고친 뒤 넘기는 재생성 요청, 또는 대화나 첨부 파일에 Visual Spec 형태의 JSON이 있을 때 실행한다.
---

# Visual Spec → React 코드 생성

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

Visual Spec JSON을 읽어 React(TSX) + Tailwind 코드를 직접 작성한다. JSON을 코드로 바꿔주는
별도의 변환 함수는 없다 — 이 Skill의 지시문과 아래 매핑 규칙을 참고해 매번 새로 코드를 쓴다.

## 실행 순서

1. **대상 JSON을 찾는다.** 사용자가 경로를 줬거나 대화/첨부 파일에 포함돼 있다.
2. **검증한다.** `@/features/editor/schema`의 `validateVisualSpec`을 호출한다.
   ```ts
   import { validateVisualSpec } from "@/features/editor/schema";
   ```
   실패하면 반환된 `issues`를 사용자에게 그대로 보여주고 **중단한다**. 임의로 고치지 않는다.
3. **통과하면 아래 매핑 참고표를 따라 TSX 코드를 직접 작성한다.** 표에 없는 상황을 만나면
   판단해서 채우되, 왜 그렇게 했는지 한 줄로 밝힌다. 화면이 컴포넌트 여러 개로 쪼개질
   상황이면 "컴포넌트 단위로 분리 생성한다" 절을 먼저 본다. `screen.responsive`가 있으면
   아래 반응형 절대로 기반과 모든 breakpoint를 함께 옮긴다.
4. **고정 워크스페이스 경로에 쓴다.** 대상 프로젝트 구조를 분석하거나 사용자에게 위치를
   묻지 않는다. Visual Spec Builder는 라이브러리로 설치돼 프로젝트마다 폴더 구조가 다른
   상태로 쓰이므로, 대상 프로젝트에 의존하지 않는 도구 전용 경로에 쓴다.
   ```
   .visual-spec/generated/pages/<PageName>.tsx
   .visual-spec/generated/components/<ComponentName>.tsx
   ```
5. **파일을 쓰고 결과를 보고한다.** prettier/eslint 같은 포매터는 사용자가 요청하지 않는
   한 자동으로 돌리지 않는다.

**export 방식은 위치로 정해진다.** `pages/`의 페이지 컴포넌트는 `export default function
<PageName>() {...}`, `components/`의 컴포넌트는 `export function <ComponentName>() {...}`
(named export)로 쓴다 — 아래 예제가 전부 이 규칙이다. 섞어 쓰는 것처럼 보이지만 의도된
일관성이다(이슈 #188로 확인) — 페이지는 서로를 import하지 않아 default export라 불러오는
쪽마다 이름을 자유롭게 붙일 수 있고, 컴포넌트는 다른 파일이 `import { Card } from
"./Card"`처럼 이름으로 가져오므로 named export가 오타를 막는다.

## 컴포넌트 단위로 분리 생성한다

지금까지는 화면 하나를 파일 하나에 통째로 담았다. 화면이 커지면(섹션이 여러 개거나,
같은 모양이 반복되면) 페이지 파일 하나가 비대해지고 재사용도 안 된다. 아래 순서로
여러 파일로 쪼갠다.

### 1. 컴포넌트 경계를 정한다

1. **root의 직계 자식(frame) 각각을 별도 컴포넌트 후보로 본다.** 예: `Header`, `Sidebar`,
   `Content`. root 자신은 이들을 조합하는 **페이지 컴포넌트**가 된다.
2. **그 안에서 형제 노드가 구조적으로 반복되면(같은 자식 구성, 다른 내용만) 그 반복
   단위를 하위 컴포넌트로 뽑는다.** 예: `Content` 아래 `Card` 3개가 레이아웃·자식
   타입이 똑같고 텍스트만 다르면 `StatCard` 컴포넌트 하나로 뽑고 3번 호출한다. 내용이
   다른 부분(텍스트, 색상 등)은 props로 넘긴다. 스키마 자체에는 "컴포넌트"나 "props"
   개념이 없다(v0.1 제외 범위) — 이건 스펙을 그대로 반영하는 게 아니라 **코드 생성
   시점의 판단**이다.
3. **반복이 없는 하위 트리는 그 부모 컴포넌트 파일 안에 인라인한다.** 모든 프레임을
   따로 뽑지 않는다 — 재사용되지 않는데 파일만 늘리면 오히려 읽기 어렵다.
4. 경계가 애매하면(형제가 완전히 같지는 않은데 비슷하다거나) 판단해서 정하되, 왜
   그렇게 나눴는지 한 줄로 밝힌다.

### 2. 의존성 순서대로 만든다

자식 컴포넌트를 부모보다 먼저 만든다. 트리를 post-order로 순회하는 것과 같다 — 가장
안쪽 반복 컴포넌트부터 시작해서 마지막에 페이지 컴포넌트를 만든다.

```
StatCard → StatCardGrid → Sidebar → Header → DashboardPage
```

각 컴포넌트를 만들 때마다(대기 → 진행 → 완료) 진행 상황을 짧게 보고한다. 하나가
실패해도("여러 화면을 한 번에 처리한다"와 같은 원칙으로) 나머지 컴포넌트는 계속
만들고, 실패한 것만 표시해 보고한다.

### 3. 상대 경로로 import한다

`@/` 같은 프로젝트 전용 별칭을 쓰지 않는다. `.visual-spec/generated/`가 어느 프로젝트에
설치되든 그대로 동작해야 하기 때문이다 — 별칭은 그 프로젝트의 tsconfig 설정에 의존하는데,
설치 대상마다 설정이 다르거나 아예 없을 수 있다.

```tsx
// components/StatCardGrid.tsx
import { StatCard } from "./StatCard";

// pages/DashboardPage.tsx
import { StatCardGrid } from "../components/StatCardGrid";
import { Sidebar } from "../components/Sidebar";
```

같은 폴더는 `./`, 상위 폴더로 나갈 땐 `../`만 쓴다. 파일 위치(`pages/` vs `components/`)가
정해져 있으므로 상대 경로 depth는 항상 예측 가능하다.

## 여러 화면을 한 번에 처리한다

요청에 Visual Spec JSON이 여러 개 걸리면(경로 목록, 폴더, "다 변환해줘" 같은 요청) 위
실행 순서를 파일마다 반복하되 아래는 다르게 한다.

- **하나가 검증에 실패해도 배치를 멈추지 않는다.** 단일 파일 처리 때는 실패하면 그 자리에서
  중단하지만, 배치에서는 그 파일의 실패를 기록해두고 나머지 파일은 계속 처리한다. 화면
  9개 중 1개가 틀렸다고 나머지 8개까지 막을 이유가 없다.

(파일 위치는 4번과 같이 항상 고정 경로라, 배치라고 해서 미리 확인할 것이 따로 없다.)

끝나면 파일별 결과를 표로 보고한다.

| 파일 | 컴포넌트 | 결과 |
|---|---|---|
| `login-screen.json` | `Login` | 작성됨 — `.visual-spec/generated/pages/Login.tsx` |
| `dashboard-cards.json` | `DashboardPage` | 검증 실패 — `child-missing` 1건 |

표는 요약일 뿐이다. 실패한 파일은 표 아래에 `issues` 전체를 그대로 붙인다 — 단일 파일
처리 때(2번)와 마찬가지로 원인을 감추지 않는다.

## 이미 생성한 파일을 다시 만들 때

[visual-spec-authoring](../visual-spec-authoring/SKILL.md)에서 후속 피드백("버튼 색
바꿔줘" 등)을 반영해 원본 스펙 JSON을 고치고 넘어온 경우다. 같은 스펙은 항상 같은
경로(4번)에 쓰이므로 원래 파일을 그대로 덮어쓰면 된다 — 새로 만들 때와 위치를 다시
정할 이유가 없다. 새 화면을 처음 만들 때와 다르게 동작하는 건 이것 하나뿐이다.

- **결과를 새 코드 전체가 아니라 무엇이 바뀌었는지 diff로 요약해 보고한다.** 사용자가
  요청한 건 "버튼 색 바꿔줘" 하나인데 파일 전체를 다시 붙여 넣으면 실제로 뭐가
  바뀐 건지 찾기 어렵다.

## 반응형 (`screen.responsive`)

이 절은 #222의 선택적 반응형 스키마 계약을 사용하는 문서에 적용한다. 별도 변환 엔진이나
대상 프로젝트 자동 분석 기능을 추가하지 않는다. `responsive`가 없으면 기존 매핑 그대로다.

### 누적 값과 CSS 경계

1. `responsive.breakpoints`를 **`minWidthPx` 숫자 오름차순**으로 정렬한다. ID의 이름이나
   JSON 키 순서는 적용 순서가 아니다. `size.width`는 초기 아트보드 폭이며 breakpoint가 아니다.
2. 기본 `nodes`에서 시작해 각 경계 이상(`>=`)에서 해당 override를 누적한다. 객체는 재귀
   병합하고 **배열은 통째 교체**한다. 생략은 상속이다. `background: []`는 배경을 지운다.
3. 각 구간의 **완성된 노드와 부모 레이아웃**을 매핑한 뒤 이전 구간과 달라진 CSS를 낸다.
   override 키에 접두어만 붙이면 안 된다. 부모 row/column/grid 변화는 override가 없는
   자식의 `fill` 해석도 바꾼다. 반복 컴포넌트의 인스턴스별 override가 다르면 정적인 전체
   클래스 문자열을 props로 전달하는 등 차이를 보존한다. 한 인스턴스의 배경/폭을 공유하지 않는다.
4. 기본은 `min-[768px]:gap-[16px]`, `min-[1024px]:gap-[24px]` 같은 **숫자 px variant**다.
   ID가 `tablet`이어도 `md:`로 추측하지 않는다. 사용자에게 제공받은 대상 설정에서 named
   variant의 실제 경계가 같은 CSS px임을 확인하고, 정렬도 같은 경우에만 그 이름을 쓸 수 있다.
   `48rem`을 근거 없이 768px로 단정하지 않는다. 프로젝트를 자동 검색하거나 설정을 바꾸지 않는다.
   한 화면에서 px/rem variant를 섞어 정렬을 추측하지 말고, 불확실하면 전부 숫자 px로 통일한다.
5. Tailwind가 스캔할 수 있도록 **완전한 클래스 문자열을 리터럴로 쓴다**. 런타임에
   `min-[${width}px]:...`처럼 조립하지 않는다. 사용자 제공 Tailwind 버전이 임의 min variant를
   지원하지 않거나 복합 속성 reset을 확신할 수 없으면 아래 일반 CSS 방식으로 내보낸다.

`examples/responsive-cards.json`의 root는 다음 클래스다. desktop가 JSON에서 먼저 선언돼도
768px padding-left=32가 1024px에도 남고, 1024px에서 gap=32·배경 없음으로 바뀐다.

```tsx
<div className="flex flex-row gap-[24px] pt-[48px] pr-[48px] pb-[48px] pl-[48px] bg-[#F1F5F9] w-full h-full min-[768px]:pl-[32px] min-[1024px]:gap-[32px] min-[1024px]:bg-transparent min-[1024px]:bg-none min-[1024px]:[background-origin:padding-box]">{/* 자식들 */}</div>
```

### 배경 배열은 color와 image를 함께 교체한다

배경은 CSS 속성 하나가 아니다. 앞선 폭의 클래스를 남긴 채 색만 바꾸면 기존 그라디언트가
계속 위에 그려지고, gradient만 바꾸면 예전 단색이 투명 stop 아래에 남는다. **background
배열을 override한 경계마다 아래 세 속성을 모두 설정한다.** background 생략에는 reset을
내지 않는다. 아래 모든 클래스에 그 경계의 같은 접두어를 붙인다.

| 새 배열 | background-color | background-image | background-origin |
|---|---|---|---|
| `[]` | `bg-transparent` | `bg-none` | `[background-origin:padding-box]` |
| solid 한 겹 | `bg-[#...]` | `bg-none` | `[background-origin:padding-box]` |
| 맨 아래 solid + 위 겹들 | 아래 solid의 `bg-[#...]` | 위 겹을 `bg-[image:...]` 하나로 | `bg-origin-border` |
| 맨 아래가 linear인 한/여러 겹 | `bg-transparent` | 모든 겹을 `bg-[image:...]` 하나로 | `bg-origin-border` |

예: gradient+solid에서 768px에 파란 solid로 바꾸려면
`min-[768px]:bg-[#0000FF80] min-[768px]:bg-none min-[768px]:[background-origin:padding-box]`.
1024px에 비우려면
`min-[1024px]:bg-transparent min-[1024px]:bg-none min-[1024px]:[background-origin:padding-box]`.
solid에서 gradient-only로 바꾸면 `min-[768px]:bg-transparent`도 반드시 낸다. 겹 순서·각도·
stop과 `image:` 힌트는 아래 기존 배경 규칙 그대로다. `background` shorthand와 개별 속성을
섞지 않는다. base/override에 inline `style`로 배경을 두면 responsive 클래스보다 우선하므로 피한다.

### 다른 속성의 reset과 일반 CSS 대안

- 어떤 폭에서든 보이는 노드는 DOM에서 제거하지 않는다. 해당 폭만 `hidden`, 다시 보일 때
  frame은 `flex`/`grid`, text는 `block`, button/input/image는 캔버스에 맞는 display로 복원한다.
  `block`으로 frame의 flex/grid를 덮지 않는다. 숨은 부모의 자식도 마찬가지다.
- row/column/grid 전환에는 컨테이너뿐 아니라 자식의 flex-grow/shrink/basis, width/height,
  align-self와 최소 크기를 다시 매핑한다. 예전 `flex-1`/`self-stretch`가 더 이상 필요 없으면
  `flex-[0_1_auto]`/`self-auto` 등의 reset을 명시한다. grid에서 flex로 돌아오면 grid columns도
  해제한다. CSS가 바뀌지 않는 `box` 키도 부모 방향 때문에 다시 계산할 수 있다.
- inside↔outside/center 테두리는 border-width와 합성 box-shadow를 함께 재계산한다.
  border.radius 숫자↔객체 전환은 네 모서리 전체를 낸다. `opacity: 1`, `blur: 0`처럼 기본으로
  돌아오는 값도 이전 효과를 제거하는 선언(`opacity-[1]`, `blur-none`)을 낸다.
- 일반 CSS fallback은 화면/노드별로 충돌하지 않는 클래스를 만들고, 기본 규칙 뒤에
  `@media (min-width: 768px)`, `@media (min-width: 1024px)`를 작은 폭부터 배치한다.
  기반과 반응형이 같은 속성을 소유하게 하고, inline style·다른 레이어의 Tailwind 규칙과
  우선순위를 다투게 두지 않는다. 배경은 `background-color`, `background-image`,
  `background-origin`을 위 표의 값(`transparent`, `none`, `padding-box` 등)으로 모두 쓴다.
  현재 Export가 별도 `.css` 파일을 수집한다고 가정하지 않는다. 필요하면 해당 TSX 안의
  `<style>{정적인 CSS 문자열}</style>`로 포함하고, 동적 노드 이름을 CSS에 무검증 삽입하지 않는다.

각 breakpoint의 직전/정확한 경계/다음 구간에서 컴파일된 CSS와 렌더를 검증한다. 클래스
문자열만 보고 통과했다고 말하지 않는다. 실제 AI 생성 실행 여부, 수동 매핑 fixture 결과,
캔버스 비교 여부를 구분해서 보고한다. 실측 조건과 사례는 `docs/16-responsive-codegen-qa.md`에 있다.

## 매핑 참고표

강제 규격이 아니라 **일관성을 위한 기본값**이다. JSON에 없는 상황은 판단해서 채운다.

| 스키마 필드 | 기본 대응 |
|---|---|
| `box.width`/`height` = `number` | `w-[Npx]` / `h-[Npx]` |
| `box.width`/`height` = `"auto"` | `w-auto` / `h-auto` |
| `box.width`/`height` = `"fill"`, 부모 주축 방향 | `flex-1` |
| `box.width`/`height` = `"fill"`, 부모 교차축 방향 | `self-stretch` |
| `box.width`/`height` = `"fill"`, root(부모 없음) | `w-full` / `h-full` |
| `layout.direction` = `"row"`/`"column"` | `flex flex-row` / `flex flex-col` |
| `layout.direction` = `"grid"` | `grid grid-cols-[N]` (N은 `layout.columns`, 없으면 1). `mainAxis`/`crossAxis`는 grid에서 무시한다 — 아래 "grid 레이아웃" 참고 |
| `layout.gap` | `gap-[Npx]` |
| `layout.padding.*` | `pt-/pr-/pb-/pl-[Npx]` |
| `layout.mainAxis` | `justify-start`/`center`/`end`/`between` |
| `layout.crossAxis` | `items-start`/`center`/`end`/`stretch` |
| `background` = solid 한 겹 `[{ "type": "solid", "color": c }]` | `bg-[c]` (`bg-[#RRGGBB(AA)]`) |
| `background` = 그 밖(여러 겹·`linear` 겹) | 맨 아래 solid는 `bg-[c]`, 나머지 겹은 `bg-[image:…]` 한 클래스 + `bg-origin-border`. 아래 "배경 채우기 (`background`)" 참고 |
| 기반 `background` 생략·`[]` | 배경 클래스를 붙이지 않는다. 반응형 배열 교체는 아래 reset 규칙 사용 |
| `border.width/color` | `border-[Npx] border-[#..]` — 단, `align`이 `inside`가 아니면 아래 "테두리 정렬" 참고 |
| `border.radius` = `number` | `rounded-[Npx]` |
| `border.radius` = 객체 | `rounded-[Apx_Bpx_Cpx_Dpx]` (좌상 · 우상 · 우하 · 좌하 순서) |
| `border.align` | 아래 "테두리 정렬" 참고. 없으면 `inside` |
| `shadow` | `shadow-[Xpx_Ypx_Bpx_Spx_#RRGGBBAA]` |
| `opacity` | `opacity-[N]` (0..1 값을 그대로. 예: 0.5 → `opacity-[0.5]`). 없으면 붙이지 않는다 |
| `blur` | `blur-[Npx]` — Tailwind의 `blur-*`는 `filter: blur()`라 자식까지 흐려진다(의도된 동작). 없거나 0이면 붙이지 않는다 |
| `typography.fontFamily` | `[font-family:'값']` |
| `typography.fontSize` | `text-[Npx]` |
| `typography.fontWeight` | `font-thin`~`font-black` (100 단위 named 매핑) |
| `typography.lineHeight` | `leading-[Npx]` |
| `typography.letterSpacing` | `tracking-[Npx]` |
| `typography.textAlign` | `text-left`/`center`/`right` |
| `TextNode.color` | `text-[#RRGGBB(AA)]` |
| `frame` 노드 | `<div>` |
| `text` 노드 | `<p>` |
| `image` 노드 | `<img>` |
| `ImageNode.src` | `src` 속성. 아래 "image 노드" 참고 — 값을 그대로 쓰지 않는다 |
| `ImageNode.fit` | `object-cover`/`object-contain`/`object-fill` |
| `button` 노드 | `<button type="button">` |
| `ButtonNode.content` | 버튼의 텍스트 children |
| `input` 노드 | `<input>` (자기닫힘 태그, children 없음) |
| `InputNode.placeholder` | `placeholder` 속성 |
| `visible: false` | 모든 폭에서 false일 때만 제외한다. 폭에 따라 보이면 DOM 유지 + 아래 반응형 display 규칙 |

`fill`의 주축/교차축 판단: 부모 `layout.direction`이 `row`면 width가 주축, `column`이면 height가
주축이다.

### 테두리 정렬 (`border.align`)

| 값 | Tailwind |
|---|---|
| `inside`(기본) | `border-[Npx] border-[#..]` — 지금까지와 같다 |
| `outside` | `shadow-[0_0_0_Npx_#..]`. `border-*` 를 **쓰지 않는다** |
| `center` | `shadow-[0_0_0_Hpx_#..,inset_0_0_0_Hpx_#..]` (H = N/2). `border-*` 없음 |

`outside`/`center` 를 `outline-*` 로 옮기지 않는다. 브라우저 포커스 링과 겹친다. 캔버스도 같은 이유로
`box-shadow` 를 쓴다(`canvasLayout.strokeAndShadowStyle`).

**`shadow` 와 `border.align` 이 둘 다 있으면 한 `shadow-[...]` 안에 쉼표로 합친다.** `box-shadow` 는 CSS
속성 하나라 따로 쓰면 나중 것이 앞을 통째로 덮어쓴다. 테두리 고리를 앞에 적는다 — 먼저 적은 레이어가
위에 그려진다.

```
shadow-[0_0_0_2px_#6366F1,0px_8px_24px_-4px_#0F172A26]
```

### 배경 채우기 (`background`)

`background` 는 채우기 겹의 **배열**이다(문서 버전 `"0.3"`). 배열 앞이 위 겹이다 — CSS
`background-image` 가 먼저 적은 것을 위에 그리는 순서와 같아 **뒤집지 않는다.** 0.2까지의
`{ "color": c }` 모양은 더 이상 나오지 않는다(앱이 열 때 배열로 바꾼다).

캔버스와 **같은 규칙**으로 옮긴다(`canvasLayout.backgroundStyle`). 그래야 생성 코드가 에디터에서
본 것과 같게 그려진다.

1. **맨 아래 겹(배열 끝)이 solid면 그 색은 `bg-[c]`**(`background-color`)로 낸다. solid 한
   겹뿐이면 여기서 끝이다(위 표의 첫 행).
2. **나머지 겹은 `bg-[image:…]` 클래스 하나**에 배열 순서 그대로 쉼표로 잇는다. 겹을 클래스
   여러 개로 나누지 않는다 — `background-image` 는 속성 하나라 나중 클래스가 앞을 덮어쓴다.
   - `linear` 겹 → `linear-gradient(<angle>deg, <c1> <at1×100>%, <c2> <at2×100>%, …)`
   - 목록 안의 solid 겹(맨 아래가 아닌 solid) → `linear-gradient(c, c)`
   - 맨 아래 겹이 `linear` 면 `bg-[c]` 없이 전부 이 목록이다.
3. **`bg-[image:…]` 를 냈으면 `bg-origin-border` 를 함께 붙인다**(`background-origin:
   border-box`). 이미지 겹이 테두리 밑까지 `background-color` 와 같은 상자에 걸린다.
4. 기반 배경의 생략·`[]` 면 배경 클래스를 하나도 붙이지 않는다. **반응형 override의 `[]`는
   앞선 배경을 지워야 하므로 아래 반응형 reset 규칙을 적용한다.**

**클래스 글자는 캔버스 CSS 문자열의 공백을 `_` 로 바꾼 것이다.** 캔버스가
`linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%)` 를 그리면 클래스는
`bg-[image:linear-gradient(180deg,_#6366F1_0%,_#8B5CF6_100%)]` 이고, Tailwind가 이 클래스에서
캔버스와 **글자까지 같은** `background-image` 를 만든다.

- **수는 소수 넷째 자리에서 반올림하고 뒤 0을 붙이지 않는다** — 캔버스의 `cssNumber` 와 같다.
  `at` 0.1 → `10%`(부동소수 그대로 `10.000000000000002%` 로 쓰지 않는다), 0.125 → `12.5%`,
  1/3 → `33.3333%`. 각도도 같다(`33.3333deg`).
- 색은 `#RRGGBB(AA)` 를 JSON 그대로 쓴다(대소문자도 그대로).
- 각도는 `0`·`180` 도 생략하지 않고 `0deg`·`180deg` 로 적는다. stop은 다시 정렬하지 않는다
  (오름차순은 검증이 보장한다). 같은 `at` 이 이어지는 딱 끊기는 경계도 그대로 적는다.
- **`image:` 타입 힌트를 빼지 않는다.** 이 저장소의 Tailwind v4.3.3에서 실측한 결과, 힌트 없는
  `bg-[linear-gradient(…),_linear-gradient(…)]` 처럼 겹 사이에 `,_` 가 있으면 Tailwind가 값을
  색으로 추론해 `background-color: linear-gradient(…)` 라는 무효 선언을 낸다 — 빌드 오류 없이
  배경이 조용히 사라진다. 힌트가 있으면 한 겹이든 여러 겹이든 항상 `background-image` 다.
- `style` 속성으로 내지 않는다. 위 표기로 다 표현된다.

번들러가 최종 CSS를 줄이면서 `180deg`(기본값)를 지우거나 `#6366F1 0%, #6366F1 50%` 를
`#6366f1 0% 50%` 로 합칠 수 있다. 그려지는 결과는 같다 — 맞춰야 하는 것은 클래스 글자다.

예 1 — linear 한 겹(위→아래, 남색 → 보라).

```json
"background": [
  { "type": "linear", "angle": 180, "stops": [
      { "color": "#6366F1", "at": 0 },
      { "color": "#8B5CF6", "at": 1 }
  ] }
]
```

```tsx
<div className="... bg-[image:linear-gradient(180deg,_#6366F1_0%,_#8B5CF6_100%)] bg-origin-border" />
```

예 2 — 보라 단색 위에 반투명 남색 linear를 얹었다. 맨 아래 solid가 `bg-[c]` 로 빠진다.

```json
"background": [
  { "type": "linear", "angle": 180, "stops": [
      { "color": "#0F172A00", "at": 0 },
      { "color": "#0F172ACC", "at": 1 }
  ] },
  { "type": "solid", "color": "#6366F1" }
]
```

```tsx
<div className="... bg-[#6366F1] bg-[image:linear-gradient(180deg,_#0F172A00_0%,_#0F172ACC_100%)] bg-origin-border" />
```

예 3 — 왼쪽 반은 남색, 오른쪽 반은 보라로 딱 끊기는 stop(같은 `at` 0.5가 두 번).

```json
"background": [
  { "type": "linear", "angle": 90, "stops": [
      { "color": "#6366F1", "at": 0 },
      { "color": "#6366F1", "at": 0.5 },
      { "color": "#8B5CF6", "at": 0.5 },
      { "color": "#8B5CF6", "at": 1 }
  ] }
]
```

```tsx
<div className="... bg-[image:linear-gradient(90deg,_#6366F1_0%,_#6366F1_50%,_#8B5CF6_50%,_#8B5CF6_100%)] bg-origin-border" />
```

예 4 — 맨 위가 반투명 흰 solid, 맨 아래가 linear. 맨 아래가 solid가 아니므로 `bg-[c]` 가 없고,
위의 solid는 목록 안에서 `linear-gradient(c, c)` 가 된다.

```json
"background": [
  { "type": "solid", "color": "#FFFFFF33" },
  { "type": "linear", "angle": 135, "stops": [
      { "color": "#6366F1", "at": 0.1 },
      { "color": "#8B5CF6", "at": 0.9 }
  ] }
]
```

```tsx
<div className="... bg-[image:linear-gradient(#FFFFFF33,_#FFFFFF33),_linear-gradient(135deg,_#6366F1_10%,_#8B5CF6_90%)] bg-origin-border" />
```

### image 노드

`ImageNode`는 `background`·`border`·`children`이 없는 leaf 노드다 — `text`와 같은 성격으로
다룬다(부모의 `layout.direction` 기준으로 `box`의 주축/교차축을 판단).

`src`는 그대로 쓰지 않는다. 생성 파일(`pages/` 또는 `components/`, 둘 다
`.visual-spec/generated/` 바로 아래)에서 워크스페이스 assets까지의 상대 경로로 바꾼다.
`../assets/<파일명>` 형태로 쓴다 — `export/bundle.ts`(#157)가 내보낸 ZIP 안에서
`pages/`·`components/` 옆에 `assets/`를 나란히 두므로, **결과물 기준으로는** 이 표기가
그대로 맞는 경로다. 작업공간 안(`.visual-spec/generated/pages/…`)에서는 실제로 두 단계
(`../../assets/`)지만, `export/importScan.ts`의 `scanAssetReferences`가 `../`
개수를 따지지 않고 파일명으로만 맞춰보므로 양쪽 다 받아들인다 — 이 코드가 생성하는
`../assets/`도 그중 하나다.

```tsx
<img src="../assets/hero.png" alt="" className="..." />
```

`className`은 다른 노드와 똑같이 위 `box`/`fit` 규칙으로 채운다(§ 아래 "image 노드
예제" 참고). `alt`는 스키마에 없는 필드다. 빈 문자열로 채우고 왜 비웠는지 밝힌다(장식용
이미지로 근사) — 사용자가 의미 있는 대체 텍스트를 알려주면 그걸 쓴다.

### button / input 노드

`ButtonNode`·`InputNode`는 `text`와 같은 성격의 leaf 노드다(부모의 `layout.direction` 기준
주축/교차축 판단, `box`/`typography`/`color` 규칙 동일). `background`·`border`가 있으면
`frame`과 같은 규칙으로 채운다.

```tsx
<button type="button" className="...">제출</button>
<input placeholder="이메일을 입력하세요" className="..." />
```

**`value`/`onChange`/`onClick` 같은 상태·이벤트 바인딩은 만들지 않는다.** 스키마에 없는
개념이다(props/bindings는 MVP 제외 범위). "누르면 로그인되게 해줘" 같은 요청이 오면 정적
마크업만 만들고, 동작은 스펙이 표현하지 못한다고 알린다.

### grid 레이아웃

`layout.direction: "grid"`는 `layout.columns`(선택, 없으면 1)만큼의 열로 자식을 균등하게
자동 배치한다 — 특정 자식을 특정 셀에 지정하는 기능은 없다.

```tsx
<div className="grid grid-cols-[2] gap-[12px] pt-[24px] pr-[16px] pb-[24px] pl-[16px] bg-[#FFFFFF] w-full h-full">
```

grid 컨테이너의 직계 자식은 `flex-1`/`self-stretch` 같은 flex 전용 클래스를 붙이지 않는다 —
grid 아이템에는 뜻이 없다. `fill`이면 그냥 `w-full`/`h-full`을 쓴다.

## 예제

아래는 #218 확장 **이전의 4노드 최소 로그인 화면** 변환 예시다. 당시에는
반복되는 형제가 없어 파일 하나로 끝났다. 현재 `examples/login-screen.json`은
이메일·비밀번호 placeholder input 2개와 로그인 button을 포함한 7노드다.
현재 파일을 변환할 때는 아래 코드를 그대로 복사하지 말고 실제 nodes를 모두 반영한다.
입력창 두 개는 같은 구조이므로 공유 컴포넌트로 분리하고 placeholder를 prop으로 받는다.
`compileTickets` 기준 티켓은 `Title`, `EmailInput`, `Card`, `Login` 4개이고
`Card`는 `EmailInput`, `Login`은 `Title`과 `Card`에 의존한다.
비밀번호라는 이름만으로 `type="password"`나 인증 로직을 추가하지 않는다.

```tsx
export default function Login() {
  return (
    <div className="flex flex-col gap-[16px] pt-[24px] pr-[20px] pb-[24px] pl-[20px] justify-start items-stretch bg-[#FFFFFF] w-full h-full">
      <p className="self-stretch h-auto text-[#111111] [font-family:'Pretendard'] text-[24px] font-bold leading-[32px] tracking-[-0.5px] text-left">로그인</p>
      <div className="flex flex-col gap-[12px] pt-[16px] pr-[16px] pb-[16px] pl-[16px] justify-center items-stretch bg-[#F5F5F5FF] border-[1px] border-[#00000020] rounded-[8px] self-stretch h-auto">
        <p className="w-auto h-auto text-[#666666] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-center">계정 정보를 입력하세요</p>
      </div>
    </div>
  );
}
```

결과가 이 예제와 크게 다르면 위 매핑표가 불충분한 것이니 표를 먼저 의심한다.

### 분리 생성 예제

`examples/dashboard-cards.json`은 `content` 아래 `cardA`/`cardB`가 레이아웃·자식 구성이
똑같고 텍스트만 다르다 — "컴포넌트 단위로 분리 생성한다" 규칙이 적용되는 경우다.

- root의 직계 자식 `header`, `content` → 컴포넌트 후보
- `content` 안의 `cardA`/`cardB`(둘 다 `name: "Card"`, 구조 동일) → 반복 컴포넌트 `Card`로
  추출, `label`/`value`를 props로
- `header`는 자식이 `headerTitle` 하나뿐이라 반복이 없다 → `Header.tsx`에 인라인

```tsx
// .visual-spec/generated/components/Card.tsx
interface CardProps {
  label: string;
  value: string;
}

export function Card({ label, value }: CardProps) {
  return (
    <div className="flex flex-col gap-[8px] pt-[20px] pr-[20px] pb-[20px] pl-[20px] justify-start items-start bg-[#FFFFFF] border-[1px] border-[#E5E7EB] rounded-[12px] flex-1 h-auto">
      <p className="w-auto h-auto text-[#6B7280] [font-family:'Pretendard'] text-[13px] font-medium leading-[18px] tracking-[0px] text-left">{label}</p>
      <p className="w-auto h-auto text-[#111111] [font-family:'Pretendard'] text-[28px] font-bold leading-[36px] tracking-[-0.4px] text-left">{value}</p>
    </div>
  );
}
```

```tsx
// .visual-spec/generated/components/Content.tsx
import { Card } from "./Card";

export function Content() {
  return (
    <div className="flex flex-row gap-[16px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-stretch self-stretch h-auto">
      <Card label="총 방문자" value="12,480" />
      <Card label="전환율" value="3.7%" />
    </div>
  );
}
```

```tsx
// .visual-spec/generated/components/Header.tsx
export function Header() {
  return (
    <div className="flex flex-col gap-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-start self-stretch h-auto">
      <p className="w-auto h-auto text-[#111111] [font-family:'Pretendard'] text-[28px] font-bold leading-[36px] tracking-[-0.6px] text-left">대시보드</p>
    </div>
  );
}
```

```tsx
// .visual-spec/generated/pages/DashboardPage.tsx
import { Header } from "../components/Header";
import { Content } from "../components/Content";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-[24px] pt-[32px] pr-[32px] pb-[32px] pl-[32px] justify-start items-stretch bg-[#F7F8FA] w-full h-full">
      <Header />
      <Content />
    </div>
  );
}
```

의존 관계는 `Card → Content`, `{Header, Content} → DashboardPage`뿐이다. **자식이 부모보다
먼저면 된다** — `Header`는 아무것도 의존하지 않으니 아무 때나(`Card`보다 먼저도) 만들 수
있고, `Content`는 `Card`가 있어야 한다. `DashboardPage`는 `Header`와 `Content`가 둘 다
끝난 뒤 마지막에 만든다. 형제 사이의 순서 자체는 자유다 — 의존하지 않는 컴포넌트끼리는
어느 쪽을 먼저 만들어도 상관없다.

### image 노드 예제

`examples/image-hero.json`을 위 "image 노드" 규칙대로 변환하면 이런 모양이 나와야 한다.

```tsx
export default function ImageHeroPage() {
  return (
    <div className="flex flex-col gap-[16px] pt-[0px] pr-[0px] pb-[24px] pl-[0px] justify-start items-stretch bg-[#FFFFFF] w-full h-full">
      <img
        src="../assets/hero.png"
        alt=""
        className="self-stretch h-[240px] object-cover"
      />
      <p className="self-stretch h-auto text-[#374151] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left">가져온 이미지 위에 설명 텍스트를 배치한다.</p>
    </div>
  );
}
```

`hero`는 반복되는 형제가 없어 컴포넌트로 뽑지 않고 페이지 파일에 인라인했다 — "컴포넌트
경계를 정한다"의 3번 규칙 그대로다.

### grid / button / input 예제

`examples/form-grid.json`을 위 "grid 레이아웃"·"button / input 노드" 규칙대로 변환하면
이런 모양이 나와야 한다.

```tsx
export default function FormGridPage() {
  return (
    <div className="grid grid-cols-[2] gap-[12px] pt-[24px] pr-[16px] pb-[24px] pl-[16px] bg-[#FFFFFF] w-full h-full">
      <p className="w-full h-auto text-[#374151] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left">이름</p>
      <input
        placeholder="이름을 입력하세요"
        className="w-full h-[44px] text-[#111827] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left bg-[#F9FAFB] border-[1px] border-[#D1D5DB] rounded-[8px]"
      />
      <p className="w-full h-auto text-[#374151] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left">이메일</p>
      <input
        placeholder="이메일을 입력하세요"
        className="w-full h-[44px] text-[#111827] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left bg-[#F9FAFB] border-[1px] border-[#D1D5DB] rounded-[8px]"
      />
      <button type="button" className="w-full h-[44px] text-[#FFFFFF] [font-family:'Pretendard'] text-[14px] font-semibold leading-[20px] tracking-[0px] text-center bg-[#4F46E5] rounded-[8px]">제출</button>
    </div>
  );
}
```

grid 컨테이너 바로 아래라 자식들은 `flex-1`/`self-stretch`가 아니라 `w-full`을 썼다 —
"grid 레이아웃" 절의 규칙대로다. `login-screen`/`image-hero`와 마찬가지로 트리가 평평하고
(중첩 프레임 없음) `nameInput`/`emailInput`처럼 구조가 같은 형제가 있어도 그 자체가 페이지
전체가 아니라 개별 leaf 노드라 "컴포넌트 단위로 분리 생성한다" 절의 대상이 아니다 — 파일
하나로 끝난다.

### 그라디언트 배경 예제

`examples/gradient-hero.json`을 위 "배경 채우기" 규칙대로 옮기면 배경 클래스는 이렇게 나와야
한다. 나머지 클래스(레이아웃·글자·테두리)는 위 예제들과 같은 규칙이라 줄였다.

| 노드 | `background` | 배경 클래스 |
|---|---|---|
| `hero` | 반투명 오버레이 linear(180) + 대각 linear(112.5) | `bg-[image:linear-gradient(180deg,_#0F172A00_40%,_#0F172A99_100%),_linear-gradient(112.5deg,_#4F46E5_0%,_#9333EA_100%)] bg-origin-border` |
| `heroCta` | linear(90) 한 겹 | `bg-[image:linear-gradient(90deg,_#F97316_0%,_#EC4899_100%)] bg-origin-border` |
| `launchCard` | 반투명 오버레이 linear(180) + 맨 아래 solid | `bg-[#6366F1] bg-[image:linear-gradient(180deg,_#0F172A00_0%,_#0F172ACC_100%)] bg-origin-border` |
| `launchProgress` | 딱 끊기는 stop(`at` 0.62 두 번) | `bg-[image:linear-gradient(90deg,_#FACC15_0%,_#FACC15_62%,_#FFFFFF33_62%,_#FFFFFF33_100%)] bg-origin-border` |
| `root`·`content`·`noteCard` | solid 한 겹 | `bg-[#FFFFFF]`·`bg-[#F8FAFC]`·`bg-[#FFFFFF]` |

`hero`는 맨 아래 겹이 linear라 `bg-[c]` 없이 두 겹이 `bg-[image:…]` 하나에 쉼표로 이어진다.
`launchCard`는 맨 아래 solid만 `bg-[c]`로 빠진다. 소수 각도 `112.5`는 그대로 `112.5deg`이고,
`at` 0.62는 `62%`다. 클래스 글자는 캔버스가 이 노드들에 그리는 `background-image` 문자열의
공백을 `_`로 바꾼 것과 같다.

---

코드 생성이 끝나면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)로 돌아가 다음 요청을 받는다.
