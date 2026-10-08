# 패널 개별 접기·폭 조절 설계 (#287)

기준: 2026-10-05 제품 점검 `D03` · P2 · develop `ad3b6f17d183b69b1589707e7e8d032806ba4c88`.

## 문제

`EditorLayout.tsx`는 좌측 레이어 트리(300px)·우측 세부설정 패널(350px)을 고정
폭으로 그린다 — 합 650px. `View ▸ Panels/Sidebars`로 **둘을 한꺼번에** 숨기는
전체 토글은 이미 있지만, 한쪽만 접거나 폭을 조절하는 길은 없다.

실측 Canvas 폭(패널을 안 접은 기본 상태):

| 창 폭 | Canvas 폭 |
|---|---|
| 1366px | 716px |
| 1024px | 374px |
| 800px | 150px |

1024px 창에서는 캔버스가 거의 못 쓸 정도로 좁아지고, 전체 토글은 "둘 다 숨기고
속성도 전혀 못 본다"는 전부-또는-전무 선택지뿐이다 — 예를 들어 레이어 트리는
안 봐도 되지만 속성 패널은 계속 보면서 캔버스를 넓히고 싶은 경우를 못 받는다.

## 범위

개별 패널 접기·폭 조절·상태 유지·최소 지원 폭 설계가 범위다. 이미 있는 전체
토글(`showPanels`)은 그대로 둔다 — 건드리지 않는다. 편집기를 모바일 레이아웃으로
다시 짜는 것은 범위 밖이다(이슈 본문).

## 결정

### 1. 접힌 패널은 완전히 사라지지 않고 "레일"로 남는다

전체 토글(`showPanels=false`)은 폭을 0으로 만들어 완전히 숨기지만, 개별 접기는
`32px`짜리 좁은 세로 레일을 남긴다 — 펼치기 버튼 하나만 있다. 폭 0으로 완전히
접으면 "다시 펼치려면 메뉴를 찾아야" 해서, 캔버스를 넓히려고 접은 사람이 다시
그 패널을 열 때 메뉴를 뒤지게 된다. 레일은 VSCode의 사이드바 접기와 같은 흔한
패턴이고, 패널이 "숨었다"가 아니라 "좁아졌다"로 읽혀서 전체 토글과 구분된다.

### 2. 폭 조절은 그 패널의 안쪽 경계에 드래그 핸들로 — 끌기 중엔 어느 쪽도 "펴지지" 않는다

레이어 트리는 오른쪽 경계, 속성 패널은 왼쪽 경계에 `4px` 드래그 핸들을 둔다
(캔버스 `CanvasResizeHandles.tsx`의 mousedown→window mousemove/mouseup 패턴과
같은 구조). `role="separator" aria-orientation="vertical"`로 표시하고, 포커스된
상태에서 `ArrowLeft`/`ArrowRight`로도 조절할 수 있게 한다(마우스가 없는 환경 대비,
비용이 크지 않다). 접힌(레일) 상태에는 핸들을 그리지 않는다 — 펼치기 버튼 하나로
충분하고, 32px 레일에서 드래그 핸들까지 두면 손가락 하나 들어갈 자리에 버튼 두
개가 겹친다.

### 3. 폭은 280px~480px로 자른다, 접기는 별도 플래그다

"아주 좁게 끌면 자동으로 접힌다" 같은 연속 동작을 만들지 않는다 — 어느 폭에서
접힘으로 바뀌는지 사용자가 예측하기 어렵고, 되돌릴 때도 "끌어서 펴기"와 "접기
버튼으로 펴기"가 같은 자리에서 경합한다. 대신 접기(`collapsed: boolean`)와 폭
(`width: number`, 펼친 상태에서만 의미 있다)을 **독립된 상태**로 둔다. 핸들을
280px보다 좁게 끌면 그냥 280px에서 멈춘다 — 접으려면 헤더의 접기 버튼을 누른다.

**최소 폭은 처음엔 200px이었다가 리뷰에서 280px로 올렸다**(아래 "리뷰 대응
2차" 참고) — 200px은 추정이었는데, 실제 Chromium 재현에서 1024×768·
200px 속성 패널 기준 hex 색상·breakpoint ID 입력칸이 `clientWidth 20px`
까지 눌려 좌우 padding이 그걸 통째로 먹어 텍스트 영역이 0px이 되는 게
확인됐다. 480px은 반대쪽 — 패널이 캔버스보다 넓어지는 걸 막는 상한이다.
정밀 측정이 아니라 두 패널의 실제 콘텐츠 폭을 보고 고른 값이라, 리뷰나 실사용
중 너무 좁다/넓다는 신호가 오면 상수 하나만 바꾸면 된다(`panelLayout.ts`).

### 4. 상태는 패널마다 하나의 localStorage 키로, `theme-storage.ts`·`specStorage.ts`와 같은 패턴

```ts
interface PanelLayoutState {
  treeCollapsed: boolean;
  treeWidth: number;   // MIN_PANEL_WIDTH..MAX_PANEL_WIDTH
  propsCollapsed: boolean;
  propsWidth: number;
}
```

새 탭·새로고침 뒤에도 접은 채로, 조절한 폭 그대로 남는다 — "작은 창에서 한 번
접어 두면 계속 그 상태"가 이 이슈가 요구하는 "상태 유지"다. `localStorage` 접근은
항상 try/catch로 감싼다(프라이빗 모드 등으로 언제든 실패할 수 있다, 기존
관례). 저장된 값이 깨졌거나 없으면 기존 기본값(300/350, 펼침)으로 돌아간다 —
전체 토글이 추가되기 전의 동작과 같다.

### 5. 폭 CSS 토큰(`--layout-tree-width`·`--layout-props-width`)을 지운다

`DESIGN-TOKEN-RULES.md`의 "고정 치수가 필요하면 토큰을 만들고 `var()`로
참조한다"는 **고정값** 규칙이다. 패널 폭은 이제 사용자가 드래그로 바꾸는 런타임
값이라 애초에 "고정 치수"가 아니다 — `Canvas.tsx`/`CanvasNode.tsx`/
`CanvasResizeHandles.tsx`가 노드 크기·위치 같은 런타임 값을 전부 인라인
`style={{...}}`로 적용하는 것과 같은 자리다. `EditorLayout.tsx`가
`gridTemplateColumns`를 (showPanels · 접힘 · 폭) 조합으로 매 렌더 계산해 인라인
스타일로 적용한다. `--layout-tree-width-collapsed`/`--layout-props-width-collapsed`
(둘 다 `0px`, 전체 토글 숨김용)도 같은 계산에 합쳐 넣고 지운다 — 네 토큰을
각각 안 챙겨도 되고, "전체 숨김 0px"과 "개별 레일 32px"과 "펼친 상태 N px"가
한 함수 안에서 한 번에 맞는지 보인다. `--layout-menubar-height`는 고정값이라
그대로 둔다.

### 6. "작은 창의 우선 표시" — 자동 반응형 규칙은 만들지 않는다

창 폭에 따라 패널을 자동으로 접거나 줄이는 로직은 넣지 않는다. 언제 자동으로
접힐지 예측하기 어렵고(테스트도 창 폭 조합마다 다시 해야 한다), 사용자가 의도치
않은 순간에 패널이 사라지면 "방금 보던 속성이 어디 갔지"가 된다. 대신 **이번에
만드는 수동 접기/조절 자체가 "작은 창 우선 표시"의 구현**이다 — 1024px 창에서
Canvas가 374px밖에 안 남는 문제는, 자동 규칙이 아니라 사용자가 필요할 때 레이어
트리나 속성 패널 중 지금 안 보는 쪽을 접어 캔버스를 넓히는 것으로 푼다. 그 상태가
저장되므로 한 번 접으면 다음에 열 때도 넓은 캔버스로 시작한다.

### 7. 최소 지원 폭 — 1024px

**1366×768과 1024×768 두 해상도에서 주요 조작(선택·속성 편집·레이어 트리 이동·
자연어 입력)이 가능해야 한다.** 1024px이 최소 지원 폭이다 — 그 아래(800px 등)는
패널을 모두 접어도 캔버스가 넉넉하지 않을 수 있고, 모바일 레이아웃 재설계는
이슈 범위 밖이므로 "된다고 보증하지 않는다"로 명시한다(아래 "범위 밖" 참고).

## 상태별 wireframe

### 둘 다 펼침(기본, 접기 전 폭 그대로 유지)

```
┌────────────────────────────────────────────────────────┐
│ 메뉴바                                                    │
├──────────┬───┬──────────────────────────┬───┬────────────┤
│          │ ⇔ │                          │ ⇔ │            │
│ Layers ▾ │   │          Canvas          │   │ Properties │
│          │   │                          │   │            │
├──────────┴───┴──────────────────────────┴───┴────────────┤
│ AI 입력창(전폭)                                             │
└────────────────────────────────────────────────────────┘
```

`⇔`는 드래그 핸들(각 패널의 안쪽 경계, 캔버스 쪽).

### 좌측(Layers)만 접음

```
┌────────────────────────────────────────────────────────┐
│ 메뉴바                                                    │
├──┬───────────────────────────────────────┬───┬───────────┤
│▸ │                                       │ ⇔ │           │
│  │               Canvas (넓어짐)            │   │Properties │
│  │                                       │   │           │
├──┴───────────────────────────────────────┴───┴───────────┤
│ AI 입력창(전폭)                                             │
└────────────────────────────────────────────────────────┘
```

32px 레일의 `▸` 버튼을 누르면(또는 `View ▸ Layers Panel`) 펼쳐진다.

### 양쪽 다 접음 — 1024px 창에서 Canvas를 최대로

```
┌────────────────────────────────────────────────────────┐
│ 메뉴바                                                    │
├──┬─────────────────────────────────────────────────┬──┤
│▸ │                  Canvas (960px, 1024px 창 기준)       │ ◂│
├──┴─────────────────────────────────────────────────┴──┤
│ AI 입력창(전폭)                                             │
└────────────────────────────────────────────────────────┘
```

1024px 창 기준: 레일 32+32=64px, Canvas = 1024-64 = 960px(접기 전 374px 대비
+586px). 전체 토글(`showPanels=false`)과 다른 점은 **속성 패널을 다시 열면 바로
직전 폭으로 돌아온다**는 것 — 전체 토글은 토글을 켤 때 항상 기본 폭(300/350)으로
돌아간다(기존 동작, 안 바꾼다).

## 컴포넌트/모듈 계획

- `src/features/editor/store/panelLayout.ts` — 상수(`PANEL_RAIL_WIDTH=32`,
  `MIN_PANEL_WIDTH=280`, `MAX_PANEL_WIDTH=480`, `DEFAULT_TREE_WIDTH=300`,
  `DEFAULT_PROPS_WIDTH=350`), 순수 함수 `clampPanelWidth`·`parsePanelLayout`,
  `localStorage` IO `loadPanelLayout`/`savePanelLayout` — `specStorage.ts`와 같은
  파일 하나에 순수+IO를 같이 두는 구성(그 파일이 이미 그렇게 한다. `store/`가
  DOM 타입 없이 검사된다는 규칙은 **테스트 파일의 tsconfig 배정**에 대한
  규칙이지 소스 파일 자체의 규칙이 아니다 — `@types/node`가 `localStorage`
  전역 타입을 제공해 `tsc -b`는 그대로 통과하고, 테스트만 `vi.stubGlobal`로
  흉내 낸다, `spec-storage.test.ts`와 같은 패턴).
- `src/features/editor/store/viewStore.ts` — `treeCollapsed`·`treeWidth`·
  `propsCollapsed`·`propsWidth` state와 `toggleTreeCollapsed`·
  `togglePropsCollapsed`·`setTreeWidth`·`setPropsWidth` 액션을 더한다. 초기값은
  `loadPanelLayout()`에서, 각 액션은 바뀐 뒤 `savePanelLayout`을 호출한다.
- `src/features/editor/ui/PanelResizeHandle.tsx`(신규) — 레이어 트리·속성 패널이
  공유하는 드래그 핸들. `onResize(nextWidth: number)`·`width`·`side`("left"|"right",
  드래그 방향 부호만 다르다) props.
- `LayerTree.tsx`·`PropertiesPanel.tsx` — 헤더에 접기 버튼 추가, `treeCollapsed`/
  `propsCollapsed`일 때 레일 전용 렌더로 분기, 펼친 상태에선 `PanelResizeHandle`을
  경계에 단다.
- `EditorLayout.tsx` — `gridTemplateColumns`를 인라인 스타일로 계산(위 5번).
- `MenuBar.tsx`의 `VIEW_MENU` — "Layers Panel"·"Properties Panel" 토글 항목을
  기존 "Panels/Sidebars" 아래에 추가한다(체크 상태는 `!collapsed`). 기존
  "Panels/Sidebars"에 단축키가 없는 것과 같은 이유로 새 항목도 메뉴 전용이다
  (`docs/10-shortcuts.md`가 실제 동작하는 것만 적는 문서라 여기서 새 단축키를
  만들지 않는 한 그 문서는 안 건드린다).
- `src/styles/tokens/semantic/layout.css` — `--layout-tree-width`·
  `--layout-props-width`·`--layout-tree-width-collapsed`·
  `--layout-props-width-collapsed` 네 토큰을 지운다(위 5번).

## 검증

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한 등, 무관)/1669개
통과/2개 건너뜀 — 신규 `test/panel-layout.test.ts`(11개)와
`test/view-store.test.ts`에 더한 3개가 더해진 수치다.
`clampPanelWidth`·`parsePanelLayout`(깨진 값·필드 누락·타입 불일치 전부
기본값으로)·`loadPanelLayout`/`savePanelLayout`(localStorage 접근 실패를
조용히 삼키는 경로 포함)·`viewStore`의 네 액션(접힘 반전·폭 clamp·저장 왕복)
을 고정했다.

### 브라우저 실측은 이번에 못 했다

1366×768·1024×768 두 해상도에서 Chrome으로 직접 들어가 보려 했으나, 홈에서
프로젝트 카드를 클릭해 에디터로 들어가는 전환에서 이 세션의 Chrome 확장이
멈췄다 — `docs/20-manual-agent-handoff-ui.md`·`docs/21-home-screen-nl-draft.md`
가 각각 #283·#286에서 이미 기록한 것과 같은 증상이다. 이번엔 스크린샷뿐
아니라 `Runtime.evaluate`(단순 `document.title` 읽기)까지 45초 타임아웃으로
실패해 **렌더러 자체가 멈춘 것**을 확인했다 — 스크린샷 도구만의 문제가
아니다. 두 차례 재시도 후 포기했다(반복 재시도 금지 원칙).

이 증상은 **이번 변경과 무관하다** — #286 세션에서 이 PR이 건드리지 않은
"빈 캔버스에서 시작" 경로로도 같은 방식으로 재현된 적이 있고, 애초에 멈추는
시점이 홈→에디터 **전환 자체**(React가 `EditorLayout` 서브트리를 새로
마운트하는 순간)이지 패널 UI가 렌더된 뒤가 아니다 — 이번 PR이 바꾼 코드가
실행되기도 전에 멈춘다.

### 대신 계산으로 확인한 것

`EditorLayout.tsx`의 그리드 공식은 단순하다 — `Canvas 폭 = 창 내부 폭 -
좌측 컬럼 폭 - 우측 컬럼 폭`(메뉴바·AI 입력창은 전폭이라 가로 폭을 안 먹는다,
테두리는 Tailwind preflight의 `box-sizing: border-box`라 폭에 포함된다). 이
공식을 이슈 본문이 실측한 **접기 전** 숫자로 거꾸로 검산할 수 있다 —
`1366-650=716`·`1024-650=374`·`800-650=150`, 셋 다 이슈의 실측값과 **정확히**
일치한다. 즉 이 공식은 가정이 아니라 기존 실측으로 이미 검증된 식이고, 거기에
이번에 더한 변수(레일 32px·접힘 플래그·조절된 폭)만 얹으면 된다.

| 창 폭 | 기본(둘 다 펼침, 300+350) | 둘 다 접음(32+32) | 둘 다 최소폭(280+280, 리뷰 대응 이후 값) |
|---|---|---|---|
| 1366px | 716px (기존, 변화 없음) | **1302px** (+586) | 806px (+90) |
| 1024px | 374px (기존, 변화 없음) | **960px** (+586) | 464px (+90) |
| 800px | 150px (기존, 변화 없음) | **736px** (+586) | 240px (+90) |

**완료 조건의 "Canvas 가용 공간 개선"은 이 표로 충족한다** — 1024px 창에서
가장 좁았던 374px가, 패널을 둘 다 접으면 960px로 거의 1000px에 가까워진다.
전체 토글(`showPanels=false`)로도 이미 1024-0=1024px까지 늘릴 수 있었지만,
그건 속성 패널도 전혀 못 보는 대가였다 — 이번 기능은 **속성 패널은 레일로
남기고 레이어 트리만 접는** 식의 중간 지점(1024-32-350=642px)도 고를 수
있게 한 것이 실질적인 개선이다.

브라우저 확대(`Ctrl`+`+`/`-`)는 별도 코드 경로가 없다 — 이 레이아웃은 창
너비를 직접 읽지 않고 CSS 그리드/`ResizeObserver`가 보는 **실제 뷰포트 CSS
px**만 본다. 브라우저 확대는 창 크기를 바꾸는 것과 동일하게 그 CSS px 값을
바꾸므로, 창 크기 변화와 같은 코드 경로를 탄다 — 별도로 분기한 로직이 없다는
뜻이지, 실제로 그렇게 반응하는지 **화면으로 확인하지는 못했다**(위 "브라우저
실측은 이번에 못 했다" 참고).

**다음 세션에서 이 Chrome 확장 증상이 없을 때 직접 확인해야 할 것**(2026-10-08
갱신 — 아래 "리뷰 대응" 절에서 팀원이 실제 Chromium으로 대부분을 먼저
확인했다. 체크된 항목은 **내가 아니라 리뷰어가 실측**한 것이다):

- [x] 1366×768·1024×768에서 레이어 트리/속성 패널 접기·펼치기 버튼이 보이고
      누르면 즉시 레일로/원래 폭으로 전환되는지(리뷰어 실측 — "독립
      접기/펴기" 통과, 기본 Canvas 폭 716/374px·양쪽 접힘 후 1302/960px도
      직접 확인해 위 "계산으로 확인한 것" 표의 예측과 정확히 일치했다)
- [ ] 드래그 핸들을 끌면 실시간으로 폭이 바뀌고, 280px/480px에서 멈추는지
      (리뷰어가 실제 확인한 건 "양방향 resize"·"200/480 clamp"다 — 구
      최소값 200px 기준이었다. 280px로 올린 뒤 다시 확인 필요)
- [x] 핸들에 포커스를 두고 `ArrowLeft`/`ArrowRight`로도 조절되는지(리뷰어
      실측 — "키보드 증감" 통과)
- [x] 새로고침 뒤 접힘·폭이 그대로 유지되는지(localStorage)(리뷰어 실측 —
      "reload/Home 이동 후 상태 보존" 통과)
- [ ] `View ▸ Layers Panel`/`Properties Panel` 메뉴 토글이 버튼과 같은 동작을
      하는지, 체크 표시가 접힘 상태와 맞는지(리뷰어 보고에 명시적 언급
      없음 — 리뷰가 찾은 Export/티켓 열림 중 접기 버그(아래 "리뷰 대응"
      2번)가 이 메뉴 경로로 터졌으므로, 그 수정과 함께 재확인 필요)
- [x] 접힌 상태에서 레이어 트리 드래그 끌어놓기·속성 편집 등 기존 기능이
      깨지지 않는지(리뷰어 실측 — "레이어 재정렬/선택/텍스트 편집/NL 입력"
      통과)
- [x] 브라우저 확대(125%/150%)에서 주요 조작(리뷰어 실측 — "실제 125%/150%
      zoom을 적용하고 DPR 및 CSS viewport를 확인한 뒤 주요 조작도 검증")

## 자체 code-review 대응 (2026-10-08, 커밋 b628631 이후)

`/code-review`를 돌려 다섯 건을 찾아 고쳤다.

1·2. **Export/구현 티켓을 열 때 전체 토글만 풀고 개별 접힘은 안 풀었다.**
   `openExportPanel.ts`·`openTicketPanel.ts`는 `showPanels`가 꺼져 있으면
   켜지만, 속성 패널이 레일로 접혀 있으면(`propsCollapsed`) 그건 안 건드려서
   Export/티켓 내용이 32px 레일에 그대로 그려질 수 있었다. 두 파일 모두
   `if (view.propsCollapsed) view.togglePropsCollapsed();`를 더했다.
3. **드래그 핸들이 `overflow-hidden`에 반쯤 잘렸다.** 경계에 걸치려고
   `translate-x-1/2`로 패널 바깥까지 반을 밀어냈는데, 부모 `<aside>`가
   `overflow-hidden`이라 그 바깥 절반은 클릭도 hover도 안 먹었다 —
   클릭 가능 영역이 설계한 4px의 절반(~2px)으로 좁아져 있었다. translate를
   빼고 패널 안쪽에 완전히 들어오게 고쳤다(`right-0`/`left-0` 그대로).
4. **드래그 중 mousemove마다 localStorage에 썼다.** `CanvasResizeHandles.tsx`
   는 끝날 때만 커밋하는데 이쪽은 매 픽셀마다 `savePanelLayout`을 불러 빠른
   드래그에서 버벅일 수 있었다. `setTreeWidth`/`setPropsWidth`를 state만
   바꾸는 함수로 좁히고, `commitPanelLayout`(지금 상태를 한 번 저장)을
   새로 둬 드래그 끝(mouseup)과 키보드 조절 한 번(그 자체로 완결된 동작이라
   매번 커밋)마다만 부르게 했다. `toggleTreeCollapsed`/`togglePropsCollapsed`
   는 단발성 클릭이라 그대로 즉시 저장한다.
5. **접힌 레일 JSX가 LayerTree.tsx·PropertiesPanel.tsx에 거의 그대로
   중복돼 있었다.** `PanelRail.tsx`로 뽑았다 — 둘의 유일한 차이(그리드
   영역·테두리 위치·아이콘·라벨)만 props로 받는다. 런타임에 Tailwind 클래스
   이름을 이어붙이지 않는다(`grid-area:${x}`처럼 쓰면 빌드 시점에 Tailwind가
   못 찾는다) — `gridArea`/`border` 값마다 완결된 리터럴 클래스 문자열을
   삼항으로 고른다, `EditorLayout.tsx`의 기존 패턴과 같다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한 등, 무관)/1671개
통과/2개 건너뜀 — `test/view-store.test.ts`에 `commitPanelLayout`과
"setTreeWidth/setPropsWidth만으로는 저장 안 됨"을 고정하는 테스트를 더했다.

## 리뷰 대응 (2026-10-08, 커밋 c673945 검토) — 실제 Chromium 재현 3건

팀원(`Yumesa2025`)이 실제 Chromium으로 재현한 P2 세 건과 비차단 관찰
한 건을 남겼다. 이번엔 라이브 브라우저 재현까지 포함해 검토가 훨씬
꼼꼼했다 — 이전 두 라운드가 코드 추론으로만 확인했던 부분(브라우저 멈춤
때문에)을 실제로 밟아 본 것이다.

1. **리사이즈 separator에서 Tab 포커스가 갇혔다.** `canvasKeys.ts`의 전역
   Tab 핸들러(`window`에 걸려 있다 — 캔버스가 포커스를 못 받는 요소라서)가
   `role="separator"`를 형제 이동 후보에서 안 뺐다. 핸들에 포커스가 있는
   동안 선택된 노드가 있으면 Tab/Shift+Tab을 가로채 `preventDefault`하고
   형제 노드를 바꿔 버려서, 사용자 눈에는 포커스가 핸들에 갇힌 채 선택만
   바뀌는 것으로 보였다. `siblingNavDirectionForKey`(`canvasInput.ts`)에
   `if (input.role === "separator") return null;`을 추가했다 — 버튼·링크를
   빼는 기존 `isActivationTarget` 가드와 같은 자리다. `test/canvas-input.test.ts`
   에 회귀를 추가했다.
2. **Export/티켓을 먼저 연 뒤 속성 패널을 접으면 32px에 전체 내용이
   눌렸다.** 지난 라운드에서 "열 때 접혀 있으면 편다"는 고쳤지만
   (`openExportPanel.ts`/`openTicketPanel.ts`), 반대 순서(먼저 열고 나중에
   `View ▸ Properties Panel`로 접기)는 안 막았다 — `PropertiesPanel.tsx`
   자신의 접기 버튼은 Export/티켓이 보이는 동안 애초에 렌더되지 않아 이
   경로로는 못 터지지만, 메뉴 항목은 항상 눌을 수 있어 거기로만 터졌다.
   "오른쪽 slot 전체에 접힘 UI를 일관되게 적용" 대신(여러 패널 컴포넌트를
   다시 구조화해야 하는 더 큰 변경) "열려 있는 동안 접지 못하게" 쪽을 골랐다
   — Export/티켓이 차지한 자리를 접는 것 자체가 애초에 뜻이 없는 조작이라
   (방금 열어서 보려던 걸 좁히는 것), 금지가 더 맞는 기본 동작이다.
   `ToggleEntry`에 `ActionEntry`와 같은 `disabled?: boolean`을 더하고
   (`menuEntry.ts`·`menu.tsx`), `MenuBar.tsx`의 "Properties Panel" 항목을
   `useExportStore`/`useTicketStore`의 `isOpen` 동안 비활성화했다.
   `test/panel-handoff.test.ts`에 open 함수들이 접힘을 푸는 것(지난 라운드
   회귀)과 함께 "이미 펼쳐져 있으면 그대로 둔다" 케이스를 더했다. 메뉴
   `disabled` 배선은 JSX라 이 저장소 관례대로 자동 테스트는 못 더했다.
3. **허용한 최소 200px에서 속성 입력값이 안 보였다.** 1024×768·200px에서
   Button을 고르면 hex 색상·breakpoint ID 입력칸이 `clientWidth 20px`까지
   눌려 좌우 padding(10px×2)이 그 20px을 통째로 먹었다 — 입력칸들이
   고정폭 스와치·불투명도·버튼과 한 flex row에 있어 줄어드는 폭을 거의
   전부 떠안기 때문이다(`ColorField.tsx`·`ResponsivePanel.tsx`). 내부
   컨트롤을 반응형으로 바꾸는 대신(필드 컴포넌트 여러 개를 건드려야 하고
   회귀 범위가 커진다) `MIN_PANEL_WIDTH`를 350px(기본 속성 패널 폭, hex
   159px·ID 163px로 정상이었던 기준)에서 거슬러 올라가 실패 지점(200px)
   보다 확실히 위인 **280px**로 올렸다(`panelLayout.ts`). "결정" 3번과
   관련 숫자(검증 표 등)를 전부 280으로 맞춰 고쳤다.

**비차단 관찰도 반영했다.** 드래그 도중 핸들을 가진 컴포넌트가 언마운트되면
(패널을 접거나 홈으로 나가는 등) `window`에 건 mousemove/mouseup 리스너는
DOM 노드 생사와 무관해 계속 폭을 바꿀 수 있었다. `PanelResizeHandle.tsx`에
언마운트 시 진행 중인 드래그를 정리하는 `useEffect` 클린업을 더했다 — 실제
OS 포커스 상실 시험은 아니었다는 리뷰의 단서처럼, 이것도 라이브 브라우저로
재확인은 못 했지만 코드상 누락이 명백해 고쳤다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한 등, 무관)/1675개
통과/2개 건너뜀 — `test/canvas-input.test.ts`에 separator 제외 회귀 2개,
`test/panel-handoff.test.ts`에 접힘-해제 회귀 3개를 더했다(`test/panel-layout.test.ts`
의 기존 왕복 테스트 하나는 고정값이 새 MIN_PANEL_WIDTH 아래로 떨어져
있던 것을 280 이상으로 고쳤다 — 테스트 수는 그대로다).

## 범위 밖

- 창 폭에 따른 자동 접기/축소(위 6번) — 수동 접기+상태 유지로 같은 목적을 푼다.
- 800px 이하 창에서의 완전한 사용성 보증 — 모바일 레이아웃 재설계는 이슈 범위
  밖이다. 1024px을 최소 지원 폭으로 명시한다(위 7번).
- 상/하단(도구 모음·AI 입력창) 리사이즈 — 이슈 본문과 완료 조건이 좌우 패널만
  가리킨다.
- 레이어 트리·속성 패널 "안쪽" 콘텐츠의 반응형 재배치(예: 좁아지면 라벨을
  아이콘으로 줄이기) — 처음엔 200px 최소폭이면 줄바꿈 없이 들어간다고
  판단해 범위에서 뺐지만, 실제로는 hex·breakpoint ID 입력칸이 200px에서
  깨지는 게 리뷰에서 발견됐다("결정" 3번·"리뷰 대응 2차" 참고). 내부 컨트롤을
  반응형으로 바꾸는 대신 최소 폭을 280px로 올려 그 범위 밖 결정은 유지했다 —
  더 낮은 폭을 또 지원해야 할 신호가 오면 그때 이 범위 제외를 다시 본다.
