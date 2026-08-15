# 01. 제품 개요

> 출처: ClickUp 팀 문서 `PRD 1차`, `Visual Spec Builder MVP`

## 한 줄 설명

React 프로젝트에 설치해 localhost에서 실행하는 GUI 도구다.
사용자는 자연어 또는 직접 조작으로 화면을 구성하고, 도구는 이를 JSON Visual Spec으로 저장한다.
Claude Code 또는 Codex는 해당 JSON을 읽어 실제 React 코드를 구현한다.

MVP 관점에서 다시 쓰면, 이 제품은 **화면 스펙을 컴포넌트 구현 티켓으로 변환하고 AI 에이전트가 의존성 순서대로 구현하도록 통제하는 Visual Implementation Harness**다.

## 전체 흐름

```
라이브러리 설치
→ 독립 작업공간 생성
→ localhost GUI 실행
→ 자연어 또는 직접 조작으로 화면 구성
→ JSON Visual Spec 저장
→ AI Agent가 React 코드 생성
→ 완성된 기능 폴더 Export
```

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

MVP는 Tailwind만 지원한다. Panda CSS와 styled-components는 같은 IR을 쓰는 출력 어댑터로 나중에 추가한다.

### 2. 화면 생성과 코드 생성을 분리한다

GUI는 JSON을 생성하고 수정한다. 실제 React 코드는 후속 단계에서 AI Agent가 생성한다.

자연어로 "대시보드를 만들어줘"라고 했을 때 바로 React 파일까지 수정하면 사용자가 화면 구조를 검토할 기회를 잃는다. 따라서 기본 동작은 **자연어 요청 → 캔버스만 변경**이고, 코드 반영은 사용자가 별도로 실행한다.

### 3. 기존 프로젝트를 분석하지 않는다

Visual Spec Builder는 기존 프로젝트의 폴더 구조와 공통 컴포넌트에 의존하지 않는다. 최초 실행 시 현재 프로젝트를 분석하거나 변경하지 않고 전용 작업공간 `.visual-spec/` 만 생성한다.

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
{ "type": "MOVE_NODE", "nodeId": "submit-button", "parentId": "form-actions", "index": 1 }
```

이 대칭성이 제품의 근간이다. 자세한 내부 구조는 [03-user-flow.md](03-user-flow.md) 참고.

## 다음 문서

| 문서 | 내용 |
|---|---|
| [02-mvp-scope.md](02-mvp-scope.md) | 무엇을 만들고 무엇을 만들지 않는가 |
| [03-user-flow.md](03-user-flow.md) | 사용자가 거치는 경로와 내부 구조 |
| [04-gui-spec.md](04-gui-spec.md) | 홈화면과 에디터 화면 명세 |
| [05-schema.md](05-schema.md) | JSON 스키마 v0.1 |
