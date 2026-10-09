# 사용자 화면의 공용 스타일·폰트·상태 지원 범위 (#290)

상태: **Draft · 제안. 사용자 확인과 최소 1명 팀 승인 대기** (2026-10-10).
이 문서는 사용자가 만든 화면의 디자인 시스템을 **어디까지 지원할지**와 **후속 구현 순서**를 제안한다.
정본 스키마·Command·Ticket·코드 생성 스킬·GUI 코드는 바꾸지 않는다. 문서의 병합만으로 아래 제안의
채택이나 영구 제외를 확정하지 않는다.
최신 소스 대조 기준: develop `42e622a67cc25ce89e9fe9428c86bb15321103f5`,
[#290](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/290) 본문(2026-10-10 확인).

이번 PR이 바꾸는 것은 이 문서, [README](../README.md) 목차, [02](02-mvp-scope.md)의 제외 범위 한 행(정정
이력 포함), [open-questions](open-questions.md)의 승인 대기 질문 연결뿐이다(맨 아래 "이번 PR에서 바꾼 것").

## 결정 요약 — 제안과 승인 대기 구분

사용자 화면의 스타일은 **지금처럼 노드마다 리터럴 값을 저장하는 것을 정본으로 유지**한다. 그 위에
스키마 영향이 없는 GUI 보조(문서 색 모음·자산 목록)와 생성 규칙 보강(기본 focus 표시 보존)을 먼저
하고, 이름 있는 색·글자 스타일, 프로젝트 폰트 목록, 버튼·입력의 상태 스타일은 **각각 별도 스키마 PR과
팀 승인**을 거쳐 순서대로 검토한다. spacing 토큰과 아이콘 라이브러리는 이번 범위에서 만들지 않는다.

| 항목 | 제안 지원 수준 | 스키마 영향 |
|---|---|---|
| 색 스타일 | 1단계 문서 색 모음(파생) → 2단계 이름 있는 색 스타일(값 사본 + 연결) | 2단계만. 별도 스키마 PR |
| 글자(type) 스타일 | 2단계 이름 있는 글자 스타일(`Typography` 6필드 한 묶음) | 별도 스키마 PR |
| spacing | 이름 있는 토큰을 두지 않는다. 필요하면 GUI 간격 단계 제안만 | 없음 |
| 폰트 | Pretendard 하나(#280 계약) 유지 → 후속 프로젝트 폰트 목록 | 후속만. 별도 스키마 PR |
| 아이콘 | SVG를 이미지로 Import(이미 가능). 아이콘 노드·라이브러리는 만들지 않음 | 없음 |
| 이미지 | 자산 목록·재사용·미사용 표시(GUI). alt는 #285 제안 | 없음(alt는 #285 스키마 PR) |
| 요소 상태 | 1단계 기본 focus 표시 보존 규칙 → 2단계 button/input의 hover·pressed·focus 제한 스타일. disabled는 보류 | 2단계만. 별도 스키마 PR |
| 공용 컴포넌트 | #265(D8/D9, instance·0.4)에 맡긴다. 여기서 설계하지 않는다 | #265 소관 |

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

**경계 규칙(현재 사실 + 이 문서의 제안).**

1. **현재 사실** — DESIGN-TOKEN-RULES의 "예외 — 스펙에서 계산된 치수"가 이미 경계를 정한다. 노드의
   `box`·색·`page.size`처럼 **사용자 문서가 정하는 값은 토큰이 아니라 인라인 스타일**로 캔버스에 그린다
   (`ui/nodeStyles.ts`의 `textStyle`·`buttonStyle`이 `node.color`·`typography.*`를 그대로 넣는다).
2. **현재 사실** — 코드 생성은 사용자 값을 Tailwind 임의 값 클래스로 옮긴다(`bg-[#..]`, `text-[Npx]`,
   `gap-[Npx]`, `[font-family:'값']` — 스킬 "매핑 참고표"). 앱 토큰 이름(`bg-surface`, `--color-primary`)을
   쓰지 않는다. Export ZIP에는 `styles/`가 없다(`export/bundle.ts` 머리 주석, [02](02-mvp-scope.md) 결과 예시).
3. **제안** — 앞으로 사용자 스타일(아래 2절)을 도입해도 **앱 토큰 파일에 넣지 않고**, 앱 토큰을 사용자
   스펙이나 생성 코드에서 참조하지 않는다. 사용자 스타일은 스펙 JSON이 유일한 저장 위치다.
4. **제안** — 사용자 스타일을 CSS 변수로 생성하게 되면 사용자 앱의 기존 테마(`--color-primary` 등)와
   구분하기 위해 `--vs-` 접두어를 후보로 둔다. **접두어만으로 식별자 유효성·충돌·안전성이 보장되지는 않는다.**
   표시 이름과 안정 ID 분리·중복 검사·출력 범위는 3.1의 G3에서 먼저 결정한다(승인 대기 Q3).
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
| 폰트 공급 | develop의 `src/styles/fonts.css`는 아직 **variable** 배포 URL이다. [PR #350](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/350)(#280, 미병합)이 GUI와 생성 셸을 **static** dynamic-subset URL로 맞춘다 — variable CSS의 family는 `Pretendard Variable`이라 `"Pretendard"` 텍스트가 OS 폴백으로 그려졌다(PR #350의 docs/25 §1 폰트, §4.2 실측) | `src/styles/fonts.css`, 스킬 "페이지 viewport와 브라우저 기본 스타일" 셸 |
| 새 노드의 글꼴 | 삽입·시드가 `fontFamily: "Pretendard"`로 만든다. 저작·자연어 스킬도 `"Pretendard"`로 통일한다 | `store/createNode.ts`, `store/seedSpec.ts`, `skills/visual-spec-authoring/SKILL.md` |
| 이미지 | File ▸ Import·배경 이미지 선택은 이미지 디코딩·크기 측정에 성공하면 `.visual-spec/assets/`에 UUID를 붙인 이름으로 저장을 시도한다. 작업공간 목록 조회 불가·허용 확장자 밖·UUID 생성 불가·쓰기 실패 시 파일 읽기가 성공하면 data URI를 스펙에 넣는다. 디코딩 또는 fallback 읽기까지 실패하면 가져오지 않는다. 허용 확장자에 `.svg`가 있다. 이미 있는 자산을 고르는 목록 UI는 없고 경로를 직접 적어야 재사용된다. 미사용 자산 정리는 없다 | `ui/importImageFromFile.ts`, `features/workspace/protocol.ts`(`WORKSPACE_DIR_RULES.assets`), `ui/properties/ContentSection.tsx`·`ImageFillFields.tsx`의 "경로 (src)" 칸 |
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

## 3. 항목별 지원 범위 제안 (완료 조건 1)

표의 "저장 위치"와 "코드 생성 경계"는 채택될 때의 제안이다. 스키마 영향이 있는 단계는 모두
[06 변경 규칙](06-schema-freeze.md#변경-규칙)대로 **기능과 분리한 별도 스키마 PR, 최소 1명 팀 승인,
`pnpm run generate:types`와 예제·테스트 갱신**을 거친다. Command 편집 경로가 늘면
[09](09-command-schema-freeze.md)의 공개 계약 리뷰도 함께 받는다.

### 3.1 색·글자·간격 스타일

| 항목 | 지원 수준(제안) | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| 문서 색 모음 | **1단계.** ColorField 옆에 이 프로젝트에서 이미 쓴 색을 사용 빈도순으로 보여 주고 고르면 그 값을 쓴다 | 저장하지 않는다. 열린 `ProjectSpec`의 노드·배경·테두리·그림자 색에서 매번 파생 | 바뀌지 않는다(리터럴 그대로) | 선행 없음. 스키마·Command 영향 없음 |
| 이름 있는 색 스타일 | **2단계.** 프로젝트에 `primary` 같은 이름 있는 색을 정의하고 노드 속성을 그 스타일에 연결한다. 스타일 값을 바꾸면 연결된 모든 속성을 한 번에 바꾼다(Undo 한 단계) | `ProjectSpec`의 선택 필드(예: `styles.colors`)와 노드의 연결 정보. **노드의 리터럴 값은 계속 정본 사본으로 남긴다**(아래 "값 사본 + 연결" 근거) | 2단계는 지금처럼 리터럴 임의 값 클래스. CSS 변수 생성은 3단계(승인 대기 Q3) | 팀 승인 → 별도 스키마 PR → 프로젝트 단위 원자 적용(#265 S1-2의 프로젝트 후보 검증과 같은 장치를 재사용) → GUI |
| 이름 있는 글자 스타일 | **2단계.** `Typography` 6필드 한 묶음을 이름으로 정의(제목·본문 등). 색은 포함하지 않는다(색 스타일과 따로 연결) | 색 스타일과 같은 위치(예: `styles.text`) | 리터럴 `text-[Npx]`·`leading-[Npx]` 등 그대로 | 색 스타일과 같은 스키마 PR로 묶을지는 Q2 |
| spacing | **이름 있는 토큰을 두지 않는다.** 필요해지면 간격 칸에 4px 단위 단계 제안(GUI)만 둔다 | 저장하지 않는다 | `gap-[Npx]`·`p*-[Npx]` 그대로 | 선행 없음. 수요가 확인될 때 GUI 이슈로 |

**값 사본 + 연결을 제안하는 근거.**

- 캔버스(`ui/nodeStyles.ts`)·홈 미리보기(`ui/homePreview.ts`)·코드 생성 스킬·Ticket 구조 비교
  (`ticket/compileTickets.ts`의 `structuralKey`가 `color`·`typography`를 비교)·반응형 override(`ScreenSpec.responsive`)가 모두 **노드의 리터럴 값**을 읽는다.
  노드 값을 참조(예: `{"$style":"primary"}`)로 바꾸면 이 소비자 전부가 해석기를 거쳐야 하고 `Color` 타입이
  문자열이 아니게 되어 0.4급 변경이 된다. 값을 남기면 연결 정보를 모르는 소비자도 같은 모양을 그린다.
- 대신 "스타일 값과 노드 사본이 어긋난 상태"를 막아야 한다. 스타일 변경·연결·해제는 프로젝트 전체 후보를
  검증한 뒤 한 번에 커밋하고, 검증기가 연결된 속성의 사본이 스타일 값과 같은지 검사하는 안을 제안한다.
  이는 #265 D5가 제안한 "프로젝트 후보 검증 → 단일 history 커밋"과 같은 요구라, 그 장치(S1-2)가 먼저
  있으면 재사용할 수 있다.
- 반응형 override와 #265 D8의 instance `color` override는 **리터럴로 남기고 연결하지 않는** 안을 1차로
  제안한다. override가 연결된 속성을 덮으면 그 폭/인스턴스에서는 스타일과 별개 값이 된다(Q4).

#### 스타일 구현 전 설계 게이트 (G1~G3, 모두 제안·승인 대기)

**G1 — 연결된 값의 직접 GUI/NL 편집(Q1·Q2·Q4).** 기존 `useNodeField` → `setNodeField`와
NL `updateNode`는 리터럴 편집 경로이므로, 스타일 변경·연결·해제만 원자화해서는 충분하지 않다.

| 대안 | 추천·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| A. 직접 편집은 해당 연결을 해제하고 값 변경 | **기본 추천.** 한 노드만 바꾸려는 기존 GUI/NL 의도를 보존한다. 연결 해제 + 리터럴 변경 + 프로젝트 후보 검증을 Undo 한 단계로 커밋 | GUI·NL·붙여넣기/배열 교체 등 모든 쓰기 경로에 동일 정책 적용. 실패 시 연결·값·history 모두 이전 상태, Undo/Redo로 함께 복원 |
| B. 직접 편집이 공유 스타일을 갱신 | 사용자가 별도의 “공용 스타일 수정”을 명시한 경우에만 추천. 모든 연결 사본과 카탈로그를 원자 갱신 | 일반 `updateNode`를 전역 변경으로 해석하지 않는다. 명시 연산·영향 범위 안내·Command 공개 계약을 승인받는다 |
| C. 연결 상태에서는 직접 편집 거부 | 명시적 unlink를 먼저 요구하는 UX를 선택할 때. 자동 해제가 싫은 팀의 대안 | 기존 필드/NL이 이유와 해제 방법을 안내해야 하며 단순 검증 오류로 끝내지 않는다 |

추천 A에서 `Typography`의 `fontFamily`·`fontSize`·`fontWeight`·`lineHeight`·`letterSpacing`·
`textAlign` 중 **하나를 편집해도 글자 스타일 연결 전체를 해제**한다. 나머지 다섯 리터럴은 유지한다.
B에서는 변경 필드를 기존 여섯 필드에 합성한 완전한 묶음을 모든 연결 노드에 전파한다. 색 연결은 별개다.
부분 필드만 연결 유지하는 모델은 이번 추천에 없다. 반응형/instance override는 Q4대로 리터럴이며
기본 스타일 연결을 해제하지 않는다. 배열 전체 교체로 연결 대상 겹/stop이 사라지거나 순서가 바뀌는 경우,
안정된 대상 ID를 도입할지 영향받는 연결을 함께 해제할지도 **색 연결 스키마 전에** 정한다.

**G2 — 카탈로그 없는 standalone VisualSpec(Q1·Q7).** 현재
[`toVisualSpec(page)`](../src/features/editor/schema/migrate.ts)는 `ScreenSpec`만 받는다.
프로젝트 카탈로그를 참조하는 연결을 그대로 내보내면 해석할 수 없고, 무조건 지우면 재편집 연결이 사라진다.

| 대안 | 추천·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| A. project context로 해석·검증한 복사본을 리터럴로 물질화하고 연결 해제 | **기본 추천.** 독립 화면 전달은 외형 보존을 우선하고, 연결 보존은 ProjectSpec 파일로 한다 | standalone 출력에 모든 연결 메타데이터가 없어야 한다. 원 프로젝트·history는 불변. 재가져오기는 연결 없는 화면이며 손실을 안내 |
| B. VisualSpec에 필요한 카탈로그를 함께 저장 | 독립 화면을 다시 가져와도 연결을 보존해야 할 때 | VisualSpec 스키마·validator·migration·ID 충돌/재병합 정책까지 확장하고 승인받는다 |
| C. 변환 API가 project context를 필수로 받음 | A의 안전한 변환 경계로 추천. **context만 넘기고 출력에 외부 연결을 남기는 것은 해결이 아니다** | 모든 호출부를 조사하고 A/B 출력 모델과 함께 결정. context 없는 linked page는 오류로 차단, 기존 unlinked page 경로는 유지 |

A+C 채택 시 누락된 카탈로그/ID·불일치 사본은 추측 복구하지 않고 변환을 실패시킨다. base와 responsive
리터럴을 보존하는 round-trip 예제, 카탈로그 없는 linked 입력 거부 예제, 원본 무변경 검증이 필요하다.
현재 Ticket 스킬도 page를 VisualSpec으로 감싸 검증하므로, 이 경로 역시 연결 해제 snapshot 또는
카탈로그 전달 중 선택한 정책을 따라야 한다(G4). 폰트 family 문자열 물질화만으로 폰트 파일이 따라오지는 않는다. 프로젝트 폰트가 쓰인 standalone 화면의
공급원 동봉/별도 manifest/명시적 지원 거부도 G4와 함께 결정해야 한다.

**G3 — CSS 변수 ID·직렬화(Q3).** 대안은 (A) 표시 이름과 별도의 불변 ID를 저장하거나,
(B) 표시 이름을 CSS escape하고 충돌 해소 표를 유지하거나, (C) 리터럴 생성을 유지하는 것이다.
**2단계는 C, 변수 생성 채택 시 A를 추천**한다. 예를 들어 프로젝트 namespace와 스타일 ID를 각각
`[a-z][a-z0-9-]*`로 제한하고 길이 상한·프로젝트 내 유일성을 검증한다. 이름 변경은 ID를 바꾸지 않는다.
구분자 연결도 모호할 수 있으므로 CSS 이름은 타입/길이를 포함한 충돌 없는 인코딩(또는 충돌 검사된
할당 표)으로 만든다. 정규화해 같은 이름이 된 스타일을 조용히 합치지 않는다. 복사·프로젝트 import 때의
ID 재발급과 참조 갱신, 여러 프로젝트/호스트 앱 CSS와의 충돌 검사·컨테이너 scope를 먼저 설계한다.
접두어는 namespace 후보일 뿐이다. 식별자 검증과 별개로 색·글자 값도 허용 타입·범위를 검사하고
CSS 문자열/URL/선언은 문맥별 직렬화한다. 이름을 raw CSS·클래스·`<style>`에 보간하지 않는다.
공백·한글·문장부호 이름, 중복 ID, 동일 slug, rename, 다중 프로젝트를 생성·재로드 fixture로 검증한다.

### 3.2 폰트 선택·공급

| 항목 | 지원 수준(제안) | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| 기본 폰트 | **Pretendard 하나를 공식 지원**한다. 사용자 화면·GUI·생성 셸이 같은 static dynamic-subset URL을 쓴다(#280 계약) | `typography.fontFamily: "Pretendard"`(현재 그대로) | 생성 셸의 `@import` URL을 바꾸지 않는다(PR #350이 스킬에 명시) | **선행: PR #350 병합.** develop은 아직 variable URL이라 폰트 일치가 깨져 있다 |
| `system-ui` 선택지 | 유지하되 "시스템 글꼴 — 기기마다 모양이 다르고 GUI와 생성 앱의 줄바꿈이 다를 수 있다"는 범위로 안내한다. #280 실측 대상에 넣지 않는다 | 현재 그대로 | generic 키워드는 따옴표 없이 생성하도록 스킬에 명시할지 검토(2절 위험) | 1단계 문서·스킬 정리. 스키마 영향 없음 |
| 굵기 | 스키마 100~900 중 GUI는 400~700만 노출. Pretendard static은 아홉 굵기를 제공하므로 GUI 선택지 확장은 별도 GUI 이슈로 둔다 | 현재 그대로 | `font-thin`~`font-black` 매핑 그대로 | 선행 없음 |
| 프로젝트 폰트 추가 | **후속(승인 대기 Q5).** 프로젝트가 쓸 폰트를 목록으로 선언하고, 각 폰트의 공급원(고정 CSS URL 또는 작업공간 폰트 파일)을 함께 저장한다. GUI는 목록의 폰트만 선택지로 보이고 불러온다 | `ProjectSpec`의 선택 필드(예: `fonts[]`). 파일 공급이면 작업공간에 폰트 디렉터리 또는 `assets/`의 허용 확장자 추가가 필요(`WORKSPACE_DIR_RULES` 변경) | 생성 셸이 Pretendard `@import`를 **대체하지 않고 추가로** 선언된 폰트의 `@import`/`@font-face`를 넣는다. 파일 공급이면 Export에 폰트 파일을 포함한다 | #350 병합 → #280 실측 도구가 Pretendard 외 family를 허용하도록 확장 → 별도 스키마 PR → GUI·스킬·Export |

**#280 계약과 충돌하지 않게 하는 조건.** 폰트 추가는 Pretendard URL을 바꾸거나 fallback 목록을 노드
스타일에 붙이지 않는다(PR #350 docs/25: "노드 스타일은 스펙의 family 하나만 쓰고 별도 fallback 목록을
붙이지 않는다"). 웹폰트를 받지 못한 실측은 "측정 무효"로 보는 같은 판정을 새 폰트에도 적용한다.
폰트 라이선스(재배포 가능 여부)는 앱이 판정하지 않으므로, 파일 공급을 채택하면 사용자 책임 안내와
허용 형식(예: `woff2`만)을 함께 정해야 한다(Q5).

#### 폰트 구현 전 설계 게이트 (G4~G5, 모두 제안·승인 대기 Q5·Q7)

**G4 — Ticket/스킬까지 공급원 전달.** 현재
[`TicketRequest`](../src/features/editor/ticket/ticketProtocol.ts)의 `page: ScreenSpec`에는
`ProjectSpec.fonts[]`가 없다. 디스크의 프로젝트를 다시 읽는 방식은 미저장 문서·요청 이후 편집을 재현하지 못한다.

| 대안 | 추천·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| A. TicketRequest에 검증된 폰트 공급원 snapshot 추가 | **추천.** 요청 당시 page(반응형 override 포함)가 사용하는 family/weight와 공급원·자산 매핑을 함께 고정 | protocol 버전/구버전 거부·호환성, 요청 writer/reader/validator, ticket-response·to-react 스킬 및 로컬 계약을 함께 변경하는 별도 PR |
| B. page에 필요한 폰트 메타데이터 포함 | standalone 화면의 자급성을 우선할 때 | ScreenSpec/VisualSpec 중복 카탈로그의 정본·동기화·충돌 규칙을 스키마 PR에서 정의 |
| C. 프로젝트 전체 snapshot 전달 | 향후 여러 프로젝트 자원이 필요할 때 | payload 크기와 불필요 데이터 전달을 평가. 디스크 경로만 전달하는 방식은 대안이 아님 |

A에서는 family·weight·공급원(URL 또는 상대 파일)·파일 Export 매핑을 요청 생성 시 검증하고 미해결 폰트는
생성을 차단한다. 스킬이 파일명/URL을 추측하거나 임의 다운로드하지 않도록 계약에 적는다.
동일 family의 다른 공급원, 미저장 프로젝트, 요청 뒤 폰트 변경, standalone의 공급원 누락,
웨이브 간 snapshot 변경으로 기존 결과가 낡는 경우의 무효화 정책까지 결정한다. 파일 byte 변경도
고정할지 hash로 탐지·거부할지 정하고, Export가 검증한 byte와 실제 포함한 byte의 일치를 확인한다.
이는 [11](11-ticket-schema-freeze.md)과 ticket 파일 프로토콜의 별도 변경 검토이며 현재 지원 주장이 아니다.

**G5 — URL/경로 검증·CSS 직렬화·원격 로딩 정책.** 파일만 허용(A), 승인된 HTTPS CSS URL만 허용(B),
둘 다 허용(C)이 대안이다. **초기에는 검증된 작업공간 `woff2` 파일(A)을 추천**한다. B/C는 사용자가
공급자를 선택하고 GUI와 생성 앱의 외부 요청·추적 가능성·오프라인 실패를 이해하는 로딩 정책을 정한 뒤 적용한다.

- URL: URL parser로 scheme·credentials·host·redirect 후 주소를 검증한다. HTTPS 허용 목록과
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

| 항목 | 지원 수준(제안) | 저장 위치 | 코드 생성 경계 | 후속 순서와 선행 |
|---|---|---|---|---|
| focus 표시 | **1단계.** 생성 코드가 브라우저 기본 focus 표시를 지우지 않는다는 규칙을 스킬에 명시하고 키보드 탐색으로 검증한다([21](21-app-scope-a11y-design.md) 후속 3과 같은 작업) | 없음 | `outline-none`·`focus:outline-0` 등을 생성하지 않는다 | 선행 없음. #285 후속 3과 한 작업으로 진행 |
| hover·pressed·focus 스타일 | **2단계(승인 대기 Q6).** button·input에만 상태별 **제한된 부분 스타일**을 둔다 — 배경, 글자색, 테두리 색. 크기·배치·글자 스타일은 상태로 바꾸지 않는다(상태 전환 때 배치가 흔들리지 않게) | 노드의 선택 필드(예: `states.hover`·`states.pressed`·`states.focus`, 각각 부분 객체). 반응형 override 대상에 넣지 않는다 | `hover:`·`active:`·`focus-visible:` 조건에 G6의 전체 배경 교체·테두리 합성·명시 우선순위를 적용한다. 기본 focus 표시는 1단계 규칙대로 유지하고 그 위에 더한다 | **선행: #265 S1(button action) 이후.** 상태는 누를 수 있는 요소의 피드백이라 action 계약과 같은 대상(button)부터 맞춘다. GUI는 패널의 상태 미리보기 전환 + 캔버스 미리보기 |
| disabled | **보류.** 정적 `disabled`만 두면 켤 방법이 없는 버튼이 된다. 조건·폼 바인딩 표현이 생긴 뒤 검토한다 | — | 만들지 않는다 | [21](21-app-scope-a11y-design.md) §3 폼 바인딩 epic 판단 이후 |
| 기타 상태(selected·error·loading 등) | 만들지 않는다. 데이터·검증 상태라 바인딩 없이 의미가 없다 | — | — | 폼·데이터 바인딩 이후 |

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

#### 상태 구현 전 설계 게이트 (G6, 제안·승인 대기 Q6)

| 쟁점 | 대안과 추천·적용 조건 | 구현 전 결정·검증 |
|---|---|---|
| 상태 배경 위로 base gradient/image가 남음 | A. 상태 배경을 전체 `Background` 교체로 취급(**추천**). B. base가 solid인 노드에서만 상태 배경 허용(초기 범위를 줄일 때). C. 겹 부분 수정은 겹 ID/병합 설계를 추가할 때만 | A의 초기 상태 입력은 solid 한 겹으로 제한하는 안을 추천. 상태 solid에는 `background-image: none`과 color를 함께 적용하고 size/position/repeat/origin/clip도 정해진 값으로 재계산·reset한다. 상태 종료 시 base 전체 스택 복원. color 클래스만 추가하면 불충분 |
| inside와 center/outside의 상태 테두리 색 | A. 유효 border를 렌더러와 같은 함수 규칙으로 재합성(**추천**). B. 상태 테두리는 inside만 허용(제약을 GUI/검증기에 명시할 때) | inside는 `border-color`, outside는 바깥 shadow 고리, center는 안팎 shadow 고리 둘 다 변경. width·radius·align·배치는 그대로, 존재하지 않는/폭 0 테두리는 새로 만들지 않음. 합성 box-shadow의 나머지 레이어와 focus outline 보존. `border-color`만 바꾸거나 box-shadow 전체를 날리지 않음 |
| hover·pressed·focus 동시 활성 | A. 속성별 `pressed > focus > hover > base`(**추천**). B. focus를 최우선으로(키보드 피드백 색을 항상 우선할 제품 요구가 있을 때). C. 조합별 명시 스타일(복잡도 허용 시) | 부분 스타일은 가장 높은 활성 상태가 **명시한 속성만** 덮는다. 예: pressed에 글자색만 있으면 focus 배경을 유지. 배경은 하나의 원자 속성, border 색은 합성 결과로 적용. focus 표시는 색 우선순위와 독립적으로 계속 유지 |

focus는 생성 시 `:focus-visible`, pressed는 누르는 동안의 `:active`이며 토글/selected와 다르다.
추천 우선순위는 HTML class 나열 순서나 Tailwind 기본 variant 순서에 맡기지 않고, 명시적 CSS 순서/
조합 selector 등 실제 생성 방식까지 승인받는다. GUI 미리보기도 단일 상태뿐 아니라 동시 상태를 표현해야 한다.
반응형이 base 배경/테두리를 바꾸면 먼저 해당 폭의 base를 확정하고 그 위에 같은 상태 규칙을 적용한다.
solid/gradient/image/mixed base, inside/center/outside, 8가지 활성 조합(없음 포함), 키보드/포인터와
상태 진입·해제의 computed style·focus 가시성·좌표 불변을 GUI와 생성 브라우저 fixture에서 검증한다.

## 4. #265·#285와의 연결 (완료 조건 3)

| 접점 | #265 / #285의 결정·제안 | 이 문서의 처리 |
|---|---|---|
| 공용 위젯 | #265 D8/D9: widget을 프로젝트 PageId로 공유, instance는 0.4 | 공용 컴포넌트를 여기서 설계하지 않는다. 색·글자 스타일은 프로젝트 단위라 위젯과 페이지가 같은 스타일을 함께 쓸 수 있다(위젯 원본 노드의 연결은 일반 노드와 같다) |
| instance override 색 | #265 D8: Text/Button의 `color` 리터럴 덮어쓰기 | 1차는 리터럴로 두고 스타일에 연결하지 않는다(Q4). 스타일 연결 override는 instance·스타일 둘 다 채택된 뒤 검토 |
| 버튼 동작과 상태 | #265 D3: 초기 action은 native `<button type="button">`에만 | 상태 스타일 2단계를 #265 S1 뒤로 두고 같은 button부터 시작한다 |
| 프로젝트 단위 원자 커밋 | #265 D5·§5: 프로젝트 후보 전체 검증 후 한 번에 커밋 | 스타일 값 변경(연결된 모든 속성 일괄 수정)이 같은 장치를 필요로 한다. #265 S1-2를 선행으로 둔다 |
| IR 버전 | #265: S1은 0.3 선택 확장, S2 instance는 0.4 | 색·글자 스타일과 상태는 0.3 선택 확장으로 제안하되, 정본 스키마를 동시에 고치는 충돌을 피하려고 **#265 S1-1 스키마 PR 병합 뒤**에 올린다. 0.4로 함께 올릴지는 Q7 |
| focus·접근성 | #285 후속 3: 기본 focus 표시 보존 규칙과 키보드 검증 | 상태 1단계로 같은 작업을 가리킨다(중복 이슈를 만들지 않는다) |
| 이미지 alt·입력 label | #285 후속 1: `ImageNode.alt`, `InputNode.inputType`·`label` | 아이콘(SVG 이미지)의 의미도 같은 alt를 따른다 |
| 폰트·배치 실측 | #280 / PR #350: Pretendard static URL, 측정 무효 판정 | 폰트 추가는 이 계약 위에 덧붙이는 방식만 허용(3.2) |

## 5. 후속 구현 순서

아래는 제안 순서이며 구현 약속이 아니다. 사용자 확인과 팀 승인으로 채택된 단계만 별도 이슈·PR로 연다.

| 순서 | 작업 | 선행 | 스키마·계약 영향 |
|---|---|---|---|
| 0 | PR #350(#280) 병합 — GUI·생성 셸 폰트 URL 일치 | — | 없음(이미 진행 중) |
| 1-1 | 기본 focus 표시 보존 규칙과 키보드 검증 | 없음(#285 후속 3과 한 작업) | 없음. 스킬 문서 |
| 1-2 | `system-ui` 범위 안내와 generic 키워드 생성 규칙 검토(다른 브라우저 실측 포함) | 0 | 없음. 스킬·GUI 안내 |
| 1-3 | 문서 색 모음(ColorField) | 없음 | 없음 |
| 1-4 | 이미지 자산 목록·재사용·미사용 표시 | 없음 | 없음 |
| 2-1 | 색·글자 스타일 **스키마 단독 PR** | 이 문서 및 G1~G3 결정 승인, #265 S1-1 병합, #265 S1-2(프로젝트 검증) | 정본·생성 타입·05/06·예제. 편집 경로가 늘면 09 리뷰 |
| 2-2 | G1 직접 편집 atomic unlink/update·Typography 묶음·G2 standalone 변환·스타일 패널·NL 안내 | 2-1 | 프로젝트 단위 편집이면 Command 버전 판단(#265 D10과 조율) |
| 2-3 | 상태 스타일 **스키마 단독 PR**(button/input hover·pressed·focus) | 1-1, #265 S1(action), G6 결정 승인 | 정본·05/06·09 |
| 2-4 | G6 전체 배경 교체·shadow 테두리·동시 상태 미리보기·생성 매핑 | 2-3 | 스킬 |
| 3-1 | 프로젝트 폰트 목록 스키마 PR·작업공간 폰트 공급 | 0, #280 실측 도구 확장, Q5 및 G4~G5 승인 | 정본·Ticket protocol/validator·로컬 계약·스킬·작업공간·Export |
| 3-2 | 사용자 스타일의 CSS 변수(`--vs-`) 생성 | 2-2, Q3 및 G3 승인 | Export 구성(`styles/` 추가 여부)·README 통합 안내 |
| 보류 | disabled·아이콘 라이브러리·spacing 토큰·사용자 테마 | 폼 바인딩 epic 판단 등 | — |

## 6. 승인 대기 질문

| ID | 질문 | 이 문서의 제안 | 결정 |
|---|---|---|---|
| Q1 | 사용자 스타일의 정본을 "노드 리터럴 값 사본 + 연결 정보"로 둘 것인가, 참조(값 없음)로 둘 것인가 | 값 사본 + 연결. 기존 소비자가 그대로 그리고 0.3 선택 확장이 가능하다 | 대기 |
| Q2 | 색 스타일과 글자 스타일을 한 스키마 PR로 묶을 것인가 | 묶는다. 같은 저장 위치·같은 일괄 적용 장치를 쓴다 | 대기 |
| Q3 | 생성 코드가 사용자 스타일을 CSS 변수로 낼 것인가, 리터럴만 낼 것인가 | 2단계는 리터럴만. CSS 변수는 Export 구성 변경이라 3단계에서 `--vs-` 접두어로 별도 결정 | 대기 |
| Q4 | 반응형 override·instance override가 스타일 연결을 가질 수 있는가 | 1차는 리터럴만(연결 없음) | 대기 |
| Q5 | 프로젝트 폰트를 지원한다면 공급원은 고정 CSS URL, 작업공간 폰트 파일, 둘 다 중 무엇인가. 파일이면 허용 형식과 라이선스 안내는 | 수요 확인 전까지 Pretendard 하나. 채택 시 `woff2` 파일 + 사용자 책임 안내를 우선 검토 | 대기 |
| Q6 | 상태 스타일의 대상·상태 집합(button/input × hover·pressed·focus)과 바꿀 수 있는 속성(배경·글자색·테두리 색)이 맞는가 | 표 3.4대로. disabled는 보류 | 대기 |
| Q7 | 색·글자 스타일과 상태를 0.3 선택 확장으로 낼 것인가, #265 instance와 함께 0.4로 낼 것인가 | 0.3 선택 확장(#265 S1-1 뒤). 0.4는 instance 전용으로 둔다 | 대기 |

Q1~Q7의 넓은 방향 합의만으로 구현을 시작하지 않는다. 해당 단계의 아래 세부 게이트도 결정해야 한다.

| 게이트 | 구현 전 결정 항목 | 연결 질문 | 결정 |
|---|---|---|---|
| G1 | 직접 GUI/NL 편집 A/B/C, Typography 전체 연결 단위, 배열 교체·override 원자성 | Q1·Q2·Q4 | 대기 |
| G2 | standalone 출력의 연결 손실 안내/카탈로그 보존, project context 없는 입력 처리, 폰트 공급원 | Q1·Q7 | 대기 |
| G3 | 안정 ID 문법·유일성·출력 매핑·scope·복사/병합 충돌·값 직렬화 | Q3 | 대기 |
| G4 | 폰트 snapshot 위치·Ticket protocol/스킬·구버전·결과 무효화·Export 파일 일치 | Q5·Q7 | 대기 |
| G5 | URL/경로/형식 검증·CSS/HTML 직렬화·원격 로딩·실패·오프라인 정책 | Q5 | 대기 |
| G6 | 상태 전체 배경 교체·inside/shadow 테두리·동시 우선순위·focus 보존 | Q6 | 대기 |

모든 추천은 검토용이며 사용자/팀이 승인했다는 기록이 아니다. #290도 문서 수정이나 CI 통과로 닫지 않는다.
질문의 결론과 승인자·근거(리뷰/PR 링크)는 합의가 생길 때 이 표에 기록한다. 일반 문서 리뷰와 CI 성공은
팀 설계 승인을 대신하지 않는다.

## 7. 이 문서의 검증

- "현재 상태" 주장은 develop `42e622a`의 파일을 직접 읽어 대조했다(2절 근거 열의 경로). PR #350·#339의
  내용은 각 브랜치(`origin/Yumesa2025/280-layout-contract`, `origin/Yumesa2025/265-s0-screen-relations-design`)에서
  읽었으며 develop에 병합되지 않은 상태로 인용했다.
- 브라우저 실측은 2절의 `system-ui` 따옴표 비교 한 건뿐이다(Playwright MCP, Chromium 154, Windows, about:blank에
  세 문단을 넣고 CDP로 렌더 폰트 확인). 제안한 기능의 fixture·브라우저·실제 AI 검증은 하지 않았다.

### 리뷰 당시 CI 실패 근거 (구현 지원 검증과 별개)

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

## 이번 PR에서 바꾼 것

- 이 문서와 [README](../README.md) 목차 한 행.
- [02](02-mvp-scope.md) — "MVP 제외 범위"에 사용자 화면의 공용 스타일·폰트 추가·아이콘 라이브러리 행을 더하고,
  상태 스타일 행에 이 문서를 연결했다(정정 이력 포함).
- [open-questions](open-questions.md) — 6절 승인 대기 질문으로 가는 항목.
