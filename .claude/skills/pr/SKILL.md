---
name: pr
description: 사용자가 "PR 올려/올려줘", "PR 만들어", "pr 생성", "PR 열어" 등 PR 생성을 요청할 때 사용. 테스트(tsc·lint·build)를 실행하고 한글 PR 제목·본문을 템플릿에 맞게 작성한 뒤 사용자 승인을 받아 PR을 생성한다.
---

PR 생성 전 테스트를 실행하고, 한글 PR 제목·본문을 작성한 뒤 사용자 승인을 받아 PR을 생성한다.

---

## 진행 순서

### 1단계 — 브랜치 및 변경사항 파악

**PR base는 항상 `develop`이다.** GitHub 기본 브랜치나 현재 브랜치의 upstream을 추측해 base를 정하지 않는다. `main`을 포함해 다른 브랜치를 PR base로 사용하지 않는다.

```bash
git status
git log develop..HEAD --oneline
git diff develop...HEAD --stat
```

- 현재 브랜치가 `develop`이면 피처 브랜치가 아니므로 PR 준비를 중단한다.
- PR 준비 요약과 승인 요청에 base를 `develop`으로 표시한다.
- 원격 브랜치에 push 되지 않은 경우 → PR 생성 전 push 여부를 사용자에게 묻는다

---

### 2단계 — 테스트 실행 (필수)

아래 명령어를 순서대로 실행한다. 실패 시 PR을 진행하지 않는다.

```bash
npx tsc --noEmit
npm run lint 2>/dev/null || echo "lint 스크립트 없음, 건너뜀"
npm test --passWithNoTests 2>/dev/null || echo "test 스크립트 없음, 건너뜀"
npm run build
```

테스트 결과 출력:

```
## 테스트 결과

| 항목 | 결과 |
|---|---|
| TypeScript 타입 검사 | ✅ 통과 / ❌ 실패 |
| ESLint | ✅ 통과 / ⏭️ 건너뜀 / ❌ 실패 |
| 단위 테스트 | ✅ 통과 / ⏭️ 건너뜀 / ❌ 실패 |
| 빌드 | ✅ 통과 / ❌ 실패 |
```

**❌ 항목이 하나라도 있으면 PR 생성을 중단**하고 오류 내용을 출력한다.

---

### 3단계 — PR 내용 작성

`develop..HEAD` 커밋과 `develop...HEAD` 변경 파일을 분석해 초안을 작성한다.

**PR 제목**: `type: 한글 요약` 형태, 70자 이내
- type: `feat` | `fix` | `refactor` | `chore` | `style` | `docs`

**PR 본문 형식** (`.github/PULL_REQUEST_TEMPLATE.md` 준수):
```markdown
## 관련 이슈

- closes #(연결된 이슈 번호 — 없으면 줄 삭제, 연결 이슈가 여러개면 다 적기)

## 작업 내용

-

## 변경 사항

-

## 스크린샷 (선택)

## 체크리스트

- [ ] 코드가 정상적으로 동작하는지 확인했습니다
- [ ] 불필요한 console.log 또는 디버깅 코드를 제거했습니다
- [ ] 컨벤션에 맞게 작성했습니다
```

---

### 4단계 — 사용자 승인 요청 (필수)

아래 형식으로 출력하고 **반드시 사용자의 확인을 기다린다. 승인 없이 PR을 생성하지 않는다.**

```
## PR 준비 완료

**브랜치**: feature/xxx → develop
**포함 커밋**: N개

**제안 PR 제목**:
[feat] 개인 전적 검색 및 매치 기록 목록 구현

**PR 본문 미리보기**:
(작성된 본문 전체 출력)

---
이 내용으로 PR을 생성할까요?
- 승인: "응" / "yes" / "ㅇ"
- 내용 수정: 수정하고 싶은 부분을 말씀해 주세요
- 취소: "아니" / "no"
```

---

### 5단계 — PR 생성

사용자가 승인하면 base를 생략하지 않고 다음처럼 PR을 생성해 URL을 출력한다.

```bash
gh pr create --base develop
```

생성 후 `gh pr view --json baseRefName`으로 PR base가 `develop`인지 확인한다. `develop`이
아니면 작업을 완료로 보고하지 말고 올바른 base로 수정한다.
