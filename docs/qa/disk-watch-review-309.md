# PR #309 디스크 감시 리뷰 회귀 검증

2026-10-07, Node 24.19.0 / pnpm 10.33.0 / Linux Chromium.
수정 기준은 PR HEAD `674b308eb8cfdccd2e0a16c23a8c03ed41222552`이며,
수정 후 develop `180be5b737ce4bb175f53281ddb428370380a924`를 일반 merge했다.
TypeScript 테스트 목록 충돌은 양쪽 항목을 모두 보존했다.

## 수정과 자동 회귀

- 최초 workspace 상태 조회 실패: snapshot 읽기에 상태 조회를 포함하고 3초마다 재시도한다.
- 상태 조회·snapshot 본문 무응답: 읽기 전체를 5초로 제한하고 AbortSignal을 전달한다.
  취소를 무시하는 transport도 Promise race로 끝내 다음 읽기를 막지 않는다.
- 외부 변경으로 활성 페이지 삭제: 대체 페이지로 이동하면 선택·포커스를 초기화한다.
- Home, 같은 파일 재열기(documentId 변경), 저장 충돌 paused, 파일·버전 변경:
  감시 세대를 올리고 진행 중인 읽기를 취소한다. 응답과 확인 질문은 적용 직전 유효성을 확인한다.
- Home에서 Open은 문서 갱신 뒤 화면을 바꾸므로, 에디터 진입 시 취소된 기준 읽기를 다시 시작한다.

`test/disk-watch.test.ts`는 실제 Zustand 스토어와 Undo/Redo를 사용한다.
`test/disk-watch-transport.test.ts`는 실제 workspaceClient에 fetch 응답만 대체하여
최초 503, status 무응답, 본문 무응답 후 재시도와 signal 취소를 검증한다.
두 파일의 회귀 22개가 통과했다.

## 실제 브라우저

Vite를 `VISUAL_SPEC_WORKSPACE=/tmp/pr309-browser`로 띄워 Python Playwright와
`/usr/bin/chromium`으로 실행했다. 테스트 파일은 사용자 작업공간과 분리했다.

1. seedSpec을 migrateV01로 변환한 `specs/qa.json`을 Home 카드에서 연다.
2. 브라우저 밖에서 Python으로 `headerTitle.content`를 `PR309 external disk change`로 바꾼다.
3. 실제 감시가 캔버스에 자동 반영하는 것을 확인한다.
4. 레이어 툴바 Undo로 원래 제목, Redo로 변경된 제목을 확인한다.
5. File → Save 뒤 실제 디스크 JSON의 제목을 확인한다.
6. File → Open에서 같은 파일을 다시 열어 변경된 제목을 확인한다.

통합 merge 후에도 전 과정 통과, pageerror 0건.
무응답과 문서 전환 경합은 위 자동 회귀로 검증했으며 브라우저 네트워크 지연 주입은 하지 않았다.

## 검증 결과

- `pnpm install --frozen-lockfile` (지정 버전 10.33.0): 통과.
- typecheck / lint / build: 통과. Vite의 기존 native-config 및 큰 번들 경고는 남는다.
- 전체 테스트: 101 files / 1667 tests 통과, opt-in 브라우저 2개는 기본 실행에서 skip.
- generate:types / generate:contract 뒤 `git diff --exit-code`: 통과, 생성물 드리프트 없음.
- GitHub 리뷰·check-runs API는 이 환경에서 Forbidden: 원격 CI 상태는 확인하지 못했다.
- opt-in 반응형 Chromium 테스트: 별도 실행 통과.
- opt-in Grid Chromium 테스트: 별도 실행 실패 (`spawnSync /usr/bin/chromium ETIMEDOUT`).
  writable XDG cache/config 경로를 지정한 재시도도 시간 초과. Grid 결과 정합성을 확인하지 못했으며,
  이 실패는 디스크 감시 브라우저 검증과 별개다. 이번 변경에서 Grid 구현·테스트를 수정하지 않았다.
