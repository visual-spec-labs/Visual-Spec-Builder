# 반응형 코드 매핑 검증 (#224)

현재 상태(2026-10-05): 스키마 #245, GUI #247, 코드 생성 지침 #248과 리뷰 수정 #252가 모두
병합됐다. 실제 Codex 전체 흐름은 #261에서 로그인 예제로 통과했으나 반응형 출력은 그 검증에
포함되지 않았다([15](15-workflow-qa.md)). 아래는 병합 전 시점의 검증 기록이다.

검증일: 2026-10-04. 스키마 기준: #222 제안 커밋 `aed1c2a`(#245에 의존, 당시 미병합).
이 기록은 **스킬 지시문을 사람이 옮긴 fixture**의 검증이다. 제품 변환 엔진이나 실제 AI가
생성한 코드의 품질 검증이 아니다. 검증 당시에는 #220의 외부 Codex 실행 초기화 차단이 남아 있었다.
당시 스키마·GUI·코드 생성 PR은 별도였으며, 이 기록이 #245의 계약 승인을 대신하지 않았다.

## 재현 자료와 환경

- 원본: `examples/responsive-cards.json`(수정하지 않음).
- 정적인 Tailwind 클래스와 추가 배경 사례: `test/fixtures/responsive-codegen.ts`.
- 자동 검사: `test/responsive-codegen.test.ts`. 원본·추가 사례를 정본 스키마로 검증하고,
  스킬 예제와 fixture 문자열 일치 및 **실제 Tailwind compile API**가 만든 CSS를 검사한다.
- 실측 대상: 별도 `/tmp/vsb-responsive-target` React 앱. fixture를 import하고 Tailwind의
  `@source`에 fixture 파일을 명시하여 모든 클래스가 실제 production CSS에 들어가게 했다.
  제품 사용 시에도 출력 TSX가 대상 Tailwind 스캔 범위에 있어야 한다.
- React 19.2.8, TypeScript 5.9.3, Tailwind/@tailwindcss/vite 4.3.3, Vite 8.2.1,
  pnpm 10.33.0, Node 24.19.0, Chromium(`/usr/bin/chromium`), Python Playwright.
- 대상 앱에 `@theme { --breakpoint-md: 960px; }`를 넣어 IR의 tablet=768px와 다른
  named variant가 있는 조건도 검사했다. 사용자 설정을 자동 발견한 결과가 아닌 명시적 fixture다.

실행한 명령:

```bash
# 저장소
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run generate:types
# 생성 타입 diff 없음 확인

# 별도 대상 앱 (독립 설치, 출력 확인용)
pnpm install --frozen-lockfile
pnpm exec tsc -b --noEmit
pnpm run build
pnpm run preview  # 127.0.0.1:5194
```

실제 설치는 `COREPACK_HOME=/tmp/vsb-corepack corepack pnpm`과
`--store-dir /tmp/vsb-pnpm-store`를 사용했다. 대상 앱은 fixture와 renderer의 순수
`backgroundStyle`을 참조하는 **QA harness**이며, 독립 Export 패키지 검증을 새로 수행한 것은 아니다.
브라우저에서는 viewport를 바꾸고 `getComputedStyle`을 읽었다. 검사한 순서는
767→768→769→959→960→1023→1024→1025→767px로, 다시 좁힐 때 원래 값 복원도 확인했다.

## 원본 responsive-cards의 root

| CSS viewport | gap | padding-left | padding-top | background-color | background-image |
|---|---|---|---|---|---|
| 767px | 24px | 48px | 48px | rgb(241, 245, 249) | none |
| 768px | 24px | 32px | 48px | rgb(241, 245, 249) | none |
| 1023px | 24px | 32px | 48px | rgb(241, 245, 249) | none |
| 1024px | 32px | 32px | 48px | transparent | none |

전체 구간의 방향은 row다. 키 선언 순서가 desktop→tablet이어도 숫자 폭으로 적용됐으며,
1024px에서 생략된 padding-left는 768px 값을 상속했다. size.width=1440으로 viewport를
고정하지 않았다. 투명색의 computed 표현은 `rgba(0, 0, 0, 0)`다.

## 배열 교체에서 이전 배경이 남는지

추가 fixture는 원본의 root 배경과 breakpoint별 배경만 바꾼 유효한 스펙이다.
현재 renderer의 `backgroundStyle`이 만든 인라인 참조 요소, 수동 Tailwind 클래스 요소,
일반 CSS 미디어 쿼리 요소의 computed color/image/origin을 같은 폭에서 비교했다.

| 사례 | 기반 (<768) | 768 이상 | 1024 이상 |
|---|---|---|---|
| layers-solid-empty | 빨강 반투명 gradient + 초록 solid | 파란 반투명 solid **이미지 none** | **색 transparent · 이미지 none** |
| solid-image-layers | 초록 solid | 빨강 반투명 gradient **색 transparent** | 흰 반투명 solid-image + 빨강 gradient, **색 transparent** |

모든 측정 폭에서 세 표현의 computed 값이 일치했다. 이미지가 있는 구간은 origin이
border-box(여러 이미지면 각 겹), 이미지가 없는 구간은 padding-box다. 이미지와 색 중
하나만 바꿔 기존 값이 투명 stop 아래에 남는 문제를 명시적 reset으로 막았다.
겹 순서는 흰 overlay가 앞이며 `image:` 타입 힌트를 유지했다.

일반 CSS 대안도 동일한 배열 교체 결과를 냈다. 검증 harness에서는 별도 stylesheet로
실측했으며, 제품 Export에 별도 `.css`가 포함된다고 주장하지 않는다. 스킬은 필요할 때
정적 미디어 CSS를 TSX의 `<style>`에 포함하도록 안내한다.

## named variant 경계와 검증 한계

`md=960px`인 대상에서 `md:gap-[96px]`는 959px까지 적용되지 않고 960px부터 적용됐다.
같은 요소의 `min-[768px]:pl-[32px]`는 정확히 768px부터 적용됐다. 따라서 tablet이라는
IR ID나 보통 쓰는 Tailwind 기본값만 보고 `md:`로 바꾸면 안 된다. 대상 버전·설정의 지원이
불명확하면 정적인 CSS min-width를 기본으로 사용한다. 숫자 px variant는 호환성을 확인한
대상에만 사용한다(아래 #248 후속 검증 참고).

- 저장소 타입·린트·빌드·생성 타입 동기화 통과. **70파일·1,270테스트 통과**(이 브랜치 기준).
- 별도 앱 `tsc -b --noEmit`·production build·브라우저 오류 0건.
- 브라우저 실측은 root layout/background와 배경 배열 reset 중심이다. Pretendard 미설치이며
  타이포그래피·픽셀 전체 일치, 모든 override 조합·브라우저/화면 크기의 전수 검증은 하지 않았다.
- 실제 AI 생성·반응형 스킬 실행은 하지 않았다. 지시문과 수동 fixture의 일관성을 확인한 것이다.

## #223 실제 GUI와 수동 React fixture의 대조

같은 날 원본 `responsive-cards.json`을 #223 GUI 작업 브랜치
`codex/223-responsive-editor`의 `5621f1a040e6f301f744a3d507231ee3f4c94bf1`에서 열었다.
검증 당시 작업 트리를 제품 소스 변경 없이 이 커밋으로 확정했다(기반 `aed1c2a`).
React 쪽은 이 매핑 PR의 `2d1546e`에 있는 수동 fixture다. GUI는 독립 Vite 캐시로
`127.0.0.1:5195`, production React fixture는 `127.0.0.1:5194`에서 실행했다.

GUI의 실제 `[data-node-id="root"]`와 React의 `[data-testid="responsive-cards"]`에서
`getComputedStyle`을 읽고 다음 **5개 속성을 assertion으로 비교하여 전부 일치**했다:
`gap`, `paddingLeft`, `backgroundColor`, `backgroundImage`, `flexDirection`.
767·768·1023·1024px의 값은 위 root 표와 같다. 두 요소의 computed width도 각각
767·768·1023·1024px로 기록됐으나 width는 이 비교의 assertion 항목에는 포함하지 않았다.

GUI 미리보기 폭 변경은 원본 문서와 history를 바꾸지 않았고, 각 폭에서 history 길이는 0이었다.
별도 GUI 동작 검증에서 desktop gap override 한 칸 삭제 → 상속값24 → Undo 후32 복원,
현재 표현값을 override로 고정 → Undo 후 원복을 확인했다. 브라우저 page error는 0건이었다.
이는 root의 지정 속성과 GUI 편집 동작에 대한 확인이며, 모든 노드의 픽셀 완전 일치나
실제 AI 생성 성공을 뜻하지 않는다.

증거는 QA 실행 환경의 `/tmp/vsb-responsive-qa/gui-react-comparison.json`(폭별 양쪽 값과
assertion 항목), `/tmp/vsb-responsive-qa/results.json`(편집·Undo 및 오류 결과)에 남겼다.
초기 공유 Vite 캐시/HMR의 임시 오류는 독립 캐시로 해소한 뒤 검사했으며 제품 회귀로 세지 않았다.


## #248 리뷰 후속 검증 (2026-10-04)

기반 develop `d1f8b65`에서 세 리뷰를 수정했다. 위 기록은 당시 실행 결과이며,
아래 실행이 #247 GUI 재검증이나 실제 AI 생성을 뜻하지 않는다.

### auto 높이와 교차축

`autoSizedCardsSpec()`은 원본 카드 세 개의 height만 auto로 바꾼 유효한 스키마다.
브라우저 harness는 가운데 카드에 두 줄을 넣어 서로 다른 자연 높이를 만든다.
`test/responsive-codegen-browser.test.ts`는 React 정적 마크업, 실제 Tailwind 4.3.3 compile
CSS, 일반 CSS fallback, 현 develop의 캔버스 `frameStyle` 참조를 Chromium에서 비교한다.
root 높이는 300px로 고정해 stretch 차이가 드러나게 했다.

```bash
# Python Playwright와 /usr/bin/chromium이 있는 환경에서 명시적으로 실행
VSB_RESPONSIVE_BROWSER=1 pnpm exec vitest run test/responsive-codegen-browser.test.ts
```

767→768→769→1023→1024→1025→767px 모두 통과했다. `items-start`를 제거한
수정 전 대조군은 세 카드 높이가 모두 204px로 늘었다. 수정된 Tailwind·CSS fallback·
캔버스 style 참조는 세 높이가 각각 66·100·68px로 같았다. `alignItems=flex-start`,
flexDirection, gap, paddingLeft/Top, backgroundColor/Image 및 자식 높이를 assertion으로
대조했다. 브라우저 오류는 0건이다. 기본 `pnpm test`에서는 이 브라우저 검사를 건너뛰고,
위 명령으로 별도 실행한다. 전체 GUI 상호작용이나 모든 노드의 픽셀 비교는 아니다.

### Tailwind 호환성

[Tailwind v3.2 공식 발표](https://tailwindcss.com/blog/tailwindcss-v3-2#max-width-and-dynamic-breakpoints)를
확인했다. 미확인 대상에는 TSX `<style>`의 정적 media CSS가 기본이다. v3의 단순 문자열
screens 조건을 v4의 설정 계약으로 옮기지 않는다. v4 검증을 v3 지원 증거로 쓰지도 않는다.

별도 `/tmp/vsb-tailwind-v3`에서 pnpm으로 alias 패키지 tailwind31=3.1.8,
tailwind32=3.2.7 및 PostCSS 8.5.6을 설치해 실제로 컴파일했다. raw content는
`<div class="min-[768px]:gap-[24px]"></div>`, 입력 CSS는 `@tailwind utilities;`다.

| 버전 | theme.screens | gap 규칙 출력 |
|---|---|---|
| 3.1.8 | `{md: "768px"}` | 없음 |
| 3.2.7 | `{md: "768px"}` | `@media (min-width: 768px)` 안에 출력 |
| 3.2.7 | `{md: {min: "768px", max: "1023px"}}` | 없음, 복합 screens 경고 |
| 4.3.3 | 기존 fixture compile 설정 | 출력, 위 Chromium 경계값 통과 |

v3는 CSS 컴파일만 수행했고 v3 앱 빌드·브라우저 실행은 하지 않았다.

### 설치된 패키지의 문서 참조

`pnpm pack --pack-destination /tmp/vsb-package`로 만든 tarball을 `/tmp/vsb-packed`에
풀고, 빈 `/tmp/vsb-consumer`에서 패키지 CLI의 `skills` 명령을 실행했다. docs가 없는
소비자 프로젝트에서 sibling `visual-spec-docs/SKILL.md`가 실제로 존재하고, 지시된
raw develop QA URL이 HTTP 200이며 올바른 문서인지 확인했다. 자동 CLI 회귀도 추가했다.
배포 범위는 기존 bin/skills 그대로이며, 원문을 가져오지 못하면 한계를 보고하도록 했다.

### 실행 범위

Node 24.19.0, pnpm 10.33.0, Chromium 151.0.7922.173, Python Playwright 환경이다.
저장소 typecheck/lint/production build 및 생성 타입 드리프트가 통과했다.
전체 76파일·1,327테스트 통과, 선택 실행 브라우저 1파일·1테스트는 기본 실행에서 skip하고
별도 명령에서 통과했다.
빌드에는 기존 Vite native-loader 및 500kB 초과 청크 경고가 남는다.
이번 실행에서 독립 React 앱 production build나 실제 외부 AI 생성은 하지 않았다.
브라우저는 수동 매핑 fixture의 컴파일된 CSS와 React 정적 마크업을 실행했다.
