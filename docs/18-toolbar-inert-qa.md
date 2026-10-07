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

그래서 1차 대응에서는 리뷰가 제안한 두 방향(다른 포커스 목적지 / 캔버스 단축키
적용 범위 조정)을 둘 다 채택하지 않고, 코드 변경 없이 위 분석으로 답했다. **이
1차 결론은 틀렸다 — 아래 "리뷰 재검토" 절 참고.**

## 리뷰 재검토 — #151 원문과 Toolbar.tsx 자체 주석의 모순 (2026-10-07)

팀원이 1차 대응에 다시 코멘트를 남겼다: 캔버스 클릭 후 Tab 형제 이동을 보존해야
한다는 데는 동의하지만(= `body` 일괄 예외나 inert 내부 포커스 유지를 요청하는
게 아니다), **#151 §2 원문**은 "캔버스는 포커스를 받는 요소가 아니므로 이 충돌을
먼저 풀어야 하며, 그렇지 않으면 키보드만 쓰는 사용자가 패널·도구 모음으로 갈 수
없게 된다"고 명시한다. 유닛 테스트는 "태그가 뭐면 가로채는가"라는 분기만 증명하지,
**"도구 모음을 쓰던 포커스가 숨김 효과로 떨어져 나갔을 때 어느 정책을 따라야
하는가"는 애초에 증명 대상이 아니었다.**

GitHub에서 #151 원문을 다시 읽어 이 인용이 정확함을 확인했다. 그리고 팀원이
짚은 더 구체적인 지점 — `Toolbar.tsx`의 기존 주석("어디로 보낼지 추리하지 않고
`blur()`만 한다 — 대부분의 브라우저가 body로 포커스를 돌리고, **그다음 Tab은
문서 맨 앞부터 정상적으로 흐른다**")과 1차 QA 문서의 "형제 이동으로 가로채진다"는
설명이 서로 다른 것을 주장하고 있었다 — 도 맞는 지적이었다. 원인은 간단했다:
`Toolbar.tsx`의 주석은 `canvasKeys.ts`가 `window`에서 Tab을 **먼저** 가로채
`preventDefault()`한다는 사실을 애초에 반영하지 않고 쓰여 있었다 — 즉 주석
자체가 처음부터 사실과 달랐다. 1차 QA 문서가 그 틀린 주장을 정확히 반박한
것이었지만, "그러니 코드는 안 고쳐도 된다"는 결론으로 건너뛴 게 성급했다.

**정책을 다시 정했다.** `isActivationTarget` 예외(포커스가 버튼·링크에 있으면
물러난다)는 "포커스가 이미 컨트롤 위에 있는 상태"만 지킨다 — **포커스가 막
컨트롤에서 떨어져 나간 전환 순간**은 어느 쪽도 다루지 않는다. 이 전환의 의도는
"캔버스를 쓰려던 것"이 아니라 "도구 모음/패널을 계속 쓰려던 것"에 더 가까우므로
(사용자가 방금까지 Frame 버튼을 쓰고 있었다), #151 §2의 목표를 지키려면 이
전환 다음의 Tab 한 번은 형제 이동을 비켜서야 한다. 다만 캔버스를 클릭해 선택한
"진짜" 캔버스 경로(포커스가 원래부터 `body`인 경우)는 그대로 형제 이동이어야
한다 — 이 둘은 낮은 수준에서 같은 상태(`activeElement === body`,
`selectedId !== null`)로 보이지만 사용자 의도가 다르므로, 상태만으로는 구분할
수 없고 **전환이 일어났다는 사실 자체를 신호로 넘겨야** 구분된다.

### 구현

- `store/viewStore.ts` — `toolbarFocusHandoffPending: boolean`과
  `setToolbarFocusHandoffPending`/`consumeToolbarFocusHandoffPending`을 추가했다.
  `consume`은 읽는 동시에 끈다 — 1회성 신호다. DOM을 건드리지 않는 순수 상태라
  `tsconfig.node.json`의 no-DOM 경계를 넘지 않는다.
- `ui/Toolbar.tsx` — 숨으며 `blur()`할 때 `setToolbarFocusHandoffPending(true)`를
  같이 켠다. 다시 보일 때(`hidden`이 false가 될 때)는 아직 소비되지 않았어도
  끈다 — "막 떨어진 포커스" 맥락은 다시 보인 뒤에는 끝난 것으로 본다.
- `ui/canvasKeys.ts` — `handleKeyDown` 맨 앞에서 `consumeToolbarFocusHandoffPending()`을
  읽는다(모든 keydown에서 한 번 소비 — Tab이 아니어도 소비된다; 도구 모음에서
  막 떨어진 다음 첫 keydown이 Tab이 아니면 그 신호는 더 이상 의미가 없다고 보고
  버린다). 그 값이 true면 형제 이동 판정(`siblingNavDirectionForKey` 호출)을
  건너뛰어(`null` 취급) `preventDefault()`가 걸리지 않게 하고, 브라우저 네이티브
  Tab이 흐르게 둔다.

캔버스를 클릭해 선택하는 경로는 이 신호를 켜지 않으므로 형제 이동(#151)이
그대로 동작한다 — 범위를 넓히지 않고 "도구 모음이 포커스를 가져간 이 한 번의
전환"만 좁게 고쳤다.

### 실제 컴포넌트 + 실제 키 이벤트로 검증(라이브 브라우저)

1차 시도 때 겪은 `resize_window`/스크립트 `.focus()` 미반영 문제를 피해, 이번엔
**실제 클릭과 실제 스크롤(마우스 휠)·실제 키 입력**(CDP Input 이벤트, 스크립트
`.focus()`/`dispatchEvent` 미사용)만으로 재현했다. 아트보드 높이를 `20000px`로
직접 입력해(실제 입력 필드에 실제 타이핑) 캔버스에 진짜 overflow(`scrollH` 8424
vs `clientH` 665)를 만든 뒤:

| 단계 | 동작 | 결과 |
|---|---|---|
| 1 | Screen 노드 클릭 선택 → Frame 도구 버튼 실제 클릭 | `activeElement` = Frame 버튼(`BUTTON`), 선택 유지 |
| 2 | 실제 마우스 휠로 캔버스를 바닥까지 스크롤(`scrollTop` 7759 = `scrollH - clientH`) | `toolbar[aria-hidden]="true"`, `toolbar.inert === true`, `activeElement` = `BODY`(blur 발생) |
| 3 | 실제 Tab 키 입력 | `activeElement`가 `BODY`에서 문서의 첫 포커스 가능 요소(`INPUT`)로 **이동함** — 네이티브 탐색이 흘렀다는 뜻, 형제 이동에 먹히지 않았다. 선택("Screen")은 그대로 유지 |
| 4(대조군) | 다시 스크롤을 올려 도구 모음을 보이게 한 뒤, **도구 모음을 거치지 않고** 캔버스를 직접 클릭해 새 선택을 만들고 실제 Tab 입력 | `activeElement`가 `BODY`에 그대로 **머무름**(네이티브 이동이 막힘 = `preventDefault()`가 걸렸다는 뜻) — #151의 형제 이동이 평소처럼 그대로 작동함 |

3번과 4번의 대비가 이번 수정의 핵심을 실측으로 보여준다 — 같은 "`activeElement
=== body`, 선택 있음" 상태인데도 도구 모음에서 막 떨어진 경우(3번)만 네이티브
탐색으로 흐르고, 캔버스를 직접 클릭한 경우(4번)는 여전히 형제 이동이 가로챈다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일하게 17개 실패/1519개 통과/1개 건너뜀 — Windows
심링크·권한 관련으로 기존에 이미 develop에서도 실패하던 것과 동일한 파일·같은
개수이며, 이번 변경과 무관하다(#275 1차 QA에서 `git stash`로 이미 확인한 것과
같은 사전 실패 집합). `test/canvas-input.test.ts`의 88개 테스트는 수정 없이
그대로 전부 통과 — `siblingNavDirectionForKey` 자체의 분기는 건드리지 않고
호출 여부만 게이팅했기 때문이다.

## 리뷰 3차 대응 — "모든 keydown에서 소비"가 실제 Shift+Tab 순서를 놓침 (2026-10-08)

팀원이 수정된 HEAD(b632d43)를 직접 Node 격리 하네스(DOM·스토어는 mock)로 돌려
회귀를 하나 더 찾았다: `canvasKeys.ts`가 `toolbarFocusHandoffPending`을 **모든
keydown에서** 소비하고 있었는데, 실제 키보드로 Shift+Tab을 누르면 `ShiftLeft`/
`ShiftRight` keydown이 `Tab` keydown보다 **먼저 따로** 들어온다. 그러면 그
Shift keydown이 신호를 먼저 소비해 버려서, 바로 뒤에 오는 진짜 `Tab`
(`shiftKey: true`)은 신호 없이 도착해 형제 이동(이전 형제)으로 그대로 넘어간다
— 역방향(Shift+Tab)만 이 회귀에 걸리고, 정방향 Tab은 (보통 단독으로 눌려
modifier keydown이 안 끼어서) 문제가 없었다.

**원인**: "소비 시점"을 `handleKeyDown` 맨 앞, 모든 키에 대해 무조건 실행되게
짰다 — "다른 키를 먼저 누르면 맥락이 낡은 것으로 본다"는 의도였는데, Shift
단독 keydown까지 "다른 키"로 쳐버린 것이 문제였다.

**수정**: 소비 시점을 `Tab` keydown으로만 좁혔다.
- `canvasInput.ts`에 `shouldConsumeToolbarFocusHandoff(code): boolean`을
  추가했다(`code === "Tab"`일 때만 true) — 순수 함수라 바로 단위 테스트할 수
  있다.
- `canvasKeys.ts`는 이제 `shouldConsumeToolbarFocusHandoff(event.code)`가
  참일 때만 `consumeToolbarFocusHandoffPending()`을 부른다. Shift 단독
  keydown을 포함한 다른 모든 키는 신호를 건드리지 않고 그대로 남긴다.
- 겸사겸사 게이팅 로직 자체도 `canvasKeys.ts`의 삼항 연산자(`toolbarFocusHandoff
  ? null : siblingNavDirectionForKey(...)`)에서 `SiblingNavKeyInput`의 새 필드
  `toolbarFocusHandoff`로 옮겼다 — "물러나는 판단"은 전부 `canvasInput.ts`의
  순수 함수 안에 모은다는 이 파일의 기존 원칙(`isActivationTarget`과 같은
  자리)과 맞추고, 기존 `siblingNavDirectionForKey` 테스트 스위트에 바로
  편입된다.

**검증**: `test/canvas-input.test.ts`에 테스트 4개를 추가했다(92개로 증가,
기존 88개는 무변경 통과):
- `siblingNavDirectionForKey`가 `toolbarFocusHandoff: true`일 때 정방향·역방향
  둘 다 `null`을 돌려주는지(형제 이동에서 물러나는지)
- `shouldConsumeToolbarFocusHandoff`가 `"Tab"`에서만 `true`이고,
  `ShiftLeft`/`ShiftRight`/`ControlLeft`/`AltLeft`/`MetaLeft`(단독 modifier)와
  그 밖의 키(`KeyD`/`Escape`)에서는 `false`인지 — 이번 회귀의 정확한 재현
  조건(“Shift 단독 keydown이 신호를 먼저 먹는가”)을 pure function 레벨에서
  고정했다.

**실제 브라우저의 "물리적으로 분리된 Shift→Tab keydown"은 이번에도 자동화로
재현하지 않았다.** 팀원도 자신의 검증을 "DOM·스토어는 mock이고 실제 React
렌더링/브라우저 재현은 아니다"라고 명시했듯, CDP 기반 자동화 키 입력은 보통
"Shift+Tab"을 단일 합성 이벤트(`shiftKey: true`인 `Tab` 하나)로 보내 두
keydown이 분리되는 실제 키보드 동작을 그대로 재현하기 어렵다(이 QA 문서에
누적된 자동화 한계와 같은 종류). 대신 이 회귀의 근본 원인(소비 시점)을 pure
function으로 명확히 분리하고 그 함수를 직접 테스트하는 쪽이, 이 저장소의
실제 테스트 가능 경계 안에서 가장 결정적인 근거라고 판단했다 — 팀원이 쓴
"Node 격리 하네스"와 같은 층위의 검증이다.

## 리뷰 4차 대응 — "다시 보이면 무조건 지운다"가 Tab 누르기 전 재표시 경로를 놓침 (2026-10-09)

팀원이 수정된 HEAD(2ebac50)를 Node 격리 하네스로 돌려 Shift 분리 keydown 수정은
확인했지만, 1차 리뷰에서 요청했던 경로 하나가 아직 남아 있다고 지적했다: 노드
선택 → 툴바 버튼 포커스 → 휠로 숨김(`toolbarFocusHandoffPending = true`) →
**Tab을 누르기 전에** 다시 위로 스크롤해 툴바를 재표시. `Toolbar.tsx`의 표시
분기가 "다시 보인 뒤에는 막 떨어진 포커스 맥락이 끝난 것으로 본다"며 신호를
무조건 꺼 버리는데, 이 시점에 포커스는 여전히 `body`에 머물러 있고
`selectedId`도 그대로다. 다음 Tab/Shift+Tab은 신호 없이 다시 형제 이동(#151)에
잡힌다 — 사용자는 캔버스를 다시 선택한 적이 없는데 단지 스크롤을 되돌렸다는
이유만으로 도구 모음에서 시작한 문서 탐색 기회를 잃는다.

**원인**: 신호를 끄는 조건이 "소비됐는가"가 아니라 "숨김 상태가 풀렸는가"였다.
이 둘은 보통 같이 일어나지만(숨김 상태에서 Tab을 눌러 소비한 뒤에 다시
보이는 경우), **Tab을 누르기 전에 재표시되는 경우**에는 달라진다 — 포커스가
아직 `body`에 멈춰 있는데 신호만 먼저 사라진다.

**수정**: `Toolbar.tsx`의 표시 분기에서 `document.activeElement`가 아직
`body`면 신호를 지우지 않는다. `body`를 벗어났다면(= Tab으로 이미 소비됐거나
다른 조작으로 포커스가 실제로 옮겨갔다면) 그때는 지워도 안전하다 — "막 떨어진
포커스" 맥락이 그 시점에는 이미 끝나 있다.

```ts
useEffect(() => {
  if (!hidden) {
    if (document.activeElement !== document.body) {
      useViewStore.getState().setToolbarFocusHandoffPending(false);
    }
    return;
  }
  // ...
}, [hidden]);
```

캔버스를 클릭해 선택하는 #151 주 경로는 애초에 이 신호를 켜지 않으므로
영향받지 않는다.

**실제 컴포넌트 + 실제 스크롤 + 실제 키 입력으로 검증(라이브 브라우저, CDP)**:
아트보드 높이를 20000px로 설정해 진짜 overflow를 만든 뒤(`scrollHeight` 12746
vs `clientHeight` 665):

| 단계 | 동작 | 결과 |
|---|---|---|
| 1 | Screen 노드 클릭 선택 → Frame 도구 버튼 실제 클릭 | `activeElement` = Frame 버튼, 선택 유지 |
| 2 | 실제 마우스 휠로 캔버스를 바닥까지 스크롤 | `toolbar[aria-hidden]="true"`, `inert === true`, `activeElement` = `BODY` |
| 3 | **Tab을 누르기 전에** 실제 마우스 휠로 살짝 위로 스크롤해 재표시 | `toolbar[aria-hidden]="false"`, `inert === false`, `activeElement`는 여전히 `BODY`(신호가 지워지지 않았음을 간접 확인) |
| 4 | 실제 Tab 키 입력 | `activeElement`가 `BODY`에서 다음 툴바 버튼(`Text (T)`)으로 **이동함** — 네이티브 탐색이 흘렀다는 뜻, 형제 이동에 먹히지 않았다. 선택("Screen")은 그대로 유지 |
| 5(대조군) | 도구 모음을 거치지 않고 캔버스를 직접 클릭해 새 선택(`Frame` 자식 노드 생성·선택)을 만들고 실제 Tab 입력 | `activeElement`가 `BODY`에 그대로 **머무름**(네이티브 이동이 막힘 = `preventDefault()`가 걸렸다는 뜻) — #151의 형제 이동이 평소처럼 그대로 작동함 |

4번과 5번의 대비가 이번 수정의 핵심을 실측으로 보여준다 — "숨김 → Tab 전 재표시"
경로(4번)는 네이티브 탐색으로 흐르고, 캔버스를 직접 클릭한 경로(5번)는 여전히
형제 이동이 가로챈다. 수정 전 코드로는(= 재표시 때 무조건 신호를 끔) 4번도
5번과 같은 결과(제자리에 머무름)가 나왔을 것이다 — 신호가 재표시 시점에 이미
꺼져 있었을 것이기 때문이다.

곁다리로 지적된 `/** 신호를 읽고 동시에 끈다 — 한 번 소비하면 다음
keydown부터는 다시 꺼진 상태다. */` 등 "next keydown" 표현도 3차 대응(소비
시점을 Tab으로 좁힘) 이후로 사실과 달라져 있어 "next Tab"으로 함께 정리했다
(`viewStore.ts`, `Toolbar.tsx`, `canvasInput.ts`).

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` 모두 통과했다. `pnpm test`는 기존과
동일하게 17개 실패(Windows 심링크·권한, 이번 변경과 무관)/1523개 통과/1개
건너뜀 — `test/canvas-input.test.ts`의 92개 테스트는 수정 없이 그대로 전부
통과(이번 수정은 `Toolbar.tsx`의 React effect 안 조건문만 바꿨고, 순수 함수
쪽은 건드리지 않았다).

## 리뷰 5차 대응 — 재표시 뒤 캔버스를 다시 클릭해도 handoff가 안 지워짐 (2026-10-09)

팀원이 HEAD(6d17766)를 Toolbar/store/key handler/predicate에 실제
`handleNodeClick`·선택 resolver까지 함께 실행한 38개 격리 확인으로 돌려,
4차 대응이 못 막은 경로를 하나 더 찾았다: 노드 선택 → Select 툴바 버튼 포커스
→ 스크롤 숨김 → (선택적으로) 재표시 → **Tab을 누르기 전에 캔버스의 다른
프레임을 클릭** → Tab/Shift+Tab. 클릭으로 새 프레임이 선택되지만
`toolbarFocusHandoffPending`은 그대로 켜져 있어서, 첫 Tab이 방금 새로 고른
선택의 정상적인 형제 이동(#151) 대신 다시 문서 탐색으로 빠진다 — `body`
포커스만으로는 "스크롤로 떨어진 포커스"와 "캔버스를 다시 눌러 새로 선택"을
구분할 수 없었다.

**원인**: 4차 대응은 신호가 꺼지는 조건을 "소비(Tab)"와 "재표시 후 포커스가
`body`를 벗어남" 둘로 좁혔지만, "캔버스를 다시 클릭해 새로 선택"은 그 어느
쪽도 아니다 — 클릭해도 `body`는 포커스를 받지 않는 요소라(주석 참고)
`activeElement`가 그대로 `body`에 머문다. 신호를 끝낼 세 번째 조건
("포인터로 캔버스 조작을 재개했다")이 빠져 있었다.

**수정**: `canvasSelection.ts`에 `clearToolbarFocusHandoff()`를 추가하고
캔버스 포인터 조작의 네 진입점 — `handleNodeClick`·`handleNodeDoubleClick`·
`handleNodeContextMenu`·`handleBackgroundClick` — 맨 앞에서 무조건 호출한다.
선택이 실제로 바뀌는지와 무관하게(같은 노드 재클릭, 배경 클릭으로 선택
해제 등) 포인터 조작 자체가 "재개"의 신호이므로 선택 로직보다 먼저 끈다.
드래그로 선택이 바뀌는 경로(`useNodeDrag.ts`)는 드래그가 임계값을 넘으면
합성 click을 `suppressClick`으로 죽여 `handleNodeClick`을 거치지 않으므로,
`select(session.dragId)` 바로 다음에 같은 호출을 추가해 같은 간격이 생기지
않게 했다. 레이어 트리 패널 클릭(`LayerTree.tsx`)은 팀원이 짚은 "캔버스
포인터 조작"의 범위 밖이라 이번에는 건드리지 않았다 — 같은 종류의 잠재
버그가 있을 수 있지만 재현도, 요청도 없었다.

### 실제 컴포넌트 + 실제 클릭·스크롤·키 입력으로 검증(라이브 브라우저)

아트보드 높이 20000px로 overflow를 만든 뒤:

| 단계 | 동작 | 결과 |
|---|---|---|
| 1 | Screen 노드 클릭 선택 → Select 툴바 버튼 실제 클릭 | `activeElement` = Select 버튼, 선택 유지 |
| 2 | 실제 마우스 휠로 캔버스를 바닥까지 스크롤 | `toolbar[aria-hidden]="true"`, `activeElement` = `BODY` |
| 3 | 실제 마우스 휠로 살짝 위로 스크롤해 재표시 | `toolbar[aria-hidden]="false"`, `activeElement`는 여전히 `BODY`(4차 수정대로 신호 유지) |
| 4 | **Tab을 누르기 전에** 캔버스의 Screen 프레임을 실제로 클릭 | 선택은 그대로 Screen(같은 노드 재클릭), `activeElement`는 여전히 `BODY`(클릭이 포커스를 주지 않음) |
| 5 | 실제 Tab 키 입력 | `activeElement`가 `BODY`에 그대로 **머무름**(네이티브 이동이 막힘 = `preventDefault()`가 걸렸다는 뜻) — #151의 형제 이동이 정상적으로 가로챔. 수정 전이었다면 handoff가 남아 있어 다음 툴바 버튼으로 **이동**했을 것이다 |
| 6(대조군) | 1~3을 다시 거친 뒤, **클릭 없이** 바로 Tab | `activeElement`가 `BODY`에서 다음 툴바 버튼(`Frame`)으로 **이동함** — 4차 대응이 고친 "재표시 후 바로 Tab" 경로는 이번 수정과 무관하게 그대로 네이티브 탐색으로 흐름 |

5번과 6번의 대비가 이번 수정의 핵심이다 — 재표시까지는 같은 상태(`activeElement
=== body`)인데, 그 사이에 캔버스를 다시 클릭했는가(5번, 형제 이동으로 복귀)
아닌가(6번, 네이티브 탐색 유지)로 결과가 갈린다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` 모두 통과했다. `pnpm test`는 기존과
동일한 17개 실패(Windows 심링크·권한, 무관)/1523개 통과/1개 건너뜀 —
`test/canvas-input.test.ts`의 92개 테스트는 이번 수정이 `canvasSelection.ts`·
`useNodeDrag.ts`의 이벤트 핸들러만 건드리고 `canvasInput.ts`의 순수 함수는
그대로 둬서 수정 없이 전부 통과했다.

## 결론

- 완료 조건 "숨긴 툴바에 Tab/Shift+Tab으로 진입하지 않는다" — `inert`로 보장됨을
  fixture로 확인(4번)
- 완료 조건 "숨기는 순간 내부 포커스 이동 … 검증한다" — `inert`만으로는 안 되고
  명시적 `blur()`가 필요함을 fixture로 확인(2번), `Toolbar.tsx`에 반영함
- "다시 표시했을 때의 포커스 정책" — 자동 복원하지 않고 다시 탭 가능해지는 것으로
  정했고 fixture로 확인(5번)
- 리뷰(81bcfba, P2) 1차 대응: 숨김 후 Tab이 형제 이동으로 넘어가는 현상 자체는
  `test/canvas-input.test.ts`의 기존 유닛 테스트로 확인됨 — 다만 "코드 변경
  없음"이라는 결론은 틀렸고, 아래 "리뷰 재검토" 절이 바로잡았다
- 리뷰 2차 대응(#151 §2 원문 재검토): 도구 모음이 포커스를 가져간 전환 한 번만
  형제 이동을 비켜서도록 `viewStore.toolbarFocusHandoffPending` 1회성 신호를
  추가(`Toolbar.tsx`가 켜고 `canvasKeys.ts`가 소비) — 캔버스 클릭으로 선택하는
  #151 주 경로는 그대로 두고, 실제 컴포넌트·실제 스크롤·실제 키 입력으로 두
  경로(도구 모음에서 떨어진 포커스 vs 캔버스 직접 클릭)가 서로 다르게 동작함을
  확인
- 리뷰 3차 대응: "모든 keydown에서 소비"가 실제 키보드의 분리된 Shift→Tab
  keydown 순서를 놓쳐 역방향(Shift+Tab)만 회귀시킨 것을 발견 — 소비 시점을
  `Tab` keydown으로만 좁히고(`shouldConsumeToolbarFocusHandoff`), 물러나는
  판단 자체도 `siblingNavDirectionForKey`(`canvasInput.ts`) 안으로 옮겨 기존
  순수 함수 테스트 스위트에 편입(92개로 증가)
- 리뷰 4차 대응: 재표시(`hidden`이 `false`로 바뀌는 순간) 분기가 포커스가 아직
  `body`에 머물러 있어도(= Tab을 누르기 전) 신호를 무조건 꺼 버려, "숨김 →
  Tab 전 재표시 → Tab" 경로가 다시 형제 이동에 잡히던 것을 발견 — `document.
  activeElement !== document.body`일 때만 지우도록 좁혔다. 실제 컴포넌트·
  실제 스크롤(휠)·실제 Tab 입력으로 "재표시 후 Tab"(네이티브 탐색으로 흐름)과
  "캔버스 직접 클릭 후 Tab"(여전히 형제 이동에 가로채짐) 두 경로가 서로 다르게
  동작함을 라이브 브라우저에서 확인
- 리뷰 5차 대응: `body` 포커스만으로는 "스크롤로 떨어진 포커스"와 "캔버스를
  다시 클릭해 새로 선택"을 구분 못 해, 재표시 뒤 Tab 전에 캔버스의 다른
  프레임을 클릭해도 남은 handoff가 그 새 선택의 형제 이동을 가로막던 것을
  발견 — 캔버스 포인터 조작의 네 진입점(`handleNodeClick`·
  `handleNodeDoubleClick`·`handleNodeContextMenu`·`handleBackgroundClick`,
  `canvasSelection.ts`)과 드래그 선택(`useNodeDrag.ts`)에서 포인터 조작 자체를
  "재개" 신호로 보고 무조건 신호를 끄도록 추가 — 실제 컴포넌트·실제 클릭·
  실제 스크롤·실제 Tab 입력으로 "재표시 → 클릭 → Tab"(형제 이동으로 복귀)과
  "재표시 → 클릭 없이 Tab"(네이티브 탐색 유지, 4차 대응 결과 그대로)이 서로
  다르게 동작함을 라이브 브라우저에서 확인
