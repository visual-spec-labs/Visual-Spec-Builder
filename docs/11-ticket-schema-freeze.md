# 11. Ticket Schema v0.1 확정 및 동결

동결 시작: 2026-09-29 · 이슈 #179

## 정본과 공개 표면

런타임 정본은 `src/features/editor/ticket/ticket.schema.json`이다. Ticket과
TicketStatus의 JSON 형태를 고정하며, `instances`는 IR 정본의
`visual-spec#/$defs/NodeId`를 참조한다.

```ts
import {
  validateTicket,
  validateTickets,
  ticketJsonSchema,
  type Ticket,
  type TicketStatus,
} from "@/features/editor/ticket";
```

검증기는 예외를 던지지 않고 `{ valid, issues }`를 돌려준다. 외부 에이전트 응답 등
신뢰할 수 없는 티켓 값은 다음 처리 전에 `validateTicket` 또는 `validateTickets`를
통과시킨다.

Ticket TypeScript 타입은 이 스키마에서 생성하지 않는다. 타입은 컴파일러와 상태 관리가
함께 쓰는 기존 내부 계약이며, JSON Schema는 런타임 형태 검증의 정본이다.

## 검증 경계

- JSON Schema는 필수 필드, 추가 필드, `kind`, `status`, 문자열 필드와 배열 원소를 검사한다.
- `instances`의 각 항목은 IR의 NodeId 규칙을 재사용한다.
- `error`는 #184에서 Ticket 타입에 추가된 선택 문자열 필드다. 실패 상태에서 실패 사유를
  담을 수 있지만, 스키마는 상태 변경 규칙을 강제하지 않는다. `ticketStatus.ts`가
  실패가 아닌 상태로 바뀔 때 값을 지운다.
- Ticket id의 유일성, `dependsOn`이 실제 티켓을 가리키는지, 인스턴스가 현재 IR에
  존재하는지는 JSON Schema가 아닌 호출자의 문맥 검사 영역이다.
- `compileTickets` 로직은 변경하지 않는다. 예제 결과가 스키마를 만족하는지 테스트로
  고정한다.

## 변경 절차

v0.1 변경은 다음을 한 PR에서 함께 수행한다.

1. `ticket.schema.json` 수정
2. 기존 `ticket/types.ts`와 의미가 일치하는지 확인 (타입 필드 변경은 별도 범위)
3. `test/ticket-schema.test.ts`의 유효/무효 사례 갱신
4. 이 문서에 호환성 영향과 결정 근거 기록
5. `typecheck`, `lint`, 전체 테스트, build 통과

기존 필수 필드 추가, enum 축소, 필드 제거, 의미 변경은 breaking change다. 새 선택
필드도 스키마와 소비자 영향을 함께 검토한다.

## Ticket v0.2 · 티켓 요청 규약 v4 예정 — #265 D11

현재 상태: **예정.** 지금 정본은 위의 v0.1 그대로다. 이 절은 2026-10-13 리더 결정
([#265 결정 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414))을
기록할 뿐이며 `ticket.schema.json`·`ticket/types.ts`·`compileTickets`·테스트를 바꾸지 않는다. 실제 변경은
**#265 S1-8/9 착수 전 계약 PR**이 위 "변경 절차"대로 한다. 설계 배경은 [24 §6](24-screen-relations-design.md#6-ticket생성export-추천-경계)에 있다.

**무엇이 왜 바뀌나.** #265가 화면 사이 관계(이동·모달)를 IR에 넣으면서 티켓을 프로젝트 단위로 만들어야 한다.
지금 `compileTickets(screen)`는 `ScreenSpec` 하나만 받고, `instances`는 그 화면의 NodeId라서 여러 화면의 티켓을
한 목록에 모으면 어느 페이지의 노드인지 알 수 없다. 그래서 티켓마다 출처 페이지를 싣는다.

| 항목 | 결정(2026-10-13) |
|---|---|
| 컴파일 진입점 | 기존 `compileTickets(screen)`는 **호환 진입점으로 유지**하고, 프로젝트 단위 컴파일을 **추가**한다 |
| Ticket 스키마 | v0.1 → **v0.2**. 티켓별 `sourcePageId`를 더한다 |
| 티켓 요청 규약 | `TICKET_PROTOCOL_VERSION` 3 → **4**(요청 쪽 계약은 [26](26-agent-request-generation-contract.md#티켓-요청-규약-v4-예정--265-d11)) |
| 구 스킬 | 티켓 요청 규약 v3 스킬은 **버전 불일치로 거부**하고 스킬 업데이트를 안내한다 |
| 신원·경로 기준 | #281 결과인 #357(PageId 생성 자리)·#371(`ProjectSpec.projectId`) |

Ticket 스키마는 `additionalProperties: false`라 v0.1 검증기는 `sourcePageId`가 있는 티켓을 거부한다.
기존 v0.1 티켓 배열을 프로젝트 티켓으로 조용히 재해석하지 않는다.

**S1-8/9 착수 전 계약 PR에서 정할 것(지금 미정).**

- `sourcePageId`의 필수 여부와 호환 진입점 `compileTickets(screen)`이 내는 티켓에서의 값.
- v0.2의 나머지 필드 변경 여부(예: 페이지를 넘는 `dependsOn` 표기). `kind`는 page/component를 유지하는 방향이며
  IR의 `kind`(page/modal/widget)와 같은 enum으로 만들지 않는다(24 §6).
- 위 "검증 경계"의 문맥 검사(`dependsOn`·`instances`가 실제 대상을 가리키는지)를 프로젝트 문맥으로 넓히는 방식.

병합 조건은 리더 승인 또는 리뷰어 1명 이상 승인이다(2026-10-13 리더 결정).

## S1-8 계약 리뷰 초안 — 2026-10-16 (미구현)

이 절은 #388의 세 제품 방향 수용(사용자, 2026-10-16 08:36 UTC “388 그렇게 진행해”)을
바탕으로 검토할 계약 초안이다. 제품 방향 수용을 exact schema의 승인으로 확대하지 않는다.
#388 정상 병합은 외부 리뷰·세부 계약 미해결로 재거절됐으므로 이 초안은 **Draft 리뷰용**이며,
후속 스키마/컴파일러의 선행 조건을 충족했다고 표시하지 않는다. 현재 v0.1 정본은 바꾸지 않는다.

### 호환 API와 프로젝트 티켓 제안

- `compileTickets(screen): Ticket[]`, `Ticket`, `validateTicket(s)`와 기존 v0.1 JSON은 유지한다.
- `compileProjectTickets(project): ProjectTicket[]`를 별도 추가한다. 프로젝트 전체가 유효해야 하며
  pageOrder 순서의 page/modal을 대상으로 한다. 활성 페이지로 암묵 축소하지 않는다.
- `ProjectTicket`은 기존 Ticket 필드에 **필수** `version: "0.2"`, `sourcePageId: PageId`를 추가한다.
  v0.2는 별도 `$defs/ProjectTicket`·`ProjectTickets`와 `validateProjectTicket(s)`로 검증한다.
  기존 schema 루트/v0.1 검증기의 추가 속성 거부를 풀어 신구 문서를 한 형태로 받지 않는다.
- `kind: "page"`는 원본 화면의 root 티켓이라는 기존 역할을 유지한다. source의 page/modal 종류는
  `project.pages[sourcePageId].kind ?? "page"`로 읽는다. modal을 일반 page로 바꾸지 않는다.
- `instances`는 해당 sourcePageId 화면의 NodeId만 담고 하나 이상, 중복 없이 둔다. 다른 화면의
  동일 NodeId는 다른 출처다. root 티켓의 대표 ID는 source 화면의 root다.
- 프로젝트 ticket id는 `JSON.stringify([sourcePageId, kind, instances[0]])`다. 표시 이름과 파일명은
  신원이 아니다. 이름만 바뀌면 id가 유지된다. 대표 노드가 바뀌면 새 티켓 신원으로 본다.
  id는 파일 경로로 사용하지 않는다. componentName은 기존 페이지별 이름 충돌 방지 규칙을 유지한다.
- `dependsOn`은 전역 프로젝트 ticket id 배열이다. 중복/없는 ID/self edge/생성 DAG cycle을 거부한다.
  navigate/openModal 이동 그래프를 이 배열에 그대로 복사하지 않는다. 모달 호스트와 생성 파일 DAG의
  세부 구성은 아래 미해결 항목을 먼저 확정한다.
- `status` 네 값과 선택 `error`의 의미는 기존 계약을 유지한다. JSON 객체에는 선언하지 않은 필드를
  허용하지 않고 null을 생략 대용으로 받지 않는다. 실패 이외 상태의 error 제거는 상태 관리 책임이다.

형태 예시(실행되는 v0.1 예제가 아님):

```json
{
  "version": "0.2",
  "sourcePageId": "login",
  "id": "[\"login\",\"page\",\"root\"]",
  "componentName": "LoginPage",
  "kind": "page",
  "instances": ["root"],
  "dependsOn": [],
  "status": "pending"
}
```

### 필수 수용 사례

1. 현행 fixture의 v0.1 결과/검증을 변경 없이 유지한다. v0.1 검증기는 위 v0.2 객체를 거부한다.
2. v0.2 검증기는 version/sourcePageId 누락·틀린 버전·추가 필드·null·빈 instances를 거부한다.
3. 두 화면의 같은 NodeId/이름은 별도 신원이다. 표시 이름만 바꾸면 id는 유지되고 출력 경로/지문은 재평가한다.
4. 없는 sourcePageId·출처 밖 instances·없는/중복 의존·생성 cycle은 컴파일 또는 요청 전 문맥 검사로 거부한다.
5. schema·수동 types·validator·CLI 배포 계약 복사를 같이 검증한다. IR `generate:types`만 실행한 것을
   Ticket 타입 동기화 증거로 세지 않는다. 실제 스키마 변경은 별도 PR이며 정상 승인이 필요하다.

### 스키마 PR 전에 남은 검토

프로젝트 호스트/route entry 출력의 소유권과 manifest 기록, modal끼리 순환 이동할 때 생성 DAG를
만드는 방식, widget 페이지의 S1 제외 표시, 프로젝트 계획 결과(티켓 외 routes/entry metadata)의
반환 타입을 확정해야 한다. 이 초안만으로 실행 가능한 전체 프로젝트 compiler 계약이 완성됐다고
주장하지 않는다. [요청 v4 리뷰 초안](26-agent-request-generation-contract.md#s1-89-요청-v4-계약-리뷰-초안--2026-10-16-미구현)과 함께 검토한다.
