# 07. 구현 현황

> 확인 기준일: **2026-08-20** / 확인 대상 브랜치: `Yumesa2025/roadmap`
> 부분 갱신: **2026-08-25**(검증기 메시지 — 5.2) · **2026-08-28**(`develop` 1b3e82a 머지 후) · **2026-08-29**(`develop` db7f8f4 머지 후) · **2026-09-01**(`develop` a807bc4 머지 후) · **2026-09-01**(`develop` 1b73ccd 머지 후 — 같은 날 2차) · **2026-09-01**(`develop` 020be51 머지 후 — 같은 날 3차) · **2026-09-02**(이슈 #75, PR 작성 전 — `75--button-input-grid-nodes` 브랜치)
>
> 부분 갱신은 **문서 전체 재검증이 아니다.** 각 갱신에서 실제로 확인한 항목만 아래에 적는다.
> 확인하지 않은 항목의 날짜는 올리지 않는다.
>
> | 확인일 | 확인한 항목 | 확인 방법 |
> |---|---|---|
> | 2026-09-04 (#78) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx`·`ui/canvasLayout.ts`·`ui/PropertiesPanel.tsx` 행 | 세 파일과 `ui/properties/`(EffectsSection·shadowPatch·radiusPatch·effectPatch 신규) 전문 편집·열람. `pnpm test`(19파일 189케이스) |
> | 2026-09-04 (#78) | 4절 유효 예제 행 | `examples/card-effects.json` 신규. `visual-spec.schema.json` 에 Shadow·Opacity·Blur·StrokeAlign·Radius 추가 후 `pnpm run generate:types` |
> | 2026-09-02 (#75) | 3절 노드 타입·레이아웃 표, 6절 제안 3, 4절 유효 예제·테스트 행, 1절 IR·스키마 행 | `visual-spec.schema.json`에 `ButtonNode`/`InputNode`/`Layout.direction: "grid"` 추가 후 `pnpm run generate:types`(diff 없음) · `pnpm test`(13파일 99케이스) · `examples/form-grid.json` 신규 예제로 검증. 아직 `develop`에 머지되지 않은 브랜치 위에서 작업 중이라 push/PR 전 상태다 |
> | 2026-09-02 (#75) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx`·`ui/canvasLayout.ts`·`ui/PropertiesPanel.tsx` 행 | 세 파일 전문 편집·열람 — `Canvas.tsx`에 `button`/`input` 렌더 분기와 `displayStyle()`(grid), `canvasLayout.ts`의 `boxStyle()`에 grid 아이템 분기, `PropertiesPanel.tsx`의 fallback 안내 문구 일반화 |
> | 2026-09-01 (3차, 020be51) | 1절 GUI·Canvas 행의 Import 서술 · "GUI 각 영역의 실제 동작" 표의 `ui/MenuBar.tsx`(File) 행 | `git grep "noop" src/features/editor/ui/MenuBar.tsx` 히트 **0건**, File 메뉴 6개 항목의 `onSelect` 를 전부 열람 |
> | 2026-09-01 (3차, 020be51) | 같은 표에 추가한 `ui/importImageFromFile.ts` · `store/resolveImportParent.ts` · `store/nodeId.ts` 행, `store/editorStore.ts` 행 | 네 파일 전문 열람. 계약 멤버 수는 `docs/EDITOR_STORE_CONTRACT.md`("계약의 전부 (6개)")와 대조 |
> | 2026-09-01 (3차, 020be51) | 1절 IR·스키마 행의 테스트 집계 · 4절 테스트 행 · 아래 "확인 방법" | `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm test`(12파일 84케이스) 출력에서 파일 수·케이스 수를 읽음 |
> | 2026-09-01 (3차, 020be51) | 2절 `.visual-spec/` 작업공간 행 · 3절 Image 행의 미해결 서술 | `ui/importImageFromFile.ts` 가 base64 data URI 를 `src` 에 넣는 것을 확인 — 작업공간 assets 저장소는 여전히 없다 |
> | 2026-09-01 (3차, 020be51) | 4절 스킬 5종 행 | `ls skills/`(5) · `ls docs/skills/`(5) — 그대로 |
> | 2026-09-01 (2차, 1b73ccd) | 3절 노드 타입 서술과 Image 행 · 3절 표 아래 요약 · 4절 유효 예제 행 | `docs/06-schema-freeze.md` 와 `docs/05-schema.md` 를 정본 스키마 `$defs.Node` 와 대조, `ls examples/*.json` 5개 |
> | 2026-09-01 (2차, 1b73ccd) | 1절 IR·스키마 행의 테스트 집계 · 4절 테스트 행 · 아래 "확인 방법" | `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm test`(10파일 72케이스) 출력에서 파일 수·케이스 수를 읽음 |
> | 2026-09-01 (2차, 1b73ccd) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx` · `ui/PropertiesPanel.tsx` 행 | `git diff a807bc4 1b73ccd` 로 변경분을 뽑고 두 파일의 `image` 분기를 열람 |
> | 2026-09-01 (2차, 1b73ccd) | 4절 끝 구조 오류 코드 7종 | `examples/invalid/` 8개와 `examples/` 5개에 `validateVisualSpec` 을 실제로 돌려 `code` 수집 — 7종 그대로 |
> | 2026-09-01 (1차, a807bc4) | 1절 IR·스키마 행의 테스트 집계 · 4절 테스트 행 · 아래 "확인 방법" | `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm test` 출력에서 파일 수·케이스 수를 읽음 |
> | 2026-09-01 (1차, a807bc4) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx` · `store/viewStore.ts` · `store/measureStore.ts`(이번에 추가) · `ui/PropertiesPanel.tsx`/`properties/` 행 | `git log db7f8f4..a807bc4 --name-only` 로 변경 파일을 뽑아 전부 열람 — `store/measureStore.ts` · `store/viewStore.ts` · `ui/Canvas.tsx` · `ui/properties/SizeSection.tsx` · `ui/properties/fields/{Field,NumberField,ColorField,SizeField}.tsx` |
> | 2026-09-01 (1차, a807bc4) | `properties/` 파일 개수(17) · 패널 필드 24개 서술 | `find src/features/editor/ui/properties -type f` 17개, `git grep "useNodeField"` 호출 지점 실측(`ui/PropertiesPanel.tsx` 2 · `properties/FrameProperties.tsx` 12 · `properties/TextProperties.tsx` 10) |
> | 2026-09-01 (1차, a807bc4) | 5.3 검증 실패 알림 경로 · 6절 제안 1(둘 다 여전히 참) | `git log db7f8f4..a807bc4 --name-only` — `store/exportSpec.ts` · `store/loadSpec.ts` · `ui/exportSpecAsJson.ts` · `ui/openSpecFromFile.ts` · `ui/MenuBar.tsx` · `ui/properties/ExportJsonButton.tsx` · `ui/canvasLayout.ts` · `store/editorStore.ts` 변경 0건 |
> | 2026-08-29 | 1절 IR·스키마 · GUI·Canvas · Export 행, "GUI 각 영역의 실제 동작" 표 | `src/features/editor/` 전 파일과 `src/app/App.tsx` 열람 |
> | 2026-08-29 | 1절 Command Engine 행, Ticket Compiler 행의 "`src/` 에 0줄" 부분 | `git grep -i "command"`·`"ticket"` — `src/` 히트 각각 0건 |
> | 2026-08-29 | 1절 표 아래 `setNodeField` 서술, 6절 제안 1 | `git grep "setNodeField"`·`"useNodeField"` 로 호출 지점 실측 |
> | 2026-08-29 | 2절 CLI 행 · `.visual-spec/` 작업공간 행 | `package.json` 의 `bin` 부재, `git grep "\.visual-spec"` — `src/`·`test/`·`scripts/` 히트 0건 |
> | 2026-08-29 | 4절 테스트 행 · 스킬 행 · 예제 행 | `pnpm test` 실행, `skills/`(5)·`docs/skills/`(5)·`examples/`(4)·`examples/invalid/`(8) 실제 개수 |
> | 2026-08-29 | 5.1 `package.json` 의 `main` | `package.json` 과 `src/index.ts` 존재 여부 |
> | 2026-08-29 | 5.3(이번에 추가) 검증 실패 알림 경로 | `store/exportSpec.ts`·`store/loadSpec.ts`·`ui/exportSpecAsJson.ts`·`ui/openSpecFromFile.ts`·`ui/MenuBar.tsx`·`ui/properties/ExportJsonButton.tsx` 열람 |
> | 2026-08-29 | 아래 "확인 방법" | `pnpm install --frozen-lockfile` · `pnpm run typecheck` · `pnpm test` |
> | 2026-08-25 | 5.2 검증기 메시지 | `src/features/editor/schema/validate.ts` 수정과 테스트 |
>
> **2026-09-02(#75)에 재확인하지 않은 항목** — 위 표의 "#75" 행에 없는 모든 항목.
> 이 갱신은 `develop` 020be51 위에 올린 이슈 #75 브랜치(`75--button-input-grid-nodes`)에서
> 직접 건드린 스키마·Canvas·PropertiesPanel·예제·테스트 파일에 걸린 서술만 다시 봤다.
> **이 브랜치는 아직 `develop`에 머지되지 않았다** — 같은 시점에 열려 있던 PR #77(홈 화면)·
> PR #79(Command Engine)·PR #81(Ticket 스키마)도 마찬가지로 `develop`에 없으므로, 이 문서의
> Command Engine·Ticket Compiler·홈 화면 관련 서술은 여전히 020be51 기준 그대로이며 날짜를
> 올리지 않았다. 그 세 항목은 각 PR이 머지된 뒤 별도로 갱신한다.
>
> **2026-09-01 3차(020be51)에 재확인하지 않은 항목** — 위 표의 "3차" 행에 없는 모든 항목.
> 3차 갱신은 `develop` 5커밋(1b73ccd → 020be51, PR #69 Import 연결 · PR #71 스킬 image 반영)이
> 실제로 건드린 파일에 걸린 서술만 다시 봤다. 3절 노드 타입 표의 나머지 행, 5절, 6절,
> `ui/Toolbar.tsx` 행(도구 구현 PR #68 은 아직 develop 에 없다)은 1·2차 또는 그 이전 확인
> 상태 그대로이며 날짜를 올리지 않았다.
>
> **2026-09-01 2차(1b73ccd)에 재확인하지 않은 항목** — 위 표의 "2차" 행에 없는 모든 항목.
> 2차 갱신은 `develop` 3커밋(a807bc4 → 1b73ccd, PR #67 ImageNode 추가)이 실제로 건드린 파일
> 9개에 걸린 서술만 다시 봤다. 1절 GUI·Canvas 행, 2절, 5절, 6절은 1차(a807bc4) 또는
> 그 이전 확인 상태 그대로이며 날짜를 올리지 않았다.
>
> **2026-09-01 1차(a807bc4)에 재확인하지 않은 항목** — 위 표의 "1차" 행에 없는 모든 항목.
> 1차 갱신은 `develop` 10커밋(db7f8f4 → a807bc4)이 실제로 건드린 파일에 걸린 서술만 다시 봤다.
> 나머지는 2026-08-20 · 2026-08-25 · 2026-08-28 · 2026-08-29 확인 상태 그대로이며 날짜를 올리지 않았다.
>
> **2026-08-29에 재확인하지 않은 항목** — 1절 자연어 변환 행, Ticket Compiler 행의 스킬 지시문 서술,
> 2절의 나머지 행, 3절(02와 스키마 v0.1의 범위 차이), 5.2, 제안 2·3.
> 각각 2026-08-20 · 2026-08-25 · 2026-08-28 확인 상태 그대로다.
> (3절과 5.2의 대상인 `src/features/editor/schema/` 는 1b3e82a → db7f8f4 사이 변경 0건이었다 —
> 내용을 재검증한 것은 아니지만 바뀔 이유가 없었다는 뜻이다.)
>
> 07이 지적하는 문제 중 저장소에 이슈로 열려 있는 것은 본문에 번호를 달았다 — #40~#46.
>
> 이 문서는 **저장소의 실제 상태를 반영하는 현황 보고**다. 계획서가 아니다.
> 코드가 바뀌면 이 문서도 함께 갱신한다. 갱신하지 않은 채 방치하면 없느니만 못하다.
>
> 범위 정의는 이 문서가 하지 않는다. **무엇을 만들기로 했는지는 [02-mvp-scope.md](02-mvp-scope.md)가 기준이다.**
> 여기서는 그 문서가 정한 항목들이 지금 어떤 상태인지만 덧붙인다.

## 상태 표기

| 표기 | 의미 |
|---|---|
| **완료** | 해당 범위가 구현됐고 테스트 또는 예제로 확인된다 |
| **부분** | 일부만 동작한다. 무엇이 되고 무엇이 안 되는지 항상 함께 적는다 |
| **미착수** | 관련 코드가 저장소에 없다 |

퍼센트는 쓰지 않는다. 근거가 되는 파일 경로를 함께 적어 읽는 사람이 직접 확인할 수 있게 한다.

---

## 1. MVP 구현 단위 6개

[02-mvp-scope.md의 "구현 단위" 표](02-mvp-scope.md#구현-단위)에 대응한다.

| 단위 | 상태 | 근거 / 무엇이 되고 무엇이 안 되는가 |
|---|---|---|
| IR · 스키마 | **완료** | `src/features/editor/schema/` — JSON Schema 정본, 생성 타입, 검증기, 공개 index. v0.1로 동결([06-schema-freeze.md](06-schema-freeze.md)). `test/` 13파일 99케이스 통과(2026-09-02, 이슈 #75 브랜치 기준) |
| Command Engine | **미착수** | `command.schema.ts` 없음, history manager 없음. `src/` 전체에 Command 관련 코드 0줄 |
| 자연어 변환 | **미착수** | 관련 코드 없음 |
| Ticket Compiler · Agent | **부분** | 코드 생성만 `skills/visual-spec-to-react/SKILL.md`가 에이전트 지시문 형태로 대신한다. 그 지시문에 **컴포넌트 분리 경계·의존성 순서(자식 먼저)·컴포넌트별 진행 보고**가 생겼다(같은 파일 "컴포넌트 단위로 분리 생성한다" 절). **다만 이는 문서이지 코드가 아니다** — 티켓 스키마도, 순서를 계산하거나 상태를 저장하는 코드도 `src/` 에 0줄이다 |
| localhost GUI · Canvas | **부분** | 캔버스가 스토어의 스펙을 실제로 그리고 클릭으로 노드를 선택할 수 있으며, 세부설정 패널 편집이 즉시 반영되고, Ctrl+휠 줌·휠 팬이 동작한다(`src/features/editor/ui/Canvas.tsx`, `ui/canvasLayout.ts`, `ui/PropertiesPanel.tsx`, `store/editorStore.ts`). File 메뉴로 **새 문서·열기·저장(JSON 파일 다운로드)도 된다**(`ui/MenuBar.tsx`, `ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts` — 이슈 #41이 지적한 것 중 New·Open·Save·Save as가 해소됐다). **Import 도 된다** — 이미지를 골라 선택된 프레임(없으면 root)의 자식으로 `image` 노드를 삽입한다(`ui/importImageFromFile.ts`, 2026-09-01 PR #69). 이로써 **File 메뉴에 미구현 항목이 없다.** **안 되는 것 — 캔버스 드래그·리사이즈 편집, 레이어 트리(#43)·도구 모음(#44)의 스토어 연결, 그리고 지속성**: 앱을 열면 여전히 `store/seedSpec.ts` 의 하드코딩 스펙에서 시작하고 새로고침하면 편집 내용이 사라진다(`src/` 의 `localStorage` 사용처는 테마뿐 — `ui/theme-storage.ts`). 아래 표 참고 |
| Export · 검증 | **미착수** | [02-mvp-scope.md](02-mvp-scope.md)가 정의한 Export는 "생성된 React 코드를 결과 폴더로 내보내기"인데 그 코드는 없다. GUI에 내보내기 경로가 둘 생겼지만(File > Export·Save·Save as — `src/features/editor/ui/MenuBar.tsx`, 패널 하단의 `ui/properties/ExportJsonButton.tsx`) 둘 다 `store/exportSpec.ts` 의 `buildExportPayload` 를 거쳐 **스펙 JSON을 검증 후 내려받는 것**이라 02의 Export와 다르다 |

### GUI 각 영역의 실제 동작

| 파일 | 지금 하는 일 | 스토어 연결 |
|---|---|---|
| `src/app/App.tsx` | `ThemeProvider` + `EditorLayout` 렌더 | 라우팅 없음 |
| `src/features/editor/ui/EditorLayout.tsx` | 5개 영역 CSS Grid 배치. 패널 토글 시 좌우 컬럼을 접는다 | `viewStore.showPanels` |
| `src/features/editor/ui/MenuBar.tsx` (View 메뉴) | 줌 In/Out · Fit to Screen · 격자 표시 · 패널 표시 · **채우기(Fill Viewport)** 가 **동작한다** | `viewStore` |
| `src/features/editor/ui/MenuBar.tsx` (File 메뉴) | New(`blankSpec` 로드) · Open(파일 선택 → 검증 → 로드) · Save · Save as · Export(스펙 JSON 다운로드) · **Import(이미지 선택 → 삽입)**가 전부 **동작한다**. **`noop()` 은 0개다** — 2026-09-01(PR #69)에 Import 가 연결되면서 File 메뉴에 미구현 항목이 없어졌다(`git grep "noop" src/features/editor/ui/MenuBar.tsx` 히트 0건) | `editorStore.loadSpec` · `editorStore.insertNode` · `useEditorStore.getState().spec` |
| `src/features/editor/ui/Canvas.tsx` | 스펙 트리를 flex/grid 로 렌더(박스·레이아웃·배경·테두리·타이포그래피·그림자·불투명도·블러), 클릭 시 노드 선택, 줌 배율·격자 표시. **테두리·그림자는 `canvasLayout.strokeAndShadowStyle` 이 `box-shadow` 한 문자열로 합성하고, 불투명도·블러는 `effectStyle` 이 낸다**(2026-09-04·이슈 #78 — `frame` 은 둘 다, `text`·`image` 는 `effectStyle` 만, `button`·`input` 은 `Border` 를 공유하므로 테두리 정렬만). **`image` 노드는 빈 `div` 의 `background-image` 로 그린다**(`imageStyle()` — `fit` 의 `cover`/`contain` 은 `background-size` 로 그대로 넘기고 `fill` 만 `100% 100%` 로 옮긴다. `background-position: center`, 반복 없음. 자식을 받지 않는다). **`button`/`input` 노드는 각각 `<div>` 로 그린다**(`buttonStyle()`/`inputStyle()`, 2026-09-02·이슈 #75 — `content`/`placeholder` 텍스트를 보여주기만 하고 실제 클릭·입력 동작은 없다). **`layout.direction: "grid"` 는 `display: grid` + `layout.columns` 만큼의 `gridTemplateColumns` 로 그린다**(`displayStyle()`, 같은 PR — 균등 자동 배치뿐, 셀 지정 없음. `mainAxis`/`crossAxis` 무시). **아트보드를 `spec.screen.size` 로 고정**하고 좌상단 기준 `transform: scale` 로 확대한다 — 자식이 커져도 아트보드는 그대로고 넘치는 만큼 밖으로 삐져나온다. 아트보드를 감싼 바깥 박스에 `size × 배율` 크기를 줘 **스크롤 범위를 확대율과 맞춘다**(`transform` 은 레이아웃 박스를 바꾸지 않아, 이 박스가 없으면 25%인데도 100% 크기의 빈 공간이 남는다). 아트보드 위에 화면 이름을 띄운다. `ResizeObserver` 로 **뷰포트 실측 크기**를, `spec.screen.size` 변화로 **아트보드 크기**를 `viewStore` 에 올리고, 뷰포트를 처음 받은 시점과 페이지를 바꿀 때 `fitToScreen()` 을 부른다(처음 열었을 때 아트보드 전체가 보이게). **채우기 모드에서는 뷰포트·해상도가 바뀔 때마다 다시 맞춘다** — "뷰포트 가로 = 페이지 가로"가 상시 규칙이라 한 번만 맞추면 안 된다. 채우기 모드에서는 캔버스 여백(`p-8`)·격자·그림자·이름표도 함께 걷는다. 스크롤바 등장/소멸이 `clientWidth` 를 흔들어 배율이 진동하지 않도록 `scrollbar-gutter: stable` 로 스크롤바 자리를 고정한다. 선택 노드가 실제로 그려진 px 도 재서 `measureStore` 에 올린다. **Ctrl+휠 줌**을 `{ passive: false }` 리스너로 가로채고, 일반 휠 팬은 `overflow-auto` 네이티브 스크롤에 맡긴다 | `editorStore` · `viewStore` · `measureStore` |
| `src/features/editor/ui/canvasLayout.ts` | `Canvas.tsx` 에서 분리한 순수 함수 `sizeToCss` · `boxStyle` · `radiusCss` · `strokeAndShadowStyle` · `effectStyle`. Figma 의 Fixed/Hug/Fill 을 flex 로 옮긴다 — 주축 `fill` → `flex: 1 1 0` + `min-*: 0`(형제끼리 공간 균등 분배), 교차축 `fill` → `align-self: stretch`, 부모가 없는 최상위 노드만 `100%`. **`parentDirection === "grid"` 도 최상위 노드와 동일하게 취급한다**(2026-09-02, 이슈 #75 — flex-grow/shrink 기반 배분이 grid 아이템에는 뜻이 없어서다). **`strokeAndShadowStyle` 은 테두리 정렬과 그림자를 한 `box-shadow` 로 합친다**(2026-09-04·이슈 #78 — 둘이 같은 CSS 속성 한 칸을 두고 다투기 때문이다. 테두리 고리를 앞에 적어 그림자에 묻히지 않게 한다). 정렬을 `outline` 으로 그리지 않는 이유는 `Canvas.tsx` 의 `RenderNode` 가 **선택 표시에 이미 `outline` 을 쓰고 있어서**다 — 노드를 고르는 순간 둘 중 하나가 사라진다. `inside` 만 CSS `border` 속성을 유지한다(`box-shadow` 는 레이아웃 박스를 차지하지 않는데 기존 문서가 전부 `inside` 라 갈아타면 안쪽 여백이 달라진다). `radiusCss` 는 모서리별 반경을 CSS 순서(좌상 → 우상 → 우하 → 좌하)로 옮긴다 | 없음 (순수 함수 — `test/canvas-layout.test.ts` 26케이스) |
| `src/features/editor/ui/PropertiesPanel.tsx` 와 `ui/properties/`(파일 17개) | 선택 노드의 이름·표시·박스·레이아웃·배경·테두리·타이포그래피·효과(그림자·불투명도·블러)를 편집. 타입별로 `frame` → `FrameProperties`, `text` → `TextProperties` 로 갈라지고, **`image`·`button`·`input` 은 "이 노드 타입의 속성 편집은 아직 지원하지 않습니다." 안내 한 줄만 띄운다**(문구는 2026-09-02·이슈 #75에 세 타입 공통으로 일반화됐다 — 그전에는 "이미지 속성 편집은…"으로 image 전용 문구였는데 `button`/`input` 도 같은 fallback 을 타면서 부정확해졌다. `src`/`fit`·`content`/`placeholder` 를 GUI 에서 고칠 방법은 아직 없다). 컨트롤은 `properties/fields/Field.tsx`(라벨·2열 행·인풋 스타일)와 `properties/fields/useDraftInput.ts`(타이핑 중에는 draft, 파싱에 성공하면 즉시 커밋)를 공유하고, Frame·Text 공통 Size 섹션은 `properties/SizeSection.tsx` 다. **Size 섹션의 px 칸은 Fixed 면 스펙값을, Hug/Fill 이면 `measureStore` 의 실측 px 를 보여준다**(`properties/fields/SizeField.tsx`) — 실측값을 아직 못 받았을 때만 `Hug`/`Fill` 을 placeholder 로 흐리게 띄우고, 모드를 Fixed 로 바꾸면 그 실측 px 를 그대로 이어받는다(못 받았으면 100). **스키마 값 `"auto"` 를 UI 는 Figma 용어인 `Hug` 로 부른다.** 숫자 칸(`type="number"`)은 **휠이 닿으면 포커스를 떼** 스크롤하다 값이 조용히 증감되는 일을 막는다(`properties/fields/Field.tsx` 의 `blurOnWheel` — `SizeField`·`NumberField`·`ColorField` 가 쓴다. 패널 자체가 `overflow-auto` 라 `preventDefault` 대신 `blur` 를 쓴다). `border` 는 스키마상 세 필드가 모두 필수라 한 칸만 고쳐도 `properties/borderPatch.ts` 가 완전한 객체를 만들어 통째로 쓴다. **`shadow`·모서리별 `radius` 도 같은 이유로 `properties/shadowPatch.ts`·`properties/radiusPatch.ts` 가 같은 일을 한다**(2026-09-04·이슈 #78). 효과 섹션은 `properties/EffectsSection.tsx` 로 `frame`·`text` 가 공유하고(그림자는 `frame` 만), **불투명도는 스키마 0..1 을 칸에서는 % 로 보여준다** — 항등값(불투명도 100%, 블러 0, 그림자 토글 끄기)으로 되돌리면 필드를 지운다(`properties/effectPatch.ts`. 아무 효과도 없는 값이 남으면 export 된 JSON 을 읽는 쪽이 의미 있는 지정으로 오해한다). 테두리 정렬은 `안쪽`/`가운데`/`바깥`, 모서리 반경은 `전체`/`개별` 토글로 고른다 | `properties/useNodeField.ts` 훅을 거쳐 `editorStore.setNodeField`. Size 섹션은 `measureStore` 를 읽기만 한다 |
| `src/features/editor/ui/LayerTree.tsx` | **하드코딩된 레이어 10개**(`LAYERS` 상수)를 표시. 선택은 로컬 하이라이트뿐 (이슈 #43) | 없음 |
| `src/features/editor/ui/Toolbar.tsx` | Select/Frame/Text/Hand 버튼. 활성 표시만 로컬 상태 (이슈 #44) | 없음 (도구 동작 없음) |
| `src/features/editor/store/editorStore.ts` | `spec` · `selectedId` · `select` · `setNodeField` · `loadSpec`(스펙 전체 교체 + 선택 해제 — New/Open 이 호출) · **`insertNode`(새 노드를 `parentId` frame 의 자식 끝에 추가하고 그 노드를 선택 — Import 가 호출)**. `insertNode` 는 `parentId` 가 없거나 frame 이 아니면 아무 것도 하지 않는다 — 유효한 frame id 를 고르는 책임은 호출자에게 있다. 계약 멤버는 **6개**다(2026-09-01, PR #69 에서 5개 → 6개) ([EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md)) | — |
| `src/features/editor/ui/importImageFromFile.ts` | File > Import 의 본체. `<input type=file accept="image/*">` 로 이미지를 고르고 `FileReader` 로 읽은 뒤 `new Image()` 로 원본 픽셀 크기를 재서 `ImageNode` 를 만들어 삽입한다(`box` 는 이미지 원본 크기, `fit` 은 `"cover"` 고정, `name` 은 확장자를 뗀 파일명). **워크스페이스 assets 저장소가 없어 이미지를 base64 data URI 로 스펙 안에 직접 담는다** — 파일 자체가 스펙에 들어가므로 Export/Save 한 JSON 이 그만큼 커진다(파일 상단 주석이 이 절충을 밝히고 있다). 읽기 실패·이미지 아님은 `window.alert` 로 알린다 | `editorStore.insertNode` · `editorStore.getState().spec`·`selectedId` |
| `src/features/editor/store/resolveImportParent.ts` | Import 한 노드를 붙일 부모를 정하는 순수 함수. **선택 노드가 frame 이면 그 안에, 아니면(선택 없음 · text/image 선택 중) 화면 root 에** 붙인다(root 는 스키마상 항상 frame) | 없음 (순수 함수 — `test/resolve-import-parent.test.ts` 4케이스) |
| `src/features/editor/store/nodeId.ts` | `generateNodeId(prefix, nodes)` — `image-1`, `image-2` … 처럼 비어 있는 순번을 찾아 새 id 를 만드는 순수 함수. `NodeId` 패턴(`^[A-Za-z0-9_-]+$`)을 항상 만족한다 | 없음 (순수 함수 — `test/node-id.test.ts` 4케이스) |
| `src/features/editor/store/exportSpec.ts` · `store/loadSpec.ts` | 스펙을 검증해 내보낼 JSON 을 만들거나(`buildExportPayload`), JSON 문자열을 파싱·검증한다(`parseSpecJson`). DOM 없는 순수 함수 | — |
| `src/features/editor/ui/exportSpecAsJson.ts` · `ui/openSpecFromFile.ts` | 위 순수 함수를 감싸는 파일 입출력 — `Blob`+`<a download>` 다운로드, `<input type=file>`+`FileReader` 읽기 | `editorStore.loadSpec` |
| `src/features/editor/store/blankSpec.ts` | File > New 가 로드하는 빈 스펙(root frame 하나, 자식 없음, 1440×900) | — |
| `src/features/editor/store/seedSpec.ts` | 초기 스펙을 하드코딩(`examples/dashboard-cards.json` 내용) | 앱 시작 시 `editorStore` 의 초기값. 자동 저장·복원은 없다 |
| `src/features/editor/store/viewStore.ts` | 줌(25~400%, 버튼·휠은 25 눈금) · 격자 · 패널 표시 · **채우기 모드(`fillViewport`)** 에 더해 **뷰포트 실측 크기(`viewport`)와 아트보드 크기(`content`)**를 담는다 — 둘 다 `Canvas.tsx` 가 올린다. `fitToScreen()` 은 순수 함수 `fitZoom()` 으로 두 크기의 비율을 재서 소수점 두 자리에서 **내림**한 확대율을 쓴다(올림하면 아트보드 가장자리가 잘린다). `ZOOM_STEP` 눈금으로 내리지 않는다 — 1920px 아트보드에서 1%p는 19px이고 채우기 모드에서 그만큼이 바탕색 띠로 보인다. 그래서 `zoomIn/zoomOut` 은 더하고 빼는 대신 다음/이전 눈금으로 **붙인다**(57% → 75%). `fitZoom` 의 `mode` 가 `"width"` 면 세로를 무시하고 가로만 맞춘다(채우기 모드). 실측값을 아직 못 받았으면 100%로 리셋한다 | — (`test/view-store.test.ts` 9케이스 · `fitZoom` 은 `test/fit-zoom.test.ts` 10케이스) |
| `src/features/editor/store/measureStore.ts` | **선택 노드가 캔버스에서 실제로 몇 px 로 그려졌는지**(`size`)만 담는 단일 값 스토어. `Canvas.tsx` 의 `ResizeObserver` 가 올리고 `ui/properties/SizeSection.tsx` 가 읽는다. Hug/Fill 은 스펙에 숫자가 없어 패널이 크기를 알 수 없는데 그 자리를 이 실측값이 채운다. 같은 값이면 `set` 을 건너뛴다(`ResizeObserver` 가 자주 부른다) | — (IR 이 아닌 파생 UI 상태라 `editorStore` 계약과 분리했다 — [EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md). 다만 `store/measureStore.ts:10` 과 `store/viewStore.ts:6` 의 주석은 아직 그 계약을 **"4-멤버"**라고 부른다 — 계약은 그동안 5개를 거쳐 6개가 됐으므로 주석이 낡았다. 관찰 기록이므로 고치지 않았다) |

`Canvas.tsx` 상단 주석은 스스로를 **"임시 스탠드인 — 팀원이 정식 구현으로 교체할 예정"**이라고 밝힌다.
캔버스에서 드래그·리사이즈로 편집하는 기능은 없다.

세부설정 패널은 Command Engine을 거치지 않고 `editorStore.setNodeField` 로 IR을 직접 고친다.
[02-mvp-scope.md](02-mvp-scope.md)가 못박은 "GUI는 IR을 직접 수정하지 않는다" 제약과 어긋난 상태다(이슈 #40, 6절 제안 1 참고).

다만 **그 호출 경로는 한 곳으로 모여 있다.** `src/` 전체에서 `setNodeField` 를 실제로 호출하는 지점은
`src/features/editor/ui/properties/useNodeField.ts:28` **하나뿐**이고, 패널의 필드 24개
(`ui/PropertiesPanel.tsx` 2 · `ui/properties/FrameProperties.tsx` 12 · `ui/properties/TextProperties.tsx` 10)는
전부 그 훅을 거친다. `src/` 의 나머지 `setNodeField` 히트는 스토어의 정의(`store/editorStore.ts:38`)와 주석이다.

---

## 2. MVP 문서가 요구하는데 저장소에 없는 것

| 항목 | 02-mvp-scope.md의 요구 | 상태 | 근거 |
|---|---|---|---|
| CLI | `npx visual-spec init` / `npx visual-spec` | **미착수** | `package.json` 에 `bin` 필드 없음. CLI 진입점 파일 없음 (이슈 #42) |
| `.visual-spec/` 작업공간 | `specs/` `generated/` `preview/` `assets/` `runtime/` | **미착수** | 작업공간을 만들거나 읽는 코드 0줄. `git grep "\.visual-spec"` 히트는 전부 문서와 스킬 지시문이고 `src/`·`test/`·`scripts/` 는 여전히 0건(2026-08-29 재확인). `skills/visual-spec-to-react/SKILL.md` 가 생성 위치를 `.visual-spec/generated/` 고정 경로로 정했지만 **경로 약속이지 구현이 아니다.** GUI 에 생긴 Open/Save 는 브라우저 파일 다이얼로그와 다운로드를 쓰는 것이라(`ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts`) **작업공간과는 다른 물건이다** (이슈 #42). **2026-09-01 재확인 — PR #69 의 Import 도 작업공간을 만들지 않는다.** `ui/importImageFromFile.ts` 는 고른 이미지를 base64 data URI 로 바꿔 `ImageNode.src` 에 그대로 넣는다. 즉 `assets/` 디렉터리를 쓰는 대신 **파일 내용을 스펙 안에 인라인해 우회한 것**이므로 이 행은 **미착수 그대로**다 |
| Command 스키마 v0.1 | "v0.1로 고정한다"고 선언한 3개 스키마 중 하나 | **미착수** | 스키마 파일 없음 |
| Ticket 스키마 v0.1 | 같음 | **미착수** | 스키마 파일 없음 |
| Undo / Redo | MVP 포함 범위 표 "편집" 행 | **미착수** | history manager 없음 (Command Engine 부재의 결과) |
| 반응형 (데스크톱 · 모바일) | MVP 포함 범위 표 "반응형" 행 | **미착수** | 스키마가 `responsive`를 명시적으로 제외([06-schema-freeze.md](06-schema-freeze.md), [05-schema.md](05-schema.md)) |
| 홈(진입) 화면 | [04-gui-spec.md §2](04-gui-spec.md#2-홈진입-화면)가 화면 목록·카드·빈 상태까지 명세 | **미착수** | `src/app/App.tsx` 가 `EditorLayout` 을 바로 렌더한다. 홈 화면 컴포넌트도 라우팅도 없다 |

세 스키마 중 IR 스키마 하나만 v0.1로 고정됐고, Command·Ticket 두 개는 아직 문서상의 선언으로만 존재한다.

---

## 3. 02-mvp-scope.md와 스키마 v0.1의 범위 차이

02가 요구하는 범위와 실제 동결된 스키마 v0.1의 범위가 일치하지 않는 항목이 있다.
**일부는 [06-schema-freeze.md](06-schema-freeze.md)가 의도적으로 좁힌 것이고, 일부는 어느 문서도 정리하지 않은 미조정 항목이다.** 둘을 구분해서 읽어야 한다.

### 노드 타입

02는 `Container / Text / Button / Input / Image` 5종을 요구한다. 스키마 v0.1은 이제 `frame`, `text`, `image`, `button`, `input` 5종이다(`src/features/editor/schema/visual-spec.schema.json` 의 `$defs.Node` — `oneOf` 가 `FrameNode`·`TextNode`·`ImageNode`·`ButtonNode`·`InputNode` 다섯 갈래다). **02가 요구한 5종이 전부 충족됐다.**

| 02가 요구한 노드 | v0.1 | 성격 |
|---|---|---|
| Container | `frame` 으로 충족 | 이름만 다르다 |
| Text | `text` 로 충족 | — |
| Image | `image` 로 충족 | **충족됐다(2026-09-01, PR #67).** 06이 `image` 를 지원 목록으로 옮기고 제외 목록에서 뺐다. `src`(워크스페이스 assets 참조)와 `fit`(`cover`\|`contain`\|`fill`)이 필수이며 예제는 `examples/image-hero.json` 이다. **다만 05는 아직 `ImageNode` 를 "MVP 제외 범위"에 두고 포함 목록에도 `FrameNode`·`TextNode` 만 적어 둔 상태라 06·정본 스키마와 어긋난다**([05-schema.md](05-schema.md) — 이 문서는 관찰 기록이므로 05를 고치지 않았다). **06이 남긴 미해결(`src` 가 가리킬 워크스페이스 assets 저장소)은 아직 그대로다.** PR #69 의 Import 는 그 저장소를 만드는 대신 이미지를 base64 data URI 로 스펙에 인라인해 우회했다(`ui/importImageFromFile.ts`). 그래서 정본 스키마가 `src` 를 "워크스페이스 assets에 저장된 이미지를 가리키는 상대 경로 또는 assetId"로 설명하는 것과 **실제로 채워지는 값이 어긋난다** — 스키마 제약은 `type: string`·`minLength: 1` 뿐이라 검증은 통과한다. 관찰 기록이므로 코드도 스키마도 고치지 않았다 |
| Button | `button` 으로 충족 | **충족됐다(2026-09-02, 이슈 #75).** `content`(라벨)·`typography`·`color`가 필수, `background`·`border`는 선택. `text`와 달리 `content`는 `minLength: 1`(빈 라벨 금지). `onClick` 같은 이벤트는 스키마에 없다 — 표시용 정적 마크업만 만든다는 뜻이다. 예제는 `examples/form-grid.json` |
| Input | `input` 으로 충족 | **충족됐다(2026-09-02, 이슈 #75).** `placeholder`(빈 문자열 허용)·`typography`·`color`가 필수. `value`/`onChange` 바인딩은 없다 — props/bindings가 MVP 제외 범위인 것과 같은 이유다. 예제는 `examples/form-grid.json` |

**05는 아직 이 둘을 반영하지 못했다.** `05-schema.md`의 포함 목록에 `ButtonNode`·`InputNode`가 없다 — Image와 같은 종류의 지연이다. 관찰 기록이므로 05를 고치지 않았다.

### 레이아웃

02는 `Row / Column / Grid` 를 요구한다. 정본 스키마의 `$defs.Layout.direction` 은 이제 `["row", "column", "grid"]` 세 값을 허용한다.

- Row · Column — 충족
- **Grid — 최소 구현으로 충족됐다(2026-09-02, 이슈 #75).** `layout.columns`(선택, grid에서만 의미)만큼의 균등 N열 자동 배치만 지원한다 — 특정 자식을 특정 셀에 지정하는 기능은 없고, grid에서는 `mainAxis`/`crossAxis`가 무시된다. `ui/Canvas.tsx`의 `displayStyle()`, `ui/canvasLayout.ts`의 `boxStyle()` grid 분기가 렌더링을 맡는다. `Canvas.tsx`가 스스로 "임시 스탠드인"이라 밝히고 있어 정식 grid 셀 배치는 그 교체 작업과 함께 다시 다뤄야 한다

### 크기

02의 `Fixed / Fill / Hug` 는 v0.1의 `Size = number | "fill" | "auto"` 로 전부 충족된다.
다만 06이 밝힌 대로 **`"fill"` 이 교차축에서 무엇을 의미하는지는 계약에 포함되지 않았다.** Renderer 구현 시점에 정해야 한다.

> Button · Input · Grid 3건은 "구현이 안 됐다"기보다 **02와 05·06 사이가 정리되지 않은 상태**였다.
> **Image 는 2026-09-01 에, Button · Input · Grid 는 2026-09-02(이슈 #75)에 이 목록에서 빠졌다** —
> 둘 다 06의 변경 절차를 밟아 스키마를 넓히는 쪽으로 결론냈다(PR #67, 이슈 #75).
> **남은 미조정은 05가 06을 따라오지 못한 `ImageNode`·`ButtonNode`·`InputNode` 항목뿐이다** —
> 05의 포함 목록 갱신은 별도로 남아 있다.

---

## 4. 있는 것 — 스키마와 그 주변

이 영역은 확실히 완료된 부분이다.

| 항목 | 경로 | 비고 |
|---|---|---|
| JSON Schema 정본 | `src/features/editor/schema/visual-spec.schema.json` | 유일한 정본 |
| 생성 타입 | `src/features/editor/schema/types.ts` | 손으로 고치지 않는 생성 파일 |
| 검증기 | `src/features/editor/schema/validate.ts` | `validateVisualSpec` / `assertVisualSpec` / `VisualSpecValidationError` |
| 공개 표면 | `src/features/editor/schema/index.ts` | 타입·검증기는 이 index를 거쳐서만 가져온다 |
| 타입 생성 스크립트 | `scripts/generate-types.mjs` | `pnpm run generate:types` |
| 유효 예제 6개 | `examples/*.json` | 검증 통과. `examples/image-hero.json` 이 2026-09-01(PR #67)에, `examples/form-grid.json`(button·input·grid)이 2026-09-02(이슈 #75)에 추가됐다 |
| 무효 예제 8개 | `examples/invalid/*.json` | 검증기가 잡아야 하는 문서들 |
| 테스트 | `test/validate.test.ts`(20) · `test/editor-store.test.ts`(14) · `test/canvas-layout.test.ts`(9) · `test/fit-zoom.test.ts`(7) · `test/export-spec.test.ts`(6) · `test/view-store.test.ts`(6) · `test/border-patch.test.ts`(5) · `test/node-id.test.ts`(4) · `test/resolve-import-parent.test.ts`(4) · `test/schema.test.ts`(4) · `test/public-api.test.ts`(4) · `test/load-spec.test.ts`(3) · `test/project-spec.test.ts`(13) | **13파일 99케이스 전부 통과** (2026-09-02, 이슈 #75 브랜치 기준 확인 — `test/project-spec.test.ts`는 PR #76의 v0.2 `ProjectSpec` 작업으로 그사이 `develop`에 이미 추가돼 있었다) |
| CI | `.github/workflows/ci.yml` | 타입체크 · 테스트 · 스키마 드리프트 검사 |
| 스킬 5종 | `skills/` — `visual-spec`(허브) · `visual-spec-docs` · `visual-spec-authoring` · `visual-spec-validate` · `visual-spec-to-react` | 배포 원본은 저장소 루트 `skills/`. 사람이 읽는 설명은 `docs/skills/` 에 같은 이름으로 5개. `analyze-target-project`는 "독립 작업공간" 원칙과 어긋나 제거됨(#33) |

검증기가 잡아내는 구조 오류는 코드 7종이다 — `schema`, `root-missing`, `root-not-frame`, `child-missing`, `cycle`, `multiple-parents`, `orphan-node`.

---

## 5. 확인된 결함과 개선 여지

### 5.1 `package.json` 의 `main` 이 없는 파일을 가리킨다 (이슈 #45)

```json
"main": "src/index.ts"
```

`src/index.ts` 는 저장소에 존재하지 않는다. 스키마를 `src/features/editor/schema/` 로 옮기면서 파일은 사라졌는데 필드가 남았다.

`private: true` 인 Vite 앱이라 지금 당장 깨지는 것은 없다. 다만 **끊긴 참조**이고, 나중에 이 패키지를 실제로 배포하거나 `bin` 을 추가할 때 문제가 된다.
(이 문서는 관찰 기록이므로 수정하지 않았다.)

2026-08-29 재확인: `package.json` 의 `"main"` 은 그대로 `src/index.ts` 이고 그 파일은 여전히 없다. **미해결이다.**

### 5.2 검증기의 `schema` 이슈에 정보가 없었다 — **해결됨 (2026-08-21)**

`src/features/editor/schema/validate.ts` 의 `validateVisualSpec` 이 ajv 오류의 `error.keyword`,
`error.params` 를 버리고 모든 `schema` 이슈에 "JSON 스키마의 구조 규칙을 위반했습니다."라는
상수 문구 하나만 붙이던 문제다. `examples/invalid/text-without-content.json` 을 검증하면
이슈 7개가 나오는데, 정작 원인인 `"content" 가 없다`는 말은 한 번도 나오지 않았다.
(이 "7개"는 **2026-08-21 당시** 수치다. `$defs.Node` 의 `oneOf` 가 두 갈래이던 때이고,
`image` 갈래가 늘어난 지금 같은 파일은 12개를 낸다 — 2026-09-01 실측.)

`describeSchemaError()` 를 추가해 `error.keyword` 로 분기, `required` → `필수 필드 "X"가
없습니다.`, `additionalProperties` → `허용되지 않는 필드 "X"가 있습니다.` 처럼 위반 종류별
메시지를 만든다. 스키마에 실제 쓰이는 키워드
(`required`, `additionalProperties`, `const`, `enum`, `type`, `pattern`, `propertyNames`,
`minimum`/`exclusiveMinimum`/`maximum`/`exclusiveMaximum`, `minLength`, `minProperties`,
`multipleOf`, `oneOf`) 14개를 전부 다루고, 각 키워드의 `params` 필드명은 실제 ajv 출력으로
검증했다. `ValidationIssue` 의 타입(`code`/`path`/`message`)은 바꾸지 않았다 — 공개 표면을
넓히지 않고 `message` 문구만 고쳤다.

`validateVisualSpec` 이 절대 예외를 던지지 않는다는 계약([06-schema-freeze.md](06-schema-freeze.md))은
계속 지켜진다.

### 5.3 검증 실패를 사용자에게 알리는 방식이 경로마다 다르고, File 메뉴에서는 알리지 않는다

문서를 열고 저장하는 경로가 넷 생겼는데(2026-08-29 확인) 검증에 실패했을 때 사용자가 그것을 아는지가 경로마다 다르다.

| 경로 | 검증 실패 시 사용자가 보는 것 | 근거 |
|---|---|---|
| File > Export, File > Save | **없다.** `console.warn` 만 남고 다운로드가 조용히 취소된다 | `store/exportSpec.ts` 의 `buildExportPayload`, `ui/exportSpecAsJson.ts` 의 `exportSpecAsJson`, `ui/MenuBar.tsx` 의 `handleExport` |
| File > Save as | `window.alert` | `ui/exportSpecAsJson.ts` 의 `saveSpecAsJson` |
| File > Open | `window.alert` | `ui/openSpecFromFile.ts` (파싱·검증은 `store/loadSpec.ts` 의 `parseSpecJson`) |
| 패널 하단 Export JSON 버튼 | 버튼 위 인라인 에러 문구 | `ui/properties/ExportJsonButton.tsx` |

`ui/MenuBar.tsx` 의 주석이 이유를 밝히고 있다 — **"메뉴 컨텍스트에 인라인 에러 UI가 없어서 낸 절충"**이다.
같은 파일 주석이 Open/Save as 는 "사용자 조작이 원인이라 조용히 실패하면 원인을 알 수 없어" `alert` 를 쓴다고 적었다.
즉 의도된 절충이지 실수는 아니지만, **가장 자주 쓸 File > Save 만 실패를 알리지 않는 상태**다.

(이 문서는 관찰 기록이므로 수정하지 않았다. 대응하는 이슈는 아직 없다.)

---

## 6. 다음에 할 만한 것 (제안)

**아래는 확정된 계획이 아니라 제안이다.** 일정·담당자·우선순위는 팀이 정한다.
여기 적는 것은 "무엇을 먼저 하면 뒤 작업이 쉬워지는가"에 대한 근거뿐이다.

### 제안 1 — 캔버스 렌더링을 Command Engine보다 먼저 (처리됨, 1절 참고)

이 제안이 근거로 삼은 상태 — "캔버스가 스키마와 아예 연결돼 있지 않아 읽기가 되기 전에는 쓰기를
확인할 방법이 없다" — 는 해소됐다. `src/features/editor/ui/Canvas.tsx` 가 스펙을 그리고,
세부설정 패널 편집이 즉시 반영된다.

남은 것을 사실만 적는다.

- `Canvas.tsx` 는 스스로를 임시 스탠드인이라고 밝히고 있고 드래그·리사이즈 편집이 없다.
- **지금 패널은 Command Engine을 거치지 않고 `editorStore.setNodeField` 로 IR을 직접 고친다**(이슈 #40).
  [02-mvp-scope.md](02-mvp-scope.md)의 "GUI는 IR을 직접 수정하지 않고 Command Engine을 호출한다"
  제약과 어긋나므로, Command Engine을 놓을 때 이 호출 경로를 함께 바꿔야 한다.
  **걷어낼 호출 지점은 `ui/properties/useNodeField.ts` 한 곳이다** — 패널 필드 24개가 전부 이 훅을
  거치므로, 필드가 늘어도 바꿔야 할 지점은 늘지 않는다(1절 표 아래 참고).
- 06이 남겨 둔 **`"fill"` 의 교차축 의미**는 `ui/canvasLayout.ts` 의 `boxStyle()` 이 교차축 `"fill"` 을
  `align-self: stretch` 로 옮기는 방식으로 사실상 한 가지 해석을 쓰고 있다(주축 `"fill"` 은 `flex: 1 1 0`,
  부모가 없는 최상위 노드만 `100%`). 06에 반영할지는 정해지지 않았다(이슈 #46).

### 제안 2 — 검증기 메시지 개선은 언제든 가능하다 (완료, 5.2 참고)

5.2가 처리됐다. 스키마 **구조**를 바꾸지 않고 `validate.ts` 안에서만 고쳤다 —
[06-schema-freeze.md](06-schema-freeze.md)의 동결 대상은 스키마의 구조와 제약이지 검증기의
메시지 문구가 아니므로 동결 해제를 기다리지 않았다. `ValidationIssue` 에 필드를 추가하지
않아 공개 표면도 넓어지지 않았다.

### 제안 3 — Button · Input · Grid는 코드보다 문서 결정이 먼저 (완료, 3절 참고)

이 제안이 근거로 삼은 상태 — "결정 없이 구현에 들어가면 06의 변경 절차를 우회하게 된다" —
는 해소됐다. 이슈 #75가 06의 변경 절차(별도 PR·`generate:types`·예제/테스트 갱신)를 밟아
스키마를 넓히는 쪽으로 결론냈다 — Button·Input 노드 타입과 Grid 레이아웃(균등 N열 자동
배치만 지원하는 최소 구현)이 v0.1에 들어갔다.

남은 것은 05의 포함 목록이 06·정본 스키마를 아직 따라오지 못한 부분뿐이다(3절 참고 —
`ImageNode` 도 같은 상태로 이미 남아 있었다).

---

## 확인 방법

이 문서의 주장은 아래를 실행해 재확인할 수 있다.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck   # 통과 (2026-09-02, 이슈 #75 브랜치 기준 확인)
pnpm test            # 13파일 99케이스 통과 (2026-09-02, 이슈 #75 브랜치 기준 확인)
```
