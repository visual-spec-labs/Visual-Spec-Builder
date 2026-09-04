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
   상황이면 "컴포넌트 단위로 분리 생성한다" 절을 먼저 본다.
4. **고정 워크스페이스 경로에 쓴다.** 대상 프로젝트 구조를 분석하거나 사용자에게 위치를
   묻지 않는다. Visual Spec Builder는 라이브러리로 설치돼 프로젝트마다 폴더 구조가 다른
   상태로 쓰이므로, 대상 프로젝트에 의존하지 않는 도구 전용 경로에 쓴다.
   ```
   .visual-spec/generated/pages/<PageName>.tsx
   .visual-spec/generated/components/<ComponentName>.tsx
   ```
5. **파일을 쓰고 결과를 보고한다.** prettier/eslint 같은 포매터는 사용자가 요청하지 않는
   한 자동으로 돌리지 않는다.

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
| `background.color` | `bg-[#RRGGBB(AA)]` |
| `border.width/color/radius` | `border-[Npx] border-[#..] rounded-[Npx]` |
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
| `visible: false` | 해당 노드와 자식은 코드에서 아예 제외한다 |

`fill`의 주축/교차축 판단: 부모 `layout.direction`이 `row`면 width가 주축, `column`이면 height가
주축이다.

### image 노드

`ImageNode`는 `background`·`border`·`children`이 없는 leaf 노드다 — `text`와 같은 성격으로
다룬다(부모의 `layout.direction` 기준으로 `box`의 주축/교차축을 판단).

`src`는 그대로 쓰지 않는다. 생성 파일(`pages/` 또는 `components/`, 둘 다
`.visual-spec/generated/` 바로 아래)에서 워크스페이스 assets까지의 상대 경로로 바꾼다.
지금은 `../assets/<파일명>` 형태로 가정한다 — 정확한 경로 depth는 `.visual-spec/` 작업공간을
실제로 만드는 CLI가 아직 없어(#42) 확정된 게 아니다. 실제 작업공간 구조가 나오면 이 규칙을
맞춰 고친다.

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

`examples/login-screen.json`을 위 규칙대로 변환하면 이런 모양이 나와야 한다. 이 화면은
반복되는 형제가 없어서 분리 없이 파일 하나로 끝난다.

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

---

코드 생성이 끝나면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)로 돌아가 다음 요청을 받는다.
