> 2026-10-15 S1-4 구현: #381의 §10 계약에 따라 유입 참조 정리/첫 page 최소 재배치/전체 후보 검증을
> 한 history 단계로 적용한다. 삭제 확인은 spec·문서 변경 시 영구 무효화하고 clipboard는 출처를
> 검증한다. 과거 관계 오류 자동 저장본은 그대로 복원하며 엄격한 Save/Open 경계는 유지한다.
> 아래 제안/미구현 표기는 이전 설계 시점 기록이다. 재사용 widget/S2와 관계 생성 기능은 구현하지 않았다.

# 화면 종류·연결·재사용 위젯 설계 초안 (#265 S0-1)

상태: **병합(#339, 2026-10-10) · 리더 사후 승인과 D10·D11 리더 결정(@Yumesa2025, 2026-10-13)** (§8).
2026-10-09 제품 방향 담당 @Yumesa2025가 D1~D9 방향과 D10·D11 우선 추천을 문서에 반영하도록 승인했고,
2026-10-13 팀 리더 @Yumesa2025가 [#265 결정 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414)로
이 문서(#339)를 사후 승인하고 D10·D11을 확정했다. 확정된 것은 §2·§8에 적은 범위뿐이다. 명령 필드·문맥 필드 같은
세부는 각 계약 PR(S1-3은 [09](09-command-schema-freeze.md), S1-8/9는 [11](11-ticket-schema-freeze.md)·[26](26-agent-request-generation-contract.md))에서 정한다.
JSON 조각은 여전히 설계이며, 현재 정본에 들어간 것은 S1-1(#355)의 kind·action과 S1-2(#366)의 검증 코드뿐이다.
최신 소스 대조 기준: develop `2b0099c90ac82bacb5738d18239a9ddab913ebb5`(2026-10-10, #282·#284·#290 문서 병합 후),
[#265](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265) 본문(2026-10-09 확인).
리더 결정 반영 기준: develop `694f2d6`, #265 본문 "버전" 표(2026-10-13 갱신 확인). 본문 곳곳의 "#357 미병합" 표기는
2026-10-09 작성 시점 기준이며 PR #357은 2026-10-10 병합됐다.

#339는 이 문서와 README 목차만 추가했다. 이후에도 스키마 변경은 기능과 분리한 별도 PR로 올리며,
**리더 승인 또는 리뷰어 1명 이상 승인** 없이 병합하지 않는다(2026-10-13 리더 결정으로 고친 조건). 관리자 병합은 사용하지 않는다.
문서 번호 중복을 피하려고 이 설계만 24번으로 배치했다. 기존 QA 문서는 그대로 둔다.
#265 본문과 이 문서의 단계 계획 차이와 그 해소 여부는 §7에 기록한다.

## 결정 요약 — 리더 승인(2026-10-13)

기존 pages 맵에 선택 kind를 더하고 **button에만 action 하나**를 둔다. 첫 화면과 최소
한 장은 일반 page로 유지한다. 이동은 router 없는 onNavigate 콜백, 모달은 단일 호스트
상태로 표현한다. 위젯은 프로젝트 widget ID로 공유하며 직접 Text/Button의 내용·글자색만
덮어쓴다. 저장 ID와 런타임 DOM ID는 구분한다. 이 방향은 제품 방향 담당 @Yumesa2025의 승인(2026-10-09)을
받았고, 2026-10-13 리더가 #339를 사후 승인했다. D6의 modal 크기는 여전히 #280과 합의할 항목이다(§3).

**D10(S1-3 게이트) 확정:** 버튼 연결 제거는 전용 명령 `removeNodeAction`과 **Command 스키마 v0.2**로 한다.
action 설정은 updateNode의 전체 객체 교체, 제거는 이 명령으로만 하며 action.type/target 부분 쓰기는 거부한다.
구버전 소비자는 버전 불일치로 거부한다. 세부 필드와 없는 action을 제거할 때의 처리는 S1-3의 [09](09-command-schema-freeze.md) 절차 계약 PR에서 정한다.

**D11(S1-8/9 게이트) 확정:** 기존 `compileTickets(screen)`는 호환 진입점으로 두고 프로젝트 단위 컴파일을 추가한다.
**Ticket 스키마 v0.2**(티켓별 `sourcePageId`)와 **티켓 요청 규약 v4**(현재 v3)로 하며, 구 스킬(v3)은 버전 불일치로
거부하고 업데이트를 안내한다. #281 신원·경로는 #357(PageId 생성 자리)·#371(`projectId`)로 정리된 것을 기준으로 한다.
manifest·복구 `run.json`의 `protocol`은 바꾸지 않는다. 나머지 세부는 S1-8/9 착수 전 [11](11-ticket-schema-freeze.md)·[26](26-agent-request-generation-contract.md) 계약 PR에서 정한다.

순서는 S0 → S0-2 범위 정정 → S1-1 별도 스키마 → S1-2 프로젝트 검증(여기까지 병합) → S1-3 Command → GUI다.
이 결정을 24·09·11·26에 반영하는 문서 PR이 병합된 뒤 S1-3부터 착수한다(#265 결정 댓글).

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
| page 셸 | [25](25-layout-parity-contract.md)(#280): page 셸 정본. size.width=폭, size.height=첫 화면 최소 높이, root.box는 크기를 정하지 않음. modal/widget(#265)에는 적용하지 않는다고 명시 | §3의 page 해석은 25와 같음. modal/widget의 크기 해석은 #280과 별도 합의 |
| Ticket | [11](11-ticket-schema-freeze.md), [compileTickets](../src/features/editor/ticket/compileTickets.ts): ScreenSpec 하나, instances는 그 화면의 NodeId[], id와 이름은 호출 내 고유. 전달은 요청 규약 v3(#284 staging 확정 + #281 생성 자리, [26](26-agent-request-generation-contract.md)) | 같은 root/Card를 가진 여러 화면을 평탄 병합하면 문맥·이름 충돌. 1차부터 프로젝트 소스 문맥 필요 |
| 실행 | [ticketProtocol](../src/features/editor/ticket/ticketProtocol.ts): 요청 규약 v3(#284 staging 확정, #281 `generatedRoot`, [26](26-agent-request-generation-contract.md)). pageId+page 한 장, 웨이브 티켓, 에이전트는 `staging/<requestId>/`에 쓰고 GUI가 `generated/`로 확정 | Ticket 스키마와 티켓 요청 규약은 별개 계약. 프로젝트 정보 전달은 다음 티켓 요청 규약 버전(현재 v3 다음)의 설계 대상 |
| 생성 수용·보호 | [26](26-agent-request-generation-contract.md)(#284·#282): 요청 세대(requestId), staging 확정, 수용 기록 `runtime/generation-manifest.json`, 쓰기 전 수동 변경 보호([overwriteGuard](../src/features/editor/export/overwriteGuard.ts)) | 프로젝트 compile은 이 경계 위에 얹고 대체하지 않음. manifest·복구 `run.json`의 `protocol`은 티켓 요청 규약과 별개 버전 |
| Export | [verifyGenerated](../src/features/editor/export/verifyGenerated.ts), [generatedPaths](../src/features/editor/export/generatedPaths.ts): 파일/상대 import/자산 검사, 이름 기반 pages/components 경로(**#281 PR #357 병합 시 PageId 자리 기준으로 갱신 필요**). [generationManifest](../src/features/editor/export/generationManifest.ts): current/stale/changed/unrecorded/missing 판정, 입력 지문은 [contentHash](../src/features/editor/export/contentHash.ts)의 페이지 단위 | 컴파일·동작 검증은 아님. 지문이 페이지 하나만 보므로 화면 관계가 생기면 다른 화면의 변경을 오래됨으로 잡지 못함(§6·§7 S1-8/9 게이트). [21](21-app-scope-a11y-design.md)의 컴포넌트 묶음 범위 유지 추천 |
| 공용 스타일 | [27](27-user-design-system-scope.md)(#290): 공용 컴포넌트는 #265 소관. 색·글자 스타일 스키마(2-1)는 #265 S1-1·S1-2 뒤, 상태 스타일(2-3)은 #265 S1 뒤 | 정본 스키마 동시 수정을 피하려고 §7 S1-1·S1-2를 #290 2-1/2-3의 선행으로 표기 |

관련 스킬은 저장소 원본 [visual-spec-docs](../skills/visual-spec-docs/SKILL.md),
[to-react](../skills/visual-spec-to-react/SKILL.md),
[ticket-response](../skills/visual-spec-ticket-response/SKILL.md),
[nl-response](../skills/visual-spec-nl-response/SKILL.md)를 대조했다.
배포 스킬·현재 계약 문서는 이번 PR에서 수정하지 않는다.

## 2. 결정표 — 제품 방향과 리더 결정 구분

| ID / 질문 | 대안 | 선택 방향과 이유 | 결정 / 남은 합의 | 승인자 | 근거 |
|---|---|---|---|---|---|
| D1. 관계 저장 위치 | 노드 action / ProjectSpec.links[] | **노드 action**. source ID 중복 없이 노드 삭제와 수명 일치. links[]는 여러 이벤트·다중 연결에 유리하나 지금은 별도 source 정리가 필요 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §3·§4, 승인 §8 |
| D2. 종류/순서 | 별도 modal/widget 맵 / 기존 pages+kind | **ScreenSpec의 선택 필드 kind?: page/modal/widget**, 생략=page. 독립 화면 문서(VisualSpec.screen)에도 형태상 들어갈 수 있으므로 §3 "독립 화면 문서" 제약을 함께 승인 범위로 둠. pageOrder는 세 종류 모두 포함하고 첫 항목은 page. 최소 page 한 장 유지. 평상시 종류별 강제 재정렬 없이 배지 표시. 첫 page 삭제 시에만 §4의 최소 재배치 예외 적용 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §3·§4, 승인 §8 |
| D3. action 대상 노드 | button만 / button·frame·text·image / input도 | **초기 button만**. text/image/frame은 접근성 이름·키보드·중첩 상호작용 계약 뒤 확장. input·root·instance 자체도 초기 제외 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §3·§9, 승인 §8 |
| D4. action 형태 | 배열/여러 이벤트 / 단일 유니온 | **navigate(target page), openModal(target modal), close(대상 없음)**. 생략=동작 없음. action 전체 교체, 반응형 override 불가. 외부 URL·조건·폼 동작·이벤트 이름은 넣지 않음 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §3·§5, 승인 §8 |
| D5. 삭제/종류 변경 | 자동 제거 / 변경 거부 / 경고만 | page/modal 삭제는 영향 목록 확인 후 유입 action과 함께 제거, Undo 한 단계. 사용 중 widget 삭제·참조를 깨는 kind 변경은 거부. 무효 참조의 저장을 경고만으로 허용하지 않음 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §4·§5, 승인 §8 |
| D6. 모달 | 중첩 stack / 하나만 표시 | **한 번에 하나**. openModal은 현재 모달 교체, close는 모달 해제, navigate는 모달 해제 후 콜백. backdrop 클릭 시 열린 상태 유지, Escape·명시 close로 닫고 원래 트리거에 포커스 복귀. 크기는 §3의 #280 합의 대기 | 동작 방향 리더 사후 승인(#339) / 크기는 #280 합의 대기 | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §3·§9, 승인 §8 |
| D7. 생성 기본값 | 특정 router / 자체 앱 셸 / 콜백 | **onNavigate(PageId) 콜백 + 페이지 소유 modal 상태**. URL·history·라우터·앱 셸은 사용자 앱 소유. 모달/위젯은 components에 named export 추천 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §6, 승인 §8 |
| D8. 위젯 override | 임의 partial / 반응형 NodeOverride 그대로 / 제한된 내용·색 | **직접 원본 노드의 content·color만** 우선. Text/Button에 한정. NodeOverride는 content를 못 받고 layout까지 허용하므로 그대로 재사용하지 않음 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §4, 승인 §8 |
| D9. 재사용/순환 | 이름으로 합치기 / ref 신원 | **프로젝트 widget PageId로만 공유**, 런타임 DOM ID와 저장 ID 분리. instance 포함 그래프의 자기/간접 순환 금지. navigate/openModal 이동 그래프의 순환은 허용하며 생성 dependsOn에 그대로 옮기지 않음 | 제품 방향 승인 / 설계 리더 사후 승인(#339) | @Yumesa2025(제품 방향 2026-10-09, 리더 2026-10-13) | §4·§9, 승인 §8 |
| D10. Command 제거 표현 | 새 unset 명령 / IR action:null / path 한정 null 삭제 | **전용 제거 명령 `removeNodeAction` + Command 스키마 v0.2**. 값 쓰기와 삭제를 구분하고 IR에는 action을 생략. action 설정은 updateNode 전체 객체 교체, 제거는 이 명령으로만, action.type/target 부분 쓰기 거부. 구버전 소비자는 버전 불일치로 거부. null sentinel·범용 Merge Patch는 제외 | **확정**(명령 이름·버전·위 규칙) / 세부 필드·없는 action 제거 처리는 S1-3의 09 절차 계약 PR | @Yumesa2025(제품 방향 2026-10-09, 리더 결정 2026-10-13) | §5·§9, 승인 §8 |
| D11. 프로젝트 Ticket | 기존 배열+외부 문맥 / sourcePageId 추가 / 새 프로젝트 계약 | **`compileTickets(screen)` 호환 진입점 유지 + 프로젝트 단위 컴파일 추가, Ticket 스키마 v0.2(티켓별 sourcePageId) + 티켓 요청 규약 v4**. 여기서 요청 규약은 ticketProtocol의 `TICKET_PROTOCOL_VERSION`(현재 3)이며 manifest·복구 run.json의 protocol은 바꾸지 않음. 구 스킬(v3)은 버전 불일치로 거부·업데이트 안내. 기존 v0.1·요청 규약 v3을 조용히 재해석하지 않음. 신원·경로는 #357(PageId 생성 자리)·#371(projectId) 기준 | **확정**(진입점·버전·sourcePageId·구 스킬 거부) / 문맥 필드·경로·입력 지문 등 세부는 S1-8/9 착수 전 11·26 계약 PR | @Yumesa2025(제품 방향 2026-10-09, 리더 결정 2026-10-13) | §6·§7, 승인 §8 |

제품 방향 승인과 리더 결정을 같은 칸의 한 상태로 합치지 않는다. 근거는 §8의
[#265 결정 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414)이다.
일반 문서 리뷰와 CI 성공은 설계 승인을 대신하지 않는다. D10/D11은 위 "확정" 범위만 정해졌고,
그 밖의 세부와 D6의 크기는 아직 확정되지 않았다.

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

**종류와 크기(D2/D6, 크기 계약 합의 대기).** page는 기존 size.width·첫 화면 최소 높이와 root.box 무시
계약([25](25-layout-parity-contract.md)의 page 셸 정본)을 그대로 따른다. modal은 size를 패널의 선호 폭·최소 높이로 사용하는 안을 추천한다.
호스트 viewport보다 크면 호스트 안으로 폭/높이를 제한하고 긴 내용은 모달 내부 스크롤로
보인다. root.box로 패널 크기를 중복 지정하지 않는다. 중앙 배치와 반투명 backdrop은
호스트의 표시 정책이며 원본 nodes나 background에 삽입하지 않는다. 편집기의 호스트
미리보기 크기는 문서 외부 뷰 상태다. **이 kind별 size 해석은 기존 page 계약의 변경이
아니지만 새 의미의 추가이므로 #280과 합의·실측 전에는 동등 렌더를 보장하지 않는다.**
backdrop 기본색 추천은 `#00000080`, 편집 옵션/애니메이션/중첩 모달은 후속 범위다.
**열린 항목:** `screen.responsive`가 있는 modal의 폭 해석. 25는 page만 셸을 `width:100%`로
정하므로, modal의 선호 폭·호스트 제한과 어떻게 합칠지는 #280과 함께 정한다.

widget의 size는 단독 편집 미리보기 크기, 배치된 instance.box는 호스트 안의 배치 크기다.
widget에는 페이지 전용 min-height 셸을 넣지 않는다. 원본 root의 트리/표현을 가져오고
호스트의 instance.box가 바깥 크기를 정한다. 반응형 breakpoint는 기존처럼 viewport 폭으로
계산하며 컨테이너 쿼리로 재해석하지 않는 안을 추천한다.

**닫기와 활성화(D3/D6).** 초기 action은 button에만 둔다. 생성은 native
`<button type="button">`을 기본으로 하여 폼 submit을 암묵적으로 만들지 않는다.
button의 내용으로 접근 가능한 이름을 제공하며 빈 이름을 성공으로 보지 않는다.
text/image/frame 활성화는 이름·키보드·focus·중첩 인터랙션 계약을 정한 뒤 별도 확장한다.
특히 자식 button을 가진 frame을 button으로 감싸는 방법은 HTML 제약에 어긋난다(§9).

close는 modal 또는 widget의 button에서 허용한다. widget은 활성 모달 문맥이 없으면
close를 no-op으로 처리하는 세부안을 팀에서 검토한다. page 자체 button의 close는 오류로
제안한다. 모달은 교체하고 stack을 쌓지 않는다. Escape·명시 close로 닫고 backdrop 클릭은
열림을 유지한다. 첫 모달을 연 **원래 트리거**를 보관하여 모달 A→B 교체 후에도 닫으면
그 트리거로 복귀한다. 트리거가 제거되었거나 navigate로 페이지가 바뀌면 호스트가 새 문맥의
논리적 focus 위치를 선택한다. 열릴 때 내부 focus·Tab 순환·외부 비활성·접근 가능한 dialog
이름을 보장하는 것은 후속 생성 검증 조건이며 지금 구현됐다는 뜻이 아니다.

HTML dialog의 showModal과 close 요청 모델을 생성 후보로 검토한다. 단순 open 속성이나
portal 자체만으로 modality·focus가 완성됐다고 보지 않는다. portal 이벤트는 DOM 위치가
아니라 React 트리를 따라 전파되므로, 모달 클릭이 원래 트리거/조상 action을 재실행하지
않도록 호스트 배치 또는 경계의 전파 제어를 검증해야 한다. 무조건 모든 이벤트를 막거나
backdrop 클릭을 닫기로 바꾸지 않는다. Canvas 편집 클릭은 런타임 action을 실행하지 않는다.

**독립 화면 문서.** validateVisualSpec은 구조·해당 화면의 source 규칙만 검사하고
외부 PageId의 존재/종류/cycle 검사는 ProjectSpec 문맥에서 한다는 안을 추천한다.
독립 화면 검증 성공을 관계 해결 성공으로 표시하지 않는다. 관계가 있는 화면만 추출한
파일은 독립 생성/실행을 막고 프로젝트를 요구한다. Open에서 한 페이지 프로젝트로
감싼 후 전체 검증이 실패하면 가져오기를 거부하고 누락 참조를 알린다. 임의 페이지 생성이나
참조 자동 삭제는 하지 않는다. 독립 modal/widget은 첫 page 규칙 때문에 별도 가져오기
흐름 없이 프로젝트로 열 수 없다는 제한은 최소 page 방향에 따른 제약이다. kind는 ScreenSpec의
선택 필드라 독립 화면 문서에도 `kind:"modal"`/`"widget"`이 형태상 들어갈 수 있으며, 이 경우도 같은 제한을 따른다. 가져오기 UX의
오류 안내는 후속 팀 설계에서 확인한다.

## 4. 참조의 수명과 위젯 제안

| 조작 | 추천 정책(미구현) | 원자성/실패 처리 |
|---|---|---|
| source 노드/서브트리 삭제 | 해당 action도 노드와 사라짐 | 기존 노드 삭제 Undo에 포함 |
| page/modal 삭제 | 다른 모든 화면·widget에서 target이 그 ID인 action 제거. 목록/개수 확인 후 실행 | 프로젝트 전체 후보 검사 후 snapshot 한 번. 취소/실패 시 무변경 |
| 마지막 page 삭제·첫 page kind 변경 | 거부 | modal/widget을 조용히 page로 바꾸지 않음 |
| 다른 page가 남은 첫 page 삭제 | 삭제 후 기존 순서상 첫 page 하나만 맨 앞으로 이동. 나머지 항목의 상대 순서는 보존 | D2의 재정렬 금지에 대한 명시적 예외. 삭제·참조 정리·재배치를 같은 Undo 한 단계로 처리 |
| 그 밖의 kind 변경 | 유입 action/ref와 source close 등이 무효가 되면 거부 | 먼저 관계를 명시적으로 정리하도록 안내 |
| 노드 복제·같은 프로젝트 붙여넣기 | 새 로컬 NodeId, PageId target/ref 유지 | 당시 프로젝트에서 검증. 대상이 삭제되었거나 kind가 달라졌으면 붙여넣기 거부 |
| 페이지 복제(현재 API 없음) | 새 PageId, 내부 로컬 NodeId/반응형 참조 일관 복사. 자기 화면을 가리키던 action은 새 PageId, 외부 target/ref는 유지 | 원본은 불변. 기능을 추가할 때 한 history 동작으로 검증 |
| 다른 프로젝트 붙여넣기 | 관계 없는 트리는 허용. action/ref가 있으면 기본 거부 후 명시적 정리/가져오기 안내 | 같은 문자열 ID를 같은 대상이라고 추정하지 않음. clipboard에 문서 출처가 필요하며 영구 ID는 #281과 조율 |
| Group | 원래 button action은 그대로, 새 wrapper에는 없음 | 기존 이동/그룹 history 한 단계 |
| Ungroup | 초기에는 frame action이 없으므로 자식 button action 보존. 향후 frame action을 허용하면 해체 정책을 먼저 설계 | 현재 wrapper 삭제가 미래 frame action까지 보존한다고 주장하지 않음 |
| 사용 중 widget 삭제 | 참조 목록을 제시하고 거부 | 명시 detach 또는 instance 삭제 후 가능. 자동 cascade 삭제 없음 |
| 위젯 원본 노드 삭제/타입 변경 | 해당 노드를 override하는 instance가 있으면 기본 거부 | override 정리 후 재시도. 모든 instance의 유효성 재검사 |

예를 들어 `[pageA, modalM, widgetW, pageB, pageC]`에서 pageA를 지우면
`[pageB, modalM, widgetW, pageC]`로 만든다는 추천이다. 종류별 전체 정렬은 하지 않는다.
이 예외는 D2/D5 제품 방향에 포함되며 팀 계약 검토 대상이다. 아직 현재 동작이 아니다.

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

저장된 PageId/NodeId는 문서 참조용이다. 같은 widget을 여러 번 렌더할 때 이를 그대로
DOM id로 출력하면 중복될 수 있으므로 런타임 인스턴스별 접근성 ID를 별도로 만든다.
React useId는 그 후보이며 저장 ID·Ticket ID·목록 key 생성기로 쓰지 않는다. 같은 widget을
두 번 배치한 경우 dialog 이름/설명 참조도 각각 올바른 DOM을 가리켜야 한다(§9).

## 5. Command·검증·버전 영향

**D10의 공백과 결정:** 현재 [applyCommand](../src/features/editor/command/applyCommand.ts)와
[setByPath](../src/features/editor/store/path.ts)는 값을 쓰기만 한다. JSON에 undefined는
없고 value는 필수라 action을 없애는 명시적 경로가 없다. 2026-10-13 리더 결정으로 **제거 전용 명령
`removeNodeAction`과 Command 스키마 v0.2**를 채택했다. 아래 형태는 설명용 후보이며 정본 명령이 아니다.

```json
{ "type": "removeNodeAction", "id": "loginButton" }
```

| 구분 | 내용 | 정하는 곳 |
|---|---|---|
| 확정(2026-10-13) | 명령 이름 `removeNodeAction`, Command 스키마 v0.2 | 리더 결정 |
| 확정(2026-10-13) | action 설정은 updateNode의 전체 객체 교체, 제거는 `removeNodeAction`으로만. action.type/target 부분 쓰기는 거부 | 리더 결정 |
| 확정(2026-10-13) | 구버전 소비자는 버전 불일치로 거부 | 리더 결정 |
| 미정 | 명령의 필드(위 `id` 형태 포함), action이 없는 노드에서 제거할 때 no-op으로 둘지 실패로 볼지, 버전 불일치를 어디에 표시하고 판정할지 | S1-3의 [09](09-command-schema-freeze.md#command-v02-예정--265-d10) 절차 계약 PR |

범용 필수 필드 삭제나 임의 JSON Pointer 편집을 허용하지 않는다. kind 복귀는 명시 page로 쓴다.
kind/action의 responsive override는 없다. 2차 instance 생성 명령(S2-3)은 이 결정에 포함되지 않으며 09 절차로 따로 정한다.

RFC 6902의 명시 remove와 RFC 7396의 null 삭제를 비교했다(§9). 전자는 삭제 의도를
값 쓰기와 분리하는 근거다. 하지만 여기서 RFC 전체 프로토콜을 도입하는 것은 아니다.
후자는 Merge Patch라는 별도 형식의 의미이며 현재 updateNode의 null에 자동 적용되지
않는다. 따라서 이전 초안의 action 전용 null sentinel·v0.1 유지보다 명시 명령·v0.2를
택했다. **@Yumesa2025가 2026-10-09 제품 방향으로 이 추천의 기록을 승인했고, 2026-10-13 리더 결정으로 확정했다(§8).**

관계 변경은 **모든 쓰기 경로**에서 프로젝트 후보 전체를 검증한 뒤 atomic commit한다.
GUI appliedTransaction은 NL G3를 자동 통과하지 않으므로 kind/action 편집, 노드/페이지
삭제·복제·붙여넣기, 원본 widget/override 편집, 가져오기·NL 적용까지 같은 불변조건을
검사해야 한다. 삭제는 유입 참조 정리·첫 page 재배치를 후보에 포함하여 함께 검증하고
성공할 때만 한 snapshot/Undo 단계로 반영한다. 실패하면 spec·선택·history를 그대로 둔다.
Undo/Redo는 검증된 snapshot을 복원하며 추가 정리를 별도 history 단계로 만들지 않는다.
현재 GUI 배치의 부분 적용 계약을 그대로 재사용해서는 이 원자성을 보장할 수 없다.

S0 승인 → S0-2 → S1-1 별도 스키마 → S1-2 프로젝트 검증 → S1-3 Command → GUI
순서다. S1-2는 #366으로 병합돼 S1-3의 S1-2 선행은 이미 충족됐다(§7).
NL 요청은 현재 page 한 장만 주므로 target을 이름으로 추측하게 하지 않고, 프로젝트의
PageId/name/effective kind 카탈로그 전달을 S1-10에서 NL 요청 규약(nlProtocol) 영향과 함께 검토한다.

| 신규 IssueCode 후보 | 조건 / 검사 경계 |
|---|---|
| action-target-missing | ProjectSpec.pages에 target 없음 |
| action-target-kind | openModal target이 modal 아님 |
| navigate-to-non-page | navigate target이 page 아님(생략 kind는 page) |
| action-source-invalid | page 자체 button의 close 등 형태는 맞지만 문맥상 금지인 source |
| first-page-kind | pageOrder[0]이 page 아님. page-order-mismatch와 구분 |
| instance-ref-missing / instance-ref-kind | ref 없음 / widget 아님 |
| instance-cycle | 프로젝트 내 widget 포함 그래프의 자기/간접 순환 |
| instance-override-invalid | 원본 노드 없음, 타입 불일치, 금지 속성 또는 합성 결과 무효 |

형태 오류(추가 필드·잘못된 enum·비button action·IR null)는 기존 `schema` 코드로 보고한다.
프로젝트 오류 경로는 `/pages/<id>/nodes/<id>/action/target`, `/.../ref`,
`/.../overrides/<sourceNode>`처럼 원인 필드를 가리킨다. 첫 화면 오류는 `/pageOrder/0`이다.
위 표의 S1 다섯 코드(action-target-missing~first-page-kind)는 S1-2에서 이름 그대로 공개 IssueCode에 추가됐다
([06](06-schema-freeze.md#화면-관계-참조-무결성--265-s1-2)). instance 코드는 아직 추가되지 않았으며 S2-2 계약 테스트에서 확정한다.
S1-4 전에는 GUI 페이지 삭제가 유입 action을 정리하지 않아 자동 저장 복원만 관계 코드를 예외로 받는다. Save·NL G3는 계속 엄격하다. 복원 후 Undo 기록은 없으며 first-page-kind는 버튼 삭제로 해결되지 않는다. 오류 상세와 미검증 복구 사본 다운로드 → 별도 사본 외부 수정 → 다른 이름으로 작업공간 specs에 배치 → 실제 파일/열기 목록에서 엄격한 Open 경로는 [06](06-schema-freeze.md#화면-관계-참조-무결성--265-s1-2)을 따른다. 이는 자동 관계 복구나 팀 설계 승인이 아니다.

**IR 버전:** 이슈의 단계 계획은 S1 kind/action 선택 확장에 0.3 유지, S2 instance에 0.4다.
기존 0.3 파일은 새 validator에서 그대로 유효해야 한다. 확장 전 0.3 validator는 추가 속성
금지로 새 필드를 거부하므로 **같은 버전도 양방향 호환이 아니다**. 0.4에서는 두 최상위
문서 버전을 함께 올리는 별도 PR과 타입 생성이 필요하다. migrateToV04는 0.3의 내용은
보존하고 버전만 올리는 안이며, 0.1/0.2는 기존 배경 변환을 거친 뒤 올린다.
무음 downgrade는 금지한다. 옛 도구에 맞추려고 kind/action/instance를 버리거나 0.4 파일의
버전만 낮춰 저장하지 않는다. 이 PR은
버전·정본·생성 타입·예제·기존 [06 동결 계약](06-schema-freeze.md)을 바꾸지 않는다.

## 6. Ticket·생성·Export 추천 경계

**D7/D11:** 기존 compileTickets(screen)를 호환 진입점으로 남기고 별도 프로젝트
컴파일을 추가한다(D11, 2026-10-13 리더 결정). 선택 범위는 프로젝트 전체를 기본으로 하며 page/modal을
구별하고 widget은 ref당 한 번만 생성한다. 이름/구조가 비슷하다는 이유로 서로 다른
화면의 컴포넌트를 공유하지 않는다. 페이지 내부의 기존 반복 추출과 명시 widget 공유는
구분한다. GUI 티켓/실행/Export가 동일한 프로젝트 snapshot과 범위를 보여야 한다.

**소스 확인과 추론:** 현재 compileTickets의 structuralKey는 button의 모양을 비교하고
content를 제외하며, action 항목은 비교하지 않는다. 이것은 현재 정본에 action이 없는
상태의 코드 사실이다. action 도입 뒤 그대로 두면 같은 모양의 서로 다른 동작이 반복
컴포넌트로 합쳐질 수 있다는 것은 **미래 확장에 대한 소스 기반 추론**이며 재현 결과가 아니다.
S1-8에서는 action 없음/type/target을 정규화해 구조 비교에 포함하고 자식 비교에도 반영한다.
동작이 다른 버튼을 포함한 동일 모양 서브트리는 분리한다. 행동을 props로 일반화해 합치는
방식은 이번 기본안에서 제외한다. navigate A/B, navigate/openModal, action 있음/없음
쌍의 분리 테스트를 S1 수용 조건에 넣는다.

1차부터 `instances: NodeId[]`를 해석할 sourcePageId가 필요하다. **Ticket 스키마 v0.2**는 티켓별
`sourcePageId`를 더하고(D11 확정) 기존 로컬 instances를 함께 보관한다. Ticket.kind는 page/component로
유지하는 방향이다. IR의 kind=modal/widget과 Ticket.kind를 같은 enum으로 만들지 않는다.
프로젝트 웨이브는 **티켓 요청 규약 v4**(D11 확정)에서 프로젝트 snapshot·소스 문맥·
전역 티켓/의존 ID를 전달하는 안이다. 현재 요청 규약 v3(#284 staging, #281 생성 자리)은 pageId+page 한 장과
`staging/<requestId>/` 임시 출력을 쓰는 단일 화면 요청이며, 이를 프로젝트 요청으로 재해석하지 않는다.
현재 GUI는 응답의 `protocol`이 `TICKET_PROTOCOL_VERSION`(3)과 다르면 형식 오류로 거부한다
([ticketProtocol](../src/features/editor/ticket/ticketProtocol.ts)). v4에서도 구 스킬(v3)은 버전 불일치로 거부하고
스킬 업데이트를 안내한다(D11 확정).

| 구분 | 내용 | 정하는 곳 |
|---|---|---|
| 확정(2026-10-13) | `compileTickets(screen)` 호환 진입점 유지 + 프로젝트 단위 컴파일 추가 | 리더 결정 |
| 확정(2026-10-13) | Ticket 스키마 v0.2(티켓별 `sourcePageId`), 티켓 요청 규약 v4 | 리더 결정 |
| 확정(2026-10-13) | 구 스킬(v3)은 버전 불일치로 거부하고 업데이트 안내 | 리더 결정 |
| 확정(2026-10-13) | #281 신원·경로는 #357(PageId 생성 자리)·#371(`projectId`) 기준. manifest·복구 `run.json`의 `protocol`은 바꾸지 않음 | 리더 결정 |
| 미정 | v0.2의 나머지 필드·필수 여부, v4 요청의 문맥 필드와 형식, 구 스킬 거부·안내의 문구와 흐름, 아래 입력 지문 전이 집합, 자리 간 import·ZIP 범위 | S1-8/9 착수 전 [11](11-ticket-schema-freeze.md#ticket-v02--티켓-요청-규약-v4-예정--265-d11)·[26](26-agent-request-generation-contract.md#티켓-요청-규약-v4-예정--265-d11) 계약 PR |

#265의 "Ticket은 2차에서 판단"보다 앞당긴 근거는 현재 단일 화면 요청 규약이다. 결론 시한은 S1-8/9 착수 전이며,
이 시점은 #265 본문 "버전" 표에도 반영됐다(§7).

**이름이 같은 세 `protocol`:** 이 문서가 말하는 버전 변경 후보는 티켓 요청 규약
(`ticketProtocol.ts`의 `TICKET_PROTOCOL_VERSION`, 현재 3)뿐이다. 수용 기록
`runtime/generation-manifest.json`의 `protocol`(#281 기준 2)과 복구 기록
`backups/<runId>/run.json`의 `protocol`(2)은 별개 버전이며([26](26-agent-request-generation-contract.md)),
manifest 키·안정 ID 변경은 #281 소관이다. 이 문서는 두 기록의 버전을 바꾸자고 제안하지 않는다.

| 관계 | 런타임/생성 추천 | dependsOn 정책 |
|---|---|---|
| A navigate B, B navigate A | 페이지가 onNavigate(target)를 호출. 서로 import하지 않음 | 이동 edge를 의존 edge로 만들지 않음 |
| page가 modal 열기 | page 호스트가 modal component와 열린 modal ID 상태 소유 | 호스트는 사용하는 modal component에 의존 |
| modal A가 modal B 열기 | openModal 요청을 호스트로 전달. 호스트가 도달 가능한 modal 집합을 중복 없이 보유 | modal끼리 import하지 않음. A↔B가 생성 cycle이 되지 않음 |
| widget 내부 openModal | widget은 호스트 콜백으로 전달, 호스트가 도달 모달 수집 | widget→modal 의존 대신 호스트→modal |
| page/modal/widget가 widget 포함 | ref당 공용 component 한 번, override는 제한된 props로 전달 | 포함 DAG의 자식 widget 먼저 생성 |

onNavigate 필요성은 페이지 자체만 보지 않는다. 페이지와 **포함 widget의 전이적 집합**,
그 안의 openModal로 **도달 가능한 modal 및 그 modal의 widget**을 방문 집합으로 순회한다.
그중 navigate가 하나라도 있으면 생성 페이지가 사용자 앱에서 받는 onNavigate를 필수로
하고 필요한 자손에 전달한다. 모달 A↔B 이동 cycle도 방문 집합으로 종료한다. navigate의 대상 page 자체는
이 호스트 렌더 집합에 포함하지 않으며 서로 import하지 않는다. 모달/위젯 안에만 navigate가
있는 경우 콜백을 누락하지 않는 테스트가 필요하다.

통합하는 사용자 앱이 URL/history와 onNavigate의 실제 처리를 소유한다. 생성 페이지의
모달 호스트는 열린 modal 상태를 소유하고 onOpenModal/onClose를 자손에 전달한다.
일반 임의 props/bindings를 IR에 허용하는 결정은 아니다. 라우트 목록은 PageId→생성 component
매핑 설명이며 URL path·인증·가드·history를 추론하지 않는다. 초기 native button의 navigate는
사용자 앱에서 전달받은 onNavigate를 호출하는 UI 동작이다. URL을 가진 링크와 새 탭 열기
등 링크 의미의 지원은 별도 사용자 앱 통합 계약으로 다룬다. [21](21-app-scope-a11y-design.md)의 앱 셸 제외는 유지한다.

Export는 모든 관련 컴포넌트·상대 import·사용 자산을 포함하고 기존 검사 강도를 낮추지
않는다. 경로/소유권은 아래 #281 합의 뒤 적용한다. 프로젝트 compile은 #282·#284가 정한
staging 확정·수용 기록·쓰기 전 보호([26](26-agent-request-generation-contract.md)) 위에 얹는다.
두 가지를 S1-8/9 게이트로 둔다(§7). 이 둘은 소스와 미병합 PR #357을 보고 한 추론이며 재현하지 않았다.

- **입력 지문 범위:** 현재 생성 세대 판정의 입력 지문은 페이지 하나만 해시한다
  ([contentHash](../src/features/editor/export/contentHash.ts)의 `inputFingerprint(pageId, page)`).
  위 표처럼 host page가 modal component를, 2차에서 instance가 widget을 import하면 modal·widget 원본만
  바꿔도 host 지문이 그대로여서 "현재"로 보일 수 있다. 프로젝트 compile의 입력 지문은 호스트와 도달
  가능한 modal·포함 widget의 **전이 집합**을 포함해야 하며, 이는 #281과 공동 결정한다.
- **자리 간 import와 ZIP 범위:** #281(PR #357, 미병합)이 병합되면 생성 자리가 PageId 단위가 되고
  ZIP 범위가 페이지 자리로 좁아진다. D7처럼 modal·widget을 components의 named export로 두면 host가
  다른 PageId 자리를 import하므로, 자리 간 상대 import 허용 규칙과 여러 PageId 자리를 묶는 ZIP 범위를
  #281 경로 위에서 정해야 한다.

파일 존재 검사를 typecheck·동작 검증·최신 생성 완료로 승격하지 않는다. S1-9/S2-7에서는 독립 앱 typecheck/build,
login→dashboard 및 모달 열기/닫기, 공유 widget 한 번 생성의 fixture를 별도로 검증하고,
S1-11/S2-9 실제 AI 실행 기록은 그와 구분한다.

## 7. 영향 파일·후속 단계와 조율

| 단계 | 선행/승인 조건 | 후속 변경 대상(이번 PR에서 수정하지 않음) |
|---|---|---|
| S0-1 현재 | 결정표 논의·팀 1명 이상 승인 후 병합 | 이 문서와 README 목차만 |
| S0-2 | S0-1 승인·병합 | 02부터 범위 정정, 이어 03, 정정 이력. open-questions의 실제 관련 항목만 처리 |
| S1-1 | S0-1 팀 승인·병합 → S0-2 범위 정정 완료. **#290 2-1/2-3의 선행** | **스키마 + Command 임시 차단(kind/action 경로, G1 createNode; S1-3에서 해제) + 계약 번들 재생성.** schema/visual-spec.schema.json·types.ts(generate-types)·계약 번들(bin/lib/schema.mjs), command/{editablePath,validate}의 임시 차단, 05/06, 기존/신규 예제·테스트 |
| S1-2~4 | S1-1 → S1-2 프로젝트 검증(**#290 2-1/2-3의 선행**) → S1-3 Command → S1-4 참조 조작. 팀 단계 합의 필요. **S1-4는 S1-2의 자동 저장 복원 예외·Save/NL G3 막힘을 해소해야 한다**([06](06-schema-freeze.md#화면-관계-참조-무결성--265-s1-2)) | schema/validate.ts, command/{editablePath,applyCommand,transactionGate,groupCommands}, store/editorStore, ui/clipboard, 09·스토어 계약 |
| S1-5~7/10 | 정본·프로젝트 검증·관계 편집 계약 완료 | PageProperties·LayerTree·HomeScreen/homePreview·InteractionSection·Canvas/CanvasNode·nlScope/nlProtocol·NL 스킬, 08/10 |
| S1-8/9 | S1-1·S1-2 및 D11·#281 경계 합의 후. action을 반영한 structuralKey 비교 포함. **#281 공동 결정 게이트:** 프로젝트 compile의 입력 지문은 호스트 + 도달 가능한 modal·포함 widget(전이 집합), 자리 간 상대 import 허용 규칙·여러 PageId 자리를 묶는 ZIP 범위(#281 경로 위)(§6) | ticket 컴파일/types/schema/티켓 요청 규약·TicketPanel/ticketRunner·Export/generatedPaths(#281 PR #357 병합 시 PageId 자리 기준 갱신)/importScan·contentHash/generationManifest·생성/응답 스킬·사람용 docs/skills, 11·26 |
| S1-11 | S1-5~10 완료 | examples, 07/14/15, README. 실제 AI 검증과 fixture 구별 |
| S2-1/2 | S1-11 및 D8/D9 승인 | instance·0.4·migrateToV04·로드 입구, 생성 타입·05/06·참조 검증. **스키마 단독 PR** |
| S2-3~8 | S2 정본/검증과 계약별 승인 | instance/detach/widget 추출의 프로젝트 원자 연산, 캔버스·GUI·Ticket·Export·NL·스킬. 새 Command 필요 시 09의 버전 합의 |
| S2-9 | S2-4~8 완료 | 공용 widget 예제, 07/14/15/README, 실제 AI·ZIP·독립 앱 검증 |

**S1-1의 임시 차단과 "기능과 분리" 원칙.** [editablePath](../src/features/editor/command/editablePath.ts)는
스키마에서 쓰기 경로를 도출하므로, 스키마만 병합하면 NL/Command가 S1-2 프로젝트 검증 없이 대상 없는
action을 저장할 수 있다(§5 순서·D5 위반). 그래서 S1-1은 kind/action 쓰기 경로와 G1 createNode의
action을 막는 차단을 함께 담고 S1-3에서 해제한다. 이는 [06](06-schema-freeze.md)의 "정본·생성 타입·
계약 테스트 PR은 기능 PR과 분리" 원칙의 예외가 아니다. 새 기능이 아니라 **차단만 추가**하기 때문이다.
S1-1 Draft PR [#355](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/355)가 이 정의를 따른다.

### #265 본문과의 차이 및 갱신 시점

#339는 #265 본문을 수정하지 않고 차이를 epic 담당자에게 전달했다. 2026-10-13 확인한 #265 본문은
아래처럼 갱신돼 있다. 이 PR도 #265 본문을 수정하지 않는다.

| 항목 | #339 작성 당시 #265 | 이 문서의 정정/제안 | 2026-10-13 #265 본문 |
|---|---|---|---|
| 문서 번호 | 문서 절과 S0-1 제목의 파일명이 구 번호이며 README 목차도 17번으로 지정 | 중복을 피한 `docs/24-screen-relations-design.md`, README 24번 | **반영됨.** 문서 절에 `docs/24-screen-relations-design.md`(#339), S0-1 완료 항목에 README 24 행 |
| S1-1 선행 | S0-1만 명시 | S0-2 범위 정정 완료 후 별도 스키마 | **반영됨.** S1-1 선행 S0-1·S0-2, 의존 관계도 S0-1 ─ S0-2 ─ S1-1 |
| S1-1 범위 | "스키마 단독 PR" | 스키마 + Command 임시 차단(S1-3에서 해제) + 계약 번들 재생성(위 "S1-1의 임시 차단") | **반영됨.** S1-1이 "스키마 + Command 임시 차단 + 계약 번들 재생성"이며 #355로 병합 |
| S1-3 선행 | S1-1만 명시. 의존 관계도에서 S1-2와 병렬 | S1-1 **및 S1-2 완료** 후 S1-3 착수 | **표기는 그대로**(선행 S1-1, 의존 관계도 병렬)지만 S1-2가 #366으로 병합돼 착수 조건의 차이는 없다. S1-3에는 "게이트 D10 확정"과 09 계약 PR 선행이 추가됐다 |
| D11 판단 시점 | 버전 표는 Ticket을 2차에서 판단, S1-8은 스키마 영향이 있으면 11 절차를 따름 | S0에서 프로젝트 문맥 설계 논의, **S1-8/9 착수 전** Ticket/티켓 요청 규약 및 #281 경계 합의 | **반영됨.** 버전 표의 Ticket 행이 "v0.2 + 티켓 요청 규약 v4(2026-10-13 리더 결정 D11, S1-8/9 착수 전)", S1-8·S1-9에 "게이트 D11 확정"과 11·26 계약 PR 선행 |

Ticket 스키마·티켓 요청 규약의 버전 번호는 2026-10-13 리더 결정으로 v0.2·v4가 됐다(§6). 두 계약의 나머지 형식은
S1-8/9 착수 전 계약 PR에서 정한다.

#280/#282/#284는 다른 담당자의 레인이므로 이 PR에서 진행하지 않는다. #281/#290 역시
이 PR에서 이슈/브랜치/구현을 변경하지 않고 계약 경계만 기록한다.

- [#280](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/280): 병합된 [25](25-layout-parity-contract.md)는 page 셸 정본이며 modal/widget(#265)에는 이 셸을 적용하지 않는다고 명시한다. modal/widget의 size·viewport·폰트·reset·좌표 비교는 page 계약과 별도로 조율한다. 기존 QA를 새 kind 검증으로 재사용했다고 주장하지 않는다.
- [#290](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/290): 위젯 재사용은 #265, 사용자 스타일·폰트·상태는 #290. [27](27-user-design-system-scope.md)도 공용 컴포넌트를 #265 소관으로 두고, 색·글자 스타일 스키마(2-1)를 #265 S1-1·S1-2 뒤, 상태 스타일(2-3)을 #265 S1 뒤에 둔다(위 표). 제한된 override가 TokenSet/states 채택을 뜻하지 않는다.
- [#281](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/281): project/page/component 안정 신원·rename/copy·전역 이름 충돌·소유권·생성 경로를 S0에서 공동 결정해야 한다. PageId는 프로젝트 내 신원일 뿐 전역 project ID나 manifest를 이 문서가 신설하지 않는다. PR #357(미병합)이 병합되면 §1 Export 행·§6·S1-8/9의 생성 경로 서술을 PageId 자리 기준으로 갱신한다. 입력 지문 전이 집합과 자리 간 import·ZIP 범위는 공동 결정 항목이다.
- [#282](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/282)·[#284](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/284): [26](26-agent-request-generation-contract.md)이 요청 세대(requestId)·staging 확정·수용 기록(generation-manifest)·쓰기 전 수동 변경 보호를 정했고 develop에 구현돼 있다. 프로젝트 compile은 #282·#284가 정한 staging/manifest/쓰기 전 보호 위에 얹으며, 이를 대체하거나 다시 정하지 않는다.

## 8. 승인 기록·남은 합의와 검증 계획

**2026-10-09 제품 방향 승인 기록:** 제품 방향 담당 @Yumesa2025가 조사 결과로 정리한 D1~D9
제품 방향을 #339 문서에 반영하도록 승인했다. D10은 명시적 제거 명령·Command v0.2를
우선 추천하는 방향, D11은 별도 compile 진입점과 #281 합의 후 버전 확정 방향의 승인이었다.
이 승인은 #265에 별도 댓글로 남지 않았고 [PR #339](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/339) 설명에 기록됐다.

**2026-10-13 리더 결정 기록:** 팀 리더 @Yumesa2025가 이 절에서 "팀 승인 대기"였던 항목을 확정했다.
근거: [#265 결정 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414)과
갱신된 #265 본문 "버전" 표.

- 리뷰 없이 병합된 스키마·설계 PR #339(S0-1)·#355(S1-1)·#361(S0-2)·#366(S1-2)을 리더가 **사후 승인**했다.
- epic 완료 판정 1의 승인 조건을 "리더 승인 또는 리뷰어 1명 이상 승인"으로 고쳤다. 이후 스키마·계약 PR도 이 조건을 따른다.
- D10·D11을 아래 표의 범위로 확정했다. 이를 반영하는 문서 PR(이 절과 09·11·26의 예정 절)이 병합된 뒤 S1-3부터 착수한다.

| ID | 결정(제품 방향 2026-10-09 → 리더 2026-10-13) | 후속 PR에서 정할 세부 / 책임 |
|---|---|---|
| D1 | 노드 action 하나. #339 사후 승인, S1-1(#355) 정본에 반영 | links[]를 추가하지 않는 상태 유지 |
| D2 | 기존 pages+선택 kind, 최소 page/첫 page, 삭제 시 최소 재배치. #339 사후 승인, kind는 #355·first-page-kind는 #366에 반영 | 가져오기 오류/Undo 계약(S1-4·S1-5) |
| D3 | 초기 button만. #339 사후 승인, #355에 반영 | native 버튼 이름·키보드 검증. 비button은 후속 접근성/중첩 계약 뒤 |
| D4 | 단일 navigate/openModal/close, 전체 교체, 반응형 제외. #339 사후 승인, 형태는 #355·source/target 검사는 #366에 반영 | Command 경로(S1-3) |
| D5 | 유입 정리 포함 프로젝트 후보 검증·atomic commit·Undo 한 번. #339 사후 승인 | 모든 쓰기 경로의 공통 불변조건, 복제/붙여넣기·widget 삭제 세부안(S1-4 등) |
| D6 | 단일 모달 교체, Escape/명시 닫기, backdrop 유지, 원래 트리거 복귀. #339 사후 승인 | **#280 크기 합의 대기**, close 문맥·focus fallback·native dialog/portal 구현 검증 |
| D7 | router 비의존 콜백·사용자 앱 소유 URL/history. #339 사후 승인 | 포함 widget·도달 modal의 navigate까지 콜백 필요성 계산(S1-9) |
| D8 | 직접 Text/Button 내용·글자색, base→responsive→instance. #339 사후 승인 | override 오류·원본 변경·detach 계약(S2) |
| D9 | 프로젝트 widget ID 공유·포함 cycle 금지·저장/DOM ID 분리. #339 사후 승인 | 런타임 ID 충돌 방어(S2) |
| D10 | **확정:** 전용 제거 명령 `removeNodeAction` + Command 스키마 v0.2. action 설정은 updateNode 전체 객체 교체, 제거는 이 명령으로만, action.type/target 부분 쓰기 거부. 구버전 소비자는 버전 불일치로 거부 | **S1-3의 09 절차 계약 PR:** 명령 필드, 없는 action 제거 시 처리, 버전 불일치 표시·판정 방식(§5) |
| D11 | **확정:** `compileTickets(screen)` 호환 진입점 유지 + 프로젝트 단위 컴파일 추가. Ticket 스키마 v0.2(티켓별 `sourcePageId`) + 티켓 요청 규약 v4. 구 스킬(v3)은 버전 불일치로 거부·업데이트 안내. #281 신원·경로는 #357·#371 기준. manifest·`run.json`의 `protocol`은 그대로 | **S1-8/9 착수 전 11·26 계약 PR:** 문맥 필드·나머지 Ticket 필드, 입력 지문 전이 집합, 자리 간 import·ZIP 범위(§6) |

| 계획 변경 | 방향 | 승인자 | 근거 |
|---|---|---|---|
| S0-2 뒤 S1-1, S1-2 뒤 S1-3, 이후 GUI | S1-1 선행·범위는 #265 본문에 반영. S1-3 선행 표기는 S1-1 그대로지만 S1-2(#366) 병합으로 충족(§7) | @Yumesa2025(리더, 2026-10-13) | [#265 결정 댓글](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265#issuecomment-6142842414)·#265 본문 |
| D11 논의를 S0에서 시작, S1-8/9 전 합의 | #265 본문 버전 표·S1-8/9 게이트에 반영. #281 기준은 #357·#371 | @Yumesa2025(리더, 2026-10-13) | 동일 |

별도 스키마 PR의 분리와 계약별 변경 절차는 유지한다. 승인 조건은 리더 승인 또는 리뷰어 1명 이상 승인이며,
CI는 승인을 대신하지 않는다.

**#339의 검증:** 근거 파일/상대 링크 존재, README 항목, whitespace, 변경 범위가
두 Markdown 파일인지, 정본·생성 타입·동결 계약이 그대로인지 확인한다. 실행한 기존
회귀 검사 결과는 PR 본문에 기록한다. 미래 기능의 fixture/브라우저/실제 AI 성공을 주장하지 않는다.

**후속 수용 테스트:** kind 생략/명시 page 동등성, 모든 action 갈래/잘못된 source·target,
단독 화면 문맥 제한, 첫/마지막 page, 삭제 취소·동시 정리·Undo/Redo, 참조 대상 kind 변경,
동일/다른 프로젝트의 복제·붙여넣기·ID 충돌, button Group/Ungroup, widget 직접/간접 cycle,
override 타입/누락 원본/반응형 합성, 같은 이름 페이지·widget의 Ticket 충돌, 이동 cycle과
의존 DAG 분리, 다른 action의 반복 추출 분리, 위젯/모달 내부 navigate 콜백, 중복 widget DOM ID,
모달 교체 후 원래 트리거 focus·portal 전파·스크롤, modal·widget 원본만 바뀐 host의 생성 세대 "오래됨" 판정,
자리 간 상대 import/ZIP/독립 앱을 확인한다.
스키마 PR은 generate:types와 기존 예제 통과를 포함하고, 후속 코드 PR은 typecheck·lint·
전체 test·build를 통과해야 한다([CONTRIBUTING](../CONTRIBUTING.md), 06/09/11).

## 9. 공식 자료 대조와 선택 근거

2026-10-09에 아래 공식 원문을 직접 읽었다. **자료에 적힌 사실**과 **이 프로젝트의
선택/추론**을 구분한다. 문서 조사는 브라우저 실험·신규 기능 fixture·실제 AI 실행이 아니다.

| 공식 자료 | 직접 확인한 사실 | 이 설계의 선택 / 배제 근거 |
|---|---|---|
| [React useId](https://react.dev/reference/react/useId) | 접근성 속성용 고유 ID를 생성하며 목록 key 생성에는 쓰지 않도록 안내 | D9: 반복 widget의 DOM id에는 런타임 ID, 저장 PageId/NodeId와 Ticket 신원에는 문서 데이터 사용. useId를 IR ID 생성기로 쓰지 않음 |
| [React createPortal](https://react.dev/reference/react-dom/createPortal) | DOM 배치를 옮겨도 이벤트는 React 트리를 따라 전파. focus 관리는 별도 필요 | D6: portal이 이벤트 격리·접근성을 자동 보장한다는 가정 제외. 호스트 배치/전파 경계 검증 |
| [W3C APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | 접근 가능한 이름, Enter/Space 활성화, 행동과 역할의 일치를 설명 | D3: 초기 native button만. frame/text/image에 onClick만 붙이는 근사 제외 |
| [W3C APG Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 내부 focus와 Tab 순환, Escape 닫기, 보통 호출 요소로 복귀하며 요소 소멸/문맥 변경은 예외 | D6: 원래 트리거 복귀와 논리적 fallback. 단일 교체·backdrop 유지는 표준의 강제가 아니라 제품 방향 선택 |
| [HTML button](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element) | button 내부의 interactive content 및 tabindex 자손 제한, type별 동작 구분 | D3: type=button 명시, 클릭 frame을 button으로 감싸 자식 button을 중첩하는 방법 제외 |
| [HTML dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) | showModal의 modal 동작 및 closedby의 close request/light dismiss 구분 | D6: native dialog 후보를 검토하되 backdrop 클릭 닫기(any)는 기본 방향에서 제외. 실제 지원 브라우저·cancel/close 상태 동기화는 후속 검증 |
| [JSON Schema additionalProperties](https://json-schema.org/understanding-json-schema/reference/object#additionalproperties) | false는 선언되지 않은 추가 속성을 거부 | 구 validator가 kind/action을 거부한다는 결론은 정본과 이 규칙을 대조한 추론. 0.3 선택 확장을 양방향 호환으로 표현하지 않음 |
| [RFC 6902 §4.2](https://www.rfc-editor.org/rfc/rfc6902#section-4.2) | remove는 명시적 연산이며 대상이 존재해야 성공 | D10: 삭제 의도를 분리하는 근거. 전체 JSON Patch 도입이나 같은 오류 정책의 무승인 채택은 아님 |
| [RFC 7396 §1–2](https://www.rfc-editor.org/rfc/rfc7396#section-2) | Merge Patch의 null은 제거 의미이고 명시 null을 사용하는 데이터에는 제약 | D10: 일반 값 쓰기에 null 삭제 의미를 덧씌우지 않음. 범용 Merge Patch와 전용 null sentinel 대신 제거 명령을 우선 추천 |

소스 근거는 §1과 §5–6의 링크 및 위 develop SHA로 고정한다. 특히 structuralKey의
동작 누락 위험, GUI G3 우회 위험, 콜백 필요성의 전이적 계산은 소스·선택 방향을 조합한
설계 추론이다. 실제 실패/성공 재현이라고 기록하지 않는다.

## 10. S1-3/4 첫 전달의 구현 경계 제안 (2026-10-15)

현재 develop `126bad5ed660ac33ded034bad7ce5590846b674d`와 #378을 대조했다.
[09의 S1-3 선행 계약 제안](09-command-schema-freeze.md#s1-3-구현-선행-계약-제안--2026-10-15)은
Command v0.2 봉투·removeNodeAction·NL protocol 2의 구체 동작을 리뷰 대상으로 제시한다.
아래는 S1-4 구현/수용 조건이며 아직 구현됐다는 뜻이 아니다. S2와 생성 기능은 제외한다.

### GUI 프로젝트 원자성

`editorStore.appliedTransaction`은 현재 responsive 화면만 검사하며, `removePage`는
페이지 수만 확인하고 유입 action을 정리하지 않는다. `runTransactionGates`는 이미
전체 프로젝트를 검사하므로 이를 새 검증기로 대체하지 않는다.

1. 페이지 삭제 전에 살아남는 모든 화면의 유입 navigate/openModal 목록을 만든다.
   확인창에 source 페이지/노드 이름·ID와 개수를 표시한다. 삭제 대상 내부의 action은
   페이지와 함께 사라지므로 유입 정리 목록에서 제외한다.
2. 취소는 store 호출·spec·선택·history·저장 내용에 변화가 없어야 한다. 확인 요청은
   **열린 문서의 documentId + projectId, 대상 PageId + 대상 화면 snapshot, 검토한 전체 유입 영향**에
   결합한다. 확인 시작 시 프로젝트 spec 참조와 pageOrder도 캡처한다. 유입 영향은 살아남는 모든
   페이지를 순회한 `(source PageId, source NodeId, action 전체)` 목록이며 표시한 페이지/노드 이름도
   보존한다. 목록은 ID 순으로 정규화하고 count만 비교하지 않는다.
   승인 직전 store의 현재 상태와 비교해 문서·대상·영향·순서가 같을 때만 후보를 계산한다.
   이 첫 구현은 보수적으로 **확인 대기 중 spec/documentId/projectId 변경을 store 구독으로 관찰하면
   해당 확인 토큰을 영구 무효화**한다(무관한 편집, Undo로 내용이 같아진 경우도 포함).
   최종 참조 비교만으로는 편집→Undo가 원래 spec 참조를 복원하는 경우를 놓치므로, 한 번 무효화한
   토큰은 원래 값으로 돌아와도 다시 유효하게 하지 않는다. 구독은 snapshot 캡처와 같은 동기 단계에서
   설치하고 취소/거부/성공 때 해제한다. 문서가 바뀌었거나 대상이 없어지면 닫고 무변경으로 끝낸다.
   같은 문서에 대상이 남아 있으면 사용자가 다시 삭제를 요청하여 최신 영향 목록에 새로 확인한다.
   새 유입 참조가 생겼다고 예전 승인을 그 참조 삭제까지 확대하지 않는다. 거부 메시지는 다시
   확인해야 하는 이유를 알리며 기존 승인으로 자동 재실행하지 않는다.
   비교 → 후보 계산 → 전체 검증 → commit은 await 없는 단일 store 갱신 안에서 수행한다.
   갱신 사이에 달라진 상태를 검사 없이 다시 읽어 커밋하지 않는다. 현재 direct-edit의
   `gui-state.stateRevision`은 활성 페이지 한 장의 지문이므로 이 프로젝트 전체 확인 토큰으로
   재사용하지 않는다. 다른 페이지의 유입 변경을 놓치기 때문이다.
3. 최소 한 장의 effective kind=page(생략도 page)를 유지한다. 마지막 실제 page 삭제는
   modal/widget이 여러 장 있어도 거부한다. 첫 page 삭제 시 남은 첫 실제 page 하나만
   맨 앞으로 옮겨 나머지 상대 순서를 보존한다.
4. 후보에서 삭제할 페이지와 모든 유입 action 속성을 제거하고 프로젝트 전체를 검증한다.
   실패 시 원본/선택/history를 유지하고 이유를 알린다. 성공 시 한 번의 store 변경과
   snapshot으로 커밋하여 구독자·자동 저장에 중간 dangling 상태가 보이지 않게 한다.
5. Undo 한 번은 페이지·유입 action·순서·활성 페이지를 함께 복원하고 Redo는 다시 제거한다.
   다른 페이지의 action과 원본 객체는 불변으로 보존한다.

`addPage`는 현재 빈 일반 page를 만든다. 페이지 복제 API는 현재 없으므로 새로 만들지 않는다.
기존 노드 복제·Group/Ungroup은 자식 button의 action을 보존하고 최종 프로젝트 후보를 검증한다.
kind/action을 쓰는 GUI 단일·배치 경로, paste, 외부 교체 경로도 조사하여 검증 우회를 남기지 않는다.

### 클립보드 신원

현재 clipboard는 NodeSubtree만 저장한다. 복사 시 저장된 projectId와 현재 documentId를
함께 캡처한다. 양쪽 projectId가 존재하면 정확히 같은 projectId만 같은 프로젝트로 판정한다.
ID가 없는 구 문서에는 같은 열린 문서의 documentId만 fallback으로 쓰며 이름·PageId 문자열은
신원으로 쓰지 않는다. 불러오기에서 projectId를 부여하는 기존 #371 처리를 유지한다.

다른/출처 불명 프로젝트의 action 보유 트리는 **붙여넣기 전체를 거부**하고 원본에서 연결을
명시 제거한 뒤 다시 복사하도록 안내한다. close도 문맥을 가지므로 포함한다. 같은 문자열
PageId가 대상에 있어도 자동 재연결하지 않는다. 관계 없는 트리는 기존대로 허용한다.
같은 프로젝트라도 대상 삭제/종류 변경 또는 close의 source 문맥 변경은 전체 후보 검증에서
거부한다. clipboard 스냅숏의 action을 조용히 지우거나 변경하지 않는다.

### 이전 자동 저장본의 보존

새 GUI가 무효 참조를 만들지 않아도 이전 버전의 자동 저장본은 남는다. `specStorage`의
관계 오류 전용 복원 예외를 단순 삭제하면 기존 문서가 seedSpec으로 바뀐다. 따라서 S1-4에서
이전 자동 저장본을 버리는 방식으로 예외를 "해소"하지 않는다. 관계 오류만 있는 과거 문서는
원문 그대로 복구하고 기존 오류 안내·미검증 복구 사본 다운로드를 유지한다. Open·Save·NL G3는
계속 엄격하며, 정상 후보가 되기 전 저장 성공으로 표시하지 않는다. 복구본의 자동 관계 삭제나
kind 변환도 하지 않는다. 기존 구조 오류 처리까지 넓히는 마이그레이션은 이번 범위가 아니다.

새로 수행한 정상 삭제는 Save→Open·자동 저장→reload 모두 유효하게 돌아와야 한다.
과거 dangling/first-page-kind는 별도 고정 fixture로 검사한다. 기존 restore 테스트가 GUI 삭제로
무효 문서를 만들고 있어, 삭제가 고쳐지면 그 fixture 생성법도 바꿔야 한다. 과거 무효 문서 검사
자체를 지우거나 새 정상 삭제의 기대를 여전히 invalid로 두지 않는다.

### S1-4 수용 테스트

취소/확인, 여러 페이지의 유입 정리, 마지막 실제 page 차단, 첫 page 최소 재배치,
한 번의 Undo/Redo, 구독자에게 중간 상태 미노출, 같은/다른 프로젝트의 같은 PageId 충돌,
복사 후 대상 삭제·kind 변경, close를 page에 붙이기, 복제·Group/Ungroup 보존,
정상 삭제 후 Save/Open/reload, 과거 무효 자동 저장본 보존을 각각 검사한다.
사용자 확인 경로는 브라우저에서도 실행하고 fixture 검증과 실제 AI 실행을 구분한다.

확인 대기 회귀 시나리오는 다음처럼 별도로 고정한다(구현 PR에서 store/브라우저 검증).

| 확인 후 승인 전 변화 | 요구 결과 |
|---|---|
| 다른 문서를 열었는데 같은 PageId가 있음 | documentId/projectId 불일치로 거부; 새 문서 무변경 |
| 같은 projectId 문서를 다시 열었음 | documentId 불일치로 거부 |
| 대상 삭제 후 같은 PageId로 재생성, 또는 대상 내용/이름 변경 | spec/대상 snapshot 불일치로 거부 |
| 다른 페이지에서 유입 action 추가·제거·종류 변경 | 전체 영향/spec 불일치로 거부; 새 목록 확인 필요 |
| 유입 개수는 같으나 source 노드 또는 action이 교체됨 | count가 같아도 거부 |
| 순서 변경, 무관한 편집, 편집 후 Undo | 보수적 spec 참조 변경 정책으로 거부 |
| 선택만 변경, spec/문서/대상/영향은 그대로 | 선택 변경만으로 승인을 확대하지 않으며 기존 삭제 후보 적용 가능 |
| 변경 없음 + 취소 / 변경 없음 + 확인 | 각각 무변경 / 유입 정리와 삭제를 한 Undo로 커밋 |

취소/낡은 확인 거부의 무변경은 **승인 직전 현재 상태**를 기준으로 한다. 확인을 기다리며
사용자가 수행한 별도 편집을 옛 snapshot으로 되돌려서는 안 된다. 이 PR의 revision 조사 테스트는
다른 페이지 유입 변경이 현재 direct-edit 지문에 잡히지 않는다는 근거만 확인하며, 아직 존재하지
않는 삭제 확인 토큰 구현의 통과 근거가 아니다.
