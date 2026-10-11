# 02. MVP 범위

> 출처: ClickUp 팀 문서 `Visual Spec Builder MVP`

이 문서가 **범위 판단의 기준**이다. `PRD 1차`와 충돌하는 내용이 있으면 이 문서를 따른다.

## 설치와 실행

원래 기획한 배송 형태는 이것이다.

```bash
npm install -D visual-spec-builder
npx visual-spec init
npx visual-spec
```

> **정정 (2026-09-18, 이슈 #112)**
> **위 방법은 아직 아무도 쓸 수 없다.** `package.json`에 `"private": true`가 있어 이 패키지는
> npm에 배포돼 있지 않다 — `npm install visual-spec-builder`가 받아올 것이 없다.
>
> **지금은 공개 배포하지 않기로 했다.** GUI가 `.visual-spec/` 작업공간을 읽고 쓰는 길이
> **Vite 개발 서버 미들웨어**라(이슈 #133), 배포 형태보다 "개발 서버 위에서 돈다"는 전제가
> 먼저다. 그 전제가 확정되면 배포 형태는 그 위에서 정하면 되고, 지금 npm 배포를 먼저
> 확정해 봐야 실행 방식이 바뀔 때 다시 바꿔야 한다. 배포 전환은 별도로 다룬다.

지금 실제로 쓰는 방법은 이 저장소를 클론해 실행하는 것이다.

```bash
# 1) 저장소를 클론하고 의존성을 받는다
git clone https://github.com/visual-spec-labs/Visual-Spec-Builder.git
cd Visual-Spec-Builder
pnpm install

# 2) 화면을 만들 프로젝트 폴더에서 작업공간을 만들고 GUI를 띄운다
cd /path/to/my-project
node /path/to/Visual-Spec-Builder/bin/visual-spec.mjs init
node /path/to/Visual-Spec-Builder/bin/visual-spec.mjs
```

인자 없이 실행하면 편집기 GUI가 뜬다(= 이 저장소의 Vite 개발 서버). **GUI는 명령을 실행한
폴더의 `.visual-spec/`을 읽고 쓴다** — 개발 서버 자신은 클론한 저장소에서 도는데도 그렇다
(이슈 #133: CLI가 작업공간 경로를 환경 변수로 개발 서버에 넘긴다).

CLI로 띄운 GUI는 React production 빌드로 돈다(#314, `VISUAL_SPEC_REACT_DEV=1`이면 개발 모드). 저장소 안에서 `pnpm dev`로 바로 띄울 수도 있다 — 이쪽은 React 개발 모드다. 그때 작업공간은 저장소 루트의
`.visual-spec/`이 된다.

`init`은 현재 프로젝트를 분석하거나 변경하지 않고 전용 작업공간만 만든다.

```
.visual-spec/
├── specs/        화면 JSON 스펙
├── generated/    생성된 React 코드
├── assets/
└── runtime/
```

화면과 컴포넌트는 이 작업공간 안에서만 제작된다.

## MVP 포함 범위

| 구분 | 항목 |
|---|---|
| 환경 | React + Vite, TypeScript, Tailwind CSS |
| 작업공간 | 독립 `.visual-spec/` 디렉터리 |
| GUI | localhost 캔버스 편집기 |
| 생성 | 자연어 화면 생성, 자연어 부분 수정, 직접 캔버스 편집 |
| 레이아웃 | Row / Column / Grid |
| 노드 | Container / Text / Button / Input / Image |
| 크기 | Fixed / Fill / Hug |
| 반응형 | 데스크톱 · 모바일 레이아웃 |
| 화면 관계 | 화면 종류(page·modal·widget), 버튼의 화면 이동·모달 열기·닫기, 재사용 위젯 — 범위에 넣었고 **아직 구현 전**이다(아래 "화면 관계 (#265)") |
| 편집 | Undo / Redo |
| 저장 | 공통 JSON 스키마 |
| 코드 생성 | 사용자가 실행한 Claude Code·Codex에 파일로 요청·응답 전달, 실행 방법 안내 |
| 출력 | 기능 폴더 Export |

노드 직접 생성은 Frame/Text 도구, **삽입 → 버튼 / 입력 필드** 메뉴, 파일 → 이미지 가져오기로 제공한다(#226).
Insert는 선택한 프레임 안에, 비프레임 선택이면 가장 가까운 부모 프레임에, 선택이 없으면 root에 추가한다.
생성한 노드를 선택하며 Undo/Redo 한 단계로 처리한다.

대표 화면은 **관리자 대시보드**다.

### 화면 관계 (#265)

여러 화면을 가진 프로젝트에서 **화면 사이의 관계**를 IR에 저장하는 일을 MVP 범위에 넣는다.
설계는 [24](24-screen-relations-design.md)에 있다. 제품 방향 담당 @Yumesa2025가 D1~D9 방향을 승인했고
설계 초안은 #339로 병합됐다. 팀의 설계·계약 승인은 아직 기록되지 않았다(24 §2·§8).
이 절은 승인된 제품 방향을 범위 문서에 반영한 것이며, 팀의 계약·단계 계획 채택을 확정하지 않는다.
#339의 관리자 병합이나 이번 범위 정정은 S0-1의 팀 승인, 후속 단계 착수·병합 승인을 대신하지 않는다.
24 §7·§8의 팀 승인 조건은 남아 있다.

**범위에 들어왔다는 것은 관계 기능 전체가 구현됐다는 뜻이 아니다.** #355의 S1-1은 정본 IR(0.3)에
선택 `kind`·button `action`의 저장 형태와 Command 임시 차단을 제공한다. 관계 화면의 생성·출력 수용·Export도
미지원으로 차단한다([06](06-schema-freeze.md#s1-1-생성export-임시-차단)). 참조 검증·GUI·자연어·관계 동작 생성과
`instance`는 후속 미구현 범위다. 이 구현 사실이 팀의 설계·스키마 APPROVED 리뷰나 단계 합의를 뜻하지 않는다.
아래 단계는 24 §7의 설계상 계획이며, 원래 [#265](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265)
작업 목록과 다른 부분은 다음과 같이 구분한다.

| 항목 | #265 원문 계획 | 24 §7의 정정/제안 및 채택 상태 |
|---|---|---|
| 설계 문서 번호 | docs/17, README 17번 | 번호 중복을 피한 docs/24, README 24번으로 경로 정정. 제품 결정 변경과 별개 |
| S1-1 선행·범위 | S0-1 선행, 스키마 단독 PR | S0-2 완료도 선행으로 두고 Command 임시 차단·계약 번들 재생성을 포함. #355가 이 안을 구현했으나 팀의 계획 채택은 대기 |
| S1-3 선행 | S1-1 뒤 S1-2와 병렬 | S1-2 프로젝트 검증 완료 뒤 Command 경로 개방. 팀의 계획 채택은 대기 |
| S1-8/9·D11 시점 | S1-1 선행, Ticket 버전은 2차에서 판단 | S0부터 논의하고 S1-1·S1-2 및 D11·#281 경계 합의 뒤 착수. 팀의 계획 채택·공유 계약 합의는 대기 |

이 정정은 #265 본문이나 의존 관계도를 변경하지 않는다. 경로 정정과 팀 채택이 필요한 계획 변경을
구분하여 epic에 반영해야 하며, 판단 시점에 합의해도 D10/D11의 명령·버전·형식이 자동 확정되지는 않는다.

| 범위에 들어온 것 | 방향(24의 결정 ID) | 단계와 현재 상태 |
|---|---|---|
| 화면 종류 | 기존 `pages`의 화면에 선택 필드 `kind`(`page`·`modal`·`widget`, 생략하면 page). 첫 화면과 최소 한 장은 page다(D2) | 1차 S1-1 스키마 — [#355](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/355), IR 0.3 유지. 선택 필드 저장·Command 및 생성/Export 임시 차단은 #355에서 제공한다. 종류 선택 GUI(S1-5)는 미구현 |
| 버튼의 화면 연결 | `button`에만 `action` 하나 — 페이지 이동(`navigate`)·모달 열기(`openModal`)·닫기(`close`). navigate/openModal의 대상은 URL이 아니라 같은 프로젝트의 PageId다. close는 target이 없고 modal/widget의 button에 허용하며, page 자체 button에서는 오류로 제안한다(D1·D3·D4·D6). 모달은 한 번에 하나만 연다(D6) | 1차 S1-1 스키마(#355) → S1-2 참조 검증 → S1-3 Command → GUI·구현 티켓·코드 생성·자연어(S1-4~S1-11). S1-1 저장 형태와 임시 차단은 #355에서 제공하며 S1-2 이후 기능은 미구현이다. 선행·합의 조건은 위 계획 차이 표와 24 §7 참고 |
| 재사용 위젯 | 새 노드 `instance`가 widget 화면을 PageId로 참조한다. 덮어쓰기는 원본의 직접 Text/Button 내용·글자색만이다(D8·D9) | 2차 S2-1 스키마에서 IR 0.4. 1차 마감(S1-11) 뒤 착수 — 미착수 |

생성 코드는 라우터를 두지 않고 `onNavigate` 콜백과 페이지가 소유한 모달 상태로 표현하는 방향이다(D7).
URL·history·라우터 설정은 사용자 앱의 몫으로 남는다(아래 "MVP 제외 범위").

**범위 안이지만 아직 정하지 않은 것.** 팀 결정을 기다리며, 정해지기 전에는 해당 단계에 착수하지 않는다(24 §7).

- action을 지우는 Command 표현과 Command 버전 — 제거 전용 명령·v0.2를 추천했다(D10)
- 프로젝트 단위 구현 티켓의 Ticket 버전과 다음 티켓 요청 규약 버전 — #281 신원·경로 합의 뒤, S1-8/9 착수 전에 정한다(D11)
- 모달의 크기 해석 — page 셸 계약([25](25-layout-parity-contract.md))과 별도로 #280과 합의한다(D6)
- 생성 입력 지문의 범위(호스트 + 도달 가능한 modal·포함 widget), 생성 자리 사이 import와 ZIP 범위 — #281과 공동 결정한다(24 §6)

## 에이전트 실행 정책 (#219, 2026-10-04)

**A안(수동 실행·안내 유지)으로 결정했다.** 사용자가 같은 프로젝트 폴더에서 Claude Code나
Codex를 직접 실행하고 인증한다. GUI는 요청 파일을 작성하고 응답을 읽는다. GUI나 CLI가
에이전트 프로세스를 자동 실행하지 않으며 브라우저에서 LLM API를 직접 호출하지 않는다.
설치·인증·실행 환경을 앱이 관리하지 않는 대신 사용자가 최초 실행과 요청 처리를 지시한다.

#155의 외부 에이전트·파일 교환 결정과 이번 프로세스 실행 정책은 별개다.
#184의 **B안**은 티켓 요청·응답 연결을 뜻하며, #219에서 채택하지 않은 **B안**(CLI의
에이전트 자식 프로세스 실행)과 다르다. 기존 자연어·티켓 파일 교환은 그대로 유지한다.

- 자연어: `runtime/nl-request.json` → 외부 에이전트의 Command 응답 → GUI 검증·Undo 한 단계.
- 티켓: `runtime/ticket-request.json` → 외부 에이전트의 `generated/` 코드 작성·결과 응답.
- 외부 대화 편집(#279): 사용자가 GUI 입력창이 아니라 에이전트 대화에서 바로 화면 수정을 요청한 경우다.
  GUI가 `runtime/gui-state.json`에 지금 문서·페이지·선택·상태 버전(`stateRevision`)을 공개하고(열린 동안
  10초마다 갱신), 에이전트는 스펙 파일 대신 `runtime/agent-edit.json`에 Command 배열과 읽은 상태 버전
  (`baseStateRevision`)을 쓴다. GUI는 상태가 그대로일 때만 자연어 경로와 같은 관문(G1~G3)으로 Undo 한
  단계로 적용하고, 배경을 바꾸면 사용자 확인을 받는다. 결과(`applied`·`pending`·`rejected`·`invalid`와
  이유)는 `runtime/agent-edit-result.json`에 쓰고 GUI에도 알린다. 한 작업공간에서 GUI 탭 하나만
  연결된다(`/__vs/request-lock/gui`) — 연결된 탭을 닫으면 `gui-state.json`이 정리되고 다른 탭이 이어받는다.
- 열린 파일의 디스크 변경(#279): 에디터에서 이름 있는 파일을 연 동안 GUI가 3초마다 디스크 버전을 확인한다.
  내용이 지금 화면과 같으면(방금 저장) 버전만 맞추고, 미저장 편집이 없으면 디스크 내용을 Undo 한 단계로
  불러와 알리며, 미저장 편집이 있으면 불러올지 묻는다(유지하면 다음 저장이 디스크 충돌 확인으로 이어진다).
  검증에 실패하는 내용은 불러오지 않고 알린다. 에이전트는 여전히 열린 GUI에는 Command 통로를 쓴다 —
  파일을 직접 고치면 3초 지연과 위 확인을 거친다.
- 위 경로는 `.visual-spec/` 기준이다. GUI의 중지는 응답 대기만 중단하므로 실행 중인
  외부 에이전트에는 사용자가 별도로 중지를 지시해야 한다.
- 두 요청 파일은 작업공간마다 한 자리이므로 **종류별로 한 번에 한 요청만 기다린다**(#273).
  GUI는 요청 파일을 쓰기 전에 `/__vs/request-lock/nl|ticket` 잠금을 잡고, 서버는 잠금 주인
  (`x-visual-spec-request-owner`)이 아닌 요청 파일 쓰기를 409로 거절한다. 다른 탭·창·origin
  (`localhost`/`127.0.0.1`)이나 같은 작업공간을 띄운 다른 서버에서 먼저 보낸 요청이 기다리는
  중이면 "다른 탭(창)에서 보낸 요청이 아직 응답을 기다리고 있습니다"로 안내하고 요청 파일을
  덮지 않는다. 잠금은 응답·취소·timeout·탭 닫기에서 풀리고, 연장이 30초 끊기면 만료된다.
  연장(`?renew=1`)은 잠금 기록의 주인이 여전히 자기일 때만 허락된다 — 끊긴 사이 다른 탭이
  가져갔다가 풀었으면 거절되고, 처음 탭은 요청이 바뀌었다고 안내한다.
  풀 때 그 요청의 요청 파일(`id`가 같은 것)도 지운다 — 끝난 요청을 에이전트가 나중에
  "현재 요청"으로 처리하지 않게 한다.
  잠금 기록은 `runtime/.nl-request.lock`·`.ticket-request.lock`이며 에이전트·스킬의 요청/응답
  파일 규약은 바뀌지 않는다.

실행 명령·요청문·실패 대응은 [사용 가이드](14-getting-started.md#에이전트를-수동으로-시작하기)에 있다.

### #219 수용 기준

- [x] MVP의 코드 생성 범위를 수동 에이전트 실행 안내와 기존 파일 교환으로 명시한다.
- [x] 자연어 결정 문서·구현 현황·사용 가이드가 같은 정책을 설명한다.
- [x] 사용자는 같은 작업공간에서 실행할 명령, 읽힐 스킬과 요청 경로, 중지·시간 초과 시
  조치를 안내받는다. 프로세스 자동 실행이나 API 호출 기능은 추가하지 않는다.
- [x] 정책 결정과 실제 AI 검증을 구분한다. #217·#220의 실제 에이전트 왕복 완료는
  [검증 기록](15-workflow-qa.md)의 환경 차단이 해결된 후 별도로 판정한다.

## MVP 제외 범위

| 항목 | 사유 |
|---|---|
| **React Preview (`localhost:4174`)** | MVP 문서에서 취소선 처리됨. 캔버스 스펙과 실제 React 결과를 나란히 비교하는 단계는 MVP에 넣지 않는다 |
| 기존 프로젝트 자동 병합 | Export 폴더를 사용자가 직접 통합한다 |
| Panda CSS / styled-components 출력 | 같은 IR을 쓰는 출력 어댑터로 나중에 추가 |
| Image · Shape · Pen 도구 | [04-gui-spec.md](04-gui-spec.md) 도구 모음 참고 |
| Help 메뉴 | 동일 |
| 실행 앱 셸·라우터 설정·배포 설정 | Export는 컴포넌트 묶음이다(아래 "Export 제공 범위"). 사용자의 기존 앱에 넣어 쓴다. #265의 화면 이동도 라우터 없이 `onNavigate` 콜백으로 생성하는 방향이다([24](24-screen-relations-design.md) D7) |
| 폼 상태·입력 검증·제출, 데이터 불러오기 | `value`/`onChange`/`bindings`가 IR 제외 범위다. #265는 버튼의 이동·모달 동작만 넣고 폼 동작은 넣지 않는다(24 D4). 폼 바인딩을 그 뒤 별도로 검토하는 안은 미확정 제안이다([21](21-app-scope-a11y-design.md)) |
| 화면 관계 밖의 인터랙션 | IR의 `events`·`props`·`bindings`는 계속 제외다. #265가 넣는 것은 위 "화면 관계 (#265)"의 버튼 action 세 갈래뿐이다. 이벤트 이름·조건·외부 URL 이동, button 밖 노드(frame·text·image·input)의 동작, 중첩 모달, 애니메이션·전환 효과, 다른 프로젝트와의 연결은 넣지 않는다(24 D3·D4·D6, #265 "범위 밖") |
| 인증·세션·백엔드 | 현재 Export가 제공하지 않는다. 로그인 화면의 모양만 만들며 장기 지원 여부는 미정이다 |
| hover·focus·disabled 등 상태 스타일 | IR의 `states`가 제외 범위다. 브라우저 기본 focus 표시 보존은 후속 생성 규칙으로 명시·검증할 목표이며 현재 보장이 아니다([21](21-app-scope-a11y-design.md)). 후속 지원 범위 제안은 [27](27-user-design-system-scope.md) |
| 사용자 화면의 공용 스타일(이름 있는 색·글자·간격)·폰트 추가·아이콘 라이브러리 | 스타일 값은 노드마다 리터럴로 저장하고(`TokenSet` 제외), 글꼴은 Pretendard와 `system-ui`만 고를 수 있다. 아이콘은 SVG 이미지 Import로만 넣는다. 편집기 자체의 디자인 토큰([DESIGN-TOKEN-RULES](DESIGN-TOKEN-RULES.md))과 별개이며 지원 범위·후속 순서 제안은 [27](27-user-design-system-scope.md) |

스키마 수준의 제외 범위는 [05-schema.md](05-schema.md)에 따로 있다. 05의 `InstanceNode`·`events` 제외는
현재 정본 기준이다. `kind`·`action`은 S1-1(#355)이 05에 반영했고, `instance`는 S2-1 스키마 PR 범위다.

> **정정 이력 (2026-10-10, #265 S0-2)**
> "MVP 포함 범위" 표에 화면 관계 행과 "화면 관계 (#265)" 절을 더했다. "MVP 제외 범위"에 화면 관계 밖의 인터랙션 행을 더하고,
> 라우터·폼 행에 #265와의 경계를 적었다. 지금까지 이 문서는 화면 관계를 다루지 않았고, [03](03-user-flow.md)은
> 인터랙션 전체를 제외로 적어 #265의 설계([24](24-screen-relations-design.md), #339)와 맞지 않았다(03도 함께 정정).
> 05의 스키마 제외 목록은 현재 정본과 맞으므로 그대로 두고 스키마 PR에서 고친다.
> 범위만 정정했다. 정본 IR·Command·Ticket과 제공 기능은 바뀌지 않았다.
> 후속 검토에서 #265 원문과 24의 단계 차이·팀 채택 대기, #355 구현과 develop 미반영을 구분하고, close의 대상 없음·허용 문맥을 명시했다.

> **정정 이력 (2026-10-10, #290)**
> "MVP 제외 범위"에 사용자 화면의 공용 스타일·폰트 추가·아이콘 라이브러리 행을 더하고 상태 스타일 행에 [27](27-user-design-system-scope.md)을 연결했다.
> 지금까지 이 표는 앱 토큰과 사용자 화면의 스타일을 구분하지 않아, 편집기의 토큰 체계가 사용자 화면에도 있다고 읽힐 수 있었다. 제공 기능 자체는 바뀌지 않았다.

> **정정 이력 (2026-08-15)**
> `01-overview.md`의 이전 버전에는 전체 흐름 마지막에 "결과 화면 확인" 단계가 있었다.
> MVP 문서에서 해당 절이 취소선 처리되어 제외 항목으로 옮겼다.

## 스키마 계약

MVP는 다음 세 가지 스키마를 동결하고, 변경은 각 동결 문서의 절차로만 한다.

| 스키마 | 현재 버전 | 다루는 것 | 계약·변경 절차 |
|---|---|---|---|
| IR 스키마 | 0.3 | 화면 구조 ([05-schema.md](05-schema.md)) | [06-schema-freeze.md](06-schema-freeze.md) |
| Command 스키마 | v0.1 | 편집 명령 | [09-command-schema-freeze.md](09-command-schema-freeze.md) |
| Ticket 스키마 | v0.1 | 구현 작업 단위 | [11-ticket-schema-freeze.md](11-ticket-schema-freeze.md) |

IR은 v0.1로 동결을 시작한 뒤 06의 절차를 거쳐 v0.2(`ProjectSpec`, #60)와 v0.3(배경 채우기 겹 배열, #127)이
추가됐다. 정본 `src/features/editor/schema/visual-spec.schema.json`의 `version`은 화면 문서·프로젝트 문서 모두
`"0.3"`이다. Command는 `createNode.index` 선택 필드 추가(#193)와 `updateScreen`의 `responsive` 경로 허용(#247)이
있었지만 버전은 v0.1 그대로다(09의 변경 이력). Ticket은 동결 이후 버전 변경이 없다(11).

#265 화면 관계도 이 절차로만 들어온다. **위 표의 버전은 아직 바뀌지 않았다.** 계획은 IR 1차(`kind`·`action`)를
0.3 선택 확장으로, 2차(`instance`)를 0.4로 내는 것이다. Command와 Ticket(티켓 요청 규약 포함)의 버전은 D10·D11에서
팀이 정한다([24](24-screen-relations-design.md) §5·§6). 각 스키마 변경은 기능과 분리한 별도 PR로 올리고 팀 승인
1명 이상을 받는다(06 "변경 규칙"). 24 §7의 S1-1 안과 #355는 스키마와 함께 Command 임시 차단
(S1-3에서 해제)과 계약 번들 재생성을 담는다. #355의 생성·수용·Export 임시 차단은 S1-2 및 S1-8/9 지원 뒤 해제한다. #265 원문 계획 변경의 팀 채택은 위 표처럼 대기 상태다.

> **정정 이력 (2026-10-10, #265 S0-2)**
> #265로 예정된 버전 변경과 그 절차를 위 문단에 더했다. 현재 버전 표는 바꾸지 않았다.

> **정정 이력 (2026-10-05)**
> 이 절은 "세 가지 스키마를 v0.1로 고정한다"였다. IR이 06 절차로 0.3까지 올라간 뒤에도 남아 있던 문장을
> 현재 버전과 변경 절차 문서로 바꿨다. MVP 범위 자체는 바꾸지 않았다.

## 결과물 원칙

Export된 폴더는 경로 별칭 없이 다른 앱에 그대로 넣어 쓸 수 있어야 한다. 혼자 실행되는 앱이라는 뜻은 아니다(아래 "Export 제공 범위").

- 프로젝트 전용 경로 별칭 사용 금지
- 상대 경로 import 사용
- 필요한 컴포넌트 함께 포함
- 필요한 패키지 목록 제공
- 실행 방법과 통합 방법을 README에 작성

```javascript
// 사용하지 않음
import { Button } from "@/components/ui/Button";

// 상대 경로 사용
import { Button } from "./components/Button";
```

Export 결과 예시:

```
dashboard/
├── pages/
│   └── DashboardPage.tsx
├── components/
│   ├── DashboardHeader.tsx
│   ├── Sidebar.tsx
│   ├── StatCard.tsx
│   └── UserTable.tsx
├── assets/          참조한 이미지가 있을 때
├── package.json     필요한 패키지 목록
└── README.md        실행·통합 방법과 검증 결과
```

### Export 제공 범위 (#285)

Export는 **실행 앱이 아니라 화면 단위 React 컴포넌트 묶음**이다. 페이지·컴포넌트·이미지·필요한 패키지
목록·README를 주고, 사용자가 이미 React + Tailwind CSS가 있는 앱에 넣어 쓴다. 앱 셸(`index.html`·`main.tsx`)·
라우터 설정·폼 상태와 제출·데이터 불러오기·인증·백엔드·hover/focus/disabled 상태 스타일·배포 설정은 현재 제공하지 않는다. 입력 타입·label·이미지
alt 같은 의미 속성은 아직 IR에 없어 코드 생성이 보수적으로 근사한다(`alt=""`, 타입 없는 `<input>`).
현재 지원 범위와 미확정 후속 제안은 [21](21-app-scope-a11y-design.md)에 있다. Export 화면과 ZIP의 README도 같은 범위를 적는다.

> **정정 이력 (2026-10-07, #285)**
> 이 절과 위 "MVP 제외 범위"의 앱 셸·폼·데이터·인증·상태 스타일 행을 더했다. 지금까지 README만
> "컴포넌트 묶음"이라고 적고 범위 문서와 Export 화면에는 없어, 받은 ZIP을 실행 앱으로 기대할 수 있었다.
> 같은 이유로 "결과물 원칙"의 첫 문장("가능한 한 독립적으로 동작해야 한다")을 "다른 앱에 그대로 넣어 쓸 수
> 있어야 한다"로 고치고, 결과 예시를 실제 배치(`pages/`·`components/`·`assets/`, `styles/` 없음 —
> `export/bundle.ts` 머리 주석)로 바꿨다. 제공물 자체는 바뀌지 않았다.

## 구현 단위

MVP는 아래 여섯 덩어리로 나뉜다.

| 단위 | 책임 |
|---|---|
| IR · 스키마 | `screen.schema.ts` — layout, node, screen, style, size |
| Command Engine | GUI와 자연어가 공통으로 쓰는 편집 명령. `command.schema.ts`, history manager |
| 자연어 변환 | 자연어 → Command 변환 |
| Ticket Compiler · Agent | IR을 컴포넌트 구현 작업으로 분할, 실행 순서 결정, 티켓 상태 관리 |
| localhost GUI · Canvas | 사용자가 보는 Studio. **IR을 직접 수정하지 않고 Command Engine을 호출한다** |
| Export · 검증 | 생성된 React 코드를 결과 폴더로 내보내기 |

GUI가 IR을 직접 건드리지 않는다는 제약이 핵심이다. 드래그 동작도 `MOVE_NODE` 커맨드를 거쳐 IR을 바꾸고 캔버스를 재렌더링한다.

> **S1-1 통합 정정 (2026-10-10, #355)**
> 선택 필드 저장·임시 차단의 제공 상태를 맞췄다. 위 S0-2 정정 이력의 Draft/develop 미반영은 당시 기록이다.
> 후속 관계 기능·팀 계획 채택·팀/스키마 APPROVED 리뷰는 완료로 바꾸지 않았다.
