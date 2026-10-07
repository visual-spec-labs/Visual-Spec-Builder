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
| `ready`, `errorCount > 0` | 기존 Summary 유지, 오류 목록 그대로 | "ZIP 내려받기" 비활성 |
| `ready`, 오류 없음 | 기존 Summary 유지 | "ZIP 내려받기" 활성·강조(`bg-primary`) |

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

설계 그대로 구현했다. 추가로 정리한 것:

- `MenuBar.tsx`의 "구현 티켓"·"Export Code" 항목이 각각 패널을 여는 로직
  (스토어 `open`/`compile` 호출 + 패널 토글)을 직접 들고 있었다. `TicketPanel`
  ("모든 티켓 완료" 다음 행동)·`ExportPanel`(생성된 코드 없음일 때 다음
  행동)도 같은 동작이 필요해져서, `openTicketPanel.ts`·`openExportPanel.ts`로
  뽑아 셋이 같이 쓴다 — 중복해서 적지 않는다.
- `CopyButton`은 복사 상태(복사됨/복사 실패)를 2초 보여주고 되돌리는 타이머
  로직을 `NaturalLanguageBar`·`TicketPanel`이 공유한다.

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

## 범위 밖

- 실제 진행 로그·재연결·재시도 런타임 구현은 #284(F07)로 분리한다. 이 작업은
  문구·구조·활성 조건만 다루고 `ticketRunner.ts`/`nlAgentClient.ts`/
  `ticketAgentClient.ts`의 폴링·타임아웃·취소 **동작 자체**는 바꾸지 않는다
  (메시지 문구만 다듬는다).
- 스키마·Command·Ticket 계약은 건드리지 않는다. `agentHandoff.ts`는 기존
  프로토콜 상수를 읽기만 한다.
- 에이전트 자동 실행(#219의 B/C안)은 여전히 채택하지 않는다 — 이 작업은 A안
  (수동 실행) 위에서 안내만 개선한다.
