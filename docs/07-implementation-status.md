# 07. 구현 현황

> 확인 기준일: **2026-08-20** / 확인 대상 브랜치: `Yumesa2025/roadmap`
> 부분 갱신: **2026-08-25**(검증기 메시지 — 5.2) · **2026-08-28**(`develop` 1b3e82a 머지 후) · **2026-08-29**(`develop` db7f8f4 머지 후)
>
> 부분 갱신은 **문서 전체 재검증이 아니다.** 각 갱신에서 실제로 확인한 항목만 아래에 적는다.
> 확인하지 않은 항목의 날짜는 올리지 않는다.
>
> | 확인일 | 확인한 항목 | 확인 방법 |
> |---|---|---|
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
| IR · 스키마 | **완료** | `src/features/editor/schema/` — JSON Schema 정본, 생성 타입, 검증기, 공개 index. v0.1로 동결([06-schema-freeze.md](06-schema-freeze.md)). `test/` 9파일 63케이스 통과 |
| Command Engine | **미착수** | `command.schema.ts` 없음, history manager 없음. `src/` 전체에 Command 관련 코드 0줄 |
| 자연어 변환 | **미착수** | 관련 코드 없음 |
| Ticket Compiler · Agent | **부분** | 코드 생성만 `skills/visual-spec-to-react/SKILL.md`가 에이전트 지시문 형태로 대신한다. 그 지시문에 **컴포넌트 분리 경계·의존성 순서(자식 먼저)·컴포넌트별 진행 보고**가 생겼다(같은 파일 "컴포넌트 단위로 분리 생성한다" 절). **다만 이는 문서이지 코드가 아니다** — 티켓 스키마도, 순서를 계산하거나 상태를 저장하는 코드도 `src/` 에 0줄이다 |
| localhost GUI · Canvas | **부분** | 캔버스가 스토어의 스펙을 실제로 그리고 클릭으로 노드를 선택할 수 있으며, 세부설정 패널 편집이 즉시 반영되고, Ctrl+휠 줌·휠 팬이 동작한다(`src/features/editor/ui/Canvas.tsx`, `ui/canvasLayout.ts`, `ui/PropertiesPanel.tsx`, `store/editorStore.ts`). File 메뉴로 **새 문서·열기·저장(JSON 파일 다운로드)도 된다**(`ui/MenuBar.tsx`, `ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts` — 이슈 #41이 지적한 것 중 New·Open·Save·Save as가 해소됐다). **안 되는 것 — Import(`ui/MenuBar.tsx` 의 `noop()`), 캔버스 드래그·리사이즈 편집, 레이어 트리(#43)·도구 모음(#44)의 스토어 연결, 그리고 지속성**: 앱을 열면 여전히 `store/seedSpec.ts` 의 하드코딩 스펙에서 시작하고 새로고침하면 편집 내용이 사라진다(`src/` 의 `localStorage` 사용처는 테마뿐 — `ui/theme-storage.ts`). 아래 표 참고 |
| Export · 검증 | **미착수** | [02-mvp-scope.md](02-mvp-scope.md)가 정의한 Export는 "생성된 React 코드를 결과 폴더로 내보내기"인데 그 코드는 없다. GUI에 내보내기 경로가 둘 생겼지만(File > Export·Save·Save as — `src/features/editor/ui/MenuBar.tsx`, 패널 하단의 `ui/properties/ExportJsonButton.tsx`) 둘 다 `store/exportSpec.ts` 의 `buildExportPayload` 를 거쳐 **스펙 JSON을 검증 후 내려받는 것**이라 02의 Export와 다르다 |

### GUI 각 영역의 실제 동작

| 파일 | 지금 하는 일 | 스토어 연결 |
|---|---|---|
| `src/app/App.tsx` | `ThemeProvider` + `EditorLayout` 렌더 | 라우팅 없음 |
| `src/features/editor/ui/EditorLayout.tsx` | 5개 영역 CSS Grid 배치. 패널 토글 시 좌우 컬럼을 접는다 | `viewStore.showPanels` |
| `src/features/editor/ui/MenuBar.tsx` (View 메뉴) | 줌 In/Out · Fit to Screen · 격자 표시 · 패널 표시가 **동작한다** | `viewStore` |
| `src/features/editor/ui/MenuBar.tsx` (File 메뉴) | New(`blankSpec` 로드) · Open(파일 선택 → 검증 → 로드) · Save · Save as · Export(스펙 JSON 다운로드)가 **동작한다**. **`noop()` 은 Import 하나만 남았다** | `editorStore.loadSpec` · `useEditorStore.getState().spec` |
| `src/features/editor/ui/Canvas.tsx` | 스펙 트리를 flex 로 렌더(박스·레이아웃·배경·테두리·타이포그래피), 클릭 시 노드 선택, 줌 배율·격자 표시. **Ctrl+휠 줌**을 `{ passive: false }` 리스너로 가로채고, 일반 휠 팬은 `overflow-auto` 네이티브 스크롤에 맡긴다 | `editorStore` · `viewStore` |
| `src/features/editor/ui/canvasLayout.ts` | `Canvas.tsx` 에서 분리한 순수 함수 `sizeToCss` · `boxStyle`. Figma 의 Fixed/Hug/Fill 을 flex 로 옮긴다 — 주축 `fill` → `flex: 1 1 0` + `min-*: 0`(형제끼리 공간 균등 분배), 교차축 `fill` → `align-self: stretch`, 부모가 없는 최상위 노드만 `100%` | 없음 (순수 함수 — `test/canvas-layout.test.ts` 8케이스) |
| `src/features/editor/ui/PropertiesPanel.tsx` 와 `ui/properties/`(파일 17개) | 선택 노드의 이름·표시·박스·레이아웃·배경·테두리·타이포그래피를 편집. 컨트롤은 `properties/fields/Field.tsx`(라벨·2열 행·인풋 스타일)와 `properties/fields/useDraftInput.ts`(타이핑 중에는 draft, 파싱에 성공하면 즉시 커밋)를 공유하고, Frame·Text 공통 Size 섹션은 `properties/SizeSection.tsx` 다. `border` 는 스키마상 세 필드가 모두 필수라 한 칸만 고쳐도 `properties/borderPatch.ts` 가 완전한 객체를 만들어 통째로 쓴다 | `properties/useNodeField.ts` 훅을 거쳐 `editorStore.setNodeField` |
| `src/features/editor/ui/LayerTree.tsx` | **하드코딩된 레이어 10개**(`LAYERS` 상수)를 표시. 선택은 로컬 하이라이트뿐 (이슈 #43) | 없음 |
| `src/features/editor/ui/Toolbar.tsx` | Select/Frame/Text/Hand 버튼. 활성 표시만 로컬 상태 (이슈 #44) | 없음 (도구 동작 없음) |
| `src/features/editor/store/editorStore.ts` | `spec` · `selectedId` · `select` · `setNodeField` · `loadSpec`(스펙 전체 교체 + 선택 해제 — New/Open 이 호출) ([EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md)) | — |
| `src/features/editor/store/exportSpec.ts` · `store/loadSpec.ts` | 스펙을 검증해 내보낼 JSON 을 만들거나(`buildExportPayload`), JSON 문자열을 파싱·검증한다(`parseSpecJson`). DOM 없는 순수 함수 | — |
| `src/features/editor/ui/exportSpecAsJson.ts` · `ui/openSpecFromFile.ts` | 위 순수 함수를 감싸는 파일 입출력 — `Blob`+`<a download>` 다운로드, `<input type=file>`+`FileReader` 읽기 | `editorStore.loadSpec` |
| `src/features/editor/store/blankSpec.ts` | File > New 가 로드하는 빈 스펙(root frame 하나, 자식 없음, 1440×900) | — |
| `src/features/editor/store/seedSpec.ts` | 초기 스펙을 하드코딩(`examples/dashboard-cards.json` 내용) | 앱 시작 시 `editorStore` 의 초기값. 자동 저장·복원은 없다 |
| `src/features/editor/store/viewStore.ts` | 줌(25~400%) · 격자 · 패널 표시 | — |

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
| `.visual-spec/` 작업공간 | `specs/` `generated/` `preview/` `assets/` `runtime/` | **미착수** | 작업공간을 만들거나 읽는 코드 0줄. `git grep "\.visual-spec"` 히트는 전부 문서와 스킬 지시문이고 `src/`·`test/`·`scripts/` 는 여전히 0건(2026-08-29 재확인). `skills/visual-spec-to-react/SKILL.md` 가 생성 위치를 `.visual-spec/generated/` 고정 경로로 정했지만 **경로 약속이지 구현이 아니다.** GUI 에 생긴 Open/Save 는 브라우저 파일 다이얼로그와 다운로드를 쓰는 것이라(`ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts`) **작업공간과는 다른 물건이다** (이슈 #42) |
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

02는 `Container / Text / Button / Input / Image` 5종을 요구한다. 스키마 v0.1은 `frame`, `text` 2종뿐이다(`src/features/editor/schema/visual-spec.schema.json` 의 `$defs.Node`).

| 02가 요구한 노드 | v0.1 | 성격 |
|---|---|---|
| Container | `frame` 으로 충족 | 이름만 다르다 |
| Text | `text` 로 충족 | — |
| Image | 없음 | **의도적 제외.** 06이 `image`를 "지원하지 않는다"로, 05가 `ImageNode`를 MVP 제외 범위로 명시했다 |
| Button | 없음 | **미조정.** 05·06 어느 쪽의 제외 목록에도 없다. 요구되지만 구현도 제외 선언도 되지 않았다 |
| Input | 없음 | **미조정.** 같음 |

### 레이아웃

02는 `Row / Column / Grid` 를 요구한다. 정본 스키마의 `$defs.Layout.direction` 은 `["row", "column"]` 두 값만 허용한다.

- Row · Column — 충족
- **Grid — 없다.** 05·06의 제외 목록 어디에도 Grid가 없다. 노드 타입의 Button·Input과 같은 미조정 항목이다.

### 크기

02의 `Fixed / Fill / Hug` 는 v0.1의 `Size = number | "fill" | "auto"` 로 전부 충족된다.
다만 06이 밝힌 대로 **`"fill"` 이 교차축에서 무엇을 의미하는지는 계약에 포함되지 않았다.** Renderer 구현 시점에 정해야 한다.

> Button · Input · Grid 3건은 "구현이 안 됐다"기보다 **02와 05·06 사이가 정리되지 않은 상태**다.
> 스키마를 넓힐지 02의 범위를 줄일지는 팀이 정할 일이며, 스키마를 건드린다면 [06-schema-freeze.md](06-schema-freeze.md)의 변경 절차를 따라야 한다.

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
| 유효 예제 4개 | `examples/*.json` | 검증 통과 |
| 무효 예제 8개 | `examples/invalid/*.json` | 검증기가 잡아야 하는 문서들 |
| 테스트 | `test/validate.test.ts`(18) · `test/editor-store.test.ts`(10) · `test/canvas-layout.test.ts`(8) · `test/export-spec.test.ts`(6) · `test/border-patch.test.ts`(5) · `test/view-store.test.ts`(5) · `test/schema.test.ts`(4) · `test/public-api.test.ts`(4) · `test/load-spec.test.ts`(3) | **9파일 63케이스 전부 통과** (2026-08-29 확인) |
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

### 제안 3 — Button · Input · Grid는 코드보다 문서 결정이 먼저

3절의 미조정 3건은 구현 과제가 아니라 **범위 결정 과제**다. 스키마를 넓힐지 02의 범위를 줄일지 정하지 않은 채로 구현에 들어가면 [06-schema-freeze.md](06-schema-freeze.md)의 변경 절차를 우회하게 된다. 결정 결과는 02 또는 05·06에 반영하고, 미확정으로 남는다면 [open-questions.md](open-questions.md)로 옮기는 편이 낫다.

---

## 확인 방법

이 문서의 주장은 아래를 실행해 재확인할 수 있다.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck   # 통과 (2026-08-29 확인)
pnpm test            # 9파일 63케이스 통과 (2026-08-29 확인)
```
