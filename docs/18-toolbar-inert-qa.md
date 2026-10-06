# 숨긴 Toolbar의 포커스 QA (#275)

검증일: 2026-10-06. 기준: `develop` ad3b6f1(이슈 기준 커밋) 위에서 시작한 작업 브랜치.

## 문제

`src/features/editor/ui/Toolbar.tsx`가 캔버스를 바닥까지 스크롤했을 때 도구 모음을
`aria-hidden`+`pointer-events-none`+`opacity-0`로만 숨겼다. 내부 `<button>`은 DOM에
그대로 남아 있어 Tab 순서에서 빠지지 않았다 — 실제 숨김 상태에서 Tab을 누르면 보이지
않는 Frame 버튼에 포커스가 들어갔다.

## 수정

`inert={hidden || undefined}`를 루트에 추가했다(`src/app/App.tsx`의 저장 충돌 모달 뒤
편집기와 같은 패턴). `aria-hidden`은 그대로 남겨 뒀다 — 보강이지 대체가 아니다.

추가로 `useEffect`를 하나 더 달았다: `hidden`이 true가 되는 순간 `document.activeElement`가
도구 모음 안에 있으면 `blur()`한다. 이게 필요한지는 아래 수동 fixture로 직접 확인했다 —
**네이티브 `inert`는 이미 포커스된 엘리먼트를 자동으로 치워주지 않는다.**

## 수동 fixture 검증

`test/fixtures/toolbar-inert-275-focus.html`를 `serve`로 띄워(Chrome, 실제 렌더) 확인했다.
React·zustand·실제 `Toolbar` 컴포넌트를 전혀 끌어들이지 않는 순수 DOM/`inert` 동작만
보는 fixture다 — Toolbar.tsx가 숨김 전환 때 거는 것과 같은 시퀀스(포커스 → `inert` 토글
→ `activeElement` 확인)를 그대로 옮겼다. AI가 생성한 출력이 아니라 이 작업에서 손으로
작성한 fixture이며, 실제 Codex/Claude 실행은 들어가지 않는다(#275는 순수 프런트엔드
코드 수정이라 애초에 AI 실행 대상이 아니다).

| 단계 | 동작 | 결과 | 판정 |
|---|---|---|---|
| 1 | `frameBtn.focus()` | `activeElement === frameBtn` → `true` | 기준선 |
| 2 | `toolbar.inert = true` (명시적 `blur()` 없이) | `activeElement === frameBtn` → **`true`(그대로)** | 네이티브 `inert`가 이미 잡힌 포커스를 자동으로 안 치운다 — `Toolbar.tsx`의 `blur()` 호출이 실제로 필요함을 증명 |
| 3 | `before` 버튼으로 수동 이동 | `activeElement.id === "before"` → `true` | 대조군 |
| 4 | `inert` 상태에서 `frameBtn.focus()` 재시도 | `activeElement === frameBtn` → `false` | `inert`가 새 포커스 진입은 막는다 — "Tab/Shift+Tab으로 진입하지 않는다" 완료 조건과 일치 |
| 5 | `toolbar.inert = false` 후 `frameBtn.focus()` | `activeElement === frameBtn` → `true` | 다시 보이면 탭 가능 상태로 정상 복귀 |

2번·4번이 이 이슈의 핵심이다. 4번은 `inert` 하나로 충분하고, 2번은 `inert`만으로는
**안 되는** 부분이라 `Toolbar.tsx`에 명시적 `blur()`를 추가한 근거가 된다.

## 실제 앱에서의 확인 (부분)

`pnpm dev`로 띄운 실제 편집기에서 Frame 도구 버튼을 클릭해 `document.activeElement`가
정확히 그 버튼(`aria-label="Frame (F)"`)이 되는 것은 확인했다 — 수정한 `Toolbar.tsx`가
포커스를 정상적으로 받는다는 것, 즉 접근성 수정이 평소 동작을 깨지 않았다는 것은
실제 앱에서 눈으로 봤다.

**스크롤로 `canvasAtBottom`을 실제로 트리거해 Tab/Shift+Tab을 눌러 보는 전 과정까지는
이번에 하지 못했다** — 이 조사 중 `specAutosave.ts`의 `settle()`이 거는
`window.confirm()`(227·232줄)이 New/Open/카드 열기 어디서든 자동화 도구의 렌더러를
완전히 멈춰 세운다는 것을 발견했고(별도 이슈로 분리 예정), 거기서 벗어난 뒤에도
줌/스크롤로 `canvasAtBottom`을 신뢰성 있게 재현하는 절차가 매번 달라져 이번 작업
범위 안에서 안정적으로 반복하지 못했다. 그래서 핵심 메커니즘(`inert`의 진입 차단,
`blur()`의 필요성)은 위 수동 fixture로, 수정된 컴포넌트가 실제 앱에서 정상 동작하는
것은 부분적으로(클릭 포커스까지) 확인하는 선에서 마무리했다. 실제 `canvasAtBottom`
전환 전 과정의 Tab 실측은 후속으로 남긴다.

## 결론

- 완료 조건 "숨긴 툴바에 Tab/Shift+Tab으로 진입하지 않는다" — `inert`로 보장됨을
  fixture로 확인(4번)
- 완료 조건 "숨기는 순간 내부 포커스 이동 … 검증한다" — `inert`만으로는 안 되고
  명시적 `blur()`가 필요함을 fixture로 확인(2번), `Toolbar.tsx`에 반영함
- "다시 표시했을 때의 포커스 정책" — 자동 복원하지 않고 다시 탭 가능해지는 것으로
  정했고 fixture로 확인(5번)
