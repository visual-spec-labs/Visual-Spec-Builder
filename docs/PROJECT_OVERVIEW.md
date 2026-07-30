# Visual Spec Builder

## 한 줄 설명

React 프로젝트에 설치해 localhost에서 실행하는 GUI 도구다.
사용자는 자연어 또는 직접 조작으로 화면을 구성하고,
도구는 이를 JSON Visual Spec으로 저장한다.
Claude Code 또는 Codex는 해당 JSON을 읽어 실제 React 코드를 구현한다.

## 전체 흐름

라이브러리 설치
→ 대상 React 프로젝트 분석
→ localhost GUI 실행
→ 자연어 또는 직접 조작으로 화면 구성
→ JSON Visual Spec 저장
→ AI Agent가 실제 React 코드 생성
→ 결과 화면 확인

## 초기 지원 환경

- React
- Vite
- TypeScript
- Tailwind CSS

## 핵심 원칙

- JSON은 특정 CSS 프레임워크에 종속되지 않는 중립 구조로 저장한다.
- GUI 편집 결과와 React 구현 코드를 분리한다.
- GUI는 JSON을 생성하고 수정한다.
- 실제 React 코드는 후속 단계에서 AI Agent가 생성한다.
