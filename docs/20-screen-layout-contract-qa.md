# 화면 viewport·스타일·노드 좌표 통합 계약 (#280)

상태: viewport/스타일 계약과 비교 도구·회귀 테스트를 작성했다. 기존 실제 Codex 실행의
[기록](qa/2026-10-05-real-ai-login.json)과 [화면](qa/2026-10-05-real-ai-login.png)은 남아
있지만 원본 ZIP/TSX는 저장소에 없고, 기록된 스크린샷은 480×900이다. 이 자료만으로는
#280의 390×844 조건에서 전체 DOM 좌표를 비교하거나 318px 관찰을 재측정할 수 없다.
아래 실측 사례는 완료로 계산하지 않으며 수동 fixture도 실제 AI 산출물로 취급하지 않는다.

> 2026-10-10 갱신: 폰트 URL·측정 조건·허용 오차·판정 규칙의 정본은
> [25 GUI와 생성 앱의 화면 크기·폰트·배치 통합 계약과 실측](25-layout-parity-contract.md)이다.
> 아래 셸 계약은 그대로 유효하다. 폰트 import는 family `Pretendard`를 정의하는 static CSS로 바뀌었고,
> 수동 캡처 스니펫 대신 `scripts/browser/layout-parity.mjs`가 GUI·생성 앱을 같은 조건에서 잰다.

## 렌더링 계약

- `screen.size.width`는 아트보드의 폭, `screen.size.height`는 첫 화면의 최소 높이다.
- GUI 아트보드는 `min-height: screen.size.height`이고 column flex 컨테이너다. root는
  `width: 100%; flex: 1 0 auto`라 짧은 콘텐츠는 첫 화면까지 자라고, 긴 콘텐츠는 줄지 않고
  아트보드를 확장한다. root의 JSON `box`는 페이지 크기를 정하지 않는다.
- 고정 폭 생성 페이지 셸은 GUI처럼 정확한 `screen.size.width` 너비를 쓴다.
  viewport가 더 좁아도 축소하지 않으며 가로 스크롤이 생길 수 있다.
  `screen.responsive`가 있는 페이지는 에디터 responsive preview width를 측정 브라우저의
  viewport 너비로 맞추고 생성 셸도 `width: 100%`로 둔다. 이때 preview width는 초기
  `screen.size.width`와 별개이며 responsive breakpoint 계산에도 같은 값을 사용한다.
  두 경우 모두 최소 높이는 `screen.size.height`다. 브라우저 viewport가 더 높아도
  root를 늘리지 않는다. 예를 들어 화면 높이 900, viewport 높이 1000이면 짧은 root는 900px이다.
  고정 `height`, `height:100%`/`h-full`, `overflow:hidden`은 쓰지 않는다.
- 앱 기본 스타일은 Canvas와 같은 Tailwind Preflight 값이어야 한다: margin/padding 0,
  `box-sizing:border-box`, `border:0 solid`, input/button 폰트 상속. input placeholder는
  노드 text color에 opacity 0.6을 적용한다. 텍스트 기본 margin은 0이다.
- GUI와 생성 앱 양쪽에서 동일한 폰트 파일·버전·fallback을 로드한다. 두 브라우저 탭에서
  `document.fonts.ready`가 끝나고 `document.fonts.status === "loaded"`인 뒤 측정한다.
- 각 생성 DOM 노드는 `data-node-id`에 IR 노드 ID를 보존한다. QA는 root의 바깥 좌표를 뺀
  각 노드 `x`, `y`, `width`, `height`를 비교한다. 캔버스 패널 위치는 결과에 포함하지 않는다.

페이지 셸 및 폼 기본 스타일의 구체 출력은
[`visual-spec-to-react` 스킬](../skills/visual-spec-to-react/SKILL.md#페이지-viewport와-브라우저-기본-스타일)에
있다. `nodeStyles.ts`와 `canvasLayout.ts`는 GUI 측 정본이다.

## 비교 조건과 판정

- Chromium 버전은 두 화면에서 같게 한다. CSS viewport는 **390×844**, browser zoom은 100%,
  `devicePixelRatio`는 **1**, `visualViewport.scale`은 **1**이다.
- 미디어쿼리 경계를 확인할 때는 동일한 DPR·브라우저에서 양쪽 viewport를 함께 변경한다.
  responsive-cards는 breakpoint 직전·정확한 경계·직후를 측정한다.
- root를 제외한 별도 스크롤 위치는 0으로 맞춘다. 페이지 상단에 정렬한 뒤 측정하며,
  문서가 844px보다 길면 `scrollHeight`가 콘텐츠를 포함하는지 별도로 확인한다.
- root 및 모든 보이는 노드의 각 bounds(`x/y/width/height`) 차이는 **1 CSS px 이하**여야
  한다. 양쪽 노드 ID 집합은 같아야 한다. `display:none` 또는 `visibility:hidden/collapse`인
  노드와 그런 조상 아래의 자손은 양쪽 캡처에서 제외한다. 비교 대상은 양쪽 모두 실제로
  보이는 노드이며, breakpoint에서 숨겨진 노드가 DOM에 남는 것은 ID 불일치가 아니다.
- 폰트 준비 상태나 loaded font 목록이 다르면 측정은 무효다. 이를 레이아웃 성공/실패로
  채점하지 않고 조건을 맞춘 뒤 다시 실행한다.

Capture JSON은 다음과 같이 만든다. GUI 캔버스에서는 zoom reset 단축키를 실행하고 배지가
`100%`인지 확인한다. 자동 `fitToScreen`이 실행된 직후에는 반드시 다시 reset한다. 생성 페이지의
브라우저 zoom도 100%여야 한다. `rootId`는 Visual Spec의 root 노드 ID이며 각 좌표는
root의 `getBoundingClientRect().left/top` 기준이다. `fontFaces`는 두 탭에서 같은 문자열
형식(`family/style/weight/status`)으로 정렬해 기록한다.

```js
const rootId = "root";
const allElements = [...document.querySelectorAll("[data-node-id]")];
const ids = allElements.map((element) => element.dataset.nodeId);
if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
  throw new Error("data-node-id가 비어 있거나 중복됐습니다.");
}
function isVisible(element) {
  for (let current = element; current instanceof Element; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  }
  return element.getClientRects().length > 0;
}
const elements = allElements.filter(isVisible);
const root = elements.find((element) => element.dataset.nodeId === rootId);
if (!root) throw new Error("표시 중인 root가 없습니다.");
await Promise.all(elements.map((element) => {
  const style = getComputedStyle(element);
  return document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
}));
await document.fonts.ready;
const rootRect = root.getBoundingClientRect();
JSON.stringify({
  rootId,
  viewport: {
    width: innerWidth,
    height: innerHeight,
    devicePixelRatio,
    visualViewportScale: visualViewport?.scale ?? 1,
    canvasZoomPercent: 100,
    fontStatus: document.fonts.status,
    fontFaces: [...document.fonts].map((font) =>
      `${font.family}/${font.style}/${font.weight}/${font.status}`,
    ).sort(),
  },
  nodes: Object.fromEntries(elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return [element.dataset.nodeId, {
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      width: rect.width,
      height: rect.height,
    }];
  })),
}, null, 2);
```

두 JSON을 저장소에서 비교한다:

```bash
node scripts/compare-layout-measurements.mjs gui.json generated.json
```

비교기는 viewport/DPR/폰트 조건, 노드 ID 전체 집합, 각 노드의 네 bounds를 확인하고
1 CSS px 초과 차이를 실패로 반환한다.

회귀 테스트 `pnpm test -- test/compare-layout-measurements.test.ts`는 1px 경계 통과,
1px 초과 실패, viewport/font/노드 ID 불일치, null/누락/비수치/음수 측정, Canvas 줌 조건을 확인한다. 이는 비교기 동작 테스트이며
GUI와 실제 생성 앱의 실측 결과가 아니다.

## 필수 사례와 현황

| 사례 | 확인 항목 | 상태 |
|---|---|---|
| `examples/login-screen.json` | 390×844 root 높이 및 7개 모든 노드 bounds, 타이틀 줄바꿈, 44px input/button, placeholder | fixture 실측 통과([25](25-layout-parity-contract.md) 4.1). 실제 AI 출력 대기 — ZIP/TSX 없음 |
| `examples/image-hero.json` | root와 이미지·caption bounds, 이미지 fit·intrinsic 크기 | fixture 실측 통과(25 4.1), 실제 AI 출력 대기 |
| `examples/responsive-cards.json` | 모든 노드 bounds와 breakpoint 직전/경계/직후 반응형 재배치 | fixture 실측 통과(25 4.1), 실제 AI 출력 대기 |
| `examples/two-page-project.json` | 두 페이지를 각각 열어 전체 노드 ID와 bounds 비교 | fixture 실측 통과(25 4.1), 실제 AI 출력 대기 |
| 긴 콘텐츠 변형 | 844px보다 긴 root의 확장, 문서 scrollHeight, 잘림 없음 | fixture 실측 통과(25 4.1), 실제 AI 출력 대기 |

## 저장소 검증 결과

- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`: 통과.
- `pnpm exec vitest run test/compare-layout-measurements.test.ts`: 7개 통과.
  같은 viewport에서 생성 root만 viewport 높이까지 늘어난 경우도 실패로 판정한다.
- `VSB_PAGE_SHELL_BROWSER=1 pnpm exec vitest run test/page-shell-browser.test.ts`:
  9개 조건을 검사하는 브라우저 테스트 1개 통과. Python Playwright와 `/usr/bin/chromium`이
  필요하며 일반 테스트에서는 선택 실행으로 건너뛴다. 스킬의 실제 CSS를 읽어 고정/반응형 폭,
  긴 viewport, 1200px 콘텐츠의 root 확장과 shell scrollHeight를 Canvas 스타일과 비교한다.
- 전체 `pnpm test`: 108개 파일 통과, 3개 선택 브라우저 테스트 건너뜀; 1740개 테스트 통과.
- `pnpm run generate:types` 뒤 생성 타입 diff 없음. build는 500kB 초과 chunk 경고가 남는다.
- 환경: Linux, Node 24.19.0, pnpm 10.33.0, Chromium 151.0.7922.173.
  이전 작성자 Windows 실행의 6개 실패와 이전 수정 HEAD의 typecheck 실패는 이 결과와 구분한다.
- 생성 앱과 GUI의 실제 DOM 좌표 비교는 원본 AI ZIP/TSX가 없어 수행하지 못했다.

### 리뷰 수정의 셸 회귀 실측 (2026-10-08)

실제 GUI에 스키마 유효한 **수동 기하 fixture**(root와 32px/1200px 자식 frame)를 로드하고,
Canvas 확대율을 100%로 맞춘 뒤 스킬 CSS를 적용한 합성 셸과 두 노드의 root-relative
`x/y/width/height`를 비교했다. 합성 자식은 GUI의 `frameStyle`을 재사용하므로 이 실험은
셸 계약만 검증하며 독립 코드 생성 정확도를 검증하지 않는다.
[수치 기록](qa/2026-10-08-page-shell.json)에 12개 조건이 있다.

| 조건 | 실제 GUI와 합성 셸의 일치 결과 |
|---|---|
| 고정 390×844, viewport 390×844 또는 390×1000 | 짧은 root 390×844 |
| 고정 390×844, 좁은 viewport 320×1000 | root 폭 390 유지 |
| 고정 390×844, 콘텐츠 1200px | root와 shell scrollHeight 1200px |
| 반응형 높이 900, viewport 높이 1000 | preview 폭 767/768/769/1023/1024/1025/1600과 root 폭 일치, root 높이 900 |
| 반응형 폭 1600, 콘텐츠 1200px | root 1600×1200, shell scrollHeight 1200px |

기존 `responsive-cards.json`도 실제 GUI preview 1600, viewport 1600×1000에서 root
1600×900임을 다시 확인했다. 수정 셸도 1600×900으로, 이전 1600×1000 높이 불일치를 해소했다.
모든 기하 실험은 외부 폰트에 의존하지 않는다. 실제 AI 산출물, 폰트 일치, 이미지 로딩,
로그인 전체 스타일 및 다중 페이지 통합 실측은 위의 대기 상태를 유지한다.

기존 #269/#268/#224 브라우저 검증은 수동 매핑 fixture와 GUI 계산을 부분 비교한 결과다.
이들은 이 표의 생성 코드 전체 비교를 대신하지 않는다. 비교 스크립트의 회귀 테스트는
오차 경계, viewport/font 조건, 노드 ID 검사를 확인하지만 제품의 실제 AI 생성 레이아웃을
검증하지 않는다. 실제 AI 생성 TSX와 hand-authored fixture를 구별해 결과를 기록한다.
