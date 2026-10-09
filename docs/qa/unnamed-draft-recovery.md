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

## 탭 경합과 전환 경계

- 활성 이름 없는 문서는 `<draft key>:owner` Web Lock을 수명 동안 보유한다. Home에서도
  소유권을 유지한다. 다른 탭의 Resume/삭제는 기다려서 빼앗지 않고 **사용 중**으로 거부한다.
  소유 탭이 다른 문서를 열거나 종료하면 다른 탭에서 명시적으로 재개할 수 있다.
- 실제 비교/쓰기에는 기존 `<draft key>` 잠금을 그대로 사용한다. 두 탭 동시 Resume는
  한 탭만 UUID를 채택하며, 다른 탭의 메모리와 캐시는 유지한다. 시간제 lease 만료로
  숨긴 탭의 소유권을 빼앗지 않는다. StrictMode/HMR의 자체 해제 완료를 기다린 뒤 재획득한다.
- reload/Back/Forward는 현재 UUID를 유지한다. opener가 sessionStorage를 복사해 준 새 탭은
  같은 내용의 독립 UUID를 받는다. 보관 UUID로 이동하려면 명시적 Resume와 소유권 검사를 거친다.
- #337의 `beginDocumentTransition()`과 각 await 뒤 `current()` 검사를 재사용한다.
  다른 초안의 채택 직전 `settle(null)`을 거치며, 원문 비교와 최종 검사는 잠금 안에서도 반복한다.
  중복 Resume, 전환 중 편집, 원문 변경은 오래된 작업의 적용을 막는다.

## 로컬 검증 기록

기준은 #337 `cf26d1187c45ac6aee0e671f6c8b940cf99502f1` 위의 #319 작업이다.
최종 테스트 커밋과 CI 결과는 PR 본문에 기록한다.

- 단위 회귀: `test/unnamed-drafts.test.ts` — 검증/필터, named→unnamed UUID 채택,
  현재 탭 선택/history 유지, 다른 탭 소유권, 오래된 원문, 취소/중복/지연 전환,
  명시적 삭제와 오래된 세션, Save 성공/실패, Web Locks 부재, StrictMode 해제 경합,
  보관 대기 중 현재 탭 재개, edit→Undo 이후 오래된 Resume 승인 거부와 Redo 보존.
- Chromium: `scripts/browser/unnamed-drafts.mjs` — 임시 workspace와 일반 fixture만 사용한다.
  빈/기존 파일 workspace, Home/Resume/reload/Back/Forward, 실제 opener의 독립 UUID,
  다른 활성 탭 Resume/삭제 거부, 동시 Resume의 단일 소유자, 소유 탭 종료 후 인계,
  Save as 취소/507 실패/실제 저장/재열기, 삭제 취소/확인/reload 비재생성,
  첫 데모/빈 문서/미연결 대조군, Web Locks 미지원의 메모리 초안 재개와 전환 차단,
  에이전트 요청 미전송을 검증한다.
  UUID와 구조적 내용 일치를 검사하고 초기 fixture의 SHA-256을 출력한다.
- 공통 확인창 회귀: `scripts/browser/document-transitions.mjs`와
  `scripts/browser/project-dialogs.mjs`를 실제 Chromium으로 실행한다.
- 최종 결과와 미실행 항목은 PR에 기록한다. unrelated opt-in codegen/page-shell 브라우저
  테스트 3개는 이 작업에서 실행하지 않았다.

현재 로컬 결과(2026-10-09): pnpm 10.33.0, Node 24.19.0. typecheck/lint/build 통과,
전체 110파일 1,796테스트 통과, opt-in 3파일 3테스트 미실행. 생성 타입 드리프트와
`git diff --check` 통과. 위 Chromium 스크립트 3개 통과. 브라우저 회귀는 비동기
Resume 클릭 뒤 File 메뉴가 나타나는 완료 시점까지 기다려 UUID/내용을 비교한다.

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
