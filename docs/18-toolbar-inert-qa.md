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

## 리뷰 대응 — 숨김 후 Tab/Shift+Tab과 형제 이동(canvasKeys.ts)의 상호작용 (2026-10-06)

커밋 81bcfba 리뷰(P2)가 지적한 경로: 노드를 선택한 채 Frame 등 도구 버튼에 포커스를
두고(`BUTTON`, 활성화 대상이라 Tab 예외 적용) 캔버스를 스크롤해 도구 모음을 숨기면,
`Toolbar.tsx`의 새 `blur()`가 `activeElement`를 `BUTTON`에서 `document.body`로 옮긴다.
이 상태에서 Tab/Shift+Tab을 누르면 `canvasKeys.ts` 142~161행의 형제 이동(#151)이
`body`는 활성화 대상이 아니므로 더 이상 예외를 받지 못하고 Tab을 가로채 형제 노드
선택으로 처리한다 — 선택을 지우지 않는 도구 버튼 클릭 뒤라 이 경로가 실제로 열려
있다는 지적이다.

**현상 자체는 맞다.** 확인을 위해 기존 유닛 테스트를 다시 봤다 —
`test/canvas-input.test.ts` 447~477행(`siblingNavDirectionForKey — Tab/Shift+Tab
형제 이동(#151)`)이 이미 정확히 이 입력 조합을 검증하고 있다:

```ts
siblingNavDirectionForKey(tabKey())                        // tagName: "DIV", hasSelection: true → "next"
siblingNavDirectionForKey(tabKey({ tagName: "BUTTON" }))    // → null (버튼은 예외)
siblingNavDirectionForKey(tabKey({ hasSelection: false }))  // → null (선택 없으면 예외)
```

`body`는 `BUTTON`/`A`/`role="button"` 어느 것도 아니므로 `DIV` 케이스와 같은 분기를
탄다 — 선택이 있는 한 Tab은 형제 이동으로 가로채진다.

**다만 이것은 #275가 새로 만든 트랩이 아니다.** `canvasKeys.ts`의 이 규칙은 #151이
"선택이 있고 포커스가 button/input/link가 아니면 Tab을 형제 이동으로 쓴다"로 이미
설계·테스트해 둔 것이고, 캔버스에서 노드를 클릭해 선택한 직후(이때도 포커스는
원래 `body`에 있다) Tab을 누르는 것이 바로 이 기능의 주 사용 경로다. #275 이전에는
숨은 도구 버튼이 `inert`도 아니고 `blur()`도 없어 `activeElement`가 우연히
`BUTTON`으로 남아 있었고, 그 우연한 상태가 형제 이동 예외를 계속 받고 있었을
뿐이다 — 그 자체가 #275가 고치는 버그(보이지도 상호작용도 안 되는 버튼이 포커스를
들고 있음)의 일부였다. `blur()`는 그 우연한 예외를 치우고 #151이 어디서나 적용하기로
한 규칙으로 되돌릴 뿐, 새 조건을 추가하지 않는다.

그래서 리뷰가 제안한 두 방향은 둘 다 채택하지 않는다:
- **다른 포커스 목적지를 정한다** — 임의의 위치로 포커스를 보내는 건 위 "수정"
  절의 설계와 반대다(어디로 보낼지 추리하지 않는다 — 방금 하던 입력이 끊긴다).
- **캔버스 단축키 적용 범위를 조정한다** — `body` 포커스를 형제 이동의 예외로
  추가하면, 캔버스에서 노드를 클릭 선택한 뒤 바로 Tab으로 형제를 옮기는 #151의
  주 사용 경로 자체가 전체 앱에서 깨진다. 이 리뷰가 다루는 엣지 케이스보다 훨씬
  넓은 회귀라 #275 범위 밖이다.

**라이브 브라우저 재현은 다시 시도했지만 이번에도 실패했다.** `pnpm dev` + 자동화
도구로 Frame 버튼을 포커스시키고 `canvasAtBottom`을 스크롤로 트리거하려 했으나,
`resize_window`로 뷰포트를 줄여도 `window.innerWidth/innerHeight`가 바뀐 그대로
반영되지 않고, 스크립트에서 건 `.focus()` 호출도 실제 `activeElement`를 바꾸지
못하는(반면 CDP가 보내는 실제 클릭은 정상적으로 포커스를 옮기는) 현상을 겪어
기존에 기록한 줌/스크롤 재현 불안정과 같은 문제에 또 부딪혔다. 대신 위 유닛
테스트로 메커니즘 자체(입력 조합 → `siblingNavDirectionForKey`의 반환값)는
결정적으로 확인했다 — 스크롤 숨김은 결국 같은 함수에 같은 입력(포커스 태그,
선택 여부)을 넣는 배선일 뿐이라, 이 쪽이 라이브 DOM 재현보다 신뢰할 수 있는
근거라고 판단했다.

**결론: 코드 변경 없음.** `Toolbar.tsx`·`canvasKeys.ts` 둘 다 그대로 둔다. 숨김
직후 Tab이 형제 이동으로 넘어가는 것은 #151이 의도한 동작이고, Escape나 다른
컨트롤 클릭으로 벗어날 수 있다는 점(리뷰도 인정)도 캔버스 어디서든 똑같이 적용되는
#151의 기존 탈출 경로와 같다.

## 결론

- 완료 조건 "숨긴 툴바에 Tab/Shift+Tab으로 진입하지 않는다" — `inert`로 보장됨을
  fixture로 확인(4번)
- 완료 조건 "숨기는 순간 내부 포커스 이동 … 검증한다" — `inert`만으로는 안 되고
  명시적 `blur()`가 필요함을 fixture로 확인(2번), `Toolbar.tsx`에 반영함
- "다시 표시했을 때의 포커스 정책" — 자동 복원하지 않고 다시 탭 가능해지는 것으로
  정했고 fixture로 확인(5번)
- 리뷰(81bcfba, P2) 대응: 숨김 후 Tab이 형제 이동으로 넘어가는 것은 `blur()`가
  만든 새 트랩이 아니라 #151이 이미 설계·테스트해 둔 동작이 드러난 것임을
  `test/canvas-input.test.ts`의 기존 유닛 테스트로 확인 — 코드 변경 없이 위
  "리뷰 대응" 절로 답한다
