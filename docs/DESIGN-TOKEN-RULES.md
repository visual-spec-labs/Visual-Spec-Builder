# Danim Design Token Rules

디자인 토큰의 네이밍·구조·참조 규칙을 정의합니다.

---

## 핵심 원칙

```
Primitive = 실제 값
Semantic  = UI 역할
Component = Semantic 사용
```

- **Primitive**: 실제 HEX / rgba / px 값만 선언한다.
- **Semantic**: UI 역할(배경·텍스트·보더 등)을 이름으로 표현하고 Primitive를 `var()`로 참조한다.
- **Component**: 오직 Semantic 토큰만 사용한다. Primitive Token을 직접 사용하지 않는다.

---

## 토큰 계층

```
Primitive → Semantic → Component → State
```

각 계층은 반드시 상위 계층의 토큰을 `var()`로 참조합니다. 실제 값(HEX, px 등)은 Primitive에만 씁니다.

---

## 네이밍 구조

### Primitive — `--{category}-{scale}`

원시 값. 실제 HEX / px / shadow 값을 직접 선언합니다.

```css
--color-mint-500: #3ECBA0;
--color-gray-900: #0F1720;
--radius-md:      12px;
--shadow-sm:      0 2px 8px rgba(17, 24, 39, 0.06);
--space-4:        16px;
--font-weight-bold: 700;
```

### Semantic — `--{role}-{property}-{level?}`

의미 기반 역할. Primitive를 `var()`로 참조합니다.

```css
--color-primary:       var(--color-mint-500);
--color-bg:            var(--color-gray-100);
--color-bg-card:       var(--color-white);
--color-text:          var(--color-gray-900);
--color-text-muted:    var(--color-gray-500);
--color-border:        var(--color-gray-200);
--color-border-focus:  var(--color-primary);
--color-error:         var(--color-red-500);
```

### Component — `--{component}-{variant?}-{property}`

컴포넌트 기본(default) 상태 토큰. Semantic 토큰을 `var()`로 참조합니다.

```css
--button-primary-bg:   var(--color-primary);
--button-primary-text: var(--color-text-inverse);
--input-border:        var(--color-border);
--chip-radius:         var(--radius-pill);
```

### State — `--{component}-{variant?}-{property}-{state}`

컴포넌트 비기본 상태 토큰. **property가 state 앞에** 옵니다.

```css
--button-primary-bg-hover:     var(--color-primary-hover);
--button-primary-bg-disabled:  var(--color-border);
--button-primary-shadow-focus: var(--shadow-focus-ring);
--input-border-focus:          var(--color-border-focus);
--chip-bg-selected:            var(--color-primary);
```

---

## Property 약어 규칙

| 의미 | 토큰 property |
|------|------------|
| background | `bg` |
| color / text | `text` |
| spacing / gap | `gap` |
| dim / overlay | `overlay` |
| focus / ring | `ring` |
| border | `border` |
| icon | `icon` |
| shadow | `shadow` |
| border-radius | `radius` |
| padding | `padding` |
| height | `height` |
| width | `width` |
| opacity | `opacity` |
| placeholder | `placeholder` |

**금지**: `b`, `c`, `bd`, `sh`, `rad`, `ov` 등 모호한 단일 문자 / 약어.

---

## 파일 구조

토큰 종류마다 **Primitive / Semantic 을 폴더로 분리**합니다. Component + State는 별도 파일로 둡니다.

```
src/styles/tokens/
├── primitives/            # Primitive = 실제 값
│   ├── colors.css         #   컬러 (HEX/rgba/oklch)
│   ├── typography.css     #   폰트 패밀리·크기·굵기·행간·자간
│   ├── spacing.css        #   스페이싱(px)
│   ├── radius.css         #   라디우스(px)
│   ├── shadow.css         #   그림자
│   └── layout.css         #   레이아웃 치수(사이드바 폭·바 높이, px)
├── semantic/              # Semantic = UI 역할 (Primitive를 var()로 참조)
│   ├── colors.css         #   컬러 역할 + 테마 스위칭
│   ├── typography.css     #   font-sans / font-mono
│   ├── spacing.css        #   gap / padding 역할
│   ├── radius.css         #   control / panel / chip
│   ├── shadow.css         #   card / popover / modal
│   └── layout.css         #   menubar/toolbar 높이, tree/props 폭 역할
├── component-state.css    # Component + State 토큰 (:root)
└── index.css              # 진입점 — Primitive → Semantic → Component 순 import
```

`index.css` 는 반드시 **Primitive → Semantic → Component** 순서로 import 합니다.

```css
/* tokens/index.css */
@import "./primitives/colors.css"; /* Primitive 먼저 */
/* … 나머지 primitives … */
@import "./semantic/colors.css";   /* Semantic 나중 */
/* … 나머지 semantics … */
@import "./component-state.css";   /* Component 마지막 */
```

- **Primitive 컬러** → `:root` 변수로 선언 + `@theme { --color-*: initial }` 로
  Tailwind 기본 팔레트를 비활성화. Primitive 컬러 유틸(`bg-gray-900` 등)이
  생성되지 않고 `var()` 참조로만 쓰인다. (컬러 유틸은 Semantic만 노출)
- **Semantic 컬러** → `@theme inline` → `bg-surface` 등 유틸로 노출
- **그 외 Primitive**(타이포·스페이싱·라디우스·그림자·레이아웃) → `@theme inline`
  (스케일 유틸 `text-sm`·`rounded-md` 등 노출)
- `:root` → `var(--token-name)` 으로만 접근

---

## 테마 스위칭

컬러 Semantic 중 **테마에 따라 값이 바뀌는 역할**(surface / content / line)은 스위치 변수로 선언하고,
`@theme inline` 에서 `--color-*` 로 노출합니다. 브랜드·상태·상호작용처럼 테마와 무관한 역할은
`@theme inline` 에서 Primitive 를 바로 참조합니다.

```css
/* semantic/colors.css */
:root {                     /* 라이트(기본) */
  color-scheme: light;      /* 폼 컨트롤·스크롤바 등 UA 기본 */
  --surface: var(--color-white);
  --content: var(--color-neutral-800);
}
[data-theme="dark"] {       /* 다크 */
  color-scheme: dark;
  --surface: var(--color-gray-900);
  --content: var(--color-gray-250);
}
@theme inline {
  --color-surface: var(--surface);   /* → bg-surface (테마 스위칭) */
  --color-content: var(--content);   /* → text-content (테마 스위칭) */
  --color-primary: var(--color-orange-500); /* 테마 무관 */
}
```

전환은 루트 요소의 속성으로 제어합니다. 속성이 없으면 라이트(기본)입니다.

```ts
document.documentElement.dataset.theme = "dark"; // 다크
delete document.documentElement.dataset.theme;   // 라이트
```

> 컬러 역할이 테마 스위칭되려면 `@theme inline` 이 **스위치 변수**(`var(--surface)`)를 참조해야 합니다.
> 값을 인라인으로 굳히면(예: `var(--color-white)` 직접) 런타임 전환이 되지 않습니다.

### FOUC 방지

첫 페인트 전 저장된 테마를 `<html data-theme>`에 반영하는 인라인 스크립트는
`vite.config.ts`의 `themeFoucPlugin`이 **빌드 시 주입**합니다. localStorage 키는
`theme-storage.ts`의 `THEME_STORAGE_KEY` 단일 소스에서 가져와 중복이 없습니다.
런타임 상태·토글은 `ThemeProvider`(Context)가 관리합니다.

---

## 참조 규칙

```
✅ Semantic이 Primitive를 참조  →  --color-primary: var(--color-mint-500)
✅ Component가 Semantic을 참조  →  --button-primary-bg: var(--color-primary)
✅ State가 Semantic을 참조      →  --button-primary-bg-hover: var(--color-primary-hover)

❌ Component가 Primitive를 직접 참조  →  --button-primary-bg: #3ECBA0
❌ Semantic이 Component를 참조        →  --color-bg: var(--button-primary-bg)
❌ 코드에 HEX/px 하드코딩            →  color: #3ECBA0
```

---

## Tailwind 연동

`@theme inline` 블록의 `--color-{name}` 토큰은 Tailwind 유틸리티 클래스로 노출됩니다.

```css
/* semantic/colors.css */
--color-surface: var(--surface);         /* → bg-surface */
--color-content-muted: var(--content-muted); /* → text-content-muted */
--color-primary: var(--color-orange-500); /* → bg-primary, text-primary, border-primary */
```

컴포넌트에서는 **Semantic 유틸리티 클래스만** 사용합니다. Primitive 클래스
(`bg-gray-900`, `text-neutral-500` 등)나 Tailwind 기본 팔레트를 직접 쓰지 않습니다.

```tsx
/* ✅ Semantic */
<div className="bg-surface border border-line text-content-muted" />

/* ❌ Primitive 직접 사용 */
<div className="bg-white border border-neutral-300 text-neutral-500" />
```

> 예외: 타이포·스페이싱·라디우스의 **스케일 유틸**(`text-sm`, `gap-2`, `p-3`, `rounded-md`)은
> 프레임워크 스케일로 직접 사용합니다. Primitive/Semantic 분리 원칙은 테마 역할을 갖는
> 컬러 토큰에 우선 적용됩니다.

### 강제(Lint)

Primitive 컬러 유틸 직접 사용은 ESLint 로컬 규칙 `local/no-primitive-color-utilities`
(`eslint.config.js`)로 차단합니다. `className` 안의 `bg-gray-900`·`text-neutral-500`·
`bg-white` 같은 팔레트/리터럴 컬러 유틸을 에러로 보고합니다.

```bash
pnpm lint
```

> Tailwind 기본 팔레트 유틸(`bg-neutral-*` 등)은 프레임워크가 항상 생성하므로 CSS만으로는
> 차단할 수 없어, 사용 단계에서 lint로 막습니다.

**인라인 스타일 금지**: `style={{ ... }}` 나 하드코딩된 임의값(`grid-cols-[240px_1fr_280px]`)을
쓰지 않습니다. 고정 치수가 필요하면 토큰을 만들고 `var()`로 참조합니다.

```tsx
/* ✅ 토큰 참조 */
<div className="grid-cols-[var(--layout-tree-width)_1fr_var(--layout-props-width)]" />

/* ❌ 하드코딩 / 인라인 */
<div className="grid-cols-[240px_1fr_280px]" />
<div style={{ width: 240 }} />
```
