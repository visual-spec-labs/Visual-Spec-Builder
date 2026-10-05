# 15. 로그인 전체 흐름 검증 기록

검증일: **2026-10-04**. 관련 이슈: #217·#218·#220·#221·#228·#230·#231·#233.

**실제 GUI 편집·저장은 통과했지만, 외부 Codex가 환경 초기화 단계에서 실패하여 실제 AI를 포함한 전체 흐름은 완료하지 못했다.** 아래 수동 fixture 검증은 파일 교환·Export·대상 앱 통합을 따로 확인하며 AI 생성 성공을 의미하지 않는다. #217의 실제 에이전트 완료 판정과 #220은 열린 검증 항목으로 남긴다.

## 검증 기준

- 원격 `develop`: `5b0af2cc0b8ec8af2438a1cfda92a402438c5e5f` (#216 포함).
- 통합 실행 코드: `bad0240c81a74d46812093dcdf700f05ab5f362f`.
- 자동 검사: 가이드까지 포함한 `1d89835`에서 실행. 이후 변경은 이 QA 기록과 구현 현황 문서뿐이다.
- 통합한 독립 Draft PR: [#237](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/237) (`45409535`), [#238](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/238) (`0b0970e9`), [#239](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/239) (`49ab9352`), [#240](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/240) (`101af37c`).
- 각 PR의 내용을 로컬 통합 브랜치에 cherry-pick했다. 원격 develop에 병합된 상태라는 뜻은 아니다. 통합 PR은 이 네 PR에 의존한다.
- 환경: Linux, Node `24.19.0`, pnpm `10.33.0`, Chromium `/usr/bin/chromium`, Python Playwright. 원격 CI는 Node 20에서 네 독립 PR 모두 통과했다.

## 자동 검사 — 통과

저장소 `/workspace/vsb-delivery`에서 실행했다. 이 환경에서는 pnpm 실행 파일 대신 `COREPACK_HOME=/tmp/vsb-corepack corepack pnpm`을 사용했다.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run lint
pnpm run build
pnpm run generate:types
git diff --exit-code
```

통합 결과: **68파일 1,239테스트 통과**, 나머지 명령 exit 0. build에는 Vite의 향후 native config loader와 확장자 없는 import 관련 경고가 있었으나 현재 빌드는 성공했다. 생성 타입 변경은 없었다.

독립 PR별 전체 테스트는 #237 68파일/1,237개, #238·#239 67파일/1,234개, #240 67파일/1,236개다. 수치를 더한 것이 아니라 통합 브랜치에서 전체를 다시 실행했다. #240은 별도 Chromium 검증으로 활성 세그먼트·균등 배치 반복의 빈 Undo 방지, 무효 hex의 불투명도 비활성 및 색상 복구, 무효 스펙 Export 알림과 정상 다운로드도 확인했다. Export 오류는 무효 상태를 주입한 조건부 재현이며 일반 GUI 입력으로 그 상태를 만드는 경로까지 입증한 것은 아니다.

## 실제 CLI·GUI — 편집·저장 통과

빈 `/tmp/vsb-e2e-project`에서 다음 명령을 실행했다. 설치 명령의 결과는 작업공간 네 폴더 생성과 스킬 일곱 종 복사였다.

```bash
node /workspace/vsb-delivery/bin/visual-spec.mjs init
node /workspace/vsb-delivery/bin/visual-spec.mjs skills
cp /workspace/vsb-delivery/examples/login-screen.json .visual-spec/specs/login-screen.json
BROWSER=none node /workspace/vsb-delivery/bin/visual-spec.mjs
```

서버는 `http://localhost:5173/`에서 시작했다. `visual-spec gui`라는 하위 명령은 사용하지 않는다. 패키지는 private이므로 공개 npm 패키지 설치 성공을 가정하지 않았다.

Chromium에서 홈의 Login을 선택한 뒤 **File → Open**에 `login-screen.json`을 입력했다. 실제 File Open 경로로 7개 노드와 입력 두 개·버튼이 표시됐다. `LoginButton`을 선택해 Content의 텍스트를 `로그인`에서 `시작하기`로 바꾸고 **File → Save**했다. 캔버스 문구와 `.visual-spec/specs/login-screen.json`의 버튼 content가 모두 바뀌었음을 확인했다. 이 경로는 스토어에 예제를 주입한 검증이 아니다.

**구현 티켓 → 전체 실행**은 첫 웨이브 `Title`·`EmailInput`을 요청했다. 실제 요청 ID는 `19b23384-2423-4dc6-a8ca-4a236b49f364`였고, `filePath`는 `components/Title.tsx`·`components/EmailInput.tsx`였다. EmailInput은 두 입력 노드 인스턴스를 공유한다.

## 실제 외부 AI — 환경 차단

`codex login status`는 ChatGPT 로그인 상태로 보고했으나 이것만으로 실행 성공을 판정하지 않았다. 새 티켓 응답 스킬과 그 매핑 지침을 읽고 현재 요청을 처리하라는 프롬프트를 표준 입력으로 전달했다.

```bash
codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral \
  -C /tmp/vsb-e2e-project --color never \
  -o /tmp/vsb-e2e-evidence/codex-final.txt -
```

결과는 **exit 1**, 모델 호출 전에 다음 오류로 종료됐다.

```text
WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)
Error: failed to initialize in-process app-server client: Read-only file system (os error 30)
```

`findmnt -T /workspace/.codex -o TARGET,FSTYPE,OPTIONS`는 해당 경로가 `tmpfs ro` 마운트임을 확인했다. 마운트 권한·인증 자료를 변경하지 않았다. Claude Code 실행 파일도 이 환경에 없었다.

실제 실행 결과는 생성 파일 0개, GUI Export 검사에서 4티켓 모두 누락·오류 4건, ZIP 다운로드 비활성 상태였다. 실제 AI 생성, 전체 티켓 완료, 그 AI 결과의 컴파일·브라우저 검증은 **미완료**다. 티켓 응답을 손으로 성공으로 바꿔 이 시도를 완료 처리하지 않았다.

## 수동 fixture 경로

이 절은 별도 작업공간에서 작성한 수동 응답의 검증 결과를 기록한다. 외부 AI의 스킬 이해·생성 품질·인증된 호출을 검증하는 것은 아니다.

작업공간 `/tmp/vsb-fixture-project`에서 같은 CLI로 init·무인자 GUI 실행을 수행하고 앞선 실제 GUI Save 결과를 복사했다. 수동 작성한 React 파일 네 개를 **해당 웨이브가 요청될 때만** generated에 쓰고, 실제 request ID를 사용한 응답을 기록했다.

| 순서 | GUI가 보낸 티켓 | 관찰 결과 |
|---|---|---|
| 1 | Title, EmailInput | 두 component 파일과 해당 ID의 응답을 수용 |
| 2 | Card | 앞선 입력 component를 참조하는 파일과 새 ID의 응답을 수용 |
| 3 | Login | Title·Card를 조합하는 page 파일과 새 ID의 응답을 수용 |
| 최종 | 네 티켓 | 모두 done, running false, error null |

File → Export Code는 **파일 4개·티켓 4개 포함·오류 0건**을 표시했다. 버튼으로 `login.zip`을 실제 다운로드했고, 압축 안에서 `login/components/{Title,EmailInput,Card}.tsx`, `login/pages/Login.tsx`, `login/package.json`, `login/README.md`를 확인했다.

별도 `/tmp/vsb-fixture-target`에 수동 구성한 최소 Vite/React/TypeScript/Tailwind 앱을 만들고 ZIP의 코드를 `src` 아래에 복사했다. `pnpm create vite` 템플릿 사용을 주장하지 않는다. 저장소 node_modules를 링크하지 않고 별도로 pnpm 설치했다. 버전은 React/React DOM 19.2.8, Vite 8.2.1, TypeScript 5.9.3, Tailwind/`@tailwindcss/vite` 4.3.3이었다.

```bash
# /tmp/vsb-fixture-target
pnpm install --store-dir /tmp/vsb-pnpm-store
pnpm run typecheck
pnpm exec tsc -b --noEmit
pnpm run build
pnpm run preview
```

타입 검사(`tsc --noEmit` 및 `tsc -b --noEmit`)와 production build는 exit 0이었다. ZIP의 TSX 네 개는 변경하지 않았으며 SHA256 일치를 확인했다. 이 대상 앱은 `include: ["src"]`가 있는 단일 tsconfig이므로 타입 검사가 실제 TSX를 포함한다. 빈 `files: []`와 references만 있는 구성에서 `tsc --noEmit`이 아무 파일도 검사하지 않는 #188의 함정과 구분한다.

빌드 결과를 preview `http://127.0.0.1:5191`에서 열어 로그인 제목·두 입력·`시작하기` 버튼과 입력 조작을 확인했다. 브라우저 런타임 오류는 없었고 버튼의 실제 CSS는 높이 44px, 배경 `rgb(79, 70, 229)`, 흰 글자였다. Pretendard 설치나 모든 픽셀의 동일성은 확인하지 않았다. 이 예제에는 이미지가 없고 실제 로그인 인증·비밀번호 마스킹은 검증 범위가 아니다.

별도 NL 수동 응답 검사에서는 실제 GUI 요청 후 현재 request ID로 `Card.layout.gap`을 24로 바꾸는 Command 응답을 썼다. gap **12 → 24**, history past 1을 확인했고, Undo **24 → 12**(past 0/future 1), Redo **12 → 24**(past 1/future 0)를 확인했다. 이 응답도 AI가 생성한 것은 아니다. NL 변경 후 코드를 다시 생성해 Export한 결과라는 뜻은 아니다.

fixture의 요청·응답·스크립트·ZIP·검사 로그·화면 캡처는 `/tmp/vsb-fixture-evidence/`에 보관했다. 파일 교환과 앱 통합 가능성은 확인했으나 새 티켓 스킬의 실제 AI 동작은 앞 절의 환경 차단으로 여전히 미검증이다.

## 남은 완료 조건

쓰기 가능한 정상 Codex 또는 Claude Code 실행 환경에서 [사용 가이드](14-getting-started.md)를 따라 새 작업공간으로 실제 시도를 재실행한다. 요청된 파일을 에이전트가 생성하고 세 웨이브의 네 티켓이 완료되는지, ZIP을 대상 React/TypeScript/Tailwind 앱에 넣어 타입 검사·빌드·브라우저 표시까지 되는지 확인해야 #217·#220의 실제 에이전트 완료 판정을 충족한다. #219의 프로세스 정책은 [수동 실행·안내 유지로 결정](02-mvp-scope.md#에이전트-실행-정책-219-2026-10-04)됐으며, 이 QA가 실제 AI 실행 성공을 입증한다는 뜻은 아니다. 다중 탭 충돌(#232) 역시 이 검증의 해결 범위가 아니다.

임시 원자료는 이 클라우드 실행 환경의 `/tmp/vsb-e2e-evidence/`에 요청 JSON·실행 로그·화면 캡처·결과 JSON으로 남겼다. 이 경로는 다른 체크아웃에서 접근할 수 있는 영구 링크가 아니므로 판단에 필요한 명령·오류·결과를 본문에도 기록했다.
