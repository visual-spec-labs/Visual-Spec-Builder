# 화면 viewport·스타일·노드 좌표 통합 계약 (#280)

상태: viewport/스타일 계약과 비교 도구·회귀 테스트를 작성했다. 기존 실제 Codex 실행의
[기록](qa/2026-10-05-real-ai-login.json)과 [화면](qa/2026-10-05-real-ai-login.png)은 남아
있지만 원본 ZIP/TSX는 저장소에 없고, 기록된 스크린샷은 480×900이다. 이 자료만으로는
#280의 390×844 조건에서 전체 DOM 좌표를 비교하거나 318px 관찰을 재측정할 수 없다.
아래 실측 사례는 완료로 계산하지 않으며 수동 fixture도 실제 AI 산출물로 취급하지 않는다.

## 렌더링 계약

- `screen.size.width`는 아트보드의 폭, `screen.size.height`는 첫 화면의 최소 높이다.
- GUI 아트보드는 `min-height: screen.size.height`이고 column flex 컨테이너다. root는
  `width: 100%; flex: 1 0 auto`라 짧은 콘텐츠는 첫 화면까지 자라고, 긴 콘텐츠는 줄지 않고
  아트보드를 확장한다. root의 JSON `box`는 페이지 크기를 정하지 않는다.
- 생성 페이지는 이 동작을 재현하는 페이지 셸을 사용한다. 셸의 너비는 viewport와
  `screen.size.width` 중 작은 값, 최소 높이는 `max(100dvh, screen.size.height)`다.
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
  한다. 양쪽 노드 ID 집합은 같아야 한다. 숨김 breakpoint에서도 노드가 DOM에 남는 경우에는
  양쪽 모두의 visibility/display를 맞춘 뒤 표시 중인 노드의 bounds를 비교한다.
- 폰트 준비 상태나 loaded font 목록이 다르면 측정은 무효다. 이를 레이아웃 성공/실패로
  채점하지 않고 조건을 맞춘 뒤 다시 실행한다.

Capture JSON은 다음과 같이 만든다. `rootId`는 Visual Spec의 root 노드 ID이며 각 좌표는
root의 `getBoundingClientRect().left/top` 기준이다. `fontFaces`는 두 탭에서 같은 문자열
형식(`family/style/weight/status`)으로 정렬해 기록한다.

```js
const rootId = "root";
const elements = [...document.querySelectorAll("[data-node-id]")];
const root = elements.find((element) => element.dataset.nodeId === rootId);
if (!root || new Set(elements.map((element) => element.dataset.nodeId)).size !== elements.length) {
  throw new Error("root가 없거나 data-node-id가 중복됐습니다.");
}
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
1px 초과 실패, viewport/font/노드 ID 불일치를 확인한다. 이는 비교기 동작 테스트이며
GUI와 실제 생성 앱의 실측 결과가 아니다.

## 필수 사례와 현황

| 사례 | 확인 항목 | 상태 |
|---|---|---|
| `examples/login-screen.json` | 390×844 root 높이 및 7개 모든 노드 bounds, 타이틀 줄바꿈, 44px input/button, placeholder | 실측 대기 — 기존 480×900 스크린샷은 조건 불일치, ZIP/TSX 없음 |
| `examples/image-hero.json` | root와 이미지·caption bounds, 이미지 fit·intrinsic 크기 | 실측 대기 |
| `examples/responsive-cards.json` | 모든 노드 bounds와 breakpoint 직전/경계/직후 반응형 재배치 | 실측 대기 |
| `examples/two-page-project.json` | 두 페이지를 각각 열어 전체 노드 ID와 bounds 비교 | 실측 대기 |
| 긴 콘텐츠 변형 | 844px보다 긴 root의 확장, 문서 scrollHeight, 잘림 없음 | 실측 대기 |

## 저장소 검증 결과

- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`: 통과.
- `pnpm test -- test/compare-layout-measurements.test.ts`: 3개 테스트 통과.
- 전체 `pnpm test`: 99개 파일 통과, 6개 파일 실패, 2개 건너뜀(총 17개 테스트 실패).
  실패는 검증기 번들/티켓 응답 예제 불일치와 Windows 경로·권한·symlink 제약 등이었다.
  이 전체 테스트 결과는 비교기 회귀 테스트 결과와 구분한다.
- 생성 앱과 GUI의 실제 DOM 좌표 비교는 원본 AI ZIP/TSX가 없어 수행하지 못했다.

기존 #269/#268/#224 브라우저 검증은 수동 매핑 fixture와 GUI 계산을 부분 비교한 결과다.
이들은 이 표의 생성 코드 전체 비교를 대신하지 않는다. 비교 스크립트의 회귀 테스트는
오차 경계, viewport/font 조건, 노드 ID 검사를 확인하지만 제품의 실제 AI 생성 레이아웃을
검증하지 않는다. 실제 AI 생성 TSX와 hand-authored fixture를 구별해 결과를 기록한다.
