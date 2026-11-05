# 14. 처음부터 따라 하기

로그인 예제를 GUI로 편집하고, 외부 에이전트로 자연어 수정·React 코드 생성을 수행한 뒤 기존 앱에 넣는 절차다.
실제 실행한 범위와 결과는 [15. 전체 흐름 검증](15-workflow-qa.md)에 따로 기록한다. 이 가이드 자체가 외부 AI 인증이나 생성 성공을 보증하는 기록은 아니다.

생성 계획에 참조 위젯 티켓이 포함된 프로젝트는 티켓 요청 `protocol:5`를 사용한다. 설치 스킬을
`visual-spec skills`로 갱신한 뒤 `visual-spec-ticket-response/PROJECT_V5.md` 절차로
응답한다. 참조 위젯은 한 번 생성되어 여러 화면에서 가져오고 ZIP에 포함되며,
참조하지 않는 위젯은 생성하지 않는다. 자연어의 화면 로컬 구조·속성 편집은 요청·스킬 계약상
활성 화면의 지정 범위를 대상으로 하지만, 공용 색·글자 스타일 수정·삭제는 프로젝트 전체의 해당 스타일 참조에
영향을 준다. 참조 위젯 원본은 읽기 전용 `widgets` 문맥으로 확인한다. 선택 프레임을 새 위젯으로
추출하고 다른 일반 페이지에도 배치하는 `projectCommand: extractAndPlaceWidget`은 별도의
제한된 구조 변경 경로다. 임의의 전체 프로젝트 편집을 허용하는 것은 아니다. 실제 AI 수용 여부는
[#265 수용 조건 표](265-acceptance-status.md)를 확인한다.

## 1. 저장소 준비

Node **`^20.19.0 || >=22.12.0`**, Git, **pnpm 10.33.0**이 필요하다. 패키지는 `private: true`라 레지스트리에 공개하지 않지만, 로컬 tarball 설치를 지원한다.
아래는 Bash 기준이다. 저장소를 처음 받는 터미널에서 실행한다.

```bash
git clone --branch develop https://github.com/visual-spec-labs/Visual-Spec-Builder.git
cd Visual-Spec-Builder
corepack pnpm install --frozen-lockfile
VSB_REPO="$(pwd)"
```

Windows PowerShell에서는 같은 절차를 다음처럼 실행한다.

```powershell
git clone --branch develop https://github.com/visual-spec-labs/Visual-Spec-Builder.git
Set-Location Visual-Spec-Builder
corepack pnpm install --frozen-lockfile
$env:VSB_REPO = (Get-Location).Path
```

Corepack이 없는 환경에서는 pnpm 10.33.0을 준비하고 `corepack pnpm` 대신 `pnpm`을 사용한다.
기존 체크아웃을 쓴다면 변경 사항을 보존한 채 사용할 브랜치와 커밋을 먼저 확인한다. 아래 기능이 아직 기본 브랜치에 병합되지 않았다면 해당 기능을 포함한 검토 브랜치가 필요하다.

### 기존 Windows 체크아웃의 줄바꿈 (#262)

`.gitattributes`를 받기 전에 `core.autocrlf=true`로 클론했다면, 브랜치를 갱신해도 기존 파일이 CRLF로 남을 수 있다.
이때 `git status`는 깨끗해도 스킬 문서 비교 테스트가 실패할 수 있다. `git ls-files --eol skills`의
`w/crlf`는 작업 트리에 CRLF가 남았다는 뜻이다. 수정이 포함된 커밋을 새로 체크아웃하면 `w/lf`가 된다.

가장 간단한 방법은 **기존 폴더를 보존하고 다른 이름의 새 폴더에 클론**한 뒤 위 설치 절차를 따르는 것이다.
기존 폴더의 미커밋 변경·미추적 파일·Git 무시 파일(사용자 작업공간의 `.visual-spec/` 포함)은 새 클론으로
자동 이동하지 않는다. 필요한 작업을 별도로 백업하고 새 환경에서 확인할 때까지 기존 폴더를 지우지 않는다.

네트워크에서 다시 클론하는 대신, 수정이 포함된 커밋을 이미 받은 기존 저장소에서 다음처럼 **별도 작업 트리로
재체크아웃**할 수도 있다. `HEAD`에 `.gitattributes`가 포함되어 있는지 먼저 확인한다. 대상 폴더는 새 경로여야 한다.

```bash
git worktree add --detach ../Visual-Spec-Builder-lf HEAD
cd ../Visual-Spec-Builder-lf
git ls-files --eol skills
corepack pnpm install --frozen-lockfile
VSB_REPO="$(pwd)"
```

기존 작업 트리와 인덱스는 그대로 보존되며, 미커밋 작업은 새 작업 트리에 복사되지 않는다.
새 작업 트리는 확인용 detached HEAD이므로 여기서 새 작업을 커밋하려면 먼저 `git switch -c <새-브랜치>`로 브랜치를 만든다.
기존 폴더에 `reset --hard`를 실행하거나 파일을 일괄 삭제할 필요는 없다.
별도 사용자 작업공간의 스킬 사본도 CRLF로 남았다면 로컬 수정부터 백업한다. 새 도구 경로의
`visual-spec skills`를 명시적으로 실행하면 사본을 원본 LF로 갱신하지만, 로컬 수정도 덮어쓴다.

## 2. 별도 작업공간에서 GUI 실행

동일한 터미널에서, 예제용 빈 폴더를 만들고 실행한다. 도구 저장소와 사용자 작업공간을 분리하면 원본 예제를 그대로 유지할 수 있다.

```bash
mkdir ../visual-spec-demo
cd ../visual-spec-demo
node "$VSB_REPO/bin/visual-spec.mjs" init
node "$VSB_REPO/bin/visual-spec.mjs" skills
cp "$VSB_REPO/examples/login-screen.json" .visual-spec/specs/login-screen.json
node "$VSB_REPO/bin/visual-spec.mjs"
```

PowerShell에서는 별도 작업 폴더를 만들고 다음처럼 실행한다.

```powershell
New-Item -ItemType Directory -Force ..\visual-spec-demo | Out-Null
Set-Location ..\visual-spec-demo
node "$env:VSB_REPO\bin\visual-spec.mjs" init
node "$env:VSB_REPO\bin\visual-spec.mjs" skills
Copy-Item "$env:VSB_REPO\examples\login-screen.json" .visual-spec\specs\login-screen.json
node "$env:VSB_REPO\bin\visual-spec.mjs"
```

**마지막 명령은 인자가 없다.** `visual-spec gui`라는 명령은 없다. 터미널에 표시된 localhost 주소를 열고 서버 프로세스는 유지한다.
CLI는 도구 저장소의 Vite 서버를 띄우고, 실행한 폴더의 `.visual-spec/`을 작업공간으로 연결한다.
이때 React는 production 빌드로 돈다(#314 — 큰 문서의 편집이 개발 모드보다 훨씬 빠르다). React 경고를 보며 디버깅하려면 `VISUAL_SPEC_REACT_DEV=1`을 붙여 실행한다.
다른 터미널에서는 `VSB_REPO`를 저장소의 절대 경로로 다시 지정한다.

| 경로 | 쓰임 |
|---|---|
| `.visual-spec/specs/` | 저장한 화면·프로젝트 JSON |
| `.visual-spec/assets/` | 가져온 이미지 |
| `.visual-spec/staging/<requestId>/` | 에이전트가 현재 요청의 `outputPath`에 쓰는 임시 코드. 아직 수락·Export된 결과가 아니다 |
| `.visual-spec/generated/` | GUI가 검증·수락한 코드. 프로젝트·페이지마다 `<프로젝트 폴더>/<pageId>/` 아래에 `pages/`·`components/`가 있다(#281) |
| `.visual-spec/runtime/` | 자연어·티켓 요청과 응답 JSON |
| `.claude/skills/` | `skills` 명령이 복사한 에이전트 지침 — Claude Code가 읽는 위치 |
| `.agents/skills/` | 같은 지침 사본 — Codex가 읽는 위치 |
| `.../skills/visual-spec/contract/` | 설치한 버전의 스키마·문서·예제 사본과 검증 명령 안내(로컬 계약) |
| `.../contract/LOCAL.md` | 이 기기의 CLI 경로. `skills`를 실행한 기기 기준이라 기기마다 다르며, 스킬 폴더를 커밋해도 구버전 경고 대상이 아니다 |

`skills`는 사용자가 어느 에이전트를 쓸지 모르므로 기본으로 두 위치에 모두 설치한다.
한 곳만 원하면 `skills --agent claude` 또는 `--agent codex`를 쓴다. 그 밖의 에이전트에는
설치된 `SKILL.md` 경로를 대화에서 직접 알려 준다. 스킬은 GitHub이 아니라 함께 설치된 로컬 계약을
읽으므로 네트워크 없이 설치본과 같은 버전으로 동작한다.

스펙 파일은 앱이 열 때와 같은 검증기로 직접 검사할 수 있다.

```bash
node "$VSB_REPO/bin/visual-spec.mjs" validate .visual-spec/specs/login-screen.json
```

`skills`를 다시 실행하면 도구 저장소의 스킬로 기존 사본을 즉시 갱신한다. 로컬 수정도
덮어쓰며, 같은 내용은 건너뛴다. 현재 패키지가 관리하는 스킬 안에서 더 이상 배포하지
않는 파일도 제거한다. 다른 스킬 디렉터리는 보존하며 링크·읽기 실패가 있으면 갱신을 중단한다. GUI 시작 시 설치 사본의 내용 차이·누락을 경고하고
`visual-spec skills` 갱신 명령을 안내하지만 사본을 자동 수정하지 않는다. 내용 차이만으로
구버전이라고 단정하지 않으며, 링크나 읽기 실패는 비교 불가로 따로 안내한다.
GUI가 Claude Code나 Codex를 자동 실행하지는 않는다. 사용할 에이전트의 인증과 실행은 별도로 준비한다.
스킬을 자동으로 찾지 못하는 환경이면 아래 예시처럼 스킬 파일 경로를 직접 지정한다.

### 에이전트를 수동으로 시작하기

[#219의 수동 실행 정책](02-mvp-scope.md#에이전트-실행-정책-219-2026-10-04)에 따라,
GUI 서버를 켜 둔 채 **새 터미널**에서 아래를 실행한다. `cd`에는 2절에서 만든
`visual-spec-demo` 폴더의 실제 절대 경로를 넣는다. 설치와 인증이 끝난 에이전트 하나를 고른다.

Codex 인증은 **에이전트를 실행할 환경에서** 준비한다. PC의 로그인은 별도 클라우드에
자동 전달되지 않는다. `codex login status`로 상태를 확인하고 필요하면 `codex login`을
실행한다. 브라우저를 직접 열 수 없으면 `codex login --device-auth`가 보여주는 URL과
일회용 코드로 인증한다. 로그인 표시와 실제 모델 요청 성공은 별도로 확인한다.

```bash
cd /absolute/path/to/visual-spec-demo
codex
```

Claude Code를 사용한다면 같은 폴더에서 `codex` 대신 `claude`를 실행한다. 이 명령은
사용자가 직접 입력한다. 명령을 찾을 수 없거나 인증·환경 초기화가 실패하면 해당 CLI를
준비한 뒤 다시 실행한다. GUI에 요청 파일이 생겼다는 사실만으로 AI 실행 성공은 아니다.
에이전트가 준비되면 아래 4절 또는 5절의 요청문을 복사해 현재 요청을 처리하게 한다.
작업공간의 `.agents/skills/visual-spec/contract/` 또는
`.claude/skills/visual-spec/contract/`에는 설치 버전의 스키마·계약 문서·예제도 함께 있다.
에이전트는 이 로컬 계약과 `contract/LOCAL.md`의 이 기기용 CLI 명령을 먼저 읽는다.
계약이나 CLI 경로가 없거나 맞지 않으면 도구의 실제 위치를 확인하고 `skills`를 다시 실행한다.
설치본과 다른 GitHub 최신 문서를 대신 읽거나 저장소 경로를 추측하지 않는다.
검증할 수 없는 화면을 추측하거나 완료 응답을 수동으로 성공 처리하지 않는다.

### Windows PowerShell에서 비대화 실행

GUI 서버와 별도 터미널에서 같은 작업공간으로 이동한다. 아래는 **자연어 요청 하나**의 예다.
티켓은 경로를 `visual-spec-ticket-response/SKILL.md`·`ticket-request.json`으로 바꾸고 5절 요청문을 사용한다.
두 CLI 중 설치·인증한 하나만 실행한다. 한 요청에 둘을 동시에 실행하지 않는다.

```powershell
Set-Location C:\work\visual-spec-demo
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$prompt = '.agents/skills/visual-spec-nl-response/SKILL.md를 읽고 현재 .visual-spec/runtime/nl-request.json에 응답해 줘. JSON은 UTF-8로 읽고 쓰고 요청 ID와 범위를 지켜 줘.'
# Codex는 Git 작업공간을 사용한다. 2절의 새 빈 폴더라면 먼저 초기화한다.
git init
$prompt | codex exec --sandbox workspace-write -
# Claude Code를 선택했다면 위 codex 명령 대신:
# $prompt = $prompt.Replace('.agents/skills/', '.claude/skills/')
# claude -p $prompt
```

CLI의 파일 쓰기 권한 요청은 사용 중인 CLI 정책에 따라 처리한다. 권한·인증 실패나 비정상 종료는
성공 응답이 아니다. PowerShell 5.1의 기본 리디렉션 인코딩에 기대지 말고, 프롬프트/JSON 파일은
UTF-8로 저장한다. 직접 파일을 만들 때는 `[IO.File]::WriteAllText($path, $text, $utf8)`처럼
인코딩을 명시하고, 외부 에이전트에도 UTF-8 입출력을 지시한다. 이미 `???`로 손상된 내용은
인코딩 설정만으로 복구되지 않는다. 적용 결과를 Undo하고 새 GUI 요청으로 다시 처리한다.
이미 수용된 요청 ID의 응답 파일만 고쳐도 재적용되지 않는다.

## 3. 로그인 예제 편집·저장

### 빈 캔버스에서 시작하기

프로젝트 목록이 비어 있는 홈 화면에서 **빈 캔버스에서 시작**을 선택한다. 에디터가 빈 페이지를 연다. 왼쪽 레이어 트리에서 노드를 추가하고 캔버스나 속성 패널에서 편집한 뒤 **파일 → 저장** 또는 **파일 → 다른 이름으로 저장**으로 보관한다.

처음 **파일 → 저장**을 하면 프로젝트 이름을 묻는다. 입력한 프로젝트 이름에서 `.json` 파일명을 만들고 해당 프로젝트를 저장한다. 에디터 상단 가운데의 프로젝트 이름 옆 연필 버튼으로도 프로젝트 이름을 바꿀 수 있다. **파일 → 다른 이름으로 저장**은 프로젝트 이름 변경과 별개로 저장할 파일명을 정하고 저장 대상을 바꾼다. 이 경로는 자연어 초안 없이 직접 화면을 만드는 방법이다.

### 홈에서 자연어 초안 만들기

프로젝트 목록이 비어 있는 홈 화면에서 **자연어로 초안 만들기**를 고른다. 입력칸에 만들 화면을 설명하거나 예시를 고른 뒤 **초안 만들기**를 누르면 빈 프로젝트가 에디터에서 열린다.
문구는 하단 자연어 입력칸에 채워지지만 자동 전송되지는 않는다. 에이전트를 준비하고 입력 범위를 확인한 뒤 **요청**을 눌러 전송한다. 이 타일은 프로젝트 목록이 비어 있을 때만 표시된다.

1. 홈에서 Login 카드를 열거나, 에디터의 **파일 → 열기**(File → Open)에서 `login-screen.json`을 선택한다. **스펙 열기** 목록에서 파일 항목을 클릭한다. 작업공간을 사용할 수 없거나 목록이 비어 있으면 브라우저의 JSON 파일 선택창이 열린다.
2. 왼쪽 레이어 트리에서 `Card`를 펼쳐 **LoginButton**을 선택한다. 이 예제에는 이메일·비밀번호 입력 노드와 실제 `button` 노드가 있다.
3. 오른쪽 버튼 속성 **Content**의 **텍스트**를 `계속하기`로 바꾸고 입력칸 밖을 클릭한다. 캔버스 문구가 바뀌는지 확인한다. GUI의 input·button은 시각 편집 대상이며 실제 로그인 기능은 포함하지 않는다.
4. **파일 → 저장**을 실행한다. 저장 알림과 메뉴바 파일명을 확인한다. `.visual-spec/specs/login-screen.json`에 저장되며 저장소의 `examples/login-screen.json`은 바뀌지 않는다.
5. 새로고침하거나 다시 열기로 연 뒤 문구를 확인한다. 최초 단일 화면 예제는 로드 시 프로젝트 상태로 확장되고, 저장 결과는 0.4 `ProjectSpec`(`pages`·`pageOrder`)이다.

**파일 → 다른 이름으로 저장**은 새 이름으로 저장하고 그 파일을 다음 저장 대상으로 삼는다. **파일 → JSON 내보내기**와 속성 패널 아래의 **JSON 내보내기** 버튼은 스펙 JSON 다운로드다. React 코드는 뒤의 **코드 내보내기**를 사용한다.
localStorage 자동 복원과 명시적인 저장은 별개다. 다른 탭 변경을 감지하면 자동저장과
파일 저장을 중지하고 내 초안을 보존한다(#258). 충돌 안내에서 내 작업을 별도 JSON으로
보관하거나 확인 후 최신 내용을 불러온다. localhost/127.0.0.1의 오래된 Save도 서버가
읽은 디스크 리비전으로 거부한다. 자세한 한계는 [저장 충돌](qa/tab-save-conflicts.md)을 따른다.

### 재사용 위젯 추출·배치

1. 기본 반응형 상태에서 root가 아닌 프레임을 선택하고 컨텍스트 메뉴의 **위젯으로 만들기** 또는 속성 패널의 **위젯으로 추출**을 누른다.
   위젯 추출은 새 widget 화면을 만들고 원래 위치를 instance로 바꾼다.
2. 배치할 다른 page를 선택하고 부모 프레임을 선택한 뒤 레이어 패널 아래 **위젯 배치**에서 위젯을 고른다.
   삽입 메뉴의 `위젯: 이름`도 사용할 수 있다.
3. 새 추출 위젯은 원본의 Fixed/Fill/Hug 크기 모드를 유지한다. 이전 버전에서 추출해 크기 메타데이터가
   없는 위젯은 기존 고정 크기로 배치되므로 인스턴스 크기를 확인한다. 원본 변경은 공유 인스턴스에 반영된다.
4. 인스턴스 컨텍스트 메뉴의 **원본 위젯으로 이동**으로 원본을 편집하거나 **인스턴스 분리**로 독립 요소로 만든다.
   저장 후 프로젝트 티켓으로 생성한다. 아래 프로젝트 Export 경로를 사용한다.

## 4. 자연어로 간격 수정

`Card`를 선택하고 하단 자연어 입력창의 적용 범위가 선택 요소인지 확인한다. 화면 로컬 구조·속성 편집의 요청·응답 스킬은 선택한 요소와 그 안쪽을 대상으로 작성하도록 지시한다. 예를 들어 Button을 선택한 상태에서 그 아래에 형제 요소를 추가하려면 Button의 부모인 **Card**를 선택하거나 범위를 **현재 화면**으로 바꿔야 한다. 입력창은 보내기 전에 선택한 범위에서 가능한 동작을 안내한다. `간격을 24로 바꿔줘`를 보내면 GUI는 `.visual-spec/runtime/nl-request.json`을 쓰고 응답을 기다린다.

선택 범위는 에이전트에 전달하는 요청·스킬 계약이다. 일반 Command 검증이 선택한 하위
트리에만 쓰도록 별도 차단하는 것은 아니므로 적용 결과를 확인하고, 의도와 다르면 Undo한다.

**공용 스타일을 바꾸는 요청은 영향 범위가 다르다.** 예를 들어 공용 색 스타일을 수정하면
다른 페이지에서 그 스타일에 연결된 노드도 함께 바뀐다. 공용 스타일을 삭제하면 프로젝트 전체의
해당 연결을 해제하되 각 노드의 현재 값은 남긴다. 공용 스타일을 대상 노드에 적용하는 명령은
현재 요청 페이지를 대상으로 한다. 한 요소만 다르게 만들고 싶으면 공용 스타일 원본 수정 대신
그 노드 값의 직접 수정을 요청한다. 직접 수정은 해당 값의 연결을 해제하고 공용 원본은 유지한다.
자세한 명령 구분은 [자연어 계약](08-natural-language.md)을 따른다.

**별도 터미널에서 같은 `visual-spec-demo` 폴더를 작업 디렉터리로 삼아 외부 에이전트를 실행**하고 다음처럼 요청한다.

> `.claude/skills/visual-spec-nl-response/SKILL.md`를 읽고 현재 `.visual-spec/runtime/nl-request.json`에 응답해 줘. 요청의 ID·범위를 지키고, 문서 파일을 직접 수정하지 말고 해당 스킬의 Command 응답 형식으로 작성해 줘.

GUI는 요청 ID가 맞는 응답을 읽어 명령 형태·시험 적용·결과 문서를 검증한 뒤 적용한다. 응답이 기존 배경을
지우거나 다른 종류로 바꾸면 적용 전에 입력창 아래에서 한 번 더 묻는다 — 예를 들어 `LoginButton 배경: 단색
#2563EB → 선형 그라디언트 90° (#4F46E5 0%, #1E40AF 100%)`처럼 바뀌는 값을 보여 주고 **변경 적용** 또는 **적용 취소**를
고른다. 단색을 다른 단색으로 바꾸는 요청("버튼 색을 진한 파란색으로")은 묻지 않고 바로 적용한다. 성공하면 Card의 gap이 24인지 확인한다. Undo 한 번으로 요청 전체를 되돌리고, 필요하면 Redo로 복구한 뒤 **Save**한다.

다른 탭이나 창에서 보낸 요청이 아직 응답을 기다리는 중이면 새 요청은 쓰이지 않고 그 사실을 안내한다 — 먼저 보낸 요청이 끝나거나 그 탭에서 취소한 뒤 다시 보낸다(티켓 실행도 같다). 자연어 응답 대기 중에는 입력칸 옆 **취소**를 누를 수 있다. 상태 안내가 남고 화면은 바뀌지 않으며, 이미 지시를 받은 외부 에이전트는 계속 실행될 수 있다. 늦게 도착한 응답은 반영되지 않는다. 시간 초과나 오류가 나면 입력창의 설명과 현재 요청·응답 ID를 확인한다. 에이전트가 실행 중인지, 같은 작업공간을 보고 있는지, 자연어 전용 스킬을 읽었는지 확인한 뒤 다시 요청한다. 스펙 파일을 직접 작성하는 `visual-spec-authoring`은 이 응답 경로와 다르다.

자연어 결과 줄의 **되돌리기**는 방금 요청의 변경을 한 단계 되돌린다. 되돌린 뒤에도 같은 페이지에 같은 노드가 남아 있으면 그 노드의 선택을 유지한다. 추가를 되돌려 노드가 없어졌거나 페이지가 바뀌었다면 선택을 복원하지 않는다. 이는 결과 줄의 되돌리기 동작이며, 일반 `Ctrl+Z` 규칙은 바꾸지 않는다.

### GUI를 열어 둔 채 에이전트 대화로 고치기

GUI 입력창을 쓰지 않고 에이전트 대화에서 바로 "제목을 크게 해줘"처럼 요청해도 된다. GUI가 열려 있으면
에이전트는 스펙 파일을 직접 고치지 않고 GUI에 편집을 보내며, 하단 자연어 입력창 바로 위 오른쪽에 "외부
에이전트가 편집을 적용했습니다"와 **되돌리기**가 뜬다. 이 알림은 입력창을 가리지 않으니 닫지 않고 다음 요청을
보내도 되고, 마우스를 올려 두거나 키보드 포커스를 알림 안에 두지 않으면 몇 초 뒤 저절로 닫힌다. 닫힌 뒤에도 Undo 한 번으로 되돌릴 수 있다.
적용 결과는 Undo 한 단계이고, 저장은 GUI에서 **Save**로 한다.
그 사이 GUI에서 직접 편집했다면 에이전트 요청은 적용되지 않고 다시 요청하라고 안내된다 — 에이전트가 새
상태를 읽고 다시 보낸다. 같은 작업공간을 여러 탭으로 열면 그중 한 탭만 에이전트와 연결된다.

열어 둔 파일을 에이전트나 다른 도구가 디스크에서 직접 고쳐도 GUI가 몇 초 안에 알아챈다. 화면에서
편집한 것이 없으면 바뀐 내용을 불러오고 **되돌리기**를 보여 주며, 저장하지 않은 편집이 있으면 디스크
내용을 불러올지, 지금 편집을 유지할지 묻는다.

## 5. 구현 티켓으로 코드 생성

메뉴바의 **구현 티켓**을 열면 티켓과 의존성을 볼 수 있다. 일반 화면은 현재 활성 페이지를, modal/widget·instance·버튼 action이 있는 프로젝트는 프로젝트 생성 범위를 사용한다. **에이전트에 전달**은 지금 준비된 티켓 묶음을 `.visual-spec/runtime/ticket-request.json`에 기록한다.
외부 에이전트에 다음처럼 요청한다.

> `.claude/skills/visual-spec-ticket-response/SKILL.md`와 그 스킬이 참조하는 `visual-spec-to-react` 지침을 읽고, 현재 `.visual-spec/runtime/ticket-request.json`의 한 웨이브를 처리해 줘. 요청된 파일을 실제로 생성·확인한 뒤 결과 응답을 써 줘. 수행한 검증과 미실행 검증을 구분해 줘.

에이전트가 실제로 쓰는 곳은 요청의 **`outputPath`(`.visual-spec/` 기준 상대 경로)**다.
예를 들어 `staging/<requestId>/<프로젝트 폴더>/<pageId>/pages/Login.tsx`라면 작업공간의
`.visual-spec/staging/<requestId>/…`에 쓴다. `filePath`는 수락 뒤의
**`.visual-spec/generated/` 기준 상대 경로**이며, 에이전트가 그 최종 위치를 직접 덮어쓰지 않는다.
GUI가 현재 요청·입력·출력과 소유권을 검증한 뒤 staging 결과를 generated로 확정한다.
응답은 요청에 맞는 `protocol`, `requestId`, 티켓별 `results`이며 Ticket 객체나 Command 배열이 아니다.
직접 ID나 성공 응답을 복사해 넣는 대신 현재 요청을 처리하게 한다.

화면 관계가 없는 활성 화면 요청은 `protocol:3`, 프로젝트 계획은 `protocol:4`,
그 계획에 참조 위젯 생성 티켓이 있으면 `protocol:5`다. 버전과 경로를 직접 고르지 말고
현재 요청과 설치한 응답 스킬의 해당 분기를 따른다.

GUI가 응답과 출력을 검증·수락하면 의존성이 풀린 **다음 웨이브를 새 ID로 요청**한다. 전체 티켓이 끝날 때까지 새 요청마다 같은 스킬로 처리하도록 외부 에이전트에 지시한다. GUI의 **에이전트에 전달**은 에이전트를 자동 호출하거나 상시 감시 작업을 설치하지 않는다. 개별 티켓의 **전달**은 그 티켓만 요청한다. 실행 중 묶음 전달 버튼은 **중지**로 바뀌며 GUI의 응답 대기를 멈춘다. 외부 에이전트 프로세스는 별도로 멈춰야 한다.

대기 창은 새 활동이 없으면 **3분**이다. 최신 응답 스킬은 초안·검증·typecheck 중에도 요청별 진행 신호를
60초 이내 간격으로 기록하며 GUI가 자동 연장한다. **대기 연장**으로 수동 연장할 수도 있지만,
요청 저장부터 수동/자동 연장을 합쳐 **최대 30분**이다. 저장소 갱신 후 작업공간에서 `visual-spec skills`를
다시 실행해 스킬 사본도 갱신한다(로컬 수정은 먼저 보관). 실행 중 패널을 닫고 다시 열어도 웨이브는 유지된다.
만료된 요청은 되살리지 말고 새 요청으로 재시도한다. 실제 외부 모델 3분 초과 자동 수용 검증은
[#472](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/472)에 남아 있으며 fixture 통과와 구분한다.

실패가 있으면 해당 티켓의 원인을 확인한다. 실패한 티켓에 의존하는 후행 티켓은 진행되지 않는다. 중지는 GUI 대기를 멈추므로 외부 에이전트에도 중지를 알려야 한다. 스펙을 바꿨다면 변경된 페이지로 티켓을 다시 컴파일하고 필요한 코드를 다시 생성한다.

## 6. 코드 내보내기와 기존 React 앱 통합

**파일 → 코드 내보내기**에서 파일·참조·티켓 검사를 확인한다. 파일이 없거나 오래됐으면 생성 후
**다시 검사**한다. 티켓 `done`이나 Export 검사는 TypeScript 컴파일·실제 화면 일치를 보장하지 않는다.

### 단일 화면 Export

modal/widget·instance·버튼 action이 없는 프로젝트는 현재 활성 화면을 내보낸다.
**결과 폴더 ZIP 내려받기**를 누르면 최상위 폴더 아래 `pages/`·`components/`·참조 이미지용 `assets/`,
`package.json`·`README.md`가 있다. 여러 page가 있어도 관계 기능이 없으면 이 경로다.
폴더 내용을 대상 React + TypeScript 앱의 `src/visual-spec/`로 복사하고 상대 위치를 유지한다.
실제 페이지 파일명에 맞춰 연결한다.

```tsx
import Login from "./visual-spec/pages/Login";
export default function App() { return <Login />; }
```

### 프로젝트 Export

modal/widget·instance·버튼 action이 있으면 프로젝트 패널의 **프로젝트 ZIP 다운로드**를 사용한다.
현재 프로젝트 전체의 출력·입력 지문·파일 참조가 맞아야 내보낼 수 있다. ZIP 구조는 다음과 같다.

```text
<폴더명>/
  <pageId>/pages/…tsx
  <pageId>/components/…tsx
  <widgetPageId>/components/…tsx
  runtime/Entry.tsx
  runtime/Host.tsx
  runtime/Routes.ts
  assets/…
  package.json
  README.md
```

실제로 사용되는 파일만 포함되며 참조되지 않은 widget은 제외된다. `<pageId>`·`runtime`·`assets`의
상대 위치를 유지해 `src/visual-spec/`에 복사한다. 프로젝트 진입점은 다음처럼 연결한다.

```tsx
import ProjectEntry from "./visual-spec/runtime/Entry";
export default function App() { return <ProjectEntry />; }
```

Host가 버튼 action에 따른 페이지 이동·모달을 관리한다. URL/history 라우터는 포함하지 않는다.
두 Export 모두 최상위 폴더명은 프로젝트 이름을 파일명에 맞게 정리한 값이며, 한글만 있는 이름처럼
정리 후 비면 **visual-spec-export**가 된다. 프로젝트 표시 이름과 폴더명이 같다고 가정하지 않는다.

### 공통 통합·검증

대상 앱의 `package.json`을 덮어쓰지 말고 내보낸 의존성 목록을 대조해 필요한 패키지만 추가한다.
스타일은 생성 결과에 따라 정적 CSS 또는 Tailwind 유틸리티다. `<style>`·media query를 포함한
정적 CSS는 유지한다. Tailwind 결과는 대상 앱에 해당 버전을 설정한다. Vite + Tailwind v4라면
React 플러그인·`@tailwindcss/vite`와 앱 CSS의 `@import "tailwindcss";`를 확인하고 생성 폴더가
클래스 검색 대상인지 확인한다. 이미 설정된 앱에는 중복 설정하지 않는다.

이미지는 단일 화면 결과의 정적 import 또는 프로젝트 결과의 모듈 상대 `new URL(..., import.meta.url)`을
번들러가 처리한다. 폴더 위치를 유지하고 개발 서버와 production build 모두에서 이미지를 확인한다.
의미 있는 이미지의 비어 있는 `alt`는 앱 통합 시 채운다.

대상 앱의 실제 타입 검사·빌드 스크립트를 실행한다. Vite React/TypeScript 기본 strict 설정의
`noUnusedLocals`·`noUnusedParameters`도 켜 둔다. 생성 코드의 미사용 콜백 구조 분해는 제거하고,
타입 오류를 옵션을 꺼서 숨기지 않는다.

```bash
pnpm exec tsc -b
pnpm run build
pnpm run dev
```

브라우저에서 문구·간격·이미지·화면 이동·모달과 모바일 폭을 확인한다. 스펙에 지정한
button/input의 hover·pressed·focus 색은 생성 결과에 포함될 수 있으므로 실제 동작을 확인한다.
앱 셸·URL 라우터·폼 상태/검증/제출·데이터 불러오기·인증·백엔드·disabled 상태·배포 설정은
사용자 앱에서 통합한다. 기존 앱에 자동 병합하거나 배포하지 않는다.

## 7. 반응형 분기점과 데스크톱부터 디자인하는 경로 (#438)

반응형 패널(우측 속성 패널의 **반응형 · 분기점(breakpoint)**)의 분기점은 min-width 방식이다.
어떤 분기점의 재정의는 **그 최소 폭 이상인 모든 폭에 누적 적용**되며, 더 작은 폭에만 한정해
덮어쓰는 "최대 폭" 방식은 지원하지 않는다([12. 반응형 IR 설계](12-responsive-ir-design.md)).
기본값(base)은 모든 폭의 기반이고, 분기점은 그보다 **큰** 폭에서 바뀌는 부분만 덧붙인다.

페이지를 1440×900 같은 데스크톱 크기로 만들고 처음부터 그 크기만 편집해 왔다면, **기본값에
이미 데스크톱 디자인이 들어 있다.** 이 상태에서 `mobile ≥390`처럼 작은 분기점을 추가하고
그 분기점에서 값을 고치면, 그 값은 390px 이상의 모든 폭 — 1440px 데스크톱 화면도 포함해서 —
영향을 줄 수 있다(더 큰 분기점에 같은 속성의 재정의가 이미 있으면 그 값이 우선한다). 패널은
분기점을 고르면 이 사실을 바로 보여 준다.

**데스크톱부터 디자인했다면 다음 순서를 따른다. 기본값을 모바일로 바꾸기 전에 데스크톱
값을 먼저 분기점에 고정해야 한다 — 순서를 바꾸면 고정 시점에 이미 기본값이 모바일로
바뀌어 있어 데스크톱 디자인이 사라진다.**

1. **먼저 더 작은 분기점(예: `mobile ≥390`)에 같은 속성을 이미 재정의했는지 확인한다.**
   재정의가 있다면 그 상태로 **현재 표현값 고정**을 누르면 안 된다 — `resolveResponsiveScreen`은
   작은 분기점의 재정의를 먼저 누적 적용하므로, 아직 desktop 분기점에 재정의가 없는 지금
   "보이는 값"은 이미 mobile 값으로 섞여 있다(예: base `gap:32`를 mobile에서 `8`로 바꿔 둔
   상태라면, desktop을 선택했을 때 보이는 값도 32가 아니라 8이다). 이때는 먼저 그 노드를
   고르고 mobile 분기점에서 해당 속성의 **상속** 버튼(또는 **노드 재정의 삭제**)으로 재정의를
   잠시 되돌려 원래 데스크톱 값을 확인하거나, 이미 알고 있는 원래 값을 적어 둔다.
2. 기본값이 아직 데스크톱 디자인인 상태에서(1단계에서 작은 분기점 재정의를 되돌렸다면 지금이
   그 상태다) **데스크톱 폭 이상의 새 분기점**(예: `desktop · ≥1024px`)을 추가하고, 그 분기점을
   편집 기준으로 선택한다. 데스크톱에서 달라져야 하는 노드마다 선택한 뒤 **현재 표현값 고정**을
   누른다 — 지금 보이는 값을 그대로 그 분기점의 재정의로 저장해, 다음 단계에서 기본값을 바꿔도
   이 값은 그대로 남는다. 1단계에서 원래 값을 직접 적어 두기로 했다면 고정 대신 그 값을 새
   분기점의 속성에 직접 입력해도 된다.
3. 1단계에서 작은 분기점의 재정의를 되돌렸다면, 데스크톱 값을 고정한 뒤 그 재정의를 다시
   추가한다(되돌리기 전의 값으로). 되돌리지 않고 원래 값을 직접 입력한 경우에는 이 단계가
   필요 없다.
4. 필요한 노드를 모두 고정했으면 패널에서 **기본값 (base)**을 선택하고
   **가장 작은 폭(모바일) 디자인으로 바꾼다.** 페이지 크기(`size.width`)와 별도의
   **미리보기 폭**을 구분한다. 별도 미리보기 폭을 아직 정하지 않았다면 `screen.size.width`가
   사용되며, 그 폭 이하의 분기점이 누적 적용된다. **기본값 (base)**을 선택하면 첫 분기점보다
   작은 미리보기 폭으로 전환해 기본값을 편집할 수 있다. 페이지를 1440×900으로 유지할 수는
   있지만, 그 크기만 보고 base가 선택됐다고 가정하지 말고 패널의 편집 기준과 미리보기 폭을
   확인한다. 2단계에서 고정한 재정의는 desktop 분기점에서 그대로 적용된다.
5. 더 작은 중간 폭(태블릿 등)이 필요하면 기본값을 모바일로 바꾼 뒤에 그 폭의 분기점을
   추가한다. 분기점은 숫자 폭 순서로 적용되므로 ID 이름과 추가한 순서는 적용 순서에
   영향을 주지 않는다.

미리보기 폭은 페이지별 뷰 상태이며 문서나 Undo에 저장하지 않는다. 반응형 적용 순서는
분기점 ID나 추가 순서가 아니라 현재 미리보기 폭과 각 `minWidthPx`로 정해진다.

반대로 처음부터 모바일 폭으로 기본값을 설계하고 넓은 화면에서 달라지는 부분만 분기점에
적는 것이 이 모델이 가정하는 기본 흐름이며, 이렇게 하면 위 변환 과정 없이 분기점을 그대로 추가할 수 있다.

## 참고

- [전체 흐름 검증 기록](15-workflow-qa.md): 수행한 경로·기준 커밋·성공/실패·남은 한계
- [구현 현황](07-implementation-status.md), [자연어 계약](08-natural-language.md), [단축키](10-shortcuts.md)
- [반응형 IR 설계](12-responsive-ir-design.md)
- [티켓 응답 스킬](../skills/visual-spec-ticket-response/SKILL.md), [자연어 응답 스킬](../skills/visual-spec-nl-response/SKILL.md)
