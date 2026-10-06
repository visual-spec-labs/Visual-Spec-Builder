# 14. 처음부터 따라 하기

로그인 예제를 GUI로 편집하고, 외부 에이전트로 자연어 수정·React 코드 생성을 수행한 뒤 기존 앱에 넣는 절차다.
실제 실행한 범위와 결과는 [15. 전체 흐름 검증](15-workflow-qa.md)에 따로 기록한다. 이 가이드 자체가 외부 AI 인증이나 생성 성공을 보증하는 기록은 아니다.

## 1. 저장소 준비

Node **20 이상**(CI는 20), Git, **pnpm 10.33.0**이 필요하다. 현재 패키지는 `private: true`이며 npm 배포를 전제로 하지 않는다.
아래는 Bash 기준이다. 저장소를 처음 받는 터미널에서 실행한다.

```bash
git clone --branch develop https://github.com/visual-spec-labs/Visual-Spec-Builder.git
cd Visual-Spec-Builder
corepack pnpm install --frozen-lockfile
VSB_REPO="$(pwd)"
```

Corepack이 없는 환경에서는 pnpm 10.33.0을 준비하고 `corepack pnpm` 대신 `pnpm`을 사용한다.
기존 체크아웃을 쓴다면 변경 사항을 보존한 채 사용할 브랜치와 커밋을 먼저 확인한다. 아래 기능이 아직 기본 브랜치에 병합되지 않았다면 해당 기능을 포함한 검토 브랜치가 필요하다.

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

**마지막 명령은 인자가 없다.** `visual-spec gui`라는 명령은 없다. 터미널에 표시된 localhost 주소를 열고 서버 프로세스는 유지한다.
CLI는 도구 저장소의 Vite 서버를 띄우고, 실행한 폴더의 `.visual-spec/`을 작업공간으로 연결한다.
다른 터미널에서는 `VSB_REPO`를 저장소의 절대 경로로 다시 지정한다.

| 경로 | 쓰임 |
|---|---|
| `.visual-spec/specs/` | 저장한 화면·프로젝트 JSON |
| `.visual-spec/assets/` | 가져온 이미지 |
| `.visual-spec/generated/` | 에이전트가 생성한 `pages/`·`components/` 코드 |
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
작업공간에는 설치 스킬만 있고 정본·문서는 도구 저장소에 있다. 에이전트의 네트워크 조회가
막히면 `VSB_REPO`의 실제 절대 경로를 함께 알려 정본과 계약 문서를 로컬에서 읽게 한다.
검증할 수 없는 화면을 추측하거나 완료 응답을 수동으로 성공 처리하지 않는다.

## 3. 로그인 예제 편집·저장

1. 홈에서 Login 카드를 열거나, 에디터의 **File → Open**에서 `login-screen.json`을 선택한다. 작업공간 목록 선택창에는 파일명이나 표시된 번호를 넣는다.
2. 왼쪽 레이어 트리에서 `Card`를 펼쳐 **LoginButton**을 선택한다. 이 예제에는 이메일·비밀번호 입력 노드와 실제 `button` 노드가 있다.
3. 오른쪽 버튼 속성 **Content**의 **텍스트**를 `계속하기`로 바꾸고 입력칸 밖을 클릭한다. 캔버스 문구가 바뀌는지 확인한다. GUI의 input·button은 시각 편집 대상이며 실제 로그인 기능은 포함하지 않는다.
4. **File → Save**를 실행한다. 저장 알림과 메뉴바 파일명을 확인한다. `.visual-spec/specs/login-screen.json`에 저장되며 저장소의 `examples/login-screen.json`은 바뀌지 않는다.
5. 새로고침하거나 다시 Open한 뒤 문구를 확인한다. 최초 단일 화면 예제는 로드 시 프로젝트 상태로 확장되고, Save 결과는 0.3 `ProjectSpec`(`pages`·`pageOrder`)이다.

Save as는 새 이름으로 저장하고 그 파일을 다음 Save 대상으로 삼는다. File → Export와 패널의 Export JSON은 스펙 JSON 다운로드다. React 코드는 뒤의 **Export Code**를 사용한다.
localStorage 자동 복원과 명시적인 Save는 별개다. 다른 탭 변경을 감지하면 자동저장과
파일 저장을 중지하고 내 초안을 보존한다(#258). 충돌 안내에서 내 작업을 별도 JSON으로
보관하거나 확인 후 최신 내용을 불러온다. localhost/127.0.0.1의 오래된 Save도 서버가
읽은 디스크 리비전으로 거부한다. 자세한 한계는 [저장 충돌](qa/tab-save-conflicts.md)을 따른다.

## 4. 자연어로 간격 수정

`Card`를 선택하고 하단 자연어 입력창의 적용 범위가 선택 요소인지 확인한다. `간격을 24로 바꿔줘`를 보내면 GUI는 `.visual-spec/runtime/nl-request.json`을 쓰고 응답을 기다린다.

**별도 터미널에서 같은 `visual-spec-demo` 폴더를 작업 디렉터리로 삼아 외부 에이전트를 실행**하고 다음처럼 요청한다.

> `.claude/skills/visual-spec-nl-response/SKILL.md`를 읽고 현재 `.visual-spec/runtime/nl-request.json`에 응답해 줘. 요청의 ID·범위를 지키고, 문서 파일을 직접 수정하지 말고 해당 스킬의 Command 응답 형식으로 작성해 줘.

GUI는 요청 ID가 맞는 응답을 읽어 명령 형태·시험 적용·결과 문서를 검증한 뒤 적용한다. 성공하면 Card의 gap이 24인지 확인한다. Undo 한 번으로 요청 전체를 되돌리고, 필요하면 Redo로 복구한 뒤 **Save**한다.

다른 탭이나 창에서 보낸 요청이 아직 응답을 기다리는 중이면 새 요청은 쓰이지 않고 그 사실을 안내한다 — 먼저 보낸 요청이 끝나거나 그 탭에서 취소한 뒤 다시 보낸다(티켓 실행도 같다). 시간 초과나 오류가 나면 입력창의 설명과 현재 요청·응답 ID를 확인한다. 에이전트가 실행 중인지, 같은 작업공간을 보고 있는지, 자연어 전용 스킬을 읽었는지 확인한 뒤 다시 요청한다. 스펙 파일을 직접 작성하는 `visual-spec-authoring`은 이 응답 경로와 다르다. 중지 후에도 외부 에이전트 프로세스가 자동 종료되는 것은 아니다.

### GUI를 열어 둔 채 에이전트 대화로 고치기

GUI 입력창을 쓰지 않고 에이전트 대화에서 바로 "제목을 크게 해줘"처럼 요청해도 된다. GUI가 열려 있으면
에이전트는 스펙 파일을 직접 고치지 않고 GUI에 편집을 보내며, GUI 오른쪽 아래에 "외부 에이전트가 편집을
적용했습니다"와 **되돌리기**가 뜬다. 적용 결과는 Undo 한 단계이고, 저장은 GUI에서 **Save**로 한다.
그 사이 GUI에서 직접 편집했다면 에이전트 요청은 적용되지 않고 다시 요청하라고 안내된다 — 에이전트가 새
상태를 읽고 다시 보낸다. 같은 작업공간을 여러 탭으로 열면 그중 한 탭만 에이전트와 연결된다.

열어 둔 파일을 에이전트나 다른 도구가 디스크에서 직접 고쳐도 GUI가 몇 초 안에 알아챈다. 화면에서
편집한 것이 없으면 바뀐 내용을 불러오고 **되돌리기**를 보여 주며, 저장하지 않은 편집이 있으면 디스크
내용을 불러올지, 지금 편집을 유지할지 묻는다.

## 5. 구현 티켓으로 코드 생성

메뉴바의 **구현 티켓**을 열면 현재 활성 페이지의 컴포넌트·페이지 티켓과 의존성을 볼 수 있다. **전체 실행**은 지금 준비된 티켓 묶음을 `.visual-spec/runtime/ticket-request.json`에 기록한다.
외부 에이전트에 다음처럼 요청한다.

> `.claude/skills/visual-spec-ticket-response/SKILL.md`와 그 스킬이 참조하는 `visual-spec-to-react` 지침을 읽고, 현재 `.visual-spec/runtime/ticket-request.json`의 한 웨이브를 처리해 줘. 요청된 파일을 실제로 생성·확인한 뒤 결과 응답을 써 줘. 수행한 검증과 미실행 검증을 구분해 줘.

에이전트는 요청의 `filePath`를 **`.visual-spec/generated/` 기준 상대 경로**로 해석한다. 응답은 Ticket 객체나 Command 배열이 아니라 `requestId`와 티켓별 `results`다. 직접 ID나 성공 응답을 복사해 넣는 대신 현재 요청을 처리하게 한다.

GUI가 성공 응답을 받으면 의존성이 풀린 **다음 웨이브를 새 ID로 요청**한다. 전체 티켓이 끝날 때까지 새 요청마다 같은 스킬로 처리하도록 외부 에이전트에 지시한다. GUI의 “전체 실행”은 에이전트를 자동 호출하거나 상시 감시 작업을 설치하지 않는다. 개별 “실행”은 티켓 하나만 요청한다.

실패가 있으면 해당 티켓의 원인을 확인한다. 실패한 티켓에 의존하는 후행 티켓은 진행되지 않는다. 중지는 GUI 대기를 멈추므로 외부 에이전트에도 중지를 알려야 한다. 스펙을 바꿨다면 변경된 페이지로 티켓을 다시 컴파일하고 필요한 코드를 다시 생성한다.

## 6. Export Code와 기존 React 앱 통합

1. **File → Export Code**를 열고 검사 결과를 확인한다. 파일·상대 import·asset 경로와 티켓 포함 여부를 검사한다. 파일이 없거나 오래된 상태면 에이전트 작업 후 **다시 검사**한다.
2. 오류 내용을 해결하고 **결과 폴더 ZIP 내려받기**로 결과를 받는다. 티켓의 `done` 상태만으로 파일의 컴파일·화면 일치까지 보장되지는 않는다.
3. 압축을 풀면 프로젝트 이름의 폴더 아래 `pages/`, `components/`, 참조 이미지가 있을 때 `assets/`, 의존성 목록 `package.json`, 검증 결과를 담은 `README.md`가 있다.
4. **기존 React + TypeScript + Tailwind v4 앱**의 `src/visual-spec/` 같은 위치에 이 폴더 내용을 복사한다. `pages/`·`components/`·`assets/`의 상대 위치를 유지한다. 대상 앱의 package.json을 덮어쓰지 말고 내보낸 의존성 목록을 대조해 필요한 패키지만 추가한다.
5. 페이지 파일의 실제 이름을 확인해 앱이나 라우터에 연결한다. 예를 들어 결과가 `pages/Login.tsx`라면 다음과 같다.

```tsx
import Login from "./visual-spec/pages/Login";

export default function App() {
  return <Login />;
}
```

대상 Vite 앱은 React 플러그인과 `@tailwindcss/vite`가 설정돼 있고 앱이 읽는 CSS에 `@import "tailwindcss";`가 있어야 한다. 복사한 TSX의 유틸리티가 CSS 생성 대상에 포함되는지 확인한다. 이미 설정된 앱이라면 중복 설정하지 않는다.

이미지가 있는 결과는 특히 경로를 확인한다. 생성 코드의 `src="../assets/hero.png"`는 브라우저가 현재 페이지 URL 기준으로 해석하므로 Vite에서 그대로 표시되지 않을 수 있다. 대상 앱에 통합할 때 실제 파일을 가리키는 정적 import 또는 다음처럼 번들러가 해석하는 URL로 바꾼다.

```tsx
const heroUrl = new URL("../assets/hero.png", import.meta.url).href;
// pages/ 또는 components/ 안의 파일에서 사용
// <img src={heroUrl} alt="" />
```

Login 예제에는 이미지가 없다. 폰트도 자동 설치되지 않으므로 예제의 Pretendard를 그대로 재현하려면 대상 앱에 폰트를 준비한다.
대상 앱의 타입 검사·빌드를 실행하고 개발 서버에서 문구·간격·버튼·이미지를 확인한다. Vite/TypeScript 앱의 예시는 다음과 같으며 실제 프로젝트 스크립트를 우선한다.

```bash
pnpm exec tsc -b --noEmit
pnpm run build
pnpm run dev
```

자동으로 기존 앱의 코드·라우터에 병합하거나 배포하지 않는다. Export 검사는 타입 검사·실제 브라우저 렌더 비교를 대신하지 않는다.

## 참고

- [전체 흐름 검증 기록](15-workflow-qa.md): 수행한 경로·기준 커밋·성공/실패·남은 한계
- [구현 현황](07-implementation-status.md), [자연어 계약](08-natural-language.md), [단축키](10-shortcuts.md)
- [티켓 응답 스킬](../skills/visual-spec-ticket-response/SKILL.md), [자연어 응답 스킬](../skills/visual-spec-nl-response/SKILL.md)
