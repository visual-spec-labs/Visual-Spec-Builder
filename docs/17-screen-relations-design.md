# 화면 종류·연결·재사용 위젯 설계 초안 (#265 S0-1)

상태: **Draft · 사용자/팀 결정 및 최소 1명 설계 승인 대기** (2026-10-09).
이 문서의 추천안·JSON 스케치는 승인된 제품 계약이나 현재 지원 기능이 아니다.
검토 기준: develop `44370d4f6151f2e351f41ebc5f000eb669a9b735`,
[#265](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265) 본문(2026-10-09 확인).

이번 PR은 이 문서와 README 목차만 추가한다. S0-1의 **승인·병합 전에는 S0-2나
S1 구현에 착수하지 않는다.** 이후에도 스키마 변경은 기능과 분리한 별도 PR과 팀 승인
최소 1명을 요구한다. 관리자 병합은 사용하지 않는다. 이 Draft의 작성은 S0-1 완료가 아니다.
문서 번호 17은 기존 `17-codegen-layout-qa.md`와 겹치지만 이슈가 지정한 파일명을
유지한다. 기존 문서의 이동·재번호 부여는 하지 않는다.

## 1. 현재 계약과 설계 사이의 차이

| 경계 | 현재 확인한 계약/구현 | 이 설계에서 검토할 변화 |
|---|---|---|
| 범위 | [02](02-mvp-scope.md), [03](03-user-flow.md), [05](05-schema.md): events/props/bindings·instance 제외 | 일반 이벤트/폼 전체가 아닌 화면 관계만 추가하는 S0-2 정정이 필요 |
| IR | [정본](../src/features/editor/schema/visual-spec.schema.json): VisualSpec·ProjectSpec 0.3, ScreenSpec·노드에 추가 속성 금지, 노드 5종 | kind/action/instance는 현재 무효. 추천안을 현재 예제 파일에 넣지 않음 |
| 페이지 | pages 키가 PageId, pageOrder는 모든 키와 정확히 일치. root는 frame | 세 kind를 같은 맵에 저장하되 첫 화면 규칙 추가 검토 |
| Command | [09](09-command-schema-freeze.md), [editablePath](../src/features/editor/command/editablePath.ts): 6종, 단일 ScreenSpec, 스키마에서 쓰기 경로 도출 | 경로가 자동으로 늘어도 공개 계약 리뷰 필요. action 하위 경로·삭제 의미를 따로 정해야 함 |
| 검증/Undo | [transactionGate](../src/features/editor/command/transactionGate.ts)의 G3는 프로젝트 검증. [editorStore](../src/features/editor/store/editorStore.ts)의 GUI appliedTransaction은 이를 거치지 않음 | 화면 검증만으로 다른 페이지 참조를 보장할 수 없음. 프로젝트 후보 전체 검사 후 단일 history 커밋 필요 |
| GUI | [스토어 계약](EDITOR_STORE_CONTRACT.md): 페이지 추가/삭제는 Command 밖, history는 프로젝트 snapshot. GUI 배치는 no-op을 건너뛸 수 있음 | 관계 정리는 기존 배치의 부분 적용을 그대로 사용하지 않고 원자적 결과로 확장 검토 |
| 홈 | [HomeScreen](../src/features/editor/ui/HomeScreen.tsx)의 cover와 loadSpec의 초기 활성 페이지는 pageOrder[0] | kind 필터만 따로 넣어 홈/열기 결과를 다르게 하지 않음 |
| Ticket | [11](11-ticket-schema-freeze.md), [compileTickets](../src/features/editor/ticket/compileTickets.ts): ScreenSpec 하나, instances는 그 화면의 NodeId[], id와 이름은 호출 내 고유 | 같은 root/Card를 가진 여러 화면을 평탄 병합하면 문맥·이름 충돌. 1차부터 프로젝트 소스 문맥 필요 |
| 실행 | [ticketProtocol](../src/features/editor/ticket/ticketProtocol.ts): protocol 1, pageId+page 한 장, 웨이브 티켓 | Ticket 스키마와 파일 교환 protocol은 별개 계약. 프로젝트 정보 전달·버전 협상도 설계 대상 |
| Export | [verifyGenerated](../src/features/editor/export/verifyGenerated.ts), [generatedPaths](../src/features/editor/export/generatedPaths.ts): 파일/상대 import/자산 검사, 이름 기반 pages/components 경로 | 컴파일·동작·최신 입력 일치를 보장하지 않음. [21](21-app-scope-a11y-design.md)의 컴포넌트 묶음 범위 유지 추천 |

관련 스킬은 저장소 원본 [visual-spec-docs](../skills/visual-spec-docs/SKILL.md),
[to-react](../skills/visual-spec-to-react/SKILL.md),
[ticket-response](../skills/visual-spec-ticket-response/SKILL.md),
[nl-response](../skills/visual-spec-nl-response/SKILL.md)를 대조했다.
이 체크아웃의 `.agents/skills` 및 상위 `/workspace/.agents`에는 읽을 설치 사본이 없었다.
배포 스킬·현재 계약 문서는 이번 PR에서 수정하지 않는다.

## 2. 결정표 — 전 행 승인 대기

| ID / 질문 | 대안 | 추천안과 이유 |
|---|---|---|
| D1. 관계 저장 위치 | 노드 action / ProjectSpec.links[] | **노드 action**. source ID 중복 없이 노드 삭제와 수명 일치. links[]는 여러 이벤트·다중 연결에 유리하나 지금은 별도 source 정리가 필요 |
| D2. 종류/순서 | 별도 modal/widget 맵 / 기존 pages+kind | **kind?: page/modal/widget**, 생략=page. pageOrder는 세 종류 모두 포함하고 첫 항목은 page. 최소 page 한 장 유지. 종류별 강제 재정렬 없이 배지 표시 |
| D3. action 대상 노드 | button만 / button·frame·text·image / input도 | **button·비root frame·text·image**, 하나의 활성화 action만. input·root·instance 자체에는 두지 않음. 중첩 활성화는 가장 가까운 action 하나만 실행하며 접근성 매핑을 후속 검증 |
| D4. action 형태 | 배열/여러 이벤트 / 단일 유니온 | **navigate(target page), openModal(target modal), close(대상 없음)**. 생략=동작 없음. 반응형 override 불가. 외부 URL·조건·폼 동작·이벤트 이름은 넣지 않음 |
| D5. 삭제/종류 변경 | 자동 제거 / 변경 거부 / 경고만 | page/modal 삭제는 영향 목록 확인 후 유입 action과 함께 제거, Undo 한 단계. 사용 중 widget 삭제·참조를 깨는 kind 변경은 거부. 무효 참조의 저장을 경고만으로 허용하지 않음 |
| D6. 모달 | 중첩 stack / 하나만 표시 | **한 번에 하나**. openModal은 현재 모달 교체, close는 모달 해제, navigate는 모달 해제 후 콜백. backdrop 클릭은 유지, Escape·명시 close로 닫기. 크기는 §3의 kind별 제안 승인 필요 |
| D7. 생성 기본값 | 특정 router / 자체 앱 셸 / 콜백 | **onNavigate(PageId) 콜백 + 페이지 소유 modal 상태**. URL·history·라우터·앱 셸은 사용자 앱 소유. 모달/위젯은 components에 named export 추천 |
| D8. 위젯 override | 임의 partial / 반응형 NodeOverride 그대로 / 제한된 내용·색 | **직접 원본 노드의 content·color만** 우선. Text/Button에 한정. NodeOverride는 content를 못 받고 layout까지 허용하므로 그대로 재사용하지 않음 |
| D9. 재사용/순환 | 이름으로 합치기 / ref 신원 | **widget PageId로만 공유**. instance 포함 그래프의 자기/간접 순환 금지. navigate/openModal 이동 그래프의 순환은 허용하며 생성 dependsOn에 그대로 옮기지 않음 |
| D10. Command 제거 표현 | 새 unset 명령 / IR action:null / path 한정 null 삭제 | **updateNode(path=action,value=null)를 삭제 의미로 한정**하고 IR에는 필드를 생략. 새 명령 없이 JSON 왕복 가능하나 기존 set 의미의 예외이므로 §5의 팀 계약 리뷰 필요 |
| D11. 프로젝트 Ticket | 기존 배열+외부 문맥 / sourcePageId 추가 / 새 프로젝트 계약 | **프로젝트용 Ticket v0.2·protocol 2 별도 설계**를 1차 S1-8 전에 합의. 기존 v0.1을 조용히 재해석하지 않음. 신원·경로는 #281과 공동 결정 |

추천을 채택하지 않은 행은 대안과 영향 범위를 갱신한다. 특히 D6/D8/D10/D11은
스키마/Command/Ticket PR 작성 전에 결론이 있어야 하는 항목이다.

## 3. 표현·기본값·동작 제안

다음은 **미구현 설계 조각**이며 현재 validator에 넣을 완전한 fixture가 아니다.
PageId/NodeId의 기존 `^[A-Za-z0-9_-]+$` 형식을 유지하고, 이름을 참조로 쓰지 않는다.

```json
{
  "kind": "page",
  "actionExamples": [
    { "type": "navigate", "target": "dashboard" },
    { "type": "openModal", "target": "resetPassword" },
    { "type": "close" }
  ]
}
```

`actionExamples`는 설명용 목록으로 저장 필드가 아니다. 실제 제안은 허용 노드에
`"action": {"type":"openModal","target":"resetPassword"}`를 하나 붙이는 것이다.
kind 생략은 page, action 생략은 동작 없음이다. action 객체는 추가 속성을 금지하며
navigate/openModal은 type·target 필수, close는 type만 받는다. IR의 action:null은 무효다.
첫 page에 자신을 가리키는 navigate나 페이지 간 왕복은 유효하며 URL을 추론하지 않는다.

**종류와 크기(D2/D6, 미확정).** page는 기존 size.width·첫 화면 최소 높이와 root.box 무시
계약을 그대로 따른다. modal은 size를 패널의 선호 폭·최소 높이로 사용하는 안을 추천한다.
호스트 viewport보다 크면 호스트 안으로 폭/높이를 제한하고 긴 내용은 모달 내부 스크롤로
보인다. root.box로 패널 크기를 중복 지정하지 않는다. 중앙 배치와 반투명 backdrop은
호스트의 표시 정책이며 원본 nodes나 background에 삽입하지 않는다. 편집기의 호스트
미리보기 크기는 문서 외부 뷰 상태다. **이 kind별 size 해석은 기존 page 계약의 변경이
아니지만 새 의미의 추가이므로 #280과 합의·실측 전에는 동등 렌더를 보장하지 않는다.**
backdrop 기본색 추천은 `#00000080`, 편집 옵션/애니메이션/중첩 모달은 후속 범위다.

widget의 size는 단독 편집 미리보기 크기, 배치된 instance.box는 호스트 안의 배치 크기다.
widget에는 페이지 전용 min-height 셸을 넣지 않는다. 원본 root의 트리/표현을 가져오고
호스트의 instance.box가 바깥 크기를 정한다. 반응형 breakpoint는 기존처럼 viewport 폭으로
계산하며 컨테이너 쿼리로 재해석하지 않는 안을 추천한다.

**닫기와 활성화(D3/D6).** close는 modal 내부 노드 또는 widget 원본 안에서 허용한다.
widget의 close는 가장 가까운 활성 모달 문맥을 닫고, page에 배치되어 모달 문맥이 없으면
no-op으로 정의하는 안이다. page 자체 노드의 close는 검증 오류다. 모달 교체 시 숨겨진
이전 모달을 stack에 남기지 않는다. 포커스 진입·가두기·닫은 뒤 트리거 복귀와 키보드
활성화는 S1-9의 생성 검증 조건이며 현재 지원 보장이 아니다. 클릭 가능한 frame 안의
button 등은 중복 호출·중첩 button DOM을 만들지 않아야 한다. Canvas의 편집 클릭은
런타임 action을 실행하지 않고, 별도 대상 이동 UI로만 편집 대상을 연다(단축키는 S1-7).

**독립 화면 문서.** validateVisualSpec은 구조·해당 화면의 source 규칙만 검사하고
외부 PageId의 존재/종류/cycle 검사는 ProjectSpec 문맥에서 한다는 안을 추천한다.
독립 화면 검증 성공을 관계 해결 성공으로 표시하지 않는다. 관계가 있는 화면만 추출한
파일은 독립 생성/실행을 막고 프로젝트를 요구한다. Open에서 한 페이지 프로젝트로
감싼 후 전체 검증이 실패하면 가져오기를 거부하고 누락 참조를 알린다. 임의 페이지 생성이나
참조 자동 삭제는 하지 않는다. 독립 modal/widget은 첫 page 규칙 때문에 별도 가져오기
흐름 없이 프로젝트로 열 수 없다는 제한도 사용자 승인이 필요하다.

## 4. 참조의 수명과 위젯 제안

| 조작 | 추천 정책(미구현) | 원자성/실패 처리 |
|---|---|---|
| source 노드/서브트리 삭제 | 해당 action도 노드와 사라짐 | 기존 노드 삭제 Undo에 포함 |
| page/modal 삭제 | 다른 모든 화면·widget에서 target이 그 ID인 action 제거. 목록/개수 확인 후 실행 | 프로젝트 전체 후보 검사 후 snapshot 한 번. 취소/실패 시 무변경 |
| 마지막 page 삭제·첫 page kind 변경 | 거부. 첫 page 삭제 시 남은 page 중 기존 순서상 첫 page를 선두로 이동 | modal/widget을 조용히 page로 바꾸지 않음 |
| 그 밖의 kind 변경 | 유입 action/ref와 source close 등이 무효가 되면 거부 | 먼저 관계를 명시적으로 정리하도록 안내 |
| 노드 복제·같은 프로젝트 붙여넣기 | 새 로컬 NodeId, PageId target/ref 유지 | 당시 프로젝트에서 검증. 대상이 삭제되었거나 kind가 달라졌으면 붙여넣기 거부 |
| 페이지 복제(현재 API 없음) | 새 PageId, 내부 로컬 NodeId/반응형 참조 일관 복사. 자기 화면을 가리키던 action은 새 PageId, 외부 target/ref는 유지 | 원본은 불변. 기능을 추가할 때 한 history 동작으로 검증 |
| 다른 프로젝트 붙여넣기 | 관계 없는 트리는 허용. action/ref가 있으면 기본 거부 후 명시적 정리/가져오기 안내 | 같은 문자열 ID를 같은 대상이라고 추정하지 않음. clipboard에 문서 출처가 필요하며 영구 ID는 #281과 조율 |
| Group | 원노드 action은 그대로, 새 wrapper에는 없음 | 기존 이동/그룹 history 한 단계 |
| Ungroup | 자식 action 보존. 해체 frame에 action이 있으면 먼저 명시 제거하도록 거부 | 현재 구현은 wrapper를 삭제하므로 action 자동 보존이라고 주장하지 않음 |
| 사용 중 widget 삭제 | 참조 목록을 제시하고 거부 | 명시 detach 또는 instance 삭제 후 가능. 자동 cascade 삭제 없음 |
| 위젯 원본 노드 삭제/타입 변경 | 해당 노드를 override하는 instance가 있으면 기본 거부 | override 정리 후 재시도. 모든 instance의 유효성 재검사 |

페이지/프로젝트 간 출처 없는 현재 [clipboard](../src/features/editor/ui/clipboard.ts)는
NodeSubtree만 보관한다. action/ref를 새로 싣기 전에 출처 판별을 설계해야 한다.
다른 프로젝트 widget 가져오기·이름 기반 자동 연결은 이 초안의 범위 밖이다.

```json
{
  "type": "instance",
  "name": "Notification card",
  "box": { "width": "fill", "height": "auto" },
  "ref": "notificationWidget",
  "overrides": {
    "title": { "content": "새 알림", "color": "#334155" }
  }
}
```

**D8/D9 스케치:** type/name/box/ref 필수, visible 선택(생략=true), overrides 선택
(생략 또는 빈 맵=원본 상속). ref는 같은 프로젝트의 kind=widget PageId다. instance는
leaf이며 children·layout·자체 action은 받지 않는다. overrides의 키는 참조 widget의
직접 nodes 키이며 Text/Button의 content·color만 선택 허용한다. 원본에 해당하는
타입이 아니거나 없는 노드면 무효다. nested instance 내부를 점 경로로 덮지 않는다.
부분 객체 병합·배경색·placeholder·이미지 교체·트리 변경은 초기 범위에서 제외하는 안이다.

합성 순서 추천은 원본 기반값 → 원본 responsive 누적 → instance content/color다.
따라서 명시 color는 모든 폭에서 우선한다. 원본의 나머지 변경은 모든 인스턴스에 반영된다.
이 순서는 responsive NodeOverride의 기존 의미를 고치지 않고 별도 instance 계층으로
정의한다. detach는 보이는 폭 하나를 평탄화하지 않고 원본과 반응형 표현을 복사하며
override를 반영한 새 로컬 트리로 만드는 별도 S2-3 동작이다. box·참조·새 ID·반응형
매핑을 검증하고 Undo 한 단계로 수행하는 구체 알고리즘은 후속 설계 대상으로 남긴다.

검증 그래프는 `widget A → instance.ref B`다. 직접 자기 참조와 A→B→A를 모두 거부하고,
여러 페이지가 같은 위젯을 쓰는 DAG는 허용한다. root/children의 기존 `cycle`과 분리한다.
렌더러도 재귀 방문 경로를 방어해 검증을 우회한 입력에서 무한 재귀하지 않아야 한다.

## 5. Command·검증·버전 영향

**D10의 공백:** 현재 [applyCommand](../src/features/editor/command/applyCommand.ts)와
[setByPath](../src/features/editor/store/path.ts)는 값을 쓰기만 한다. JSON에 undefined는
없고 value는 필수라 `action`을 없애는 경로가 없다. 추천 null sentinel은 **새 의미**이며,
모든 path의 null을 삭제로 바꾸자는 뜻이 아니다. action 전체 교체/삭제만 허용하고
`action.type`·`action.target`은 거부하는 안이다. kind 복귀는 명시 `"page"`로 쓴다.
kind/action을 responsive에 넣는 것도 거부한다.

Command 6종·v0.1 유지가 추천이나 [09](09-command-schema-freeze.md)의 의미 변경
규칙 때문에 팀이 null sentinel을 승인하지 않으면 새 명령/버전 안으로 다시 설계해야 한다.
S1-3은 S1-1뿐 아니라 S1-2 검증 완료에도 의존하도록 순서 보강을 제안한다.
GUI의 관계 편집·삭제·붙여넣기 역시 최종 ProjectSpec을 검증하고 성공할 때만 한 history
snapshot을 만든다. NL의 기존 G1/G2/G3와 GUI의 부분 적용 계약을 같은 것으로 취급하지 않는다.
NL 요청은 현재 page 한 장만 주므로 target을 이름으로 추측하게 하지 않고, 프로젝트의
PageId/name/effective kind 카탈로그 전달을 S1-10에서 별도 protocol 영향과 함께 검토한다.

| 신규 IssueCode 후보 | 조건 / 검사 경계 |
|---|---|
| action-target-missing | ProjectSpec.pages에 target 없음 |
| action-target-kind | openModal target이 modal 아님 |
| navigate-to-non-page | navigate target이 page 아님(생략 kind는 page) |
| action-source-invalid | root의 action 또는 page 자체의 close 등 의미상 금지 source |
| first-page-kind | pageOrder[0]이 page 아님. page-order-mismatch와 구분 |
| instance-ref-missing / instance-ref-kind | ref 없음 / widget 아님 |
| instance-cycle | 프로젝트 내 widget 포함 그래프의 자기/간접 순환 |
| instance-override-invalid | 원본 노드 없음, 타입 불일치, 금지 속성 또는 합성 결과 무효 |

형태 오류(추가 필드·잘못된 enum·input action·IR null)는 기존 `schema` 코드로 보고한다.
프로젝트 오류 경로는 `/pages/<id>/nodes/<id>/action/target`, `/.../ref`,
`/.../overrides/<sourceNode>`처럼 원인 필드를 가리킨다. 첫 화면 오류는 `/pageOrder/0`이다.
위 코드는 아직 공개 IssueCode에 추가되지 않았으며 S1-2/S2-2 계약 테스트에서 확정한다.

**IR 버전:** 이슈의 단계 계획은 S1 kind/action 선택 확장에 0.3 유지, S2 instance에 0.4다.
기존 0.3 파일은 새 validator에서 그대로 유효해야 한다. 확장 전 0.3 validator는 추가 속성
금지로 새 필드를 거부하므로 **같은 버전도 양방향 호환이 아니다**. 0.4에서는 두 최상위
문서 버전을 함께 올리는 별도 PR과 타입 생성이 필요하다. migrateToV04는 0.3의 내용은
보존하고 버전만 올리는 안이며, 0.1/0.2는 기존 배경 변환을 거친 뒤 올린다. 이 PR은
버전·정본·생성 타입·예제·기존 [06 동결 계약](06-schema-freeze.md)을 바꾸지 않는다.

## 6. Ticket·생성·Export 추천 경계

**D7/D11:** 기존 compileTickets(screen)를 호환 진입점으로 남기고 별도 프로젝트
컴파일을 추가하는 안이다. 선택 범위는 프로젝트 전체를 기본으로 하며 page/modal을
구별하고 widget은 ref당 한 번만 생성한다. 이름/구조가 비슷하다는 이유로 서로 다른
화면의 컴포넌트를 공유하지 않는다. 페이지 내부의 기존 반복 추출과 명시 widget 공유는
구분한다. GUI 티켓/실행/Export가 동일한 프로젝트 snapshot과 범위를 보여야 한다.

1차부터 `instances: NodeId[]`를 해석할 sourcePageId가 필요하다. 추천 v0.2는 티켓별
sourcePageId와 기존 로컬 instances를 함께 보관하며 Ticket.kind는 page/component로
유지하는 방향이다. IR의 kind=modal/widget과 Ticket.kind를 같은 enum으로 만들지 않는다.
프로젝트 웨이브는 protocol 2에서 프로젝트 snapshot·소스 문맥·전역 티켓/의존 ID를
전달하고 protocol 1 요청을 프로젝트 요청처럼 해석하지 않는다. **정확한 필드·버전 채택·
구형 요청 처리·파일명 규칙은 승인 전 미확정**이다. #265의 "Ticket은 2차에서 판단"보다
앞당겨야 하는 근거가 현재 단일 화면 protocol이다.

| 관계 | 런타임/생성 추천 | dependsOn 정책 |
|---|---|---|
| A navigate B, B navigate A | 페이지가 onNavigate(target)를 호출. 서로 import하지 않음 | 이동 edge를 의존 edge로 만들지 않음 |
| page가 modal 열기 | page 호스트가 modal component와 열린 modal ID 상태 소유 | 호스트는 사용하는 modal component에 의존 |
| modal A가 modal B 열기 | openModal 요청을 호스트로 전달. 호스트가 도달 가능한 modal 집합을 중복 없이 보유 | modal끼리 import하지 않음. A↔B가 생성 cycle이 되지 않음 |
| widget 내부 openModal | widget은 호스트 콜백으로 전달, 호스트가 도달 모달 수집 | widget→modal 의존 대신 호스트→modal |
| page/modal/widget가 widget 포함 | ref당 공용 component 한 번, override는 제한된 props로 전달 | 포함 DAG의 자식 widget 먼저 생성 |

페이지의 onNavigate는 action이 있으면 필수 콜백으로 만들어 누락을 통합 앱에서 드러내는
안을 추천한다. modal 호스트는 onOpenModal/onClose 콜백을 자손에 전달한다. 일반 임의
props/bindings를 IR에 허용하는 결정은 아니다. 라우트 목록은 PageId→생성 component
매핑 설명으로 제공하고 URL path, 인증·가드·브라우저 history를 생성하지 않는다.
기존 [21](21-app-scope-a11y-design.md)의 실행 앱 셸 제외와 양립하는 기본값이다.

Export는 모든 관련 컴포넌트·상대 import·사용 자산을 포함하고 기존 검사 강도를 낮추지
않는다. 경로/소유권은 아래 #281 합의 뒤 적용한다. 파일 존재 검사를 typecheck·동작
검증·최신 생성 완료로 승격하지 않는다. S1-9/S2-7에서는 독립 앱 typecheck/build,
login→dashboard 및 모달 열기/닫기, 공유 widget 한 번 생성의 fixture를 별도로 검증하고,
S1-11/S2-9 실제 AI 실행 기록은 그와 구분한다.

## 7. 영향 파일·후속 단계와 조율

| 단계 | 선행/승인 조건 | 후속 변경 대상(이번 PR에서 수정하지 않음) |
|---|---|---|
| S0-1 현재 | 결정표 논의·팀 1명 이상 승인 후 병합 | 이 문서와 README 목차만 |
| S0-2 | S0-1 승인·병합 | 02부터 범위 정정, 이어 03, 정정 이력. open-questions의 실제 관련 항목만 처리 |
| S1-1 | S0-1, 범위 정정과 정합성 확인 | schema/visual-spec.schema.json·types.ts·index.ts, 05/06, 기존/신규 예제·테스트. **스키마 단독 PR** |
| S1-2~4 | S1-1 → 참조 검사 → Command/스토어. S1-3의 S1-2 의존 추가 제안 | schema/validate.ts, command/{editablePath,applyCommand,transactionGate,groupCommands}, store/editorStore, ui/clipboard, 09·스토어 계약 |
| S1-5~7/10 | 정본·프로젝트 검증·관계 편집 계약 완료 | PageProperties·LayerTree·HomeScreen/homePreview·InteractionSection·Canvas/CanvasNode·nlScope/nlProtocol·NL 스킬, 08/10 |
| S1-8/9 | S1-1 및 D11·#281 경계 합의. 실제 검증은 S1-2 완료 뒤 | ticket 컴파일/types/schema/protocol·TicketPanel/ticketRunner·Export/generatedPaths/importScan·생성/응답 스킬·사람용 docs/skills, 11 |
| S1-11 | S1-5~10 완료 | examples, 07/14/15, README. 실제 AI 검증과 fixture 구별 |
| S2-1/2 | S1-11 및 D8/D9 승인 | instance·0.4·migrateToV04·로드 입구, 생성 타입·05/06·참조 검증. **스키마 단독 PR** |
| S2-3~8 | S2 정본/검증과 계약별 승인 | instance/detach/widget 추출의 프로젝트 원자 연산, 캔버스·GUI·Ticket·Export·NL·스킬. 새 Command 필요 시 09의 버전 합의 |
| S2-9 | S2-4~8 완료 | 공용 widget 예제, 07/14/15/README, 실제 AI·ZIP·독립 앱 검증 |

조율 대상은 읽기만 했으며 이 PR에서 이슈/브랜치/구현을 변경하지 않는다.

- [#280](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/280): modal/widget의 size·viewport·폰트·reset·좌표 비교를 page 계약과 조율. 기존 QA를 새 kind 검증으로 재사용했다고 주장하지 않는다.
- [#290](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/290): 위젯 재사용은 #265, 사용자 스타일·폰트·상태는 #290. 제한된 override가 TokenSet/states 채택을 뜻하지 않는다.
- [#281](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/281): project/page/component 안정 신원·rename/copy·전역 이름 충돌·소유권·생성 경로를 S0에서 공동 결정해야 한다. PageId는 프로젝트 내 신원일 뿐 전역 project ID나 manifest를 이 문서가 신설하지 않는다.
- [#282](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/282)·[#284](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/284): 쓰기 전 수동 변경 보호, 취소/늦은 출력 수용은 해당 레인 소유. 여기서 staging/manifest/CAS 방식을 확정하거나 구현하지 않는다.

## 8. 승인 요청과 검증 계획

다음은 **아직 답이 없는 질문**이다. 답·승인자·근거 PR을 기록한 뒤에만 해당 제안을
결정으로 승격한다. 문서 병합만으로 답이 생긴 것으로 처리하지 않는다.

| 대상 | 승인 전에 필요한 질문 |
|---|---|
| 사용자/제품 | D2: page 한 장 필수·modal/widget 단독 프로젝트 불가를 받아들일까? D3: 비button 활성화도 첫 단계에 넣을까? |
| 사용자/제품 | D5: 화면 삭제 시 유입 action 동시 제거(영향 확인), widget은 사용 중 삭제 거부가 맞을까? |
| 사용자/제품·#280 | D6: 단일 modal 교체·Escape 닫기·backdrop 클릭 유지와 패널 size 해석을 채택할까? |
| 사용자/제품 | D7: router 없는 필수 onNavigate 콜백과 컴포넌트 묶음 출력으로 충분할까? |
| 사용자/제품 | D8: 첫 override를 Text/Button content·color로 제한하고 모든 폭에서 우선할까? |
| 계약 담당 | D10: action 전용 null 삭제 의미와 Command v0.1 유지에 합의할까, 새 명령/버전이 필요할까? |
| 계약 담당·#281 | D11: S1부터 프로젝트 Ticket v0.2/protocol 2를 설계할까? sourcePageId·안정 ID·경로/소유권을 어떤 공통 계약으로 연결할까? |

**이 문서 PR의 검증:** 근거 파일/상대 링크 존재, README 항목, whitespace, 변경 범위가
두 Markdown 파일인지, 정본·생성 타입·동결 계약이 그대로인지 확인한다. 실행한 기존
회귀 검사 결과는 PR 본문에 기록한다. 미래 기능의 fixture/브라우저/실제 AI 성공을 주장하지 않는다.

**후속 수용 테스트:** kind 생략/명시 page 동등성, 모든 action 갈래/잘못된 source·target,
단독 화면 문맥 제한, 첫/마지막 page, 삭제 취소·동시 정리·Undo/Redo, 참조 대상 kind 변경,
동일/다른 프로젝트의 복제·붙여넣기·ID 충돌, action frame Ungroup, widget 직접/간접 cycle,
override 타입/누락 원본/반응형 합성, 같은 이름 페이지·widget의 Ticket 충돌, 이동 cycle과
의존 DAG 분리, 모달 focus·스크롤·교체, 상대 import/ZIP/독립 앱을 확인한다.
스키마 PR은 generate:types와 기존 예제 통과를 포함하고, 후속 코드 PR은 typecheck·lint·
전체 test·build를 통과해야 한다([CONTRIBUTING](../CONTRIBUTING.md), 06/09/11).
