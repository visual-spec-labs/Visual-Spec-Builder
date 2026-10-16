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
- S1-10의 NL `destinations`는 별도 미병합 PR #387의 읽기 전용 대상 metadata 제안이다.
  이 브랜치의 현행 NL 계약에는 없으며, 채택되더라도 생성용 snapshot이나 Ticket v4 문맥을 대신하지 않는다.
- instance·위젯 재사용을 새로 정의하거나 S2를 앞당기지 않는다.

## D6 — 리뷰할 geometry 선택안

| 항목 | 권장안(미승인) | 대안/리뷰 질문 |
|---|---|---|
| 선호 크기 | modal의 size.width는 선호 폭, size.height는 최소 콘텐츠 높이로 해석 | 두 값 모두 고정 크기로 해석할지 #280 합의 필요 |
| viewport 제한 | 호스트 가용 영역 안에서 패널 폭/높이를 제한하고 긴 콘텐츠는 패널 내부 스크롤 | 여백의 정확한 값·token, safe area와 모바일 키보드 정책 미정 |
| 반응형 기준 폭 | 호스트 CSS viewport 폭으로 override 선택; 패널 clamp와 독립 | modal 콘텐츠 폭 기준은 별도 컨테이너 쿼리 의미이므로 이번 권장안에서 제외 |
| 좌표/루트 | 패널 크기는 size와 호스트 clamp가 소유하며 root.box로 중복 지정하지 않음(24 §3 추천) | 내부 루트 좌표·padding/box-sizing·기존 root.box 처리의 정확한 규칙은 #280 합의 필요 |
| 시각 정책 | 배경막·중앙 정렬은 호스트 표현으로 분리 | backdrop 색/token, 패널 테두리/그림자 기본값 미정 |

### 반응형 선택과 패널 배치를 분리하는 권장안(미승인)

호스트 CSS viewport 폭을 W라 하면 modal 자체의 breakpoint에서 `minWidthPx <= W`인
희소 override를 오름차순 누적한다. 예를 들어 W=1024이고 패널 폭이 480이어도 768 breakpoint는
적용한다. 패널 clamp가 다시 breakpoint를 바꾸는 피드백 루프를 만들지 않는다. 단독 편집에서도
명시한 호스트 미리보기 폭을 쓰며 그 값은 문서 외부 뷰 상태다. 핀치 줌·키보드의 visual viewport를
breakpoint 기준으로 대체할지는 별도 결정이며, 현재 권장안은 CSS media query와 같은 기준이다.

배치는 별도로 호스트의 가용 폭 Aw·높이 Ah(여백·safe area 차감)를 구한다. 패널 폭은
`min(size.width, Aw)`, 최소 높이는 `min(size.height, Ah)`, 최대 높이는 Ah로 제한하는 안이다.
가로·세로를 각각 제한하며 종횡비로 함께 축소하거나 내부 좌표 전체를 scale하지 않는다.
콘텐츠가 최소 높이보다 길면 Ah까지 늘고, 그 뒤 패널 내부에서 세로 스크롤한다. 고정 폭 자식의
가로 overflow도 내부에서 접근 가능하게 하는 안이며 잘라 숨기는 것을 성공으로 보지 않는다.
배경 페이지 스크롤 잠금/복구, 내부 중첩 스크롤의 경계 전달, 포커스 항목 노출도 수용 조건이다.
가용 영역이 0에 가까울 때의 최소 여백, 정확한 여백 token, 키보드 대응, 스크롤바/padding의
측정 포함 여부는 아직 제품 결정이 필요하다. 이 식은 CSS 구현 완료나 승인된 수치를 뜻하지 않는다.

권장안을 채택하기 전 수용 fixture: 작은/큰 viewport, 가용 폭보다 큰 선호 폭, 긴 콘텐츠,
중첩된 스크롤, breakpoint 바로 전/경계/직후, 폰트·reset 고정, Escape/교체/트리거 제거 시 포커스.
page 레이아웃 parity 통과를 modal parity로 세지 않는다. 정확한 geometry가 승인되기 전 스크린샷 수치나
CSS fallback 값을 현재 제품 계약으로 고정하지 않는다.

## D11 — 최종 JSON Schema 전에 리뷰할 요청/티켓 형태

다음 이름과 필수성은 모두 **후보**다. 배포된 parser/skill이 읽는 wire 예제가 아니다.

| 경계 | 권장 후보 | 승인 때 결정할 사항 |
|---|---|---|
| 프로젝트 compile 입력 | 첫 제공은 불변 project snapshot 전체(page/modal), pageOrder 보존 | 선택 호스트/부분 compile은 후속으로 분리; rootPageIds를 첫 버전 필수 필드로 도입하지 않음 |
| Ticket v0.2 | 모든 프로젝트 티켓에 sourcePageId 필수, 안정 ticketId와 의존 ID를 별도 보유 | 단일 screen 호환 진입점의 반환 타입/버전, PageId가 없는 호출자의 명시 문맥 인자 vs v0.1 유지 |
| v4 요청 문맥 | 전체 프로젝트 snapshot, sourcePageId, 전역 ticket/dependsOn 목록 | 웨이브별 실행 티켓 부분집합과 전체 compile 범위 구별; 정확한 필드 이름·null/생략·추가 속성 정책 |
| 응답 | 요청 ID/버전 및 요청이 허용한 티켓·파일 자리만 응답 | 부분 실패/완료 표현, 중복 ID·없는 ID·범위 밖 PageId의 거부 코드 |
| 버전 거부 | 새 GUI가 만든 v4 요청을 설치된 v3 스킬이 소비할 때 출력 쓰기 전에 거부하고 업데이트 안내 | 실제 v3 스킬 fixture로 검증; 구 GUI v3 요청 + 새 v4 스킬의 수용 여부는 별도 결정, 자동 downgrade 금지 |
| 입력 지문 | 호스트 + 도달 modal·포함 widget의 전이 집합을 안정 ID 순서로 정규화 | 아래 cycle-safe 수집·무효화 규칙을 #281과 합의; S1에서는 widget 집합이 비어도 계약에서 제거하지 않음 |
| 파일 경로와 ZIP | 기존 projectId/PageId 자리 위에 프로젝트 내부 정규 상대 경로를 사용 | 아래 프로젝트 루트·자산 대응과 실제 디스크/ZIP 배치의 exact 계약을 #281과 합의 |

호환 진입점이 가진 정보로 존재하지 않는 PageId를 만들어서는 안 된다. 권장안은 기존
compileTickets(screen)의 기존 결과 계약을 보존하고 프로젝트 API에서만 v0.2를 명시 제공하는 것이다.
이를 확정하려면 두 결과 타입/검증기·사용자가 혼동하지 않는 호출 이름을 11 계약에서 결정해야 한다.

navigate A↔B는 런타임 이동이지 코드 import 의존이 아니다. openModal A↔B는 호스트의 방문 집합으로
수집하고 모달끼리 import해서 생성 cycle로 만들지 않는다. D11 지문·의존 규칙은 이 두 그래프를 구분해야 한다.
S2가 승인되기 전 instance closure나 widget 포함 코드를 런타임에 추가하지 않는다.

### 최초 compile/실행/Export 범위(미승인 구체안)

24 §6의 프로젝트 전체 기본 방향을 따른다. 첫 제공은 모든 page/modal을 compile하므로
아직 어떤 page에서 열리지 않는 modal도 누락하지 않는다. 활성 페이지는 편집 선택일 뿐 compile
필터가 아니다. GUI 티켓 목록·실행 계획·Export는 같은 snapshot과 전체 범위를 표시한다.
웨이브 실행이나 재시도에서 일부 티켓만 실행하는 것은 별도 작업 계획이며 범위를 암묵적으로
축소하지 않는다. 프로젝트 전체를 검사한 뒤 invalid target/kind면 계획 생성 전에 거부한다.
선택 호스트 생성·부분 ZIP UI는 후속 결정으로 남긴다. widget ref당 한 번이라는 기존 설계는
보존하지만 이번 제안으로 instance 처리나 S2 런타임을 구현하지 않는다.

### 프로젝트 내부 import·자산·ZIP 경계(미승인)

projectId는 소유권 신원이고 표시 이름/실제 outputDir과 구분한다. 기존
`generated/<outputDir>/<PageId>/pages|components/...` 자리를 정규 소스로 유지하는 안이다.
modal마다 하나의 자기 PageId 자리에서 생성하고 여러 호스트는 그 파일을 참조한다. 같은 이름의
다른 PageId 컴포넌트를 합치거나 호스트마다 modal 복사본을 만들지 않는다.

상대 import는 importing 파일 기준으로 정규화한 뒤 **동일 projectId의 승인된 출력 루트 안**에서
요청의 전역 티켓/파일 목록에 있는 대상으로만 허용한다. `..` 자체를 금지하지 않지만 프로젝트
루트 탈출, 다른 프로젝트·staging·backup 참조, 절대 경로, 정규화 별칭 충돌은 거부한다.
심볼릭 링크 등 실제 파일 해석에서도 같은 경계를 보장해야 한다. 이 규칙은 현재 단일 자리
검사를 이미 넓혔다는 뜻이 아니며 기존 검사 강도를 낮추는 예외도 아니다.

자산은 프로젝트 범위의 정규 상대 경로로 한 번 매핑하고 파일명 basename만으로 합치지 않는 안이다.
현재 작업공간 `assets/` 원본을 읽는 경우에도 요청 snapshot에 그 프로젝트의 참조→원본→ZIP 경로
대응을 명시하고 다른 프로젝트 파일을 자동 탐색하지 않는다. 사용 자산만 포함하며 충돌/누락은
거부한다. data URL·외부 URL 정책과 자산 바이트 지문은 아래 결정 항목이다.
프로젝트 ZIP은 PageId 하위 구조와 공유 assets 경로를 보존하고 모든 상대 import·사용 자산이
ZIP 루트 내부에서 풀리게 한다. 실제 자산 저장 위치·경로 표기와 재작성 책임은 #281 계약 PR에서
예제로 확정한다. 경로 검사 통과와 독립 앱 typecheck/build·동작 검증은 별도 증거다.

### 순환에 안전한 지문·무효화 권장안(미승인)

호스트 H에서 시작해 openModal과 포함 widget edge를 방문 집합 `(projectId, PageId)`로 순회한다.
navigate 대상 page는 렌더 closure에 넣지 않는다. modal A↔B도 한 번씩만 수집해 종료하며,
widget 포함 cycle은 유효성 검사에서 거부한다. 수집 후 노드별 재귀 hash 대신 안정 ID로 정렬한
closure의 snapshot 레코드와 정규화한 관계 목록을 한 번 hash한다. 전체 프로젝트 계획 지문과
개별 출력의 입력 지문은 구분하며, 각 출력이 소비하는 입력만 투영한다. 객체 key 순서는
정규화하되 children 순서는 보존하고, pageOrder는 이를 소비하는 계획/출력의 입력에서만
순서를 보존한다. 정책/컴파일 계약 버전도 입력에 포함하는 안이다.

| 변경 | 권장 무효화 범위 |
|---|---|
| 호스트 또는 closure 안 modal/widget의 내용·size·responsive·action 변경 | 해당 출력과 그 소스를 포함하는 모든 호스트 stale; widget은 S2에서도 동일 원칙 |
| openModal/포함 edge 추가·제거·대상 변경 | 이전/새 closure를 다시 계산하고 영향받는 호스트 stale; 삭제·kind 변경으로 무효면 생성/확정 거부 |
| navigate target 변경 | action 소유자와 이를 포함하는 호스트 stale; 대상 page의 본문 변경만으로는 navigate 출발 호스트를 stale로 만들지 않음 |
| PageId 유지 이름 변경 | 신원/자리는 보존; 파일명·export·import에 영향을 받는 티켓과 소비자 stale 또는 기존 renamed 안내, 옛 파일 자동 삭제 금지 |
| pageOrder 변경 | 전체 프로젝트 계획/진입 순서·경로 매핑 소비자는 재평가; 출력 의미가 불변인 독립 티켓까지 무조건 stale로 만들지는 않음 |
| closure 밖 무관한 화면 수정 | 해당 화면/계획은 재평가하되 관련 없는 호스트의 입력 지문은 보존 |
| projectId 변경/복사 | 기존 소유권 기록을 현재 출력으로 승격하지 않음; 새 프로젝트 자리 사용 |

공통 생성 정책·import/export 이름 매핑이 바뀌면 이를 소비하는 티켓도 무효화한다. 입력 지문 일치만으로
current가 되지 않으며 기존 출력 바이트 hash·소유권·수용 기록·수동 변경 보호를 함께 확인한다.
요청 중 편집되면 응답 확정 전에 현재 프로젝트와 요청 snapshot/세대를 재검사하고 낡은 결과를
최신 완료로 표시하지 않는다. 자산 경로 변경은 입력 변경이다. **자산 바이트만 바뀌는 경우는 현재
지문에 포함되지 않는 알려진 한계**(26)이며, 내용 hash를 추가할지와 로컬/외부 자산의 실패·캐시
정책은 승인 때 정한다. 이 제안만으로 자산 최신성을 보장한다고 주장하지 않는다.

## 승인과 구현 전 수용 조건

1. D6의 호스트 viewport breakpoint·독립 clamp·스크롤/루트 측정은 #280과, D11의 전체 범위·신원·지문·경로·ZIP은 #281과 정본 문서에서 합의한다.
2. Ticket v0.2 및 요청 v4의 exact JSON 예제/필수 필드/오류/구소비자 거부를 계약 PR에서 확정한다. 새 GUI v4 요청→실제 v3 스킬의 쓰기 전 거부, v4 GUI의 v3 응답 거부, 구 GUI→새 스킬 조합을 각각 검증하며 마지막 조합의 정책은 미정으로 남긴다.
3. Ticket 변경은 별도 계약 PR에서 `src/features/editor/ticket/ticket.schema.json`, **수동 관리** `ticket/types.ts`, `ticket/validate.ts`와 문맥 검사, compiler·protocol·schema/compat 테스트를 함께 맞춘다. `bin/visual-spec.mjs`의 배포 계약 복사(`schema/ticket.schema.json`, `docs/11-ticket-schema-freeze.md`)와 `test/cli-contract.test.ts`, 배포/사람용 스킬도 확인한다. `generate:types`는 Visual Spec IR 타입 생성이며 `bin/lib/schema.mjs` 번들도 Ticket 타입/검증기의 갱신을 대신하지 않는다. IR 변경이 별도로 생길 때만 그 정본·생성 타입·번들 절차를 추가한다. 리더 또는 리뷰어 승인과 필수 CI를 거친다.
4. 이후에만 프로젝트 compiler·GUI 범위·요청 producer/소비 스킬·검증기·Export를 함께 구현한다. 지문 fixture에는 modal cycle, 공유 modal/widget 변경, 무관한 화면 변경, rename/order, 관계 삭제, 진행 중 편집, 자산 정책을 포함한다. S2 fixture/구현을 이번 S1 완료로 세지 않는다.
5. fixture typecheck/build와 실제 AI 생성 검증을 분리해 보고한다. 현재 이 제안은 어느 쪽의 런타임 완료도 주장하지 않는다.

## 2026-10-16 위임에 따른 구체 선택과 실제 승인 경계

사용자는 2026-10-16 08:10 UTC에 “내가말한데로 그 이슈가 완료될때까지 필요하면 내 권한으로 머지하면서 끝까지진핸해”라고 후속 구현과 정상 병합을 위임했다.
위 표의 미정 사항을 전부 별도 제품 담당자 허가 대기로 해석하지 않는다. 다음은 그 위임 안에서
선택한 **다음 계약 PR의 구체 권장안**이다. 이 문서는 여전히 실행 중인 wire 계약을 바꾸지 않으며,
사용자의 포괄 위임을 GitHub의 APPROVED 리뷰로 기록하거나 리뷰어를 대리하지 않는다.

### D6 구체 권장값

- 호스트 CSS layout viewport로 breakpoint를 선택한다. 실제 배치는 visual viewport의 폭·높이·offset을
  사용하므로 모바일 키보드가 가리는 영역에 패널을 고정하지 않는다. visualViewport가 없으면 layout viewport를 쓴다.
- 각 변 여백은 16 CSS px와 해당 safe-area inset의 합이다. viewport가 32px보다 작아도 가용 크기는
  `max(0, viewport - 양쪽 여백)`으로 계산한다. IR에 새 geometry 필드를 추가하지 않는다.
- 패널 border-box 폭은 `min(size.width, availableWidth)`, 최소 높이는 `min(size.height, availableHeight)`,
  최대 높이는 availableHeight다. 내부 overflow는 양축 auto이며 자식 좌표/폰트를 scale하지 않는다.
- root.box의 width/height는 패널 외곽 크기를 재지정하지 않는다. root layout의 padding은 패널 내부에
  포함하고 box-sizing은 border-box다. root background는 기존 노드 값 그대로 쓴다.
- backdrop은 rgba(0,0,0,0.4), 추가 border/shadow는 기본 없음이다. 이 값은 호스트 기본 표현이며
  문서 스타일을 덮어쓰는 영속 IR 값이 아니다. page 셸의 geometry 계약은 바꾸지 않는다.
- native dialog의 showModal/cancel을 사용하되 상태 동기화·Tab 순환·Escape·교체·트리거 소멸 fallback을
  실제 브라우저로 검사한다. backdrop 클릭은 닫지 않는다. 키보드가 열린 상태와 작은 viewport에서
  포커스 항목을 내부 스크롤로 노출하는 수용 검사를 추가한다.

### D11 구체 경계

- `compileTickets(screen)`는 기존 Ticket v0.1 반환 계약을 유지한다. 새 `compileProjectTickets(project)`가
  Ticket v0.2를 반환한다. 프로젝트 티켓은 `sourcePageId` 필수이며 identity는 PageId + 해당 화면의
  기존 안정 ticket ID로 구성한다. 문자열 결합 구분자 충돌이 없도록 tuple을 인코딩한다.
- 요청 v4는 `project`(불변 ProjectSpec), `tickets`(이번 wave), `allTickets`(전체 계획)를 구분한다.
  프로젝트 identity/outputDir와 기존 requestId·staging 경계는 유지한다. 화면 한 장을 의미하는 기존
  `page`/`pageId`와 project snapshot을 동시에 받아 어느 쪽을 우선할지 추측하지 않는다.
- 응답은 protocol=4와 requestId, 요청 wave의 각 ticketId 결과를 사용한다. 중복·미요청 ID와 누락 결과는
  수용 전에 거부한다. 실패 결과가 있어도 성공한 다른 티켓의 검증은 독립 실행하되 전체 성공으로 표시하지 않는다.
- 구 GUI v3 → 새 스킬은 기존 v3 전용 분기로 처리하여 v3로 응답한다. 새 GUI v4 → 구 스킬은 기존
  protocol 비교로 쓰기 전에 거부한다. v4 요청을 v3로 자동 낮추거나 v4 GUI가 v3 응답을 수용하지 않는다.
- ZIP에는 기존 PageId별 pages/components 구조를 유지하고 프로젝트 루트 `assets/`를 둔다. 로컬 자산은
  SHA-256 콘텐츠 주소 + 원래 확장자로 배치한다. 동일 바이트만 공유하며 이름만 같은 다른 바이트는 합치지 않는다.
  허용된 프로젝트 참조에서 읽은 바이트의 hash와 매핑을 요청 snapshot/수용 검사에 포함한다. 요청 중
  바이트 변경은 stale로 거부한다. 기존 수용 기록을 이 보장으로 소급 승격하지 않는다.
- 외부 URL은 기존 참조 정책을 유지하되 원격 콘텐츠 최신성은 보장하지 않는다. 다운로드하지 않은 외부
  자산이 포함되면 standalone 검증 기록에 네트워크 의존성을 명시한다. 자체 완결 예제는 로컬 자산만 쓴다.
- 경로·전이 지문·출력 소유권·수동 변경 보호는 위 절의 규칙을 적용한다. 새 필드의 exact schema,
  오류 코드와 구버전 fixture는 docs/11·26 계약/스키마 PR에서 함께 검증한다.

### 위임으로 결정할 수 있는 것과 남은 게이트

여백/배경막/기본 호스트 구현, 함수명·필드 후보, 구 GUI 호환 분기, 테스트 fixture와 경로 매핑은
위임된 가역적 설계 선택이다. #280·#281과의 대조는 기존 계약 충돌을 찾기 위한 기술 검토이며,
문서에 별도로 지정되지 않은 담당자의 개인 승인을 새 필수 조건으로 만들지 않는다.

반면 #265 절차 1~3과 docs/24는 **선행 계약 PR, 스키마 단독 PR, 리더 또는 최소 1명 승인,
관리자 병합 금지**를 명시한다. 이번 정상 PR389 병합 재심사는 사용자 위임을 전달했지만 자동 승인
검토가 “eligible external approval” 부재로 거절했다. 따라서 현재 실행 환경의 실제 병합 차단은
외부 승인 부재다. 다른 API/CLI로 재시도하거나 보호 설정을 바꾸지 않는다. 이 문서의 구체화는
그 게이트를 통과했다는 기록이 아니다. 계약 PR의 정상 수용 이전에 v4 런타임을 배포하지 않는다.

최종 완료 증거는 S1/S2 전 항목, GUI Save→세션 종료→Open, 실제 에이전트 생성,
Export ZIP→독립 앱 typecheck/build와 관계 동작, develop 전체 검사다. fixture 또는 권장안만으로
완료를 표시하지 않는다. 실제 에이전트 접근 불가·생성 실패는 해당 단계에서 별도 blocker로 기록한다.
