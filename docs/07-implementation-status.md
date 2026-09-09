# 07. 구현 현황

> 확인 기준일: **2026-08-20** / 확인 대상 브랜치: `Yumesa2025/roadmap`
> 부분 갱신: **2026-08-25**(검증기 메시지 — 5.2) · **2026-08-28**(`develop` 1b3e82a 머지 후) · **2026-08-29**(`develop` db7f8f4 머지 후) · **2026-09-01**(`develop` a807bc4 머지 후) · **2026-09-01**(`develop` 1b73ccd 머지 후 — 같은 날 2차) · **2026-09-01**(`develop` 020be51 머지 후 — 같은 날 3차) · **2026-09-02**(이슈 #75, PR 작성 전 — `75--button-input-grid-nodes` 브랜치) · **2026-09-02**(Command Engine 타입/적용기/history — 이슈 #73, `73--command-engine` 브랜치, PR 작성 전) · **2026-09-02**(Ticket 스키마/컴파일러 — 이슈 #74, `74--ticket-schema` 브랜치, PR 작성 전) · **2026-09-08**(`develop` f583647 머지 후 — 홈 화면·레이어 트리·도구 모음·`editorStore` 계약·스키마 v0.1/v0.2 병행 상태) · **2026-09-08**(같은 날 2차 — 예제·오류 코드·패널 파일/필드 집계·`setNodeField` 호출 지점·5.2 실측치) · **2026-09-08**(`develop` a3fb385 머지 후 — 같은 날 3차, 테스트 집계 재실측과 Ticket 서술 대조)
>
> 부분 갱신은 **문서 전체 재검증이 아니다.** 각 갱신에서 실제로 확인한 항목만 아래에 적는다.
> 확인하지 않은 항목의 날짜는 올리지 않는다.
>
> | 확인일 | 확인한 항목 | 확인 방법 |
> |---|---|---|
> | 2026-09-08 (#89) | "GUI 각 영역의 실제 동작" 표의 `ui/PropertiesPanel.tsx` 와 `ui/properties/` 행 | `properties/borderPatch.ts`·`properties/FrameProperties.tsx`·`ui/PropertiesPanel.tsx` 편집·열람. `background` 도 같은 구조인지 정본 스키마에서 확인 — `Background` 는 칸이 `color` 하나뿐이고 `required` 라 반쪽 객체도 지울 항등값도 없다(고칠 것 없음). `border: undefined` 가 Ajv 검증을 통과하는지 실측(통과). `pnpm test`(**26파일 275케이스** — `develop` f768bb4(PR #96·#100·#99 머지) 위로 리베이스한 기준. 그 시점 `develop` 의 26파일 266케이스에 이 브랜치가 `test/border-patch.test.ts` 에 더한 9케이스가 붙은 값이다) |
> | 2026-09-08 (#90) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx`·`ui/canvasLayout.ts` 행, `ui/selectionRect.ts` 행 신규 | 선택 표시를 노드 인라인 `outline` 에서 캔버스 오버레이로 옮기며 두 파일 편집·열람. `pnpm test`(**26파일 262케이스** — `develop` 87f6bad 위로 리베이스한 기준. 바로 아래 3차 행이 잰 25파일 250케이스에 이 브랜치의 `test/selection-rect.test.ts` 12케이스가 더해진 값이다. #97·#98 은 문서 전용이라 집계를 바꾸지 않았다) |
> | 2026-09-08 (3차, a3fb385) | 1절 IR·스키마 행의 테스트 집계 · 4절 테스트 행 · 아래 "확인 방법" | 이 브랜치를 `develop` a3fb385(PR #81 Ticket 스키마 머지) 위로 리베이스한 뒤 `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm test`(**25파일 250케이스**) 출력에서 파일 수·케이스 수를 다시 읽음 |
> | 2026-09-08 (3차, a3fb385) | 1절 Ticket Compiler·Agent 행의 케이스 수 · 2절 Ticket 스키마 v0.1 행 | `ls src/features/editor/ticket/`(3파일) · 세 파일의 `export` 목록과 `ticket/types.ts` 전문 열람(`Ticket` 은 `id`·`componentName`·`kind`·`instances`·`dependsOn`·`status` — 2절 서술과 일치) · `git grep "compileTickets" src/ test/` 로 **`ticket/` 밖 `src/` 호출자 0건**(히트는 `test/compile-tickets.test.ts` 뿐)을 재확인. **케이스 수만 어긋나 고쳤다** — #81 이 적은 14케이스는 그 뒤 같은 브랜치의 4179c93·f93a102 가 케이스를 늘리면서 **18개**가 됐다 |
> | 2026-09-08 (2차) | 4절 유효 예제 행 · 4절 끝의 구조 오류 코드 종류 | `ls examples/*.json` **8개**(`examples/invalid/` 하위 8개는 별도 집계) · `schema/validate.ts:7` 의 `IssueCode` 유니온 멤버를 세어 **8종** 확인 |
> | 2026-09-08 (2차) | "GUI 각 영역의 실제 동작" 표의 `ui/PropertiesPanel.tsx`/`ui/properties/` 행 · 같은 표 `store/measureStore.ts` 행 괄호 안의 계약 멤버 수 서술 | `find src/features/editor/ui/properties -type f` **23개**. `ui/PropertiesPanel.tsx` · `properties/PageProperties.tsx` · `properties/resolutionPresets.ts` · `properties/fields/index.ts` 전문 열람 |
> | 2026-09-08 (2차) | 1절 표 아래 `setNodeField` 문단 · 6절 제안 1 의 호출 지점·필드 수 | `git grep -n "setNodeField" src/` 로 **실제 호출 지점 2곳**(`properties/useNodeField.ts:28` · `ui/LayerTree.tsx:116`) 실측 — 나머지 히트는 정의와 주석이다. `git grep -n "useNodeField" src/` 로 훅 호출 지점 실측(`ui/PropertiesPanel.tsx` 2 · `properties/EffectsSection.tsx` 3 · `properties/FrameProperties.tsx` 12 · `properties/TextProperties.tsx` 10 = **27**), `git grep -n "setPageField(" src/features/editor/ui/`(`properties/PageProperties.tsx` 4칸) |
> | 2026-09-08 (2차) | 5.2 의 실측 이슈 개수 | `validateVisualSpec` 과 같은 설정(`new Ajv2020({ allErrors: true })` + `ajv.compile(visualSpecJsonSchema)`)으로 `examples/invalid/text-without-content.json` 을 넣은 **일회성 실행** — **16개**. 테스트로 남기지 않았다 |
> | 2026-09-08 | "GUI 각 영역의 실제 동작" 표의 `src/app/App.tsx`·`ui/LayerTree.tsx`·`ui/Toolbar.tsx` 행(이번에 추가한 `ui/HomeScreen.tsx`·`ui/homePreview.ts`·`store/navigationStore.ts`·`store/toolStore.ts`·`store/createNode.ts`·`ui/selection.ts` 행 포함) · 1절 GUI·Canvas 행의 "안 되는 것" 목록 · 2절 홈(진입) 화면 행 | 위 파일 전문 열람. `ui/Canvas.tsx` 는 도구 관련 부분만 열람(`insertNewNode`·`handleNodeClick`·`handleBackgroundClick`·hand 팬 리스너 — 나머지 서술은 2026-09-04 확인 상태 그대로다). `git grep "LAYERS" src/` 히트 **0건**, `git grep "selectPage" src/` · `"addPage"` · `"removePage"` 히트가 `store/editorStore.ts` 의 정의뿐임을 확인. `gh issue view 43`·`44` 둘 다 **CLOSED** |
> | 2026-09-08 | 같은 표의 `store/editorStore.ts` 행 — 계약 멤버 수 | `EditorState` 인터페이스 전문 열람 후 `docs/EDITOR_STORE_CONTRACT.md` §2("계약의 전부 (11개)")와 1:1 대조 — 목록·개수 일치 |
> | 2026-09-08 | 1절 IR·스키마 행(스키마 v0.1/v0.2 병행 상태 포함) · 4절 테스트 행 · 아래 "확인 방법" | `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm test`(24파일 232케이스) 출력에서 파일 수·케이스 수를 읽음. `visual-spec.schema.json` 의 루트와 `$defs.ProjectSpec`·`PageId` 를 실제 JSON 으로 출력해 확인하고 `schema/migrate.ts` · `schema/validate.ts` 의 `validateProjectSpec` · `store/exportSpec.ts` 열람 |
> | 2026-09-08 | 3절 노드 타입·레이아웃·크기 표 — **고칠 것이 없었다** | `$defs.Node.oneOf`(5갈래) · `$defs.ButtonNode`/`InputNode` 의 `required` · `$defs.Layout.direction`(`row`/`column`/`grid`)·`columns` · `$defs.Size` 를 실제 JSON 으로 출력해 3절 서술과 대조 |
> | 2026-09-04 (#78) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx`·`ui/canvasLayout.ts`·`ui/PropertiesPanel.tsx` 행 | 세 파일과 `ui/properties/`(EffectsSection·shadowPatch·radiusPatch·effectPatch 신규) 전문 편집·열람. `pnpm test`(22파일 208케이스) |
> | 2026-09-04 (#78) | 4절 유효 예제 행 | `examples/card-effects.json` 신규. `visual-spec.schema.json` 에 Shadow·Opacity·Blur·StrokeAlign·Radius 추가 후 `pnpm run generate:types` |
> | 2026-09-02 (#75) | 3절 노드 타입·레이아웃 표, 6절 제안 3, 4절 유효 예제·테스트 행, 1절 IR·스키마 행 | `visual-spec.schema.json`에 `ButtonNode`/`InputNode`/`Layout.direction: "grid"` 추가 후 `pnpm run generate:types`(diff 없음) · `pnpm test`(13파일 99케이스) · `examples/form-grid.json` 신규 예제로 검증. 아직 `develop`에 머지되지 않은 브랜치 위에서 작업 중이라 push/PR 전 상태다 |
> | 2026-09-02 (#75) | "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx`·`ui/canvasLayout.ts`·`ui/PropertiesPanel.tsx` 행 | 세 파일 전문 편집·열람 — `Canvas.tsx`에 `button`/`input` 렌더 분기와 `displayStyle()`(grid), `canvasLayout.ts`의 `boxStyle()`에 grid 아이템 분기, `PropertiesPanel.tsx`의 fallback 안내 문구 일반화 |
> | 2026-09-02 | 1절 Command Engine 행, 2절 Command 스키마 v0.1 행·Undo/Redo 행 | `src/features/editor/command/{types,applyCommand,history}.ts` 신설. `pnpm test`(`apply-command.test.ts` 18케이스, `history.test.ts` 6케이스) 통과 확인. `editorStore`·`PropertiesPanel`을 이 위로 옮기는 건 이번에 **하지 않았다** — 아래 서술 참고 |
> | 2026-09-02 | 1절 Ticket Compiler·Agent 행, 2절 Ticket 스키마 v0.1 행 | `src/features/editor/ticket/{types,compileTickets,ticketStatus}.ts` 신설. `pnpm test`(`compile-tickets.test.ts` 14케이스) 통과 확인. 규칙은 `skills/visual-spec-to-react/SKILL.md`의 기존 서술을 그대로 코드로 옮긴 것 — 실행 루프에 연결하는 건 이번에 **하지 않았다** |
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
> **2026-09-08에 재확인하지 않은 항목** — 위 표의 "2026-09-08" 세 행 묶음(1차·2차·3차)에 없는 모든 항목.
> 이 갱신은 **07의 서술이 코드와 어긋난 것으로 지목된 항목만** 다시 봤다.
> 1차·2차는 `develop` f583647 위에서, 3차는 `develop` a3fb385(PR #81 머지) 위로 리베이스한 뒤에 봤다.
> 1차는 홈 화면·레이어 트리·도구 모음·`editorStore` 계약·테스트 집계와 스키마 v0.1/v0.2 병행 상태를,
> 2차는 예제·오류 코드 개수, 패널 파일·필드 집계, `setNodeField` 호출 지점, 5.2 의 실측 수치를,
> 3차는 테스트 집계 재실측과 Ticket 관련 두 행의 코드 대조를 봤다.
> `ui/Canvas.tsx`(도구 관련 부분 제외)·`ui/canvasLayout.ts` 행의 본문 서술, `ui/MenuBar.tsx` 행,
> 1절 자연어 변환·Export 행, 2절의 나머지 행, 4절의 스킬·CI 행, 5.1·5.3, 6절 제안 2·3 은
> 이전 확인 상태 그대로이며 날짜를 올리지 않았다.
> Command Engine · Command 스키마 · Undo/Redo 관련 행도 이번에 보지 않았다 — 그 셋은 PR #79 가
> 스스로 갱신한 내용 그대로다(위 표의 "2026-09-02"(Command Engine) 행).
> **Ticket 관련 두 행은 PR #81 이 써 넣은 것이라 리베이스로 딸려 들어왔다** — 3차에 코드와 대조해
> 케이스 수 한 곳만 고쳤고, 나머지 서술은 #81 의 기록 그대로다.
>
> **2026-09-02(#75)에 재확인하지 않은 항목** — 위 표의 "#75" 행에 없는 모든 항목.
> 이 갱신은 `develop` 020be51 위에 올린 이슈 #75 브랜치(`75--button-input-grid-nodes`)에서
> 직접 건드린 스키마·Canvas·PropertiesPanel·예제·테스트 파일에 걸린 서술만 다시 봤다.
> **이 브랜치는 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다** — 같은 시점에 열려
> 있던 PR #77(홈 화면)·PR #79(Command Engine)·PR #81(Ticket 스키마)도 마찬가지로 `develop`에
> 없으므로, 이 문서의 Command Engine·Ticket Compiler·홈 화면 관련 서술은 여전히 020be51
> 기준 그대로이며 날짜를 올리지 않았다. 그 세 항목은 각 PR이 머지된 뒤 별도로 갱신한다.
>
> > **2026-09-08 덧붙임 — 위 문단은 그때의 기록이고, 셋 다 그 뒤 `develop`에 머지됐다.**
> > PR #77(홈 화면) → b3f14bf · PR #79(Command Engine) → f583647 · PR #81(Ticket 스키마) → a3fb385.
> > Command Engine·Ticket Compiler 관련 서술은 각 PR이 스스로 갱신했고(위 표의 "2026-09-02" 두 행),
> > 홈 화면은 2026-09-08 1차에 이 문서가 갱신했다. **"`develop`에 없다"는 위 서술을 지금 상태로
> > 읽으면 안 된다.**
>
> **2026-09-02(Command Engine)에 재확인하지 않은 항목** — 위 "2026-09-02"(Command Engine) 행에
> 적은 것 말고는 전부 이전 확인 상태 그대로다. 이번 갱신은 재검증이 아니라 **새 코드
> 추가**(`command/` 신설)이고, `editorStore`·`PropertiesPanel`·`docs/EDITOR_STORE_CONTRACT.md`는
> 건드리지 않았다 — 1절 GUI·Canvas 행과 "GUI 각 영역의 실제 동작" 표의 관련 서술, 이슈 #40
> 서술은 그대로 유효하다.
>
> **2026-09-02(Ticket)에 재확인하지 않은 항목** — 위 "2026-09-02"(Ticket) 행에 적은 것 말고는
> 전부 이전 확인 상태 그대로다. 이번 갱신도(Command Engine 갱신과 마찬가지로) 재검증이 아니라
> **새 코드 추가**(`ticket/` 신설)이고, 실행 루프·GUI·`editorStore`는 건드리지 않았다.
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
| IR · 스키마 | **완료** | `src/features/editor/schema/` — JSON Schema 정본, 생성 타입, 검증기, 공개 index. v0.1로 동결([06-schema-freeze.md](06-schema-freeze.md)). **다만 지금은 v0.1과 v0.2(`ProjectSpec`)가 병행한다** — **정본 스키마의 루트는 아직 v0.1이다**(`version` 이 `const: "0.1"`, `required` 가 `["version", "screen"]`). v0.2 는 `$defs` 에 `ProjectSpec`(`version: "0.2"` · `name` · `pages` · `pageOrder`)·`PageId` 가 추가된 형태로만 들어와 있고, 각 페이지는 v0.1 의 `ScreenSpec` 그대로다. **반면 런타임 상태는 v0.2 다** — `store/editorStore.ts` 의 초기값이 `migrateV01(seedSpec)`(`schema/migrate.ts`)이라 스토어는 `spec: ProjectSpec` + `activePageId` 를 들고, `ui/Canvas.tsx`·`ui/LayerTree.tsx` 는 `spec.pages[activePageId]` 로 읽는다. **저장되는 파일도 v0.2 다** — `store/exportSpec.ts` 가 `validateProjectSpec`(`schema/validate.ts` — `$defs.ProjectSpec` 로 검증하고 `pageOrder` 불일치를 `page-order-mismatch` 로 잡는다)을 거쳐 `ProjectSpec` 을 그대로 내려받는다. v0.1 문서를 열면 `loadSpec` 이 `migrateV01` 로 넓히므로 **예전 파일도 그대로 열린다**(반대 방향 `toVisualSpec` 도 있지만 그걸 고르는 UI 는 없다). 즉 **아직 v0.2 로 옮겨지지 않은 것은 정본 스키마의 루트 선언과 동결 문서**이고, 코드와 실제 데이터는 이미 v0.2 다. `test/` 25파일 250케이스 통과(2026-09-08 3차, `develop` a3fb385 기준) |
| Command Engine | **부분** | `src/features/editor/command/`에 Command 타입 5종(`types.ts` — createNode/updateNode/deleteNode/moveNode/setLayout), 순수 적용기(`applyCommand.ts` — 규칙 위반 시 예외 없이 원본 spec 참조를 그대로 돌려준다), 범용 undo/redo 스택(`history.ts`)이 생겼다(`test/apply-command.test.ts` 18케이스 · `test/history.test.ts` 6케이스). **다만 아무도 이걸 안 쓴다.** `editorStore`도 `PropertiesPanel`도 여전히 `setNodeField`를 직접 호출한다 — 아래 §의 이슈 #40 서술 그대로다. `docs/EDITOR_STORE_CONTRACT.md`가 `setNodeField`를 이미 팀 계약(규칙 1, 4)으로 못박아 둔 상태라, GUI를 이 위로 옮기는 건 별도 팀 합의 없이는 하지 않기로 했다(#73 논의) |
| 자연어 변환 | **미착수** | 관련 코드 없음 |
| Ticket Compiler · Agent | **부분** | 코드 생성은 여전히 `skills/visual-spec-to-react/SKILL.md`가 에이전트 지시문 형태로 대신한다("컴포넌트 단위로 분리 생성한다" 절). **다만 그 지시문이 정한 규칙(컴포넌트 경계·반복 형제 그룹화·의존성 순서)이 이제 `src/features/editor/ticket/`에 순수 함수로도 존재한다**(`compileTickets` — `test/compile-tickets.test.ts` **18케이스**, `toPascalCase` 포함. #81 이 쓸 당시 14케이스였는데 같은 브랜치의 4179c93·f93a102 가 `structuralKey` 의 비교 기준과 순환 방어를 더하면서 늘었다 — 2026-09-08 3차 실측). 최소 상태 관리(`ticketStatus.ts` — pending/in-progress/done/failed, `isReady`/`readyTickets`)도 있다. **다만 이 코드를 실제로 부르는 곳이 없다** — Agent 실행 루프도, GUI 상태 패널도 아직 이 함수들을 쓰지 않는다. 스킬 지시문과 이 코드가 같은 규칙을 따르는지는 사람이 대조해서 맞춘 것이지 하나가 다른 하나를 생성하는 관계가 아니다 |
| localhost GUI · Canvas | **부분** | 캔버스가 스토어의 스펙을 실제로 그리고 클릭으로 노드를 선택할 수 있으며, 세부설정 패널 편집이 즉시 반영되고, Ctrl+휠 줌·휠 팬이 동작한다(`src/features/editor/ui/Canvas.tsx`, `ui/canvasLayout.ts`, `ui/PropertiesPanel.tsx`, `store/editorStore.ts`). File 메뉴로 **새 문서·열기·저장(JSON 파일 다운로드)도 된다**(`ui/MenuBar.tsx`, `ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts` — 이슈 #41이 지적한 것 중 New·Open·Save·Save as가 해소됐다). **Import 도 된다** — 이미지를 골라 선택된 프레임(없으면 root)의 자식으로 `image` 노드를 삽입한다(`ui/importImageFromFile.ts`, 2026-09-01 PR #69). 이로써 **File 메뉴에 미구현 항목이 없다.** **레이어 트리와 도구 모음도 스토어에 연결됐다** — 트리가 활성 페이지의 실제 노드 트리를 그리고(이슈 #43 해소), frame·text 도구로 캔버스를 클릭하면 노드가 실제로 만들어진다(이슈 #44 해소). 아래 표의 `ui/LayerTree.tsx`·`ui/Toolbar.tsx` 행 참고. **안 되는 것 — 캔버스 드래그·리사이즈 편집, 그리고 지속성**: 앱을 열면 여전히 `store/seedSpec.ts` 의 하드코딩 스펙에서 시작하고 새로고침하면 편집 내용이 사라진다(`src/` 의 `localStorage` 사용처는 테마뿐 — `ui/theme-storage.ts`). 아래 표 참고 |
| Export · 검증 | **미착수** | [02-mvp-scope.md](02-mvp-scope.md)가 정의한 Export는 "생성된 React 코드를 결과 폴더로 내보내기"인데 그 코드는 없다. GUI에 내보내기 경로가 둘 생겼지만(File > Export·Save·Save as — `src/features/editor/ui/MenuBar.tsx`, 패널 하단의 `ui/properties/ExportJsonButton.tsx`) 둘 다 `store/exportSpec.ts` 의 `buildExportPayload` 를 거쳐 **스펙 JSON을 검증 후 내려받는 것**이라 02의 Export와 다르다 |

### GUI 각 영역의 실제 동작

| 파일 | 지금 하는 일 | 스토어 연결 |
|---|---|---|
| `src/app/App.tsx` | `ThemeProvider` 안에서 `navigationStore` 의 `screen` 값으로 **`HomeScreen`(`"home"`) 과 `EditorLayout`(`"editor"`) 을 갈라 렌더**한다(PR #77). 시작 화면은 홈이다 | `navigationStore.screen` |
| `src/features/editor/ui/HomeScreen.tsx` 와 `ui/homePreview.ts` | 홈(진입) 화면. 프로젝트 카드 목록 · 카드마다 **스펙에서 즉석 렌더한 미리보기**(캡처 이미지를 저장하지 않는다) · 이름 · `페이지 N개 · 가로×세로` · 상단 "+ 새 화면"(`blankSpec` 로드 후 에디터로 이동). 카드를 누르면 에디터로 간다. **목록은 화면이 아니라 프로젝트를 나열한다**(v0.2 — 파일 1개 = 프로젝트 1개). 미리보기는 `ui/homePreview.ts` 의 순수 함수 `previewFrameStyle`·`previewTextStyle`·`previewImageStyle`·`previewButtonStyle`·`previewInputStyle`·`previewScale` 이 만든다 — `Canvas.tsx` 가 스스로 "임시 스탠드인"이라 export 를 두지 않아 **일부러 따로 다시 만든 코드**다(파일 상단 주석). **04 §2 의 "상태 1(저장된 화면이 있을 때)"만 구현했다** — "상태 2(첫 실행, 빈 목록, 세 갈래 선택지)"는 없다(파일 상단 주석: 워크스페이스가 없어(#42) 프로젝트가 항상 정확히 1개라 목록이 비거나 여럿이 되는 경우 자체가 지금 데이터 모델에 없다) | `editorStore.spec`·`loadSpec` · `navigationStore.openEditor` (`test/home-preview.test.ts` 3케이스) |
| `src/features/editor/store/navigationStore.ts` | 홈 ↔ 에디터 전환만 담는 스토어(`screen`·`openEditor`·`openHome`). **라우터 라이브러리를 쓰지 않는다** — 화면이 둘뿐이고 URL 을 공유할 필요가 없는 로컬 앱이라는 판단이다(파일 주석). 에디터에서 홈으로 나가는 길은 `ui/MenuBar.tsx` 의 로고·브랜드명 클릭이다(#72) | — (`test/navigation-store.test.ts` 3케이스) |
| `src/features/editor/ui/EditorLayout.tsx` | 5개 영역 CSS Grid 배치. 패널 토글 시 좌우 컬럼을 접는다 | `viewStore.showPanels` |
| `src/features/editor/ui/MenuBar.tsx` (View 메뉴) | 줌 In/Out · Fit to Screen · 격자 표시 · 패널 표시 · **채우기(Fill Viewport)** 가 **동작한다** | `viewStore` |
| `src/features/editor/ui/MenuBar.tsx` (File 메뉴) | New(`blankSpec` 로드) · Open(파일 선택 → 검증 → 로드) · Save · Save as · Export(스펙 JSON 다운로드) · **Import(이미지 선택 → 삽입)**가 전부 **동작한다**. **`noop()` 은 0개다** — 2026-09-01(PR #69)에 Import 가 연결되면서 File 메뉴에 미구현 항목이 없어졌다(`git grep "noop" src/features/editor/ui/MenuBar.tsx` 히트 0건) | `editorStore.loadSpec` · `editorStore.insertNode` · `useEditorStore.getState().spec` |
| `src/features/editor/ui/Canvas.tsx` | 스펙 트리를 flex/grid 로 렌더(박스·레이아웃·배경·테두리·타이포그래피·그림자·불투명도·블러), 클릭 시 노드 선택, 줌 배율·격자 표시. **테두리·그림자는 `canvasLayout.strokeAndShadowStyle` 이 `box-shadow` 한 문자열로 합성하고, 불투명도·블러는 `effectStyle` 이 낸다**(2026-09-04·이슈 #78 — `frame` 은 둘 다, `text`·`image` 는 `effectStyle` 만, `button`·`input` 은 `Border` 를 공유하므로 테두리 정렬만). **`image` 노드는 빈 `div` 의 `background-image` 로 그린다**(`imageStyle()` — `fit` 의 `cover`/`contain` 은 `background-size` 로 그대로 넘기고 `fill` 만 `100% 100%` 로 옮긴다. `background-position: center`, 반복 없음. 자식을 받지 않는다). **`button`/`input` 노드는 각각 `<div>` 로 그린다**(`buttonStyle()`/`inputStyle()`, 2026-09-02·이슈 #75 — `content`/`placeholder` 텍스트를 보여주기만 하고 실제 클릭·입력 동작은 없다). **`layout.direction: "grid"` 는 `display: grid` + `layout.columns` 만큼의 `gridTemplateColumns` 로 그린다**(`displayStyle()`, 같은 PR — 균등 자동 배치뿐, 셀 지정 없음. `mainAxis`/`crossAxis` 무시). **아트보드를 `spec.screen.size` 로 고정**하고 좌상단 기준 `transform: scale` 로 확대한다 — 자식이 커져도 아트보드는 그대로고 넘치는 만큼 밖으로 삐져나온다. 아트보드를 감싼 바깥 박스에 `size × 배율` 크기를 줘 **스크롤 범위를 확대율과 맞춘다**(`transform` 은 레이아웃 박스를 바꾸지 않아, 이 박스가 없으면 25%인데도 100% 크기의 빈 공간이 남는다). 아트보드 위에 화면 이름을 띄운다. `ResizeObserver` 로 **뷰포트 실측 크기**를, `spec.screen.size` 변화로 **아트보드 크기**를 `viewStore` 에 올리고, 뷰포트를 처음 받은 시점과 페이지를 바꿀 때 `fitToScreen()` 을 부른다(처음 열었을 때 아트보드 전체가 보이게). **채우기 모드에서는 뷰포트·해상도가 바뀔 때마다 다시 맞춘다** — "뷰포트 가로 = 페이지 가로"가 상시 규칙이라 한 번만 맞추면 안 된다. 채우기 모드에서는 캔버스 여백(`p-8`)·격자·그림자·이름표도 함께 걷는다. 스크롤바 등장/소멸이 `clientWidth` 를 흔들어 배율이 진동하지 않도록 `scrollbar-gutter: stable` 로 스크롤바 자리를 고정한다. 선택 노드가 실제로 그려진 px 도 재서 `measureStore` 에 올린다. **선택 표시는 노드가 아니라 아트보드 옆 오버레이에 그린다**(2026-09-08·이슈 #90 — 노드에 인라인 `outline` 으로 얹으면 그 노드의 `opacity`·`blur` 를 선택 표시까지 함께 받아 흐려진다. 오버레이는 확대되지 않는 바깥 상자에 있어 좌표를 실측 그대로 쓰고 테두리도 확대율과 무관하게 2px 이다. `pointer-events-none` 이라 클릭은 아래 노드로 내려간다. 다시 재는 시점은 매 렌더 + 아트보드 하위 `style`·자식·**글자** 변화(`MutationObserver`) + 대상 크기 변화(`ResizeObserver`) 셋이고(`characterData` 를 함께 보는 이유는 React 가 문자열 자식 하나짜리 엘리먼트를 고칠 때 `firstChild.nodeValue` 에 직접 대입해 `childList` 로는 안 잡히기 때문이다 — 형제 텍스트가 길어지며 선택 노드를 밀어내는 경우가 그렇다), 스크롤·팬은 대상과 기준을 같은 순간에 재 오프셋이 상쇄되므로 듣지 않는다. **모서리 반경은 일부러 따라가지 않는다** — 얹을 수는 있지만(`outline` 은 요소의 `border-radius` 를 따라 그려진다) 선택 표시는 노드가 차지한 영역을 알려주는 편집기 UI라 직사각형 바운딩 박스로 둔다. Figma 도 반경과 무관하게 직사각형이다). **Ctrl+휠 줌**을 `{ passive: false }` 리스너로 가로채고, 일반 휠 팬은 `overflow-auto` 네이티브 스크롤에 맡긴다. **클릭·팬 동작은 활성 도구(`toolStore`)에 따라 갈린다** — `select` 는 선택, `frame`·`text` 는 노드 생성, `hand` 는 팬이다(위 `ui/Toolbar.tsx` 행에 자세히 적었다. 도구 값은 구독하지 않고 `getState()` 로 읽는다 — 재귀 렌더 트리에 핸들러를 내려보내거나 도구가 바뀔 때마다 트리를 다시 그리지 않기 위해서다) | `editorStore` · `viewStore` · `measureStore` · `toolStore` |
| `src/features/editor/ui/canvasLayout.ts` | `Canvas.tsx` 에서 분리한 순수 함수 `sizeToCss` · `boxStyle` · `radiusCss` · `strokeAndShadowStyle` · `effectStyle`. Figma 의 Fixed/Hug/Fill 을 flex 로 옮긴다 — 주축 `fill` → `flex: 1 1 0` + `min-*: 0`(형제끼리 공간 균등 분배), 교차축 `fill` → `align-self: stretch`, 부모가 없는 최상위 노드만 `100%`. **`parentDirection === "grid"` 도 최상위 노드와 동일하게 취급한다**(2026-09-02, 이슈 #75 — flex-grow/shrink 기반 배분이 grid 아이템에는 뜻이 없어서다). **`strokeAndShadowStyle` 은 테두리 정렬과 그림자를 한 `box-shadow` 로 합친다**(2026-09-04·이슈 #78 — 둘이 같은 CSS 속성 한 칸을 두고 다투기 때문이다. 테두리 고리를 앞에 적어 그림자에 묻히지 않게 한다). 정렬을 `outline` 으로 그리지 않는다 — 브라우저 포커스 링과 겹치고, `box-shadow` 로 그리면 그림자와 한 문자열에 합칠 수 있다(2026-09-04 시점의 이유는 "선택 표시가 `outline` 을 이미 쓰고 있어서"였는데, 2026-09-08·이슈 #90 으로 선택 표시가 오버레이로 빠지면서 그 이유는 사라졌다). `inside` 만 CSS `border` 속성을 유지한다(`box-shadow` 는 레이아웃 박스를 차지하지 않는데 기존 문서가 전부 `inside` 라 갈아타면 안쪽 여백이 달라진다). `radiusCss` 는 모서리별 반경을 CSS 순서(좌상 → 우상 → 우하 → 좌하)로 옮긴다 | 없음 (순수 함수 — `test/canvas-layout.test.ts` 26케이스) |
| `src/features/editor/ui/selectionRect.ts` | 선택 표시 오버레이가 쓸 사각형 계산(2026-09-08·이슈 #90). `relativeRect` 는 뷰포트 좌표 둘을 상대 좌표로 바꾼다 — 같은 순간에 잰 두 값이라 스크롤 오프셋이 상쇄되고, 그래서 캔버스 스크롤·팬 중에는 다시 재지 않아도 표시가 제자리에 남는다. 대상이 `transform: scale` 안에 있어 값이 이미 확대돼 있는데, 오버레이를 확대되지 않는 바깥 상자에 두므로 나눠 되돌리지 않는다. `sameRect` 는 값이 그대로일 때 상태를 바꾸지 않게 한다(측정을 렌더마다 하므로 이 비교가 없으면 측정 → setState → 렌더 → 측정이 끝나지 않는다). `nodeSelector` 는 노드 id 를 `[data-node-id="…"]` 로 감싸며 따옴표·역슬래시를 이스케이프한다(가져온 스펙의 id 는 무엇이든 될 수 있다). `DOMRect` 를 참조하지 않고 네 값을 구조로만 정의한다 — `test/` 를 포함하는 `tsconfig.node` 의 `lib` 에 DOM 이 없다 | 없음 (순수 함수 — `test/selection-rect.test.ts` 12케이스) |
| `src/features/editor/ui/PropertiesPanel.tsx` 와 `ui/properties/`(파일 **23개**, 2026-09-08 실측) | 선택 노드의 이름·표시·박스·레이아웃·배경·테두리·타이포그래피·효과(그림자·불투명도·블러)를 편집. **노드 말고 페이지 자체도 편집한다** — `properties/PageProperties.tsx` 가 **페이지 이름과 해상도(가로·세로 px)** 를 `editorStore.setPageField` 로 고친다(패널에서 `setNodeField` 가 아닌 경로는 이 섹션뿐이다). 이 섹션은 **root 를 골랐거나 아무것도 고르지 않았을 때** 패널 맨 위에 얹힌다(파일 주석 — 페이지 행이 곧 그 페이지의 root 프레임이고, 빈 안내문만 띄우느니 화면 크기를 바꿀 자리를 두는 편이 낫다는 판단이다). 해상도는 `properties/resolutionPresets.ts` 의 프리셋 14종(FHD·MacBook Pro 14·iPad·iPhone·Android 등 — 가로형은 숫자가 곧 이름이라 그대로 두고 세로형에만 기기 이름을 붙였다)에서 고르거나 px 를 직접 넣는다. 지금 크기와 맞는 프리셋이 없으면 `findPresetId` 가 `custom`("직접 입력")을 돌려준다. **프리셋을 고르면 아트보드가 실제로 커지고 작아지므로 `viewStore.setContent` + `fitToScreen()` 으로 확대율을 그 자리에서 다시 맞춘다**(캔버스가 올려 주기를 기다리면 한 프레임 늦어 직전 크기로 맞춰진다). 직접 입력 중에는 다시 맞추지 않는다 — 한 글자마다 줌이 튀면 쓰기 어렵다. 타입별로 `frame` → `FrameProperties`, `text` → `TextProperties` 로 갈라지고, **`image`·`button`·`input` 은 "이 노드 타입의 속성 편집은 아직 지원하지 않습니다." 안내 한 줄만 띄운다**(문구는 2026-09-02·이슈 #75에 세 타입 공통으로 일반화됐다 — 그전에는 "이미지 속성 편집은…"으로 image 전용 문구였는데 `button`/`input` 도 같은 fallback 을 타면서 부정확해졌다. `src`/`fit`·`content`/`placeholder` 를 GUI 에서 고칠 방법은 아직 없다). 컨트롤은 `properties/fields/Field.tsx`(라벨·2열 행·인풋 스타일)와 `properties/fields/useDraftInput.ts`(타이핑 중에는 draft, 파싱에 성공하면 즉시 커밋)를 공유하고, Frame·Text 공통 Size 섹션은 `properties/SizeSection.tsx` 다. **공용 컨트롤은 `properties/fields/index.ts` 한 곳에서만 가져온다** — `Field`/`FieldLabel`/`FieldRow` · `NumberField` · `TextField` · `SelectField` · `SegmentedControl` · `ColorField` · `SizeField` · `ToggleField`. 이번에 새로 확인한 네 가지가 쓰이는 자리는 — `TextField`(페이지 이름 · 텍스트 내용), `SelectField`(해상도 프리셋 · 글꼴 종류 · 굵기), `SegmentedControl`(레이아웃 방향 · 주축/교차축 정렬 · 테두리 정렬 · 모서리 `전체`/`개별` · 텍스트 정렬 — Frame 5곳, Text 1곳), `ToggleField`(패널 머리의 표시 여부 · 효과 섹션의 그림자 토글)다. **Size 섹션의 px 칸은 Fixed 면 스펙값을, Hug/Fill 이면 `measureStore` 의 실측 px 를 보여준다**(`properties/fields/SizeField.tsx`) — 실측값을 아직 못 받았을 때만 `Hug`/`Fill` 을 placeholder 로 흐리게 띄우고, 모드를 Fixed 로 바꾸면 그 실측 px 를 그대로 이어받는다(못 받았으면 100). **스키마 값 `"auto"` 를 UI 는 Figma 용어인 `Hug` 로 부른다.** 숫자 칸(`type="number"`)은 **휠이 닿으면 포커스를 떼** 스크롤하다 값이 조용히 증감되는 일을 막는다(`properties/fields/Field.tsx` 의 `blurOnWheel` — `SizeField`·`NumberField`·`ColorField` 가 쓴다. 패널 자체가 `overflow-auto` 라 `preventDefault` 대신 `blur` 를 쓴다). `border` 는 스키마상 세 필드가 모두 필수라 한 칸만 고쳐도 `properties/borderPatch.ts` 가 완전한 객체를 만들어 통째로 쓴다. **그 결과가 아무것도 그리지 않으면 필드를 지운다**(`borderPatch.isBlankBorder`, 2026-09-08·이슈 #89 — 효과 필드가 항등값에서 필드를 지우는 것과 기준을 맞춘 것이다. 그전에는 테두리 없는 노드에서 모서리 토글만 눌러도 `{ width: 0, color: "#000000", radius: 0 }` 이 스펙에 남았다). **판정에 두께와 반경을 함께 본다** — 두께 0 이어도 반경은 배경·그림자의 모서리를 깎으므로, 두께로만 판정하면 `examples/card-effects.json` 의 elevatedCard(`{ width: 0, color: "#00000000", radius: 12 }`) 같은 문서의 모양이 깨진다. **`shadow`·모서리별 `radius` 도 같은 이유로 `properties/shadowPatch.ts`·`properties/radiusPatch.ts` 가 같은 일을 한다**(2026-09-04·이슈 #78). 효과 섹션은 `properties/EffectsSection.tsx` 로 `frame`·`text` 가 공유하고(그림자는 `frame` 만), **불투명도는 스키마 0..1 을 칸에서는 % 로 보여준다** — 항등값(불투명도 100%, 블러 0, 그림자 토글 끄기)으로 되돌리면 필드를 지운다(`properties/effectPatch.ts`. 아무 효과도 없는 값이 남으면 export 된 JSON 을 읽는 쪽이 의미 있는 지정으로 오해한다). 테두리 정렬은 `안쪽`/`가운데`/`바깥`, 모서리 반경은 `전체`/`개별` 토글로 고른다. **모서리 모드만은 스펙에서 파생하지 않고 `FrameProperties` 의 화면 상태로 둔다**(2026-09-08·이슈 #89 — 빈 테두리를 지우게 되면서 파생이 성립하지 않는다. 테두리 없는 노드에서 `개별` 을 눌러도 스펙에 남는 값이 없어 모드가 곧바로 `전체` 로 되돌아오고 값을 넣을 네 칸이 뜨지 않는다. 다른 노드로 옮길 때 이 상태가 따라오지 않도록 `PropertiesPanel` 이 `key={selectedId}` 로 다시 마운트시킨다) | `properties/useNodeField.ts` 훅을 거쳐 `editorStore.setNodeField`(훅 호출 지점 27개 — 아래 표 밑 문단 참고). **Page 섹션만 `editorStore.setPageField` 를 직접 부르고(4칸) `viewStore` 도 함께 건드린다.** Size 섹션은 `measureStore` 를 읽기만 한다 |
| `src/features/editor/ui/LayerTree.tsx` | **활성 페이지의 실제 노드 트리**를 `root` 부터 재귀로 그린다(PR #84 — 하드코딩 목록이던 `LAYERS` 상수는 사라졌다. `git grep "LAYERS" src/` 히트 **0건**, 이슈 #43 닫힘). 줄마다 **타입 아이콘**(`TYPE_ICON` 이 `frame`·`text`·`image`·`button`·`input` 5종을 다룬다) · 이름 · **표시 토글**(`setNodeField(id, "visible", …)` — 트리가 `setNodeField` 를 부르는 유일한 자리다)이 있고, 자식이 있는 프레임은 접기/펼치기가 된다(**접힘 상태만 로컬 `useState`** — 스펙에 저장하지 않는 화면 상태라서다). 하단 **"레이어 추가"** 버튼은 `store/resolveImportParent.ts` 로 부모 프레임을 고르고 `store/nodeId.ts` 의 `generateNodeId` 로 id 를 만들어 기본 Frame(`blankFrameNode()` — `auto`×`auto`, 자식 없음)을 넣는다. 하단 오른쪽에 활성 페이지의 노드 개수를 띄운다. **페이지 폴더·페이지 전환 UI 는 아직 없다** — 계약에 있는 `selectPage`·`addPage`·`removePage` 를 이 파일이 부르지 않고, `git grep` 상 `src/` 전체에서 호출자가 `store/editorStore.ts` 의 정의뿐이다 | `editorStore` (`spec`·`activePageId`·`selectedId`·`select`·`setNodeField`·`insertNode`) |
| `src/features/editor/ui/Toolbar.tsx` 와 `store/toolStore.ts` · `store/createNode.ts` | Select/Frame/Text/Hand 버튼. **활성 도구를 `toolStore` 가 값 하나(`activeTool`)로 들고 있어 항상 하나만 켜진다**(PR #68 — 이슈 #44 닫힘. IR 이 아닌 순수 UI 상태라 `viewStore` 와 같은 층에 두었다). **도구를 고르는 것만 이 파일이 하고 실제 동작은 `ui/Canvas.tsx` 가 이 값을 읽어 수행한다** — `frame`·`text` 도구로 노드나 캔버스 바탕을 클릭하면 `insertNewNode()` 가 `store/createNode.ts` 의 `createNode(kind)`(순수 함수 — Frame 은 200×120 고정 크기, Text 는 `auto`·"텍스트")로 노드를 만들어 `generateNodeId` + `editorStore.insertNode` 로 넣고 **곧바로 도구를 `select` 로 되돌린다**(피그마와 같은 흐름). `hand` 도구는 `mousedown`/`mousemove` 로 캔버스를 팬하고 **선택을 바꾸지 않는다**(클릭 핸들러가 `hand` 면 그대로 빠져나간다). `createNode` 가 다루는 종류는 `frame`·`text` 뿐이다 — Button·Input 은 아직 도구가 없다(파일 주석) | `toolStore.activeTool` (`test/tool-store.test.ts` 3케이스 · `test/create-node.test.ts` 4케이스) |
| `src/features/editor/ui/selection.ts` | 캔버스 클릭 지점을 "어떤 노드를 대상으로 삼을지"로 옮기는 순수 해석기. `buildParentMap`(자식 → 부모 역맵) · `resolveClickTarget`(일반 클릭은 root 바로 아래 **최상위 조상**을, Cmd/Ctrl+클릭은 실제로 클릭한 **최하위 노드**를 고른다) · `resolveInsertParent`(클릭한 노드가 프레임이면 그 안에, 아니면 가장 가까운 조상 프레임에 넣는다 — 텍스트는 자식을 가질 수 없어서다) | 없음 (순수 함수 — `test/canvas-selection.test.ts` 12케이스) |
| `src/features/editor/store/editorStore.ts` | **스키마 v0.2 로 넓어졌다** — `EditorState` 가 `spec: ProjectSpec` 과 **`activePageId`** 를 들고, 초기값은 `migrateV01(seedSpec)` 이다. 계약 멤버는 **11개**다(2026-09-08 확인 — [EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) §2 "계약의 전부 (11개)" 와 목록·개수가 일치한다): `spec` · `activePageId` · `selectedId` · `select` · **`selectPage`**(활성 페이지 전환 + 선택 해제 — 페이지마다 `root`·`cardA` 같은 id 가 겹쳐서다) · `setNodeField` · **`setPageField`**(페이지 이름·해상도) · **`addPage`** · **`removePage`**(마지막 한 장은 지우지 않는다 — `pages` 가 비면 스키마의 `minProperties: 1` 이 깨진다. 활성 페이지를 지우면 같은 자리의 이웃으로 옮겨 간다) · `loadSpec` · `insertNode`. **노드를 다루는 `select`·`setNodeField`·`insertNode` 는 시그니처가 예전 그대로다** — 스토어가 안에서 `spec.pages[activePageId]` 를 찾으므로 호출자는 페이지를 신경 쓰지 않는다. `loadSpec` 은 v0.1(`VisualSpec`)과 v0.2(`ProjectSpec`)를 모두 받아 v0.1 이면 `migrateV01` 로 넓힌다. `insertNode` 는 `parentId` 가 없거나 frame 이 아니면 아무 것도 하지 않는다 — 유효한 frame id 를 고르는 책임은 호출자에게 있다. **`selectPage`·`addPage`·`removePage` 는 아직 UI 호출자가 없다**(위 `ui/LayerTree.tsx` 행 참고) | — (`test/editor-store.test.ts` 28케이스) |
| `src/features/editor/ui/importImageFromFile.ts` | File > Import 의 본체. `<input type=file accept="image/*">` 로 이미지를 고르고 `FileReader` 로 읽은 뒤 `new Image()` 로 원본 픽셀 크기를 재서 `ImageNode` 를 만들어 삽입한다(`box` 는 이미지 원본 크기, `fit` 은 `"cover"` 고정, `name` 은 확장자를 뗀 파일명). **워크스페이스 assets 저장소가 없어 이미지를 base64 data URI 로 스펙 안에 직접 담는다** — 파일 자체가 스펙에 들어가므로 Export/Save 한 JSON 이 그만큼 커진다(파일 상단 주석이 이 절충을 밝히고 있다). 읽기 실패·이미지 아님은 `window.alert` 로 알린다 | `editorStore.insertNode` · `editorStore.getState().spec`·`selectedId` |
| `src/features/editor/store/resolveImportParent.ts` | Import 한 노드를 붙일 부모를 정하는 순수 함수. **선택 노드가 frame 이면 그 안에, 아니면(선택 없음 · text/image 선택 중) 화면 root 에** 붙인다(root 는 스키마상 항상 frame) | 없음 (순수 함수 — `test/resolve-import-parent.test.ts` 4케이스) |
| `src/features/editor/store/nodeId.ts` | `generateNodeId(prefix, nodes)` — `image-1`, `image-2` … 처럼 비어 있는 순번을 찾아 새 id 를 만드는 순수 함수. `NodeId` 패턴(`^[A-Za-z0-9_-]+$`)을 항상 만족한다 | 없음 (순수 함수 — `test/node-id.test.ts` 4케이스) |
| `src/features/editor/store/exportSpec.ts` · `store/loadSpec.ts` | 스펙을 검증해 내보낼 JSON 을 만들거나(`buildExportPayload`), JSON 문자열을 파싱·검증한다(`parseSpecJson`). DOM 없는 순수 함수 | — |
| `src/features/editor/ui/exportSpecAsJson.ts` · `ui/openSpecFromFile.ts` | 위 순수 함수를 감싸는 파일 입출력 — `Blob`+`<a download>` 다운로드, `<input type=file>`+`FileReader` 읽기 | `editorStore.loadSpec` |
| `src/features/editor/store/blankSpec.ts` | File > New 가 로드하는 빈 스펙(root frame 하나, 자식 없음, 1440×900) | — |
| `src/features/editor/store/seedSpec.ts` | 초기 스펙을 하드코딩(`examples/dashboard-cards.json` 내용) | 앱 시작 시 `editorStore` 의 초기값. 자동 저장·복원은 없다 |
| `src/features/editor/store/viewStore.ts` | 줌(25~400%, 버튼·휠은 25 눈금) · 격자 · 패널 표시 · **채우기 모드(`fillViewport`)** 에 더해 **뷰포트 실측 크기(`viewport`)와 아트보드 크기(`content`)**를 담는다 — 둘 다 `Canvas.tsx` 가 올린다. `fitToScreen()` 은 순수 함수 `fitZoom()` 으로 두 크기의 비율을 재서 소수점 두 자리에서 **내림**한 확대율을 쓴다(올림하면 아트보드 가장자리가 잘린다). `ZOOM_STEP` 눈금으로 내리지 않는다 — 1920px 아트보드에서 1%p는 19px이고 채우기 모드에서 그만큼이 바탕색 띠로 보인다. 그래서 `zoomIn/zoomOut` 은 더하고 빼는 대신 다음/이전 눈금으로 **붙인다**(57% → 75%). `fitZoom` 의 `mode` 가 `"width"` 면 세로를 무시하고 가로만 맞춘다(채우기 모드). 실측값을 아직 못 받았으면 100%로 리셋한다 | — (`test/view-store.test.ts` 9케이스 · `fitZoom` 은 `test/fit-zoom.test.ts` 10케이스) |
| `src/features/editor/store/measureStore.ts` | **선택 노드가 캔버스에서 실제로 몇 px 로 그려졌는지**(`size`)만 담는 단일 값 스토어. `Canvas.tsx` 의 `ResizeObserver` 가 올리고 `ui/properties/SizeSection.tsx` 가 읽는다. Hug/Fill 은 스펙에 숫자가 없어 패널이 크기를 알 수 없는데 그 자리를 이 실측값이 채운다. 같은 값이면 `set` 을 건너뛴다(`ResizeObserver` 가 자주 부른다) | — (IR 이 아닌 파생 UI 상태라 `editorStore` 계약과 분리했다 — [EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md). 다만 `store/measureStore.ts:10` 과 `store/viewStore.ts:6` 의 주석은 아직 그 계약을 **"4-멤버"**라고 부른다 — 계약은 그동안 5 → 6개를 거쳐 **지금 11개**이므로(2026-09-08 재확인, 위 `store/editorStore.ts` 행 참고) 주석이 그만큼 더 낡았다. 관찰 기록이므로 고치지 않았다) |

`Canvas.tsx` 상단 주석은 스스로를 **"임시 스탠드인 — 팀원이 정식 구현으로 교체할 예정"**이라고 밝힌다.
캔버스에서 드래그·리사이즈로 편집하는 기능은 없다.

세부설정 패널은 Command Engine을 거치지 않고 `editorStore.setNodeField` 로 IR을 직접 고친다.
[02-mvp-scope.md](02-mvp-scope.md)가 못박은 "GUI는 IR을 직접 수정하지 않는다" 제약과 어긋난 상태다(이슈 #40, 6절 제안 1 참고).

**그 호출 경로가 한 곳으로 모여 있다는 서술은 더 이상 정확하지 않다.** `src/` 전체에서 `setNodeField` 를
실제로 호출하는 지점은 **두 곳**이다(2026-09-08 재실측) — `src/features/editor/ui/properties/useNodeField.ts:28`
과 **`src/features/editor/ui/LayerTree.tsx:116`**(레이어 트리의 표시 토글. 훅을 거치지 않고 스토어를 직접
부른다). `src/` 의 나머지 `setNodeField` 히트는 스토어의 정의(`store/editorStore.ts:46`·`:109`)와 주석이다.

**패널 쪽에 한해서는 여전히 한 곳이다.** 패널의 필드 27개
(`ui/PropertiesPanel.tsx` 2 · `ui/properties/EffectsSection.tsx` 3 · `ui/properties/FrameProperties.tsx` 12 ·
`ui/properties/TextProperties.tsx` 10 — `useNodeField` 호출 지점 실측)는 전부 그 훅을 거치므로,
**필드가 늘어도 패널에서 바꿔야 할 지점은 늘지 않는다.** 24개이던 집계가 27개가 된 것도 필드가 늘었을 뿐
훅을 거치지 않는 필드가 생겨서가 아니다(2026-09-04·이슈 #78 의 효과 섹션 3개가 그때 집계에 빠져 있었다).
바뀐 것은 **패널 밖에서 새 호출자가 하나 생겼다**는 점이고, 이슈 #40 을 처리할 때 걷어낼 지점은
한 곳이 아니라 두 곳이다.

페이지 자체(이름·해상도)는 `setNodeField` 가 아니라 `setPageField` 로 고친다 —
`ui/properties/PageProperties.tsx` 한 곳에서 4칸이 부른다. 이쪽도 Command Engine을 거치지 않는 건 같다.

---

## 2. MVP 문서가 요구하는데 저장소에 없는 것

| 항목 | 02-mvp-scope.md의 요구 | 상태 | 근거 |
|---|---|---|---|
| CLI | `npx visual-spec init` / `npx visual-spec` | **미착수** | `package.json` 에 `bin` 필드 없음. CLI 진입점 파일 없음 (이슈 #42) |
| `.visual-spec/` 작업공간 | `specs/` `generated/` `preview/` `assets/` `runtime/` | **미착수** | 작업공간을 만들거나 읽는 코드 0줄. `git grep "\.visual-spec"` 히트는 전부 문서와 스킬 지시문이고 `src/`·`test/`·`scripts/` 는 여전히 0건(2026-08-29 재확인). `skills/visual-spec-to-react/SKILL.md` 가 생성 위치를 `.visual-spec/generated/` 고정 경로로 정했지만 **경로 약속이지 구현이 아니다.** GUI 에 생긴 Open/Save 는 브라우저 파일 다이얼로그와 다운로드를 쓰는 것이라(`ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts`) **작업공간과는 다른 물건이다** (이슈 #42). **2026-09-01 재확인 — PR #69 의 Import 도 작업공간을 만들지 않는다.** `ui/importImageFromFile.ts` 는 고른 이미지를 base64 data URI 로 바꿔 `ImageNode.src` 에 그대로 넣는다. 즉 `assets/` 디렉터리를 쓰는 대신 **파일 내용을 스펙 안에 인라인해 우회한 것**이므로 이 행은 **미착수 그대로**다 |
| Command 스키마 v0.1 | "v0.1로 고정한다"고 선언한 3개 스키마 중 하나 | **부분** | `src/features/editor/command/types.ts`에 TypeScript 타입으로 존재한다. IR 스키마처럼 JSON Schema 정본 + `06-schema-freeze.md` 같은 동결 절차를 거친 **"v0.1로 고정"은 아직 아니다** — 내부 구현 타입일 뿐 공개 계약으로 확정된 게 아니다 |
| Ticket 스키마 v0.1 | 같음 | **부분** | `src/features/editor/ticket/types.ts`에 TypeScript 타입으로 존재한다(`Ticket`: id/componentName/kind/instances/dependsOn/status). Command 스키마와 마찬가지로 JSON Schema 정본 + 동결 절차를 거친 "v0.1로 고정"은 아직 아니다 |
| Undo / Redo | MVP 포함 범위 표 "편집" 행 | **부분** | `command/history.ts`에 범용 undo/redo 스택(순수 함수)이 생겼다. **다만 아무 데도 연결돼 있지 않다** — `editorStore`가 이 history를 쓰지 않고, Undo/Redo를 누를 UI 버튼·단축키도 없다. 사용자가 실제로 되돌리기를 쓸 방법은 지금 없다 |
| 반응형 (데스크톱 · 모바일) | MVP 포함 범위 표 "반응형" 행 | **미착수** | 스키마가 `responsive`를 명시적으로 제외([06-schema-freeze.md](06-schema-freeze.md), [05-schema.md](05-schema.md)) |
| 홈(진입) 화면 | [04-gui-spec.md §2](04-gui-spec.md#2-홈진입-화면)가 화면 목록·카드·빈 상태까지 명세 | **부분** | **컴포넌트도 화면 전환도 생겼다**(PR #77 — `ui/HomeScreen.tsx`, `ui/homePreview.ts`, `store/navigationStore.ts`, `test/home-preview.test.ts`). `src/app/App.tsx` 가 `navigationStore.screen` 으로 홈/에디터를 가르고, 홈에서 카드나 "+ 새 화면"으로 에디터에 들어가고 `ui/MenuBar.tsx` 의 로고 클릭으로 홈에 돌아온다. **04 §2 의 "상태 1"(저장된 화면이 있을 때)만 구현했다** — 목록·카드·즉석 미리보기가 있다. **"상태 2"(첫 실행 — 빈 상태와 세 갈래 선택지)는 없다**: 워크스페이스가 없어(#42) 프로젝트가 항상 정확히 1개라 목록이 비거나 여럿이 되는 경우 자체가 지금 데이터 모델에 없다(`ui/HomeScreen.tsx` 상단 주석). 목록은 화면이 아니라 **프로젝트**를 나열한다(v0.2). 화면 전환은 별도 라우터 없이 스토어 값 하나로 한다 |

세 스키마 중 IR 스키마 하나만 v0.1로 고정됐다. Command·Ticket 두 개는 이제 TypeScript 타입으로는
존재하지만(`command/types.ts`, `ticket/types.ts`), JSON Schema 정본 + 동결 절차를 거친
"v0.1로 고정"은 아직 아니다 — 내부 구현 타입일 뿐 공개 계약으로 확정된 게 아니다.

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
| 유효 예제 8개 | `examples/*.json` | 검증 통과(2026-09-08 실측 — `ls examples/*.json` 8개. **7개는 `version: "0.1"` 이라 `validateVisualSpec` 이, `two-page-project.json` 만 `version: "0.2"` 라 `validateProjectSpec` 이 받는다**). `examples/image-hero.json` 이 2026-09-01(PR #67)에, `examples/form-grid.json`(button·input·grid)이 2026-09-02(이슈 #75)에, `examples/card-effects.json`(그림자·불투명도·블러)이 2026-09-04(이슈 #78)에, **`examples/two-page-project.json`(v0.2 `ProjectSpec` — 페이지 2장)**이 그사이 추가됐다 |
| 무효 예제 8개 | `examples/invalid/*.json` | 검증기가 잡아야 하는 문서들 |
| 테스트 | `test/editor-store.test.ts`(28) · `test/canvas-layout.test.ts`(26) · `test/validate.test.ts`(21) · `test/apply-command.test.ts`(18) · `test/compile-tickets.test.ts`(18) · `test/project-spec.test.ts`(15) · `test/resolution-presets.test.ts`(13) · `test/canvas-selection.test.ts`(12) · `test/radius-patch.test.ts`(12) · `test/schema.test.ts`(10) · `test/fit-zoom.test.ts`(10) · `test/view-store.test.ts`(9) · `test/effect-patch.test.ts`(8) · `test/export-spec.test.ts`(6) · `test/history.test.ts`(6) · `test/border-patch.test.ts`(5) · `test/shadow-patch.test.ts`(5) · `test/create-node.test.ts`(4) · `test/node-id.test.ts`(4) · `test/public-api.test.ts`(4) · `test/resolve-import-parent.test.ts`(4) · `test/load-spec.test.ts`(3) · `test/home-preview.test.ts`(3) · `test/navigation-store.test.ts`(3) · `test/tool-store.test.ts`(3) | **25파일 250케이스 전부 통과** (2026-09-08 3차, `develop` a3fb385 기준 확인 — `test/compile-tickets.test.ts` 가 PR #81 과 함께 들어왔다) |
| CI | `.github/workflows/ci.yml` | 타입체크 · 테스트 · 스키마 드리프트 검사 |
| 스킬 5종 | `skills/` — `visual-spec`(허브) · `visual-spec-docs` · `visual-spec-authoring` · `visual-spec-validate` · `visual-spec-to-react` | 배포 원본은 저장소 루트 `skills/`. 사람이 읽는 설명은 `docs/skills/` 에 같은 이름으로 5개. `analyze-target-project`는 "독립 작업공간" 원칙과 어긋나 제거됨(#33) |

검증기가 잡아내는 구조 오류는 코드 **8종**이다(2026-09-08 실측 — `schema/validate.ts:7` 의 `IssueCode` 유니온) — `schema`, `root-missing`, `root-not-frame`, `child-missing`, `cycle`, `multiple-parents`, `orphan-node`, **`page-order-mismatch`**. 마지막 하나가 v0.2 와 함께 늘었다 — `pages` 의 키와 `pageOrder` 가 정확히 일치해야 한다는 규칙은 JSON Schema 로 표현할 수 없어 `validateProjectSpec` 이 코드로 검사한다(정본 스키마의 `$defs.ProjectSpec.pageOrder` 설명이 그렇게 밝히고 있다).

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
갈래가 늘 때마다 개수도 는다 — 세 갈래(`image` 추가)에서 12개였고,
**다섯 갈래(`button`·`input` 추가)인 지금 같은 파일은 16개를 낸다 — 2026-09-08 실측.**
`oneOf` 는 맞지 않는 갈래마다 오류를 쌓으므로, 갈래가 늘수록 정작 원인과 무관한 이슈가
같이 늘어난다는 뜻이다. 메시지 문구가 개선됐어도 **개수 자체는 줄지 않았다.**)

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
  **걷어낼 호출 지점은 두 곳이다**(2026-09-08 재실측) — `ui/properties/useNodeField.ts:28` 과
  `ui/LayerTree.tsx:116`(표시 토글). 패널 필드 27개는 전부 그 훅을 거치므로 **필드가 늘어도 패널 쪽
  지점은 늘지 않지만**, 트리가 훅을 거치지 않고 스토어를 직접 부르면서 패널 밖 호출자가 하나 생겼다
  (1절 표 아래 참고). 페이지 이름·해상도를 고치는 `setPageField` 경로(`ui/properties/PageProperties.tsx`)도
  같은 제약에 걸린다.
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
pnpm run typecheck   # 통과 (2026-09-08 3차, `develop` a3fb385 기준 확인)
pnpm test            # 25파일 250케이스 통과 (2026-09-08 3차, `develop` a3fb385 기준 확인)
```
