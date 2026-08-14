# Visual Spec → React 코드 생성 Skill — 설계

작성일: 2026-08-11
대상: `docs/PROJECT_OVERVIEW.md`의 전체 흐름 중 "AI Agent가 실제 React 코드 생성" 단계.

**만드는 것은 Skill 하나다.** 사용자가 자연어로 지시하면 그 지시에 이 Skill이 매칭되어(연결)
실행되고, Skill 지시문을 따라 Claude가 직접 Visual Spec JSON을 읽어 React/Tailwind 코드를 작성한다.

별도의 결정론적 변환 함수(`renderVisualSpec` 같은 라이브러리)는 만들지 않는다.
`docs/PROJECT_OVERVIEW.md`가 "Claude Code 또는 Codex는 해당 JSON을 읽어 실제 React 코드를 구현한다"고
못 박아뒀다 — 코드를 쓰는 주체는 에이전트 자신이다. Skill은 그 작업을 안정적으로 반복시키기 위한
지시문·참고 규칙 묶음일 뿐이다.

---

## 1. 범위

만든다.

- Skill 정의 파일 하나 (트리거 조건 + 실행 지시문)
- Skill 안에 넣을 매핑 참고표 (JSON 필드 → Tailwind 클래스 대응 — Claude가 따를 가이드라인)
- 실행 확인용 예제 1~2개 (기존 `examples/*.json`으로 직접 실행해보고 결과 확인)

만들지 않는다.

- JSON → 코드 변환을 대신 해주는 별도 함수/라이브러리
- 그 함수에 대한 유닛 테스트
- GUI 자체

---

## 2. 트리거 — 어떻게 연결되는가

Skill은 사용자의 자연어 지시와 매칭돼야 실행된다. Claude Code의 Skill은 `description`으로
자동 매칭되거나, 사용자가 이름을 직접 불러 실행할 수 있다.

이 Skill이 반응해야 하는 지시 예:

- "이 Visual Spec으로 화면 만들어줘"
- "이 JSON을 React 컴포넌트로 변환해줘"
- "`login-screen.json` 코드로 구현해줘"

트리거 조건 초안:

- 대화나 첨부 파일에 Visual Spec 형태(`version`, `screen.root`, `screen.nodes`)의 JSON이 있다.
- 사용자가 "구현", "코드로 만들어줘", "React로 변환" 같은 표현을 쓴다.

`description` 필드에 위 트리거 예시를 넣어 자동 매칭 정확도를 확인한다. 애매하면 사용자가
`/visual-spec-to-react` 처럼 직접 불러 실행할 수 있게 이름을 붙인다 (Skill 이름은 §5에서 정한다).

---

## 3. 실행 흐름

Skill이 매칭되면 Claude는 아래 순서를 따른다.

1. 대상 JSON을 찾는다 (사용자가 경로를 줬거나 대화에 첨부돼 있다).
2. `validateVisualSpec` (기존 `src/features/editor/schema`의 공개 API)으로 검증한다.
   실패하면 `issues`를 사용자에게 그대로 보여주고 중단한다 — Claude가 임의로 고치지 않는다.
3. 통과하면 §4의 매핑 규칙을 참고해 TSX 코드를 **직접 작성**한다.
4. 대상 React 프로젝트 어디에 파일을 둘지 사용자에게 확인한다 (프로젝트 구조가 project마다 다르므로 추측하지 않는다).
5. 파일을 쓰고 결과를 보고한다.

2번은 이미 있는 함수를 그대로 호출하는 것이지 새로 만드는 게 아니다. 3번이 이 Skill의 핵심 작업이다.

---

## 4. 매핑 참고표

Skill 지시문 안에 넣어 Claude가 참고하게 하는 표다. 강제 규격이 아니라 **일관성을 위한 기본값**이다 —
JSON에 없는 상황을 만나면 Claude가 판단해서 채운다.

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

`fill`의 주축/교차축 판단: 부모 `layout.direction`이 `row`면 width가 주축, `column`이면 height가 주축이다.

---

## 5. Skill 파일

§2 트리거 설명, §3 실행 순서, §4 매핑표, §8 예제를 그대로 **`에이전트.md`**에 담는다.
이 파일이 실제로 에이전트가 읽고 따르는 지시문이다 — 위 절들은 그 초안이지 별도 산출물이 아니다.

`에이전트.md`의 실제 위치/작성은 보류한다. 나중에 진행한다.

---

## 6. 남은 판단

- **파일 배치 경로.** 대상 프로젝트 구조를 Skill이 스캔해 추론할지, 항상 물어볼지 미정. 현재는 항상 묻는 쪽으로 잡았다 (§3-4).
- **`text` 노드 태그.** 항상 `<p>`로 할지, 부모가 `row`인 좁은 라벨은 `<span>`이 나을지 — 실제로 몇 번 돌려보고 판단한다.
- **자동 매칭 정확도.** `description` 트리거만으로 충분히 잘 잡히는지, 아니면 사용자가 항상 이름을 불러야 하는지 실제 사용해보며 확인한다.
- **포매터 자동 실행.** 파일 쓴 후 대상 프로젝트의 prettier/eslint를 자동으로 돌릴지 여부.

---

## 7. 작업 분할

거창한 라이브러리가 아니라 Skill 파일 하나이므로 굳이 파일 단위로 나눌 필요는 없다.
두 사람이 함께 SKILL.md 본문을 쓰고, 아래 순서로 나눠 확인한다.

| 담당 | 확인 항목 |
|---|---|
| A | §2 트리거 — 자연어 지시 여러 개로 실제 매칭되는지 확인 |
| B | §3~4 실행 — `examples/*.json` 각각으로 실제 실행해 결과 코드 검수 |

---

## 8. 예제

`examples/login-screen.json`을 §4 규칙대로 손으로 변환하면 이런 모양이 나와야 한다.
Skill을 실행했을 때 이 결과와 크게 다르면 §4 표현이 불충분한 것이다.

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
