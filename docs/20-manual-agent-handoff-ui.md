# 수동 에이전트 전달 UI 설계 (#283)

기준: 2026-10-05 제품 점검 `D02` · P1 · develop `ad3b6f17d183b69b1589707e7e8d032806ba4c88`.

## 문제

GUI는 LLM을 직접 실행하지 않는다(#219, A안으로 확정) — 요청 파일을 쓰고, 사용자가
터미널에서 직접 띄운 Claude Code/Codex가 그 파일을 읽어 응답 파일을 쓸 때까지
기다린다. 그런데 지금 GUI는 이 "수동"이라는 전제를 화면에 드러내지 않는다.

- `NaturalLanguageBar.tsx`의 pending 안내: *"에이전트 응답을 기다리는 중…
  에이전트에게 `.visual-spec/runtime/nl-request.json`을 읽고
  `.visual-spec/runtime/nl-response.json`에 Command 배열을 쓰게 하세요."*
- `TicketPanel.tsx`의 상시 안내: *"실행을 누르면 `.visual-spec/runtime/`에
  요청을 쓰고, 에이전트가 응답을 쓰면 상태가 자동으로 바뀝니다."*
- `ticketAgentClient.ts`/`nlAgentClient.ts`의 timeout 메시지도 같은 식으로
  원시 경로를 그대로 내보낸다.

세 군데 다 **"무엇을 해야 하는지"**(에이전트에게 정확히 뭐라고 시켜야 하는지)가
아니라 **"어디에 무엇이 쓰이는지"**(구현 세부사항)를 말한다. "전체 실행"·"요청"
버튼도 이름만 보면 GUI가 뭔가를 대신 실행하는 것처럼 읽힌다 — 실제로는 파일을
쓰고 기다리기 시작할 뿐이다.

## 설계

### 네 단계

```
편집  →  에이전트 전달  →  코드 생성  →  Export
```

- **편집**: 캔버스·속성 패널·자연어 입력창(`NaturalLanguageBar`)으로 스펙을
  바꾼다. 자연어 입력도 내부적으로는 수동 에이전트 왕복(Command 응답)을 쓰지만,
  사용자 관점에서는 "편집"의 한 가지 방법이다 — 별도 단계로 승격하지 않는다.
- **에이전트 전달**: `TicketPanel`에서 구현 티켓 웨이브를 `.visual-spec/runtime/`
  에 내려놓고, 사용자가 자신의 터미널에서 돌리는 에이전트에게 지시를 전달하길
  기다린다.
- **코드 생성**: 에이전트가 `.visual-spec/generated/`에 실제로 파일을 쓰는
  동안이다. GUI는 이 단계를 직접 관찰하지 못한다(#284가 다룰 진행 로그 영역) —
  여기서는 "에이전트가 지금 코드를 쓰고 있을 수 있다"는 사실만 전달한다.
  실행 중이라고 **확정**하지 않는다.
- **Export**: `ExportPanel`에서 생성된 코드를 검증하고 ZIP으로 내보낸다.

`TicketPanel`·`ExportPanel`은 같은 모양의 작은 단계 표시기(`HandoffStageIndicator`,
아래 컴포넌트 계획 참고)를 헤더 아래 공통으로 단다 — 지금 이 패널이 전체 흐름의
어디인지, 이 패널의 **주 동작**이 무엇인지 한눈에 보이게 한다. 주 동작은 패널마다
하나로 좁힌다(`bg-primary` 계열 강조 버튼 하나, 나머지는 보조):

| 패널 | 주 동작 |
|---|---|
| TicketPanel | "에이전트에 전달"(웨이브 요청 대기 중이 아닐 때) |
| ExportPanel | "결과 폴더 ZIP 내려받기"(오류 없이 준비됐을 때) |

### 공통 패턴 — 세 곳(NL 입력창·TicketPanel·ExportPanel)에 반복한다

1. **전달할 지시 복사.** 사람이 에이전트 세션에 그대로 붙여 넣을 수 있는 한
   문단을 "복사" 버튼과 함께 보여준다. 경로·스킬 이름은 실제 프로토콜 상수에서
   만든다(`src/features/editor/ui/agentHandoff.ts`, 아래 "구현 계획" 참고) —
   `docs/14-getting-started.md` 4·5절의 지시문과 같은 내용을 같은 소스에서
   끌어온다. 어느 에이전트(Claude Code/Codex)를 쓰는지 GUI는 모르므로 설치
   위치(`.claude/skills/` 또는 `.agents/skills/`)를 특정하지 않고 스킬 이름만
   말한다.
2. **작업공간 표시.** `workspaceServer.ts`의 `/__vs/status`가 이미 작업공간
   절대 경로(`root`)를 응답에 담아 보내고 있는데, 클라이언트(`isWorkspaceAvailable`)
   가 지금 이 값을 버린다. 꺼내 써서 "현재 작업공간: `{root}`"를 보여준다 —
   사용자가 엉뚱한 터미널에서 에이전트를 띄워 요청 파일을 못 찾는 사고를 줄인다.
3. **기술 경로/JSON은 `<details>` 뒤로.** 원시 파일 경로·요청 ID·에러 JSON은
   기본으로 접혀 있고 "자세히" 토글로만 펼친다. 제품 언어 문장이 항상 먼저
   보인다.
4. **요청 상태 + 다음 행동을 한 줄로.** 상태별 문구는 아래 표 참고. 각 문구는
   "지금 무슨 일이 있었는지"와 "다음에 뭘 해야 하는지"를 한 문장에 담는다.

### 상태별 문구·활성 조건·포커스 이동

#### NaturalLanguageBar (`shown.kind`)

| 상태 | 문구 | 버튼/활성 조건 | 포커스 |
|---|---|---|---|
| `pending` | "에이전트 응답 대기 중 — 아직 에이전트에게 지시를 전달하지 않았다면 아래 지시를 복사해 붙여 넣으세요." + [지시 복사] [자세히] [취소] | 복사 버튼 항상 활성. 입력칸·요청 버튼은 `disabled` 유지(기존과 동일) | 변경 없음(기존처럼 입력칸 비활성, 별도 이동 없음) |
| `confirmation` | 기존 유지(배경 겹 변경 확인) | 기존 유지 | 기존 유지 |
| `error` | 기존 유지(에러 메시지) + timeout류 메시지는 "자세히"로 원시 경로 이동 | 기존 유지 | 기존 유지 |
| `success` | 기존 유지 | 기존 유지 | 기존 유지 |

지시 복사 문구(`buildNlAgentInstruction`):
> `visual-spec-nl-response` 스킬을 읽고 현재 `.visual-spec/runtime/nl-request.json`에
> 응답해 줘. 요청의 ID·범위를 지키고, 문서 파일을 직접 수정하지 말고 그 스킬의
> Command 응답 형식으로 작성해 줘.

#### TicketPanel

| 상태 | 판정 | 문구 | 주 동작 활성 조건 | 포커스 |
|---|---|---|---|---|
| 티켓 없음 | `tickets.length === 0` | "생성할 구현 티켓이 없습니다. 캔버스에 화면을 구성한 뒤 다시 생성하세요." | — | — |
| 낡음 | `isStale` | "화면이 바뀌었습니다. 현재 스펙으로 티켓을 다시 생성해야 전달할 수 있습니다." | "에이전트에 전달" 비활성 | "다시 생성" 버튼에 포커스(패널이 낡음으로 전환되는 렌더 직후) |
| 작업공간 없음 | `workspaceAvailable === false` | "작업공간에 연결돼 있지 않습니다. `npx visual-spec`으로 띄운 개발 서버에서만 에이전트에 전달할 수 있습니다." | 전달 버튼 자체를 숨김(기존과 동일) | — |
| 전달 전 | `!running && !isStale && readyWave.length > 0` | "웨이브 {n}개 티켓이 전달 준비됨. 작업공간: `{root}`." + 지시 복사 | "에이전트에 전달" 활성 | — |
| 전달됨/대기 | `running` | "에이전트 응답 대기 중({경과초}초) — 아직 전달하지 않았다면 지시를 복사해 에이전트에 붙여 넣으세요." + [지시 복사] [자세히] | "중지" 활성(기존 버튼이 라벨만 바뀌지 않고 그대로 전환) | 버튼을 누른 사용자의 포커스는 그대로 그 버튼에 남음(새로 이동하지 않음 — 버튼이 "전달"→"중지"로 라벨만 바뀌는 같은 엘리먼트라 자연히 유지됨) |
| 실패 | `runError !== null` | runError를 그대로 보여주되, timeout 메시지는 "{N}초 동안 응답이 없었습니다. 에이전트가 요청을 처리했는지 확인한 뒤 다시 전달하세요."로 다듬고 원시 경로는 "자세히"로 | "에이전트에 전달" 다시 활성 | — |
| 전부 완료 | `tickets.every(done)` | "모든 티켓이 완료됐습니다. 다음: Export에서 결과를 확인하세요." + [Export 열기] 링크(= `handleExportCode`) | — | — |

지시 복사 문구(`buildTicketAgentInstruction`):
> `visual-spec-ticket-response` 스킬과 그 스킬이 참조하는 `visual-spec-to-react`
> 지침을 읽고, 현재 `.visual-spec/runtime/ticket-request.json`의 한 웨이브를
> 처리해 줘. 요청된 파일을 실제로 생성·확인한 뒤 결과 응답을 써 줘. 수행한
> 검증과 미실행 검증을 구분해 줘.

#### ExportPanel

| 상태 | 문구 | 주 동작 활성 조건 |
|---|---|---|
| `no-workspace` | 기존 유지("작업공간에 연결돼 있지 않습니다…") | — |
| `scanning` | 기존 유지("훑는 중…") | — |
| `idle` | 기존 유지 + "다시 검사" 강조 | "다시 검사" |
| `ready`, `fileCount === 0` | "아직 생성된 코드가 없습니다. 이전 단계(에이전트 전달)에서 티켓을 처리하면 여기서 검증할 수 있습니다." + [구현 티켓 열기] 링크 | — |
| `ready`, `errorCount > 0` | 기존 Summary 유지, 오류 목록 그대로 | "ZIP 내려받기" 활성(강조 없이 중립 스타일) — `fileCount > 0`이면 오류가 있어도 받을 수 있다(기존 동작, #283에서 안 바꿈) |
| `ready`, 오류 없음 | 기존 Summary 유지 | "ZIP 내려받기" 활성·강조(`bg-primary`) |

`errorCount > 0`일 때 내려받기 자체를 막지는 않는다 — 그건 이 PR 이전부터 있던
동작이고(검증 오류가 있어도 사람이 직접 고치려고 받아볼 수 있어야 한다), #283은
문구·구조만 다루고 기존 동작은 바꾸지 않는다(위 "범위 밖" 참고). 강조색을
빼는 것으로 "이 상태가 덜 준비됐다"는 신호만 준다.

### 컴포넌트 계획

- `src/features/editor/ui/agentHandoff.ts` — 순수 함수.
  - `buildNlAgentInstruction(): string`
  - `buildTicketAgentInstruction(): string`
  - 둘 다 `nlProtocol.ts`/`ticketProtocol.ts`의 경로 상수를 템플릿 리터럴로
    끼워 넣는다 — 문자열을 또 하드코딩하지 않는다. 인자가 없는 이유: 요청 ID는
    쓰기 시점에야 생기고, 지시문은 "현재 요청"을 가리키는 일반형 문장이라 ID를
    몰라도 된다(`docs/14`의 지시문도 ID를 넣지 않는다).
- `src/features/editor/ui/copyToClipboard.ts` — `navigator.clipboard.writeText`
  를 감싸고 실패 시 `false`를 돌려주는 작은 함수(보안 컨텍스트가 아니거나
  권한이 없는 드문 경우를 위함). 호출부가 "복사됨"/"복사 실패" 상태를 2초
  보여주고 되돌린다.
- `src/features/editor/ui/workspaceClient.ts` — `isWorkspaceAvailable`가 버리던
  응답 바디를 읽어 `root`를 함께 캐싱하는 `getWorkspaceRoot(): Promise<string | null>`
  를 추가한다(기존 함수 시그니처는 바꾸지 않는다 — 호출부가 많다).
- `HandoffStageIndicator` — `TicketPanel`·`ExportPanel`이 공유하는 작은 가로
  단계 표시기. `src/features/editor/ui/HandoffStageIndicator.tsx`.

## 구현 메모

설계대로 구현했고, 자체 code-review로 설계와 어긋난 부분 네 곳을 더 고쳤다
(아래 "자체 code-review 대응" 참고). 추가로 정리한 것:

- `MenuBar.tsx`의 "구현 티켓"·"Export Code" 항목이 각각 패널을 여는 로직
  (스토어 `open`/`compile` 호출 + 패널 토글)을 직접 들고 있었다. `TicketPanel`
  ("모든 티켓 완료" 다음 행동)·`ExportPanel`(생성된 코드 없음일 때 다음
  행동)도 같은 동작이 필요해져서, `openTicketPanel.ts`·`openExportPanel.ts`로
  뽑아 셋이 같이 쓴다 — 중복해서 적지 않는다.
- `CopyButton`은 복사 상태(복사됨/복사 실패)를 2초 보여주고 되돌리는 타이머
  로직을 `NaturalLanguageBar`·`TicketPanel`이 공유한다.

## 자체 code-review 대응 (2026-10-09)

커밋(`f23ecbb`) 직후 `/code-review`를 돌려 네 건을 찾아 고쳤다.

1. **실패 상태에서 원시 경로가 아예 사라짐.** `nlAgentClient.ts`·
   `ticketAgentClient.ts`의 timeout 메시지에서 원시 경로를 빼면서 "패널이
   자세히로 보여준다"고 가정했는데, `NaturalLanguageBar`의 `error` 분기와
   `TicketPanel`의 `runError` 분기는 `pending`/`running` 분기에만 있던
   `<details>`를 공유하지 않았다 — 실패하면 경로를 볼 방법이 아예 없어지는
   회귀였다. `TicketHandoffDetails`/새로 뽑은 `NlHandoffDetails`를 두 실패
   분기에도 렌더하도록 고쳤다.
2. **"모든 티켓 완료"가 `isStale`을 안 봄.** 티켓을 전부 수동으로 `완료`로
   바꾼 뒤 캔버스를 편집하면 `isStale`이 켜지는데, `allDone`은 티켓
   상태만 보고 계산돼 "화면이 바뀌었습니다" 배너와 "모든 티켓이 완료됐습니다
   → Export로" 안내가 동시에 뜰 수 있었다. `allDone && !isStale`로 좁혔다.
3. **티켓이 0개일 때 안내문이 사실과 다름.** 위 네 조건이 전부 거짓이 되는
   유일한 실제 상황이 "티켓 자체가 없음"인데, 그때 마지막 fallback이 "의존
   중인 선행 티켓이 끝나야…"라고 말해 버그처럼 보였다. 본문의 "생성할 구현
   티켓이 없습니다" 안내와도 모순됐다. `tickets.length === 0`이면 푸터에
   아무것도 안 그리도록 분기를 추가했다.
4. **설계 문서와 실제 ZIP 버튼 동작이 어긋남.** 설계 표는 "오류 있으면
   비활성"이라고 적었지만, 실제 구현(과 이 PR 이전 동작)은 오류가 있어도
   다운로드를 막지 않는다 — 검증 오류가 있어도 사람이 직접 고치려고 받아볼
   수 있어야 하고, #283은 "문구·구조만 다루고 기존 동작은 안 바꾼다"는
   범위였다. 코드가 아니라 **문서를 실제 동작에 맞춰** 고쳤다(위 "상태별
   문구·활성 조건" ExportPanel 표 참고) — 다운로드를 막는 쪽은 범위 밖의
   새 제약이라 채택하지 않았다.

## 리뷰 대응 (2026-10-09, 커밋 7ef88a9 검토)

팀원이 P2 두 건을 남겼다.

1. **Export의 "구현 티켓 열기"가 패널을 전환하지 않는다.** `EditorLayout.tsx`
   는 `showExport`·`showTickets`가 둘 다 켜져 있으면 Export를 우선
   렌더링한다(`showExport ? ExportPanel : showTickets ? TicketPanel : ...`).
   `openTicketPanel()`은 `ticketStore.isOpen`만 켜고 `exportStore.isOpen`은
   안 건드려서, Export가 열린 채로 그 버튼을 눌러도 화면은 그대로 Export이고
   뒤에서 티켓 계획만 다시 생성됐다 — 클릭이 눈에 보이는 효과가 없었다.
   `openTicketPanel()`이 Export가 열려 있으면 먼저 닫도록 고쳤다(반대 방향인
   `openExportPanel()`은 안 건드렸다 — Export가 우선순위를 가지므로 티켓
   패널을 안 닫아도 바로 보이고, "Export를 닫으면 티켓 패널로 돌아간다"는
   `EditorLayout.tsx` 주석이 밝힌 의도된 동작이다). `test/panel-handoff.test.ts`
   로 고정했다 — 수정 전 코드로 되돌려 이 테스트가 실제로 실패하는 것까지
   확인한 뒤 복구했다.
2. **timeout 뒤 "지시 다시 복사"가 재시도를 보장하지 않는다.** timeout이면
   `ticketAgentClient.ts`/`nlAgentClient.ts`의 폴링 루프는 이미 끝났고 요청
   잠금도 풀렸다 — GUI는 더 이상 응답을 기다리지 않는다. 그 상태에서 지시를
   다시 복사해 에이전트에 줘도, 에이전트가 옛 요청 파일을 처리해 응답을 써도
   GUI는 그 응답을 읽을 리스너가 없어 받지 못한다. `TicketPanel`의 실패
   분기에 있던 "지시 다시 복사" 버튼과 `NaturalLanguageBar`가 애초에 복사
   버튼이 없던 것(지적대로 실패 상태에서 복사 수단 자체가 없었다) 둘 다,
   **먼저 GUI의 전달/요청 버튼을 다시 눌러 새 요청을 만들어야 복사가 뜻이
   있다**는 순서를 안 지키고 있었다. 자동 재시도 구조를 새로 만들지 않고
   (리뷰도 그렇게 요청했다), 두 실패 분기의 문구를 "위쪽 버튼을 다시 눌러
   새 요청을 만든 뒤 지시를 전달하라"로 바꾸고 `TicketPanel`의 선복사
   버튼은 지웠다 — 새 요청을 만들면 `running`/`pending` 분기로 넘어가고,
   거기 있는 복사 버튼이 그때는 실제로 뜻이 있다. `TicketPanel`의 "에이전트에
   전달" 헤더 버튼은 timeout 뒤 `revertToPending`이 해당 티켓을 `pending`
   으로 되돌려 자동으로 다시 활성화된다 — 별도 버튼을 새로 안 만들어도 된다.
   `NaturalLanguageBar`는 에러 상태에서도 입력칸 문구가 안 지워져 있어 "요청"
   을 다시 누르면 같은 내용으로 새 요청이 된다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한, 무관)/1552개
통과/1개 건너뜀 — 신규 `test/panel-handoff.test.ts` 2개가 더해졌다. 이
테스트는 `ui/exportGeneratedCode.ts`(DOM `document`/`fetch`)를 거치는
`exportStore`를 거치므로 `test/ticket-runner.test.ts`와 같은 이유로
`tsconfig.uitest.json`(DOM 타입)에 넣고 `tsconfig.node.json`에서는 뺐다.

## 자체 code-review 대응 2차 (2026-10-09, 커밋 46403b7 이후)

리뷰 대응을 push하기 전에 `/code-review`를 한 번 더 돌려 다섯 건을 고쳤다.

1. **재전달 안내가 모든 실패에 똑같이 붙었다.** 바로 앞 라운드에서 추가한
   "위쪽 버튼을 다시 눌러 새 요청을 만들라"는 문구를 `NaturalLanguageBar`·
   `TicketPanel`의 **모든** `error`/`runError` 상태에 붙였는데, 그 문구가
   맞는 경우는 timeout(폴링이 끝나고 요청 잠금도 풀린 경우)뿐이다. 작업공간
   연결 끊김·다른 탭 잠금·Command 검증 실패 같은 다른 원인에는 같은 문구가
   엉뚱한 해결책을 가리킨다. `Feedback`(NL)·`ticketStore`(티켓)에
   `retryable`/`runErrorRetryable` 플래그를 추가해 timeout일 때만(
   `outcome.kind === "timeout"`) true로 세우고, 문구도 그 조건에서만 보여준다.
2. **`TicketPanel`이 `ticketStatus.isAllDone`을 안 쓰고 같은 로직을 또 적었다.**
   `isAllDone`은 이미 있던(이번 PR이 만들지 않은) 공유 헬퍼인데 아무도 안
   쓰고 있었다 — `TicketPanel`도 `tickets.length > 0 && tickets.every(...)`을
   직접 적었다. 게다가 `isAllDone([])`은 `Array.every`의 공허 참 때문에
   `true`를 돌려주는 잠재 버그가 있었다(티켓이 하나도 없는 걸 "전부 완료"로
   오판). 헬퍼 자체를 `tickets.length > 0 &&` 가드로 고치고, `TicketPanel`은
   그 헬퍼를 쓰도록 바꿔 중복을 없앴다. `test/ticket-status.test.ts`에 빈
   배열 케이스를 추가했다.
3. **"자세히" 패널이 `.visual-spec/`를 하드코딩했다.** `agentHandoff.ts`는
   "경로가 바뀌면 문서와 GUI가 같이 바뀐다"며 `WORKSPACE_DIR_NAME` 상수를
   쓰는데, 같은 라운드에 추가한 `NlHandoffDetails`·`TicketHandoffDetails`는
   정작 리터럴 문자열 `.visual-spec/`를 그대로 적어 뒀다. 둘 다
   `WORKSPACE_DIR_NAME`을 쓰도록 고쳤다.
4. **`CopyButton`이 언마운트 레이스를 안 막았다.** 클립보드 권한 대기 등으로
   `copyToClipboard`가 늦게 끝나는 사이 패널이 닫히면, 사라진 컴포넌트에
   `setFeedback`을 불러 React 경고가 난다. 같은 PR의 `TicketPanel` 작업공간
   확인 effect는 이미 `cancelled` 플래그로 이 레이스를 막고 있었다 — 같은
   패턴(`mountedRef`)을 `CopyButton`에도 더했다.
5. **`workspaceClient.ts`의 캐시 변수 두 개(`available`·`cachedRoot`)가 손으로
   맞춰야 했다.** 한쪽만 갱신하는 수정이 나중에 들어오면 둘이 어긋날 수
   있었다. `/__vs/status` 응답 하나를 캐시하는 변수(`cachedStatus`) 하나로
   합치고, `isWorkspaceAvailable`·`getWorkspaceRoot` 둘 다 그 결과에서
   파생하도록 다시 짰다 — 공개 동작(캐싱 규칙·반환 타입)은 그대로다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한, 무관)/1553개
통과/1개 건너뜀 — `test/ticket-status.test.ts`에 추가한 빈 배열 케이스 1개가
늘었다.

## 리뷰 대응 2차 (2026-10-09, 커밋 67f1e4a 검토) — StrictMode에서 mountedRef가 영영 false로 남음

팀원이 P2 한 건을 남겼다 — 앞선 라운드에서 `CopyButton.tsx`에 더한 "복사 중
언마운트 레이스 방지" effect가 `cleanup`에서만 `mountedRef.current = false`로
두고 `setup`에서 `true`로 되돌리지 않았다. `src/main.tsx`가 루트를
`<StrictMode>`로 감싸는데, React 18의 StrictMode는 **개발 모드에서 모든
effect를 setup → cleanup → setup으로 한 번 더 왕복시킨다.** 그 왕복의 첫
cleanup이 플래그를 끄고, 그걸 켜 줄 코드가 setup에 없으니 두 번째 setup이
지나간 뒤에도 계속 꺼진 채로 남는다 — 즉 컴포넌트는 멀쩡히 마운트돼 있는데
`isMounted()`에 해당하는 값은 영영 "언마운트됨"이다. 그러면 `handleClick`의
`if (!mountedRef.current) return;`가 매번 조기 반환해 "복사됨"/"복사 실패"
표시가 **한 번도 뜨지 않는다** — 클립보드 쓰기 자체는 되는데 사용자는 성공도
실패(권한 거절 등)도 알 길이 없다. `bin/visual-spec.mjs`로 띄우는 `npx
visual-spec`도 같은 Vite 개발 서버(= 같은 StrictMode)라 테스트 환경이 아니라
실사용 경로에서도 그대로 터지는 지적이었다. (#314 이후 CLI 기본 경로는 React production이라
StrictMode 이중 실행은 `pnpm dev`·`VISUAL_SPEC_REACT_DEV=1`에서만 일어난다. 가드는 그대로 둔다.)

**원인.** "마운트 상태 추적"을 React 컴포넌트 안의 `useRef(true)` + cleanup만
있는 `useEffect`로 짰다. 이 패턴 자체가 StrictMode를 가정하지 않은 흔한
실수다 — setup이 "아무것도 안 하고 cleanup만 등록"하는 모양이라, 왕복의
의미(다시 마운트됐다)를 표현할 자리가 없었다.

**수정.** 마운트 상태 추적을 React와 무관한 작은 값 객체
(`src/features/editor/ui/mountedGuard.ts`의 `createMountedGuard`)로 뽑았다 —
`setup()`/`cleanup()`/`isMounted()` 세 메서드뿐이고, `useEffect`는 그 둘을
부르는 배선만 한다:

```ts
useEffect(() => {
  guardRef.current.setup();        // 최초 마운트 + StrictMode의 재마운트 둘 다
  return () => {
    guardRef.current.cleanup();
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  };
}, []);
```

React를 끌어들이지 않는 순수 객체로 뽑은 이유는 정확히 이 리뷰가 쓴 방식대로
검증하기 위해서다 — "hook/lifecycle 모의 하네스"를 직접 짜지 않고도,
`setup`/`cleanup`을 원하는 순서로 그냥 호출해 StrictMode의 왕복을 그대로
재현할 수 있다.

### 회귀 테스트 — `test/mounted-guard.test.ts`

다섯 가지를 고정했다: setup 전엔 unmounted, setup 직후엔 mounted, cleanup
뒤엔 unmounted, **setup→cleanup→setup(StrictMode 왕복) 뒤엔 다시
mounted**(수정 전엔 여기서 `false`로 남는 게 버그였다), 그 왕복 뒤 진짜
cleanup(마지막 언마운트)하면 다시 unmounted. 이 테스트는 수정 전 코드가
가진 "cleanup만 있고 setup이 없는" 모양을 `createMountedGuard()`가
`let mounted = false`로 시작해 `setup()`을 안 부르면 영영 `false`인 것과
같은 결로 포착한다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한, 무관)/1558개
통과/1개 건너뜀 — `test/mounted-guard.test.ts` 5개가 더해졌다.

## 검증

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한, 무관)/1550개
통과/1개 건너뜀 — 신규 `test/agent-handoff.test.ts` 3개가 더해진 수치다.
`buildNlAgentInstruction`·`buildTicketAgentInstruction`이 실제 프로토콜 경로
상수를 담는지, 설치 위치(`.claude/`·`.agents/`)를 특정하지 않는지를 고정했다
— 둘 다 순수 함수라 결정적으로 테스트할 수 있다.

**라이브 브라우저 검증은 이번에 완료하지 못했다.** `pnpm dev`로 띄운 뒤
"빈 캔버스에서 시작"으로 에디터에 들어가는 전환이 이 세션의 Chrome 확장에서
반복적으로(여러 차례 재시도) 45초 이상 `Runtime.evaluate`까지 멈춰 세웠다 —
스크린샷뿐 아니라 임의의 JS 실행도 막혀 페이지가 진짜로 응답을 멈춘 것으로
보인다. `force` 재진입으로 매번 복구는 됐지만 그 다음 진입에서 다시 같은
증상이 나타났다. 이 증상은 `#276`(이 작업과 무관한 이전 이슈) 세션에서도
똑같이 재현된 적이 있어 이번 변경이 원인일 가능성은 낮다고 판단했다 — 특히
`TicketPanel`/`ExportPanel`은 기본으로 닫혀 있어 에디터 최초 진입 시
마운트조차 되지 않고, `NaturalLanguageBar`는 마운트되지만 `pending` 상태가
아닌 한(최초 진입 시 `feedback.kind === "none"`) 이번에 바뀐 렌더 분기를
전혀 타지 않는다. 그래도 **코드만으로 확정할 수는 없는 부분**이므로, 다음
세션에서 브라우저로 직접 아래를 확인해야 한다:

- [ ] `NaturalLanguageBar`에서 pending 상태 진입 → "지시 복사" 클릭 →
      실제 OS 클립보드에 `buildNlAgentInstruction()` 텍스트가 들어가는지
- [ ] `TicketPanel`에서 웨이브 전달 전/전달 중/완료 세 상태의 문구·버튼이
      표의 그대로 보이는지, "작업공간: …" 줄에 실제 절대 경로가 뜨는지
      (`/__vs/status`의 `root` 필드가 정말 채워져 오는지)
- [ ] `ExportPanel`에서 `fileCount === 0`일 때 "구현 티켓 열기" 링크가
      `TicketPanel`을 실제로 여는지
- [ ] `HandoffStageIndicator`가 두 패널에서 같은 모양으로 보이는지(다크
      테마 포함)

대신 이번에는 ① 타입 검사·lint·빌드로 정적 정합성을 확인하고, ②
`agentHandoff.ts`를 경로 상수와 직접 비교하는 단위 테스트로 지시문 내용을
고정하고, ③ 변경된 파일 전체를 다시 읽어 JSX 구조(특히 `<p>`→`<div>` 전환이
`<details>`를 안전하게 담는지, 조건부 렌더 분기가 모든 상태를 빠짐없이
덮는지)를 수작업으로 검토하는 선에서 마무리했다.

## 자체 code-review 대응 3차 (2026-10-07, 커밋 45b9621 이후)

StrictMode 수정을 커밋한 뒤 `/code-review`를 한 번 더 돌려 네 건을 찾아 그중
둘(1·2)은 문구 교정, 나머지 둘(3·4)은 코드 수정으로 고쳤다.

1. **`TicketPanel`의 마지막 fallback 문구가 "의존 때문"으로 단정했다.**
   `readyWave.length === 0`이 되는 경우는 "의존 중인 선행 티켓이 남음" 외에도
   "의존이 없는 티켓이 실패함"이 있다(실패는 `pending`이 아니라서
   `readyTickets`에서 바로 빠진다) — 그런데 문구는 전자만 가리켰다. "의존 중인
   선행 티켓이 남아 있거나 실패한 티켓이 있는지 확인하세요"로 원인을 하나로
   단정하지 않게 고쳤다.
2. **`STALE_TICKET_MESSAGE`에 옛 "실행" 표현이 남아 있었다.** 이 PR이 버튼·
   안내 문구를 전부 "실행"에서 "전달"로 바꿨는데(#219 — GUI는 에이전트를
   실행하지 않는다), `ticketRunner.ts`의 이 상수만 "…다시 생성해야 **실행할**
   수 있습니다"로 안 바뀌어 있었다. "…다시 생성해야 **전달할** 수 있습니다"로
   맞췄다. 이 문자열을 그대로 assert하는 테스트는 없어 안전하게 바꿀 수 있었다.
3. **`CopyButton`에 클릭 순서를 가르는 가드가 없었다.** `copyToClipboard`가
   끝나는 순서가 클릭한 순서와 다를 수 있다(예: 클립보드 권한 프롬프트 등으로
   첫 호출이 느려짐) — 느린 첫 호출이 더 빠른 두 번째 클릭의 결과를 나중에
   덮어쓸 수 있었다. 클릭마다 늘어나는 토큰(`clickTokenRef`)을 `await` 전에
   잡아 두고, `await` 뒤 그 토큰이 아직 "가장 최근 클릭"인지(`isMounted()`
   확인과 같은 자리) 확인해서 아니면 `setFeedback`을 건너뛴다 —
   `ticketStore.ts`의 `generation` 카운터와 같은 패턴이다.
4. **`TicketHandoffDetails`(`TicketPanel.tsx`)·`NlHandoffDetails`
   (`NaturalLanguageBar.tsx`)가 거의 같은 모양을 각자 갖고 있었다.** 둘 다
   "요청/응답 경로를 `<details>` 뒤에 접어 보여준다"는 같은 목적이고, 차이는
   경로 상수와 `workspaceRoot` 표시 여부뿐이었다. `src/features/editor/ui/HandoffDetails.tsx`
   로 뽑아 `requestPath`·`responsePath`·(선택) `workspaceRoot` props로
   받게 하고, 두 파일의 로컬 정의를 지우고 그 컴포넌트를 쓰도록 바꿨다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한 등, 무관)/1558개
통과/1개 건너뜀 — 이번 라운드는 새 테스트를 추가하지 않았다(문구 교정 2건은
assert 대상이 없었고, 레이스 가드·컴포넌트 추출 2건은 기존 동작을 그대로
유지하는 리팩터라 기존 테스트가 그대로 회귀를 잡아준다).

## 자체 code-review 대응 4차 (2026-10-07, 커밋 d843b6b 이후)

`/code-review`를 한 번 더 돌려 세 건을 찾아 고쳤다.

1·2. **"재시도해도 되는 실패"의 판정이 timeout만 보고 있었다.** `ticketAgentClient.ts`·
   `nlAgentClient.ts`는 잠금 관련 실패를 두 가지 전혀 다른 상황에서 똑같이
   `kind: "busy"`로 돌려주고 있었다 — (a) 요청을 쓰기 **전**, 다른 탭의 요청이
   아직 안 끝나 잠금 자체를 못 잡은 경우(요청 파일을 안 썼다, "그 요청이 끝나길
   기다리라"가 맞는 안내)와, (b) 요청을 **쓴 뒤** 폴링하다 연장에 실패해 잠금을
   잃은 경우(요청 파일은 이미 썼는데 이제 아무도 응답을 기다리지 않는다 — 구조상
   timeout과 똑같다). `runErrorRetryable`/`retryable`은 `outcome.kind ===
   "timeout"`만 봐서 (b)에는 "다시 전달하세요" 안내가 안 붙었는데, (b)의 메시지
   자체가 이미 "다시 요청하세요"라고 말하고 있어 모순이었다. (b)를 별도
   `kind: "lockLost"`로 분리하고(타입 정의에 주석으로 (a)와의 구분 이유를
   남겼다), `runErrorRetryable`/`retryable` 조건에 `|| outcome.kind ===
   "lockLost"`를 더했다. `test/agent-request-lock.test.ts`의 해당 테스트가
   옛 `kind: "busy"` 기대값을 그대로 두고 있어 같이 고쳤다(이 이름 변경이
   의도한 동작 변화이므로 테스트를 따라 수정하는 것이 맞다 — 되돌리는 게
   아니다).
3. **"지시 미리 복사" 버튼이 파일을 쓰기도 전에 지시문을 내줬다.** `TicketPanel`
   의 "웨이브 N개 전달 준비됨" 분기(아직 "에이전트에 전달"을 안 누른 상태)에
   있던 `지시 미리 복사` 버튼은 `buildTicketAgentInstruction()`을 그대로
   복사했는데, 그 문구는 "**현재** `ticket-request.json`을 처리해 줘"라고
   말한다. 이 분기에서는 그 파일이 아직 안 쓰였거나(최초 웨이브) 이전 웨이브의
   잠금 해제로 이미 지워진 뒤다 — 지금 복사해 에이전트에 먼저 붙여 넣으면
   에이전트가 없는 파일을 찾는다. 이 버튼을 지웠다 — "에이전트에 전달"을
   눌러 파일을 쓴 뒤에만(= `running` 분기) 복사 버튼이 뜻이 있고, 그 버튼은
   이미 있다.

### 회귀 확인

`pnpm run typecheck` · `pnpm run lint` · `pnpm run build` 모두 통과했다.
`pnpm test`는 기존과 동일한 17개 실패(Windows 심링크·권한 등, 무관)/1558개
통과/1개 건너뜀 — `test/agent-request-lock.test.ts`의 기존 테스트 1개를 새
`kind: "lockLost"`에 맞춰 고쳤을 뿐 테스트 수는 그대로다.

## 범위 밖

- 실제 진행 로그·재연결·재시도 런타임 구현은 #284(F07)로 분리한다. 이 작업은
  문구·구조·활성 조건만 다루고 `ticketRunner.ts`/`nlAgentClient.ts`/
  `ticketAgentClient.ts`의 폴링·타임아웃·취소 **동작 자체**는 바꾸지 않는다
  (메시지 문구만 다듬는다).
- 스키마·Command·Ticket 계약은 건드리지 않는다. `agentHandoff.ts`는 기존
  프로토콜 상수를 읽기만 한다.
- 에이전트 자동 실행(#219의 B/C안)은 여전히 채택하지 않는다 — 이 작업은 A안
  (수동 실행) 위에서 안내만 개선한다.
