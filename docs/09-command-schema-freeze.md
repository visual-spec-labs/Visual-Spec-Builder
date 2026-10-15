# 09. Command Schema v0.1 확정 및 동결

동결 시작: 2026-09-19

## 정본과 공개 표면

런타임 정본은 `src/features/editor/command/command.schema.json`이다. `createNode`,
`updateNode`, `deleteNode`, `moveNode`, `setLayout`, `updateScreen` 6종과 이들을 담는
`Transaction`을 v0.1로 고정한다.

```ts
import {
  validateCommand,
  validateTransaction,
  commandJsonSchema,
  type Command,
  type Transaction,
} from "@/features/editor/command";
```

검증기는 예외를 던지지 않고 `{ valid, issues }`를 돌려준다. 자연어 출력처럼 신뢰할 수
없는 JSON은 `validateTransaction`을 통과하기 전 `applyCommand`나 스토어에 넘기지 않는다.

TypeScript 타입은 자동 생성하지 않는다. `CreateNodeCommand.node`와
`SetLayoutCommand.layout`이 동결된 IR 타입을 직접 재사용하고, `update*.value`는 path에
따라 달라 `unknown`이어야 하므로 생성 타입이 더 정확하지 않다. 대신 6종 명령을
`satisfies Command[]`로 컴파일하고 같은 값을 런타임 스키마로 검증하는 테스트를 둔다.

## 검증 경계

- JSON Schema는 명령 종류, 필수/추가 필드, NodeId, createNode의 Node, setLayout의
  Layout, moveNode의 0 이상 정수 index, createNode의 **선택적** 0 이상 정수 index를
  검사한다.
- `updateNode.path`와 `updateScreen.path`는 비어 있지 않은 문자열까지만 검사한다.
  대상 타입과 현재 값에 실제로 쓸 수 있는지는 `editablePath.ts`가 판단한다.
- `value`는 형태 관문에서 제한하지 않는다. path에 맞는 값인지와 적용 결과가 유효한지는
  dry-run 뒤 IR 검증 관문이 판단한다.
- `Transaction.commands`는 1개 이상 100개 이하이다. 빈 자연어 응답과 과도한 작업량을
  형태 관문에서 거부한다.

## 변경 절차

v0.1 변경은 다음을 한 PR에서 함께 수행한다.

1. `command.schema.json` 수정
2. `command/types.ts` 동기화
3. `test/command-schema.test.ts`의 유효/무효 사례 갱신
4. 이 문서에 호환성 영향과 결정 근거 기록
5. `typecheck`, `lint`, 전체 테스트, build 통과

기존 필수 필드 추가, enum 축소, 명령 제거, 의미 변경은 breaking change다. 선택 필드나
새 명령 추가도 소비자가 exhaustive switch를 사용하므로 버전 변경 여부를 먼저 합의한다.

## 변경 이력

### 2026-09-28 — `CreateNodeCommand`에 선택 필드 `index` 추가 (이슈 #193)

**무엇이 바뀌었나.** `CreateNodeCommand`에 `index?: number`(정수, 0 이상 — `moveNode.index`와
같은 제약)를 추가했다. `applyCreateNode`는 `index`가 있으면 `insertChildReference`(기존에
`moveNode`가 쓰던 것과 같은 함수)로 그 위치에 자식을 끼워 넣고, 범위를 벗어나면
`0..children.length`로 clamp한다. **생략하면 지금까지와 똑같이 부모 `children` 끝에
붙는다** — `index`가 `undefined`일 때 `parent.children.length`로 떨어지는 것이
`insertChildReference`의 clamp와 맞물려 예전 append 동작과 완전히 같다.

**호환성 영향 — breaking change 아님.** 선택 필드 추가이고 기본 동작(생략 시 append)이
그대로라, `index`를 모르는 기존 호출부(`store/editorStore.ts`의 `insertNode` →
`ui/importImageFromFile.ts`·`ui/Toolbar.tsx`·`ui/LayerTree.tsx`의 "레이어 추가",
`applyCommand.ts`의 `buildDuplicateCommands`)는 전부 영향받지 않는다. 다만 위 "변경 절차"의
마지막 문단대로 **소비자가 exhaustive switch를 쓴다는 점은 여기서도 해당하지 않는다** —
`index`는 `CreateNodeCommand`의 필드 추가지 새 Command 종류가 아니라 switch 분기 수 자체는
그대로다. 버전(`v0.1`)은 올리지 않는다.

**결정 근거.** `docs/08-natural-language.md` 3.4-(1)이 "삽입 위치를 지정할 수 없다"고
지적한 표현력 공백이다 — 빈 화면 위에서 위→아래로 만드는 생성 경로는 Command 순서가 곧
형제 순서라 필요 없지만(3.3의 `login-screen.json` 재현이 그 증거, 이슈 #183), **이미 채워진
화면 중간에 끼워 넣는 요청**("헤더를 맨 위에 넣어줘")은 지금까지 `createNode` 뒤에
`moveNode`를 붙이는 2단계로만 표현됐다. `MoveNodeCommand.index`가 이미 있는 개념이라
같은 이름·같은 제약·같은 clamp 규칙으로 맞췄다(이슈 #193 본문 "MoveNodeCommand.index와
의미를 맞춘다").

## 반응형 전체 블록 편집 (#223 PR 제안, #245 의존)

현재 상태: 아래 계약은 #247로 병합됐으며 선행 정본 #245도 병합됐다. 향후 계약 변경의 리뷰 규칙은 유지한다.

Command 6종과 `command.schema.json`의 형태는 바꾸지 않는다.
`updateScreen`의 `path: "responsive"`로 검증된 블록 전체를 교체한다. 맵 내부의
`responsive.breakpoints.<id>` 같은 점 경로는 `editablePath`가 거부한다. breakpoint
추가·수정·삭제와 override 편집은 모두 이 명령 하나이므로 Undo 한 단계다.

이 허용 경로 확장도 공개 Command 계약 변경이다. **별도 PR에서 리뷰하며 최소 1명의 팀
승인 없이 병합하지 않는다.** 스키마 #245의 승인·병합을 선행으로 한다.

- `applyUpdateScreen`은 반응형 전체 화면의 스키마·참조·누적 의미를 검증하고 무효이면
  no-op과 이유를 반환한다. 중복 폭이나 잘못된 노드 타입 속성을 성공처럼 적용하지 않는다.
- GUI `setResponsive`는 같은 검증을 먼저 수행해 패널 오류를 보여 준다. 같은 블록을 다시
  쓰면 history가 늘지 않는다. 연속 입력은 기존 `continueEdit` 계약을 따른다.
- 기존 기반 노드 편집도 반응형 블록이 있는 경우 최종 화면을 검사한다. 예를 들어 기반
  border 삭제가 상속 중인 partial border를 무효로 만들면 문서·history를 유지하고 오류를
  알린다. 사용자는 먼저 해당 override를 해제하거나 완전한 객체로 바꿔야 한다.
- 노드/서브트리 삭제는 모든 breakpoint의 해당 ID override도 같은 명령에서 정리한다.
  복제는 새 ID에 원본 override를 함께 복사하고 한 트랜잭션으로 기록한다.
- 기존 클립보드는 노드 기반값만 담는다. 복사·붙여넣기로 breakpoint 정의나 override를
  다른 페이지로 옮기지 않는다. 페이지별 breakpoint 충돌 해소는 이번 범위가 아니다.

미리보기 폭은 별도 뷰 상태다. Command·문서 크기·Undo를 바꾸지 않는다. 폭 경계는
`minWidthPx`를 포함하고, 여러 breakpoint가 맞으면 가장 큰 폭을 편집 대상으로 삼는다.

## Command v0.2 예정 — #265 D10

현재 상태: **예정.** 지금 정본은 위의 v0.1 그대로다. 이 절은 2026-10-13 리더 결정
([#265 결정 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414))을
기록할 뿐이며 `command.schema.json`·`command/types.ts`·테스트를 바꾸지 않는다. 실제 스키마 변경은 #265 S1-3 PR이
위 "변경 절차"대로 한 PR에서 한다. 설계 배경은 [24 §5](24-screen-relations-design.md#5-command검증버전-영향)에 있다.

**무엇이 바뀌나.** #265 S1-1(#355)이 버튼에 선택 필드 `action`(화면 이동·모달 열기·닫기)을 정본에 넣었다.
값을 쓰는 명령은 지금도 있지만, JSON에는 undefined가 없고 `update*.value`는 필수라 **action을 없애는
명령이 없다.** v0.2는 버튼 연결 제거 전용 명령 `removeNodeAction`을 더한다. 새 명령 추가는 소비자의
exhaustive switch를 깨므로 위 "변경 절차"의 마지막 문단대로 버전을 올린다.

| 항목 | 결정(2026-10-13) |
|---|---|
| 새 명령 | `removeNodeAction` — 노드의 action 제거 전용 |
| action 설정 | `updateNode`의 path `action`으로 **전체 객체 교체** |
| action 제거 | `removeNodeAction`으로만. `updateNode`의 null이나 빈 값으로 지우지 않는다 |
| 부분 쓰기 | `action.type`·`action.target` 같은 하위 경로 쓰기는 거부 |
| 버전 | Command 스키마 v0.1 → **v0.2** |
| 구버전 소비자 | v0.2를 모르는 소비자는 **버전 불일치로 거부**한다(조용히 일부만 적용하지 않음) |

**왜 이 방식인가.** 값 쓰기와 삭제 의도를 분리한다. `updateNode`의 null에 삭제 의미를 덧씌우면(RFC 7396
Merge Patch식) 일반 값 쓰기의 의미가 달라지고, 범용 필드 삭제나 임의 JSON Pointer 편집은 필수 필드까지 지울 수
있다. 대안 비교와 공식 자료 대조는 [24 §5·§9](24-screen-relations-design.md#9-공식-자료-대조와-선택-근거)를 따른다.

**S1-3 계약 PR에서 정할 것(지금 미정).**

- `removeNodeAction`의 필드. 24 §5의 `{ "type": "removeNodeAction", "id": "<NodeId>" }`는 설명용 후보다.
- action이 없는 노드에서 제거할 때 no-op으로 둘지 실패로 볼지.
- 버전 불일치를 어디에 표시하고 어떻게 판정할지. 지금 `command.schema.json`에는 버전 필드가 없다.
- S1-1이 넣은 임시 차단(`editablePath.ts`의 kind·action 쓰기 경로, `validate.ts`의 createNode `node.action`) 해제와
  S1-2 프로젝트 검증 코드를 Command 적용 경로(G2·G3)가 잡는지 확인.

2차 instance 생성·분리 명령(#265 S2-3)은 이 결정에 포함되지 않는다. 필요하면 이 문서 절차로 따로 정한다.
병합 조건은 리더 승인 또는 리뷰어 1명 이상 승인이다(2026-10-13 리더 결정).

### S1-3 구현 선행 계약 제안 — 2026-10-15

상태: **리뷰 요청, 런타임 미구현.** #378은 D10 방향을 반영했고 아래 세부까지 확정하지 않았다.
#265 S1-3의 "09 계약 PR 선행"에 따라 이 절을 먼저 리뷰한다. 현재 정본은 v0.1이며,
이 PR의 테스트는 develop `126bad5ed660ac33ded034bad7ce5590846b674d` 소비자의 실제 동작을
고정하는 호환성 조사다. 새 기능 구현·수용 테스트 통과를 뜻하지 않는다.

#### 버전 봉투와 NL 전송

새 외부 Transaction은 아래 모양으로 한다. `version`은 필수 문자열 상수 `"0.2"`,
`commands`는 기존처럼 1–100개이며 추가 필드는 금지한다. Command 한 개의 형태에는
버전을 중복하지 않는다. `validateCommand`는 명령 모양만 검사하므로 외부 입력의
버전 검사를 대신하지 못한다. 신뢰 경계는 반드시 `validateTransaction`부터 시작한다.

```json
{
  "version": "0.2",
  "commands": [{ "type": "removeNodeAction", "id": "loginButton" }]
}
```

- 새 소비자는 누락·`"0.1"`·숫자·알 수 없는 버전을 `/version`의 `version` 오류로 거부한다.
  기대/수신 값과 GUI·`visual-spec skills` 업데이트 안내를 표시하고 적용하지 않는다.
  구 무버전 Transaction을 자동으로 v0.2로 해석하지 않는다.
- 현재 v0.1 정본은 Transaction의 `additionalProperties: false` 때문에 위 `version`을
  **schema 오류로 거부**한다. 배포된 구 소비자의 문구를 새 "버전 불일치" 문구로 바꿀 수는 없다.
  새 명령 없이 기존 updateNode만 든 v0.2 봉투도 거부됨을 구 정본 fixture로 검사한다.
- **NL 규약도 1 → 2로 올린다.** 현재 `parseNlResponse`는 외부 응답을
  `{ commands: body.commands }`로 다시 만들므로 `version`만 추가하면 버전이 사라진다.
  구 GUI가 이미 검사하는 `protocol`을 올려야 기존 명령만 든 새 응답까지 적용 전에 거부한다.
- NL 요청과 성공 응답에 `commandVersion: "0.2"`를 필수로 싣는다. 성공 응답은
  `{ protocol: 2, requestId, commandVersion: "0.2", commands }`이다. 새 parser는
  `{ version: body.commandVersion, commands: body.commands }`를 G1에 넘긴다.
  `requestId`의 stale 검사를 먼저 유지하고, protocol 불일치는 현재처럼 malformed로 끝낸다.
  error 응답도 protocol 2를 요구하되 Command가 없으므로 commandVersion은 검사하지 않는다.
- 새 배포 NL 스킬은 **정확히** protocol 2/commandVersion 0.2 요청만 처리한다.
  구 protocol 1 요청에는 구 GUI가 받을 수 있는 protocol 1 error 응답으로 업데이트를 안내하며
  commands를 만들지 않는다. 새 GUI + 구 스킬은 protocol 1 응답을 거부한다.
  protocol 2를 그대로 돌려주기만 하는 구 스킬도 commandVersion 누락으로 G1에서 거부한다.
- NL 관계 대상 카탈로그·자연어 예제 확장은 S1-10이다. 이번 전송 버전 변경은 D10의
  구 소비자 거부를 위한 최소 변경이다. Ticket 규약·manifest·IR 0.3은 바꾸지 않는다.

| 소비자 / 입력 | 요구 결과 |
|---|---|
| 구 G1 / version 0.2 Transaction(기존 명령만 포함) | 추가 필드 schema 오류, 적용 없음 |
| 구 NL GUI / protocol 2 응답(기존 명령만 포함) | protocol 불일치, 적용 없음 |
| 구 NL GUI / protocol 1 + commandVersion만 추가 | **현재는 통과함.** 이 조합을 새 producer가 만들면 안 됨 |
| 새 G1 / 무버전 또는 다른 버전 Transaction | version 오류, 적용 없음 |
| 새 NL GUI / protocol 1 응답 | protocol 불일치, 적용 없음 |
| 새 NL GUI / protocol 2 + commandVersion 누락/불일치 | G1 version 오류, 적용 없음 |
| 새 NL GUI / protocol 2 + commandVersion 0.2 | G1 → 기존 G2 → 기존 프로젝트 G3 |

#### 직접 agent-edit 전송도 같은 변경에서 이전한다

리뷰 [discussion_r4279197455](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/381#discussion_r4279197455)의
지적을 확인했다. `agent/agentEditProtocol.ts`의 `parseAgentEdit`도 현재
`validateTransaction({ commands: body.commands })`를 호출한다. NL만 이전하면 직접 편집은
새 G1에서 모두 실패하거나, 버전 검사를 우회할 경우 구 GUI가 새 producer의 기존 명령을 받는다.
따라서 **S1-3에서 두 전송과 producer 스킬을 같은 릴리스로 이전**한다. 아래 역시 제안이며 미구현이다.

- `AGENT_EDIT_PROTOCOL_VERSION`을 **1 → 2**로 올린다. `runtime/gui-state.json`,
  `runtime/agent-edit.json`, `runtime/agent-edit-result.json` 모두 protocol 2를 쓴다.
  NL protocol 2와 숫자가 같아도 독립된 전송 계약이며 Ticket/manifest 버전과 무관하다.
- gui-state는 기존 필드에 아래 **필수 capabilities**를 더한다. 명령 이름 목록은 실제 허용한
  7종 전부이며 필드 의미는 Command 0.2 계약을 따른다. 새 producer는 protocol 2,
  capabilities.commandVersion 0.2, 사용할 모든 명령의 지원 여부를 **쓰기 전에** 확인한다.
  capabilities 누락·다른 버전·지원하지 않는 명령이면 편집 파일을 쓰지 않고 업데이트를 안내한다.

```json
{
  "protocol": 2,
  "capabilities": {
    "commandVersion": "0.2",
    "commands": ["createNode", "updateNode", "deleteNode", "moveNode", "setLayout", "updateScreen", "removeNodeAction"]
  }
}
```

위 조각은 새 필드만 보인 것이며 완전한 gui-state가 아니다. 기존 id·stateRevision·updatedAt·
fileName·diskRevision·pageId·selectedId·page·editPath·resultPath는 그대로 필수다.
직접 요청은 아래 모양이다(summary만 선택). 외부 version을 상수로 덮어 G1을 통과시키면 안 된다.

```json
{
  "protocol": 2,
  "commandVersion": "0.2",
  "id": "unique-request-id",
  "baseStateRevision": "revision-read-from-gui-state",
  "pageId": "login",
  "commands": [{ "type": "removeNodeAction", "id": "loginButton" }]
}
```

- parser는 기존 id/형태 검사 뒤 protocol 불일치를 malformed로, commandVersion 누락/불일치를
  `{ version: body.commandVersion, commands: body.commands }`의 G1 version 오류로 거부한다.
  기존 bridge는 둘 다 `status: "invalid"` 결과로 반환한다. 새 결과의 protocol은 2이며
  requestId/status/message/stateRevision/선택 uncertain 계약은 유지한다. 결과에는 commands가
  없으므로 commandVersion을 추가하지 않는다. message에 기대/수신 버전·GUI/스킬 갱신 안내를 담는다.
- 구 GUI는 protocol 2 요청을 기존 명령만 있어도 거부하고 **protocol 1 invalid 결과**를 낸다.
  새 producer는 자기 requestId라도 결과 protocol이 다르면 성공으로 해석하지 않고 버전 불일치로
  종료한다. 자동 downgrade, 재전송, `.visual-spec/specs/` 직접 수정으로의 우회는 금지한다.
- 새 GUI는 protocol 1 요청을 거부한다. protocol 2만 복사한 구 producer도 commandVersion이
  없으면 거부한다. 새 GUI + 새 producer만 두 버전 검사를 통과하며 기존 연결 잠금·상태 revision·
  페이지 확인·중복 요청/재연결 처리·G2/G3·한 번의 Undo·결과 게시 권한을 그대로 거친다.
- 배포 `skills/visual-spec-nl-response/SKILL.md`의 **NL 응답 절과 “대화에서 바로 고치기” 절**,
  예제/실행 스크립트를 함께 이전한다. 직접 경로의 gui-state 읽기 단계에 capability 관문을 넣고,
  protocol 1 GUI에는 파일 쓰기 없이 GUI와 `visual-spec skills` 갱신을 안내한다.
  `skills/visual-spec/SKILL.md`와 `skills/visual-spec-authoring/SKILL.md`의 열린 GUI 경로 안내도
  버전 불일치를 GUI 종료로 오인해 파일 편집으로 넘어가지 않게 맞춘다. 이 계약 PR에서는 배포
  스킬을 먼저 변경하지 않는다(아직 protocol 1인 설치 GUI를 깨뜨리지 않음).

| 직접 경로 조합 | 결과 |
|---|---|
| 구 GUI / protocol 1 + commandVersion 0.2 요청 | **현재 통과함**, 새 producer는 이 조합 금지 |
| 구 GUI / protocol 2 요청(기존 명령만) | malformed → protocol 1 invalid 결과, 적용 없음 |
| 새 GUI / protocol 1 요청 | protocol 불일치 → protocol 2 invalid 결과, 적용 없음 |
| 새 GUI / protocol 2 + commandVersion 누락/불일치 | G1 version 오류 → invalid, 적용 없음 |
| 구 gui-state 또는 capability 누락 / 새 producer | 편집 파일 쓰기 전 중단, 업데이트 안내 |
| 새 GUI / protocol 2 + commandVersion 0.2 요청 | 기존 revision/잠금/G2/G3까지 성공해야 적용 |

구 parser의 실제 수용/거부는 이 PR의 조사 테스트에 추가한다. **구/신 producer 스킬 fixture와
새 GUI 왕복 테스트는 구현 PR의 필수 조건**이다: gui-state capability 게시, 구 요청/누락 버전
거부 시 spec/history 불변, invalid 결과 protocol, 새 정상 요청 Undo/Redo, 구 GUI 결과를 받은
새 producer의 중단, 버전 불일치 시 파일 쓰기/자동 재시도 부재를 검사한다. 현재 테스트가 이
미구현 동작을 이미 보장한다고 주장하지 않는다.

#### action과 kind의 명령 의미

`removeNodeAction`은 `{ type: "removeNodeAction", id: NodeId }`만 받는다. 추가 필드·value·path는
금지한다. 존재하는 button의 action 속성을 실제로 제거하며 null/undefined 속성을 저장하지 않는다.
없는 id, 비button, **action이 없는 button은 이유 있는 no-op**이다. 기존 G2 규칙대로
no-op이 섞인 외부 Transaction 전체를 거부한다. GUI 단일 제거도 history를 늘리지 않는다.
이는 "이미 제거됐으니 성공"이라고 응답하는 멱등 명령과 다른 선택이다.

설정은 `updateNode(path: "action")` 전체 객체 교체다. navigate→close에서 이전 target을
남기지 않는다. null·빈 객체·추가 필드·잘못된 action 형태는 거부한다. `action.type`,
`action.target` 부분 쓰기와 responsive override는 금지한다. createNode의 button action은
형태 검사를 거쳐 허용하되 대상/문맥은 프로젝트 후보 검증으로 확인한다.
`updateScreen(path: "kind")`는 page/modal/widget만 허용하고 기본값 복귀는 명시 `"page"`다.
최소 page·첫 page·유입 action·source close를 깨는 kind 변경은 원본 전체를 유지하고 거부한다.

화면 전용 apply 함수는 프로젝트 대상의 존재/종류를 판단할 수 없다. 기존
`runTransactionGates`의 **프로젝트 전체 G3를 유지**한다. GUI는 그 함수를 자동으로 거치지
않으므로 임시 경로 차단을 해제하는 구현 PR에는 GUI 후보 프로젝트 검증도 함께 필요하다.
유효한 앞 명령 + 잘못된 관계 명령의 배치가 일부만 적용돼서는 안 된다. 기존 GUI 일반 편집의
부분 no-op 규칙을 무조건 전역 교체하지 않고, 관계 변경 배치에서 실패 원자성을 검증한다.

#### 구현 PR의 필수 회귀 증거

- 새 Transaction 형태/버전/명령 수와 7종 Command의 런타임·타입 일치; 구 정본과 구 NL parser를
  고정한 fixture에서 실제 거부; 새 스킬의 구 요청 거부와 새 parser의 누락 버전 거부.
- action 전체 교체/제거/없는 값 제거/비button/하위 경로/null, createNode.action,
  kind 변경으로 다른 페이지의 유입 참조가 깨지는 경우를 포함한 G1~G3.
- GUI/NL 성공은 Undo 한 번으로 원복하고 Redo 한 번으로 복원. 실패는 spec·선택·history 불변.
- 현재 `generate:contract`는 `schema/index.ts`만 묶으며 Command는 포함하지 않는다.
  Command 전용 변경 때문에 IR 번들을 임의 변경하지 않는다. 계약 번들 회귀 테스트는 유지한다.
  `typecheck`, `lint`, 전체 test, build와 해당 브라우저 여정은 각각 실행/skip을 구분한다.
