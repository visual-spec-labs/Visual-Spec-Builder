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
  Layout, moveNode의 0 이상 정수 index를 검사한다.
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
