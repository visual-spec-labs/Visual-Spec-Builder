# 사용자 여정 fixture 회귀와 실제 모델 QA (#292)

상태: **검증 준비/부분 회귀**. Related #292이며 완료 또는 최종 통합 판정이 아니다.
#279/#280/#282/#284/#272/#274의 계약·수정 반영을 확인한 뒤 최종 통합을 별도로 실행한다.
#280/#282/#290/#281/#284 구현, #302/#319 저장 전환·Resume 소스, #291 CI workflow는
이 변경 범위에 포함하지 않는다.

## 비용 없는 독립 실행

저장소에서 Node `^20.19.0 || >=22.12.0`, pnpm **10.33.0**으로
`pnpm install --frozen-lockfile`을 먼저 실행한다. 새 harness는 Node Playwright와 Chromium이
추가로 필요하다. Playwright는 제품 의존성이나 lockfile에 추가하지 않는다.
아래는 선택적 QA 도구를 임시 폴더에 설치하는 예다(패키지 설치는 네트워크가 필요하다).

```bash
mkdir -p /tmp/vsb-browser-tools
pnpm --dir /tmp/vsb-browser-tools add playwright@1.57.0
export PLAYWRIGHT_MODULE=/tmp/vsb-browser-tools/node_modules/playwright/index.mjs
export CHROME_BIN=/usr/bin/chromium
node scripts/browser/export-journey.mjs
node scripts/browser/project-dialogs.mjs
```

Linux Chromium과 그 시스템 라이브러리는 실행 환경에 미리 준비한다. Playwright가 설치한
브라우저를 쓰려면 `CHROME_BIN`을 생략할 수 있다. 모듈이나 브라우저가 없으면 이 명령은
실패하며 조용히 skip하지 않는다. 스크립트는 자체 Vite 서버를 임의의 로컬 포트에 띄우고,
임시 작업공간과 브라우저를 정리한다. 별도의 `pnpm dev`나 실제 사용자 파일은 필요 없다.
공용 `scripts/browser/harness.mjs`는 브라우저 HTTP 요청을 해당 서버 origin으로 제한하고
service worker를 차단한다. 외부 폰트도 읽지 않으므로 폰트 일치/픽셀 비교를 주장하지 않는다.
외부 에이전트 프로세스·모델 API·새 계정·자격증명은 사용하지 않는다.

| 실행 경로 | 실제로 확인하는 것 | 확인하지 않는 것 |
|---|---|---|
| `export-journey.mjs` | 기존 image-hero에서 만든 2페이지 문서를 파일명 `customer-copy.json`으로 열기 → Export 검사 → GUI에서 Beta로 전환 → 낡은 결과/다운로드 제거 → 재검사 대상 확인 → 검사 후 자산 삭제 → 다운로드 없음/누락 표시 → 복구·재시도 → 실제 ZIP 자산 바이트·페이지 파일 확인. spec·문서 ID·파일명·Undo/Redo 보존 | fixture TSX의 실제 AI 생성 품질, ZIP 독립 앱 렌더, 페이지별 생성 파일 필터링 |
| `project-dialogs.mjs` (기존 회귀 재사용) | Open/Save as 취소·손상 파일·중단된 요청에서 문서/선택/history 보존, 실제 Save as/이름 변경, 늦은 목록 응답, 두 번째 탭 저장 충돌 대화상자 | #302/#319 저장 전환·Resume 완료, 다중 탭 AI 요청 소유권 |

페이지 전환 자체는 history.present.activePageId를 바꾼다. 나머지 history·문서 내용·신원은
동일해야 한다. 새 Export 여정의 setup은 디스크 fixture이고, GUI 조작으로 경로를 실행한다.
스토어 import는 상태 판독에만 사용한다. TSX는 손으로 작성한 최소 이미지 컴포넌트이며
완전한 스펙 매핑 또는 실제 모델 출력으로 취급하지 않는다.

기존 선택적 DOM 실측도 다시 사용할 수 있다. 아래 3개는 **Python Playwright**가 별도로
설치돼 있어야 하며, responsive/page-shell은 현재 `/usr/bin/chromium`을 고정 사용한다.
Node Playwright 설치만으로는 실행되지 않는다. Grid는 `CHROME_BIN`도 지원한다.

```bash
VSB_RESPONSIVE_BROWSER=1 VSB_PAGE_SHELL_BROWSER=1 VSB_GRID_BROWSER=1 \
  CHROME_BIN=/usr/bin/chromium pnpm exec vitest run \
  test/responsive-codegen-browser.test.ts \
  test/page-shell-browser.test.ts test/grid-codegen-browser.test.ts
```

위 명령들을 #291의 브라우저 job에서 재사용할 수 있다. 이 PR은 workflow를 변경하지 않는다.
일반 `pnpm test`는 위 3개 실측을 기본 skip하며 `scripts/browser/*.mjs`도 실행하지 않는다.
따라서 일반 테스트 성공과 실제 브라우저 실행 여부를 각각 보고한다.

## 실제 모델 검증 — 이번 작업에서는 미실행

아래는 계약 통합 후, 실제 모델 사용이 별도로 승인된 환경에서 수행할 절차다.
fixture 성공이나 [과거 로그인 QA](../15-workflow-qa.md)를 이 절차의 성공으로 대체하지 않는다.

1. develop SHA·Node/pnpm·에이전트/모델 버전·기존 인증 상태·입력 파일 SHA256을 기록한다.
   사용자 승인 범위 내 기존 계정을 사용한다. 새 계정/키를 만들거나 무단 유료 호출하지 않는다.
2. 새 작업공간에서 사용자가 외부 Claude Code/Codex를 직접 실행하고 자연어 요청 → 응답 적용을
   진행한다. 요청/응답 ID, 문서/페이지/티켓 식별자, 오류와 재시도 기록을 보존한다.
3. 생성된 화면을 GUI에서 후속 수정하고 저장한 뒤 재생성한다. 초기·수정·재생성 스펙과 TSX,
   요청/응답 원문 및 diff를 보존한다. 편집 직후 문서 전환, 낡은 티켓, 다중 탭 요청은
   각 담당 수정/계약이 반영된 SHA에서 별도로 실행한다. 중간 실패도 성공으로 덮지 않는다.
4. 최소한 이미지(노드와 배경), 반응형, 여러 페이지 사례를 각각 수행한다. 이미지 파일의
   존재/ZIP 포함/실제 브라우저 로딩을 확인하고, 모든 페이지에 대해 GUI 후속 수정과 재생성
   결과를 비교한다. 로그인 한 화면 성공으로 나머지를 통과시키지 않는다.
5. GUI에서 ZIP을 받아 SHA256과 파일 목록을 기록한다. 별도 React/TypeScript/Tailwind 앱에
   원본 출력 그대로 통합하고 실제 TSX가 tsconfig와 Tailwind 스캔 범위에 포함되는지 확인한다.
   해당 앱의 typecheck/build, production preview, 모든 페이지의 표시/런타임 오류를 기록한다.
   수동으로 출력 파일을 수정해야 했다면 원본 실패와 수정 후 결과를 분리한다.
6. [화면 비교 계약](../20-screen-layout-contract-qa.md)의 동일 Chromium/DPR/폰트 준비/
   viewport/zoom 조건에서 GUI와 독립 앱의 전체 보이는 노드 좌표를 수집한다. 고정 화면은
   390×844, 반응형은 모든 breakpoint 직전·경계·직후 및 좁은 폭으로 복귀를 포함한다.
   노드 ID 집합 및 root 상대 x/y/width/height 차이 ≤1 CSS px를 기존
   `scripts/compare-layout-measurements.mjs`로 판정한다. 스크린샷·좌표 JSON·폰트/이미지 로딩
   증거를 함께 보존하고, 비교 조건 불일치는 성공이 아니라 측정 무효로 기록한다.

결과 기록은 사례별 `입력/출력/ZIP 해시 · 모델/요청 ID · GUI 수정 내용 · 독립 앱 검사 명령과
exit code · 브라우저/viewport · 좌표 비교 결과 · 증거 경로 · PASS/FAIL/미실행/차단 이유`를
포함한다. 저장소에 보존하지 않은 `/tmp` 경로만을 영구 증거로 삼지 않는다.

## 2026-10-09 로컬 실행 기록

기준 develop: `44370d4f6151f2e351f41ebc5f000eb669a9b735`.
Node 24.19.0, pnpm 10.33.0, Node Playwright 1.57.0,
Chromium 151.0.7922.173 (Debian Linux).

- 신규 Export 여정: 실제 Chromium 실행 PASS (페이지 전환/자산 실패/재시도 ZIP/문서 보존).
- 기존 대화상자 여정: 공용 harness로 실제 Chromium 실행 PASS (6개 PASS 로그).
- 실제 모델 호출 및 독립 앱의 실제 모델 출력 검증: **미실행**.
- 최종 통합: 선행 계약과 담당 작업 완료 전 **보류**.
- 로컬 `typecheck`/`lint`/`build` 및 생성 타입 일치: PASS. Build의 기존 native-config 및
  500 kB chunk 경고는 남아 있다.
- 전체 `pnpm test`: 109파일/1,773개 PASS, 선택적 브라우저 3개 skip. 첫 실행은 tarball
  소비 프로젝트 설치에서 실패했고, 아래 쓰기 가능한 캐시 환경으로 재실행해 통과했다.
- 선택적 Chromium 실측: responsive/page-shell 2개 PASS. Grid 1개는
  `spawnSync /usr/bin/chromium ETIMEDOUT`으로 실패했고 같은 캐시 환경의 단독 재시도에서도
  재현됐다. Grid 테스트/제품 소스는 변경하지 않았다. #291 환경에서 재검증이 필요하다.

홈 캐시 경로가 쓰기 불가능한 이 실행 환경에서는 다음 환경으로 설치/전체 테스트를 실행했다.
일반 개발 환경에서는 필요하지 않다.

```bash
COREPACK_HOME=/tmp/vsb-corepack XDG_DATA_HOME=/tmp/vsb-data \
  XDG_CACHE_HOME=/tmp/vsb-cache npm_config_store_dir=/tmp/vsb-pnpm-store \
  corepack pnpm test
```
