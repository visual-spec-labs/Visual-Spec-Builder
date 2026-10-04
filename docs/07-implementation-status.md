# 07. 구현 현황

> 확인 기준일: **2026-08-20** / 확인 대상 브랜치: `Yumesa2025/roadmap`
> 부분 갱신: **2026-08-25**(검증기 메시지 — 5.2) · **2026-08-28**(`develop` 1b3e82a 머지 후) · **2026-08-29**(`develop` db7f8f4 머지 후) · **2026-09-01**(`develop` a807bc4 머지 후) · **2026-09-01**(`develop` 1b73ccd 머지 후 — 같은 날 2차) · **2026-09-01**(`develop` 020be51 머지 후 — 같은 날 3차) · **2026-09-02**(이슈 #75, PR 작성 전 — `75--button-input-grid-nodes` 브랜치) · **2026-09-02**(Command Engine 타입/적용기/history — 이슈 #73, `73--command-engine` 브랜치, PR 작성 전) · **2026-09-02**(Ticket 스키마/컴파일러 — 이슈 #74, `74--ticket-schema` 브랜치, PR 작성 전) · **2026-09-08**(`develop` f583647 머지 후 — 홈 화면·레이어 트리·도구 모음·`editorStore` 계약·스키마 v0.1/v0.2 병행 상태) · **2026-09-08**(같은 날 2차 — 예제·오류 코드·패널 파일/필드 집계·`setNodeField` 호출 지점·5.2 실측치) · **2026-09-08**(`develop` a3fb385 머지 후 — 같은 날 3차, 테스트 집계 재실측과 Ticket 서술 대조) · **2026-09-09**(CLI `bin`/`init` — 이슈 #42, PR #106, 머지됨) · **2026-09-11**(setNodeField·setPageField가 Command Engine을 거치도록, PR #102 리뷰(GAMMJ) 반영 포함 — 이슈 #40, PR #102, 머지됨) · **2026-09-10**(CLI `skills` — 이슈 #104, PR #107, 머지됨) · **2026-09-11**(CLI GUI 실행 — 이슈 #105, PR #108, 머지됨) · **2026-09-11**(`package.json`의 `main` 필드 제거 — 이슈 #45, `45--package-main-fix` 브랜치, PR 작성 전, `develop` 1b3d5f3(PR #108 포함) 위로 리베이스) · **2026-09-11**(`fill`의 교차축 의미를 06에 결정으로 옮김 — 이슈 #46, `46--fill-cross-axis-decision` 브랜치, PR #119, 리뷰 대기, `develop` cb1e76d(PR #113 포함) 위로 리베이스) · **2026-09-13**(Undo가 필드 편집 키 입력마다 쌓이던 문제 — 이슈 #121, `121--undo-history-coalesce` 브랜치, PR 작성 전, `develop` 30d3209(PR #120 포함) 위로 시작) · **2026-09-15**(채우기 모드 제거 — 이슈 #125, PR #126, 머지됨) · **2026-09-15**(localStorage 자동저장/복원 — 이슈 #128, `128--localstorage-persistence` 브랜치, PR 작성 전, `develop` 999032f(PR #126 포함) 위로 시작) · **2026-09-18**(스토어 주석의 "4-멤버" 표현 정리 · `ImageNode.src` 설명 정정 — 이슈 #95·#94, `Yumesa2025/schema-comment-sync` 브랜치, PR #140, 리뷰 반영 중, `develop` dce0930(PR #141 포함) 위로 리베이스) · **2026-09-18**(같은 날 2차 — PR #140 리뷰(wook3964) 반영: `editorStore` 계약 멤버 수와 `ui/LayerTree.tsx` 의 페이지 UI 서술 재실측) · **2026-09-18**(같은 날 3차 — 이슈 #131·#132 머지 반영(`develop` 72aa74d): Undo 단위가 프로젝트로 올라간 것 · `insertNode`/`addPage`/`removePage` 가 history 에 쌓이는 것 · `TextField` 연속 타이핑 병합 · 4절 테스트 집계 전수 재실측, `Yumesa2025/docs-sync-131-132` 브랜치, PR 작성 전) · **2026-09-27**(Export · 검증 — 이슈 #157, `Yumesa2025/export-verify-157` 브랜치, `develop` efac4f7(PR #176 포함) 위에서 시작) · **2026-09-28**(자연어 변환 — 이슈 #155·#183, `feat/183-nl-screen-generation` 브랜치, PR 작성 전, `develop` b723c67(PR #191, 이슈 #182 포함) 위에서 시작) · **2026-09-29**(구현 티켓 실행 연결 — 이슈 #184, `dogui1018/ticket-execution-184` 브랜치, PR 작성 전, `develop` e30022d(PR #192, 이슈 #183 포함) 위에서 시작) · **2026-09-29**(같은 날 2차 — 새로고침 후 Save가 다른 파일을 만드는 문제 수정, 이슈 #185, `dogui1018/document-refresh-save-185` 브랜치, PR 작성 전, `develop` 99d84d8(PR #197, 이슈 #184 포함) 위에서 시작) · **2026-09-29**(같은 날 3차 — 홈 화면이 실제 파일 목록을 읽도록 배선, 이슈 #186, `dogui1018/home-project-list-186` 브랜치, PR 작성 전, `develop` 7951579(PR #198, 이슈 #185 포함) 위에서 시작) · **2026-10-02**(Export 결과물이 실제 프로젝트에서 컴파일되는지 1회 수동 QA — 이슈 #188, `dogui1018/export-typecheck-qa-188` 브랜치, PR 작성 전, `develop` 036e9dc(PR #204, 이슈 #190 포함) 위에서 시작) · **2026-10-04**(캔버스에서 노드를 끌어 순서·부모 바꾸기 — 이슈 #187, `Yumesa2025/187-canvas-drag-reorder` 브랜치, PR 작성 전, `develop` 38f236e(PR #205, 이슈 #188 포함) 위에서 시작) · **2026-10-04**(같은 날 2차 — 캔버스 리사이즈 한 번이 Undo 한 단계, 이슈 #207, `Yumesa2025/207-resize-undo-single-step` 브랜치, PR 작성 전, `develop` 6bdef2e(PR #206, 이슈 #187 포함) 위에서 시작) · **2026-10-04**(같은 날 3차 — 숫자·색상·크기 칸이 값이 그대로인 입력을 커밋하지 않음, 이슈 #209, `Yumesa2025/209-draft-input-noop-guard` 브랜치, PR 작성 전, `develop` 9e361c9(PR #208, 이슈 #207 포함) 위에서 시작) · **2026-10-04**(같은 날 4차 — 배경을 채우기 겹 배열로, 문서 버전 0.3 — 이슈 #127 후속 1단계, `Yumesa2025/127-background-fill-schema` 브랜치, PR 작성 전, `develop` 9a748fc(PR #211, 이슈 #127 설계 포함) 위에서 시작)
>
> 부분 갱신은 **문서 전체 재검증이 아니다.** 각 갱신에서 실제로 확인한 항목만 아래에 적는다.
> 확인하지 않은 항목의 날짜는 올리지 않는다.
>
> | 확인일 | 확인한 항목 | 확인 방법 |
> |---|---|---|
> | 2026-10-04 (#127, 4차) | 1절 IR·스키마 행(버전 0.3 메모), 4절 끝의 구조 오류 코드 종류(8종 → 9종) | 이 단위를 구현하며 갱신했다 — 다른 행은 재검증하지 않았다. `schema/visual-spec.schema.json` 의 `version` 상수 두 곳(`"0.3"`)과 `$defs.Background`(`Fill[]`)·`Fill`·`SolidFill`·`LinearFill`·`GradientStop`, `schema/validate.ts` 의 `IssueCode` 유니온(9종, `gradient-stop-order` 추가)을 열람. `pnpm test`(**67파일 1195케이스**) · `typecheck` · `lint` · `build` 통과 |
> | 2026-10-04 (#209) | 2절 Undo/Redo 행("남은 결함" 서술을 해소된 내용으로 바꾸고, 리사이즈 문장의 `useDraftInput` 결함 언급을 고침) | 이 단위를 구현하며 갱신했다 — 다른 행은 재검증하지 않았다. `properties/fields/useDraftInput.ts` 가 `isUnchanged(parsed)` 옵션을 받아 값이 그대로면 커밋도 `burst.next()` 도 부르지 않는다. 판단은 `properties/fields/unchangedCommit.ts`(신설, React 없음)에 두고, `ColorField.tsx` 의 `parseColor`·`composeColor` 를 테스트할 수 있게 `properties/fields/colorValue.ts`(신설)로 옮겼다. **비교 대상은 칸에 보이는 값이 아니라 저장된 값이다** — `SizeField` 는 `shown`(Hug/Fill이면 실측 px)이 아니라 `Size` 값과 견줘 Hug/Fill 칸에서 보이던 숫자를 그대로 쳐도 Fixed 전환이 커밋되고, `ColorField` 는 조립한 색 문자열로 견줘 저장값이 소문자인 색·반올림으로 알파가 달라지는 %는 커밋된다. **이슈 본문의 전제를 바로잡았다** — 스토어는 같은 값 쓰기를 no-op으로 보지 않는다(`setByPath` 가 늘 새 객체를 만든다). 그래서 고치기 전 실제 증상은 "간격 16 단계가 사라짐"이 아니라 **빈 undo 단계**였다. `pnpm dev` + 브라우저(빈 캔버스 Screen의 간격 칸)로 가드를 잠시 끈 빌드와 비교했다 — 가드 없음: 16 → `"016"` → `"0167"` → Ctrl+Z 는 16(보존됨), 16 → `"016"` → blur → Ctrl+Z 는 16 그대로(빈 단계). 가드 있음: 앞의 것은 16 → 다시 Ctrl+Z 로 0, 뒤의 것은 Ctrl+Z 한 번에 0이고 되돌리기 버튼이 꺼진다. `pnpm test` **65파일 1129케이스** 통과(이 브랜치 실측 — `test/unchanged-commit.test.ts` 24 신설). 4절 테스트 집계 전수 재실측은 하지 않았다. `pnpm run typecheck`·`pnpm run lint`·`pnpm run build` 통과 |
> | 2026-10-04 (#207) | 2절 Undo/Redo 행("이 매개변수를 모르는 호출부" 에서 캔버스 리사이즈를 뺌), "GUI 각 영역의 실제 동작" 표 아래 `setNodeField` 호출 지점 중 `Canvas.tsx` 줄번호 | 이 단위를 구현하며 갱신했다 — 다른 행은 재검증하지 않았다. `ui/Canvas.tsx` 의 `startResize` 가 mousemove마다 `continueEdit` 없이 커밋해 이동 횟수만큼(se는 그 두 배) undo 단계가 쌓이던 것을, 순수 판단기 `ui/resizeGesture.ts`(`createResizeGesture`)가 고른 커밋만 `continueEdit` 과 함께 보내도록 고쳤다. "이미 단계를 만들었는가"는 **값이 바뀐 커밋이 있었는가**로 판단한다 — 값이 그대로인 커밋을 첫 커밋으로 세면 다음 커밋이 직전 *남의* 단계를 덮어쓴다. 스토어·command·history 는 건드리지 않았다. `pnpm dev` + 브라우저로 `examples/dashboard-cards.json`(File ▸ Open)을 열어 Card의 e·s·se 핸들과 root(아트보드)의 e·s·se 핸들을 각각 8번씩 움직여 끈 뒤 `Ctrl+Z` 한 번에 원래 크기로 돌아오고 되돌리기 버튼이 다시 비활성(남은 단계 0)이 되는 것을 확인했다 — 핸들만 눌렀다 떼면 되돌리기 버튼이 켜지지 않는다. `test/resize-gesture.test.ts`(신규 15케이스 — 판단기 단위 8 + 스토어 회귀 7: 편집 A 뒤 리사이즈에서 undo 한 번 = A 직후·두 번 = A 이전, e·s·se·root, 이동 없는 제스처가 A 보존). `pnpm typecheck`·`pnpm lint`·`pnpm test`(**64파일 1105케이스** 통과, 이 브랜치 실측)·`pnpm build` 통과. 4절 테스트 집계 전수 재실측은 하지 않았다. `git grep -n "setNodeField(" src/features/editor/ui/Canvas.tsx` 로 줄번호를 다시 쟀다 |
> | 2026-10-04 (#187) | 1절 "localhost GUI · Canvas" 행(노드 끌기 서술), "GUI 각 영역의 실제 동작" 표의 `ui/Canvas.tsx` 행(분할 이웃 목록), 그 표 아래 "드래그·리사이즈 편집 없음" 문장과 `setNodeField` 호출·정의 줄번호, 6절 제안 1의 "남은 것" 중 같은 문장 | 이 단위를 구현하며 갱신했다 — 다른 행은 재검증하지 않았다. `ui/canvasDrop.ts`(드롭 위치 순수 판정기)·`ui/useNodeDrag.ts`(리스너 배선) 신설, `ui/selection.ts` 에 `resolveDragTarget`(선택된 노드 위에서 끌면 그 노드), `ui/canvasInput.ts` 에 `canStartNodeDrag`·`hasPassedDragThreshold` 를 더했다. `pnpm dev` + 브라우저로 `examples/dashboard-cards.json` 에서 카드 순서 바꾸기·다른 프레임 안으로 넣기·`Esc` 취소·`Ctrl+Z` 한 번에 원복을 확인했다. `pnpm test` **63파일 1090케이스** 통과(이 브랜치 실측 — `test/canvas-drop.test.ts` 36 신설, `test/canvas-input.test.ts` 73 → 88, `test/canvas-selection.test.ts` 37 → 48). 4절 테스트 집계 전수 재실측은 하지 않았다. `git grep -n "setNodeField(" src/` 로 `Canvas.tsx` 호출 줄번호를, `grep -n "setNodeField:"` 로 스토어 정의 줄번호를 다시 쟀다 |
> | 2026-09-29 (#180) | 05의 MVP 지원 범위·확정 규칙, 07 §3의 노드 타입·레이아웃·크기 | `visual-spec.schema.json`의 `$defs.Node.oneOf`, 노드별 필수 필드, `$defs.Layout.direction`·`columns`, `$defs.Size`를 05·06 문서와 대조했다. 세 문서 모두 노드 5종(`frame`·`text`·`image`·`button`·`input`), 레이아웃 3종, `Size`의 `number`/`auto`/`fill`을 일치하게 설명한다. 기존 07의 “05에 Image·Button·Input이 없다”는 주장은 낡았고, 05에는 이미 모두 포함돼 있었다. `ImageNode.src`의 세 표현과 grid의 선택 `columns` 기본값을 05에 보충했다. 02의 반응형 요구는 06이 v0.1 제외 범위로 정한 내용이라 별도 차이로 남긴다. 정본 스키마는 수정하지 않았다 |
> | 2026-09-30 (#181) | 반응형 IR 표현 결정과 MVP/구현 현황의 정합성 | #181 완료 기준의 다섯 질문을 설계 문서로 결정하고, 05·06·07 및 README에 연결했다. responsive 미지정 시 기존 동작 유지, 구버전 validator가 새 문서를 거부할 수 있음, 스키마/GUI/생성기 후속 범위를 명시했다. 정본 스키마와 생성 타입은 수정하지 않았다. examples/*.json 8개(유효 예제 7개 + ProjectSpec 1개)와 examples/invalid/*.json 8개를 확인했고, pnpm test -- test/validate.test.ts test/project-spec.test.ts 통과(36 tests). |
> | 2026-09-29 (#186, 3차) | 2절 "홈(진입) 화면" 행, "GUI 각 영역의 실제 동작" 표의 `ui/HomeScreen.tsx` 행 | `ui/HomeScreen.tsx`가 `const projects = [spec];`로 항상 카드 한 장만 그리던 것을 고쳤다 — 근거였던 "워크스페이스가 없어(#42) 프로젝트가 항상 정확히 1개"가 #133(워크스페이스 Open/Save) 머지 뒤로 틀린 문장이 돼 있었다(`.visual-spec/specs/`에 파일이 여러 개 쌓일 수 있고 `ui/openSpecFromFile.ts`의 `openSpec()`이 이미 그 목록을 읽고 있었다). 마운트 시 `listWorkspaceFiles(SPEC_DIR)` + 파일마다 `readWorkspaceTextFile`·`parseSpecJson`(+v0.1이면 `migrateV01`)로 목록을 읽어 0개면 04 §2의 상태 2(세 갈래 선택지), 1개 이상이면 상태 1(카드 그리드)을 그린다 — 같은 조건 하나로 갈린다. 파싱 실패 파일은 조용히 목록에서 뺀다. 카드 클릭은 이미 읽어 둔 spec을 `loadSpec`에 넘기고 `documentStore.setFileName`으로 그 파일을 기억시킨다(#185와 맞물린다). 워크스페이스가 없으면(`listWorkspaceFiles`가 `null`) 예전과 똑같이 메모리 spec 한 장짜리 상태 1로 되돌아간다. **세 갈래 선택지 중 "자연어로 초안 만들기"는 "빈 캔버스에서 시작"과 같은 동작이다** — 실제 자연어 작성은 에디터 안 `NaturalLanguageBar.tsx`에서만 되고, 홈 화면에 새 입력창을 만드는 건 이번 범위 밖으로 뒀다(대화에서 확인). 정렬·수정 시각(04 §2가 요구하는 mtime·"최근 수정순")은 `workspaceServer.ts`의 목록 라우트가 파일 이름만 줘서 서버 변경이 필요해 넣지 않았다 — 이 이슈의 범위·완료 판정 밖이라 정직하게 남겨 둔다. **수동으로 확인했다**(이 저장소엔 React 컴포넌트를 렌더링해 테스트할 도구가 없다) — `pnpm dev`로 GUI를 띄워 `specs/`에 정상 파일 2개(v0.1·v0.2 각 1개)와 깨진 JSON 1개를 두고 새로고침하니 카드 **2장**만 뜨고(깨진 파일 제외) 각각 이름·페이지 수·크기가 맞았다. 카드를 클릭해 열고 값을 고쳐 File ▸ Save하니 원본 파일에 그대로 쓰였다(새 파일이 안 생겼다). `specs/`를 비우니 상태 2의 세 버튼이 떴고, "빈 캔버스에서 시작"·"자연어로 초안 만들기" 둘 다 에디터로 들어갔으며 "기존 화면 불러오기"는 prompt를 취소하면 홈에 남고 골라서 열면 에디터로 들어갔다. `pnpm build && pnpm preview`(미들웨어 없음)에서는 깨지지 않고 메모리 spec 한 장짜리 상태 1로 떴다. `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(기존 61파일 1015케이스 그대로 — 새 테스트를 추가하지 않았다, I/O 배선은 이 저장소 관례상 `nlAgentClient.ts`·`ticketAgentClient.ts`처럼 수동 검증으로 대신한다) · `pnpm run build`(exit 0) |
> | 2026-09-29 (#185, 2차) | 1절 "localhost GUI · Canvas" 행의 지속성 서술 | PR #145(wook3964 리뷰)가 "Save는 지금 연 파일에 쓴다"를 고치며 `store/documentStore.ts`에 `fileName`을 뒀는데, 이 값은 zustand 메모리 상태뿐이라 새로고침하면 `null`로 돌아갔다 — spec **내용**은 #128의 `specStorage.ts`가 복원해 줘도 파일명만 잃어, `customer-copy.json`을 열고 새로고침한 뒤 고쳐서 Save하면 `Dashboard.json` 같은 엉뚱한 새 파일이 생겼다(PR #145가 고친 바로 그 버그가 새로고침이라는 경로로 재발). `store/specStorage.ts`의 저장 형태를 `ProjectSpec` 단독에서 `{ fileName, spec }` 봉투로 바꿔 파일명과 내용을 **한 값**으로 묶었다 — 따로 저장하면 한쪽만 쓰기에 성공하거나 서로 다른 시점 값이 섞이는 불일치가 생긴다. `loadStoredSpec`의 반환 계약은 그대로라 `editorStore.ts`는 전혀 안 건드렸다. `documentStore.ts` 초기값이 신설 `loadStoredFileName()`으로 복원되고(`editorStore.ts`의 `loadStoredSpec() ?? migrateV01(seedSpec)`과 대칭), `App.tsx`의 `useSpecAutosave`에 `useDocumentStore` 구독을 하나 더 달아 파일명 변경(Open·Save·Save as·New)을 **디바운스 없이** 즉시 반영한다(spec 디바운스는 그대로 — Save as로 이름만 바꾸고 편집 없이 바로 새로고침해도 새 이름이 남게 하려면 그 변화만은 즉시 써야 한다). 외부에서 워크스페이스 파일이 바뀌었을 때의 병합은 다루지 않는다고 명시했다 — Save는 원래도 항상 화면 내용으로 덮어썼고 이번 변경이 그 위험을 새로 만들지도 줄이지도 않는다. **재현 시나리오를 실제로 고정했다** — `test/document-path.test.ts`에 `vi.resetModules()` + 동적 `import()`로 진짜 새로고침(모듈 상태가 지워지고 다시 읽히는 것)을 흉내 낸 새 describe 3케이스를 추가해 "Open → 새로고침 → 편집 → Save"가 `customer-copy.json`에 그대로 쓰이고 새 파일이 안 생기는 것, 파일명 자체가 새로고침 뒤에도 남는 것, 무명 세션은 새로고침해도 여전히 무명이라 `specs/`에 안 쌓이는 것을 직접 증명했다(`editorStore.ts`는 다시 import하지 않았다 — spec 내용 복원은 #128이 이미 증명했고 이번에 새로 건드리는 건 `documentStore.fileName` 하나뿐이다). `test/spec-storage.test.ts`에도 파일명 왕복·`null` 왕복·#128 시절 옛 형태(봉투 없음) 폐기 케이스를 추가했다. `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(**61파일 1015케이스** — 이 브랜치가 더한 것은 7케이스: `test/spec-storage.test.ts` +4 · `test/document-path.test.ts` +3) · `pnpm run build`(exit 0) |
> | 2026-09-29 (#184) | 1절 "Ticket Compiler · Agent" 행(부분 A안 → 부분, B안 실행 연결) | #156이 넣은 A안(계획·상태 표시만, 상태는 사람이 드롭다운으로 바꿈)에 #155(PR #177)가 만든 `.visual-spec/runtime/` 파일 교환 패턴(`editor/nl/nlProtocol.ts`·`nlAgentClient.ts`)을 그대로 본떠 B안을 얹었다 — 새 프로토콜을 만들지 않고 파일 이름만 다르게 재사용했다(`ticket/ticketProtocol.ts`의 `ticket-request.json`/`ticket-response.json`, `ticket/ticketAgentClient.ts`의 `requestTicketBatch`). 자연어 경로와 달리 Command를 만들지 않는다 — 에이전트가 `.visual-spec/generated/pages\|components/*.tsx`에 직접 쓰고, 결과 검증은 그대로 `export/verifyGenerated.ts`(#157)에 맡긴다. **실제 오케스트레이션은 `store/ticketStore.ts`가 아니라 `ui/ticketRunner.ts`에 있다** — `tsconfig.uitest.json`의 규칙(DOM 타입을 만지는 코드는 `ui/`에만 두고 `store/`는 `tsconfig.node.json`의 `lib: ["ES2022"]`로 검사해 그 경계를 타입 단계에서 강제한다)을 처음에 어기고 `ticketStore.ts`에 `requestTicketBatch`를 직접 넣었다가 `tsc -b`가 `ui/workspaceClient.ts`의 `BodyInit`(DOM 타입)을 못 찾는 것으로 바로 걸렸다 — `nl/nlAgentClient.ts`가 store가 아니라 `ui/NaturalLanguageBar.tsx`에서만 쓰이는 이유와 같다. `ui/ticketRunner.ts`의 `runAllTickets`가 `ticketStatus.readyTickets`로 웨이브(의존이 모두 done인 티켓들)를 계산해 한 번에 보내고, 응답을 받으면 `applyTicketResults`로 반영한 뒤 다음 웨이브를 자동으로 이어간다(끝나거나 막힐 때까지 사람 손 없이) — `runOneTicket`은 티켓 하나만 보내고 이어가지 않는다. 재컴파일 경쟁은 `sourcePage` 참조 비교가 아니라 `ticketStore.generation`(정수 카운터, `compile`마다 증가)으로 막는다 — 내용이 같은 페이지로 재컴파일해도(참조가 우연히 같을 수 있어) 놓치지 않기 위해서다. `ui/TicketPanel.tsx`에 헤더 "전체 실행"/"중지" 버튼과 항목별 "실행" 버튼을 추가했고, 실패 티켓은 사유를 빨간 줄로 보여주며 그 후행 티켓은 절대 요청되지 않는다(`isReady`가 실패를 done으로 안 본다). 작업공간이 없으면(`ui/workspaceClient.isWorkspaceAvailable`) 실행 컨트롤을 아예 렌더링하지 않고 기존 A안(드롭다운)으로 조용히 되돌아간다. **`pnpm dev`로 실제 GUI를 띄워 눈으로 확인했다** — 시드 화면(Header·Content가 준비된 티켓, DashboardPage가 그 둘에 의존)에서 "전체 실행"을 누르니 `runtime/ticket-request.json`에 Header·Content 둘만 실렸고, 손으로 `runtime/ticket-response.json`에 둘 다 `done`을 써 주니 사람 손 없이 두 상태가 "완료"로 바뀌며 곧바로 DashboardPage 하나만 담긴 새 요청 파일이 (새 `requestId`로) 나갔다 — 그것도 `done`으로 응답하니 전부 완료되고 버튼이 "전체 실행"으로 돌아왔다. 재컴파일 뒤 다시 실행해 이번엔 Content를 `failed`로 응답하니 그 사유가 패널에 빨간 줄로 뜨고 DashboardPage는 "대기"에 그대로 머물렀다(후행 미요청 확인). `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(**61파일 1008케이스** — 이 브랜치가 더한 것은 38케이스: `test/ticket-protocol.test.ts` 13(신규) · `test/ticket-status.test.ts` 17(신규, 지금까지 `ticketStatus.ts`는 전용 테스트가 없었다) · `test/ticket-runner.test.ts` 7(신규 — `ui/ticketRunner.ts`가 DOM 타입을 끌어들여 `tsconfig.uitest.json`에 넣고 `tsconfig.node.json`에서 뺐다, `document-path.test.ts`와 같은 처리) · `test/ticket-store.test.ts` +1(재컴파일이 `running`/`runError`를 초기화하는 것)) · `pnpm run build`(exit 0). "전체 프로젝트" 범위 밖 일괄 실행·에이전트에게 `ticket-request.json` 규약을 알려주는 스킬 지시문은 #155가 `nl-request.json` 쪽에서 같은 이유로 미룬 것과 같은 근거로 별도 이슈로 남겼다 |
> | 2026-09-28 (#155·#183) | 1절 "자연어 변환" 행(미착수 → 부분) | 이 단위를 다시 보며 갱신했다 — 다른 행은 재검증하지 않았다. **#155(PR #177)가 자연어 부분 수정 경로 전체(파일 교환·G1–G3 관문·Undo 연결·입력 UI)를 이미 머지해 뒀는데 이 표만 안 고쳐져 있었다.** #183(자연어 화면 생성) 착수 전 코드를 훑어 `command/transactionGate.ts`의 `runTransactionGates`·`store/editorStore.ts`의 `applyGuardedTransaction`이 Command 종류·개수에 무관한 범용 경로라는 걸 확인했다 — "여러 노드를 한 트랜잭션으로 조립하는 경로"(08 3.4가 새로 필요하다고 적은 것)가 실은 #154에서 이미 만들어져 있었다는 뜻이라 **새 코드 없이** 완료 판정을 충족했다. `test/nl-screen-generation.test.ts`(신규 4케이스)로 빈 화면에서 `examples/login-screen.json`(노드 4개) 재현이 전부-또는-전무·Undo 1단계로 되는 것을 직접 실행해 증명했다(`store/createNode.ts`가 노드 5종 + 부분 덮어쓰기를 먼저 지원하도록 넓힌 것은 이슈 #182·PR #191, 08 3.3의 "53칸" 문제 대응). **아직 안 된 것 둘은 완료 판정에 불필요해 별도 이슈로 분리하기로 했다** — `CreateNodeCommand`에 삽입 위치(`index`)가 없어 기존 화면 중간에 끼워 넣는 요청은 `createNode` 뒤에 `moveNode`를 붙여야 표현되는 점, `.visual-spec/runtime/nl-request.json`을 읽고 Command 배열을 쓰는 법을 에이전트에게 알려주는 지시문이 리포에 없는 점(`skills/visual-spec-authoring/SKILL.md`는 스펙 JSON 파일을 직접 쓰는 별개 경로용이다). "전체 프로젝트" 범위·새 페이지 생성·계획 미리보기·멀티턴 대화는 08 7.2가 MVP에서 명시적으로 뺐다. `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(**58파일 970케이스 중 969 통과** — 실패 1건은 `test/cli-gui.test.ts`의 macOS `/private/var` 심볼릭 링크 관련 기존 실패로 이 갱신과 무관하다, `develop`에서도 동일하게 실패한다) · `pnpm run build`(exit 0) |
> | 2026-10-02 (#188) | 1절 "Export · 검증" 행("안 보는 것" 서술에 1회 QA 결과 추가) | #157이 "타입 검사는 안 한다 — 사용자 프로젝트의 tsconfig·React 타입 버전을 알아야 한다"고 자인해 둔 채로 "내보낸 폴더가 실제 프로젝트에서 컴파일되는가"는 아무도 확인한 적이 없었다. 이 이슈는 그걸 자동화가 아니라 **1회 수동 증명**으로 메운다(02-mvp-scope.md 제외 범위와 겹쳐 tsc를 앱에 넣지는 않는다). 실제로 다섯 단계를 수행했다: (1) `examples/dashboard-cards.json`을 열고 SKILL.md의 "분리 생성 예제"(그 문서가 이미 정답으로 적어 둔 4파일 — `Header`·`Card`·`Content`·`DashboardPage`)를 그대로 `.visual-spec/generated/`에 써 넣었다. (2) `pnpm dev`로 GUI를 띄워 File ▸ Export Code → "파일 4개 · 티켓 4개 중 4개 포함 · 오류 0건" 확인 후 ZIP(`dashboardpage.zip`)을 실제로 내려받았다. (3) `pnpm create vite@latest`(react-ts 템플릿) + `@tailwindcss/vite`(v4)로 빈 프로젝트를 새로 만들고 그 ZIP을 풀어 `src/` 아래 넣었다. (4) `pnpm install` 후 타입 검사. (5) `pnpm dev`로 띄워 눈으로 확인 — 에디터 캔버스와 똑같이 "대시보드" 헤더 + 카드 2장("총 방문자 12,480", "전환율 3.7%")이 그려졌다. **미리 의심했던 세 가지를 확인한 결과**: ① `package.json`의 `"react": "*"`는 실제 `pnpm install`에서 문제가 안 된다(단독으로 돌려도 최신으로 정상 해석됨 — `buildPackageJson` 주석에 반영). ② Tailwind content 경로 안내는 v3 시절 전제였다 — **v4(`@tailwindcss/vite`)는 설정 없이 모듈 그래프를 자동으로 훑어** 별도 content 경로 지정 없이 스타일이 그대로 나온다(README 통합 방법 4번에 v4/v3 갈림을 반영). ③ 생성 코드가 `export default`(페이지)와 named export(컴포넌트)를 섞어 쓰는 건 사실이지만 **의도된 일관성**이다 — SKILL.md에 그 규칙을 명문화했다. **새로 찾은 것 — 범위 밖에서 발견**: `tsc --noEmit`을 그대로 돌리면 안 된다. 이 QA에서 만든 Vite 템플릿처럼 `tsconfig.json`이 `files: []` + `references`만 갖는 project-reference 구성에서는 `tsc --noEmit`이 **아무 파일도 검사하지 않고 조용히 exit 0을 낸다**(일부러 타입 오류를 심고 직접 재현해 확인했다 — `tsc -b --noEmit`은 그 오류를 바로 잡아낸다). 이 함정을 README의 "확인하지 않은 것"에 적었다. **코드는 고치지 않았다** — `export/bundle.ts`의 `buildReadme`·`buildPackageJson` 주석과 생성되는 README 문구만 갱신했다(`test/export-bundle.test.ts`의 `toContain` 단언이라 깨지지 않았다). `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(**62파일 1028케이스**, 이 브랜치는 테스트를 추가·변경하지 않았다) · `pnpm run build`(exit 0) |
> | 2026-09-27 (#157) | 1절 "Export · 검증" 행(미착수 → 부분) | 이 단위를 구현하며 갱신했다 — 다른 행은 재검증하지 않았다. `.visual-spec/generated/` 에 `pages/DashboardPage.tsx` · `components/{Header,Card,Content}.tsx` 를 손으로 넣고 `pnpm dev` 로 GUI 를 띄워 네 상태를 눈으로 확인했다: (1) 빈 `generated/` — 안내문 + 티켓 4개 전부 "없음", 내려받기 버튼 비활성, (2) 규칙을 지킨 4파일 — "파일 4개 · 티켓 4개 중 4개 포함 · 오류 0건", (3) 일부러 넣은 위반(`@/components/ui/Button` · 없는 `./Ghost` · 없는 `../assets/gone.png` · 티켓에 없는 `helpers.ts`) — 오류 3건·참고 1건이 줄 번호와 함께 표시, (4) `pnpm preview`(미들웨어 없는 빌드 결과물) — "작업공간에 연결돼 있지 않습니다". 내려받은 ZIP 은 Windows `Expand-Archive` 로 실제로 풀어 `dashboardpage/{pages,components,assets}/…`·`package.json`·`README.md` 구성과 `Get-FileHash` 로 `Card.tsx`·`hero.png` 바이트 일치를 확인했다. `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(**57파일 943케이스** — PR #177(이슈 #155) 머지 뒤 그 위로 리베이스한 값이다. 이 브랜치가 더한 것은 56케이스: `test/verify-generated.test.ts` 33 · `test/export-bundle.test.ts` 18 · `test/workspace-middleware.test.ts` +5) · `pnpm run build`(exit 0). **리베이스 때 `protocol.ts`에서 #155의 `RUNTIME_DIR`과 이 브랜치의 `GENERATED_DIR`이 같은 자리에 붙어 충돌했고, 둘 다 남기는 것으로 풀었다** — 서로 다른 폴더를 가리키는 별개 상수다 |
> | 2026-09-18 (#95, #94) | "GUI 각 영역의 실제 동작" 표의 `store/measureStore.ts` 행 괄호 안 관찰 기록(해결됨으로 갱신) | `store/measureStore.ts`·`store/viewStore.ts` 주석의 **"4-멤버"** 표현을 걷어냈다 — 숫자를 새 숫자로 바꾸지 않고 아예 빼서 `EDITOR_STORE_CONTRACT.md` 가 개수를 갖게 했다(다시 낡지 않도록). `git grep "4-멤버"` 로 저장소 전체를 훑어 `src/`·`test/`·나머지 `docs/` 히트 **0건** 확인 — 남은 히트는 이 07 문서가 그 표현을 **기록으로 인용한 자리**(이 행 · 위 부분 갱신 줄 · 아래 `store/measureStore.ts` 행)뿐이다. 함께 `ImageNode.src` 의 `description` 을 실제 값에 맞췄다(#94) — `ui/importImageFromFile.ts:64` 가 `FileReader.readAsDataURL` 로 base64 data URI 를 넣는 것을 재확인하고, `visual-spec.schema.json` 수정 후 `pnpm run generate:types`(주석 한 줄만 바뀜, 제약·구조 변경 없음) · `docs/06-schema-freeze.md` 의 미해결 항목에도 반영. `develop` c134c53(PR #139 포함) 위로 리베이스. `pnpm run typecheck`(exit 0) · `pnpm test`(**34파일 422케이스** — 이 브랜치가 더하거나 지운 케이스는 없다. `git diff --stat origin/develop...HEAD` 가 `test/` 파일도 로직도 건드리지 않음을 보인다) · `pnpm run lint` · `pnpm run build` 통과. **계약 멤버 수 자체는 이 1차에서 재확인하지 않았다** — 아래 2차 행에서 실측했다 |
> | 2026-09-18 (PR #140 리뷰, 2차) | "GUI 각 영역의 실제 동작" 표의 `store/editorStore.ts` 행(계약 멤버 수 · `test/editor-store.test.ts` 케이스 수 · 페이지 액션의 UI 호출자), `ui/LayerTree.tsx` 행(페이지 UI), `store/measureStore.ts` 행 괄호 안의 개수 이력 | 리뷰(wook3964) 지적 — 1차에서 `measureStore`·`viewStore` 주석의 하드코딩된 멤버 수를 걷어내면서, 정작 이 문서는 계약을 **"11개"**(2026-09-08 값)로 둔 채 그 문장이 링크하는 `EDITOR_STORE_CONTRACT.md` 는 이미 **16개**여서 링크를 누르면 숫자가 곧바로 어긋났다. **직접 실측해 16으로 갱신했다** — `EditorState` 인터페이스 전문(`store/editorStore.ts:42`–`:140`)의 최상위 멤버를 세어 `spec`·`activePageId`·`selectedId`·`history`·`select`·`selectPage`·`setNodeField`·`setPageField`·`addPage`·`removePage`·`loadSpec`·`insertNode`·`removeNode`·`moveNode`·`undo`·`redo` **16개**, `EDITOR_STORE_CONTRACT.md:22` 의 §2 제목 "계약의 전부 (16개)" 및 그 아래 표 **16행**과 1:1 대조해 목록·개수 모두 일치함을 확인했다(11 → 14 → 15 → 16 으로 세 번 늘었고 전부 이 브랜치 이전 커밋이다 — 늘어난 다섯은 `history`·`removeNode`·`moveNode`·`undo`·`redo`). **같은 행에 붙어 있던 낡은 수치 둘도 함께 실측해 고쳤다** — `test/editor-store.test.ts` 는 28 → **62케이스**이고, "`selectPage`·`addPage`·`removePage` 는 아직 UI 호출자가 없다"는 서술은 `git grep` 상 `ui/LayerTree.tsx:339`·`:353`·`:532` 가 셋 다 부르고 있어 사실이 아니다(`ui/LayerTree.tsx` 행의 "페이지 폴더·페이지 전환 UI 는 아직 없다"도 같은 이유로 갱신). `develop` dce0930(PR #141, 이슈 #132 머지 포함) 위로 리베이스. `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(**35파일 433케이스 전부 통과** — 이 브랜치는 `test/` 를 건드리지 않았고, 아래 4절 테스트 행의 33파일 363케이스는 2026-09-15 시점 값이다) · `pnpm run build`(exit 0) 통과. **관찰(이번에 고치지 않음)**: 4절 테스트 행의 파일별 집계도 낡았다 — 총계뿐 아니라 `test/tool-store.test.ts` 가 거기서는 3케이스인데 실제로는 **10케이스**다. 파일 35개를 전부 재실측해야 고칠 수 있어 이 리뷰 반영의 범위 밖으로 두고 여기에만 남긴다 |
> | 2026-09-18 (#131·#132 머지 반영, 3차) | 1절 Command Engine 행 · IR·스키마 행의 테스트 집계, "GUI 각 영역의 실제 동작" 표의 `store/editorStore.ts`·`ui/LayerTree.tsx`·`ui/PropertiesPanel.tsx`/`ui/properties/`·`ui/canvasLayout.ts`·`store/viewStore.ts`·`ui/HomeScreen.tsx` 행, 그 표 아래 `setNodeField` 호출 지점 문단과 "남은 것 — `insertNode`" 문단, 2절 Undo/Redo 행, **4절 테스트 행(파일 35개 전수 재실측)**, 6절 제안 1, 아래 "확인 방법", `EDITOR_STORE_CONTRACT.md` 의 `TextField` 문단·Undo/Redo 스택 절 | 이슈 #131(PR #142 — `insertNode`·`addPage`·`removePage` 를 Undo/Redo 에 태우고 스택 단위를 페이지에서 **프로젝트**로 올림)·#132(PR #141 — `TextField` 연속 타이핑을 undo 한 단계로 병합)가 `develop` 72aa74d 로 머지되면서 이 문서의 서술 몇 개가 사실이 아니게 됐다. 이 갱신은 **코드를 건드리지 않고 문서만 고쳤다**. 실측 근거 — `history` 는 `HistoryState<EditorSnapshot>`(`EditorSnapshot = { spec, activePageId }`)로 `store/editorStore.ts:63`·`:85` 에서 확인했고 페이지별 `Record<PageId, …>` 가 아니다. `insertNode` 는 `applied(state, state.activePageId, { type: "createNode", … })`(`:386`) 로 Command Engine 을 거치므로 "아직 이 경로 밖"이라는 서술 셋(1절 Command Engine 행 · 같은 절 "남은 것" 문단 · 2절 Undo/Redo 행)을 전부 고쳤다. `addPage`(`:330`)·`removePage`(`:365`)는 Command 를 안 거치지만 `pushHistory(…, makeSnapshot(…))` 로 history 에는 쌓인다. Undo/Redo 버튼 비활성화는 `ui/LayerTree.tsx:401`·`:402` 가 `canUndo(state.history)`/`canRedo(state.history)` 를 그대로 부르는 방식이라 `history[activePageId]` 를 보지 않는다. **계약 멤버 수는 이번 변경으로 안 달라졌는지 직접 다시 셌다 — `history` 의 타입만 바뀌어 여전히 16개다**(`EditorState` 인터페이스 전문 `store/editorStore.ts:72`–`:180`, 2차가 적어 둔 `:42`–`:140` 은 그 뒤 주석이 늘며 낡은 범위라 함께 고쳤다). 파일 경로·줄 번호도 이번에 많이 움직여 다시 쟀다 — `find src/features/editor/ui/properties -type f` **31개**(`fields/editBurst.ts` 신설로 30 → 31), `ui/LayerTree.tsx` 의 `addPage` 는 `:532` → **`:529`**(`selectPage :339` · `removePage :353` 은 그대로), `git grep -n "setNodeField" src/` 로 실제 호출 지점 **세 곳**(`properties/useNodeField.ts:32` · `ui/LayerTree.tsx:115`(이름 변경)·`:255`(표시 토글) · `ui/Canvas.tsx:556`·`:561`(리사이즈 핸들)) — "두 곳"이라던 2026-09-08 집계는 그 뒤 리사이즈(PR #99)와 트리 이름 변경이 붙으면서 낡았다. **4절 테스트 행은 `pnpm test` 출력을 파일별로 그대로 받아 적었다 — 35파일 441케이스 전부 통과**(2차가 관찰로만 남겨 둔 `test/tool-store.test.ts` 3 → **10** 도 이 전수 실측에 포함됐다). 그 김에 표 안에 흩어져 있던 파일별 수치도 같은 출력과 맞췄다 — `editor-store` 62 → **70** · `canvas-layout` 26 → **40** · `apply-command` 18 → **20** · `view-store` 9 → **7** · `fit-zoom` 10 → **7** · `home-preview` 3 → **5**. `git grep "363케이스"`·`"33파일"` 로 저장소 전체를 훑어 **그 수치를 현재 상태로 주장하는 자리는 0건**임을 확인했다 — 남은 히트는 이 07 문서가 그것을 **기록으로 인용한 자리**(위 2차 행 · 아래 2026-09-15(#128) 행 · 이 행 · 4절 테스트 행의 "직전 집계" 설명)뿐이고 `src/`·`test/`·나머지 `docs/` 히트는 없다. `pnpm install --frozen-lockfile` · `pnpm run typecheck`(exit 0) · `pnpm run lint`(exit 0) · `pnpm test`(exit 0) · `pnpm run build`(exit 0). **관찰(이번에 고치지 않음)**: `useDraftInput` 계열(숫자·색상 칸)에는 `TextField`(#132)가 받은 "값이 그대로면 커밋하지 않는" 가드가 없다 — 값이 안 바뀌는 커밋이 스토어에서는 no-op 인데 입력칸의 burst 는 시작돼, 뒤따르는 입력이 직전 *남의* undo 체크포인트를 덮어쓴다. 코드 수정이 필요해 이 문서 작업의 범위 밖이고 `EDITOR_STORE_CONTRACT.md` 에 결함으로 적어 뒀다 |
> | 2026-09-15 (#128) | 1절 "localhost GUI · Canvas" 행("안 되는 것" 서술 갱신 — 리사이즈는 이미 됐었다는 점도 이 김에 바로잡음), 4절 테스트 행 | 이슈도 브랜치도 없이 코드에서 직접 찾은 문제 — `editorStore.ts`의 초기값이 무조건 `seedSpec`이고 `localStorage` 사용처가 테마(`ui/theme-storage.ts`) 하나뿐이라, 새로고침하면 작업 중이던 프로젝트가 통째로 사라졌다. `store/specStorage.ts`(신규, `loadStoredSpec`/`saveSpecToStorage` — `validateProjectSpec`을 거쳐 깨진 값은 걸러내고 `seedSpec`으로 안전하게 대체) + `App.tsx`의 `useSpecAutosave`(spec 변경을 구독해 500ms 디바운스 후 저장)로 해결. `editorStore.ts` 자체에 구독을 안 넣은 이유(모든 테스트가 매번 타이머를 만들게 됨)를 파일 상단에 남김. `pnpm test`(**33파일 363케이스** — `spec-storage.test.ts` 신규 6케이스, `localStorage` 자체가 없는 Node 테스트 환경이라 `vi.stubGlobal`로 최소 구현을 흉내 냄). `pnpm run typecheck`·`pnpm run lint` 통과 |
> | 2026-09-15 (#125) | 2절·"GUI 각 영역의 실제 동작" 표의 `ui/MenuBar.tsx`(View)·`ui/Canvas.tsx`·`store/viewStore.ts` 행 | `View ▸ Fill Viewport` 와 그 로직을 걷어냈다. `fillViewport`·`toggleFillViewport`·`FitMode`·`fitZoom` 의 `mode` 인자가 사라지고 Fit 은 항상 아트보드 전체를 맞춘다. `git grep fillViewport` 히트 **0건**(src·test·docs). `pnpm test`(**32파일 357케이스** — `develop` 277b558(PR #122 머지) 의 32파일 362케이스에서, 지운 5케이스(`fit-zoom` 3 · `view-store` 2)만큼 줄어든 값이다. 양쪽 다 실제로 돌려 확인했다) |
> | 2026-09-13 (#121) | `EDITOR_STORE_CONTRACT.md` §2 · Undo/Redo 절 · 4절 테스트 행 | 숫자 입력칸이 키 입력마다 즉시 커밋해서(`useDraftInput.ts`) history가 글자 수만큼 쌓이던 문제 — 이슈는 코드 주석(`editorStore.ts`의 `reconciledHistory` 문서화)에 이미 있었지만 대응 이슈가 없었다. `command/history.ts`에 `replacePresent` 추가, `setNodeField`/`setPageField`에 `continueEdit?: boolean`(기본 false) 매개변수 추가 — true면 `pushHistory` 대신 `replacePresent`를 쓴다. **스토어가 "같은 노드·경로면 병합"을 스스로 추측하게 하는 설계는 셀프 리뷰 중 버렸다** — 레이어 트리의 "표시" 토글처럼 같은 경로를 반복 호출해도 매번 별개 편집이어야 하는 호출부(+캔버스 드래그)까지 잘못 합쳐지는 걸 재현해서 확인했다. 대신 `useDraftInput.ts`가 타이핑 burst를 로컬 `ref`로 추적해 `continueEdit`을 넘기고(`handleBlur`로 burst 종료), `NumberField`/`SizeField`/`ColorField`의 `onChange`와 `useNodeField.ts`가 그 값을 그대로 전달하도록 시그니처를 넓혔다 — 캔버스 드래그·표시 토글처럼 이 매개변수를 모르는 기존 호출부는 그대로 매번 새 단계를 쌓는다. `TextField`(이름·텍스트 content)는 `useDraftInput`을 안 써서 범위 밖으로 남겼다. `pnpm test`(**31파일 354케이스** — `history.test.ts` +2, `editor-store.test.ts` +5). `pnpm run typecheck`·`pnpm run lint` 통과 |
> | 2026-09-11 (#45, 리뷰 반영) | 5.1 `package.json`의 `files` 행 신규, 위 표의 `#40` 행(리베이스 중 실수로 옛 버전으로 되돌아간 것 복구) | Yumesa2025 리뷰(PR #113/#114 — 같은 이슈를 6분 차이로 중복 작업해 #114는 닫고 이 PR로 이어감) 두 가지 반영: 🔴 리베이스 충돌 해결 중 `#40` 행이 `develop`의 최신 버전이 아니라 그 이전 버전으로 잘못 되돌아간 걸 `git show origin/develop`과 대조해 복구, 🟡 `package.json`에 `"files": ["bin", "skills"]` 추가·`npm pack --dry-run`으로 9파일·21.9 kB 확인(`src/`·`test/`·`docs/` 등 0건) |
> | 2026-09-11 (#45) | 5.1 `package.json`의 `main` 행 | `main` 필드 제거. 패키지 이름으로 import하는 곳이 `src/`·`test/`·`scripts/` 어디에도 없음을 `git grep` 로 확인. `develop` 1b3d5f3(PR #108, 이슈 #105 머지 포함) 위로 리베이스. `pnpm run typecheck`·`pnpm test`·`pnpm run build` 전부 영향 없음 확인 |
> | 2026-09-11 (#46) | 3절 크기 항목의 `fill` 서술, 6절 관련 없음(제안 아님) | `docs/06-schema-freeze.md`의 "이 계약이 보장하지 않는 것"에서 `Size`의 `fill` 항목을 빼고 새 절("`fill`의 교차축 의미 확정")로 옮김 — 코드는 안 바꿈, `ui/canvasLayout.ts`의 기존 `boxStyle()` 구현·`test/canvas-layout.test.ts` 8케이스를 근거로 씀. `skills/visual-spec-to-react/SKILL.md`의 매핑 참고표에 `fill` 행이 이미 있음을 확인(이슈 본문의 "표에 없다"는 지적은 최신 스킬 상태와 안 맞았다). `visual-spec.schema.json`의 `Size.description`에 06 참고 문구 한 줄 추가 후 `pnpm run generate:types`(생성된 주석 한 줄만 바뀜, 구조 변경 없음). `pnpm run typecheck`·`pnpm test`(31파일 347케이스)·`pnpm run lint` 전부 영향 없음 확인 |
> | 2026-09-11 (#105) | 2절 CLI 행 | `bin/visual-spec.mjs` 에 인자 없는 실행(GUI) 추가·전문 열람 · `test/cli-gui.test.ts` 신설(실제로 이 패키지의 Vite 개발 서버를 자식 프로세스로 띄우고 준비 로그를 확인한 뒤 종료하는 케이스 포함). `develop` 7803cdf(PR #111, 이슈 #92 머지 포함) 위로 리베이스. `pnpm test`(**31파일 339케이스**). 셀프 리뷰 중 두 가지를 직접 잡음 — (1) `test/cli-skills.test.ts`의 기존 "사용법" 테스트가 인자 없이 CLI를 불러서 GUI(무한정 떠 있는 서버)가 뜨는 바람에 그 테스트가 영원히 안 끝나 전체 `pnpm test`가 멈췄다(`help`로 고침), (2) `process.on("SIGTERM"/"SIGINT", ...)`을 등록하면 Node의 기본 종료 동작이 사라져서, 신호를 자식(vite)에 전달만 하고 부모 자신은 안 죽어 vite가 고아로 남았다(`process.exit()` 명시 호출 + 3초 뒤 강제 `SIGKILL` 승격으로 고침). **머지됨(PR #108).** |
> | 2026-09-11 (#92) | "GUI 각 영역의 실제 동작" 표의 `ui/PropertiesPanel.tsx` 와 `ui/properties/` 행 | `PropertiesPanel.tsx` 와 `properties/` 신규 8파일(`nodeSections.ts`·`imageSrc.ts`·`NodeSectionList.tsx`·Layout/Background/Border/Typography/Color/Content Section) 편집·열람. `FrameProperties.tsx`·`TextProperties.tsx` 삭제. `find src/features/editor/ui/properties -type f` **30개** 실측. `pnpm test`(**30파일 336케이스** — `develop` 3c3e434(PR #107 머지) 의 28파일 311케이스에 이 브랜치의 25케이스가 붙은 값이다. 양쪽 다 실제로 돌려 확인했다) |
> | 2026-09-10 (#104) | 2절 CLI 행 | `bin/visual-spec.mjs` 에 `skills` 명령 추가·전문 열람 · `test/cli-skills.test.ts` 신설. `develop` 15edf1f(PR #102, 이슈 #40 머지 포함) 위로 리베이스. `pnpm test`(**28파일 302케이스**). **머지됨(PR #107).** |
> | 2026-09-11 (#40, 리뷰 반영) | 1절 표 아래 `setNodeField`·`setPageField` 문단, `EDITOR_STORE_CONTRACT.md`, 4절 테스트 행, 아래 "확인 방법" | PR #102 리뷰(GAMMJ)의 🔴 `removePage` history 누수 · 🟡 `setPageField` Command Engine 미적용 두 가지를 코드로 고치고, 고치기 전에 실패하는 테스트로 먼저 확인(`removePage`는 `setPageField`가 아니라 `setNodeField`로 history를 쌓아야 실제로 재현됨을 검증 과정에서 확인). PR #106(이슈 #42)이 머지된 `develop` e776088 위로 리베이스. `pnpm test`(**27파일 295케이스** — e776088이 `test/cli-init.test.ts` 6케이스를 이미 포함한다). **머지됨(PR #102).** |
> | 2026-09-09 (#42) | 2절 CLI 행 · `.visual-spec/` 작업공간 행 | `package.json` 에 `bin` 필드 추가, `bin/visual-spec.mjs`(`init` 명령) 신설·전문 열람. `develop` db6bea1(PR #96·#97·#98·#99·#100·#103 전부 포함) 위로 리베이스. `pnpm test`(**27파일 281케이스**). **머지됨(PR #106).** |
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
> | 2026-09-08 (#40) | 1절 Command Engine 행·setNodeField 직접 수정 서술, 2절 Undo/Redo 행, 6절 제안 1 | `command/applyCommand.ts`가 `VisualSpec` 대신 `ScreenSpec`을 받도록 바꾸고(v0.2 `pages[id]`에도 그대로 쓰기 위해), `editorStore.setNodeField`가 내부적으로 `updateNode` Command를 만들어 적용하도록 바꿈. 페이지별 `history` + `undo`/`redo` 스토어 액션 추가. `pnpm test`(25파일 259케이스, 신규 11케이스) 통과 확인. `useNodeField.ts`·`PropertiesPanel.tsx`는 시그니처가 안 바뀌어 **건드리지 않았다** |
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
> **2026-09-18 3차(#131·#132 머지 반영)에 재확인하지 않은 항목** — 위 표의 "3차" 행에 없는 모든 항목.
> 이 갱신은 **이미 머지된 작업의 문서 후속**이다 — 닫을 이슈가 없고, `src/`·`test/` 는 읽기만 했다.
> 다시 본 것은 (1) #131 로 `history` 의 모양과 `undo` 의 의미가 바뀌면서 **사실이 아니게 된 서술**,
> (2) #132 로 `TextField` 가 병합 대상이 되면서 같은 처지가 된 서술, (3) 그 서술들이 인용하는
> 파일 경로·줄 번호, (4) 4절 테스트 집계(파일 35개 전수) 뿐이다.
> 1절 자연어 변환·Export 행, 2절의 나머지 행, 3절 전체, 4절의 예제·스킬·CI 행과 오류 코드 8종,
> 5절 전체, 6절 제안 2·3 은 **이번에 보지 않았고 날짜를 올리지 않았다.**
> `ui/properties/` 행의 필드 28개 집계와 `useNodeField` 호출 지점도 이번 범위 밖이다 — 그 행에서
> 고친 것은 파일 개수(30 → 31)와 `editBurst.ts`·`TextField` 서술뿐이다.
> **코드에서 고칠 것을 하나 찾았지만 고치지 않았다** — `useDraftInput` 계열(숫자·색상 칸)에는
> `TextField`(#132)가 받은 "값이 그대로면 커밋하지 않는" 가드가 없어, 값이 안 바뀌는 커밋이
> 스토어에서는 no-op 인데 입력칸의 burst 는 시작되고, 뒤따르는 입력이 `continueEdit: true` 로
> 올라가 직전 *남의* undo 체크포인트를 덮어쓴다. 값 비교가 타입마다 달라(숫자 · 색상 문자열 ·
> `Size` 유니온) `TextField` 의 한 줄짜리 가드처럼 끝나지 않는다. 이 브랜치는 문서만 고치므로
> `EDITOR_STORE_CONTRACT.md` 에 **남은 결함**으로 적어 두는 데서 그쳤다 — 대응 이슈는 아직 없다.
>
> **2026-09-15(#128)에 재확인하지 않은 항목** — 위 표의 "#128" 행에 없는 모든 항목.
> "1절 localhost GUI · Canvas" 행이 "안 되는 것"에 지속성 부재를 적어뒀었다 — 대응 이슈는
> 없었다. `.visual-spec/` 파일시스템 워크스페이스(이슈 #42가 CLI `init`으로 폴더만 만들어둔
> 그 자리)로 완전히 옮기는 건 브라우저 GUI 혼자 하기엔 범위가 커서(File System Access API
> 등 별도 설계 필요) 1단계로 좁혔다 — `localStorage` 자동저장/복원만 넣었다. `theme-storage.ts`가
> 이미 쓰던 패턴(키 상수 분리, try/catch로 접근 실패 흡수)을 그대로 따랐다. **셀프 리뷰 중
> 구멍 하나를 직접 잡았다** — 저장이 500ms 디바운스인데, 이 기능이 막으려는 바로 그 상황
> (탭을 닫음)이 그 500ms 안에 일어나면 마지막 변경이 유실됐다. `beforeunload`에서 남은
> 타이머를 취소하고 그 자리에서 즉시 저장하는 `flushPending`을 추가해서 막았다 — 브라우저
> 콘솔에서 입력 이벤트 직후 `beforeunload`를 합성 디스패치해 디바운스가 끝나기 전에도
> 저장되는 것과, `beforeunload` 없이는 여전히 디바운스 중(값 없음)인 대조군 둘 다 실제로
> 확인했다. **남은 한계** — `beforeunload`가 100% 보장되진 않는다(강제 종료 등, 최후
> 방어선은 File > Save). **여러 탭을 동시에 열면** 나중에 저장하는 탭이 앞선 탭의 변경을
> 덮어쓸 수 있다 — 탭 간 동기화(`storage` 이벤트 등)는 이번 범위 밖으로 남겼다. **이 브랜치는
> 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다.**
>
> **2026-09-13(#121)에 재확인하지 않은 항목** — 위 표의 "#121" 행에 없는 모든 항목.
> `EDITOR_STORE_CONTRACT.md`의 Undo/Redo 관련 두 문단(57번째 줄 근처)이 이미 이 문제를
> "**#118로 Undo/Redo UI가 생기면서 이게 더는 가상의 문제가 아니다**"라고 적어뒀었다 —
> 대응 이슈는 없었다. 이 브랜치가 그 이슈(#121)를 만들고 고쳤다. **처음엔 스토어가
> "직전 호출과 같은 노드·경로면 병합"을 스스로 판단하는 방식(내부 상태 하나 +
> 패널 blur 감시)으로 짰는데, 셀프 리뷰 중 레이어 트리 표시 토글과 캔버스 드래그를
> 대입해보니 둘 다 잘못 병합되는 걸 확인해서 갈아엎었다.** 최종 형태는 스토어가
> 추측하지 않고, 아는 쪽(`useDraftInput.ts`)이 `continueEdit` 인자로 명시하는
> opt-in 방식이다 — 대신 `useNodeField.ts`·`NumberField`/`SizeField`/`ColorField`·
> `PageProperties.tsx`의 시그니처를 넓혀 그 인자가 끝까지 전달되게 했다(호출하는
> JSX 28곳은 그대로 둬도 되지만, 인자를 넘겨받아 전달하는 함수 몇 개는 손댔다).
> **이 브랜치는 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다.**
>
> **2026-09-11(#45)에 재확인하지 않은 항목** — 위 표의 "#45" 행에 없는 모든 항목.
> `package.json`의 `main` 필드만 지웠다 — 이슈 본문이 "이 저장소가 앱인가 라이브러리인가"를
> #42와 함께 결정하라고 남겨뒀는데, #42·#104·#105가 `bin` 필드로 답을 냈다(CLI 앱, PR #106·
> #107·#108로 전부 이미 `develop`에 머지됨). `main`이 가리킬 실제 빌드 산출물이 없고, 패키지
> 이름으로 이 저장소를 import하는 곳도 없어서 필드 자체를 지웠다 — 5.1 참고. `develop`
> 1b3d5f3(PR #108 포함, `bin` 필드가 이미 들어와 있다) 위로 리베이스했다 — `package.json`에서
> `bin` 추가와 `main` 제거가 만나는 자리라 매번 리베이스마다 충돌이 났지만, 둘 다 반영해서
> 해소했다. **이 브랜치는 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다.**
>
> **2026-09-11(#46)에 재확인하지 않은 항목** — 위 표의 "#46" 행에 없는 모든 항목.
> 이슈 #46은 코드 변경이 없는 문서 작업이다 — `docs/06-schema-freeze.md`가 동결 당시
> "미정"으로 남겨뒀던 `Size`의 `fill` 교차축 의미를, 그 사이 `ui/canvasLayout.ts`의
> `boxStyle()`이 이미 정해서 동작 중이던 걸 문서로 옮겼을 뿐이다. 이슈 본문이 "매핑
> 참고표에 이 경우가 없다"고 지적한 `skills/visual-spec-to-react/SKILL.md`를 확인해보니
> 이미 `fill` 행 3개(주축·교차축·root)가 들어와 있어서 그 파일은 고치지 않았다 — 이슈가
> 참고한 상태가 최신이 아니었던 것으로 보인다. `visual-spec.schema.json`의 `Size.description`에
> 06 참고 문구만 덧붙이고 `pnpm run generate:types`로 재생성했다(구조 변경 없음, 생성된
> 주석 한 줄만 바뀜). **이 브랜치는 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다.**
>
> **2026-09-11(#105)에 재확인하지 않은 항목** — 위 표의 "#105" 행에 없는 모든 항목.
> `bin/visual-spec.mjs`를 인자 없이 실행하면 이 패키지 자신의 Vite 개발 서버(`node_modules/.bin/vite --open`)를 띄운다 — `init`·`skills`와 달리 대상은 사용자 프로젝트가 아니라 이 저장소 자신이다(에디터 소스가 여기 있으니까). 이슈 #105 본문이 남긴 "이 작업의 일부인지, 별도인지 정해야 한다"는 질문에는 **별도로 남긴다**로 답했다 — GUI가 뜨긴 하지만 `.visual-spec/` 작업공간을 읽거나 쓰진 않는다(1절 GUI·Canvas 행이 여전히 맞다). 이걸로 이슈 #42가 나열한 4단계(`bin` 필드·`init`·`skills`·GUI 실행)가 전부 끝났다 — 각각 #42·#42·#104·#105로 나눠 처리했다. **이후 PR #108로 `develop`에 머지됨.**
>
> **2026-09-10(#104)에 재확인하지 않은 항목** — 위 표의 "#104" 행에 없는 모든 항목.
> PR #106(이슈 #42)이 머지된 `develop` 위로 리베이스했다 — git이 이미 머지된 커밋을
> 자동으로 걸러내 이 브랜치엔 이제 이 작업의 커밋 하나만 남는다. 이슈 #42가 만든
> `bin/visual-spec.mjs`에 `skills` 명령을 더했다 — 이 패키지의 `skills/`
> 5종을 `.claude/skills/`로 복사한다. `init`과 반대로 **덮어쓴다**: 스킬은 사용자가 손으로
> 고치는 파일이 아니라 도구가 배포하는 콘텐츠라, "다시 설치"는 "최신으로 맞춘다"는 뜻이어야
> 한다고 판단했다. 다만 파일 내용이 같으면 쓰지 않는다(`readFileSync`로 바이트 비교) —
> 실제로 바뀐 스킬만 "갱신함"으로 보고한다. `.claude`·`.claude/skills`·개별 스킬 폴더 자리에
> 파일이 있는 경우는 `init`의 `.visual-spec` 검사와 같은 방식으로 막는다(`test/cli-skills.test.ts`
> 7케이스로 설치·멱등·갱신·에러 네 가지 다 검증). 이슈 #42 본문이 나열한 나머지 한 단계
> (인자 없는 `npx visual-spec`, GUI 실행)는 이슈 #105로 분리해 아직 손대지 않았다.
> **이후 PR #107로 `develop`에 머지됨.**
>
> 이 갱신은 이슈 #42 브랜치(`42--cli-workspace`)에서 새로 만든 `bin/visual-spec.mjs`·
> `package.json`의 `bin` 필드·`test/cli-init.test.ts`만 봤다. `develop` db6bea1(PR #96·#97·
> #98·#99·#100·#103 전부 포함) 위로 리베이스했고, 코드는 무충돌이었다(이 문서만 표 순서
> 충돌 — 해소함). `init`만 구현했고, 이슈 #42 본문이 나열한 나머지 세 단계(`package.json`의
> `main` 필드 정리는 별도 이슈 — #45, `npx visual-spec skills`는 이슈 #104, 인자 없는
> `npx visual-spec`은 이슈 #105)는 이번에 손대지 않았다 — 위 2절 CLI 행 참고.
> **이후 PR #106으로 `develop`에 머지됨.**
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
> **2026-09-09(#40, 리뷰 반영)에 재확인하지 않은 항목** — 바로 위 "setNodeField·setPageField는
> 이제 Command Engine을 거친다" 절과 `removePage`의 history 정리 서술 말고는 다시 안 봤다.
> `develop`이 PR #103(테두리 정리)까지 머지돼 db6bea1이 됐길래 그 위로 다시 리베이스했다 —
> `docs/07-implementation-status.md`만 충돌 없이 자동 병합됐고 코드는 전부 무충돌이었다.
> **이 브랜치는 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다.** GAMMJ가 PR #102에
> 남긴 리뷰(🔴 `removePage`가 history를 안 지움 · 🟡 `setPageField`도 Command Engine을
> 태워야 `Closes #40`이 정확함 · 🟡 `useDraftInput` 키 입력 단위 스냅숏은 주석으로만 남김)를
> 반영했다.
>
> **2026-09-09(#40)에 재확인하지 않은 항목** — 위 표의 "#40" 행에 없는 모든 항목.
> 이 갱신은 `develop` f768bb4(PR #98 07 재실측·PR #96 선택 오버레이·PR #97 05 갱신·PR #100 레이어
> 트리 페이지 폴더·PR #99 캔버스 리사이즈 핸들까지 반영된 상태) 위로 리베이스한 이슈 #40 브랜치(`40--command-engine-panel-wiring`)에서
> 직접 건드린 `command/`·`editorStore.ts`·관련 테스트·`EDITOR_STORE_CONTRACT.md`에 걸린 서술만
> 다시 봤다. **이 브랜치는 이 문단을 쓴 시점엔 아직 `develop`에 머지되지 않았다.**
> `useNodeField.ts`·`PropertiesPanel.tsx`는 시그니처가 그대로라 건드리지 않았고, 위 "2026-09-08
> 2차"가 남긴 "`setNodeField` 호출 지점은 두 곳(패널의 `useNodeField.ts`, 트리의 표시 토글)"이라는
> 서술은 이 PR 이후에도 여전히 맞다 — 내부 구현이 바뀌었을 뿐 호출 지점 개수는 그대로다. `insertNode`도
> 이 PR 범위 밖이라 여전히 Command Engine을 거치지 않는다 — `EDITOR_STORE_CONTRACT.md`의 새 서술 참고.
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
| IR · 스키마 | **완료** | `src/features/editor/schema/` — JSON Schema 정본, 생성 타입, 검증기, 공개 index. v0.1로 동결([06-schema-freeze.md](06-schema-freeze.md)). **2026-10-04 갱신(#127 1단계): 두 최상위 타입의 `version`이 모두 `"0.3"`이 됐고 `background`가 채우기 겹 배열(`Fill[]`)이 됐다. 0.1·0.2 파일은 열 때(`parseSpecJson`)와 자동 저장 복원 때(`specStorage`) `migrateToV03`가 변환한다 — 이 칸의 아래 v0.1/v0.2 서술은 그 전 상태의 기록이다([06의 v0.3 절](06-schema-freeze.md#v03--배경-채우기-겹-배열-2026-10-04-추가-127)).** **다만 지금은 v0.1과 v0.2(`ProjectSpec`)가 병행한다** — **정본 스키마의 루트는 아직 v0.1이다**(`version` 이 `const: "0.1"`, `required` 가 `["version", "screen"]`). v0.2 는 `$defs` 에 `ProjectSpec`(`version: "0.2"` · `name` · `pages` · `pageOrder`)·`PageId` 가 추가된 형태로만 들어와 있고, 각 페이지는 v0.1 의 `ScreenSpec` 그대로다. **반면 런타임 상태는 v0.2 다** — `store/editorStore.ts` 의 초기값이 `migrateV01(seedSpec)`(`schema/migrate.ts`)이라 스토어는 `spec: ProjectSpec` + `activePageId` 를 들고, `ui/Canvas.tsx`·`ui/LayerTree.tsx` 는 `spec.pages[activePageId]` 로 읽는다. **저장되는 파일도 v0.2 다** — `store/exportSpec.ts` 가 `validateProjectSpec`(`schema/validate.ts` — `$defs.ProjectSpec` 로 검증하고 `pageOrder` 불일치를 `page-order-mismatch` 로 잡는다)을 거쳐 `ProjectSpec` 을 그대로 내려받는다. v0.1 문서를 열면 `loadSpec` 이 `migrateV01` 로 넓히므로 **예전 파일도 그대로 열린다**(반대 방향 `toVisualSpec` 도 있지만 그걸 고르는 UI 는 없다). 즉 **아직 v0.2 로 옮겨지지 않은 것은 정본 스키마의 루트 선언과 동결 문서**이고, 코드와 실제 데이터는 이미 v0.2 다. `test/` 35파일 441케이스 통과(2026-09-18, PR #141(이슈 #132)·PR #142(이슈 #131)까지 머지된 `develop` 72aa74d 기준 — `pnpm test` 실행 결과로 확인) |
| Command Engine | **부분** | `src/features/editor/command/`에 Command 타입 6종(`types.ts` — createNode/updateNode/deleteNode/moveNode/setLayout/updateScreen — 2026-09-18 실측. `updateScreen` 이 #40 리뷰(PR #102)에 늘었는데 이 집계가 못 따라오고 있었다), 순수 적용기(`applyCommand.ts` — 규칙 위반 시 예외 없이 원본 spec 참조를 그대로 돌려준다), 범용 undo/redo 스택(`history.ts`)이 있다(`test/apply-command.test.ts` 20케이스 · `test/history.test.ts` 8케이스). **이제 실제로 쓰인다** — `editorStore.setNodeField`가 내부적으로 `updateNode` Command를 만들어 `applyCommand`로 적용한다(2026-09-09, 이슈 #40). 시그니처는 그대로라 호출부(패널의 `useNodeField.ts`, 트리의 이름 변경·"표시" 토글, 캔버스의 리사이즈 핸들 — 아래 §의 실측 참고)는 안 바뀌었다. **`insertNode`도 2026-09-18(이슈 #131, PR #142)에 이 경로로 들어왔다** — `createNode` Command를 거치므로 "부모가 frame 인지 · 그 id 가 이미 있는지" 판정을 Command Engine 이 이미 갖고 있던 것으로 재사용한다. 스토어가 직접 노드를 만들던 마지막 자리가 없어졌다. `applyCommand.ts`는 v0.2 `ProjectSpec.pages[id]`에도 쓸 수 있도록 `VisualSpec` 대신 `ScreenSpec`을 받게 바뀌었다 |
| 자연어 변환 | **부분(2026-09-28, 이슈 #155·#183)** | **자연어 부분 수정은 됐다**(이슈 #155, PR #177, 머지됨) — `.visual-spec/runtime/` 파일 교환(`editor/nl/nlProtocol.ts`·`nlAgentClient.ts`), G1(#153 `validateTransaction`)·G2·G3(#154 `transactionGate.ts`)·`applyGuardedTransaction`, 입력 UI `ui/NaturalLanguageBar.tsx`, "요청 하나 = Undo 한 단계"까지 전부 연결돼 있다. **자연어 화면 생성**(이슈 #183, `feat/183-nl-screen-generation` 브랜치, PR 작성 전)은 같은 파이프라인을 그대로 탄다 — `runTransactionGates`·`applyGuardedTransaction`이 Command 종류·개수에 무관한 범용 경로라 새 메커니즘이 필요 없었다. `store/createNode.ts`가 노드 5종 + 부분 덮어쓰기를 지원하도록 먼저 넓혔고(이슈 #182, PR #191, 머지됨 — 08 3.3이 지적한 "노드 4개짜리 최소 화면도 53칸" 문제 대응), `test/nl-screen-generation.test.ts`로 빈 화면에서 `examples/login-screen.json`(노드 4개) 재현이 전부-또는-전무·Undo 1단계로 되는 것을 직접 실행해 증명했다. **안 된 것** — `CreateNodeCommand`에 삽입 위치(`index`)가 없어 기존 화면 중간에 끼워 넣는 요청은 `createNode` 뒤에 `moveNode`를 붙여야 표현된다(완료 판정엔 불필요, 별도 이슈로 분리 예정). `.visual-spec/runtime/nl-request.json`을 읽고 Command 배열을 쓰는 법을 알려주는 에이전트용 지시문이 리포에 없다(`skills/visual-spec-authoring/SKILL.md`는 스펙 JSON 파일을 직접 쓰는 별개 경로용, 별도 이슈로 분리 예정). "전체 프로젝트" 범위·새 페이지 생성·계획 미리보기·멀티턴 대화는 08 7.2가 MVP에서 명시적으로 뺐다 |
| Ticket Compiler · Agent | **부분(2026-09-29, 이슈 #184 — A안 + B안 실행 연결)** | `skills/visual-spec-to-react/SKILL.md`의 컴포넌트 경계·반복 형제 그룹화·의존성 순서를 코드로 옮긴 `compileTickets`를 GUI가 실제로 호출한다. 메뉴바 `구현 티켓`이 현재 페이지를 컴파일하고 우측 `TicketPanel`에 목록·의존성·pending/in-progress/done/failed 상태를 표시하며, `ticketStore`가 계획을 보관한다(A안, #156). **이제 실제 실행 왕복도 된다**(B안, #184) — #155가 만든 `.visual-spec/runtime/` 파일 교환 패턴을 그대로 재사용한 `ticket/ticketProtocol.ts`(`ticket-request.json`/`ticket-response.json` 형식)·`ticket/ticketAgentClient.ts`(폴링)로, 패널의 "전체 실행"이 `ticketStatus.readyTickets`가 계산한 웨이브(의존이 모두 done인 티켓들)를 보내고 응답이 오면 자동으로 다음 웨이브로 이어간다(막히거나 끝날 때까지 사람 손 없이) — 항목별 "실행"은 티켓 하나만 보내고 이어가지 않는다. 실패한 티켓은 사유를 보여주고 그 후행은 영원히 요청되지 않는다. 오케스트레이션은 `store/ticketStore.ts`가 아니라 `ui/ticketRunner.ts`에 있다 — DOM 타입(`fetch`)을 만지는 코드는 `ui/`에만 두는 저장소 규칙(`tsconfig.uitest.json`) 때문이다. **작업공간이 없으면(정적 빌드) 실행 컨트롤 없이 조용히 A안으로 되돌아간다.** Command를 만들지 않으므로(에이전트가 `generated/`에 직접 쓴다) G1·G2·G3는 타지 않고, 결과 검증은 여전히 `export/verifyGenerated.ts`(#157)의 몫이다 |
| localhost GUI · Canvas | **부분** | 캔버스가 스토어의 스펙을 실제로 그리고 클릭으로 노드를 선택할 수 있으며, 세부설정 패널 편집이 즉시 반영되고, Ctrl+휠 줌·휠 팬이 동작한다(`src/features/editor/ui/Canvas.tsx`, `ui/canvasLayout.ts`, `ui/PropertiesPanel.tsx`, `store/editorStore.ts`). File 메뉴로 **새 문서·열기·저장(JSON 파일 다운로드)도 된다**(`ui/MenuBar.tsx`, `ui/openSpecFromFile.ts`, `ui/exportSpecAsJson.ts` — 이슈 #41이 지적한 것 중 New·Open·Save·Save as가 해소됐다). **Import 도 된다** — 이미지를 골라 선택된 프레임(없으면 root)의 자식으로 `image` 노드를 삽입한다(`ui/importImageFromFile.ts`, 2026-09-01 PR #69). 이로써 **File 메뉴에 미구현 항목이 없다.** **레이어 트리와 도구 모음도 스토어에 연결됐다** — 트리가 활성 페이지의 실제 노드 트리를 그리고(이슈 #43 해소), frame·text 도구로 캔버스를 클릭하면 노드가 실제로 만들어진다(이슈 #44 해소). 아래 표의 `ui/LayerTree.tsx`·`ui/Toolbar.tsx` 행 참고. **리사이즈는 된다**(핸들 드래그, 2026-09-09 PR #99) — **캔버스에서 노드를 끌어 순서·부모를 바꾸는 것도 된다**(2026-10-04, 이슈 #187). 스키마가 Auto Layout 전용이라 x/y 좌표는 여전히 없으므로 좌표가 아니라 "어느 프레임의 몇 번째 자리인가"를 바꾼다 — 판정은 `ui/canvasDrop.ts`, 배선은 `ui/useNodeDrag.ts` 이고, 놓으면 `moveNode` 한 번이라 Undo 도 한 단계다. 레이어 트리 드래그(이슈 #123)와 같은 Command를 쓴다. 조작법은 [10-shortcuts.md](10-shortcuts.md) "옮기기(끌기)" 절. **지속성은 이제 있다**(2026-09-15, 이슈 #128) — spec이 바뀔 때마다 디바운스해서 `localStorage`에 자동저장하고, 앱을 열 때 저장된 값이 있으면(검증 통과 시) 그걸로 시작한다(`store/specStorage.ts`). **지금 연 파일 이름도 같이 살아남는다**(2026-09-29, 이슈 #185) — `store/specStorage.ts`가 spec 내용과 `documentStore.fileName`을 `{ fileName, spec }` 한 값으로 묶어 저장하므로, `customer-copy.json`을 열고 새로고침한 뒤 Save해도 `Dashboard.json` 같은 엉뚱한 파일이 새로 생기지 않는다(PR #145가 고쳤던 문제가 새로고침 경로로 재발했던 것을 다시 고쳤다). `.visual-spec/` 파일시스템 워크스페이스로의 완전한 이전은 아직 아니다 — 그건 이슈 #128 범위 밖으로 남겼다. 아래 표 참고 |
| Export · 검증 | **부분(2026-09-27, 이슈 #157)** | [02-mvp-scope.md](02-mvp-scope.md)가 정의한 Export("생성된 React 코드를 결과 폴더로 내보내기")가 **File ▸ Export Code** 로 생겼다(`ui/ExportPanel.tsx` · `ui/exportGeneratedCode.ts` · `store/exportStore.ts` · 순수 판단은 `export/` 네 파일). `.visual-spec/generated/` 를 재귀로 훑어(`GET /__vs/list/generated?recursive=1`) 검증하고 `pages/`·`components/`·`assets/`·`package.json`·`README.md` 를 **ZIP 하나로 브라우저 다운로드**한다. **결과 폴더는 작업공간 밖에 직접 쓰지 않는다** — PR #145 가 세운 "작업공간 밖으로 한 발짝도 못 나간다"를 되돌리지 않으려고 다운로드를 골랐다(02 의 MVP 제외 범위가 이미 "Export 폴더를 사용자가 직접 통합한다"고 못박아 둔 것과 맞는다). **검증이 보는 것** — 티켓별 파일 유무 · `@/` 등 별칭·절대 경로 import 금지 · 상대 경로 import 가 실제 파일을 가리키는지 · 결과 폴더 밖으로 나가는 상대 경로 · `../assets/…` 이미지 존재. **안 보는 것** — 타입 검사·lint·렌더 비교(대상 프로젝트 설정이 필요하거나 MVP 제외 범위다). import 는 파서가 아니라 정규식으로 훑는다(`export/importScan.ts` 상단에 한계를 적어 뒀다). **"안 본다"가 "실제로는 안 된다"는 뜻이 아님을 1회 수동으로 증명했다**(2026-10-02, 이슈 #188) — `dashboard-cards.json`을 내보내 빈 Vite+React+TS+Tailwind v4 프로젝트에 넣고 `tsc -b --noEmit`·실제 렌더까지 직접 확인했다. 자세한 절차·발견 사항은 아래 "확인 방법" 2026-10-02 행 참고. **코드 생성 자체는 여전히 외부 에이전트의 몫이다**(#156 의 A안) — 이 단위는 거기 놓인 것을 읽고 내보낸다. 기존의 File ▸ Export·Save·Save as 와 패널 하단 `ui/properties/ExportJsonButton.tsx` 는 그대로 **스펙 JSON** 경로다(`store/exportSpec.ts` 의 `buildExportPayload`) — 이름만 같고 다른 기능이다 |

### GUI 각 영역의 실제 동작

| 파일 | 지금 하는 일 | 스토어 연결 |
|---|---|---|
| `src/app/App.tsx` | `ThemeProvider` 안에서 `navigationStore` 의 `screen` 값으로 **`HomeScreen`(`"home"`) 과 `EditorLayout`(`"editor"`) 을 갈라 렌더**한다(PR #77). 시작 화면은 홈이다 | `navigationStore.screen` |
| `src/features/editor/ui/HomeScreen.tsx` 와 `ui/homePreview.ts` | 홈(진입) 화면. 프로젝트 카드 목록 · 카드마다 **스펙에서 즉석 렌더한 미리보기**(캡처 이미지를 저장하지 않는다) · 이름 · `페이지 N개 · 가로×세로` · 상단 "+ 새 화면"(`blankSpec` 로드 후 에디터로 이동). 카드를 누르면 에디터로 간다. **목록은 화면이 아니라 프로젝트를 나열한다**(v0.2 — 파일 1개 = 프로젝트 1개). 미리보기는 `ui/homePreview.ts` 의 순수 함수 `previewFrameStyle`·`previewTextStyle`·`previewImageStyle`·`previewButtonStyle`·`previewInputStyle`·`previewScale` 이 만든다 — `Canvas.tsx` 가 스스로 "임시 스탠드인"이라 export 를 두지 않아 일부러 따로 다시 만든 코드였다 — **그 근거는 2026-09-19(이슈 #148)로 절반이 무너졌다.** 스타일 함수들이 `ui/nodeStyles.ts` 로 빠지면서 export 되는 순수 함수가 됐고, `previewDisplayStyle` 은 `nodeStyles.displayStyle` 과 글자 하나까지 같다. 합칠지는 `Canvas.tsx` 가 정식 구현으로 교체될 때 함께 판단한다(homePreview.ts 파일 상단 주석). **04 §2 의 상태 1·상태 2를 이제 둘 다 구현한다**(2026-09-29, 이슈 #186) — 마운트 시 `listWorkspaceFiles(SPEC_DIR)` + 파일마다 `readWorkspaceTextFile`·`parseSpecJson`(+v0.1이면 `migrateV01`)로 `.visual-spec/specs/`를 읽어 0개면 상태 2(세 갈래 선택지), 1개 이상이면 상태 1(카드 목록)이다. 파싱에 실패한 파일은 목록에서 조용히 뺀다. 카드를 클릭하면 이미 읽어 둔 spec을 `loadSpec`에 넘기고 `documentStore.setFileName`으로 그 파일을 "지금 연 파일"로 기억시킨다(이슈 #185와 맞물린다 — Save가 그 파일에 그대로 쓰려면 필요하다). **워크스페이스가 없으면**(정적 빌드) `listWorkspaceFiles`가 `null`을 줘 예전처럼 메모리 spec 한 장짜리 상태 1로 되돌아간다 | `editorStore.spec`·`loadSpec` · `documentStore.setFileName` · `navigationStore.openEditor` · `ui/openSpecFromFile.openSpec`("기존 화면 불러오기") (`test/home-preview.test.ts` 5케이스 — 순수 스타일 함수만 대상이라 이번 배선 변경은 해당 없음. React 컴포넌트 자체는 이 저장소에 훅 테스트 도구가 없어 수동 검증했다) |
| `src/features/editor/store/navigationStore.ts` | 홈 ↔ 에디터 전환만 담는 스토어(`screen`·`openEditor`·`openHome`). **라우터 라이브러리를 쓰지 않는다** — 화면이 둘뿐이고 URL 을 공유할 필요가 없는 로컬 앱이라는 판단이다(파일 주석). 에디터에서 홈으로 나가는 길은 `ui/MenuBar.tsx` 의 로고·브랜드명 클릭이다(#72) | — (`test/navigation-store.test.ts` 3케이스) |
| `src/features/editor/ui/EditorLayout.tsx` | 5개 영역 CSS Grid 배치. 패널 토글 시 좌우 컬럼을 접는다. **셸에 `overflow-hidden`** — `transform` 은 레이아웃 박스를 바꾸지 않지만 문서의 스크롤 영역은 넓혀서, 하단 도구 모음이 숨을 때 앱 전체가 스크롤 가능해졌다(2026-09-15·이슈 #86). **브라우저 기본 우클릭 메뉴를 셸에서 막는다**(2026-09-15·이슈 #138 — "뒤로/새로고침/페이지 소스 보기"는 편집기 안에서 할 일이 없고, 나중에 캔버스에 커스텀 메뉴를 붙이면 둘이 겹친다. 판정은 `ui/canvasInput.ts` 의 `shouldSuppressContextMenu` 가 하고 **입력란만 예외다** — 거기서는 복사·붙여넣기·모두 선택·맞춤법 검사가 브라우저 메뉴에만 있어서, 막으면 텍스트 편집이 망가진다. `isTypingTarget` 의 반대라 키 입력과 경계가 같다. `window` 리스너가 아니라 셸의 `onContextMenu` 인 이유는 막히는 범위가 코드에서 보여야 후속 커스텀 메뉴 작업에서 읽히기 때문이다. 우클릭 "검사"는 막히지만 F12·Ctrl+Shift+I 는 그대로다. **커스텀 메뉴 UI 는 아직 없다** — 막기만 한다) | `viewStore.showPanels` (`test/canvas-input.test.ts` 의 `shouldSuppressContextMenu` 4케이스) |
| `src/features/editor/ui/MenuBar.tsx` (View 메뉴) | 줌 In/Out · Fit to Screen · 격자 표시 · 패널 표시가 **동작한다** | `viewStore` |
| `src/features/editor/ui/MenuBar.tsx` (File 메뉴) | New(`blankSpec` 로드) · Open(파일 선택 → 검증 → 로드) · Save · Save as · Export(스펙 JSON 다운로드) · **Import(이미지 선택 → 삽입)**가 전부 **동작한다**. **`noop()` 은 0개다** — 2026-09-01(PR #69)에 Import 가 연결되면서 File 메뉴에 미구현 항목이 없어졌다(`git grep "noop" src/features/editor/ui/MenuBar.tsx` 히트 0건) | `editorStore.loadSpec` · `editorStore.insertNode` · `useEditorStore.getState().spec` |
| `src/features/editor/ui/Canvas.tsx` | 스펙 트리를 flex/grid 로 렌더(박스·레이아웃·배경·테두리·타이포그래피·그림자·불투명도·블러), 클릭 시 노드 선택, 줌 배율·격자 표시. **테두리·그림자는 `canvasLayout.strokeAndShadowStyle` 이 `box-shadow` 한 문자열로 합성하고, 불투명도·블러는 `effectStyle` 이 낸다**(2026-09-04·이슈 #78 — `frame` 은 둘 다, `text`·`image` 는 `effectStyle` 만, `button`·`input` 은 `Border` 를 공유하므로 테두리 정렬만). **`image` 노드는 빈 `div` 의 `background-image` 로 그린다**(`imageStyle()` — `fit` 의 `cover`/`contain` 은 `background-size` 로 그대로 넘기고 `fill` 만 `100% 100%` 로 옮긴다. `background-position: center`, 반복 없음. 자식을 받지 않는다). **`button`/`input` 노드는 각각 `<div>` 로 그린다**(`buttonStyle()`/`inputStyle()`, 2026-09-02·이슈 #75 — `content`/`placeholder` 텍스트를 보여주기만 하고 실제 클릭·입력 동작은 없다). **`layout.direction: "grid"` 는 `display: grid` + `layout.columns` 만큼의 `gridTemplateColumns` 로 그린다**(`displayStyle()`, 같은 PR — 균등 자동 배치뿐, 셀 지정 없음. `mainAxis`/`crossAxis` 무시). **아트보드를 `spec.screen.size` 로 고정**하고 좌상단 기준 `transform: scale` 로 확대한다 — 자식이 커져도 아트보드는 그대로고 넘치는 만큼 밖으로 삐져나온다. 아트보드를 감싼 바깥 박스에 `size × 배율` 크기를 줘 **스크롤 범위를 확대율과 맞춘다**(`transform` 은 레이아웃 박스를 바꾸지 않아, 이 박스가 없으면 25%인데도 100% 크기의 빈 공간이 남는다). 아트보드 위에 화면 이름을 띄운다. `ResizeObserver` 로 **뷰포트 실측 크기**를, `spec.screen.size` 변화로 **아트보드 크기**를 `viewStore` 에 올리고, 뷰포트를 처음 받은 시점과 페이지를 바꿀 때 `fitToScreen()` 을 부른다(처음 열었을 때 아트보드 전체가 보이게). 스크롤바 등장/소멸이 `clientWidth` 를 흔들어 배율이 진동하지 않도록 `scrollbar-gutter: stable` 로 스크롤바 자리를 고정한다. 선택 노드가 실제로 그려진 px 도 재서 `measureStore` 에 올린다. **선택 표시는 노드가 아니라 아트보드 옆 오버레이에 그린다**(2026-09-08·이슈 #90 — 노드에 인라인 `outline` 으로 얹으면 그 노드의 `opacity`·`blur` 를 선택 표시까지 함께 받아 흐려진다. 오버레이는 확대되지 않는 바깥 상자에 있어 좌표를 실측 그대로 쓰고 테두리도 확대율과 무관하게 2px 이다. `pointer-events-none` 이라 클릭은 아래 노드로 내려간다. 다시 재는 시점은 매 렌더 + 아트보드 하위 `style`·자식·**글자** 변화(`MutationObserver`) + 대상 크기 변화(`ResizeObserver`) 셋이고(`characterData` 를 함께 보는 이유는 React 가 문자열 자식 하나짜리 엘리먼트를 고칠 때 `firstChild.nodeValue` 에 직접 대입해 `childList` 로는 안 잡히기 때문이다 — 형제 텍스트가 길어지며 선택 노드를 밀어내는 경우가 그렇다), 스크롤·팬은 대상과 기준을 같은 순간에 재 오프셋이 상쇄되므로 듣지 않는다. **모서리 반경은 일부러 따라가지 않는다** — 얹을 수는 있지만(`outline` 은 요소의 `border-radius` 를 따라 그려진다) 선택 표시는 노드가 차지한 영역을 알려주는 편집기 UI라 직사각형 바운딩 박스로 둔다. Figma 도 반경과 무관하게 직사각형이다). **Ctrl+휠 줌**을 `{ passive: false }` 리스너로 가로채고, 일반 휠 팬은 `overflow-auto` 네이티브 스크롤에 맡긴다. **클릭·팬 동작은 활성 도구(`toolStore`)에 따라 갈린다** — `select` 는 선택, `frame`·`text` 는 노드 생성, `hand` 는 팬이다(위 `ui/Toolbar.tsx` 행에 자세히 적었다. 도구 값은 구독하지 않고 `getState()` 로 읽는다 — 재귀 렌더 트리에 핸들러를 내려보내거나 도구가 바뀔 때마다 트리를 다시 그리지 않기 위해서다) | `editorStore` · `viewStore` · `measureStore` · `toolStore` **줌은 커서를 기준으로 한다**(2026-09-16 — 확대 직전 커서 밑 지점을 바깥 박스 안의 **비율**로 적어 두고(`readZoomAnchor`), 새 배율로 그려진 뒤 다시 재서 그 점이 같은 화면 위치에 오도록 스크롤을 더한다(`useZoomAnchor`, `useLayoutEffect`). 식으로 풀지 않고 다시 재는 이유는 아트보드가 `mx-auto` 라 배율이 바뀌면 좌우 여백까지 함께 변하고, 패널 접기·스크롤바 등장 같은 변수가 더 있기 때문이다. 이게 없으면 확대할 때마다 보던 곳이 화면 밖으로 밀려난다). **가운데 버튼 드래그는 도구와 무관하게 언제나 팬이다**(브라우저 자동 스크롤은 `preventDefault` 로 막는다). **보기 단축키** — `Ctrl/Cmd +`·`-`·`0`(100%)·`Shift 1`(화면 맞춤)·`Esc`(선택 해제). 판정은 `canvasInput.viewCommandForKey` 가 하고, `Ctrl+0`·`Ctrl+-` 는 브라우저 페이지 줌이기도 해서 반드시 `preventDefault` 를 건다. 단축키 줌의 기준점은 **뷰포트 한가운데**다(커서 위치라는 개념이 없다). **커서를 올리면 잡힐 노드를 미리 강조한다**(`useHoverRect` — 무엇을 강조할지는 `resolveClickTarget` 을 그대로 불러 정한다. 강조된 것과 실제 선택되는 것이 다르면 표시가 거짓말이 되므로 규칙을 두 벌 두지 않는다. 그래서 Ctrl/Cmd 를 누른 채 올리면 강조도 안쪽 노드로 내려간다. 선택 표시는 2px 실선, 미리보기는 1px 이고 이미 선택된 노드에는 그리지 않는다. 손 도구일 때는 클릭해도 선택이 안 바뀌므로 미리보기도 안 띄운다). **선택한 프레임의 자식 사이 틈을 표시한다**(`ui/gapStrips.ts` — 자식을 세로로 겹치는지로 **줄(band)** 에 묶고 나면 row·column·grid 가 한 알고리즘이 된다. 줄 안은 세로 띠, 줄 사이는 가로 띠다. `top` 이 같은지로 묶으면 교차축 `center`/`end` 정렬에서 같은 줄 형제가 딴 줄로 갈린다. 숫자는 스펙의 `layout.gap` 이 아니라 **실측 거리를 배율로 나눈 값**이다 — `space-between` 이면 실제 간격이 `gap` 보다 크다. 띠 전체를 칠하지 않고 가운데 얇은 막대만 긋고, 배지는 막대 **바로 위**에 띄운다(가운데 두면 좁은 틈에서 글자를 가린다). 자식마다 한가운데 점도 찍는다. 띠에 `pointer-events` 를 주지 않고 `stripAtPoint` 가 좌표로 판정한다 — 오버레이가 마우스를 받으면 틈을 클릭했을 때 아래 프레임이 선택되지 않는다). **클릭·팬 동작은 활성 도구(`toolStore`)에 따라 갈린다** — `select` 는 선택, `frame`·`text` 는 노드 생성, `hand` 는 팬이다(위 `ui/Toolbar.tsx` 행에 자세히 적었다. 도구 값은 구독하지 않고 `getState()` 로 읽는다 — 재귀 렌더 트리에 핸들러를 내려보내거나 도구가 바뀔 때마다 트리를 다시 그리지 않기 위해서다) | `editorStore` · `viewStore` · `measureStore` · `toolStore` **2026-09-19·이슈 #148 로 네 모듈로 갈랐다** — `ui/canvasOverlays.ts`(재서 좌표를 내는 훅 다섯: `useSelectionRect`·`useGapStrips`·`useHoverTarget`·`useRectOf`·`useArtboardHeight`. 묶은 기준은 "오버레이가 그릴 값을 낸다" 하나다 — **다시 재는 신호는 셋만 같다**(`useSelectionRect`·`useGapStrips`·`useRectOf`). `useArtboardHeight` 는 ResizeObserver 만 보고, `useHoverTarget` 은 아무것도 안 재고 mousemove 로 노드 id 만 고른다(재는 것은 그 id 를 받은 `useRectOf` 다). 파일 머리에 표로 적어 두었다) · `ui/canvasZoom.ts`(`ZoomAnchor`·`readZoomAnchor`·`useZoomAnchor`·`useAltHeld` — 스크롤을 만지거나 누르고 있는 동안을 추적하는 쪽) · `ui/canvasKeys.ts`(`useCanvasKeys`·`runViewCommand` — 리스너 배선과 동작. 받을지 말지는 `canvasInput.ts` 가 정한다) · `ui/nodeStyles.ts`(노드 타입별 CSS 조립. `canvasLayout.ts` 와의 경계는 **무엇을 아는가**다 — 저쪽은 `Box` 하나를 옮기는 순수 계산이라 노드 타입을 모르고 test/ 에서 직접 테스트한다). **동작은 바뀌지 않은 순수 이동이다.** 남은 `Canvas.tsx` 는 873줄로 소프트 상한(800)을 조금 넘는데, 나머지가 `Canvas()` 컴포넌트(477줄)와 리사이즈·클릭 배선이라 더 쪼개면 렌더 트리가 흩어진다 — 이 파일 자체가 정식 캔버스로 교체될 "임시 스탠드인"이라 그 작업과 함께 다시 본다). **2026-10-04·이슈 #187 로 이웃이 둘 늘었다** — `ui/useNodeDrag.ts`(노드 끌기의 리스너 배선과 동작. 끌기 시작 여부는 `canvasInput.canStartNodeDrag`·`hasPassedDragThreshold`, 끌 대상은 `selection.resolveDragTarget` 이 정한다) · `ui/canvasDrop.ts`(커서 좌표·노드 사각형·트리로 놓을 자리와 인디케이터를 내는 순수 판정기). 노드 사각형은 `canvasOverlays.measureNodeRects` 가 같은 바깥 상자 기준으로 잰다. `Canvas.tsx` 는 이 작업 뒤 **1019줄**이다(2026-10-04 `wc -l` 실측 — 위 873줄은 #148 당시 값) |
| `src/features/editor/ui/canvasLayout.ts` | `Canvas.tsx` 에서 분리한 순수 함수 `sizeToCss` · `boxStyle` · `radiusCss` · `strokeAndShadowStyle` · `effectStyle`. Figma 의 Fixed/Hug/Fill 을 flex 로 옮긴다 — 주축 `fill` → `flex: 1 1 0` + `min-*: 0`(형제끼리 공간 균등 분배), 교차축 `fill` → `align-self: stretch`, 부모가 없는 최상위 노드만 `100%`. **`parentDirection === "grid"` 도 최상위 노드와 동일하게 취급한다**(2026-09-02, 이슈 #75 — flex-grow/shrink 기반 배분이 grid 아이템에는 뜻이 없어서다). **`strokeAndShadowStyle` 은 테두리 정렬과 그림자를 한 `box-shadow` 로 합친다**(2026-09-04·이슈 #78 — 둘이 같은 CSS 속성 한 칸을 두고 다투기 때문이다. 테두리 고리를 앞에 적어 그림자에 묻히지 않게 한다). 정렬을 `outline` 으로 그리지 않는다 — 브라우저 포커스 링과 겹치고, `box-shadow` 로 그리면 그림자와 한 문자열에 합칠 수 있다(2026-09-04 시점의 이유는 "선택 표시가 `outline` 을 이미 쓰고 있어서"였는데, 2026-09-08·이슈 #90 으로 선택 표시가 오버레이로 빠지면서 그 이유는 사라졌다). `inside` 만 CSS `border` 속성을 유지한다(`box-shadow` 는 레이아웃 박스를 차지하지 않는데 기존 문서가 전부 `inside` 라 갈아타면 안쪽 여백이 달라진다). `radiusCss` 는 모서리별 반경을 CSS 순서(좌상 → 우상 → 우하 → 좌하)로 옮긴다 | 없음 (순수 함수 — `test/canvas-layout.test.ts` 40케이스) |
| `src/features/editor/ui/selectionRect.ts` | 선택 표시 오버레이가 쓸 사각형 계산(2026-09-08·이슈 #90). `relativeRect` 는 뷰포트 좌표 둘을 상대 좌표로 바꾼다 — 같은 순간에 잰 두 값이라 스크롤 오프셋이 상쇄되고, 그래서 캔버스 스크롤·팬 중에는 다시 재지 않아도 표시가 제자리에 남는다. 대상이 `transform: scale` 안에 있어 값이 이미 확대돼 있는데, 오버레이를 확대되지 않는 바깥 상자에 두므로 나눠 되돌리지 않는다. `sameRect` 는 값이 그대로일 때 상태를 바꾸지 않게 한다(측정을 렌더마다 하므로 이 비교가 없으면 측정 → setState → 렌더 → 측정이 끝나지 않는다). `nodeSelector` 는 노드 id 를 `[data-node-id="…"]` 로 감싸며 따옴표·역슬래시를 이스케이프한다(가져온 스펙의 id 는 무엇이든 될 수 있다). `DOMRect` 를 참조하지 않고 네 값을 구조로만 정의한다 — `test/` 를 포함하는 `tsconfig.node` 의 `lib` 에 DOM 이 없다 | 없음 (순수 함수 — `test/selection-rect.test.ts` 12케이스) |
| `src/features/editor/ui/PropertiesPanel.tsx` 와 `ui/properties/`(파일 **31개**, 2026-09-18 실측 — `fields/editBurst.ts` 가 이슈 #132 로 늘었다) | 선택 노드의 이름·표시·박스·레이아웃·배경·테두리·타이포그래피·효과(그림자·불투명도·블러)를 편집. **노드 말고 페이지 자체도 편집한다** — `properties/PageProperties.tsx` 가 **페이지 이름과 해상도(가로·세로 px)** 를 `editorStore.setPageField` 로 고친다(패널에서 `setNodeField` 가 아닌 경로는 이 섹션뿐이다). 이 섹션은 **root 를 골랐거나 아무것도 고르지 않았을 때** 패널 맨 위에 얹힌다(파일 주석 — 페이지 행이 곧 그 페이지의 root 프레임이고, 빈 안내문만 띄우느니 화면 크기를 바꿀 자리를 두는 편이 낫다는 판단이다). 해상도는 `properties/resolutionPresets.ts` 의 프리셋 14종(FHD·MacBook Pro 14·iPad·iPhone·Android 등 — 가로형은 숫자가 곧 이름이라 그대로 두고 세로형에만 기기 이름을 붙였다)에서 고르거나 px 를 직접 넣는다. 지금 크기와 맞는 프리셋이 없으면 `findPresetId` 가 `custom`("직접 입력")을 돌려준다. **프리셋을 고르면 아트보드가 실제로 커지고 작아지므로 `viewStore.setContent` + `fitToScreen()` 으로 확대율을 그 자리에서 다시 맞춘다**(캔버스가 올려 주기를 기다리면 한 프레임 늦어 직전 크기로 맞춰진다). 직접 입력 중에는 다시 맞추지 않는다 — 한 글자마다 줌이 튀면 쓰기 어렵다. **노드 타입 다섯이 전부 편집된다**(2026-09-11·이슈 #92 — 그전에는 `frame`·`text` 만 되고 `image`·`button`·`input` 은 "이 노드 타입의 속성 편집은 아직 지원하지 않습니다." 안내 한 줄만 떴다). 타입별 분기는 `PropertiesPanel` 에 없다 — **`properties/nodeSections.ts` 의 표가 타입별 섹션 목록을 정하고 `properties/NodeSectionList.tsx` 가 그대로 늘어놓는다.** 섹션을 노드 타입에 묶인 통짜 컴포넌트(`FrameProperties`·`TextProperties`, 이번에 삭제)로 두면 새 타입마다 섹션을 복사하거나 포기하게 되는데 실제로 네 번 반복됐다(#67·#69·#83·#88). 표 기준은 `frame` = Layout·Size·Background·Border·Effects / `text` = Content·Size·Font·Color·Effects / `image` = Content(`src`·`fit`)·Size·Effects / `button`·`input` = Content·Size·Font·Color·Background·Border 다. **`button`·`input` 에 Effects 가 없는 것은 빠뜨린 게 아니라 스키마에 `opacity`·`blur` 가 없어서다**(그 이유가 "패널이 없어서"였으므로 이제 넓힐 수 있지만 동결 규칙을 타야 해서 별도 작업이다). **image 의 `src` 는 값에 따라 다르게 띄운다**(`properties/imageSrc.ts` 의 `describeImageSrc`) — assets 상대 경로면 편집칸을, Import 가 넣은 base64 data URI 면 편집칸 대신 요약(미디어 타입 + 크기)만 보여준다. 수백 KB짜리 한 줄을 입력칸에 띄우면 칸이 먹통이 되고 손으로 고칠 수 있는 값도 아니기 때문이다. 컨트롤은 `properties/fields/Field.tsx`(라벨·2열 행·인풋 스타일)와 `properties/fields/useDraftInput.ts`(타이핑 중에는 draft, 파싱에 성공하면 즉시 커밋)를 공유하고, 다섯 타입 공통 Size 섹션은 `properties/SizeSection.tsx` 다. **연속 타이핑을 undo 한 단계로 묶는 burst 추적기는 `properties/fields/editBurst.ts` 로 따로 나와 있다**(2026-09-18·이슈 #132 — `createEditBurst()` 는 React 를 모르는 순수 구현이고 `useEditBurst()` 가 그걸 컴포넌트 수명 동안 `ref` 로 붙들어 둔다. 이 저장소에는 훅 테스트 도구가 없어(`vitest` environment 가 node 다) 순수 쪽만 `test/edit-burst.test.ts` 11케이스로 덮는다). `useDraftInput` 과 `TextField` 가 같은 추적기를 쓴다 — **`TextField` 는 `useDraftInput` 을 안 쓰고 burst 만 쓴다**(문자열은 파싱할 것이 없어 draft 가 할 일이 없고, draft 를 두면 한글 IME 조합 중에 값의 출처가 바뀌며 커서·조합 글자가 흔들릴 여지가 생긴다 — 파일 주석). **`TextField` 에는 "값이 그대로면 아예 커밋하지 않는" 가드가 있고 `useDraftInput` 계열에는 없다**([EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) 의 남은 결함 참고). **공용 컨트롤은 `properties/fields/index.ts` 한 곳에서만 가져온다** — `Field`/`FieldLabel`/`FieldRow` · `NumberField` · `TextField` · `SelectField` · `SegmentedControl` · `ColorField` · `SizeField` · `ToggleField`. 이번에 새로 확인한 네 가지가 쓰이는 자리는 — `TextField`(페이지 이름 · 텍스트 내용), `SelectField`(해상도 프리셋 · 글꼴 종류 · 굵기), `SegmentedControl`(레이아웃 방향 · 주축/교차축 정렬 · 테두리 정렬 · 모서리 `전체`/`개별` · 텍스트 정렬 — Layout 3곳 · Border 2곳 · Typography 1곳 · Content(image `fit`) 1곳), `ToggleField`(패널 머리의 표시 여부 · 효과 섹션의 그림자 토글)다. **Size 섹션의 px 칸은 Fixed 면 스펙값을, Hug/Fill 이면 `measureStore` 의 실측 px 를 보여준다**(`properties/fields/SizeField.tsx`) — 실측값을 아직 못 받았을 때만 `Hug`/`Fill` 을 placeholder 로 흐리게 띄우고, 모드를 Fixed 로 바꾸면 그 실측 px 를 그대로 이어받는다(못 받았으면 100). **스키마 값 `"auto"` 를 UI 는 Figma 용어인 `Hug` 로 부른다.** 숫자 칸(`type="number"`)은 **휠이 닿으면 포커스를 떼** 스크롤하다 값이 조용히 증감되는 일을 막는다(`properties/fields/Field.tsx` 의 `blurOnWheel` — `SizeField`·`NumberField`·`ColorField` 가 쓴다. 패널 자체가 `overflow-auto` 라 `preventDefault` 대신 `blur` 를 쓴다). `border` 는 스키마상 세 필드가 모두 필수라 한 칸만 고쳐도 `properties/borderPatch.ts` 가 완전한 객체를 만들어 통째로 쓴다. **그 결과가 아무것도 그리지 않으면 필드를 지운다**(`borderPatch.isBlankBorder`, 2026-09-08·이슈 #89 — 효과 필드가 항등값에서 필드를 지우는 것과 기준을 맞춘 것이다. 그전에는 테두리 없는 노드에서 모서리 토글만 눌러도 `{ width: 0, color: "#000000", radius: 0 }` 이 스펙에 남았다). **판정에 두께와 반경을 함께 본다** — 두께 0 이어도 반경은 배경·그림자의 모서리를 깎으므로, 두께로만 판정하면 `examples/card-effects.json` 의 elevatedCard(`{ width: 0, color: "#00000000", radius: 12 }`) 같은 문서의 모양이 깨진다. **`shadow`·모서리별 `radius` 도 같은 이유로 `properties/shadowPatch.ts`·`properties/radiusPatch.ts` 가 같은 일을 한다**(2026-09-04·이슈 #78). 효과 섹션은 `properties/EffectsSection.tsx` 로 `frame`·`text`·`image` 가 공유하고(그림자는 `frame` 만 — `button`·`input` 은 스키마에 `opacity`·`blur` 가 없어 이 섹션 자체가 없다), **불투명도는 스키마 0..1 을 칸에서는 % 로 보여준다** — 항등값(불투명도 100%, 블러 0, 그림자 토글 끄기)으로 되돌리면 필드를 지운다(`properties/effectPatch.ts`. 아무 효과도 없는 값이 남으면 export 된 JSON 을 읽는 쪽이 의미 있는 지정으로 오해한다). 테두리 정렬은 `안쪽`/`가운데`/`바깥`, 모서리 반경은 `전체`/`개별` 토글로 고른다. **모서리 모드만은 스펙에서 파생하지 않고 `properties/BorderSection.tsx` 의 화면 상태로 둔다**(2026-09-08·이슈 #89 — 빈 테두리를 지우게 되면서 파생이 성립하지 않는다. 테두리 없는 노드에서 `개별` 을 눌러도 스펙에 남는 값이 없어 모드가 곧바로 `전체` 로 되돌아오고 값을 넣을 네 칸이 뜨지 않는다. 다른 노드로 옮길 때 이 상태가 따라오지 않도록 `PropertiesPanel` 이 `key={selectedId}` 로 다시 마운트시킨다) | `properties/useNodeField.ts` 훅을 거쳐 `editorStore.setNodeField`(훅 호출 지점 28개 — 아래 표 밑 문단 참고). **Page 섹션만 `editorStore.setPageField` 를 직접 부르고(4칸) `viewStore` 도 함께 건드린다.** Size 섹션은 `measureStore` 를 읽기만 한다 **그리드 레이아웃을 GUI 로 만들 수 있다**(2026-09-16 — 방향에 `그리드`가 붙고, 고르면 `열 개수` 칸이 나타난다. 스키마와 렌더(`Canvas.displayStyle`)에는 원래 있었는데 패널에 입력 수단만 없어서 JSON 을 손으로 고쳐 가져오는 것 말고는 만들 방법이 없었다. **방향 전환은 `layout` 전체를 한 번에 쓴다** — `properties/layoutPatch.ts` 의 `layoutWithDirection` 이 `direction` 과 `columns` 를 함께 계산한다. 따로 쓰면 Undo 가 두 단계로 쌓여 한 동작을 되돌리는 데 Ctrl+Z 를 두 번 눌러야 한다. 그리드로 갈 때 `columns` 가 없으면 **2** 를 채우고(1 열 그리드는 세로와 결과가 같아 안 바뀐 것처럼 보인다), 그리드를 벗어나면 `columns` 를 **지운다**(row/column 에서는 뜻이 없는 값이라 남으면 export 된 JSON 을 읽는 쪽이 오해한다 — `effectPatch` 와 같은 규칙). **그리드일 때 주축·교차축 정렬 칸은 감춘다** — `displayStyle` 이 둘을 무시하므로, 띄워 두면 눌러 보고 고장으로 판단한다. 균등 자동 배치가 전부이고 셀 지정·여러 칸 차지는 스키마를 건드려야 해서 없다) | `properties/useNodeField.ts` 훅을 거쳐 `editorStore.setNodeField`(훅 호출 지점 28개 — 아래 표 밑 문단 참고). `properties/layoutPatch.ts` 는 순수 함수다(`test/layout-patch.test.ts` 10케이스). **Page 섹션만 `editorStore.setPageField` 를 직접 부르고(4칸) `viewStore` 도 함께 건드린다.** Size 섹션은 `measureStore` 를 읽기만 한다 · `properties/layoutPatch.ts` 는 순수 함수다(`test/layout-patch.test.ts` 12케이스) |
| `src/features/editor/ui/LayerTree.tsx` | **활성 페이지의 실제 노드 트리**를 `root` 부터 재귀로 그린다(PR #84 — 하드코딩 목록이던 `LAYERS` 상수는 사라졌다. `git grep "LAYERS" src/` 히트 **0건**, 이슈 #43 닫힘). 줄마다 **타입 아이콘**(`TYPE_ICON` 이 `frame`·`text`·`image`·`button`·`input` 5종을 다룬다) · 이름 · **표시 토글**(`setNodeField(id, "visible", …)` — `:255`)이 있고, 이름은 그 자리에서 고칠 수 있다(`setNodeField(id, "name", …)` — `:115`. 트리가 `setNodeField` 를 부르는 자리는 이 둘이다, 2026-09-18 실측), 자식이 있는 프레임은 접기/펼치기가 된다(**접힘 상태만 로컬 `useState`** — 스펙에 저장하지 않는 화면 상태라서다). 하단 **"레이어 추가"** 버튼은 `store/resolveImportParent.ts` 로 부모 프레임을 고르고 `store/nodeId.ts` 의 `generateNodeId` 로 id 를 만들어 기본 Frame(`blankFrameNode()` — `auto`×`auto`, 자식 없음)을 넣는다. 하단 오른쪽에 활성 페이지의 노드 개수를 띄운다. **페이지 폴더·페이지 전환 UI 가 이 파일에 있다**(2026-09-18 실측 — 이 서술은 "아직 없다"였으나 낡았다). 트리 위쪽에 페이지가 폴더 아이콘 줄로 늘어서고 줄을 누르면 `selectPage` 로 활성 페이지가 바뀐다(`:339`). 줄에 올리면 뜨는 휴지통이 `window.confirm` 을 거쳐 `removePage` 를 부르고(`:353`), **페이지가 한 장뿐이면 그 버튼 자체가 뜨지 않는다**(`pageOrder.length > 1`). 목록 끝의 **"새 페이지"** 버튼이 `addPage` 다(`:529`). **footer 의 Undo/Redo 버튼도 이 파일에 있다**(#118) — 비활성화 판정은 `command/history.ts` 의 `canUndo(state.history)`/`canRedo(state.history)` 를 그대로 부르는 방식이다(`:401`·`:402`). **`history[activePageId]` 를 보지 않는다** — 스택이 프로젝트 하나뿐이라(2026-09-18·이슈 #131) 페이지를 바꿔도 판정이 그대로다. 같은 파일이 `document` 에 `keydown` 을 걸어 Cmd/Ctrl+Z · Cmd/Ctrl+Shift+Z · Ctrl+Y 도 받고(`:423`~`:429`), `event.target` 이 입력칸이면 가로채지 않는다 | `editorStore` (`spec`·`activePageId`·`selectedId`·`select`·`setNodeField`·`insertNode`·`selectPage`·`removePage`·`addPage`·`undo`·`redo`) |
| `src/features/editor/ui/Toolbar.tsx` 와 `store/toolStore.ts` · `store/createNode.ts` | Select/Frame/Text/Hand 버튼. **활성 도구를 `toolStore` 가 값 하나(`activeTool`)로 들고 있어 항상 하나만 켜진다**(PR #68 — 이슈 #44 닫힘. IR 이 아닌 순수 UI 상태라 `viewStore` 와 같은 층에 두었다). **도구를 고르는 것만 이 파일이 하고 실제 동작은 `ui/Canvas.tsx` 가 이 값을 읽어 수행한다** — `frame`·`text` 도구로 노드나 캔버스 바탕을 클릭하면 `insertNewNode()` 가 `store/createNode.ts` 의 `createNode(kind)`(순수 함수 — Frame 은 200×120 고정 크기, Text 는 `auto`·"텍스트")로 노드를 만들어 `generateNodeId` + `editorStore.insertNode` 로 넣고 **곧바로 도구를 `select` 로 되돌린다**(피그마와 같은 흐름). `hand` 도구는 `mousedown`/`mousemove` 로 캔버스를 팬하고 **선택을 바꾸지 않는다**(클릭 핸들러가 `hand` 면 그대로 빠져나간다). `createNode` 가 다루는 종류는 `frame`·`text` 뿐이다 — Button·Input 은 아직 도구가 없다(파일 주석). **키보드로도 도구를 바꾼다**(2026-09-15·이슈 #136 — `V`/`H`/`F`/`T` 고정 전환 + **스페이스를 누르고 있는 동안만 손 도구**가 되고 떼면 쓰던 도구로 돌아온다. 판정은 `ui/canvasInput.ts` 의 `toolForKey`·`isSpacePanKey` 가 하고, 복귀할 도구는 `toolStore.toolBeforeSpace` 가 들고 있다 — `beginSpacePan`/`endSpacePan` 둘 다 **멱등**이다. 키를 누르고 있으면 `keydown` 이 반복해서 들어오는데 두 번째에 `hand` 가 저장되면 영영 손 도구에 갇히고, `endSpacePan` 은 `keyup` 과 `window` `blur` 양쪽에서 불려 중복 호출이 정상 경로다. `blur` 를 듣는 이유는 스페이스를 누른 채 Alt+Tab 하면 `keyup` 이 오지 않아서다. **`event.key` 가 아니라 `event.code` 로 판정한다** — `key` 는 레이아웃을 타서 한글 상태의 `V` 가 `"ㅍ"` 로 오므로 한/영 전환에 단축키가 죽는다. 스페이스만 타깃 검사가 더 엄격하다: `BUTTON`·`A`·`role="button"` 위에서는 가로채지 않는다 — 스페이스는 그것들의 기본 활성화 키라 가로채면 키보드로 도구를 못 고른다. 스페이스를 누르고 있는 동안 다른 도구 키는 무시한다. 단축키는 버튼의 `aria-label`·`title` 에 `Select (V)` 처럼 노출한다) | `toolStore.activeTool`·`toolBeforeSpace` (`test/tool-store.test.ts` 10케이스 · `test/create-node.test.ts` 4케이스 · `test/canvas-input.test.ts` 의 `toolForKey` 6 + `isSpacePanKey` 5케이스) |
| `src/features/editor/ui/selection.ts` | 캔버스 클릭 지점을 "어떤 노드를 대상으로 삼을지"로 옮기는 순수 해석기. `buildParentMap`(자식 → 부모 역맵) · `resolveClickTarget`(일반 클릭은 root 바로 아래 **최상위 조상**을, Cmd/Ctrl+클릭은 실제로 클릭한 **최하위 노드**를 고른다) · `resolveInsertParent`(클릭한 노드가 프레임이면 그 안에, 아니면 가장 가까운 조상 프레임에 넣는다 — 텍스트는 자식을 가질 수 없어서다) | 없음 (순수 함수 — `test/canvas-selection.test.ts` 12케이스) |
| `src/features/editor/store/editorStore.ts` | **스키마 v0.2 로 넓어졌다** — `EditorState` 가 `spec: ProjectSpec` 과 **`activePageId`** 를 들고, 초기값은 `migrateV01(seedSpec)` 이다. 계약 멤버는 **17개**다([EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) §2의 표 17행과 1:1 대조): `spec` · `activePageId` · `selectedId` · **`history`**(프로젝트 하나짜리 undo 스택) · `select` · `selectPage` · `setNodeField` · **`setNodeFields`**(여러 노드 필드를 Zustand 갱신·Undo 한 단계로 적용, #149) · `setPageField` · `addPage` · `removePage` · `loadSpec` · `insertNode` · `removeNode` · `moveNode` · `undo` · `redo`. `setNodeFields`는 입력 순서대로 `updateNode` Command를 적용하고, 유효하지 않은 patch는 건너뛰며 나머지를 부분 적용한다. 전부 no-op이면 spec 참조와 history를 보존한다. 노드를 다루는 액션은 활성 페이지를 내부에서 찾고, `loadSpec`은 v0.1/v0.2를 모두 받는다. history의 스냅숏은 `{ spec, activePageId }`라 다른 페이지의 변경을 되돌리면 해당 페이지로 함께 이동한다 | — (`test/editor-store.test.ts` **80케이스**, 2026-09-20 실측) |
| `src/features/editor/ui/importImageFromFile.ts` | File > Import 의 본체. `<input type=file accept="image/*">` 로 이미지를 고르고 `FileReader` 로 읽은 뒤 `new Image()` 로 원본 픽셀 크기를 재서 `ImageNode` 를 만들어 삽입한다(`box` 는 이미지 원본 크기, `fit` 은 `"cover"` 고정, `name` 은 확장자를 뗀 파일명). **워크스페이스 assets 저장소가 없어 이미지를 base64 data URI 로 스펙 안에 직접 담는다** — 파일 자체가 스펙에 들어가므로 Export/Save 한 JSON 이 그만큼 커진다(파일 상단 주석이 이 절충을 밝히고 있다). 읽기 실패·이미지 아님은 `window.alert` 로 알린다 | `editorStore.insertNode` · `editorStore.getState().spec`·`selectedId` |
| `src/features/editor/store/resolveImportParent.ts` | Import 한 노드를 붙일 부모를 정하는 순수 함수. **선택 노드가 frame 이면 그 안에, 아니면(선택 없음 · text/image 선택 중) 화면 root 에** 붙인다(root 는 스키마상 항상 frame) | 없음 (순수 함수 — `test/resolve-import-parent.test.ts` 4케이스) |
| `src/features/editor/store/nodeId.ts` | `generateNodeId(prefix, nodes)` — `image-1`, `image-2` … 처럼 비어 있는 순번을 찾아 새 id 를 만드는 순수 함수. `NodeId` 패턴(`^[A-Za-z0-9_-]+$`)을 항상 만족한다 | 없음 (순수 함수 — `test/node-id.test.ts` 4케이스) |
| `src/features/editor/store/exportSpec.ts` · `store/loadSpec.ts` | 스펙을 검증해 내보낼 JSON 을 만들거나(`buildExportPayload`), JSON 문자열을 파싱·검증한다(`parseSpecJson`). DOM 없는 순수 함수 | — |
| `src/features/editor/ui/exportSpecAsJson.ts` · `ui/openSpecFromFile.ts` | 위 순수 함수를 감싸는 파일 입출력 — `Blob`+`<a download>` 다운로드, `<input type=file>`+`FileReader` 읽기 | `editorStore.loadSpec` |
| `src/features/editor/store/blankSpec.ts` | File > New 가 로드하는 빈 스펙(root frame 하나, 자식 없음, 1440×900) | — |
| `src/features/editor/store/seedSpec.ts` | 초기 스펙을 하드코딩(`examples/dashboard-cards.json` 내용) | 앱 시작 시 `editorStore` 의 초기값. 자동 저장·복원은 없다 |
| `src/features/editor/store/viewStore.ts` | 줌(25~400%, 버튼·휠은 25 눈금) · 격자 · 패널 표시 에 더해 **뷰포트 실측 크기(`viewport`)와 아트보드 크기(`content`)**를 담는다 — 둘 다 `Canvas.tsx` 가 올린다. `fitToScreen()` 은 순수 함수 `fitZoom()` 으로 두 크기의 비율을 재서 소수점 두 자리에서 **내림**한 확대율을 쓴다(올림하면 아트보드 가장자리가 잘린다). `ZOOM_STEP` 눈금으로 내리지 않는다 — 1920px 아트보드에서 1%p는 19px이고, Fit 이 그만큼 어긋나면 캔버스 바탕이 띠로 남는다. 그래서 `zoomIn/zoomOut` 은 더하고 빼는 대신 다음/이전 눈금으로 **붙인다**(57% → 75%). 실측값을 아직 못 받았으면 100%로 리셋한다 | — (`test/view-store.test.ts` 7케이스 · `fitZoom` 은 `test/fit-zoom.test.ts` 7케이스) |
| `src/features/editor/store/measureStore.ts` | **선택 노드가 캔버스에서 실제로 몇 px 로 그려졌는지**(`size`)만 담는 단일 값 스토어. `Canvas.tsx` 의 `ResizeObserver` 가 올리고 `ui/properties/SizeSection.tsx` 가 읽는다. Hug/Fill 은 스펙에 숫자가 없어 패널이 크기를 알 수 없는데 그 자리를 이 실측값이 채운다. 같은 값이면 `set` 을 건너뛴다(`ResizeObserver` 가 자주 부른다) | — (IR 이 아닌 파생 UI 상태라 `editorStore` 계약과 분리했다 — [EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md). 두 파일의 주석이 그 계약을 **"4-멤버"**라고 부르던 문제 — 계약은 그동안 5 → 6 → 11 → 14 → 15 를 거쳐 지금 **16개**다(2026-09-18 실측, 위 `store/editorStore.ts` 행 참고) — 는 **이슈 #95 로 해결됐다(2026-09-18)**. 두 주석에서 멤버 수 표현을 걷어내고 개수는 `EDITOR_STORE_CONTRACT.md` 가 갖게 넘겼으므로, 계약이 더 늘어도 이 주석은 다시 낡지 않는다. **계약 문서의 개수가 4 → 5 → 6 → 11 → 14 → 15 → 16 으로 여섯 번 바뀐 이력이 그 판단의 근거다**) |

`Canvas.tsx` 상단 주석은 스스로를 **"임시 스탠드인 — 팀원이 정식 구현으로 교체할 예정"**이라고 밝힌다.
캔버스에서 편집하는 기능은 리사이즈(핸들 드래그, PR #99)와 노드 끌어 옮기기(순서·부모 변경, 이슈 #187) 둘이다.

**해소됨(2026-09-08, 이슈 #40).** 세부설정 패널은 여전히 `editorStore.setNodeField` 를 부르지만,
`setNodeField` 자신이 이제 `command/applyCommand.ts` 의 `updateNode` Command를 만들어 적용한다 —
[02-mvp-scope.md](02-mvp-scope.md)가 못박은 "GUI는 IR을 직접 수정하지 않고 Command Engine을
호출한다" 제약을 함수 내부에서 충족한다. 호출부(패널·트리)는 시그니처가 그대로라 이 변화를
모른다. 부수 효과로 성공한 변경마다 `history` 에도 쌓인다(`editorStore.undo`/`redo`) — 2026-09-18(이슈 #131)부터
그 `history` 는 페이지별 스택이 아니라 **프로젝트 하나짜리 스택**이다.

**그 호출 경로가 한 곳으로 모여 있다는 서술은 더 이상 정확하지 않다.** `src/` 전체에서 `setNodeField` 를
실제로 호출하는 지점은 **세 곳**이다(2026-09-18 재실측 — `git grep -n "setNodeField" src/`) —
`src/features/editor/ui/properties/useNodeField.ts:32`(패널 전체가 거치는 훅),
**`src/features/editor/ui/LayerTree.tsx:115`·`:255`**(레이어 트리의 이름 변경과 표시 토글. 훅을 거치지 않고
스토어를 직접 부른다), **`src/features/editor/ui/Canvas.tsx:296`**(리사이즈 핸들 드래그, PR #99. 너비·높이 두 줄이던 호출이 #207에서 축을 받는 한 줄로 합쳐졌다 — 2026-10-04·#207 재실측).
`src/` 의 나머지 `setNodeField` 히트는 스토어의 정의(`store/editorStore.ts:152`, 2026-10-04 재실측)와 주석이다.
**"두 곳"이라던 2026-09-08 집계는 그 뒤 리사이즈 핸들과 트리 이름 변경이 붙으면서 낡았다.**

**패널 쪽에 한해서는 여전히 한 곳이다.** 패널의 필드 28개
(`ui/PropertiesPanel.tsx` 2 · `properties/` 의 섹션 8개 합계 26 — `useNodeField` 호출 지점 실측,
2026-09-11)는 전부 그 훅을 거치므로 **필드가 늘어도 패널에서 바꿔야 할 지점은 늘지 않는다.**
27개이던 집계가 28개가 된 경위는 이렇다 — 이슈 #92 로 `FrameProperties`(12) · `TextProperties`(10) 가
섹션 8개로 쪼개지면서 두 파일이 각자 갖던 Size 2개가 하나로 합쳐졌고(−2), 그동안 편집할 수 없던
`placeholder` · `src` · `fit` 3개가 새로 붙었다(+3). 훅을 거치지 않는 필드가 생긴 것은 아니다.
바뀐 것은 **패널 밖에 호출자가 생겼다**는 점이다 — 지금은 트리 둘(이름·표시)과 캔버스 하나(리사이즈)로
모두 셋이다(2026-09-18 재실측). 다만 셋 다 시그니처가 그대로라 이슈 #40 은 이 지점들을 건드리지 않고
`setNodeField` 내부만 바꿔서 끝났다.

페이지 자체(이름·해상도)는 `setNodeField` 가 아니라 `setPageField` 로 고친다 —
`ui/properties/PageProperties.tsx` 한 곳에서 4칸이 부른다. **이쪽도 이제 Command Engine을
거친다**(2026-09-09, #40 리뷰 — GAMMJ, PR #102). 처음엔 범위 밖으로 남겨뒀었는데, 리뷰에서
"페이지 이름·해상도도 IR인데 `Closes #40`이 과하다"는 지적을 받고 `updateScreen` Command를
새로 만들어 태웠다 — 노드 대상 `updateNode`와 대상만 다르고 나머지는 같다. 부수 효과로
"노드 편집 → 해상도 변경 → undo"가 둘 다 되돌리던 것도 해소됐다 — 이제 각자 자기 체크포인트를
남긴다.

**해소됨(2026-09-18, 이슈 #131, PR #142) — `insertNode` 도 이 경로 안으로 들어왔다.** Import(이미지
삽입)와 도구 모음(Frame/Text 생성, PR #68), 트리의 "레이어 추가"가 부르는 `insertNode` 는 이제
`createNode` Command 를 거치고 `history` 에도 쌓인다 — 삽입 직후 `undo` 한 번이 그 노드만 지운다.
같은 이슈가 `addPage`·`removePage` 도 history 에 태웠고(이 둘은 `pages`·`pageOrder` 를 바꿔 Command 로
표현되지 않으므로 스토어가 직접 스냅숏을 얹는다), 그 과정에서 **스택 단위를 페이지별에서 프로젝트
하나로 올렸다** — `removePage` 를 되돌리려면 다른 길이 없었다(지워지는 페이지의 스택이 지우는 것과
함께 사라지므로). 이제 `spec` 을 바꾸는 모든 액션이 `history` 에 쌓이므로 `present` 가 낡을 수 있는
경로가 없어졌고, 그걸 방어하던 `reconciledHistory` 도 함께 지웠다. **Undo/Redo를 실제로 부를
UI(버튼·단축키)는 2026-09-11(이슈 #118, PR #120 — 레이어 트리 footer)에 생겼다.** UI가 생기면서
드러난 "숫자 칸에서 키 입력마다 history가 쌓이는" 문제는 #121이, 같은 문제가 남아 있던
`TextField`(노드 이름·텍스트 content)는 #132(PR #141)가 고쳤다(2절 Undo/Redo 행 참고).

---

## 2. MVP 문서가 요구하는데 저장소에 없는 것

| 항목 | 02-mvp-scope.md의 요구 | 상태 | 근거 |
|---|---|---|---|
| CLI | `npx visual-spec init` / `npx visual-spec` | **완료(2026-09-10, 이슈 #42·#104·#105)** | `package.json` 에 `bin` 필드가 생겼고(`{ "visual-spec": "./bin/visual-spec.mjs" }`), `bin/visual-spec.mjs` 가 진입점이다(빌드 없는 순수 Node 스크립트 — `scripts/generate-types.mjs` 와 같은 방식). `init`·`skills`·`help` 세 명령과, **인자 없이 실행하면 GUI가 뜬다**(이슈 #105). `skills` 는 이 패키지의 `skills/`(2026-09-28 기준 6종 — 이슈 #194로 `visual-spec-nl-response` 추가, `readdirSync`로 폴더를 그대로 훑으므로 스킬이 늘어도 이 명령은 코드 변경 없이 새 스킬을 함께 설치한다)를 `.claude/skills/` 로 복사한다 — `init` 과 달리 **덮어쓴다**(스킬은 이 도구가 배포하는 콘텐츠라 "다시 설치"가 "최신으로 맞춘다"는 뜻이어야 한다는 판단, 이슈 #104), 다만 파일 내용이 같으면 쓰지 않는다. **GUI는 이 패키지 자신의 Vite 개발 서버를 띄운다**(`node_modules/.bin/vite --open`, 사용자 프로젝트 코드가 아니라 이 저장소의 에디터가 뜬다) — `.visual-spec/` 작업공간에는 아직 연결돼 있지 않다(Open/Save/Import는 여전히 브라우저 파일 다이얼로그·다운로드·base64 인라인을 쓴다, 1절 GUI·Canvas 행 참고). CLI 진입점 자체는 이제 갖췄지만, 이 패키지가 npm에 실제로 배포된 상태는 아니다 |
| `.visual-spec/` 작업공간 | `specs/` `generated/` `preview/` `assets/` `runtime/` | **부분(2026-09-09, 이슈 #42)** | `visual-spec init` 이 실행된 폴더 아래 다섯 폴더를 전부 만든다(`bin/visual-spec.mjs` 의 `initWorkspace()`) — 멱등적이라 이미 있으면 건드리지 않고, `.visual-spec` 자리에 폴더 아닌 파일이 있으면 조용히 덮어쓰지 않고 에러로 끝난다(`test/cli-init.test.ts` 6케이스, 자식 프로세스로 실제 실행해 검증). **다만 폴더만 만들 뿐 아직 아무도 그 안을 읽거나 쓰지 않는다** — GUI 의 Open/Save/Import(`ui/openSpecFromFile.ts`·`ui/exportSpecAsJson.ts`·`ui/importImageFromFile.ts`)는 여전히 브라우저 파일 다이얼로그/다운로드/base64 인라인을 쓰고, `skills/visual-spec-to-react/SKILL.md` 가 쓰기로 한 `generated/pages/`·`generated/components/` 하위 폴더도 스킬이 파일을 쓸 때 알아서 만드는 것으로 남겨뒀다(이슈 #42 본문의 범위 — 다섯 최상위 폴더만). 이 폴더들을 실제로 채우는 건 별도 작업이다 |
| Command 스키마 v0.1 | "v0.1로 고정한다"고 선언한 3개 스키마 중 하나 | **완료(2026-09-19, #153)** | `command/command.schema.json`이 6종 Command와 Transaction의 런타임 정본이고 `validateCommand`·`validateTransaction`이 Ajv로 검사해 예외 대신 issues를 돌려준다. 동결·변경 절차는 [09-command-schema-freeze.md](09-command-schema-freeze.md) |
| Ticket 스키마 v0.1 | 같음 | **완료(2026-09-29, #179)** | `ticket/ticket.schema.json`이 `Ticket`·`TicketStatus` 런타임 정본이고, `validateTicket`·`validateTickets`가 Ajv로 검사해 예외 대신 issues를 돌려준다. `instances`는 IR의 `NodeId`를 참조 재사용한다. 동결·변경 절차는 [11-ticket-schema-freeze.md](11-ticket-schema-freeze.md) |
| Undo / Redo | MVP 포함 범위 표 "편집" 행 | **부분** | `command/history.ts`의 범용 undo/redo 스택이 `editorStore`에 연결돼 있다(2026-09-08, 이슈 #40) — `history` + `undo`/`redo` 액션. **2026-09-18(이슈 #131, PR #142)에 스택 단위가 페이지별에서 프로젝트 하나로 올라갔다** — `Record<PageId, HistoryState<ScreenSpec>>` 이 `HistoryState<EditorSnapshot>`(`EditorSnapshot = { spec, activePageId }`)이 됐고, `undo`는 "활성 페이지의 마지막 편집"이 아니라 **"프로젝트 전체의 마지막 편집"** 한 단계를 되돌리며 되돌린 편집이 있던 페이지로 캔버스가 함께 옮겨 간다. **같은 이슈로 `insertNode`(Import·도구 모음·트리의 레이어 추가)·`addPage`·`removePage` 도 history에 쌓인다** — `spec`을 바꾸는 **편집** 액션 중 안 쌓이는 것이 이제 없다(`loadSpec`(New/Open)만 예외인데, 그건 편집이 아니라 스펙 교체라 쌓는 대신 `initHistory` 로 스택을 새로 시작한다 — 이어 쓰면 `undo` 한 번이 방금 연 파일이 아니라 전에 열려 있던 파일의 옛 상태로 튄다). **Undo/Redo를 누를 UI(레이어 트리 footer 버튼 · Cmd/Ctrl+Z)는 2026-09-11(이슈 #118, PR #120)에 생겼고**, 비활성화 판정은 `canUndo(history)`/`canRedo(history)` 다(스택이 하나뿐이라 페이지를 바꿔도 판정이 그대로다). UI가 생기면서 드러난 "키 입력마다 history가 쌓이는" 문제는 `setNodeField`/`setPageField`의 `continueEdit` 매개변수(기본 false)로 고쳤다 — 숫자·색상 칸은 2026-09-13(이슈 #121, `useDraftInput.ts`), **`TextField`(노드 이름·텍스트 content)는 2026-09-18(이슈 #132, PR #141)** 이다. 병합 여부는 그걸 아는 호출부만 판단한다 — 입력칸은 `properties/fields/editBurst.ts` 의 burst 추적기로, **캔버스 리사이즈 핸들은 2026-10-04(이슈 #207)부터 `ui/resizeGesture.ts` 의 판단기로** 넘긴다. 리사이즈는 끌기 한 번(e·s·se 핸들, root 아트보드 포함)이 한 단계다 — 값이 실제로 바뀐 첫 커밋만 새 단계를 만들고 나머지는 `continueEdit: true` 로 병합하며, 직전 값과 같은 이동은 아예 커밋하지 않아 핸들만 눌렀다 떼도 직전 단계를 덮어쓰지 않는다(아래 입력칸 가드와 같은 생각). 레이어 트리 표시 토글처럼 이 매개변수를 모르는 호출부는 그대로 매번 새 단계를 쌓는다. **값이 그대로인 입력은 커밋하지 않는다** — `TextField`(#132)에 이어 **2026-10-04(이슈 #209)부터 `useDraftInput` 계열(숫자·색상·크기 칸)도** 같은 가드를 쓴다(`properties/fields/unchangedCommit.ts`). 칸에 보이는 값이 아니라 커밋이 보낼 값을 저장된 값과 견주므로, Hug/Fill 칸에 보이던 실측 px를 그대로 치는 것(Fixed로 바뀜)이나 소문자로 저장된 색을 다시 치는 것은 여전히 커밋된다. 그 전에는 값이 그대로인 커밋(예: 간격 16 칸에 `"016"`)이 빈 undo 단계를 쌓았다 — 스토어는 같은 값 쓰기도 새 단계로 쌓는다([EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) 참고) |
| 반응형 (데스크톱 · 모바일) | MVP 포함 범위 표 "반응형" 행 | **설계 완료, 구현 미착수 (#181)** | Screen별 breakpoint + 희소 노드 override로 결정. 정본 스키마는 여전히 `responsive`를 제외하며, 스키마·GUI·코드 생성은 후속 작업([12-responsive-ir-design.md](12-responsive-ir-design.md)) |
| 홈(진입) 화면 | [04-gui-spec.md §2](04-gui-spec.md#2-홈진입-화면)가 화면 목록·카드·빈 상태까지 명세 | **부분** | **컴포넌트도 화면 전환도 생겼다**(PR #77 — `ui/HomeScreen.tsx`, `ui/homePreview.ts`, `store/navigationStore.ts`, `test/home-preview.test.ts`). `src/app/App.tsx` 가 `navigationStore.screen` 으로 홈/에디터를 가르고, 홈에서 카드나 "+ 새 화면"으로 에디터에 들어가고 `ui/MenuBar.tsx` 의 로고 클릭으로 홈에 돌아온다. **04 §2 의 상태 1(목록)·상태 2(첫 실행, 빈 목록, 세 갈래 선택지)를 이제 둘 다 실제 파일 목록으로 가른다**(2026-09-29, 이슈 #186) — `.visual-spec/specs/`를 읽어 0개면 상태 2, 1개 이상이면 상태 1이다(`ui/HomeScreen.tsx` 상단 주석). #133 이전엔 워크스페이스가 없어 프로젝트가 항상 정확히 1개였다는 근거가 있었는데 그새 사실이 아니게 됐던 것을 바로잡았다. **안 된 것** — 카드 액션(복제·삭제·이름 변경), 정렬·수정 시각 표시(서버 목록 라우트가 mtime을 안 준다), "자연어로 초안 만들기"는 아직 "빈 캔버스에서 시작"과 동작이 같다(에디터 안 `NaturalLanguageBar.tsx`에서만 실제 작성이 된다) — 04 §2가 "미확정"으로 남겨 둔 것들이라 이 이슈 범위 밖이다. 목록은 화면이 아니라 **프로젝트**를 나열한다(v0.2). 화면 전환은 별도 라우터 없이 스토어 값 하나로 한다 |

IR, Command, Ticket 세 스키마 모두 v0.1 런타임 정본과 동결 절차를 갖췄다. Ticket은
기존 TypeScript 타입을 유지하면서 JSON Schema 검증기를 추가했다.

---

## 3. 02-mvp-scope.md와 스키마 v0.1의 범위 차이

02가 요구하는 범위와 실제 동결된 스키마 v0.1의 범위가 일치하지 않는 항목이 있다.
**일부는 [06-schema-freeze.md](06-schema-freeze.md)가 의도적으로 좁힌 것이고, 일부는 어느 문서도 정리하지 않은 미조정 항목이다.** 둘을 구분해서 읽어야 한다.

### 노드 타입

02는 `Container / Text / Button / Input / Image` 5종을 요구한다. 정본 `$defs.Node.oneOf`, 05의 MVP 지원 목록, 06의 확정 범위가 모두 `frame`, `text`, `image`, `button`, `input` 5종으로 일치한다. `Container`는 `frame`에 대응한다. **07의 이전 기록은 05가 Image·Button·Input을 빠뜨렸다고 했지만, 05에는 이미 세 타입이 포함되어 있어 그 지적은 낡은 것이었다.**

| 02가 요구한 노드 | v0.1 | 성격 |
|---|---|---|
| Container | `frame` 으로 충족 | 이름만 다르다 |
| Text | `text` 로 충족 | — |
| Image | `image` 로 충족 | **충족됐다(2026-09-01, PR #67).** `src`와 `fit`(`cover`\|`contain`\|`fill`)이 필수이고 예제는 `examples/image-hero.json`이다. #133에서 Import가 가능한 이미지를 `.visual-spec/assets/`에 저장하고 상대 경로를 쓴다. 기존 data URI 문서는 계속 유효하며, 스키마 설명은 상대 경로·`assetId`·data URI를 허용하고 JSON Schema 자체는 비어 있지 않은 문자열만 검사한다(06의 assets 절 참고). |
| Button | `button` 으로 충족 | **충족됐다(2026-09-02, 이슈 #75).** `content`(라벨)·`typography`·`color`가 필수, `background`·`border`는 선택. `text`와 달리 `content`는 `minLength: 1`(빈 라벨 금지). `onClick` 같은 이벤트는 스키마에 없다 — 표시용 정적 마크업만 만든다는 뜻이다. 예제는 `examples/form-grid.json` |
| Input | `input` 으로 충족 | **충족됐다(2026-09-02, 이슈 #75).** `placeholder`(빈 문자열 허용)·`typography`·`color`가 필수. `value`/`onChange` 바인딩은 없다 — props/bindings가 MVP 제외 범위인 것과 같은 이유다. 예제는 `examples/form-grid.json` |

05와 06의 지원 목록, 정본의 노드 유니온 사이에 남은 불일치는 없다.

### 레이아웃

02는 `Row / Column / Grid` 를 요구한다. 정본 스키마의 `$defs.Layout.direction` 은 `["row", "column", "grid"]` 세 값을 허용하며 05와 06도 이를 반영한다. `columns`는 선택 정수(최소 1)이고 생략하면 grid는 1열이다. 다른 방향에 함께 있어도 스키마는 허용하지만 그 의미는 grid에서만 정의한다.

- Row · Column — 충족
- **Grid — 최소 구현으로 충족됐다(2026-09-02, 이슈 #75).** `layout.columns`(선택, grid에서만 의미)만큼의 균등 N열 자동 배치만 지원한다 — 특정 자식을 특정 셀에 지정하는 기능은 없고, grid에서는 `mainAxis`/`crossAxis`가 무시된다. `ui/Canvas.tsx`의 `displayStyle()`, `ui/canvasLayout.ts`의 `boxStyle()` grid 분기가 렌더링을 맡는다. `Canvas.tsx`가 스스로 "임시 스탠드인"이라 밝히고 있어 정식 grid 셀 배치는 그 교체 작업과 함께 다시 다뤄야 한다

### 크기

02의 `Fixed / Fill / Hug` 는 v0.1의 `Size = number(0 이상) | "fill" | "auto"` 로 전부 충족된다.
**`"fill"` 이 교차축에서 무엇을 의미하는지도 이제 06에 결정으로 올라갔다(2026-09-11, 이슈 #46)** — `ui/canvasLayout.ts`의 `boxStyle()`이 이미 그렇게 동작하고 있었는데(주축 `flex: 1 1 0`, 교차축 `align-self: stretch`, 최상위·grid 아이템은 `100%`) 그 결정이 06을 거치지 않았던 것뿐이다. 코드는 이번에 바꾸지 않았다 — 06-schema-freeze.md 참고.

> 노드 다섯 종류, 세 레이아웃 방향, `Size` 표현은 정본·05·06이 일치한다. 02가 요구하는 반응형 레이아웃은 표현 설계가 #181에서 결정됐지만, 06의 스키마 동결 절차에 따른 정본 변경과 GUI 구현은 남아 있다([12-responsive-ir-design.md](12-responsive-ir-design.md)).

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
| 유효 예제 8개 | `examples/*.json` | 검증 통과(2026-09-08 실측 — `ls examples/*.json` 8개. **7개는 `version: "0.1"` 이라 `validateVisualSpec` 이, `two-page-project.json` 만 `version: "0.2"` 라 `validateProjectSpec` 이 받는다**). **2026-10-04(#127)부터 8개 모두 `version: "0.3"` 이다** — `migrateToV03` 로 변환했고, 화면/프로젝트는 키로 갈라 각각 `validateVisualSpec`/`validateProjectSpec` 이 받는다. `examples/image-hero.json` 이 2026-09-01(PR #67)에, `examples/form-grid.json`(button·input·grid)이 2026-09-02(이슈 #75)에, `examples/card-effects.json`(그림자·불투명도·블러)이 2026-09-04(이슈 #78)에, **`examples/two-page-project.json`(v0.2 `ProjectSpec` — 페이지 2장)**이 그사이 추가됐다 |
| 무효 예제 8개 | `examples/invalid/*.json` | 검증기가 잡아야 하는 문서들 |
| 테스트 | `test/editor-store.test.ts`(70) · `test/canvas-input.test.ts`(40) · `test/canvas-layout.test.ts`(40) · `test/validate.test.ts`(21) · `test/apply-command.test.ts`(20) · `test/compile-tickets.test.ts`(18) · `test/project-spec.test.ts`(15) · `test/border-patch.test.ts`(14) · `test/image-src.test.ts`(13) · `test/resolution-presets.test.ts`(13) · `test/canvas-selection.test.ts`(12) · `test/node-sections.test.ts`(12) · `test/radius-patch.test.ts`(12) · `test/selection-rect.test.ts`(12) · `test/edit-burst.test.ts`(11) · `test/schema.test.ts`(10) · `test/tool-store.test.ts`(10) · `test/effect-patch.test.ts`(8) · `test/history.test.ts`(8) · `test/layer-drop.test.ts`(8) · `test/cli-skills.test.ts`(7) · `test/fit-zoom.test.ts`(7) · `test/view-store.test.ts`(7) · `test/cli-init.test.ts`(6) · `test/export-spec.test.ts`(6) · `test/spec-storage.test.ts`(6) · `test/home-preview.test.ts`(5) · `test/shadow-patch.test.ts`(5) · `test/create-node.test.ts`(4) · `test/node-id.test.ts`(4) · `test/public-api.test.ts`(4) · `test/resolve-import-parent.test.ts`(4) · `test/cli-gui.test.ts`(3) · `test/load-spec.test.ts`(3) · `test/navigation-store.test.ts`(3) | **35파일 441케이스 전부 통과** (2026-09-18, PR #141(이슈 #132)·PR #142(이슈 #131)까지 머지된 `develop` 72aa74d 기준 — **파일 35개를 전수 재실측해 `pnpm test` 출력에서 그대로 받아 적었다**). 직전 집계(2026-09-15 의 33파일 363케이스)는 낡아 있었다 — 그 사이 `test/canvas-input.test.ts`(이슈 #91, 4c47c2a) · `test/edit-burst.test.ts`(이슈 #132, 3ccd4c6) 두 파일이 늘었고, 목록에 아예 빠져 있던 `canvas-input` 과 실제보다 작게 적혀 있던 `tool-store`(3 → 10) · `editor-store`(62 → 70) · `canvas-layout`(30 → 40) 등이 총계를 어긋나게 하고 있었다 |
| CI | `.github/workflows/ci.yml` | 타입체크 · 테스트 · 스키마 드리프트 검사 |
| 스킬 6종(2026-09-28, 이슈 #194) | `skills/` — `visual-spec`(허브) · `visual-spec-docs` · `visual-spec-authoring` · `visual-spec-validate` · `visual-spec-to-react` · `visual-spec-nl-response` | 배포 원본은 저장소 루트 `skills/`. 사람이 읽는 설명은 `docs/skills/` 에 같은 이름으로 6개. `analyze-target-project`는 "독립 작업공간" 원칙과 어긋나 제거됨(#33). `visual-spec-nl-response`는 GUI의 `.visual-spec/runtime/` 자연어 요청/응답 교환에 응답하는 법을 담는다 — `visual-spec-authoring`(파일 전체를 직접 쓰거나 고침)과 산출물·도착지가 다르다 |

검증기가 잡아내는 구조 오류는 코드 **9종**이다(2026-09-08 실측 8종 + #127 스키마 전환에서 1종 — `schema/validate.ts:7` 의 `IssueCode` 유니온) — `schema`, `root-missing`, `root-not-frame`, `child-missing`, `cycle`, `multiple-parents`, `orphan-node`, **`page-order-mismatch`**, **`gradient-stop-order`**. `page-order-mismatch` 가 v0.2 와 함께 늘었다 — `pages` 의 키와 `pageOrder` 가 정확히 일치해야 한다는 규칙은 JSON Schema 로 표현할 수 없어 `validateProjectSpec` 이 코드로 검사한다(정본 스키마의 `$defs.ProjectSpec.pageOrder` 설명이 그렇게 밝히고 있다). `gradient-stop-order` 는 0.3 에서 늘었다 — 그라디언트 stop 의 `at` 오름차순은 배열 원소끼리 비교하는 문법이 없어 `validateVisualSpec`·`validateProjectSpec` 이 코드로 검사한다([13](13-background-fill-design.md#표현-규칙)).

---

## 5. 확인된 결함과 개선 여지

### 5.1 `package.json` 의 `main` 이 없는 파일을 가리킨다 — **해결됨 (2026-09-10, 이슈 #45)**

```json
"main": "src/index.ts"
```

`src/index.ts` 는 저장소에 존재하지 않는다. 스키마를 `src/features/editor/schema/` 로 옮기면서 파일은 사라졌는데 필드가 남았다.

`private: true` 인 Vite 앱이라 지금 당장 깨지는 것은 없다. 다만 **끊긴 참조**이고, 나중에 이 패키지를 실제로 배포하거나 `bin` 을 추가할 때 문제가 된다.

2026-08-29 재확인: `package.json` 의 `"main"` 은 그대로 `src/index.ts` 이고 그 파일은 여전히 없다. **미해결이다.**

**2026-09-10 — `main` 필드 자체를 지웠다.** 이슈 본문이 남긴 판단("이 저장소가 앱인가 라이브러리인가")은 그 사이 이슈 #42·#104·#105가 답을 내놨다 — `bin` 필드가 생겨 **CLI 앱**이 됐지, `require("visual-spec")`으로 가져다 쓰는 라이브러리가 된 게 아니다. `src/features/editor/schema/`의 공개 표면(`test/public-api.test.ts`가 지키는 것)은 지금도 이 저장소 **안에서만** `@/` 경로 별칭으로 쓰인다 — 패키지 이름으로 import하는 곳이 `src/`·`test/`·`scripts/`·`bin/` 어디에도 없다(`git grep` 확인). `main`이 가리킬 실제 빌드된 JS 산출물도 없다(`vite build`는 브라우저용 번들만 만들고, 라이브러리용 `main` 산출물은 안 만든다). 그래서 **없는 파일을 가리키는 것도, TS 소스를 가리켜 거짓으로 "가져다 쓸 수 있다"고 하는 것도 아닌, 필드 자체를 지우는 쪽**을 택했다 — `private: true`가 이미 "npm에 배포 안 한다"를 못박고 있어서 자연스럽다. `pnpm run typecheck`·`pnpm test`·`pnpm run build`(Vite 앱 빌드는 `main`을 안 쓴다) 전부 영향 없음을 확인했다.

**2026-09-11(#45 리뷰, Yumesa2025) — `files` 필드도 추가했다.** `main`만 지운 걸로는 "패키지 메타데이터가 실제 구조와 어긋난 채로 배포된다"가 절반만 풀린다는 지적을 받았다 — `files`가 없어서 배포 tarball에 뭐가 담길지 통제가 없었다. `bin/visual-spec.mjs`가 패키지 루트에서 실제로 읽는 건 `skills/` 하나뿐이라(`init`은 cwd 아래만 건드리고, `runGui`가 보는 `node_modules/`는 `files`와 무관하다) `"files": ["bin", "skills"]`로 좁혔다. `examples/`·정본 스키마 JSON은 스킬 문서가 참조하긴 하지만 전부 저장소 기준 GitHub raw URL이라(`skills/visual-spec-docs/SKILL.md` 참고) 패키지에 넣어도 그 경로로는 안 닿는다 — 일부러 뺐다. `npm pack --dry-run`으로 **9파일 · 21.9 kB**(`bin/visual-spec.mjs` + `SKILL.md` 5종 + `package.json`·`README.md`·`LICENSE`)를 확인했고 `src/`·`test/`·`docs/`·`tsconfig*`·`vite.config.ts`는 0건이다.

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

- `Canvas.tsx` 는 스스로를 임시 스탠드인이라고 밝히고 있다. 캔버스 편집은 리사이즈(PR #99)와 노드 끌어 옮기기(이슈 #187)까지 된다 — 좌표 이동은 스키마에 x/y 가 없어 대상이 아니다.
- **해소됨(2026-09-09, 이슈 #40)** — `editorStore.setNodeField`·`setPageField` 가 이제 내부적으로
  Command Engine(`applyCommand`)을 거친다. **걷어낼 호출 지점은 두 곳이었다**(2026-09-08 재실측으로
  갱신된 집계 — `ui/properties/useNodeField.ts` 와 `ui/LayerTree.tsx`(표시 토글); 그 뒤 트리 이름 변경과
  캔버스 리사이즈가 붙어 지금은 세 곳이다, 2026-09-18 재실측) — 전부 시그니처가 그대로라 훅·트리·캔버스
  쪽 코드는 손대지 않고 `setNodeField`/`setPageField` 내부만 바꿔서
  끝났다. **페이지 이름·해상도를 고치는 `setPageField` 경로도 처음엔 범위 밖으로 남겼다가, #40 리뷰
  (GAMMJ, PR #102)에서 "그것도 IR인데 `Closes #40`이 과하다"는 지적을 받고 `updateScreen` Command를
  새로 만들어 태웠다** — `updateNode`와 대상(노드 vs 화면 자신)만 다르고 나머지는 같다. **마지막까지
  이 경로 밖이던 `insertNode` 도 2026-09-18(이슈 #131, PR #142)에 `createNode` Command 로 들어왔다** —
  **노드를 고치는 액션 중 Command Engine 밖에 남은 것이 없다.** `addPage`·`removePage` 는 여전히
  안 거치지만 그건 범위 밖이라서가 아니라 `applyCommand` 가 다루는 단위(화면 한 장)를 벗어나
  Command 로 표현되지 않아서고, `loadSpec` 은 편집이 아니라 스펙 교체다(1절 표 아래 참고).
  **Undo/Redo를 부를 UI는 이제 있다**(2026-09-11, 이슈 #118, PR #120) — 그 UI가 드러낸 history 병합
  문제는 숫자·색상 칸은 이슈 #121이, `TextField` 는 이슈 #132(PR #141)가 고쳤다(2절 Undo/Redo 행 참고).
- 06이 남겨 둔 **`"fill"` 의 교차축 의미**는 `ui/canvasLayout.ts` 의 `boxStyle()` 이 교차축 `"fill"` 을
  `align-self: stretch` 로 옮기는 방식으로 사실상 한 가지 해석을 쓰고 있다(주축 `"fill"` 은 `flex: 1 1 0`,
  부모가 없는 최상위 노드만 `100%`). **06에 반영됐다**(2026-09-11, 이슈 #46, PR #119).

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
pnpm run typecheck   # 통과 (2026-09-18, `develop` 72aa74d — PR #141·#142 머지 후 확인)
pnpm test            # 35파일 441케이스 통과 (2026-09-18, `develop` 72aa74d — PR #141(이슈 #132)·PR #142(이슈 #131) 머지 후 전수 재실측)
```
