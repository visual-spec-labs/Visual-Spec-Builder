# 사용자 화면의 공용 스타일·폰트·상태 지원 범위 (#290)

상태: **결정 반영 · 2026-10-13 리더 결정으로 Q1~Q7 권고와 G1~G6 구현 게이트 채택. 기능·스키마는 미구현**
(최초 Draft 2026-10-10, [#360](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/360)에서 결정).
이 문서는 사용자가 만든 화면의 디자인 시스템을 **어디까지 지원할지**와 **후속 구현 순서**를 기록한다.
승인 근거와 승인 범위는 [6절](#6-결정-기록)에 있다. 채택된 것은 방향과 단계별 게이트 기준이며, 각 단계의
스키마·Command·Ticket 계약 PR의 동결 절차와 기능 구현 PR은 별도다. 보류 단계(추가 폰트·CSS 변수)는
착수 가능한 단계가 아니다.
정본 스키마·Command·Ticket·코드 생성 스킬·GUI 코드는 바꾸지 않는다.
최신 소스 대조 기준: develop `694f2d6`(2026-10-13, #374 병합 후). 최초 초안은 develop
`0733ae1e65f837f47cdba5b18310750ed70c7662`(#356·#350·#349 통합)과
[#290](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/290) 본문(2026-10-10 확인)을 대조했다.

이 문서를 바꾼 PR과 함께 바뀐 문서는 맨 아래 "변경 이력"에 있다.

## 결정 요약 — 채택 결론과 보류·제안 구분

사용자 화면의 스타일은 **노드마다 리터럴 값을 저장하는 지금의 정본을 유지**하고, 그 위에 이름 있는
색·글자 스타일을 **값 사본 + 스타일 연결**로 더한다(Q1). 첫 버전은 색·글자 스타일과 button/input의
hover·pressed·focus 상태에 집중한다(2026-10-10 제품 방향 3, Q6). 생성 코드는 리터럴을 유지하고
CSS 변수 출력과 추가 폰트는 보류한다(Q3·Q5). 각 단계는 [5절](#5-후속-구현-순서)의 선행·완료 조건과
G1~G6 게이트를 충족한 뒤 별도 스키마 PR·기능 PR로 진행한다. spacing 토큰과 아이콘 라이브러리는 첫 버전에 만들지 않는다.

| 항목 | 지원 수준 | 근거 | 스키마 영향 |
|---|---|---|---|
| 색 스타일 | 이름 있는 색 스타일(값 사본 + 연결). 1단계 문서 색 모음(파생)은 제안으로 남음 | Q1 채택. 문서 색 모음은 결정 범위 밖 제안 | 이름 있는 스타일만. 별도 스키마 PR(2-1) |
| 글자(type) 스타일 | 이름 있는 글자 스타일(`Typography` 6필드 한 묶음). 색 스타일과 같은 스키마 설계, UI 구현은 분리 | Q2 채택 | 2-1에 포함 |
| 생성 코드 형식 | 리터럴 임의 값 클래스 유지. CSS 변수 출력은 **보류** | Q3 채택(2026-10-10 방향 4) | 보류 단계(3-2)만 Export 구성 영향 |
| spacing | 첫 버전에 이름 있는 토큰을 두지 않는다. 필요하면 GUI 간격 단계 제안만 | 방향 3(첫 버전은 색·글자·상태). GUI 제안은 결정 범위 밖 | 없음 |
| 폰트 | Pretendard 하나(#280 계약) 유지. 추가 폰트는 수요 확인 전 **보류** | Q5 채택(방향 4) | 보류 단계(3-1)만. 별도 스키마 PR |
| 아이콘 | SVG를 이미지로 Import(이미 가능). 아이콘 노드·라이브러리는 첫 버전에 만들지 않음 | 현재 제공 범위. 방향 3 | 없음 |
| 이미지 | 현재 Import·자산 저장 유지. 자산 목록·재사용·미사용 표시(GUI)는 제안. alt는 #285 후속 | 결정 범위 밖 제안 | 없음(alt는 #285 스키마 PR) |
| 요소 상태 | button/input × hover·pressed·focus, 배경·글자색·테두리 색. 상태 배경은 solid 한 겹. 기본 focus 표시 보존(#285 후속 3)이 선행. disabled·다른 상태는 보류 | Q6·G6 채택(방향 3) | 별도 스키마 PR(2-3) |
| 직접 수정·독립 출력 | 연결된 값을 직접 수정하면 그 연결을 해제하고 수정. 독립 앱 출력은 외형을 보존하고 스타일 연결만 제거 | 방향 1·2, G1·G2 채택 | 2-2 구현 |
| 공용 컴포넌트 | #265(D8/D9, instance)에 맡긴다. 여기서 설계하지 않는다 | #265 소관 | #265 소관 |

## 1. 두 디자인 시스템의 경계 (완료 조건 2)

이 저장소에는 성격이 다른 두 디자인 시스템이 있다. 이름이 비슷해 섞이기 쉬우므로 먼저 나눈다.

| | 앱(편집기) 디자인 토큰 | 사용자 화면의 디자인 시스템 |
|---|---|---|
| 무엇의 모양인가 | Visual Spec Builder GUI 자체(메뉴·패널·캔버스 바탕) | 사용자가 캔버스에 그린 화면 |
| 정본·저장 위치 | `src/styles/tokens/**`(Primitive → Semantic → Component/State CSS) | 스펙 JSON(`.visual-spec/specs/*.json`) 안의 노드 값. 이미지는 `.visual-spec/assets/` |
| 규칙 문서 | [DESIGN-TOKEN-RULES](DESIGN-TOKEN-RULES.md), lint `local/no-primitive-color-utilities` | [05](05-schema.md)·[06](06-schema-freeze.md)(IR), [코드 생성 스킬](../skills/visual-spec-to-react/SKILL.md) |
| 바꾸는 사람·경로 | 이 저장소의 개발자가 CSS를 고친다 | 사용자가 GUI·자연어로 Command를 보내 바꾼다(Undo 대상) |
| 코드로 나가는가 | 나가지 않는다. 앱 번들에만 들어간다 | Export ZIP의 `pages/`·`components/`·`assets/`로 나간다 |
| 테마 | 라이트/다크 전환(`data-theme`) | 없음. 사용자 화면은 저장된 값 그대로 그린다 |

**경계 규칙(현재 사실 + 이 문서의 결정).**

1. **현재 사실** — DESIGN-TOKEN-RULES의 "예외 — 스펙에서 계산된 치수"가 이미 경계를 정한다. 노드의
   `box`·색·`page.size`처럼 **사용자 문서가 정하는 값은 토큰이 아니라 인라인 스타일**로 캔버스에 그린다
   (`ui/nodeStyles.ts`의 `textStyle`·`buttonStyle`이 `node.color`·`typography.*`를 그대로 넣는다).
2. **현재 사실** — 코드 생성은 사용자 값을 Tailwind 임의 값 클래스로 옮긴다(`bg-[#..]`, `text-[Npx]`,
   `gap-[Npx]`, `[font-family:'값']` — 스킬 "매핑 참고표"). 앱 토큰 이름(`bg-surface`, `--color-primary`)을
   쓰지 않는다. Export ZIP에는 `styles/`가 없다(`export/bundle.ts` 머리 주석, [02](02-mvp-scope.md) 결과 예시).
3. **결정(Q1·Q3에서 도출)** — 사용자 스타일(아래 3.1)을 도입해도 **앱 토큰 파일에 넣지 않는다**. 스타일과
   노드 사본은 스펙 JSON(`ProjectSpec`)이 유일한 저장 위치이고(Q1), 생성 코드는 리터럴을 유지하므로(Q3)
   앱 토큰을 사용자 스펙이나 생성 코드에서 참조하지 않는다.
4. **보류(Q3)** — CSS 변수 출력은 후속 단계로 보류했다. 그 단계를 재개하면 사용자 앱의 기존
   테마(`--color-primary` 등)와 구분하기 위해 `--vs-` 접두어를 후보로 둔다. **접두어만으로 식별자
   유효성·충돌·안전성이 보장되지는 않는다.** 표시 이름과 안정 ID 분리는 2-1부터 적용하고(G3),
   CSS 이름 인코딩·namespace·scope는 그 단계 전에 별도로 확정한다(3.1의 G3).
5. **유일한 공유점은 폰트 파일이다.** GUI와 생성 앱이 같은 Pretendard CSS URL을 불러오는 것은
   **실측 비교 계약**([#280](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/280))이지
   토큰 공유가 아니다. 앱 토큰 `--font-family-pretendard`는 fallback 목록을 갖지만
   (`src/styles/tokens/primitives/typography.css`), 스펙 노드는 `typography.fontFamily` 하나만 쓴다.

## 2. 현재 상태와 근거 (develop 대조)

| 대상 | 지금 | 근거 |
|---|---|---|
| 스타일 값 | 모든 값이 노드별 리터럴이다. 색은 `#RRGGBB(AA)` 문자열, 글자는 `Typography` 6필드가 모두 필수, 간격은 `layout.gap`·`padding` 숫자 | 정본 `$defs.Color`·`Typography`·`Layout`(`schema/visual-spec.schema.json`) |
| 토큰·스타일 개념 | 없음. `TokenSet`·`variants`·`states`가 제외 범위, `token`도 미지원 | [05](05-schema.md) MVP 제외 범위, [06](06-schema-freeze.md) "지원하지 않는다" |
| 색 입력 | 스와치 + hex + 불투명도. 문서 안에서 쓴 색 목록·프리셋은 없다 | `ui/properties/fields/ColorField.tsx` |
| 폰트 선택지 | `Pretendard`, `system-ui` 두 개. 굵기는 400~700 네 개(스키마는 100~900) | `ui/properties/TypographySection.tsx`의 `FONT_FAMILY_OPTIONS`·`FONT_WEIGHT_OPTIONS` |
| 폰트 공급 | [PR #350](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/350)(#280)가 병합되어 GUI와 생성 셸이 같은 **static** dynamic-subset URL을 쓴다. 이전 variable CSS의 family는 `Pretendard Variable`이라 `"Pretendard"` 텍스트가 OS 폴백으로 그려졌고 이 불일치를 수정했다([25](25-layout-parity-contract.md) §1·§4.2) | `src/styles/fonts.css`, 스킬 "페이지 viewport와 브라우저 기본 스타일" 셸 |
| 새 노드의 글꼴 | 삽입·시드가 `fontFamily: "Pretendard"`로 만든다. 저작·자연어 스킬도 `"Pretendard"`로 통일한다 | `store/createNode.ts`, `store/seedSpec.ts`, `skills/visual-spec-authoring/SKILL.md` |
| 이미지 | 파일 ▸ 이미지 가져오기·배경 이미지 선택은 이미지 디코딩·크기 측정에 성공하면 `.visual-spec/assets/`에 UUID를 붙인 이름으로 저장을 시도한다. 작업공간 목록 조회 불가·허용 확장자 밖·UUID 생성 불가·쓰기 실패 시 파일 읽기가 성공하면 data URI를 스펙에 넣는다. 디코딩 또는 fallback 읽기까지 실패하면 가져오지 않는다. 허용 확장자에 `.svg`가 있다. 이미 있는 자산을 고르는 목록 UI는 없고 경로를 직접 적어야 재사용된다. 미사용 자산 정리는 없다 | `ui/importImageFromFile.ts`, `features/workspace/protocol.ts`(`WORKSPACE_DIR_RULES.assets`), `ui/properties/ContentSection.tsx`·`ImageFillFields.tsx`의 "경로 (src)" 칸 |
| 이미지 생성 | 자산은 `../assets/<파일>` 정적 import, `alt=""`(장식용 근사) | 스킬 "image 노드", [21](21-app-scope-a11y-design.md) |
| 아이콘 | 아이콘 노드 타입이 없다. `lucide-react`는 편집기 UI에서만 쓴다. 사용자 화면의 아이콘은 SVG/PNG를 이미지로 넣는 방법뿐이고 색을 바꿀 수 없다 | 정본 `Node`(5종), `TypographySection.tsx` 등의 `lucide-react` import |
| Export 의존성 | `package.json`은 `react`와 생성 코드가 import한 패키지를 `*`로 나열한다 | `export/bundle.ts` `buildPackageJson` |
| 요소 상태 | hover·focus·disabled 스타일이 없다. 캔버스 버튼은 `cursor: default`. 생성 스킬은 테두리 정렬을 `outline-*`로 옮기지 않는다(브라우저 focus 링과 겹침) | [05](05-schema.md) `states` 제외, `ui/nodeStyles.ts` `buttonStyle`, 스킬 "테두리 정렬" |
| 공용 컴포넌트 | instance·ComponentSpec이 제외 범위. 설계는 #265 D8/D9(0.4)에서 진행 중 | [05](05-schema.md), PR #339의 `docs/24-screen-relations-design.md` |
| 그룹화·선택 | **단일 노드 그룹 만들기·해제는 완료**(#250, `command/groupCommands.ts`의 `buildGroupCommands`). 선택은 노드 하나(`editorStore`의 `selectedId`) | [07](07-implementation-status.md), `store/editorStore.ts` |

**확인한 위험 하나(실측 범위 한정).** GUI의 `system-ui` 선택지는 캔버스에서 CSS generic 키워드
`font-family: system-ui`로 그려지지만, 생성 매핑 `[font-family:'값']`은 따옴표가 붙은 `'system-ui'`가 된다.
CSS 명세상 따옴표 붙은 generic 이름은 키워드가 아니라 같은 이름의 폰트를 찾는다. 2026-10-10 Playwright
MCP의 Chromium 154(Windows)에서 두 표기를 CDP `CSS.getPlatformFontsForNode`로 재 보니 **둘 다
`Malgun Gothic`으로 같은 폭(188.67px)이 나와 차이가 없었다.** Firefox·Safari·다른 OS는 확인하지 않았다.
따라서 "현재 불일치 버그"라고 판정하지 않고, 후속 1단계에서 생성 규칙을 generic 키워드 무따옴표로 명시할지
검토하는 항목으로만 둔다(아래 5절 1-2).

## 3. 항목별 지원 범위 (완료 조건 1)

각 항목의 지원 수준 앞에 근거(Q 결론·보류·결정 범위 밖 제안)를 적었다. "저장 위치"의 필드 이름
(`styles.colors` 등)은 예시이며 정확한 형태는 해당 스키마 PR에서 정한다. 스키마 영향이 있는 단계는 모두
[06 변경 규칙](06-schema-freeze.md#변경-규칙)대로 **기능과 분리한 별도 스키마 PR, 최소 1명 팀 승인,
`pnpm run generate:types`와 예제·테스트 갱신**을 거친다. Command 편집 경로가 늘면
[09](09-command-schema-freeze.md)의 공개 계약 리뷰도 함께 받는다.

### 3.1 색·글자·간격 스타일

| 항목 | 지원 수준 | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| 문서 색 모음 | **1단계(제안, 결정 범위 밖).** ColorField 옆에 이 프로젝트에서 이미 쓴 색을 사용 빈도순으로 보여 주고 고르면 그 값을 쓴다 | 저장하지 않는다. 열린 `ProjectSpec`의 노드·배경·테두리·그림자 색에서 매번 파생 | 바뀌지 않는다(리터럴 그대로) | 선행 없음. 스키마·Command 영향 없음 |
| 이름 있는 색 스타일 | **2단계(Q1 채택).** 프로젝트에 `primary` 같은 이름 있는 색을 정의하고 노드 속성을 그 스타일에 연결한다. 스타일 값을 바꾸면 연결된 모든 속성을 한 번에 바꾼다(Undo 한 단계) | `ProjectSpec`의 선택 필드(예: `styles.colors`)와 노드의 연결 정보. **노드의 리터럴 값은 계속 정본 사본으로 남긴다**(아래 "값 사본 + 연결" 근거) | 2단계는 지금처럼 리터럴 임의 값 클래스. CSS 변수 생성은 보류(Q3, 3-2) | 2-0 원자 프로젝트 편집 기반(#265 S1-2 프로젝트 검증 재사용) → 2-1 별도 스키마 PR → 2-2 Command·GUI·NL([5절](#5-후속-구현-순서)) |
| 이름 있는 글자 스타일 | **2단계(Q2 채택).** `Typography` 6필드 한 묶음을 이름으로 정의(제목·본문 등). 색은 포함하지 않는다(색 스타일과 따로 연결) | 색 스타일과 같은 위치(예: `styles.text`) | 리터럴 `text-[Npx]`·`leading-[Npx]` 등 그대로 | 색 스타일과 같은 스키마 설계(2-1)로 다루고 UI 구현은 분리한다(Q2) |
| spacing | **첫 버전에 이름 있는 토큰을 두지 않는다**(방향 3). 간격 단계 GUI는 결정 범위 밖 제안. 필요해지면 간격 칸에 4px 단위 단계 제안(GUI)만 둔다 | 저장하지 않는다 | `gap-[Npx]`·`p*-[Npx]` 그대로 | 선행 없음. 수요가 확인될 때 GUI 이슈로 |

**값 사본 + 연결을 채택한 근거(Q1).**

- 캔버스(`ui/nodeStyles.ts`)·홈 미리보기(`ui/homePreview.ts`)·코드 생성 스킬·Ticket 구조 비교
  (`ticket/compileTickets.ts`의 `structuralKey`가 `color`·`typography`를 비교)·반응형 override(`ScreenSpec.responsive`)가 모두 **노드의 리터럴 값**을 읽는다.
  노드 값을 참조(예: `{"$style":"primary"}`)로 바꾸면 이 소비자 전부가 해석기를 거쳐야 하고 `Color` 타입이
  문자열이 아니게 되어 0.4급 변경이 된다. 값을 남기면 연결 정보를 모르는 소비자도 같은 모양을 그린다.
- 대신 "스타일 값과 노드 사본이 어긋난 상태"를 막아야 한다. 스타일 변경·연결·해제는 프로젝트 전체 후보를
  검증한 뒤 한 번에 커밋하고, 검증기가 연결된 속성의 사본이 스타일 값과 같은지 검사한다(Q1의 선행 조건).
  이는 #265 D5의 "프로젝트 후보 검증 → 단일 history 커밋"과 같은 요구다. #265 S1-2의 프로젝트 검증은
  [PR #366](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/366)으로 병합됐고, 모든 쓰기 경로의
  원자 커밋은 아직 없으므로 5절 2-0으로 둔다.
- 반응형 override와 #265 D8의 instance `color` override는 **초기 리터럴만 허용하고 기본 스타일 연결은
  유지**한다(Q4). override가 연결된 속성을 덮으면 그 폭/인스턴스에서는 스타일과 별개 값이 된다.

#### 스타일 구현 전 설계 게이트 (G1~G3 — 2026-10-13 구현 게이트로 채택)

아래 표는 검토한 대안 기록이다. "채택"으로 표시한 안이 게이트 기준이며, 기준을 충족해야 해당 단계를 병합한다.

**G1 — 연결된 값의 직접 GUI/NL 편집(Q1·Q2·Q4).** 기존 `useNodeField` → `setNodeField`와
NL `updateNode`는 리터럴 편집 경로이므로, 스타일 변경·연결·해제만 원자화해서는 충분하지 않다.

| 대안 | 채택 여부·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| A. 직접 편집은 해당 연결을 해제하고 값 변경 | **채택(일반 직접 편집, 방향 1).** 한 노드만 바꾸려는 기존 GUI/NL 의도를 보존한다. 연결 해제 + 리터럴 변경 + 프로젝트 후보 검증을 Undo 한 단계로 커밋 | GUI·NL·붙여넣기/배열 교체 등 모든 쓰기 경로에 동일 정책 적용. 실패 시 연결·값·history 모두 이전 상태, Undo/Redo로 함께 복원 |
| B. 직접 편집이 공유 스타일을 갱신 | **채택(명시적 공용 스타일 편집에 한함).** 사용자가 별도의 “공용 스타일 수정”을 명시한 경우에만. 모든 연결 사본과 카탈로그를 원자 갱신 | 일반 `updateNode`를 전역 변경으로 해석하지 않는다. 명시 연산·영향 범위 안내·Command 공개 계약을 승인받는다 |
| C. 연결 상태에서는 직접 편집 거부 | 채택하지 않음. 명시적 unlink를 먼저 요구하는 UX의 대안으로 기록만 남긴다 | 기존 필드/NL이 이유와 해제 방법을 안내해야 하며 단순 검증 오류로 끝내지 않는다 |

채택안 A에서 `Typography`의 `fontFamily`·`fontSize`·`fontWeight`·`lineHeight`·`letterSpacing`·
`textAlign` 중 **하나를 편집해도 글자 스타일 연결 전체를 해제**한다. 나머지 다섯 리터럴은 유지한다.
B에서는 변경 필드를 기존 여섯 필드에 합성한 완전한 묶음을 모든 연결 노드에 전파한다. 색 연결은 별개다.
부분 필드만 연결 유지하는 모델은 채택안에 없다. 반응형/instance override는 Q4대로 리터럴이며
기본 스타일 연결을 해제하지 않는다. 배열 전체 교체로 연결 대상 겹/stop이 사라지거나 순서가 바뀌는 경우,
안정된 대상 ID를 도입할지 영향받는 연결을 함께 해제할지는 **색 연결 스키마(2-1) 전에** 정한다 — G1의 남은 결정 항목이다.
GUI·NL·붙여넣기 등 모든 쓰기 경로는 후보 `ProjectSpec` 검증을 거치고 실패하면 아무것도 바꾸지 않는다.

**G2 — 카탈로그 없는 standalone VisualSpec(Q1·Q7).** 현재
[`toVisualSpec(page)`](../src/features/editor/schema/migrate.ts)는 `ScreenSpec`만 받는다.
프로젝트 카탈로그를 참조하는 연결을 그대로 내보내면 해석할 수 없고, 무조건 지우면 재편집 연결이 사라진다.

| 대안 | 채택 여부·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| A. project context로 해석·검증한 복사본을 리터럴로 물질화하고 연결 해제 | **채택(방향 2).** 독립 화면 전달은 외형 보존을 우선하고, 연결 보존은 ProjectSpec 파일로 한다 | standalone 출력에 모든 연결 메타데이터가 없어야 한다. 원 프로젝트·history는 불변. 재가져오기는 연결 없는 화면이며 손실을 안내 |
| B. VisualSpec에 필요한 카탈로그를 함께 저장 | 채택하지 않음. 독립 화면을 다시 가져와도 연결을 보존해야 할 때의 대안 | VisualSpec 스키마·validator·migration·ID 충돌/재병합 정책까지 확장하고 승인받는다 |
| C. 변환 API가 project context를 필수로 받음 | A를 구현하는 변환 경계 후보. 2-2에서 호출부 조사와 함께 확정한다. **context만 넘기고 출력에 외부 연결을 남기는 것은 해결이 아니다** | 모든 호출부를 조사하고 A/B 출력 모델과 함께 결정. context 없는 linked page는 오류로 차단, 기존 unlinked page 경로는 유지 |

A 채택에 따라 누락된 카탈로그/ID·불일치 사본은 추측 복구하지 않고 변환을 실패시킨다. 원본과 history는
보존하고, 재가져오기 때 연결 손실을 안내한다. 이것은 스타일 연결만 제거하는 것이며 #265의 action/ref를
제거하거나 우회하지 않는다. 관계가 남은 standalone은 [24](24-screen-relations-design.md)의 프로젝트 문맥 요구를 유지한다. base와 responsive
리터럴을 보존하는 round-trip 예제, 카탈로그 없는 linked 입력 거부 예제, 원본 무변경 검증이 필요하다.
현재 Ticket 스킬도 page를 VisualSpec으로 감싸 검증하므로, 이 경로 역시 연결 해제 snapshot 또는
카탈로그 전달 중 선택한 정책을 따라야 한다(G4). 폰트 family 문자열 물질화만으로 폰트 파일이 따라오지는 않는다. 프로젝트 폰트가 쓰인 standalone 화면의
공급원 동봉/별도 manifest/명시적 지원 거부도 G4와 함께 결정해야 한다(추가 폰트는 Q5로 보류 중이라 지금은 Pretendard만 해당).

**G3 — 안정 ID·CSS 변수 직렬화(Q3).** 대안은 (A) 표시 이름과 별도의 불변 ID를 저장하거나,
(B) 표시 이름을 CSS escape하고 충돌 해소 표를 유지하거나, (C) 리터럴 생성을 유지하는 것이다.
**2단계는 C(리터럴 유지, Q3)로 하고, 표시 이름과 안정 ID 분리(A의 ID 부분)는 2-1 스키마부터 적용**한다.
rename 시 ID 유지, import/copy 충돌과 참조 갱신 검증이 2-1·2-2의 게이트다. CSS 변수 인코딩·namespace·scope는
보류 단계(3-2)를 재개하기 전에 별도로 확정하며, 아래 CSS 관련 항목은 그때의 기준이다. 예를 들어 프로젝트 namespace와 스타일 ID를 각각
`[a-z][a-z0-9-]*`로 제한하고 길이 상한·프로젝트 내 유일성을 검증한다. 이름 변경은 ID를 바꾸지 않는다.
구분자 연결도 모호할 수 있으므로 CSS 이름은 타입/길이를 포함한 충돌 없는 인코딩(또는 충돌 검사된
할당 표)으로 만든다. 정규화해 같은 이름이 된 스타일을 조용히 합치지 않는다. 복사·프로젝트 import 때의
ID 재발급과 참조 갱신, 여러 프로젝트/호스트 앱 CSS와의 충돌 검사·컨테이너 scope를 먼저 설계한다.
접두어는 namespace 후보일 뿐이다. 식별자 검증과 별개로 색·글자 값도 허용 타입·범위를 검사하고
CSS 문자열/URL/선언은 문맥별 직렬화한다. 이름을 raw CSS·클래스·`<style>`에 보간하지 않는다.
공백·한글·문장부호 이름, 중복 ID, 동일 slug, rename, 다중 프로젝트를 생성·재로드 fixture로 검증한다.

### 3.2 폰트 선택·공급

| 항목 | 지원 수준 | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| 기본 폰트 | **Pretendard 하나를 공식 지원**한다(Q5: 추가 폰트 보류 동안 유일한 지원 폰트). 사용자 화면·GUI·생성 셸이 같은 static dynamic-subset URL을 쓴다(#280 계약) | `typography.fontFamily: "Pretendard"`(현재 그대로) | 생성 셸의 `@import` URL을 바꾸지 않는다(PR #350이 스킬에 명시) | **선행 완료: PR #350 병합.** 같은 static URL 계약을 유지한다 |
| `system-ui` 선택지 | **제안(결정 범위 밖).** 유지하되 "시스템 글꼴 — 기기마다 모양이 다르고 GUI와 생성 앱의 줄바꿈이 다를 수 있다"는 범위로 안내한다. #280 실측 대상에 넣지 않는다 | 현재 그대로 | generic 키워드는 따옴표 없이 생성하도록 스킬에 명시할지 검토(2절 위험) | 1단계 문서·스킬 정리. 스키마 영향 없음 |
| 굵기 | **제안(결정 범위 밖).** 스키마 100~900 중 GUI는 400~700만 노출. Pretendard static은 아홉 굵기를 제공하므로 GUI 선택지 확장은 별도 GUI 이슈로 둔다 | 현재 그대로 | `font-thin`~`font-black` 매핑 그대로 | 선행 없음 |
| 프로젝트 폰트 추가 | **보류(Q5) — 수요 확인 전에는 착수하지 않는다.** 채택하면 프로젝트가 쓸 폰트를 목록으로 선언하고, 첫 공급원은 작업공간 `woff2` 파일 + 검증·Export 동봉·라이선스 안내를 묶는다. 원격 CSS URL은 별도 결정이다. GUI는 목록의 폰트만 선택지로 보이고 불러온다 | `ProjectSpec`의 선택 필드(예: `fonts[]`). 파일 공급이면 작업공간에 폰트 디렉터리 또는 `assets/`의 허용 확장자 추가가 필요(`WORKSPACE_DIR_RULES` 변경) | 생성 셸이 Pretendard `@import`를 **대체하지 않고 추가로** 선언된 폰트의 `@import`/`@font-face`를 넣는다. 파일 공급이면 Export에 폰트 파일을 포함한다 | 재개 조건: 수요 확인과 채택 결정 → #280 실측 도구가 Pretendard 외 family를 허용하도록 확장 → G4·G5 충족 → 별도 스키마 PR → GUI·스킬·Export(5절 3-1) |

**#280 계약과 충돌하지 않게 하는 조건.** 폰트 추가는 Pretendard URL을 바꾸거나 fallback 목록을 노드
스타일에 붙이지 않는다(PR #350 docs/25: "노드 스타일은 스펙의 family 하나만 쓰고 별도 fallback 목록을
붙이지 않는다"). 웹폰트를 받지 못한 실측은 "측정 무효"로 보는 같은 판정을 새 폰트에도 적용한다.
폰트 라이선스(재배포 가능 여부)는 앱이 판정하지 않으므로, 파일 공급을 채택하면 사용자 책임 안내와
허용 형식(`woff2`)을 함께 둔다(Q5). 라이선스 안내를 재배포 허가로 간주하지 않는다(G5).

#### 폰트 구현 전 설계 게이트 (G4~G5 — 기준 채택, Q5 보류로 착수 불가)

G4·G5는 추가 폰트를 채택할 때의 닫기 기준으로 채택됐다. Q5가 보류인 동안 이 게이트를 근거로 폰트 공급 구현을 시작하지 않는다.

**G4 — Ticket/스킬까지 공급원 전달.** 현재
[`TicketRequest`](../src/features/editor/ticket/ticketProtocol.ts)의 `page: ScreenSpec`에는
`ProjectSpec.fonts[]`가 없다. 현재 티켓 요청 규약은 **v3**(#349가 v2로 요청별 `staging/<id>`와 GUI 수용 후
generated 확정을 도입, #281이 생성 자리 `generatedRoot`로 v3)이다([26](26-agent-request-generation-contract.md)).
#265 D11(2026-10-13 리더 확정)으로 프로젝트 compile용 **Ticket v0.2와 티켓 요청 규약 v4**가 예정됐다.
폰트 snapshot을 v4에 넣을지 그 다음 버전으로 낼지는 Q5 채택 시 #265·#281과 공동 결정하며, 여기서 번호를 정하지 않는다. 폰트 snapshot 제안은 이
요청 fencing·staging·출력 manifest 계약을 보존하고 필요한 입력 지문/무효화 범위를 확장하는 후속이다.
디스크의 프로젝트를 다시 읽는 방식은 미저장 문서·요청 이후 편집을 재현하지 못한다.

| 대안 | 채택 여부·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| A. TicketRequest에 검증된 폰트 공급원 snapshot 추가 | **채택 기준(G4).** 요청 당시 page(반응형 override 포함)가 사용하는 family/weight와 공급원·자산 매핑을 함께 고정 | protocol 버전/구버전 거부·호환성, 요청 writer/reader/validator, ticket-response·to-react 스킬 및 로컬 계약을 함께 변경하는 별도 PR |
| B. page에 필요한 폰트 메타데이터 포함 | 채택하지 않음. standalone 화면의 자급성을 우선할 때의 대안 | ScreenSpec/VisualSpec 중복 카탈로그의 정본·동기화·충돌 규칙을 스키마 PR에서 정의 |
| C. 프로젝트 전체 snapshot 전달 | 채택하지 않음. 향후 여러 프로젝트 자원이 필요할 때의 대안 | payload 크기와 불필요 데이터 전달을 평가. 디스크 경로만 전달하는 방식은 대안이 아님 |

A에서는 family·weight·공급원(URL 또는 상대 파일)·파일 Export 매핑을 요청 생성 시 검증하고 미해결 폰트는
생성을 차단한다. 스킬이 파일명/URL을 추측하거나 임의 다운로드하지 않도록 계약에 적는다.
동일 family의 다른 공급원, 미저장 프로젝트, 요청 뒤 폰트 변경, standalone의 공급원 누락,
웨이브 간 snapshot 변경으로 기존 결과가 낡는 경우의 무효화 정책까지 결정한다. 파일 byte 변경도
고정할지 hash로 탐지·거부할지 정하고, Export가 검증한 byte와 실제 포함한 byte의 일치를 확인한다.
이는 [11](11-ticket-schema-freeze.md)의 Ticket 객체 계약 및 [26](26-agent-request-generation-contract.md)의
티켓 요청 규약(현재 v3, D11로 v4 예정)을 구별한 별도 변경 검토이며, 프로젝트 폰트 전달의 현재 지원 주장이 아니다.

**G5 — URL/경로 검증·CSS 직렬화·원격 로딩 정책.** 파일만 허용(A), 승인된 HTTPS CSS URL만 허용(B),
둘 다 허용(C)이 대안이다. **추가 폰트를 채택하면 초기 공급은 검증된 작업공간 `woff2` 파일(A)로 한다**(Q5·G5). 공급이
해결되지 않은 폰트는 생성을 차단한다. 원격 CSS URL(B/C)은 별도 결정이며, 사용자가 사용자가
공급자를 선택하고 GUI와 생성 앱의 외부 요청·추적 가능성·오프라인 실패를 이해하는 로딩 정책을 정한 뒤 적용한다.

- URL(원격 CSS를 별도로 채택할 때): URL parser로 scheme·credentials·host·redirect 후 주소를 검증한다. HTTPS 허용 목록과
  원격 CSS의 추가 `@import`/`url()` 의존 출처 범위, fetch 주체(브라우저/서버/에이전트), CORS/CSP,
  timeout·최대 크기·cache/integrity·실패 안내를 결정한다. 서버 fetch 채택 시 loopback/사설망 및
  redirect 재검증도 게이트다. 사용자 파일을 열자마자 임의 원격 CSS를 자동 로딩하는 정책은 추천하지 않는다.
- 경로: 승인된 작업공간 폰트 루트의 상대 경로만 받고 절대 경로·`..`·드라이브/UNC·인코딩 우회와
  symlink의 루트 탈출을 거부한다. 확장자만이 아닌 파일 형식·MIME·크기·재배포 안내와 파일 누락을 검증한다.
- 직렬화: family 이름과 URL을 CSS 문자열 규칙으로, 값은 타입별로 직렬화한다. 따옴표·역슬래시·개행·
  `</style>`·임의 선언 삽입을 포함한 입력 fixture를 둔다. CSS 문맥과 HTML `<style>` 삽입 문맥은
  별도로 처리하고, generic `system-ui`는 family 문자열과 구별한다. 원격 CSS 자체는 신뢰 경계 밖이므로
  URL escape만으로 안전해졌다고 판단하지 않는다.
- GUI/생성 셸/Export가 동일 공급원 정책을 사용해야 한다. 네트워크 실패 시 편집 중 fallback 표시와
  #280의 “측정 무효”를 구분하고, 외부 요청 허용 시점·오프라인 패키징 범위를 승인받는다.

### 3.3 아이콘·이미지 관리

이 절은 Q1~Q7 결정 범위 밖이다. 아이콘은 현재 제공 범위(SVG 이미지 Import)를 그대로 두고 첫 버전에
아이콘 노드·라이브러리를 넣지 않는다(2026-10-10 방향 3: 첫 버전은 색·글자 스타일과 상태에 집중).
자산 목록·미사용 표시 같은 GUI 보조는 제안으로 남아 별도 GUI 이슈에서 판단한다.

| 항목 | 지원 수준(제안) | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| 아이콘 | **SVG를 이미지로 Import하는 현재 방법을 지원 범위로 명시**한다. 아이콘 전용 노드·아이콘 라이브러리·색 바꾸기는 이번에 만들지 않는다 | `.visual-spec/assets/*.svg`, `ImageNode.src` | `<img src={정적 import}>`. 생성 코드에 아이콘 패키지를 추가하지 않는다(Export `package.json`에 새 의존성을 만들지 않음) | 재검토는 상태 스타일과 #265 action 이후(아이콘 버튼의 접근 가능한 이름이 #285·#265 계약에 걸림) |
| 이미지 자산 목록 | **1단계(GUI).** 작업공간 `assets/`의 이미지를 목록으로 보여 주고, 골라서 이미지 노드·배경에 다시 쓰게 한다. 각 자산을 참조하는 노드 수를 보이고 참조 없는 자산은 "미사용"으로 표시만 한다 | 새 저장 없음(`assets/` 목록 + 스펙에서 참조 파생) | 바뀌지 않는다. Export는 지금처럼 참조된 자산만 담는다 | 선행 없음. 스키마·Command 영향 없음 |
| 미사용 자산 삭제 | **자동 삭제하지 않는다.** 다른 스펙 파일이 같은 자산을 쓸 수 있고 Undo가 파일 시스템을 되돌리지 못한다. 삭제는 사용자가 목록에서 명시적으로 고르고 확인하는 후속 GUI로 둔다 | — | — | 자산 목록 이후. 작업공간 전체 스펙 참조 검사 필요 |
| 이미지 의미(alt) | [21](21-app-scope-a11y-design.md)의 `ImageNode.alt` 제안을 따른다. 여기서 다시 정하지 않는다 | #285 후속 스키마 PR | #285 | #285 후속 1 |

SVG 이미지 Import는 기존 지원 사실이다. 이 문서는 이를 새 취약점으로 판정하거나 지원 중단을 제안하지 않는다.
자산 목록은 실제 파일만 다루므로 저장 실패로 남은 data URI는 목록 파일로 가장하지 않는다.
향후 inline SVG 편집·원격 자산·새 형식을 도입하면 그 변경의 렌더링/신뢰 경계를 별도로 검토한다.

### 3.4 요소 상태

| 항목 | 지원 수준 | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| focus 표시 | **1단계(#285 후속 3 소관).** G6이 focus-visible 표시 보존을 요구하므로 상태 스타일(2-3)의 선행이다. 생성 코드가 브라우저 기본 focus 표시를 지우지 않는다는 규칙을 스킬에 명시하고 키보드 탐색으로 검증한다([21](21-app-scope-a11y-design.md) 후속 3과 같은 작업) | 없음 | `outline-none`·`focus:outline-0` 등을 생성하지 않는다 | 선행 없음. #285 후속 3과 한 작업으로 진행 |
| hover·pressed·focus 스타일 | **2단계(Q6 채택).** button·input에만 상태별 **제한된 부분 스타일**을 둔다 — 배경, 글자색, 테두리 색. 초기 상태 배경은 solid 한 겹이다. 크기·배치·글자 스타일은 상태로 바꾸지 않는다(상태 전환 때 배치가 흔들리지 않게) | 노드의 선택 필드(예: `states.hover`·`states.pressed`·`states.focus`, 각각 부분 객체). 반응형 override 대상에 넣지 않는다 | `hover:`·`active:`·`focus-visible:` 조건에 G6의 전체 배경 교체·테두리 합성·명시 우선순위를 적용한다. 기본 focus 표시는 1단계 규칙대로 유지하고 그 위에 더한다 | **선행: #265 S1(button action) 이후.** 상태는 누를 수 있는 요소의 피드백이라 action 계약과 같은 대상(button)부터 맞춘다. GUI는 패널의 상태 미리보기 전환 + 캔버스 미리보기 |
| disabled | **보류(Q6).** 정적 `disabled`만 두면 켤 방법이 없는 버튼이 된다. 조건·폼 바인딩 표현이 생긴 뒤 검토한다 | — | 만들지 않는다 | [21](21-app-scope-a11y-design.md) §3 폼 바인딩 epic 판단 이후 |
| 기타 상태(selected·error·loading 등) | 만들지 않는다(Q6: 다른 상태 보류). 데이터·검증 상태라 바인딩 없이 의미가 없다 | — | — | 폼·데이터 바인딩 이후 |

**상태를 스타일만으로 근사하지 않는 이유.** 생성 규칙만으로 "hover 시 약간 어둡게" 같은 기본 상태를
덧붙이면 캔버스에 없는 모양이 코드에만 생겨 "GUI와 생성 앱이 같은 배치·모양"이라는 #280 원칙과 어긋난다.
그래서 상태 스타일은 스펙에 저장하고 캔버스가 미리볼 수 있을 때만 생성한다.

### 3.5 이 문서가 다루지 않는 것

| 항목 | 처리 |
|---|---|
| 공용 컴포넌트·인스턴스 | **#265(③ instance, IR 0.4)에 연결만 한다.** D8(직접 Text/Button의 `content`·`color`만 덮어쓰기)·D9(프로젝트 widget ID 공유)를 그대로 따른다. #265의 제한된 override는 색·글자 스타일 채택을 뜻하지 않는다(PR #339 docs/24 §7) |
| 단일 노드 그룹화 | **완료(#250).** 미구현으로 취급하지 않는다 |
| 다중 선택·정렬·분배 | 후속 범위. 현재 선택이 노드 하나(`selectedId`)라 별도 설계·이슈가 필요하다 |
| 고급 Grid(열 폭 지정·span·영역) | 후속 범위. 현재 Grid는 `columns` 균등 열뿐이다([19](19-grid-codegen-qa.md)) |
| 자유 배치(절대 좌표) | 후속 범위. IR은 "Auto Layout 전용, 절대좌표 없음"이다(정본 루트 `description`) |
| 테마(라이트/다크) | 사용자 화면용 테마는 다루지 않는다. 앱 토큰의 테마와 무관하다 |

#### 상태 구현 전 설계 게이트 (G6 — 2026-10-13 구현 게이트로 채택)

"채택"으로 표시한 안이 G6 기준이다. 2-3·2-4는 이 기준과 아래 회귀 검증을 충족해야 병합한다.

| 쟁점 | 대안과 채택 여부 | 구현 전 결정·검증 |
|---|---|---|
| 상태 배경 위로 base gradient/image가 남음 | A. 상태 배경을 전체 `Background` 교체로 취급(**채택**). B. base가 solid인 노드에서만 상태 배경 허용(초기 범위를 줄일 때). C. 겹 부분 수정은 겹 ID/병합 설계를 추가할 때만 | A의 초기 상태 입력은 solid 한 겹으로 제한한다(Q6). 상태 solid에는 `background-image: none`과 color를 함께 적용하고 size/position/repeat/origin/clip도 정해진 값으로 재계산·reset한다. 상태 종료 시 base 전체 스택 복원. color 클래스만 추가하면 불충분 |
| inside와 center/outside의 상태 테두리 색 | A. 유효 border를 렌더러와 같은 함수 규칙으로 재합성(**채택** — 기존 stroke/shadow 합성 규칙 유지). B. 상태 테두리는 inside만 허용(제약을 GUI/검증기에 명시할 때) | inside는 `border-color`, outside는 바깥 shadow 고리, center는 안팎 shadow 고리 둘 다 변경. width·radius·align·배치는 그대로, 존재하지 않는/폭 0 테두리는 새로 만들지 않음. 합성 box-shadow의 나머지 레이어와 focus outline 보존. `border-color`만 바꾸거나 box-shadow 전체를 날리지 않음 |
| hover·pressed·focus 동시 활성 | A. 속성별 `pressed > focus > hover > base`(**채택**, focus-visible 표시는 보존). B. focus를 최우선으로(키보드 피드백 색을 항상 우선할 제품 요구가 있을 때). C. 조합별 명시 스타일(복잡도 허용 시) | 부분 스타일은 가장 높은 활성 상태가 **명시한 속성만** 덮는다. 예: pressed에 글자색만 있으면 focus 배경을 유지. 배경은 하나의 원자 속성, border 색은 합성 결과로 적용. focus 표시는 색 우선순위와 독립적으로 계속 유지 |

focus는 생성 시 `:focus-visible`, pressed는 누르는 동안의 `:active`이며 토글/selected와 다르다.
채택한 우선순위는 HTML class 나열 순서나 Tailwind 기본 variant 순서에 맡기지 않는다. 명시적 CSS 순서/
조합 selector 등 실제 생성 방식은 2-4 PR 리뷰에서 확정한다. GUI 미리보기도 단일 상태뿐 아니라 동시 상태를 표현해야 한다.
반응형이 base 배경/테두리를 바꾸면 먼저 해당 폭의 base를 확정하고 그 위에 같은 상태 규칙을 적용한다.
solid/gradient/image/mixed base, inside/center/outside, 8가지 활성 조합(없음 포함), 키보드/포인터와
상태 진입·해제의 computed style·focus 가시성·좌표 불변을 GUI와 생성 브라우저 fixture에서 검증한다.

## 4. #265·#285·#280과의 연결 (완료 조건 3)

| 접점 | #265 / #285 / #280의 결정·제안 | 이 문서의 처리 |
|---|---|---|
| 공용 위젯 | #265 D8/D9: widget을 프로젝트 PageId로 공유, instance는 2차(S2-1, IR 0.4 계획) | 공용 컴포넌트를 여기서 설계하지 않는다. 색·글자 스타일은 프로젝트 단위라 위젯과 페이지가 같은 스타일을 함께 쓸 수 있다(위젯 원본 노드의 연결은 일반 노드와 같다) |
| instance override 색 | #265 D8: Text/Button의 `color` 리터럴 덮어쓰기 | Q4 결론: override는 초기 리터럴만, 기본 연결은 유지. 스타일 연결 override는 instance·스타일 둘 다 구현된 뒤 별도 검토 |
| 버튼 동작과 상태 | #265 D3: 초기 action은 native `<button type="button">`에만 | 상태 스타일(2-3)을 #265 S1 뒤로 두고 같은 button부터 시작한다 |
| 프로젝트 단위 원자 커밋 | #265 D5·§5: 프로젝트 후보 전체 검증 후 한 번에 커밋. S1-2 프로젝트 검증은 [PR #366](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/366) 병합 | 스타일 값 변경(연결된 모든 속성 일괄 수정)과 G1이 같은 장치를 필요로 한다. 모든 쓰기 경로의 원자 커밋을 2-0으로 두고, #265 S1-3/S1-4와 공통 장치 범위를 조율한다 |
| IR 버전 | #265: S1은 0.3 선택 확장([PR #355](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/355) 병합), S2 instance는 0.4 계획 | Q7 결론: 색·글자 스타일과 상태를 0.3 선택 확장으로 낼지와 0.4 경계는 #265 계약과 함께 확정하며 버전 번호를 선점하지 않는다. 정본 스키마 동시 수정을 피하려고 2-1은 #265 S1-1 뒤에 둔다(충족) |
| Command 버전 | #265 D10(2026-10-13 리더 확정): action 제거 전용 `removeNodeAction` + Command v0.2 | 스타일 연결·해제·공용 스타일 편집 Command의 버전은 2-2 계약 PR에서 [09](09-command-schema-freeze.md) 절차로 판단한다. v0.2 계약 PR과 같은 계약을 동시에 고치지 않도록 순서를 조율하며 번호를 선점하지 않는다 |
| Ticket·요청 규약 | #265 D11(2026-10-13 리더 확정): Ticket v0.2(`sourcePageId`) + 티켓 요청 규약 v4. 현재 규약은 v3 | 스타일 2단계는 리터럴 생성이라 Ticket 계약을 바꾸지 않는다. 폰트 snapshot(G4)은 Q5 보류이며, 채택 시 v4 포함 여부를 #265·#281과 공동 결정한다 |
| focus·접근성 | #285 후속 3: 기본 focus 표시 보존 규칙과 키보드 검증(미구현 — 스킬에 규칙 없음) | 상태 1단계(1-1)로 같은 작업을 가리킨다. G6이 focus-visible 보존을 요구하므로 2-3의 선행이다(중복 이슈를 만들지 않는다) |
| 이미지 alt·입력 label | #285 후속 1: `ImageNode.alt`, `InputNode.inputType`·`label`(미구현 — 정본에 필드 없음) | 아이콘(SVG 이미지)의 의미도 같은 alt를 따른다. 여기서 다시 정하지 않는다 |
| 폰트·배치 실측 | #280 / PR #350([25](25-layout-parity-contract.md)): Pretendard static URL, 노드 스타일에 fallback 목록 없음, 웹폰트 실패는 측정 무효 | Q5로 Pretendard 하나를 유지한다. 추가 폰트 재개 시 이 계약 위에 덧붙이는 방식만 허용하고(3.2), 로딩 실패 fallback과 측정 무효를 구분한다(G5) |

### 4.1 정합성 확인 결과 (2026-10-13, #360)

develop `694f2d6`의 [24](24-screen-relations-design.md)·[25](25-layout-parity-contract.md)·
[26](26-agent-request-generation-contract.md)·[21](21-app-scope-a11y-design.md), 정본 코드, #265의
[2026-10-13 D10/D11 리더 결정](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414)과
Q1~Q7·G1~G6 결론을 대조했다. **충돌은 찾지 못했다.**

| 대상 | 확인한 내용 | 결과 |
|---|---|---|
| #265 위젯·instance | D8은 직접 Text/Button의 content·color 리터럴 override. Q4는 override 리터럴만·기본 연결 유지 | 일치. D8의 팀 설계 상태는 24 §8을 따르며 여기서 확정하지 않는다 |
| #265 IR 버전 | S1 0.3 선택 확장(#355 병합), S2 instance 0.4 계획. Q7은 번호를 선점하지 않고 #265 계약과 함께 확정 | 일치. 2-1·2-3 착수 전 #265 계약과 함께 판단 |
| #265 Command·Ticket 버전 | D10 Command v0.2, D11 Ticket v0.2·티켓 요청 규약 v4(현재 `TICKET_PROTOCOL_VERSION` 3). 스타일 2단계는 리터럴 생성 | 충돌 없음. 스타일 Command 버전은 2-2 계약 PR, 폰트 snapshot은 Q5 재개 시 공동 결정 |
| #265 원자 커밋 | S1-2 프로젝트 검증 병합(#366). 모든 쓰기 경로의 원자 커밋은 아직 없음 | 2-0으로 기록. 공통 장치 범위는 #265 S1-3/S1-4와 조율 |
| #285 focus·alt | 후속 3(focus 보존)·후속 1(alt·label) 모두 미구현. G6은 focus-visible 보존과 키보드 회귀를 요구 | 일치. 1-1을 2-3의 선행으로 둔다 |
| #280 폰트 계약 | 25 §1: static URL, family 하나, 측정 무효 판정. Q5는 Pretendard 유지·추가 폰트 보류. G5는 fallback과 측정 무효 구분 | 일치. 추가 폰트 재개 시 실측 도구 확장이 선행 |

이 대조는 다른 담당자의 진행 중 설계(#265 D8 팀 설계, #285 후속 구현, #280 실측 도구 확장)를 확정하지 않는다.

## 5. 후속 구현 순서

아래 순서는 채택된 Q1~Q7·G1~G6 결론의 선행 관계를 정리한 것이다. 각 단계는 별도 이슈·PR로 열고,
"선행(착수 조건)"을 모두 충족해야 시작한다. 스키마 단계는 [06 변경 규칙](06-schema-freeze.md#변경-규칙)의 별도 스키마
PR이다. **보류 단계는 착수 가능한 단계가 아니며**, 재개하려면 수요 확인과 별도 결정이 먼저 필요하다.
1단계 항목은 Q·G 결정 범위 밖의 제안이다(1-1은 #285 후속 3 소관).

| 순서 | 작업 | 상태 | 선행(착수 조건) | 완료 조건 | 스키마·계약 영향 |
|---|---|---|---|---|---|
| 0 | PR #350(#280) 병합 — GUI·생성 셸 폰트 URL 일치 | 완료 | — | develop `0733ae1`에 포함 | 없음(기존 스키마 유지) |
| 1-1 | 기본 focus 표시 보존 규칙과 키보드 검증 | #285 후속 3 소관 | 없음 | 스킬에 focus 표시 제거 금지 명시, 생성 결과 키보드 탐색 검증 기록 | 없음. 스킬 문서 |
| 1-2 | `system-ui` 범위 안내와 generic 키워드 생성 규칙 검토(다른 브라우저 실측 포함) | 제안(결정 범위 밖) | 0 | 브라우저별 실측과 스킬·GUI 안내 | 없음. 스킬·GUI 안내 |
| 1-3 | 문서 색 모음(ColorField) | 제안(결정 범위 밖) | 없음 | GUI 이슈에서 정함 | 없음 |
| 1-4 | 이미지 자산 목록·재사용·미사용 표시 | 제안(결정 범위 밖) | 없음 | GUI 이슈에서 정함 | 없음 |
| 2-0 | 원자 프로젝트 편집 기반 — GUI·NL·붙여넣기 등 모든 쓰기 경로의 후보 `ProjectSpec` 검증·단일 history 커밋 | 채택(G1 선행) · 미착수 | #265 S1-2 프로젝트 검증(#366, 충족). #265 S1-3/S1-4(D5)와 공통 장치 범위·담당 조율 | 검증 실패 시 무변경, 성공 시 Undo 한 단계. 모든 쓰기 경로 회귀 | 편집 경로. Command 계약이 바뀌면 09 리뷰 |
| 2-1 | 색·글자 스타일 **스키마 단독 PR**(Q1·Q2) | 채택 · 미착수 | 2-0. G1의 색 겹/stop 재정렬 정책(연결 해제 또는 안정 ID) 결정. G3 안정 ID 문법·유일성·rename·copy 충돌 규칙. Q7 버전을 #265 계약과 함께 판단. #265 S1-1(#355, 충족) | 06 절차의 별도 스키마 PR 승인, `generate:types`·예제·05/06 갱신, 연결 사본 일치 검증 | 정본·생성 타입·05/06·예제. 편집 경로가 늘면 09 리뷰 |
| 2-2 | 스타일 Command·GUI·NL — G1 직접 편집 atomic unlink/update·Typography 묶음·명시적 공용 스타일 편집, G2 standalone 변환 | 채택 · 미착수 | 2-1. 스타일 Command 계약(09 절차, #265 D10 v0.2 계약 PR과 순서 조율). G2 변환 경계(C) 호출부 조사 | G1: Undo 한 번, 실패 시 무변경, Typography 부분 수정 시 전체 연결 해제. G2: 리터럴 물질화·연결만 제거·원본 보존·누락 카탈로그 실패·action/ref 유지 회귀 | Command 버전 판단(번호 선점 안 함) |
| 2-3 | 상태 스타일 **스키마 단독 PR**(button/input × hover·pressed·focus, 배경·글자색·테두리 색)(Q6) | 채택 · 미착수 | 1-1, #265 S1(action), 2-2 이후(채택 순서: 스타일 → 상태), Q7 버전 판단 | 06 절차의 별도 스키마 PR 승인, solid 한 겹 상태 배경 검증 | 정본·05/06·09 |
| 2-4 | G6 전체 배경 교체·shadow 테두리·동시 상태 미리보기·생성 매핑 | 채택 · 미착수 | 2-3 | G6 회귀: 8가지 활성 조합, solid/gradient/image/mixed base, inside/center/outside, 반응형 base, 상태 해제, 키보드 focus 가시성·좌표 불변 | 스킬 |
| 3-1 | 프로젝트 폰트 목록 스키마 PR·작업공간 `woff2` 공급 | **보류(Q5) — 착수 불가** | 재개 조건: 수요 확인과 채택 결정. 이후 #280 실측 도구 확장, G4·G5 충족, 티켓 요청 규약 버전을 #265·#281과 공동 결정 | G4: snapshot·stale·Export byte 일치. G5: 경로·형식·직렬화·로딩 실패와 측정 무효 구분 | 정본·티켓 요청 규약/validator·로컬 계약·스킬·작업공간·Export |
| 3-2 | 사용자 스타일의 CSS 변수(`--vs-`) 생성 | **보류(Q3) — 착수 불가** | 재개 조건: 별도 결정. 이후 2-2 완료, G3의 CSS 인코딩·namespace·scope 확정 | G3의 생성·재로드 fixture | Export 구성(`styles/` 추가 여부)·README 통합 안내 |
| 보류 | disabled·다른 상태·상태의 크기/배치/글자 변경(Q6), 아이콘 라이브러리·spacing 토큰·사용자 테마 | 보류 | 폼 바인딩 epic 판단 등 | — | — |

## 6. 결정 기록

**승인 근거.**

1. **2026-10-10 제품 방향 확인** — 사용자 @Yumesa2025가 [#360 본문](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/360)
   "2026-10-10 제품 방향 확인"의 네 가지를 승인했다. (1) 공용 스타일이 연결된 요소의 값을 직접 수정하면 그 연결을
   해제하고 수정한다. (2) 독립 앱 출력은 외형을 보존하면서 스타일 연결을 제거한다. docs/24의 action/ref와 프로젝트
   문맥 요구는 별도이며 제거하거나 우회하지 않는다. (3) 첫 버전은 색·글자 스타일과 button/input의 hover·pressed·focus에
   집중한다. (4) 추가 폰트와 CSS 변수 출력은 후순위로 둔다.
2. **2026-10-13 리더 결정** — 팀 리더 @Yumesa2025가 #360 본문 "2026-10-10 검토 제안"의 **Q1~Q7 권고와 G1~G6
   닫기 기준을 그대로 채택**했다([#360 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/360#issuecomment-6142841712)).
   이 기록이 #360 완료 조건의 "사용자 확인과 팀 승인 근거"다.

**승인 범위.** 채택된 것은 아래 Q1~Q7 결론과 G1~G6 게이트 기준이다. 다음은 이 결정에 포함되지 않는다.

- 각 단계의 스키마·Command·Ticket 계약 PR 승인([06](06-schema-freeze.md)·[09](09-command-schema-freeze.md)·[11](11-ticket-schema-freeze.md) 절차)과 기능 구현 PR.
- 보류 단계(3-1 추가 폰트, 3-2 CSS 변수)와 Q6의 보류 상태·속성의 재개.
- 1단계 GUI 보조(1-2~1-4)와 3.3의 자산 목록 등 Q·G 결정 범위 밖 제안.
- 다른 담당자의 진행 중 설계(#265 D8 팀 설계, #285 후속 구현, #280 실측 도구 확장).

| ID | 질문 | 결론 | 이유 | 상태 |
|---|---|---|---|---|
| Q1 | 사용자 스타일의 정본을 "노드 리터럴 값 사본 + 연결 정보"로 둘 것인가, 참조(값 없음)로 둘 것인가 | 노드 리터럴 사본 + 스타일 연결. 카탈로그/사본 정합성과 원자 편집을 선행한다 | 캔버스·미리보기·스킬·Ticket·반응형이 리터럴을 읽어 기존 렌더러·Ticket과 호환된다(3.1) | 채택 |
| Q2 | 색 스타일과 글자 스타일을 한 스키마로 다룰 것인가 | 색과 `Typography` 6필드 묶음을 같은 스키마 설계(2-1)로 다루고, UI 구현은 분리한다 | 같은 저장 위치·같은 일괄 적용 장치를 쓴다. UI는 나눠서 진행할 수 있다 | 채택 |
| Q3 | 생성 코드가 사용자 스타일을 CSS 변수로 낼 것인가, 리터럴만 낼 것인가 | 초기 생성은 리터럴 유지. CSS 변수는 후속 단계 | Export 구성 변경과 G3 CSS 인코딩·scope 설계가 필요하다(방향 4) | 채택 — CSS 변수 단계(3-2)는 **보류** |
| Q4 | 반응형 override·instance override가 스타일 연결을 가질 수 있는가 | 초기에는 리터럴만 허용하고 기본 스타일 연결은 유지한다 | override 연결은 합성·해제 규칙을 늘린다. #265 D8의 리터럴 override와 맞는다 | 채택 |
| Q5 | 프로젝트 폰트 추가와 공급원·허용 형식·라이선스 안내 | 수요 확인 전 보류. 채택 시 첫 공급은 작업공간 `woff2` 파일 + 검증·Export 동봉·라이선스 안내. 원격 CSS URL은 별도 결정 | #280 계약을 유지하며, 공급하려면 Ticket snapshot·경로 검증(G4·G5)이 먼저 필요하다(방향 4) | 채택 — 추가 폰트(3-1)는 **보류** |
| Q6 | 상태 스타일의 대상·상태 집합과 바꿀 수 있는 속성 | button/input × hover·pressed·focus, 배경·글자색·테두리 색부터. 초기 상태 배경은 solid 한 겹. 레이아웃/크기/타이포 변경과 다른 상태(disabled 등)는 보류 | 상태 전환 때 배치가 흔들리지 않고 #265 button action과 같은 대상부터 맞춘다(방향 3) | 채택 |
| Q7 | 색·글자 스타일과 상태를 0.3 선택 확장으로 낼 것인가, 0.4로 낼 것인가 | #265 S1-1 이후 선택 확장 여부와 0.4 경계를 #265 계약과 함께 확정한다. 번호를 선점하지 않는다 | 새 도구의 기존 문서 읽기만 호환이며 구 validator는 새 필드를 거부한다(24 §5) | 채택 — 버전은 2-1·2-3 착수 전 판단 |

Q 결론만으로 구현을 시작하지 않는다. 해당 단계의 아래 게이트 기준을 충족해야 그 단계를 병합한다.

| 게이트 | 채택한 닫기 기준(요약) | 적용 단계 | 상태 |
|---|---|---|---|
| G1 | 일반 직접 편집은 관련 연결 해제 + 값 변경을 Undo 한 번으로. Typography 일부 수정도 전체 연결 해제하되 다른 값 유지. 명시적 공용 스타일 편집만 전체 연결 갱신. GUI/NL/붙여넣기에 후보 ProjectSpec 검증과 실패 시 무변경. 색 겹/stop 재정렬은 연결 해제 또는 안정 ID 정책을 스키마 전에 확정 | 2-0·2-1·2-2 | 기준 채택 · 미충족(겹/stop 정책은 2-1 전 결정) |
| G2 | 검증된 복사본에 리터럴을 물질화한 뒤 스타일 연결만 제거, 원본/history 보존. 재가져오기 시 연결 손실 안내. 누락 카탈로그/불일치는 실패. action/ref 제거가 아니며 관계가 남은 standalone은 24의 프로젝트 문맥 요구 유지 | 2-2 | 기준 채택 · 미충족 |
| G3 | 표시 이름과 안정 ID 분리, rename 시 ID 유지, import/copy 충돌과 참조 갱신 검증. CSS 변수 인코딩·namespace·scope는 해당 단계 전 별도 확정 | 2-1·2-2(ID), 3-2(CSS) | ID 부분 기준 채택 · 미충족. CSS 부분은 **보류(Q3)** |
| G4 | 추가 폰트 채택 시 family/weight·공급원·파일 매핑·byte hash snapshot, 요청 후 변경 시 stale, Export byte 일치. 요청별 staging/수용 보존, 차기 규약은 #265/#281과 공동 결정 | 3-1 | 기준 채택 · **보류(Q5) — 착수 불가** |
| G5 | `woff2` 경로·루트 탈출·symlink·형식·크기·누락 및 CSS/HTML 직렬화 검증. 로딩 실패 fallback과 #280 측정 무효 구분. 공급 미해결 생성 차단. 라이선스 안내를 재배포 허가로 간주하지 않음 | 3-1 | 기준 채택 · **보류(Q5) — 착수 불가** |
| G6 | 상태 배경은 전체 Background 교체로 base image/gradient 잔여 제거. 테두리는 기존 stroke/shadow 합성 규칙 유지. 속성별 pressed > focus > hover > base, focus-visible 표시 보존. 8개 동시 상태 조합·반응형 base·상태 해제·키보드 focus 회귀 검증 | 2-3·2-4 | 기준 채택 · 미충족 |

"기준 채택"은 게이트의 닫기 기준을 정했다는 뜻이며 게이트를 통과했다는 뜻이 아니다. 각 게이트는 적용
단계의 PR이 기준을 충족하고 해당 계약 절차의 승인을 받을 때 닫힌다. 문서 병합과 CI 성공은 그 승인을 대신하지 않는다.

## 7. 이 문서의 검증

- 최초 초안(2026-10-10 작성 기록)은 develop `42e622a`와 당시 미병합 #350·#339 브랜치를 대조했다. 후속 리뷰에서
  develop `0733ae1`을 일반 merge로 통합하고 #350의 폰트 공급·#349의 Ticket protocol 2 계약을
  다시 대조해 현재 상태 설명을 갱신했다. #356의 project-dialogs 수정도 통합된 develop 그대로 보존했다.
  develop 대비 PR #354의 차이는 README·02·27·open-questions 네 Markdown 파일뿐이었다.
- 2026-10-13 결정 반영(#360)은 develop `694f2d6`에서 24·25·26·21과 #265 D10/D11 리더 결정 댓글, 정본 코드
  (`TICKET_PROTOCOL_VERSION` 3, 정본 `ImageNode`에 `alt` 없음, 생성 스킬에 focus 보존 규칙 없음)를 대조했다(4.1).
  G4의 "현재 Ticket protocol 2" 서술은 #281 이후 v3이 된 사실에 맞춰 고쳤다. 기능 실행·브라우저·실제 AI 검증은 하지 않았다.
- 브라우저 실측은 2절의 `system-ui` 따옴표 비교 한 건뿐이다(Playwright MCP, Chromium 154, Windows, about:blank에
  세 문단을 넣고 CDP로 렌더 폰트 확인). 제안한 기능의 fixture·브라우저·실제 AI 검증은 하지 않았다.

### PR #354 리뷰 당시 CI 실패 근거 (구현 지원 검증과 별개)

원 리뷰 SHA `30a03f1f0e2deffe82158aab2d323fed2f68ca1b`에 연결된
[CI 37982334113](https://github.com/visual-spec-labs/Visual-Spec-Builder/actions/runs/37982334113)은 실패했다.
로그의 checkout은 PR head 자체가 아니라 base `130f6b5`와 합성한 merge commit `308f7da`다.
이 결과는 해당 head의 PR CI이며 다른 SHA의 성공으로 대체하지 않는다.

- [Windows / Node 24 로그](https://github.com/visual-spec-labs/Visual-Spec-Builder/actions/runs/37982334113/job/113995691058):
  `test/cli-skills.test.ts`의 “스킬 7종을 .claude/skills/ 아래 설치한다”가 **5000ms timeout**.
  114 파일/1847 테스트는 통과, 1 파일/1 테스트 실패, 4 파일/8 테스트 skip. build·드리프트는 미실행.
  테스트는 CLI 스킬/로컬 계약 설치·사본 비교이며 이번 PR의 네 Markdown 파일은 그 복사 입력에 없다
  (`bin/visual-spec.mjs`의 `CONTRACT_FILES`·`skillSources` 대조). 문서 내용의 assertion 실패가 아니다.
- [Chromium 로그](https://github.com/visual-spec-labs/Visual-Spec-Builder/actions/runs/37982334113/job/113995691350):
  브라우저 fixture 3개, export-journey·project-dialogs·document-transitions 통과.
  unnamed-drafts에서 동시 Resume의 승자 탭을 닫고 패자 탭으로 재개한 뒤
  `scripts/browser/unnamed-drafts.mjs:193:64`의 `File` 버튼 표시 대기가 **30000ms timeout**.
  save-status는 앞선 실패로 미실행. project-dialogs 결함을 다루는 별도 PR #356과 이 실패 위치는 다르다.
- Linux Node 20.19.0/22.12.0/24는 성공했지만 필수 `build` 집계는 실패다. 변경 목록은 문서뿐이고
  실패한 실행 코드·테스트는 기존 코드다. 다만 로그만으로 Windows 지연의 근본 원인이나 초안 소유권 이전의
  제품/테스트 경합을 확정할 수 없으므로 “간헐 실패라 통과”로 처리하지 않는다. 별도 조사 대상으로 보고한다.

## 변경 이력

- **2026-10-10, PR #354(#290)** — 이 문서와 [README](../README.md) 목차 한 행을 더했다. [02](02-mvp-scope.md)의
  "MVP 제외 범위"에 사용자 화면의 공용 스타일·폰트 추가·아이콘 라이브러리 행을 더하고 상태 스타일 행에 이 문서를
  연결했다(정정 이력 포함). [open-questions](open-questions.md)에 6절 승인 대기 질문으로 가는 항목을 더했다.
- **2026-10-13, #360** — 리더 결정과 2026-10-10 제품 방향 네 가지를 반영했다. 머리 상태, 결정 요약, 3절 지원 수준과
  G1~G6 채택 표시, 4절 연결 표와 4.1 정합성 확인, 5절 단계별 상태·선행·완료 조건, 6절 결정 기록을 고쳤다.
  [02](02-mvp-scope.md)의 제외 범위 두 행을 결정에 맞추고(정정 이력 포함), [open-questions](open-questions.md)의
  디자인 시스템 절을 "해결된 항목" 표로 옮겼다. [README](../README.md) 목차의 이 문서 행 끝 문구를 고쳤다.
