# 활성 안내 텍스트 대비 QA (#276)

검증일: 2026-10-09. 기준: `develop` `88bb530`(이슈 기준 커밋 이후) 위에서 시작한 작업 브랜치.

## 문제

2026-10-05 제품 점검 `B10`·P2. `text-content-subtle`을 `bg-surface` 위에서 실측한
대비가 라이트 약 2.58:1, 다크 약 2.85:1로 WCAG AA(일반 텍스트 4.5:1)에 못 미친다.
이 토큰이 활성 상태의 안내·설명 텍스트에도 쓰이고 있어, disabled/장식 역할과
분리되지 않은 채 일반 텍스트에 섞여 있었다.

## 실측 재확인

`src/styles/tokens/primitives/colors.css`의 neutral(라이트)/gray(다크) 스케일로
직접 계산했다 — oklch 채도 0(무채색)은 `L,M,S` 세 원뿔 반응이 전부 `L`과 같아져
선형 sRGB `R=G=B=L³`로 접히므로, 표준 sRGB 감마 인코딩만 거치면 16진값이 나온다
(`test/design-token-contrast.test.ts`의 `oklchGrayToHex` 참고). 이 변환으로 얻은
neutral-400/500/800/900 값이 Tailwind의 공개된 neutral 16진값과 일치함을 먼저
확인했다(예: neutral-800 → `#262626`).

| 토큰 | 라이트 `bg-surface` | 다크 `bg-surface` |
|---|---|---|
| `content-subtle`(현재) | 2.52:1 | 2.85:1 |
| `content-muted`(수정 전) | 4.74:1 | 6.43:1 |

`content-subtle`은 이슈가 보고한 수치와 일치했다. `content-muted`는 흰 배경에서는
AA를 넘지만, 패널이 쓰는 다른 네 배경(`surface-sunken`·`surface-canvas`·
`surface-raised`·`surface-inset`)까지 넣으면 라이트에서 두 곳이 AA 밑으로
떨어졌다:

| 라이트 surface | `content-muted`(수정 전) |
|---|---|
| `surface` / `surface-raised` | 4.74:1 |
| `surface-sunken` / `surface-inset` | **4.35:1** |
| `surface-canvas` | **3.76:1** |

다크는 다섯 배경 전부 최소 5.92:1(`surface-raised`)로 이미 AA를 넘고 있었다.

## 설계 결정

**`content-muted`의 라이트 원시값을 한 단계 진하게(`neutral-500` → `neutral-600`)
올렸다.** 다크는 바꾸지 않았다(이미 전부 통과).

```css
/* primitives/colors.css */
--color-neutral-600: oklch(43.9% 0 none); /* 신규 — Tailwind v4 neutral-600 그대로 */

/* semantic/colors.css, :root(라이트)만 */
--content-muted: var(--color-neutral-600); /* 이전: --color-neutral-500 */
```

| 라이트 surface | `content-muted`(수정 후) |
|---|---|
| `surface` / `surface-raised` | 7.81:1 |
| `surface-sunken` / `surface-inset` | 7.17:1 |
| `surface-canvas` | 6.20:1 |

다섯 배경 전부 AA(4.5:1)를 여유 있게 넘는다.

**새 토큰을 만들지 않았다.** `content-muted`("보조 텍스트")는 이미 이 저장소
18개 파일에서 "활성 상태의 읽어야 하는 보조 텍스트"(아이콘 버튼 기본 상태,
섹션 헤더, 상태 배지, 도움말 텍스트 등) 역할로 쓰이고 있었다 — 정확히 이
이슈가 요구하는 역할과 같다. 독립 토큰(예: `content-guidance`)을 새로 만들면
"muted와 무엇이 다른가"라는 모호함만 늘어난다. 대신 `content-muted` 자체가
모든 배경에서 AA를 보장하도록 고치고, 잘못 분류돼 있던 `content-subtle`
사용처를 `content-muted`로 재배정하는 쪽을 택했다. `content-muted`를 이미
쓰던 18개 파일은 라이트 테마에서 한 단계 더 진해지는 부수 효과를 받지만
방향이 "더 읽기 쉬워짐"이라 회귀가 아니다.

`content-subtle`의 원시값은 그대로 뒀다 — disabled·장식(아이콘) 전용으로
남기고, 둘 다 `semantic/colors.css`에 그 용도를 주석으로 못박았다.

## 사용처 재분류

`text-content-subtle`을 쓰던 14개 파일·약 30곳을 하나씩 확인했다.

**활성 안내/라벨 텍스트 → `text-content-muted`로 교체(20곳)**: `MenuBar.tsx`
(문서 제목), `PropertiesPanel.tsx`(빈 선택 안내), `TicketPanel.tsx`(페이지명·
빈 목록·티켓 메타·선행 안내·실행 안내 — 6곳), `ResponsivePanel.tsx`(폭 안내·
override 안내 — 2곳), `NaturalLanguageBar.tsx`(입력 placeholder),
`LayerTree.tsx`("새 페이지" 버튼·레이어 수), `ExportPanel.tsx`(페이지명·
스캔 상태·안내문 3종·빈 커버리지 — 5곳), `HomeScreen.tsx`(로딩·부제·버튼
설명 3종·프로젝트 수·카드 메타 — 7곳), `fillButtons.ts`(`addButtonClass`),
`ColorField.tsx`/`NumberField.tsx`/`SizeField.tsx`(단위 라벨 %/px — 3곳).

**disabled/장식 — 그대로 둠(7곳)**: `menu.tsx`의 `disabled:text-content-subtle`
(이미 `disabled` 조건에만 걸려 있음), `NaturalLanguageBar.tsx`의
`option.disabled ? "text-content-subtle" : "text-content"`, `LayerTree.tsx`의
노드 타입·폴더 아이콘(×3, 텍스트가 바로 옆에 있는 장식 아이콘),
`PropertySection.tsx`의 Chevron 아이콘(×2). 아이콘은 WCAG 1.4.3(텍스트 대비)
대상이 아니고, 라벨 텍스트가 항상 옆에 있어 정보를 중복 전달하므로 장식으로
본다.

## 검증

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한, 무관)에 새 회귀
테스트 12개가 더해져 1536개 통과(기존 1524 + 12)/1개 건너뜀.

### 회귀 테스트 — `test/design-token-contrast.test.ts`

jsdom에 CSS 커스텀 프로퍼티를 읽어올 방법이 없어, 원시값을 테스트 파일에
그대로 옮겨 적고 WCAG 공식으로 계산한다. `colors.css`의 값이 바뀌면 이 상수도
같이 고쳐야 한다는 점을 파일 머리에 주석으로 남겼다. 다섯 surface(라이트)·
다섯 surface(다크) 각각에서 `content-muted` ≥ 4.5:1을 확인하고(10개),
`content-subtle`이 `bg-surface` 기준으로 AA 밑(= 일반 텍스트에 쓰면 안 된다는
뜻)임을 두 테마에서 고정했다(2개) — 총 12개.

### 실제 컴포넌트 + 실제 테마로 확인(라이브 브라우저)

`pnpm dev`로 띄운 홈 화면(`HomeScreen.tsx`)에서 라이트(기본)와
`document.documentElement.dataset.theme = "dark"`로 전환한 다크 두 상태를
스크린샷으로 비교했다 — "어떻게 시작하시겠습니까?", "설명을 입력하면 구조를
생성합니다"/"직접 요소를 배치합니다"/"JSON 파일을 엽니다" 세 버튼 설명 모두
수정 전보다 뚜렷하게 읽혔다. `ExportPanel`·`TicketPanel`·`PropertiesPanel`
등 에디터 내부 패널은 이번 세션의 Chrome 확장이 "빈 캔버스에서 시작" 진입
직후 반복적으로 멈추는 문제(기존 autosave 초안 복원과 관련된 것으로 보이는
`beforeunload`류 차단, 이번 변경과는 무관)로 라이브 검증을 완료하지 못했다 —
대신 다섯 surface 전부에 대한 결정적 수치 검증(위 회귀 테스트)과 홈 화면
실측으로 갈음했다. 다크 테마는 원시값을 아예 바꾸지 않아(사용처 재배정만
있음) 위험이 라이트보다 낮다.

## 결론

- 완료 조건 "활성 일반 안내 텍스트는 두 테마에서 WCAG AA 4.5:1 이상을 확보한다"
  — `content-muted` 라이트 원시값을 `neutral-600`으로 올려 다섯 surface 전부
  충족(다크는 이미 충족), 20곳의 활성 텍스트를 `content-muted`로 재배정
- 완료 조건 "disabled/장식 역할은 분리하고 실제 사용 화면에서 의미 토큰을
  검증한다" — `content-subtle`을 disabled·장식 7곳 전용으로 좁히고
  `semantic/colors.css`에 용도를 주석으로 명시, 14개 파일 전체 사용처를
  수작업으로 재분류
- 회귀 테스트(`test/design-token-contrast.test.ts`) 12개 추가 — 원시값이
  다시 낮아지면 실패하도록 고정
