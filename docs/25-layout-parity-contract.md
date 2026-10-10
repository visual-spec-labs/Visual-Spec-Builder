# GUI와 생성 앱의 화면 크기·폰트·배치 통합 계약과 실측 (#280)

상태: **Part of #280.** 계약·측정 조건·허용 오차를 정하고, 실제 GUI DOM과 생성 앱 DOM을 같은
Chromium에서 비교하는 실측 도구를 만들어 실행했다. 생성 쪽은 **스킬 매핑을 사람이 옮긴 fixture**다.
실제 AI가 생성한 TSX는 저장소에 없고(아래 "남은 일"), 이 작업에서 새 모델 호출도 하지 않았다.
따라서 아래 수치는 "계약을 따른 생성 코드라면 GUI와 같은 배치가 된다"는 증거이며 실제 AI 출력의
배치 정확도를 증명하지 않는다.

기존 [20 화면 viewport·스타일·노드 좌표 계약](20-screen-layout-contract-qa.md)의 셸 계약(#333)을
그대로 이어받고, 폰트·측정·판정 규칙을 이 문서가 정본으로 대신한다. 구체 CSS 출력은
[`visual-spec-to-react` 스킬](../skills/visual-spec-to-react/SKILL.md#페이지-viewport와-브라우저-기본-스타일),
GUI 쪽 정본은 `src/features/editor/ui/nodeStyles.ts`·`canvasLayout.ts`·`src/styles/fonts.css`다.
page 종류의 계약만 다룬다. 아직 승인되지 않은 modal/widget 개념(#265, 설계 PR #339)에는 이 셸을
적용하지 않는다.

## 1. 렌더링 계약

### viewport·최소 높이·긴 페이지

- `screen.size.width`는 페이지 폭, `screen.size.height`는 **첫 화면의 최소 높이**다. 페이지 전체
  높이가 아니다. root의 JSON `box`는 페이지 크기를 정하지 않는다.
- GUI 아트보드와 생성 셸(`.vsb-page`)은 모두 `min-height: screen.size.height`인 column flex
  컨테이너이고, root는 `w-full flex-[1_0_auto]`다. 짧은 콘텐츠는 최소 높이까지 자라고, 긴
  콘텐츠는 줄지 않고 페이지와 문서 스크롤 영역을 늘린다.
- 최소 높이는 브라우저 viewport가 아니다. 화면 높이 900, viewport 1600×1000이면 짧은 root는
  **900px**다. `100vh`/`100dvh`, `h-full`/`height:100%`, 고정 `height`, `overflow:hidden`을 쓰지 않는다.
- 고정 폭 페이지의 셸 폭은 정확히 `screen.size.width`이며 더 좁은 viewport에서도 줄지 않는다.
  `screen.responsive`가 있으면 GUI 미리보기 폭을 생성 앱 viewport 폭과 같게 두고 셸은 `width:100%`다.
- 다중 페이지는 페이지마다 셸 하나를 두고 각 페이지의 `screen.size`를 쓴다.

### 폰트

- GUI(`src/styles/fonts.css`)와 생성 셸은 **같은 URL**을 불러온다:
  `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css`.
  이 CSS는 family 이름 `Pretendard`를 정의한다. 스펙 `typography.fontFamily: "Pretendard"`와
  생성 클래스 `[font-family:'Pretendard']`가 이 face로 그려진다.
- **이전 URL(variable 배포)은 family가 `Pretendard Variable`뿐이었다.** 그래서 GUI 노드와 생성 앱
  모두 `Pretendard`를 찾지 못하고 OS 폰트로 그려졌다(아래 4.2 실측: Windows에서 `Malgun Gothic`).
  `document.fonts.check("24px Pretendard")`는 이때도 `true`를 돌려주고, 기존 비교기의
  `/pretendard.*\/loaded$/` 검사도 `Pretendard Variable/.../loaded`로 통과했다. 두 쪽이 같은 폴백으로
  그려져 좌표가 우연히 같았을 뿐 폰트 일치의 증거가 아니었다.
- 노드 스타일은 스펙의 family 하나만 쓰고 별도 fallback 목록을 붙이지 않는다. 웹폰트를 받지 못하면
  두 쪽 모두 브라우저 기본 폰트로 떨어진다. 이 경우는 레이아웃 실패가 아니라 **측정 무효**다.
- 이 변경으로 편집기 UI 글꼴(`--font-family-pretendard: "Pretendard", …`)도 원래 의도대로 Pretendard가 된다.

### reset·placeholder·줄바꿈

- 생성 앱 기본 스타일은 Canvas의 Tailwind Preflight와 같은 값을 `@layer base`에 둔다(margin/padding 0,
  `border-box`, `border:0 solid`, button/input의 font·letter-spacing·color 상속). 대상 앱이 Preflight를
  켜 두어도(Tailwind v4 기본) 결과가 같다.
- input placeholder는 노드 `color`에 opacity 0.6이다. GUI는 `<span style="opacity:.6">`, 생성 앱은
  `placeholder:text-current placeholder:opacity-[0.6]`(`::placeholder`)로 그린다. 생성 `<input>`의
  placeholder는 한 줄이므로 GUI에서도 한 줄이어야 한다.
- 텍스트는 `white-space: pre-wrap`, 기본 `overflow-wrap: normal`이다. 줄 수가 같아야 같은 높이가 된다.

### 노드 ID와 숨김

- 생성 요소마다 `data-node-id`에 IR 노드 ID를 남긴다. 빈 ID·중복 ID는 실패다.
- `visible:false`인 노드와 그 자손은 GUI가 그리지 않고 생성 코드도 내지 않는다. 비교 대상 ID 집합은
  현재 viewport 폭으로 실제 `resolveResponsiveScreen`을 적용한 스펙에서 보이는 노드 전체이며 GUI 측정 ID와 같아야 하고, 생성 측정 ID는 GUI와 같아야 한다.
- DOM에 남아 있어도 `display:none`/`visibility:hidden|collapse`(조상 포함)이거나 박스가 없으면 양쪽에서
  제외하고 `hiddenNodeIds`로 기록한다(폭에 따라 숨는 반응형 노드).

## 2. 측정 조건과 허용 오차

| 항목 | 기준 |
|---|---|
| 브라우저 | 두 탭이 같은 Chromium 바이너리. DPR 1, `visualViewport.scale` 1, 브라우저 zoom 100% |
| GUI 창 | 편집기 1920×1080. 비교 viewport와 별개로 `viewport.window`에 기록 |
| GUI 배율 | Ctrl+0으로 Canvas 100%. 아트보드의 화면 폭/레이아웃 폭으로 배율을 DOM에서 확인한다 |
| pan/zoom 보정 | 좌표는 root 바깥 모서리 기준(pan 무관)이고 아트보드 배율로 나눈다. 대상마다 75%에서 다시 재서 100%와 비교한다 |
| 비교 viewport | 생성 앱의 브라우저 viewport. 고정 폭은 GUI 아트보드 폭 = `screen.size.width`, 반응형은 GUI 미리보기 폭 = viewport 폭 |
| 폰트 대기 | 노드별 실제 글자로 `document.fonts.load()` → `document.fonts.ready` → `status === "loaded"` |
| 폰트 동일성 | 고정 URL만 외부 요청을 허용하고 응답을 캐시해 두 탭에 같은 바이트를 준다. CSS SHA-256과 받은 woff2 수를 기록 |
| 실제 렌더 폰트 | CDP `CSS.getPlatformFontsForNode`로 각 텍스트·placeholder를 그린 폰트를 읽는다. 모두 웹폰트 `Pretendard*`여야 한다. 필요한 ID 누락·빈 결과·CDP unavailable은 측정 무효 |
| 이미지 | `<img>.decode()`와 배경 이미지 `Image.decode()` 완료, 모든 배경 URL 겹을 포함해 양쪽 intrinsic width/height > 0 및 일치. 누락은 무효 |
| bounds | root와 보이는 모든 노드의 x/y/width/height 차이 **≤ 1 CSS px** |
| 셸 | GUI 아트보드와 생성 셸의 width/height ≤ 1 CSS px. 생성 문서 `scrollHeight` = max(viewport 높이, 셸 높이) ± 1 |
| 줄바꿈 | 자기 IR 노드 소유의 중첩 텍스트까지 Range로 읽는다. 줄 수 누락·불일치는 실패 |
| placeholder | 문구·color·opacity·font-family/size/weight가 같고 GUI에서 한 줄 |

판정과 종료 코드(`scripts/compare-layout-measurements.mjs`, `scripts/browser/layout-parity.mjs` 공통):
`0` 통과, `1` 레이아웃·조건 불일치, `2` 입력 JSON 오류, `3` 폰트·이미지 로딩 실패(측정 무효).
로딩 실패·필수 폰트/이미지 증거 누락은 레이아웃 결과와 따로 `loadErrors`에 쌓고, 조건을 맞춰 다시 측정한다.
`document.fonts.load()`의 reject와 CDP 오류도 보고서를 남기는 무효 판정이다. 잘못된 nested metadata는
비교 전에 입력 오류(2)로 거절한다. 셸이 한쪽에만 있거나 생성 문서 scrollHeight가 없으면 실패한다.

## 3. 실행 방법

일반 `pnpm test`는 브라우저 실측을 실행하지 않는다. 비교기 판정 규칙은
`test/compare-layout-measurements.test.ts`, fixture와 스킬/GUI 정본의 일치(셸 CSS·폰트 URL·반응형
클래스)는 `test/layout-parity-fixture.test.ts`가 일반 테스트에서 확인한다.

실측은 Node Playwright와 Chromium, 고정 Pretendard URL에 닿는 네트워크가 필요하다. 준비는
[사용자 여정 회귀 문서](qa/user-journey-regression.md#비용-없는-독립-실행)와 같다.

```bash
# Linux
export PLAYWRIGHT_MODULE=file:///tmp/vsb-browser-tools/node_modules/playwright/index.mjs
node scripts/browser/layout-parity.mjs --out /tmp/layout-parity.json
# CDN 없이 중첩 텍스트·실패한 woff2·두 번째 배경 이미지 실패 회귀
node scripts/browser/layout-parity-regression.mjs
```

```powershell
# Windows: PLAYWRIGHT_MODULE은 file:/// URL이어야 한다
$env:PLAYWRIGHT_MODULE = ([System.Uri](Join-Path $env:TEMP "vsb-browser-tools/node_modules/playwright/index.mjs")).AbsoluteUri
$env:NO_COLOR = "1"
node scripts/browser/layout-parity.mjs --out "$env:TEMP\layout-parity.json"
```

스크립트는 임시 작업공간에 예제 스펙을 쓰고 자체 Vite 서버로 GUI와 fixture 앱
(`test/fixtures/layout-parity`, Vite + `@tailwindcss/vite` + Preflight)을 함께 띄운다. `--case <이름>`을
반복해 사례를 고를 수 있다. 프록시 환경에서는 `HTTPS_PROXY`(또는 `https_proxy`)를 적용하되
localhost는 우회한다. 결과의 `measurements.gui`/`measurements.generated`에는 노드별 렌더 폰트,
필요한 폰트 ID, 로딩 오류, 이미지 치수, 줄 수를 포함한 전체 비교 입력을 보존한다.

**실제 AI 생성 결과 측정.** GUI에서 Export한 ZIP을 풀고 그 프로젝트 폴더(`pages/`·`components/`·
`assets/`가 있는 곳)를 넘긴다. 페이지 파일은 Export와 같은 `compileTickets` 결과의 page 티켓 `componentName`으로
고른다(`pages/<componentName>.tsx`). 스펙의 page 이름과 다를 수 있다 — `checkout page` → `CheckoutPage`,
`로그인` → `Screen`, root 자식과 이름이 같은 `Header` → `Header2`. page 이름은 보고서 `case`와 `--case`에만 쓴다.

```bash
node scripts/browser/layout-parity.mjs --generated-dir ./export/login --case login-screen --out real-login.json
```

이미 실행 중인 대상 앱은 `--generated-url "http://127.0.0.1:5173/?page={page}"`로 잰다. `{page}`에는 위의
page 티켓 `componentName`이 URL 인코딩되어 들어간다(보고서의 `pageFile`). 대상 앱은 이 이름으로 `pages/<이름>`을 그려야 한다. 두 모드에서는 fixture 전용 대조군(`login-legacy`)을 건너뛴다. 결과 기록에는
모델/요청 ID와 ZIP 해시를 함께 남겨 fixture 결과와 구분한다.

## 4. 실측 결과 (2026-10-10)

환경: Windows 11, Node 24.12.0, Playwright 1.62.0의 Chromium 151.0.7922.34(headless shell), DPR 1.
생성 쪽은 fixture, **실제 모델 실행 없음**. 원자료:
[수정 후](qa/2026-10-10-layout-parity.json) · [폰트 교체 전 대조](qa/2026-10-10-layout-parity-font-fallback.json).

### 4.1 배치 비교 (폰트 교체 후, 16개 조건)

폰트 CSS SHA-256 `a9d3417e…cd67a2`, 받은 woff2 31개, 폰트 요청 실패 0. 모든 텍스트·placeholder가
`Pretendard`/`Pretendard SemiBold`/`Pretendard Medium` 웹폰트로 그려졌다. 대상마다 Canvas 75%에서 다시
잰 보정 좌표는 100% 측정과 최대 **0px** 차이였다.

| 사례 | viewport | GUI root | 생성 root | 셸 높이 GUI/생성 | 문서 scrollHeight | 노드 | 최대 차이 | 판정 |
|---|---|---|---|---|---|---:|---:|---|
| login-screen (7노드) | 390×844 | 390×844 | 390×844 | 844/844 | 844 | 7 | 0 | 통과 |
| login-screen | 390×1000 | 390×844 | 390×844 | 844/844 | 1000 | 7 | 0 | 통과 |
| login-screen | 320×844 | 390×844 | 390×844 | 844/844 | 844 | 7 | 0 | 통과 |
| login-legacy (셸 없는 `h-full` 재구성) | 390×844 | 390×844 | **390×318** | 844/없음 | 844 | 7 | 526 | 의도된 실패 |
| long-login (긴 텍스트 4줄 + 520px, 숨김 노드 1) | 390×844 | 390×958 | 390×958 | 958/958 | 958 | 9 | 0 | 통과 |
| image-hero (1200×600 PNG) | 390×844 | 390×844 | 390×844 | 844/844 | 844 | 3 | 0 | 통과 |
| responsive-cards | 767·768·769×1000 | 폭×900 | 폭×900 | 900/900 | 1000 | 7 | 0 | 통과 |
| responsive-cards | 1023·1024·1025×1000 | 폭×900 | 폭×900 | 900/900 | 1000 | 7 | 0 | 통과 |
| responsive-cards | 1440·1600×1000 | 폭×900 | 폭×900 | 900/900 | 1000 | 7 | 0 | 통과 |
| two-page / login (4노드) | 390×844 | 390×844 | 390×844 | 844/844 | 844 | 4 | 0 | 통과 |
| two-page / dashboard | 1440×900 | 1440×900 | 1440×900 | 900/900 | 900 | 10 | 0 | 통과 |

- 반응형은 경계에서 실제로 재배치됐다: 767→768에서 첫 카드 x가 48→32(tablet `padding.left`),
  1023→1024에서 카드 사이 gap이 24→32(desktop). 768px의 카드 폭 212.65625px 같은 소수 좌표도 양쪽이 같았다.
- placeholder: 두 input 모두 문구·`rgb(17, 24, 39)`·opacity `0.6`·Pretendard 14px/400이 같고 GUI에서 1줄.
- 줄 수: 모든 텍스트가 양쪽 같은 줄 수(약관 4줄, 나머지 1줄).
- 이미지: 양쪽 모두 1200×600 원본을 읽었고 hero 박스는 390×240으로 같았다.

### 4.2 폰트 교체 전 대조 (같은 도구, variable CSS)

16개 조건 모두 **측정 무효(3)**. GUI와 생성 앱 양쪽의 모든 텍스트가 `Malgun Gothic (local)`로
그려졌고 받은 woff2는 0개였다. 좌표 차이는 0이었는데, 이는 두 쪽이 같은 OS 폴백을 쓴 결과다.
폰트가 줄바꿈을 바꾸는 사례도 확인했다: `outlinedTitle`("바깥 테두리 · 모서리별", 18px/600)은 767~769px
카드에서 폴백 폰트로 **2줄**, Pretendard로 **1줄**이다.

### 4.3 390×844 root 844px 대 318px 재측정

| 측정 | 생성 root 높이 | 근거 |
|---|---:|---|
| 2026-10-05 실제 Codex 출력(원본 TSX 미보존) | 318 | 이슈 본문의 기록. 원본 ZIP은 SHA만 [기록](qa/2026-10-05-real-ai-login.json)에 있다 |
| 셸 없이 root `h-full`인 재구성 fixture | **318** | 7노드 콘텐츠 높이 24+32+16+222+24 = 318과 같다 |
| 현재 계약 셸 fixture | **844** | GUI 844와 모든 노드 차이 0 |

318px은 부모에 확정 높이가 없을 때 `h-full`이 콘텐츠 높이로 떨어진 결과로 재현된다. 다만 재구성은 원본
TSX가 아니므로 "실제 AI 출력이 이제 844px"라는 증거는 아니다.

### 4.4 디렉터리 모드 확인

Export 폴더 모양(`pages/Login.tsx` + `components/Card.tsx`, `as React.CSSProperties` 포함 TSX)을 임시로
만들어 `--generated-dir`로 실행했다. 4노드 login 페이지는 통과했고, 같은 파일을 7노드 login-screen과
비교하면 누락 노드 3개와 card 높이 차이 168px로 실패했다. 이 임시 TSX도 사람이 쓴 것이다.

## 5. 완료 조건 대조와 남은 일

| #280 완료 조건 | 상태 |
|---|---|
| viewport/min-height/긴 페이지·폰트·reset·placeholder 통합 계약 문서화 | 충족 — 1절 |
| 같은 viewport·폰트 로딩·DPR 조건과 수치 허용 오차 | 충족 — 2절, 비교기 테스트 34개 |
| 실제 생성 코드의 모든 노드 x/y/width/height를 GUI와 비교 | **fixture 기준 충족, 실제 AI 출력 기준 미충족** — 도구와 실행 절차는 준비됨 |
| 390×844 root 844 대 318 차이를 수정 후 같은 조건에서 재측정 | **fixture 기준 충족(318 재현 → 844), 실제 AI 출력 재측정 미실행** |
| 이미지·반응형·다중 페이지 예제로 기준 검증 | fixture 기준 충족 — 4.1 |

- **실제 AI 출력 측정.** 사용자가 직접 Claude Code/Codex로 생성·Export한 결과에 3절의
  `--generated-dir` 명령을 실행해 기록해야 #280을 닫을 수 있다. 실제 모델 실행 QA는
  [사용자 여정 문서](qa/user-journey-regression.md) 6단계와 같은 기록 형식을 따른다.
- **CI 연결 안 함.** 이 도구는 고정 CDN 폰트에 네트워크로 닿아야 해 #346의 필수 Chromium 잡(외부 요청
  차단)에 넣지 않았다. 폰트 파일을 저장소나 CI 캐시에 두는 방안과 함께 후속으로 정한다.
- Linux 재측정과 반응형 숨김/재표시 사례는 아래 리뷰 수정 검증에서 완료했다.


## 6. PR #350 리뷰 수정 검증 (2026-10-09 UTC)

Part of #280. 위 Windows 기록은 원본 실행 날짜를 유지한다. 이번 검증은 Debian 13,
Node 24.19.0, pnpm 10.33.0, Playwright 1.62.0, 시스템 Chromium **151.0.7922.173**이다.
Playwright 관리 Chromium 151.0.7922.34 다운로드는 실행 환경의 도메인 제한(403)으로 사용할 수 없어
`CHROME_BIN=/usr/bin/chromium`으로 실행했다. CI의 고정 브라우저와 패치 버전이 다르다.
DPR 1, GUI 1920×1080, Canvas 100% 및 75% 보정 비교, 생성 viewport는 아래 원자료에 기록했다.

원자료: [전체 Linux 측정](qa/2026-10-09-layout-parity-linux.json) ·
[수정 전/후 회귀 증거](qa/2026-10-09-layout-parity-review-regressions.json).
모두 **사람이 작성한 fixture**이며 실제 모델 호출은 없다.

- 22개 조건: **21 통과, 의도된 실패 1, 무효 0**. 통과 사례의 모든 노드 최대 차이 **0 CSS px**.
  셸 없는 legacy root는 318px, GUI 844px로 기존 실패를 재현한다.
- 기존 16조건 외 `responsive-visibility`는 767/768/769/1023/1024/1025px에서 검사한다.
  `fadedCard`와 자손은 tablet에서 숨고 desktop에서 다시 보인다. 노드 수는 7/5/5/5/7/7이며
  생성 DOM은 유지하고 CSS로 숨긴다. 현재 폭의 실제 편집기 resolver로 기대 ID를 계산해 모두 통과한다.
- responsive fixture의 제목을 `span > strong`으로 감쌌다. 중첩 텍스트의 줄 수 1과 노드별
  Pretendard 웹폰트 증거를 모든 폭에서 확인했다. 별도 Chromium 회귀는 중첩 텍스트 **2줄**, 부모가
  자식 IR 노드의 텍스트를 중복 세지 않음, 실제 폴백 CDP 증거를 확인한다.
- 폰트 CSS SHA-256 `a9d3417e168d008424337e8ee2df7b54ff082a57ed61e28421db681437cd67a2`,
  woff2 31개, 실패 0. 최초 프록시 미설정 실행은 DNS 실패로 **무효(3)**였고, 프록시 적용 후 동일 CDN
  바이트를 양쪽에 공급했다. 단순 좌표 일치로 폰트 실패를 통과시키지 않았다.
- 실제 woff2 요청을 차단한 브라우저 회귀에서 기존 `Promise.all`은 `NetworkError`를 던졌지만
  수정된 캡처는 `fontLoadErrors`와 폴백 증거를 반환하고 **무효(3)**로 판정한다.
  다중 배경의 첫 이미지(1200×600)가 성공하고 두 번째 URL이 실패하는 경우도 무효다.
- 원본 `b592e6b` 비교기를 실제 캡처 데이터에 실행했다. 셸 삭제, 폰트 증거 삭제, 줄 수 삭제,
  이미지 map 삭제, intrinsic 크기 1200×600→600×1200은 기존에 모두 **0**이었다.
  수정 후 각각 **1/3/1/3/1**이다. `renderedFonts.title=null`의 기존 TypeError는 입력 오류(2)가 된다.
  CLI 회귀 34개가 누락 증거와 잘못된 배열·폰트/placeholder/image 레코드·scroll 치수를 검증한다.

로컬 frozen install, typecheck, lint, production build, 스키마 생성 드리프트 검사 통과.
전체 테스트 **116 파일/1871개 통과, 브라우저 opt-in 3개 skip**. 별도 활성화한 기존 Python Chromium
검사 3개는 모두 실제 실행·통과했다. production build의 기존 500kB chunk 경고는 남아 있다.
`layout-parity`와 새 capture 회귀는 로컬 실행 증거이며 **기존 필수 CI에 연결하지 않았다**.
CI의 성공과 이 도구의 22조건 실측 성공은 별개다.

Node 사용자 여정 다섯 개도 최종 순차 실행에서 모두 통과했다(`project-dialogs` 포함).
초기 병행 부하 중 `unnamed-drafts`의 동시 Resume 소유권 단언이 한 번 실패했고, 단독 재실행과
전체 순차 재실행은 통과했다. 이 여정 코드는 변경하지 않았다. CI에서도 최종 커밋의 결과를 따로 확인한다.
