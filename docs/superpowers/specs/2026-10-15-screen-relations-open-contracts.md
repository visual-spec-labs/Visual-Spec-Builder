# #265 D6·D11 남은 계약 제안 — 승인 전, 런타임 변경 없음

상태: **제안 / 미승인**. 이 문서는 구현 허가나 최종 wire schema가 아니다. 현재 정본은
[24 설계](../../24-screen-relations-design.md), [11 Ticket 동결](../../11-ticket-schema-freeze.md),
[26 요청·생성 계약](../../26-agent-request-generation-contract.md)이다. 아래 미정 항목은 관련 담당자의
계약 리뷰 후 정본 문서와 별도 schema PR로 확정한다. S1-7 모달 geometry 및 S1-8/9 생성 런타임은 아직 구현하지 않는다.

## 확정 사항과 제안 경계

- D6: 모달 하나, 교체 방식, backdrop 클릭 유지, Escape/명시 close, 트리거 포커스 복귀는 기존 승인 방향이다.
  모달 크기·viewport·반응형 폭·측정 조건은 #280의 page 셸 계약을 그대로 적용할 수 없다.
- D11: Ticket v0.2·티켓 요청 v4·티켓별 sourcePageId, compileTickets(screen) 호환 진입점 유지,
  구 스킬 버전 거부는 확정 방향이다. 이 문서가 버전 번호를 다시 결정하지 않는다.
- 현재 실행되는 티켓 요청은 protocol 3이다. generation-manifest/run.json 버전은 별개이며 변경하지 않는다.
- NL destinations는 읽기 전용 대상 metadata다. 생성용 프로젝트 snapshot이나 Ticket v4 문맥을 대신하지 않는다.
- instance·위젯 재사용을 새로 정의하거나 S2를 앞당기지 않는다.

## D6 — 리뷰할 geometry 선택안

| 항목 | 권장안(미승인) | 대안/리뷰 질문 |
|---|---|---|
| 선호 크기 | modal의 size.width는 선호 폭, size.height는 최소 콘텐츠 높이로 해석 | 두 값 모두 고정 크기로 해석할지 #280 합의 필요 |
| viewport 제한 | 호스트 가용 영역 안에서 패널 폭/높이를 제한하고 긴 콘텐츠는 패널 내부 스크롤 | 여백의 정확한 값·token, safe area와 모바일 키보드 정책 미정 |
| 반응형 기준 폭 | 실제로 제한된 modal 콘텐츠 폭으로 override 선택 | 호스트 viewport 폭 기준 대안과 breakpoint 경계 동작 비교 필요 |
| 좌표/루트 | page 셸의 root.box 무시 규칙을 자동 상속하지 않음 | modal root.box/size 충돌 시 어떤 값이 우선인지 명시 필요 |
| 시각 정책 | 배경막·중앙 정렬은 호스트 표현으로 분리 | backdrop 색/token, 패널 테두리/그림자 기본값 미정 |

권장안을 채택하기 전 수용 fixture: 작은/큰 viewport, 가용 폭보다 큰 선호 폭, 긴 콘텐츠,
중첩된 스크롤, breakpoint 바로 전/경계/직후, 폰트·reset 고정, Escape/교체/트리거 제거 시 포커스.
page 레이아웃 parity 통과를 modal parity로 세지 않는다. 정확한 geometry가 승인되기 전 스크린샷 수치나
CSS fallback 값을 현재 제품 계약으로 고정하지 않는다.

## D11 — 최종 JSON Schema 전에 리뷰할 요청/티켓 형태

다음 이름과 필수성은 모두 **후보**다. 배포된 parser/skill이 읽는 wire 예제가 아니다.

| 경계 | 권장 후보 | 승인 때 결정할 사항 |
|---|---|---|
| 프로젝트 compile 입력 | project snapshot + 명시 rootPageIds | 전체 프로젝트 생성과 선택 호스트 생성의 UI 범위/필수 필드 |
| Ticket v0.2 | 모든 프로젝트 티켓에 sourcePageId 필수, 안정 ticketId와 의존 ID를 별도 보유 | 단일 screen 호환 진입점의 반환 타입/버전, PageId가 없는 호출자의 명시 문맥 인자 vs v0.1 유지 |
| v4 요청 문맥 | 생성 범위의 불변 snapshot, sourcePageId, 전역 ticket/dependsOn 목록 | 전체 project 전달 vs 도달 집합만 전달; 정확한 필드 이름·null/생략·추가 속성 정책 |
| 응답 | 요청 ID/버전 및 요청이 허용한 티켓·파일 자리만 응답 | 부분 실패/완료 표현, 중복 ID·없는 ID·범위 밖 PageId의 거부 코드 |
| 버전 거부 | v3 스킬은 v4 요청을 생성하지 않고 업데이트 안내 | 실제 구 producer/consumer fixture로 양방향 실패를 고정; 버전 자동 주입·downgrade 금지 |
| 입력 지문 | 호스트 + 도달 modal의 전이 집합을 안정 ID 순서로 정규화 | #281과 이름 변경·순서 변경·관계 변경·공통 의존 변경의 current/stale 판정 합의 |
| 파일 경로와 ZIP | 기존 projectId/PageId 생성 자리를 유지 | 자리 간 상대 import 허용 경계, 선택 호스트 ZIP에 필요한 도달 파일 포함 범위 |

호환 진입점이 가진 정보로 존재하지 않는 PageId를 만들어서는 안 된다. 권장안은 기존
compileTickets(screen)의 기존 결과 계약을 보존하고 프로젝트 API에서만 v0.2를 명시 제공하는 것이다.
이를 확정하려면 두 결과 타입/검증기·사용자가 혼동하지 않는 호출 이름을 11 계약에서 결정해야 한다.

navigate A↔B는 런타임 이동이지 코드 import 의존이 아니다. openModal A↔B는 호스트의 방문 집합으로
수집하고 모달끼리 import해서 생성 cycle로 만들지 않는다. D11 지문·의존 규칙은 이 두 그래프를 구분해야 한다.
S2가 승인되기 전 instance closure나 widget 포함 코드를 런타임에 추가하지 않는다.

## 승인과 구현 전 수용 조건

1. D6 geometry는 #280 담당과, D11 신원·지문·경로·ZIP은 #281 담당과 정본 문서에서 합의한다.
2. Ticket v0.2 및 요청 v4의 exact JSON 예제/필수 필드/오류/구소비자 거부를 계약 PR에서 확정한다.
3. 스키마 변경은 별도 PR로 생성 타입·정본 번들을 함께 갱신하고 리더 또는 리뷰어 승인과 필수 CI를 거친다.
4. 이후에만 프로젝트 compiler·GUI 범위·producer skills·검증기·Export를 함께 구현한다.
5. fixture typecheck/build와 실제 AI 생성 검증을 분리해 보고한다. 현재 이 제안은 어느 쪽의 런타임 완료도 주장하지 않는다.
