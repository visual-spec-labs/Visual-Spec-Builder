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

저장소 안에서 `pnpm dev`로 바로 띄울 수도 있다. 그때 작업공간은 저장소 루트의
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
| 편집 | Undo / Redo |
| 저장 | 공통 JSON 스키마 |
| 코드 생성 | 사용자가 실행한 Claude Code·Codex에 파일로 요청·응답 전달, 실행 방법 안내 |
| 출력 | 기능 폴더 Export |

노드 직접 생성은 Frame/Text 도구, **Insert → Button / Input** 메뉴, File → Import 이미지로 제공한다(#226).
Insert는 선택한 프레임 안에, 비프레임 선택이면 가장 가까운 부모 프레임에, 선택이 없으면 root에 추가한다.
생성한 노드를 선택하며 Undo/Redo 한 단계로 처리한다.

대표 화면은 **관리자 대시보드**다.

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

스키마 수준의 제외 범위는 [05-schema.md](05-schema.md)에 따로 있다.

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

> **정정 이력 (2026-10-05)**
> 이 절은 "세 가지 스키마를 v0.1로 고정한다"였다. IR이 06 절차로 0.3까지 올라간 뒤에도 남아 있던 문장을
> 현재 버전과 변경 절차 문서로 바꿨다. MVP 범위 자체는 바꾸지 않았다.

## 결과물 원칙

Export된 폴더는 가능한 한 독립적으로 동작해야 한다.

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
visual-spec-export/
└── dashboard/
    ├── components/
    │   ├── DashboardHeader.tsx
    │   ├── Sidebar.tsx
    │   ├── StatCard.tsx
    │   └── UserTable.tsx
    ├── DashboardPage.tsx
    ├── styles/
    ├── assets/
    ├── package.json
    └── README.md
```

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
