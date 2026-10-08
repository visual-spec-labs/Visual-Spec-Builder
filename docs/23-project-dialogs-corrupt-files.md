# 홈 화면 — 용어 통일·앱 내 다이얼로그·손상 파일 안내 (#288)

기준: 2026-10-05 제품 점검 `D04` · P2 · develop `ad3b6f17d183b69b1589707e7e8d032806ba4c88`.
선행: #267(통합·완료됨).

## 문제

`HomeScreen.tsx`는 카드를 "프로젝트 {N}개"로 세면서 헤더 버튼은 "+ 새 화면"이다 —
같은 화면 안에서 두 용어가 가리키는 대상이 같은데 이름이 다르다. docs/21(#286)은
이 버튼을 "반복 사용 중의 단축 버튼이라 범위 밖"으로 명시적으로 남겨 뒀지만,
#288은 그 지점을 정면으로 다룬다.

Open(`openSpecFromFile.ts`)·Save as(`exportSpecAsJson.ts`)·Rename(`HomeScreen.tsx`)
세 곳 모두 `window.prompt`로 사용자 입력을 받는다. 특히 Open은 번호 매긴 목록을
`prompt` 텍스트 한 칸에 통째로 밀어넣고 사용자가 번호나 이름을 다시 타이핑해야
한다 — `openSpecFromFile.ts`의 기존 주석이 이미 이걸 절충으로 인정하고 "목록
UI는 별도 이슈로 남긴다"고 적어 뒀다. 이 이슈가 그 별도 이슈다.

`homeProjects.ts`의 `loadHomeProject`는 못 읽거나 검증에 실패한 파일을 `null`로
돌리고, `loadWorkspaceProjects`가 그 `null`을 조용히 걸러낸다 — 깨진 파일이
카드 목록에서 **아무 흔적도 없이** 사라진다. 사용자는 파일이 있었는지조차 알 수
없다.

## 범위

**이번 작업이 다루는 것:**
1. 홈 화면의 "화면" 표현을 "프로젝트"로 통일한다(헤더 버튼 포함 — docs/21이
   남겨 둔 그 버튼).
2. Open(파일 선택)·Save as(파일명)·Rename(이름) 세 다이얼로그를 `window.prompt`
   대신 앱 내 모달 컴포넌트로 바꾼다.
3. 읽기 실패·검증 실패로 목록에서 빠지는 파일을 이유와 함께 보여주고, 복구
   진입점(다시 확인·원본 다운로드)을 둔다.
4. 검색·복제·삭제는 **우선순위와 복구 정책만 결정**하고 후속 이슈로 분리한다(이번
   PR은 구현하지 않는다).

**이번 작업이 다루지 않는 것(아래 "범위 밖" 참고):**
- 성공/실패를 알리기만 하는 `alert()`(Save 성공/실패, Export 검증 실패, Open의
  빈 목록·읽기 실패 알림) — 사용자 입력을 받지 않는 통지는 이 이슈의 "다이얼로그
  동작 통일" 완료 조건 밖이다.
- 이미 구현된 이름 변경·실제 파일명 변경·최근 수정순 정렬 — 재구현하지 않는다
  (`renameProject.ts`는 그대로 둔다).

## 결정

### 1. 용어: "새 화면" → "새 프로젝트"

헤더 버튼과 상태 2(빈 목록) 안내 문구를 "프로젝트" 기준으로 바꾼다.

- `+ 새 화면` → `+ 새 프로젝트`
- `첫 화면을 만들어 봅시다` → `첫 프로젝트를 만들어 봅시다`
- `기존 화면 불러오기` → `기존 프로젝트 불러오기`

"자연어로 초안 만들기" 패널의 "만들고 싶은 **화면**을 설명해 주세요"는 바꾸지
않는다 — 거기서 "화면"은 프로젝트가 아니라 **프로젝트 안의 페이지(1장)** 내용을
가리키는 다른 뜻이다(스키마 v0.2의 "프로젝트 1개, 페이지 여러 장" 모델과 같은
구분, `HomeScreen.tsx` 머리말 주석 참고). `handleNewScreen` 같은 내부 함수/변수
이름은 사용자에게 안 보이므로 바꾸지 않는다 — 이름 하나 통일하자고 무관한 diff를
늘리지 않는다.

### 2. 다이얼로그: 전역 prompt 스토어 + 모달 컴포넌트 하나

`SaveConflictDialog.tsx`가 이미 쓰는 패턴(스토어로 상태를 들고, `App.tsx`
루트에서 한 번 마운트)을 그대로 따른다 — Save as·Open 둘 다 홈 화면이 아니라
`MenuBar.tsx`(에디터 안)에서도 불리므로, 특정 화면에 종속된 로컬 상태로는
두 진입점을 다 못 커버한다.

- `store/promptDialogStore.ts`: DOM을 모르는 순수 스토어. `promptText(options)`·
  `promptPick(options)` 두 평범한 비동기 함수를 내보낸다 — 각각
  `Promise<string | null>`을 돌려줘서 `window.prompt`를 호출부에서
  `await promptText(...)`로 그대로 바꿔 끼울 수 있다(취소 = `null`, 기존 호출부의
  `if (answer === null) return;` 분기가 그대로 산다).
- `ui/PromptDialog.tsx`: 그 스토어 상태를 읽어 `role="alertdialog"` 오버레이를
  그린다. 텍스트 입력 한 칸(Save as·Rename)과 목록 선택(Open) 두 모양을 한
  컴포넌트 안에서 분기한다 — 둘 다 "입력 하나 받고 확인/취소"라는 같은 생명
  주기를 공유해서 스토어를 둘로 쪼갤 이유가 없다.
- `App.tsx`에 `<PromptDialog />`를 `<SaveConflictDialog />` 옆에 한 번만 단다.

**Open은 번호/이름 재입력이 아니라 목록 클릭으로 바뀐다.** `promptPick`이 이름
배열을 받아 각 항목을 버튼으로 보여주므로, 번호·이름 텍스트를 해석하던
`resolveSpecChoice`(`specChoice.ts`)는 이 변경 이후 호출부가 없어진다 — 죽은
코드를 호환성 이유로 남기지 않고 파일과 테스트를 함께 지운다.

### 3. 손상 파일: 이유 구분 + 원본 다운로드

`homeProjects.ts`가 이미 `{ ok: true } | { ok: false }` 모양을
쓰는 이 저장소의 관례(`parseSpecJson`의 `LoadSpecResult`, `renameProject`의
`WriteResult`)를 그대로 따른다.

```ts
export type HomeProjectResult =
  | ({ ok: true } & HomeProject)
  | { ok: false; fileName: string; reason: "read-failed" }
  | { ok: false; fileName: string; reason: "invalid"; issueCount: number; rawText: string };
```

`reason`은 두 가지만 구분한다 — `readWorkspaceSpecSnapshot`이 실패를 전부
`null`로 뭉개므로(워크스페이스 미연결·네트워크 오류·HTTP 오류·revision 헤더
없음 전부 구분 불가, `workspaceClient.ts` 확인됨) "읽기 실패"는 더 세분화할
근거 있는 정보가 없다. "검증 실패"는 `parseSpecJson`의 `issueCount`를 그대로
쓴다(JSON 파싱 자체가 안 되는 경우도 `issueCount: 1`로 이미 통일돼 있다,
`loadSpec.ts`).

**복구 진입점은 이 앱이 실제로 할 수 있는 것만 둔다** — 브라우저 안에 JSON
편집기가 없고 워크스페이스 미들웨어는 읽기/쓰기/목록/이름변경만 노출한다.
그래서:
- **다시 확인**: 목록을 다시 읽는다. 외부에서(텍스트 에디터·에이전트 등) 파일을
  고친 뒤 새로고침 없이 반영한다.
- **원본 다운로드**: `reason === "invalid"`일 때만 — 읽기는 성공했으므로 원문이
  있다. `exportSpecAsJson.ts`의 다운로드 헬퍼(`downloadJson` → 범용적으로 쓰이니
  `downloadTextFile`로 이름을 바꾼다)를 재사용해 raw 텍스트를 그대로 내려받게
  한다. `reason === "read-failed"`는 애초에 내용이 없어 다운로드할 게 없다.
- 파일 경로(`.visual-spec/specs/<fileName>`)를 그대로 보여준다 — 터미널/에디터로
  직접 고칠 사람에게는 이게 가장 정확한 안내다.

"고친 파일을 다시 업로드/붙여넣기"처럼 앱 안에서 내용을 바로 고치는 기능은
담지 않는다 — 이건 사실상 작은 텍스트 에디터를 만드는 일이라 이 이슈의
"이유·진입점을 제공한다"는 완료 조건보다 훨씬 크다.

### 4. 검색/복제/삭제 — 우선순위·복구 정책만 결정(구현은 후속 이슈)

| 기능 | 우선순위 | 근거 |
|---|---|---|
| 검색 | 낮음 | 목록은 보통 수십 개 이하이고 이미 최근 수정순 정렬이 있어 스크롤로 충분하다. 프로젝트 수가 많아지는 실사용 패턴이 보이면 올린다. |
| 복제 | 중간 | "비슷한 화면 여러 장을 바리에이션으로 만든다"는 반복 작업에 바로 도움이 된다. 읽은 스펙을 새 파일명으로 다시 쓰는 정도로 구현도 비교적 단순하다. |
| 삭제 | 신중 — 복구 정책부터 | 되돌릴 방법 없이 지우면 피해가 크다. |

**삭제의 복구 정책 추천(후속 이슈에서 확정):** OS 휴지통이 아니라 앱 전용
`.visual-spec/.trash/`로 옮기는 소프트 삭제. OS 셸 휴지통 API에는 브라우저가
직접 접근할 수단이 없고(워크스페이스는 Vite 미들웨어를 통한 간접 파일 접근이다),
실수로 지운 프로젝트를 되살릴 방법이 없는 "즉시 영구 삭제"는 이 앱의 자동저장·
초안 보존 철학(#267 등)과도 어긋난다. 보관 기간·자동 비우기·`.trash/` 자체를
목록에서 보이지 않게 거르는 방법은 후속 이슈에서 구체화한다.

## 설계

### 다이얼로그 흐름

```
Save as / Rename (텍스트 입력)
  MenuBar "Save as" / HomeScreen "이름 변경"
    │  await promptText({ title, message?, initialValue, confirmLabel })
    ▼
  PromptDialog(kind="text") — input 한 칸 + 확인/취소
    │
    ├─ 취소 ─────────────► resolve(null) — 호출부는 기존처럼 조용히 끝난다
    └─ 확인(Enter/버튼) ──► resolve(값) — 호출부가 이어서 saveSpecAs/renameProject 실행

Open (목록 선택)
  MenuBar "Open" / HomeScreen "기존 프로젝트 불러오기"
    │  await promptPick({ title, message?, items: names })
    ▼
  PromptDialog(kind="pick") — 파일명 버튼 목록 + 취소
    │
    ├─ 취소 ─────────────► resolve(null)
    └─ 항목 클릭 ─────────► resolve(파일명) — 호출부가 readWorkspaceSpecSnapshot 실행
```

### 손상 파일 섹션 (HomeScreen)

```
상태 1(목록 있음)
┌──────────────────────────────┐
│ Visual Spec Builder   [+ 새 프로젝트] │
├──────────────────────────────┤
│ 프로젝트 3개                          │
│ [카드][카드][카드]                    │
│                                        │
│ 손상된 파일 1개                        │
│ .visual-spec/specs/broken.json        │
│   올바른 프로젝트 파일이 아닙니다        │
│   (검증 실패 2건).     [다시 확인][원본 다운로드] │
└──────────────────────────────┘

상태 2(유효 목록 0, 손상 파일 존재) — 세 갈래 선택 타일 아래에 같은 섹션을 붙인다.
draftMode 안에서는 보이지 않는다(초안 작성에 집중, 뒤로 가면 다시 보인다).
```

## 컴포넌트/모듈 계획

- `src/features/editor/store/promptDialogStore.ts` (신규) — `promptText`/
  `promptPick`과 그 상태. DOM 없음, `store/`에 둔다.
- `src/features/editor/ui/PromptDialog.tsx` (신규) — 오버레이 렌더링. `App.tsx`에
  마운트.
- `src/features/editor/ui/homeProjects.ts` (수정) — `HomeProjectResult` 판별
  유니온, `loadWorkspaceProjects`가 `{ projects, failures }`를 돌려준다.
- `src/features/editor/ui/HomeScreen.tsx` (수정) — 용어 교체, `handleRename`이
  `promptText` 사용, 손상 파일 섹션 컴포넌트 추가, `HomeState`에 `failures` 포함.
- `src/features/editor/ui/openSpecFromFile.ts` (수정) — `openSpec()`이
  `promptPick` 사용, `resolveSpecChoice` 호출 제거.
- `src/features/editor/ui/exportSpecAsJson.ts` (수정) — `saveSpecAs()`가
  `promptText` 사용, `downloadJson` → `downloadTextFile`로 이름 변경(내보내기
  전용이 아니라 손상 파일 원본 다운로드에도 쓰이게 됨), export해서 `HomeScreen.tsx`가
  재사용.
- `src/features/editor/ui/specChoice.ts`, `test/spec-choice.test.ts` (삭제) —
  `openSpec()`이 더 이상 텍스트 파싱을 하지 않아 호출부가 없어진다.
- `src/app/App.tsx` (수정) — `<PromptDialog />` 추가.

## 검증

- **단위 테스트**: `promptDialogStore.ts`(요청→resolve 왕복, `test/prompt-dialog-store.test.ts`
  신규), `homeProjects.ts`의 `loadHomeProject`/`loadWorkspaceProjects` 분기(읽기
  실패/검증 실패/정상 세 경우 모두, `test/home-projects.test.ts` 확장) 모두 통과.
- **`window.prompt`를 직접 모킹하던 기존 테스트 전부를 고쳤다** — `openSpec`/
  `saveSpecAs`가 더는 `window.prompt`를 안 부르므로, `document-path.test.ts`·
  `open-conflict.test.ts`·`reopen-draft.test.ts`·`spec-autosave.test.ts`가
  `promptDialogStore`가 열리기를 기다렸다가(열리는 시점이 비동기 조회 뒤라
  `vi.waitFor`나, 가짜 타이머를 쓰는 파일은 이미 쓰던 `vi.advanceTimersByTimeAsync(0)`로
  마이크로태스크를 흘려보냄) `resolve(...)`로 답하도록 바꿨다. "번호로 골라도
  이름을 기억한다" 테스트는 번호 입력 자체가 없어져(클릭식 목록으로 바뀜) 삭제했다.
  네 파일 전부 수정 후 통과(document-path 18, open-conflict 2, reopen-draft 19,
  spec-autosave 41).
- **`resolveSpecChoice`(`specChoice.ts`)와 그 테스트를 지웠다** — `openSpec()`이
  더 이상 텍스트 파싱을 하지 않아 호출부가 없어졌다(죽은 코드).
- **기존 rename/한글 파일명/초안 보존 테스트는 그대로 통과한다**
  (`renameProject.ts` 자체는 안 바꿨다) — `document-path.test.ts`의 Open/Save as
  스위트, `reopen-draft.test.ts` 전체가 이걸 포함한다.
- `npx tsc -b`·`npx eslint .`·`npm run build` 모두 통과. `npx vitest run`은
  18개 실패가 남지만 **전부 이 작업과 무관한 기존 실패**다(symlink EPERM,
  `cli-skills-*`, `contract-bundle`, `ticket-response-skill`, `package-tarball-smoke`,
  `cli-contract`) — `git stash`로 이 브랜치의 변경을 모두 뺀 깨끗한 상태에서도
  같은 범주가 그대로 재현되는 것을 확인했다(세션 내내 일정했던 환경 문제,
  Windows symlink 권한·pnpm 경로 등).
- **훅/JSX 렌더링(PromptDialog 오버레이 표시, HomeScreen 버튼 라벨 등)은 이
  저장소에 렌더 테스트 인프라가 없어 자동화 검증 대상이 아니다** — #287에서
  반복 확인된 한계와 같다. 코드 추론으로 호출 경로(`await promptText(...)` →
  스토어 상태 전환 → 컴포넌트가 그 상태를 읽어 분기)를 확인하고, 실제 브라우저
  확인은 이 세션의 CDP 확장이 Home→Editor 전환에서 멈추는 환경 문제로 보류한다
  — TODO: 다음 작업에서 브라우저가 정상 동작하면 Open/Save as/Rename/손상
  파일 섹션을 실제로 클릭해 확인한다.

## 자체 code-review 대응 (2026-10-08)

**P1 — `window.prompt`는 메인 스레드를 막는 진짜 모달이었지만 `PromptDialog`는
그냥 React 오버레이다.** 캔버스의 전역 `keydown` 리스너(`canvasKeys.ts`)와
레이어 트리의 undo/redo 리스너(`LayerTree.tsx`)는 둘 다 `saveConflictStore.paused`
만 보고 넘어갔다 — `window.prompt`가 떠 있는 동안은 그 코드 자체가 실행될 수
없어서 가드가 필요 없었는데, `PromptDialog`는 그 보장이 없다. 재현: Open
다이얼로그가 뜬 상태(첫 목록 항목에 `autoFocus`가 가 있다, `button`이라
`isTypingTarget`을 안 탄다)에서 Delete를 누르면 캔버스의 선택 노드가 지워지고,
Escape를 누르면 선택이 해제된다 — 다이얼로그는 그대로 떠 있는데 뒤에서
문서가 바뀐다. 고침: 두 리스너 모두 `usePromptDialogStore`가 닫혀 있는지도
함께 본다.

**P2 — `promptText`/`promptPick`을 다이얼로그가 열려 있는 중에 또 부르면
먼저 연 쪽이 영영 안 풀린다.** `window.prompt`는 한 번에 하나만 뜨고 다음
게 뜨려면 먼저 답해야 했지만, 이 스토어는 상태를 그냥 덮어써서 먼저 연
쪽의 `resolve` 콜백을 놓친다 — 그 호출자의 `await`가 끝나지 않고 멈춘다.
`HomeScreen.tsx`의 `handleRename`은 `renaming` 가드를 다이얼로그가 열린
*뒤*에야 세우므로, 다이얼로그가 떠 있는 동안 "이름 변경"을 두 번 누르면
실제로 이 경로를 탄다. 고침: `promptText`/`promptPick`이 여는 시점에 이미
열려 있던 다이얼로그를 `null`(취소)로 먼저 정리한다 — 나중에 연 요청이
우선한다. `test/prompt-dialog-store.test.ts`에 왕복 테스트를 추가했다.

**P3 — `PromptDialog`에 Escape로 취소하는 길이 없었다.** `window.prompt`/
`window.confirm`은 Escape로 취소할 수 있었다. 고침: 오버레이에 `keydown`을
달아 Escape면 `resolve(null)`. (P1의 캔버스 가드 덕에 이 Escape가 다이얼로그
뒤의 캔버스까지 새지도 않는다.)

이 세 가지 모두 **훅/JSX 쪽 수정이라 자동 테스트가 안 된다** — 이 세션
내내 반복된 렌더 테스트 인프라 부재와 같은 한계다. P2만 순수 스토어 로직이라
테스트를 추가했다.

## 범위 밖

- Save 성공/실패·Export 검증 실패·Open의 빈 목록/읽기 실패 알림(`window.alert`
  그대로 유지) — 입력을 받지 않는 통지라 "다이얼로그 동작 통일" 완료 조건 밖.
  토스트 등 알림 전용 UI로 옮기는 건 별도 이슈로 남긴다.
- 검색/복제/삭제 구현 — 위 "결정 4"의 우선순위·정책만 이번 PR에 포함하고, 실제
  구현은 후속 이슈로 분리한다.
- 손상 파일을 앱 안에서 직접 고치는 편집 기능 — 원본 다운로드까지만 지원한다.
