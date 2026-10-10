# 사용자 여정 fixture 회귀와 실제 모델 QA (#292)

상태: **검증 준비/부분 회귀**. Related #292이며 완료 또는 최종 통합 판정이 아니다.
#279/#280/#282/#284/#272/#274의 계약·수정 반영을 확인한 뒤 최종 통합을 별도로 실행한다.
#280/#282/#290/#281/#284 구현과 제품 소스는 변경하지 않는다. #338 준비 단계 뒤,
현재 후속은 develop에 반영된 기존 fixture 여정을 CI에 연결한다. 과거 실행 기록은 아래에 보존한다.

## 비용 없는 독립 실행

저장소에서 Node `^20.19.0 || >=22.12.0`, pnpm **10.33.0**으로
`pnpm install --frozen-lockfile`을 먼저 실행한다. 새 harness는 Node Playwright와 Chromium이
추가로 필요하다. Playwright는 제품 의존성이나 lockfile에 추가하지 않는다.
아래는 선택적 QA 도구를 임시 폴더에 설치하는 예다(패키지 설치는 네트워크가 필요하다).

```bash
mkdir -p /tmp/vsb-browser-tools
pnpm --dir /tmp/vsb-browser-tools add playwright@1.62.0
export PLAYWRIGHT_MODULE=/tmp/vsb-browser-tools/node_modules/playwright/index.mjs
export CHROME_BIN=/usr/bin/chromium
node scripts/browser/export-journey.mjs
node scripts/browser/project-dialogs.mjs
```

Linux 시스템 Chromium을 사용하는 위 예에서는 브라우저와 시스템 라이브러리를 미리 준비한다.
Playwright 관리 Chromium을 쓰려면 **같은 QA 도구 폴더에서 먼저 설치**하고 `CHROME_BIN`을
지운 뒤 두 스크립트를 실행한다. Linux 시스템 라이브러리 설치 권한이 필요한 환경은 관리자에게 준비를 요청한다.

```bash
pnpm --dir /tmp/vsb-browser-tools exec playwright install chromium
unset CHROME_BIN
# Linux 시스템 라이브러리까지 준비할 때: playwright install --with-deps chromium
```

Windows PowerShell에서는 다음처럼 실행한다. `PLAYWRIGHT_MODULE`은 동적 ESM import 대상이므로
`C:/...` 또는 `C:\...` 문자열 대신 **file:/// URL**을 지정해야 한다. 아래 URI 변환은 공백도
인코딩한다. 반면 `CHROME_BIN`은 실행 파일 경로이므로 file URL로 바꾸지 않는다.

```powershell
$qaTools = Join-Path $env:TEMP "vsb-browser-tools"
New-Item -ItemType Directory -Force $qaTools | Out-Null
pnpm --dir $qaTools add playwright@1.62.0
pnpm --dir $qaTools exec playwright install chromium
$modulePath = Join-Path $qaTools "node_modules/playwright/index.mjs"
$env:PLAYWRIGHT_MODULE = ([System.Uri]$modulePath).AbsoluteUri
Remove-Item Env:CHROME_BIN -ErrorAction SilentlyContinue
# 시스템 Chrome을 쓸 경우 위 줄 대신:
# $env:CHROME_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"
node scripts/browser/export-journey.mjs
node scripts/browser/project-dialogs.mjs
```

모듈이나 브라우저가 없으면 명령은 실패하며 조용히 skip하지 않는다. 스크립트는 자체 Vite
서버를 임의의 로컬 포트에 띄우고, 임시 작업공간과 브라우저를 정리한다. 별도의 `pnpm dev`나
실제 사용자 파일은 필요 없다. 준비 URL은 ANSI 색 코드를 제거한 누적 출력에서 찾으므로
Windows의 색 출력과 청크 경계에서 분리된 색 코드도 처리한다.
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

일반 `pnpm test`는 위 3개 실측을 기본 skip하며 `scripts/browser/*.mjs`도 실행하지 않는다.
CI의 별도 Chromium 잡이 이 3개 실측과 아래 6개 사용자 여정을 각각 명시 실행한다.
따라서 일반 테스트 성공과 실제 브라우저 실행 여부를 각각 보고한다.

## 사용자 여정 6개 CI 게이트

기준 develop `157ab1752b9ca87df4e79002ebde99cb8965fad7`의 기존 Node 여정 5개에 #281 생성 출력 소유권 회귀를 더했다.
Linux에서 Node Playwright 1.62.0과 Chromium을 준비한 뒤 저장소 루트에서 실행한다.

```bash
export PLAYWRIGHT_MODULE=file:///tmp/vsb-browser-tools/node_modules/playwright/index.mjs
export CHROME_BIN=/usr/bin/chromium
FORCE_COLOR=1 bash scripts/browser/run-journeys.sh
```

이 묶음 실행기는 **Linux Bash + GNU timeout** 전용이다. Windows에서는 앞의 PowerShell
예제처럼 개별 스크립트를 실행한다. Linux CI는 Python/Node Playwright 모두 1.62.0을 사용하고
Python이 설치한 같은 Chromium을 CHROME_BIN으로 지정한다. Node 도구는 runner 임시 경로에
설치하므로 제품 package.json/lockfile을 변경하지 않는다.

| 순서 | 기존 스크립트 | 단언 범위 |
|---|---|---|
| 1 | export-journey.mjs | 페이지 전환 검사 무효화·자산 실패·재시도 ZIP 바이트·문서 신원 |
| 2 | project-dialogs.mjs | Open/Save as 취소·손상 파일·대화상자 포커스·두 탭 저장 충돌 |
| 3 | document-transitions.mjs | New/Open/카드 전환 취소·교체 요청·두 탭 충돌·명시적 승인·낡은 응답 ABA |
| 4 | unnamed-drafts.mjs | Home/Resume/새로고침·탭별 UUID·동시 소유권·저장/삭제·Web Locks 없는 경우 |
| 5 | save-status.mjs | 실제 저장/실패 표시·저장 중 편집·외부 변경/충돌·지연 응답·다운로드/보관 실패 |
| 6 | generation-ownership.mjs | 손상 registry 차단·정상 404/direct 출력 ZIP·잠금 중 실제 Home 연속 rename·stale destination 배제·후속 가짜 티켓 수용의 신원/바이트 |

기존 시나리오의 단언을 유지하고 세 스크립트의 중복 시작/종료를 공용 harness로 옮겼다.
저장 상태의 읽기 실패/복구는 주입한 503과 복구된 200 응답도 확인한 뒤 기존 UI 단언을 실행한다.
일시적인 미확인 표시만 보고 fault 주입을 너무 일찍 해제하지 않도록 대기를 강화했다.
각 실행은 새 TMPDIR/TMP/TEMP와 VSB_QA_ARTIFACTS를 받는다. workspace, 브라우저 프로필,
스크린샷은 그 임시 경로 안에만 생기며, 완료/실패 때 제거한다. 실제 사용자 파일이나 에이전트
프로세스는 사용하지 않는다. 모든 브라우저 context에 같은-origin 요청 제한과 service worker
차단을 적용한다. 일부 경로는 스토어를 통해 fixture 상태를 만들므로 모든 조작이 GUI 입력인
완전한 E2E라고 주장하지 않는다.

각 여정은 120초 후 SIGTERM, 10초 후에도 종료되지 않으면 강제 종료한다. harness는 SIGTERM/
SIGINT에서 브라우저와 Vite를 닫으며, Vite 종료에도 5초 상한을 둔다. 묶음은 첫 nonzero에서
멈추고 임시 루트를 지운다. 마지막 `PASS all 6 fixture journeys (no skips)`는 여섯 프로세스가
모두 exit 0일 때만 출력한다. `VSB_JOURNEY_TIMEOUT_SECONDS=1`처럼 제한을 줄여 실패 경로를
진단할 수 있지만 120초보다 늘리거나 0으로 해제할 수는 없다. 게이트 단위 회귀는 exit 37과
정지 fixture의 timeout 124가 다음 여정/성공 로그로 가려지지 않고 임시 파일을 정리함을 확인한다.

CI browser 잡은 총 15분 상한이며 기존 build 집계에 그대로 연결된다. 실패·취소·skip을
성공으로 바꾸지 않고 권한은 contents:read를 유지하며 secrets를 추가하지 않는다. 독립 여정은
로그로 결과를 남기고 현재 스크린샷은 업로드하지 않는다.

`editing-context.py`와 `property-guidance.py`는 외부에서 띄운 서버 URL/상태 준비 계약을 쓰는
별도 수동 도구여서 이번 다섯 Node 여정 게이트에 넣지 않았다. 해당 검증을 실행했다고
계산하지 않는다. 실제 모델 자연어→GUI 후속 수정→재생성→독립 앱 통합, 이미지/반응형/
다중 페이지의 실제 모델 시각 비교, 미완료 선행 계약의 최종 통합은 여전히 #292의 남은 범위다.

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
   `scripts/browser/layout-parity.mjs --generated-dir <Export 폴더>`가 이 수집·판정을 같은 조건으로
   실행한다([25](../25-layout-parity-contract.md) 3절).

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

## #338 리뷰 반영 검증

13:47 UTC 리뷰의 Windows 색 출력은 준비 URL 인식의 실제 결함이다. `vite-ready.mjs`가
누적 출력의 ANSI 코드를 제거한 뒤 URL을 찾으며, `browser-vite-ready.test.ts`의 5개 회귀가
일반 출력·색 출력·분할 색 코드/URL·조기 종료·timeout을 확인한다. 전역 색 환경을 강제로
바꾸는 대신 입력 파싱을 수정했다. 새 주석은 한국어로 정리했다.

Windows ESM file URL과 브라우저 설치 절차도 위에 추가했다. Windows 실제 OS 재실행은
이 Linux 환경에서 수행하지 않았으며, 리뷰어의 기존 Windows 결과와 신규 플랫폼 독립 회귀를
구분한다. CI workflow 확장은 #291 담당이므로 유지했다. 일반 CI에는 새 준비 회귀가 포함되지만
독립 사용자 여정 스크립트 실행은 여전히 별도다. #336 Grid 수정은 중복 구현·통합하지 않았다.

리뷰 반영 후 Linux 재실행: 타입·lint·build·생성 타입 일치 PASS, 전체 110파일/1,778테스트
PASS(선택적 3 skip). `FORCE_COLOR=1`, `PLAYWRIGHT_MODULE=file:///.../playwright/index.mjs`로
실제 Chromium Export 2건·대화상자 6건 PASS. responsive/page-shell 실측도 PASS이며,
미통합 Grid의 기존 `--dump-dom` timeout은 이 변경의 성공에 포함하지 않는다.


## 사용자 여정 CI 연결 로컬 검증 (2026-10-09)

기준 develop `157ab1752b9ca87df4e79002ebde99cb8965fad7`, Node 24.19.0/pnpm 10.33.0,
Node·Python Playwright 1.62.0, 시스템 Chromium 151.0.7922.173에서 확인했다.

- 타입·lint·production build·생성 타입 일치 통과. 기존 Vite 경고는 남아 있다.
- 전체 115파일/1,841테스트 통과, 기존 opt-in 3 skip. Linux 게이트 회귀 2개 포함.
- 기존 Python Chromium 검사 3개 별도 실행 통과.
- 강제 색 출력과 file URL 모듈 경로로 Node 사용자 여정 5개 모두 통과.
- 중간 실행의 저장 상태 여정은 읽기 복구 대기에서 한 번 timeout이었다. 단독 재실행은
  통과했고, 실제 실패/복구 응답 대기를 추가한 뒤 5개 전체 재실행이 통과했다. 단언이나
  timeout 상한을 완화하지 않았다.
- 실제 브라우저 1초 제한은 exit 124, 없는 Playwright 모듈은 exit 1로 전파됐고,
  각 경우 임시 루트에 남은 파일/디렉터리는 0개였다.

CI의 최종 SHA 및 실제 실행 결과는 후속 Draft PR에 기록한다. 이 기록은 실제 모델/외부
에이전트 또는 #292 전체 검증 완료의 증거가 아니다.


## 손상 파일 Open의 완료 대기 회귀

기준 develop `130f6b565402b8245cc2b7606e8450fba83cf020`의
[CI 실패](https://github.com/visual-spec-labs/Visual-Spec-Builder/actions/runs/37981642459/job/113993370505)는
`project-dialogs.mjs`가 picker 닫힘만 기다린 뒤 `broken.json` 알림 존재를 단언해서 발생했다.
Open은 picker를 닫은 다음 비동기 파일 읽기·문서 전환 준비·JSON 파싱을 진행한다.

실제 Chromium에서 broken.json 응답을 보류하자 picker가 먼저 닫히고 기존 알림 단언이
실패하는 것을 재현했다. 회귀는 보류 중 문서/선택/history 보존과 알림 부재를 확인하고,
응답 해제 전에 해당 파일의 **검증 실패 alert**를 구독해 최대 10초 기다린다. 이후에도 기존
문서 보존과 알림 단언을 그대로 검사한다. 잘못된 오류나 알림 누락은 통과시키지 않는다.
고정 sleep·자동 재시도·skip·제품 코드 변경은 추가하지 않았다. 기존 120초 여정 상한도 유지한다.
