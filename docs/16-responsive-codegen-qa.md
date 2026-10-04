# 반응형 코드 매핑 검증 (#224)

검증일: 2026-10-04. 스키마 기준: #222 제안 커밋 `aed1c2a`(#245에 의존).
이 기록은 **스킬 지시문을 사람이 옮긴 fixture**의 검증이다. 제품 변환 엔진이나 실제 AI가
생성한 코드의 품질 검증이 아니다. #220의 외부 Codex 실행 초기화 차단도 그대로 남아 있다.
스키마·GUI·코드 생성 PR은 별도이며, 이 기록이 #245의 계약 승인을 대신하지 않는다.

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
IR ID나 보통 쓰는 Tailwind 기본값만 보고 `md:`로 바꾸면 안 된다. 실제 설정이 불명확하면
숫자 px variant, 지원하지 않는 대상이면 정적인 CSS min-width가 안전한 표현이다.

- 저장소 타입·린트·빌드·생성 타입 동기화 통과. **70파일·1,270테스트 통과**(이 브랜치 기준).
- 별도 앱 `tsc -b --noEmit`·production build·브라우저 오류 0건.
- 브라우저 실측은 root layout/background와 배경 배열 reset 중심이다. Pretendard 미설치이며
  타이포그래피·픽셀 전체 일치, 모든 override 조합·브라우저/화면 크기의 전수 검증은 하지 않았다.
- 실제 AI 생성·반응형 스킬 실행은 하지 않았다. 지시문과 수동 fixture의 일관성을 확인한 것이다.
- #223 실제 GUI와의 비교는 해당 브랜치 준비 후 아래에 별도로 기록한다.
