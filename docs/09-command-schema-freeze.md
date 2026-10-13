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
