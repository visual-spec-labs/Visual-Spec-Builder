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
   판단해서 채우되, 왜 그렇게 했는지 한 줄로 밝힌다.
4. **고정 워크스페이스 경로에 쓴다.** 대상 프로젝트 구조를 분석하거나 사용자에게 위치를
   묻지 않는다. Visual Spec Builder는 라이브러리로 설치돼 프로젝트마다 폴더 구조가 다른
   상태로 쓰이므로, 대상 프로젝트에 의존하지 않는 도구 전용 경로에 쓴다.
   ```
   .visual-spec/generated/pages/<ComponentName>.tsx
   ```
   (화면을 여러 컴포넌트 파일로 나눠 만드는 것은 이 스킬의 범위 밖이다 — 지금은 화면
   하나를 파일 하나로 만든다.)
5. **파일을 쓰고 결과를 보고한다.** prettier/eslint 같은 포매터는 사용자가 요청하지 않는
   한 자동으로 돌리지 않는다.

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
| `layout.direction` | `flex-row` / `flex-col` (frame은 항상 `flex`) |
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
| `visible: false` | 해당 노드와 자식은 코드에서 아예 제외한다 |

`fill`의 주축/교차축 판단: 부모 `layout.direction`이 `row`면 width가 주축, `column`이면 height가
주축이다.

## 예제

`examples/login-screen.json`을 위 규칙대로 변환하면 이런 모양이 나와야 한다.

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

---

코드 생성이 끝나면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)로 돌아가 다음 요청을 받는다.
