# 기여 가이드

이 저장소에 코드나 문서를 올릴 때 지키는 규칙이다.
제품이 무엇인지, 어떤 문서가 있는지는 [README.md](README.md)를 먼저 본다.

## 시작하기

패키지 매니저는 **pnpm**이다 (`package.json`의 `packageManager: pnpm@10.33.0`).
npm으로 설치하지 않는다. Node 지원 범위는 `^20.19.0 || >=22.12.0`이다.

```bash
git clone https://github.com/visual-spec-labs/Visual-Spec-Builder.git
cd Visual-Spec-Builder
pnpm install
pnpm dev            # vite 개발 서버(React 개발 모드). CLI로 띄우는 사용자 GUI는 production 모드다(#314)
```

전체 스크립트 목록은 [README.md의 "개발"](README.md#개발) 절에 있다.

## 브랜치 전략

| 브랜치 | 역할 |
|---|---|
| `develop` | GitHub 기본 브랜치. 실제 개발선. 모든 피처 브랜치가 여기로 PR을 낸다 |
| `main` | 릴리스 라인. `develop`에서 승격한다 |

피처 브랜치는 `develop`에서 딴다. `main`에서 따지 않는다.

```bash
git switch develop
git pull
git switch -c <핸들>/<작업이름>
```

## 커밋 메시지

한국어로 쓰고, Conventional Commit 접두어를 붙인다.

```
docs: 기여 규칙과 라이선스 파일 추가
```

접두어는 아래 라벨 7종과 같다: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`.

## 이슈

### 제목

```
<접두어>: <무엇이 문제인지 또는 무엇이 없는지 한 문장> — <보충 맥락>
```

- 접두어는 커밋 접두어·[라벨 7종](#라벨-7종)과 같다.
- 할 일(명령형, "~를 추가")이 아니라 현상(서술형, "~가 없다", "~하면 ~가 깨진다")으로 쓴다.
- `—` 뒤 보충 맥락은 선택이다. 원인·영향·관련 문서를 짧게 적는다.

| 예 | 이슈 |
|---|---|
| `fix: 탭을 여러 개 열면 나중에 저장한 탭이 앞 탭의 변경을 덮어쓴다` | #232 |
| `feat: 배경 image 채우기가 없다 — '사진 위 반투명 그라디언트'를 아직 표현할 수 없다` | #235 |
| `fix: 리사이즈 한 번을 Ctrl+Z 한 번에 되돌릴 수 없다 — 마우스 이동마다 Undo 단계가 쌓인다` | #207 |

이슈끼리의 관계는 제목 끝에 표시한다.

| 경우 | 끝에 붙이는 것 | 예 |
|---|---|---|
| 여러 작업을 묶는 상위 이슈 | `(epic)` | #265 |
| 설계 문서의 후속 이슈 | `(<문서 번호> 후속 <순번>)` | `(12 후속 1)` — #222~#224 |
| epic의 하위 이슈 | `(#<상위 번호> <작업 번호>)` | `(#265 S1-1)` |

### 라벨

제목 접두어와 같은 라벨 **1개**만 단다. 자세한 규칙은 [라벨 7종](#라벨-7종)에 있다.

## Pull Request

- 대상 브랜치는 `develop`이다.
- [PR 템플릿](.github/PULL_REQUEST_TEMPLATE.md)이 자동으로 붙는다. 항목을 지우지 말고 채운다.
- 제목은 커밋 메시지와 같은 `<접두어>: <한 일>` 형식이다. 이슈를 닫는 PR이면 끝에 `(#번호)`를 붙인다.
  예: `fix: 탭 저장이 앞 탭의 변경을 덮어쓰지 않게 한다 (#232)`
- 라벨은 제목 접두어와 같은 것 **1개**만 단다. 규칙은 [라벨 7종](#라벨-7종)과 같다.
- CI의 필수 체크 이름은 `build`로 유지한다. Linux Node `20.19.0`·`22.12.0`·`24` 검사와
  Windows Server 2025 / Node `24`, 별도 Chromium 검사가 모두 성공해야 `build`가 성공한다. 실패·취소·skip은 성공으로 취급하지 않는다.
- Linux 각 버전과 Windows에서 frozen install → typecheck → lint → 전체 테스트 → production build →
  스키마 드리프트 검사를 실행한다. 전체 테스트에는 기존 fresh tarball smoke가 포함된다
  (저장소 밖 새 소비 폴더에 production 의존성 설치, CLI·GUI 응답 확인).
- Chromium 잡은 Python 3.12와 Playwright 1.62.0 및 그 버전에 대응하는 Chromium을 설치한다.
  기존 fixture의 `/usr/bin/chromium` 경로도 이 브라우저로 연결하고 opt-in 검사 3개를 명시 실행한다.
  Grid도 Playwright로 CSS viewport를 직접 지정해 브라우저 창 테두리와 `--dump-dom` 종료에 의존하지 않는다.
  이는 수동 fixture의 DOM/레이아웃 검사이며 실제 AI 실행이나 전체 사용자 여정 검증은 아니다.
- Windows 잡은 새 hosted runner에서 checkout **전에** `core.autocrlf=true`를 설정한다.
  checkout 뒤 설정값과 CRLF/mixed 파일 부재를 검사해 #262의 `.gitattributes` 회귀를 확인한다.
  기존 Windows 작업 트리의 줄바꿈 문제와 안전한 새 checkout 방법은
  [시작 가이드](docs/14-getting-started.md#기존-windows-체크아웃의-줄바꿈-262)를 참고한다.
- Windows 전체 테스트에서 POSIX 권한 검사 3개와 opt-in 브라우저 3개는 명시적으로 skip한다.
  브라우저 통과 근거는 별도 Linux Chromium 잡의 실제 실행이다. #292 사용자 여정 harness는
  준비된 뒤 별도로 통합한다. 브랜치 보호·배포 설정은 변경하지 않는다.
- 올리기 전에 로컬에서 아래를 실행한다. 일반 `pnpm test`의 브라우저 skip은 브라우저 통과 증거가 아니다.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run generate:types && git diff --exit-code   # 드리프트 검사

# Python Playwright와 Chromium 설치는 .github/workflows/ci.yml의 browser 잡 참고
VSB_RESPONSIVE_BROWSER=1 VSB_PAGE_SHELL_BROWSER=1 VSB_GRID_BROWSER=1 \
  CHROME_BIN=/usr/bin/chromium pnpm exec vitest run \
  test/responsive-codegen-browser.test.ts test/page-shell-browser.test.ts \
  test/grid-codegen-browser.test.ts
```

## 라벨 7종

이미 GitHub 저장소에 적용돼 있다. 새로 만들지 않는다.

| 라벨 | 색상 | 의미 |
|---|---|---|
| `feat` | `#0e8a16` | 새 기능 |
| `fix` | `#d73a4a` | 버그 수정 |
| `refactor` | `#fbca04` | 코드 개선 및 리팩토링 |
| `style` | `#c5def5` | 스타일 / UI |
| `docs` | `#0075ca` | 문서 |
| `test` | `#bfd4f2` | 테스트 |
| `chore` | `#ededed` | 설정 / 빌드 |

**이슈·PR 모두 라벨은 정확히 1개다** (2026-10-05 결정, 근거는 [아래](#pr-라벨-개수-결정됨)).

- 제목 접두어와 같은 라벨을 단다. epic 이슈도 1개다.
- 여러 성격이 섞이면 주된 것 하나를 고르고, 나머지는 본문에 쓴다.

이슈 템플릿은 기본 라벨을 자동으로 붙인다 — Bug Report → `fix`, Feature Request → `feat`, Refactor → `refactor`.

## ⚠️ 스키마를 고칠 때

이 저장소에서 가장 자주 걸리는 지점이다.

- **정본은 `src/features/editor/schema/visual-spec.schema.json` 하나다.**
- `src/features/editor/schema/types.ts`는 **정본에서 생성한 파일**이다. 손으로 고치지 않는다.
- 스키마를 고쳤으면 반드시 아래를 돌리고, 바뀐 `types.ts`를 **같은 커밋에 함께 올린다.**

```bash
pnpm run generate:types
```

안 그러면 CI의 스키마 드리프트 검사에서 막힌다. 이 검사는 `generate:types`를 다시 돌린 뒤
`git diff`가 비어야 통과한다.

스키마 v0.1은 **동결 상태**다. 무엇을 바꿀 수 있고 절차가 어떻게 되는지는
[`docs/06-schema-freeze.md`](docs/06-schema-freeze.md)에 있다. 스키마를 건드리기 전에 반드시 읽는다.

## 문서 구조

- [`docs/`](docs/)는 `01`~`07` 번호 순서로 읽는다. 목차는 [README.md](README.md#문서)에 있다.
  범위를 판단해야 할 때의 기준은 [`docs/02-mvp-scope.md`](docs/02-mvp-scope.md)이고,
  지금 무엇이 구현됐는지는 [`docs/07-implementation-status.md`](docs/07-implementation-status.md)다.
- 번호가 없는 규칙 문서도 `docs/` 바로 아래에 둔다 —
  [`docs/DESIGN-TOKEN-RULES.md`](docs/DESIGN-TOKEN-RULES.md)(디자인 토큰 네이밍·참조 규칙),
  [`docs/EDITOR_STORE_CONTRACT.md`](docs/EDITOR_STORE_CONTRACT.md)(에디터 상태 공유 계약).
- 스킬 설명 문서(사람이 읽는 것)는 [`docs/skills/`](docs/skills/)에 둔다.
- 설계 논의 기록은 [`docs/superpowers/specs/`](docs/superpowers/specs/)에 둔다.
- 배포용 스킬 원본은 저장소 루트 [`skills/`](skills/)에 둔다. 스킬 하나가 디렉터리 하나이고 그 안에 `SKILL.md`가 들어간다.
- 아직 정해지지 않은 항목은 [`docs/open-questions.md`](docs/open-questions.md)에 모은다.

## 미확정 사항

지금 이 문서에 남은 미확정 사항은 없다. 새로 생기면 [`docs/open-questions.md`](docs/open-questions.md)에 모은다.

### PR 라벨 개수 (결정됨)

**결정됨 (2026-10-05): 1개.**

이슈·PR 모두 라벨은 정확히 1개다. 규칙은 [라벨 7종](#라벨-7종)에 있다.

결정 근거:

- PR 본문의 "변경 유형" 체크박스를 그대로 옮긴 결과 PR #1에 라벨이 4개(`feat`, `docs`, `test`, `chore`)
  붙어 산만하다는 지적이 있었다. PR #13에서 리뷰어에게 물었으나 답이 없어 한동안 미확정으로 두었다.
- 그동안의 관행이 이미 1개였다. PR #13 이후 머지된 15건은 라벨이 1개(10건) 아니면 0개(5건, 모두 스킬 작업 PR)였고,
  2개 이상 붙은 것은 #13 이전의 #1(4개) · #4 · #9 · #12(각 2개)뿐이었다.
- 이슈 제목에도 같은 형식이 자리 잡았다 — #207 · #209 · #217~#236 · #262 · #265 모두 접두어 하나에 라벨 하나다.
