# 01. 제품 개요

> 출처: ClickUp 팀 문서 `PRD 1차`, `Visual Spec Builder MVP`

## 한 줄 설명

저장소 체크아웃 또는 로컬 tarball 설치본으로 localhost에서 실행하는 화면 설계 GUI 도구다.
사용자는 자연어 또는 직접 조작으로 화면을 구성하고, 도구는 이를 JSON Visual Spec으로 저장한다.
Claude Code 또는 Codex는 해당 JSON을 읽어 실제 React 코드를 구현한다.

MVP 관점에서 다시 쓰면, 이 제품은 **화면 스펙을 컴포넌트 구현 티켓으로 변환하고 AI 에이전트가 의존성 순서대로 구현하도록 통제하는 Visual Implementation Harness**다.

## 전체 흐름

```
저장소 준비 또는 로컬 tarball 설치
→ 독립 작업공간 생성·스킬과 로컬 계약 설치
→ localhost GUI 실행
→ 자연어 또는 직접 조작으로 화면 구성
→ JSON Visual Spec 저장
→ 사용자가 별도로 실행한 AI Agent가 요청별 staging에 React 코드 생성
→ GUI가 결과를 검증·수락
→ 코드 ZIP Export·대상 앱에서 통합 및 검증
```

> **정정 이력 (2026-09-18, 이슈 #112)**
> 첫 단계 "라이브러리 설치"는 아직 `npm install`이 아니다. `package.json`에 `"private": true`가
> 있어 이 패키지는 npm에 배포돼 있지 않다 — 위 한 줄 설명의 "React 프로젝트에 설치해"도 지금은
> **저장소를 클론해 실행하는 것**을 뜻한다.
> **지금은 공개 배포하지 않기로 했다**: GUI가 `.visual-spec/` 작업공간을 읽고 쓰는 길이 Vite
> 개발 서버 미들웨어라(이슈 #133) 개발 서버 전제가 먼저 확정돼야 하고, 그 전제가 서면 배포
> 형태는 그 위에서 정하면 된다. 실제 설치·실행 방법은
> [02-mvp-scope.md](02-mvp-scope.md)의 "설치와 실행" 참고.

현재도 패키지는 `private: true`이며 공개 레지스트리 배포는 하지 않는다. 다만 위 2026-09-18
기록 이후 **`pnpm pack` 로컬 tarball 설치 경로가 추가됐다.** 실제 실행 절차는
[14. 처음부터 따라 하기](14-getting-started.md), 패키지 검증 범위는
[로컬 tarball GUI 런타임 QA](qa/package-tarball-runtime.md)를 따른다.

## 초기 지원 환경

- React
- Vite
- TypeScript
- Tailwind CSS

## 핵심 원칙

### 1. JSON은 CSS 프레임워크에 종속되지 않는다

IR은 스타일 기술 방식을 모른다. 프레임워크별 출력은 Style Generator가 담당한다.

```
공통 IR → Style Generator → React 코드
```

현재 React 생성 지침은 Tailwind 유틸리티와 필요한 정적 CSS를 사용한다. 반응형 media query나
정확한 레이아웃 표현을 위한 CSS를 제거하지 않는다. Panda CSS와 styled-components 출력 어댑터는
초기 설계의 후속 방향이며 현재 제공 기능으로 보지 않는다.

### 2. 화면 생성과 코드 생성을 분리한다

GUI는 JSON을 생성하고 수정한다. 실제 React 코드는 후속 단계에서 AI Agent가 생성한다.

자연어로 "대시보드를 만들어줘"라고 했을 때 바로 React 파일까지 수정하면 사용자가 화면 구조를 검토할 기회를 잃는다. 따라서 기본 동작은 **자연어 요청 → 캔버스만 변경**이고, 코드 반영은 사용자가 별도로 실행한다.

### 3. 기존 프로젝트를 분석하지 않는다

Visual Spec Builder는 기존 프로젝트의 폴더 구조와 공통 컴포넌트에 의존하지 않는다. `init`은 전용 작업공간 `.visual-spec/`을 준비하며 기존 앱의 소스를 분석하거나 자동 병합하지 않는다.
별도의 `skills` 명령은 `.claude/skills/`·`.agents/skills/`에 에이전트 지침과 로컬 계약을 설치한다.

따라서 다음 작업이 필요 없다.

- 기존 폴더 구조 분석
- 기존 라우터 구조 분석
- 기존 공통 컴포넌트 탐색
- 기존 코드에 자동 병합
- 프로젝트별 생성 경로 추론

도구가 정한 동일한 구조 안에서 화면을 만들고, 완성된 결과만 내보낸다.

> **정정 이력 (2026-08-15)**
> 이 문서의 이전 버전에는 전체 흐름에 "대상 React 프로젝트 분석" 단계가 있었다.
> `Visual Spec Builder MVP` 문서가 독립 작업공간 원칙을 명시하면서 이 단계를 명확히 배제했으므로 MVP 기준으로 통일했다. 자세한 범위는 [02-mvp-scope.md](02-mvp-scope.md) 참고.

### 4. 자연어와 GUI는 같은 데이터를 만진다

입력 방식만 다르고 결과는 완전히 같다. 사용자가 버튼을 직접 드래그해도, 자연어로 "버튼을 폼 오른쪽 아래로 옮겨줘"라고 해도 동일한 명령이 발생한다.

```json
{ "type": "moveNode", "id": "submit-button", "newParentId": "form-actions", "index": 1 }
```

이 대칭성이 제품의 근간이다. 자세한 내부 구조는 [03-user-flow.md](03-user-flow.md) 참고.

## 다음 문서

| 문서 | 내용 |
|---|---|
| [02-mvp-scope.md](02-mvp-scope.md) | 무엇을 만들고 무엇을 만들지 않는가 |
| [03-user-flow.md](03-user-flow.md) | 사용자가 거치는 경로와 내부 구조 |
| [04-gui-spec.md](04-gui-spec.md) | 홈화면과 에디터 화면 명세 |
| [05-schema.md](05-schema.md) | JSON 스키마 (현재 0.4) |
