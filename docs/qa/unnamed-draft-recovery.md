# 이름 없는 초안 복구 (#319)

## 수명주기

- 편집한 이름 없는 문서는 기존 `visual-spec:autosave:draft:<UUID>` 봉투 그대로 보관한다.
  IR 스키마와 디스크 파일 형식은 바꾸지 않는다. Home의 **보관한 이름 없는 초안**은
  파일 카드와 분리되며 프로젝트 표시명, UUID, 현재 탭/보관 여부를 표시한다.
- 기본 전환 선택은 **초안 보관 후 이동 / 취소**다. New/Open/파일 카드/다른 초안으로
  바꾸기 전에 공유 초안 기록을 끝낸다. 브라우저 저장에 실패하면 현재 작업을 유지하고
  Export를 안내한다. 취소는 문서·내용·UUID와 보관본을 유지한다.
- Home은 문서를 교체하지 않는다. debounce 전이나 저장소 장애 중인 현재 탭의 편집도
  Home에서 재개할 수 있으며 **브라우저 보관 대기 — 이 탭을 닫지 마세요**로 구별한다.
  이 경우 탭 종료 후 복구는 보장하지 않는다. 수정 없는 New·첫 실행 데모는 목록에 넣지 않는다.
- **이어서 열기**는 일반 `loadSpec`의 새 UUID 경로를 사용하지 않고 autosave의
  `adoptLatest(..., restoreKey)`로 기존 UUID와 검증된 내용을 함께 채택한다.
  현재 문서 재개는 선택·Undo·내용을 아예 교체하지 않는다. Resume는 자연어 입력을
  적재하거나 에이전트 요청을 보내지 않는다.
- 명시적 workspace Save 성공 후 새 파일명을 실제 채택했을 때만 원래 이름 없는
  보관본을 제거한다. Save 실패·취소·늦은 응답·다운로드 fallback은 보관본을 유지한다.
  Save 중 계속 편집한 내용은 새 파일명의 메모리/탭 복구 및 후속 자동저장에 남는다.
- **삭제… → 초안 삭제**는 전환과 별도다. 확인창은 취소에 초기 포커스를 둔다.
  확인 뒤 원문과 현재 문서를 다시 확인하여 오래된 확인으로 새 내용을 삭제하지 않는다.
  현재 초안을 삭제하면 빈 문서와 새 UUID로 바꾸고 이전 debounce를 취소한다.
  파일과 이름 있는 문서의 `discardDraft`는 이 삭제 API를 사용하지 않는다.
- 보관 기간의 자동 만료는 없다. 명시적 삭제와 성공한 workspace Save만 보관본을 제거한다.
  `<UUID>:deleted`에는 삭제 장벽만 남으며 spec은 없다. 오래된 sessionStorage나 시작 캐시가
  이전 UUID를 재생성하지 않도록 한다. 브라우저 데이터 삭제·용량/권한 제한은 별도 한계다.

## 마지막 보관 시각·정렬·일괄 삭제 (#351)

- **시각 저장 방식: 원문 밖 보조 키 `<draft key>:meta`** = `{"savedAt": <epoch ms>}`.
  autosave가 같은 `<draft key>` Web Lock 안에서 원문을 쓴 직후에 기록한다(편집해 복구 대상이 된
  이름 없는 문서만, 수정 없는 New·데모는 기록하지 않는다).
  원문(`serializeStoredDocument` 봉투)에 넣지 않은 이유: Resume/Delete의 원문 CAS
  (`read(key) !== draft.raw`, `serializeStoredDocument(document) !== draft.raw`), autosave `baseline`
  비교, sessionStorage 복구가 모두 원문 문자열을 그대로 비교한다. 시각이 원문에 들어가면 같은 내용도
  다른 원문이 되어 충돌 오판·재개 거부가 생기고, `StoredDocument` 저장 형식도 바뀐다. 보조 키는
  원문·IR·디스크 형식을 바꾸지 않는다.
- 보조 키는 표시용이다. 기록 실패는 원문 쓰기를 되돌리지 않으며 그 초안은 시각 없는 초안으로 남는다.
  `listUnnamedDrafts()`는 기존대로 UUID 뒤에 `:`이 붙은 키(`:deleted`, `:owner`, `:meta`)를 초안으로
  보지 않는다. `removeUnnamedDraft()`(명시적 삭제·Save 은퇴 공통)는 `:deleted` 장벽을 세우고 원문과
  `:meta`를 함께 지운다.
- 정렬은 마지막 보관 시각 최근순이고 같으면 키 순이다(결정적). 시각이 없는 기존 초안이나 깨진
  `:meta`는 **시각 정보 없음**으로 목록 끝에 둔다. Home은 이 탭의 초안을 맨 위에 두고 나머지를 이 순서로
  보여 준다. 각 항목에 마지막 보관 시각, 페이지 수, 첫 페이지 이름·화면 크기, 첫 페이지 레이어(노드) 수를
  표시하고 UUID는 보조 정보로 계속 보여 준다. 보관 대기 중인 이 탭의 초안은 시각·요약 대신 기존 대기 안내를 둔다.
- **모두 삭제…**(초안이 2개 이상일 때)는 이 탭의 현재 초안과 다른 탭이 `:owner` 잠금으로 사용 중인 초안을
  제외한다. 확인창(취소에 초기 포커스)이 삭제 대상·제외 개수를 먼저 보여 주며, 취소는 아무것도 바꾸지 않는다.
  확인 뒤에는 개별 삭제와 같은 `remove()`를 초안마다 순차 호출한다 — 잠금·원문 CAS·`:deleted` 장벽을
  그대로 거치고 별도 삭제 경로는 없다. 확인 뒤 원문이 바뀌었거나 사용 중이 된 초안은 그 항목만 건너뛴다.
  끝나면 삭제/건너뜀/실패/제외 개수를 `role="status"`로 알린다. 진행 중에는 다른 초안 동작과 함께 비활성화된다.
  잠금 조회(`navigator.locks.query`)를 못 쓰면 사용 중 초안은 미리 제외되지 않고 `remove()`가 거부해 건너뜀으로 센다.
- 자동 만료는 여전히 없다. 일괄 삭제도 사용자가 확인한 명시적 삭제다.

## 탭 경합과 전환 경계

- 활성 이름 없는 문서는 `<draft key>:owner` Web Lock을 수명 동안 보유한다. Home에서도
  소유권을 유지한다. 다른 탭의 Resume/삭제는 기다려서 빼앗지 않고 **사용 중**으로 거부한다.
  소유 탭이 다른 문서를 열거나 종료하면 다른 탭에서 명시적으로 재개할 수 있다.
- 실제 비교/쓰기에는 기존 `<draft key>` 잠금을 그대로 사용한다. 두 탭 동시 Resume는
  한 탭만 UUID를 채택하며, 다른 탭의 메모리와 캐시는 유지한다. 시간제 lease 만료로
  숨긴 탭의 소유권을 빼앗지 않는다. StrictMode/HMR의 자체 해제 완료를 기다린 뒤 재획득한다.
- reload/Back/Forward 복구가 같은 UUID여도 다른 탭이 소유 중이면 Resume를 거부한다.
  소유 탭 종료 후 명시적 Resume 또는 확인된 Delete에서 실패한 잠금을 재획득하고 원문 기준을
  다시 확인한다. Delete는 Resume를 먼저 실행할 필요가 없으며, 삭제 잠금 대기 중 변경도
  CAS로 다시 검사한다.
  Resume는 이전에 중단된 debounce도 다시 예약한다. 다른 탭이 내용을 바꿨으면 충돌 상태와 양쪽 내용을
  보존하며 명시적으로 최신 내용을 채택하기 전에는 쓰지 않는다. Web Locks 미지원만 메모리
  재개 경로를 사용한다.
- reload/Back/Forward는 현재 UUID를 유지한다. opener가 sessionStorage를 복사해 준 새 탭은
  같은 내용의 독립 UUID를 받는다. 보관 UUID로 이동하려면 명시적 Resume와 소유권 검사를 거친다.
- #337의 `beginDocumentTransition()`과 각 await 뒤 `current()` 검사를 재사용한다.
  다른 초안의 채택 직전 `settle(null)`을 거치며, 원문 비교와 최종 검사는 잠금 안에서도 반복한다.
  중복 Resume, 전환 중 편집, 원문 변경은 오래된 작업의 적용을 막는다.

## 로컬 검증 기록

기준은 #337이 병합된 develop `27bed2baad7f3ece85daeb05520a4bc0f3414298`을 통합한 #319 작업이다.
최종 테스트 커밋과 CI 결과는 PR 본문에 기록한다.

- 단위 회귀: `test/unnamed-drafts.test.ts` — 검증/필터, named→unnamed UUID 채택,
  현재 탭 선택/history 유지, 다른 탭 소유권, 오래된 원문, 취소/중복/지연 전환,
  명시적 삭제와 오래된 세션, Save 성공/실패, Web Locks 부재, StrictMode 해제 경합,
  보관 대기 중 현재 탭 재개, edit→Undo 이후 오래된 Resume 승인 거부와 Redo 보존,
  Back 복귀 탭의 실패한 소유권 거부/재획득과 storage 이벤트 전 최신 원문 보호,
  Resume 없는 Delete 재획득 및 삭제 잠금 대기 중 CAS 변경 보호.
  #351: `:meta` 시각 기록(원문 무변경)과 최근순·시각 없는 초안 끝 정렬, 요약 값, 시각 기록 뒤 Resume/Delete
  CAS 유지와 `:meta` 정리, 일괄 삭제의 이 탭/다른 탭 소유 제외(잠금 조회 미지원 시 `remove()` 거부),
  확인 취소 무변경, 확인 뒤 원문이 바뀐 항목만 건너뜀.
- Chromium: `scripts/browser/unnamed-drafts.mjs` — 임시 workspace와 일반 fixture만 사용한다.
  빈/기존 파일 workspace, Home/Resume/reload/Back/Forward, 실제 opener의 독립 UUID,
  다른 활성 탭 Resume/삭제 거부, 동시 Resume의 단일 소유자, 소유 탭 종료 후 인계,
  Save as 취소/507 실패/실제 저장/재열기, 삭제 취소/확인/reload 비재생성,
  첫 데모/빈 문서/미연결 대조군, Web Locks 미지원의 메모리 초안 재개와 전환 차단,
  에이전트 요청 미전송을 검증한다. #351: 초안 3개의 최근순 표시와 시각·요약 문구, 다른 탭이 사용 중인
  초안을 제외한 모두 삭제의 확인창 개수·취소 무변경·확인 후 목록과 `:meta`/`:deleted` 상태, 새로고침 결과.
  UUID와 구조적 내용 일치를 검사하고 초기 fixture의 SHA-256을 출력한다.
- 공통 확인창 회귀: `scripts/browser/document-transitions.mjs`와
  `scripts/browser/project-dialogs.mjs`를 실제 Chromium으로 실행한다.
- 최종 결과와 미실행 항목은 PR에 기록한다. 강화 CI 통합 후 기존 opt-in codegen/page-shell
  브라우저 테스트 3개도 명시 실행해 전부 통과했다.

현재 로컬 결과(2026-10-09): pnpm 10.33.0, Node 24.19.0. typecheck/lint/build 통과,
일반 전체 테스트 112파일 1,810개 통과(기본 opt-in 3개 skip), 이어서 opt-in 3파일 3테스트도
명시 실행해 통과했다. 총 1,813개를 검증했다. 생성 타입 드리프트와
`git diff --check` 통과. 위 Chromium 스크립트 3개 통과. 브라우저 회귀는 비동기
New/Resume 클릭 뒤 File 메뉴가 나타나는 완료 시점까지 기다려 fixture 편집과 UUID/내용 비교를 진행한다.

재현 명령:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm generate:types
git diff --exit-code -- src/features/editor/schema/types.ts
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
  node scripts/browser/unnamed-drafts.mjs
```
