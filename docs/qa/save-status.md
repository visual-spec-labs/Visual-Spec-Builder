# 파일 저장·브라우저 초안 상태 (#289 후속)

기준: #340과 #341이 병합된 develop `b1e9755aeba345fe1ff8af2f3d206cd58c9a07f3`.
Related #289. 기존 선택 범위·반응형·viewport 표시는 유지한다.

## 표시 계약

파일명·diskRevision 또는 Save 버튼 클릭만으로 **저장됨**을 표시하지 않는다.
`diskWatch`가 실제 workspace snapshot을 읽고 검증한 문서 내용, 파일명, revision 및
`documentId`를 표시 전용 `persistenceStatusStore`에 보고한다. 현재 문서와 일치할 때만
**파일 저장됨**이다. Save 중 추가 편집, 복원된 초안, rename 중 미저장 편집은 현재 메모리를
저장 기준으로 삼지 않으므로 잘못된 저장 완료로 바뀌지 않는다.

화면 메뉴바의 기존 제목 아래 파일/초안 상태를 따로 지속 표시한다. 상태 줄은 `role=status`이며
프로젝트 이름·미리보기 폭처럼 매 입력마다 바뀌는 값은 포함하지 않는다. 상태 줄을 Tab으로
선택하고 Enter/Space로 설명을 열 수 있다. Escape는 설명을 닫고 summary로 포커스를 돌린다.
오류·충돌·보관 실패는 색상 없이도 문구로 식별된다. 기존 content/surface 토큰을 사용한다.

```text
프로젝트 — 페이지 · 파일명
파일 저장됨 / 수정됨 / 저장 중 / 실패 / 미확인 … · 브라우저 초안 보관 상태 ▾
  [상태 설명: 파일과 초안의 차이, 현재 상태에서 가능한 조치]
```

| 파일 표시 | 근거 |
|---|---|
| 파일 미저장 | 파일명이 없는 문서. 수정 없는 New/데모도 파일 저장으로 간주하지 않음 |
| 파일 저장 미확인 | 현재 문서와 일치하는 디스크 관측값 없음, 읽기 실패, 읽은 내용 검증 실패 |
| 파일 저장됨 | 관측한 파일명·문서 ID·revision·전체 내용이 현재 문서와 같음 |
| 수정됨 · 파일 미저장 | 확인된 같은 파일/revision과 현재 내용이 다름 |
| 외부 파일 변경 | 확인한 디스크 revision이 현재 기준 revision과 다름 |
| 파일 저장 중 | 현재 문서의 명시적 Save/Save as 요청 진행 중 |
| 파일 저장 실패 | 현재 문서의 최신 저장 요청 실패. 충돌이면 충돌 표시가 우선 |
| 다운로드 요청됨 | 다운로드 fallback을 요청함. 디스크 저장 완료는 확인할 수 없음 |
| 초안 선택 필요 | 기존 충돌 스토어가 `paused`, reason `draft`로 열린 파일/보관 초안을 비교 중 |
| 충돌 · 저장 중단 | 기존 충돌 스토어가 다른 탭/디스크 충돌로 저장을 중단함 |

| 초안 표시 | 근거 |
|---|---|
| 초안 보관 확인 중 | 현재 문서/내용의 관측값이 아직 없음 |
| 브라우저 초안 보관됨 | 현재 내용과 기존 per-document localStorage 봉투가 정확히 같음 |
| 현재 탭에만 보관 | shared 봉투 일치를 확인하지 못했지만 현재 sessionStorage 복구 기록 성공 |
| 초안 보관 실패 | 현재 내용의 shared 일치와 sessionStorage 기록 성공 모두 확인하지 못함 |
| 다른 탭 사용 중 | 이름 없는 초안의 owner lock 요청에서 실제로 `lock=null`을 받음 |

보관 완료는 **현재 내용**의 기록을 뜻한다. 브라우저 데이터 삭제/용량·권한 제한까지 보장하지 않는다.
현재 탭 복구만 성공하면 Home의 공유 보관과 구별한다. 파일 저장이 확인된 경우에는 그 사실을,
파일 미저장 내용에는 탭을 닫기 전 Save 또는 Export가 필요하다는 설명을 제공한다.
잠금 API 예외나 미지원은 다른 탭 소유라고 단정하지 않는다. `claimDraft.status`는 기존 boolean
`ready` 결과의 이유를 읽기 전용으로 노출하며 소유권 획득/해제 동작은 그대로다.

## 경합과 전환

- 디스크 증거는 기존 watcher의 세대/파일/revision/화면 검사를 통과한 결과만 보고한다.
  문서 전환·Home 전환·충돌 시 무효화하며 주기 읽기 실패도 과거의 저장됨 표시를 제거한다.
- 성공한 Save 자체는 파일 저장됨 증거가 아니다. 원래 저장/채택 절차를 실행한 뒤 watcher의
  내용 확인을 기다린다. 요청 중 편집하면 요청 시점의 JSON만 디스크에 있어도 수정됨으로 남는다.
- Save as 취소는 저장 시도를 시작하지 않는다. 늦은 요청/완료는 documentId와 최신 요청 객체를
  확인하므로 다른 문서나 더 최근 요청 상태에 붙지 않는다.
- 다운로드 fallback·Export는 디스크 저장 완료로 간주하지 않는다. 후속 편집도 과거 다운로드를
  현재 내용의 저장으로 보지 않는다.
- 초안 상태는 기존 autosave의 `preserve`, shared write 결과와 ownership 결과를 관측한다.
  쓰기 방식·잠금 순서·전환 승인·복구·삭제/CAS를 변경하지 않는다.
- #319의 Resume는 같은 UUID·내용으로 돌아오며 파일 미저장과 보관 상태를 표시한다.
  다른 탭 사용 중이면 소유권 거절을 유지한다. 저장 실패/취소는 기존 UUID를 유지한다.
- 스키마·Command·IR·저장 봉투에 UI 필드를 추가하지 않는다. App/Home/PromptDialog 변경도 없다.

## 검증

`test/persistence-status.test.ts`는 실제 autosave, watcher, Save/Save as와 표시 판단 함수를
연결하고 저장소/잠금/transport만 fixture로 대체한다. 파일명만 있는 초기 상태, 디스크 일치,
수정→탭복구→shared 보관, Save 중 추가 편집, 실패, 취소, 다운로드, 늦은 저장/읽기,
읽기 실패, 외부 변경/충돌/최신 초안 채택, 무제 복구, 다른 탭 소유권, 저장소 실패,
잠금 API 오류 오분류 방지를 검사한다. 기존 생명주기 회귀 전체도 실행한다.

실제 Chromium은 수동 지정 fixture를 사용하며 실제 AI 생성 실행은 아니다.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm generate:types
git diff --exit-code -- src/features/editor/schema/types.ts
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
  node scripts/browser/save-status.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
  node scripts/browser/unnamed-drafts.mjs
```

- `save-status.mjs`: 실제 파일 열기/저장과 저장 바이트 비교, 507 실패, Save as 취소,
  지연 PUT 중 추가 편집, GET 실패, 실제 다른 탭 storage 이벤트 충돌/복구,
  문서 전환, 키보드 설명 열기/닫기, 다운로드 fallback, shared/sessionStorage 실패.
  OS 임시 폴더의 `vs-save-status-qa`에 light/dark 화면을 기록한다(`VSB_QA_ARTIFACTS`로 변경 가능).
- `unnamed-drafts.mjs`: 기존 #319 회귀에 표시 검증을 추가했다. Home/Resume/reload/
  Back/Forward/새 탭, 소유권 거절/재획득, UUID·내용 보존, 취소·실패·실제 Save·재열기,
  삭제·문서 전환, Web Locks 미지원, 자동 에이전트 요청 없음.
- UI 변경은 메뉴바 상태/설명에 한정한다. 기존 #340 선택 범위·반응형 회귀와 #337 전환
  모달 브라우저 회귀도 별도로 유지한다.
- 로컬 전체 테스트: 114개 파일 / 1,834개 통과, opt-in 브라우저 3개는 별도 CI에서 실행한다.
  typecheck, lint, build, 스키마 드리프트 검사를 통과했다. Chromium 151.0.7922.173에서
  위 스크립트와 기존 선택·반응형·전환 회귀가 통과했고 페이지 오류는 없었다.
- Windows 포함 최종 SHA CI와 실제 실행 결과는 PR 본문에 기록한다. 실제 스크린리더 음성
  및 여러 브라우저의 다운로드 완료는 검증하지 않았다. 브라우저 상태 표시는 마지막 관측 결과이며
  디스크 감시는 기존 3초 주기와 백그라운드 실행 제한을 따른다.

남은 #289 범위: 개별 속성 섹션 전체 용어·빈 상태 감사와 전체 앱 접근성 감사는 이 PR에서
완료를 주장하지 않는다. #280/#282/#290/#281/#284나 전역 재설계는 포함하지 않는다.

## #344 독립 검토 후 관측 회복 회귀

- 알림이 이미 열렸거나 사용자가 같은 revision에 대해 ‘내 편집 유지’를 선택해도 성공한
  디스크 읽기는 표시용 관측값을 먼저 갱신한다. 일시 GET 실패 뒤 같은 외부 변경 상태를 회복한다.
- baseline/poll 읽기에 요청 순서를 부여한다. 더 최신 요청 결과를 반영한 뒤 도착한 이전 응답은
  관측값과 baseline 모두 갱신하지 않는다. r2 알림 → 유지 → 지연 r1 응답 순서에서도 잠깐의
  ‘파일 저장됨’ 전이가 발생하지 않는지 store 구독으로 검사한다.
- Home/Resume은 같은 문서의 유지 선택을 보존한다. 실제 문서/파일 변경은 기존대로 초기화한다.
- 모듈 회귀는 열린 알림/유지한 알림 두 경로의 GET 회복, 반복 읽기, Home/Resume을 검사한다.
  실제 Chromium도 HTTP baseline 응답 지연과 실제 디스크 r2 쓰기, GET 실패/회복 및
  Home 클릭 후 같은 메모리 문서의 navigation Resume을 실행해 중복 알림과 false-saved를 검사한다.
