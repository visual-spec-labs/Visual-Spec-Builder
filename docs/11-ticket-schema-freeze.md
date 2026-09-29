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
