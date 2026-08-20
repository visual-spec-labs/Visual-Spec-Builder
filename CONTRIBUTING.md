# 기여 가이드

이 저장소에 코드나 문서를 올릴 때 지키는 규칙이다.
제품이 무엇인지, 어떤 문서가 있는지는 [README.md](README.md)를 먼저 본다.

## 시작하기

패키지 매니저는 **pnpm**이다 (`package.json`의 `packageManager: pnpm@10.33.0`).
npm으로 설치하지 않는다. Node는 20 이상이 필요하다.

```bash
git clone https://github.com/visual-spec-labs/Visual-Spec-Builder.git
cd Visual-Spec-Builder
pnpm install
pnpm dev            # vite 개발 서버
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

## Pull Request

- 대상 브랜치는 `develop`이다.
- [PR 템플릿](.github/PULL_REQUEST_TEMPLATE.md)이 자동으로 붙는다. 항목을 지우지 말고 채운다.
- 변경 유형에 맞는 라벨을 단다.
- CI(`build` 잡)가 통과해야 병합한다. 검사 항목은 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)에 있고, 순서는
  `pnpm install --frozen-lockfile` → `pnpm run typecheck` → `pnpm test` → 스키마 드리프트 검사다.
- 올리기 전에 로컬에서 아래를 돌려보면 CI와 같은 것을 확인할 수 있다.

```bash
pnpm run typecheck
pnpm test
pnpm run generate:types && git diff --exit-code   # 드리프트 검사
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

- [`docs/`](docs/)는 `01`~`06` 번호 순서로 읽는다. 목차는 [README.md](README.md#문서)에 있다.
  범위를 판단해야 할 때의 기준은 [`docs/02-mvp-scope.md`](docs/02-mvp-scope.md)다.
- 스킬 설명 문서(사람이 읽는 것)는 [`docs/skills/`](docs/skills/)에 둔다.
- 설계 논의 기록은 [`docs/superpowers/specs/`](docs/superpowers/specs/)에 둔다.
- 배포용 스킬 원본은 저장소 루트 [`skills/`](skills/)에 둔다. 스킬 하나가 디렉터리 하나이고 그 안에 `SKILL.md`가 들어간다.
- 아직 정해지지 않은 항목은 [`docs/open-questions.md`](docs/open-questions.md)에 모은다.

## 미확정 사항

**PR 하나에 라벨을 몇 개까지 다는지는 아직 정해지지 않았다.**

PR 본문의 "변경 유형" 체크박스를 그대로 옮긴 결과 PR #1에 라벨이 4개(`feat`, `docs`, `test`, `chore`)
붙어 산만하다는 지적이 있었다. PR #13 본문에서 리뷰어에게 물었으나 답이 오지 않았다.

정책이 정해지면 이 절에 적는다. 그때까지는 각자 판단해서 달고, 이 항목을 근거로 리뷰에서 지적하지 않는다.
