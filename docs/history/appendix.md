# 부록 — 단계별 상세 기록

> [`data/`](./data/)에 모은 develop 기록에서 생성한 PR·이슈 목록과 집계다. 날짜·출처 기준은 [본문](./README.md#이-기록에-대하여)을 따른다.
> 갱신: `node scripts/history/sync.mjs` · 검사: `node scripts/history/sync.mjs --check` (저장소 루트에서 실행, [갱신 절차](./UPDATING.md)).

## 단계 요약

| 단계 | 기간 | 병합 PR | 커밋 | 새 이슈 |
|---|---|---:|---:|---:|
| [0. 프롤로그 — 한 문장에서 출발하다](#0-prologue) | 07-24 ~ 07-31 | 1 | 9 | 0 |
| [1. 기초 공사 — 방향을 다듬고 규칙을 세우다](#1-groundwork) | 08-01 ~ 08-20 | 11 | 36 | 6 |
| [2. 에디터의 골격이 서다](#2-editor-frame) | 08-21 ~ 08-31 | 18 | 80 | 26 |
| [3. 표현의 폭을 넓히다 — 스키마와 편집 모델](#3-richer-language) | 09-01 ~ 09-11 | 32 | 116 | 25 |
| [4. 손에 붙는 편집기, 굳어지는 계약](#4-hands-on-editor) | 09-12 ~ 09-26 | 29 | 90 | 27 |
| [5. 말이 화면이 되다 — 자연어와 코드 생성](#5-words-to-screens) | 09-27 ~ 10-02 | 14 | 33 | 14 |
| [6. 몰아친 하루 — 배경과 반응형](#6-busiest-day) | 10-03 ~ 10-04 | 24 | 130 | 22 |
| [7. 첫 완주 — 로그인 예제의 전체 흐름 검증](#7-first-run) | 10-05 ~ 10-05 | 13 | 37 | 29 |
| [8. 제품으로 다듬다](#8-polishing) | 10-06 ~ 10-08 수집 시점 | 21 | 125 | 10 |

커밋은 병합 커밋을 포함한 고유 SHA 수이며, **committer 시각을 KST로 변환**해 나눈다. 예를 들어 [906126d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/906126dd4c322e325cfab76bb9d8cee171172e32)는 UTC 10월 4일이지만 KST 10월 5일에 속한다. 수집 시점의 develop([408c53c](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/408c53c04d34dd33d47852fb66d8aa429cd01291))에서 도달 가능한 커밋은 모두 656개다.

이슈는 생성일로 배치하고 PR과 구분했다. 제목은 각 항목을 수집한 시점의 표기다.

<a id="0-prologue"></a>

## 0. 프롤로그 — 한 문장에서 출발하다

07-24 ~ 07-31 · 다섯 명이 MVP 범위와 데모 목표 한 문장을 정하고, 스키마 v0.1을 동결했다.

- 병합 PR 1건 · 커밋 9개 · 새 이슈 0건
- PR 작성: Yumesa2025 1

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 07-30 | [#1](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/1) | feat: Visual Spec Schema v0.1 — JSON 스키마와 TypeScript 타입 구현 | Yumesa2025 |

### 새 이슈

이 기간에 등록된 이슈는 없다.

<a id="1-groundwork"></a>

## 1. 기초 공사 — 방향을 다듬고 규칙을 세우다

08-01 ~ 08-20 · "기존 프로젝트 분석"을 내려놓고 독립 작업공간으로 방향을 굳힌 뒤, 하루 만에 CI·스킬·문서 체계를 세웠다.

- 병합 PR 11건 · 커밋 36개 · 새 이슈 6건
- PR 작성: Yumesa2025 7 · GAMMJ 2 · wook3964 2

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 08-06 | [#4](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/4) | chore: pnpm 전환 · GitHub 이슈 템플릿 추가 · tsconfig baseUrl 제거 | GAMMJ |
| 08-11 | [#6](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/6) | feat: 로컬 GUI 에디터 레이아웃 골격 추가 | GAMMJ |
| 08-14 | [#9](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/9) | feat: Visual Spec → React 코드 생성 Skill 초안 추가 | wook3964 |
| 08-20 | [#13](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/13) | chore: 이슈/PR 템플릿을 Conventional Commit 라벨 체계에 맞춤 | Yumesa2025 |
| 08-20 | [#12](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/12) | feat: analyze-target-project 스킬 추가 및 Skill 설명 문서 정리 | wook3964 |
| 08-20 | [#14](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/14) | docs: 기획 문서를 읽는 순서대로 재편하고 홈 화면 명세 추가 | Yumesa2025 |
| 08-20 | [#15](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/15) | docs: 스킬 문서의 깨진 PROJECT_OVERVIEW 참조를 01-overview로 수정 | Yumesa2025 |
| 08-20 | [#16](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/16) | chore: PR/푸시에서 타입체크·테스트·스키마 드리프트를 검사하는 CI 추가 | Yumesa2025 |
| 08-20 | [#17](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/17) | feat: Agent Skills 번들 6종 추가하고 배포 원본을 skills/ 로 정리 | Yumesa2025 |
| 08-20 | [#18](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/18) | docs: 구현 현황 문서 07 추가 — 무엇이 되고 무엇이 남았는지 | Yumesa2025 |
| 08-20 | [#19](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/19) | chore: 기여 규칙 문서와 GitHub 거버넌스 파일 추가 | Yumesa2025 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 08-06 | [#2](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/2) | refactor: 패키지 매니저를 npm에서 pnpm으로 전환 | GAMMJ |
| 08-06 | [#3](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/3) | feat: GitHub 이슈 템플릿 추가 | GAMMJ |
| 08-11 | [#5](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/5) | feat: 로컬 GUI 에디터 레이아웃 골격 | GAMMJ |
| 08-13 | [#8](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/8) | feat: Visual Spec → React 코드 생성 Skill 구현 | wook3964 |
| 08-13 | [#10](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/10) | feat:  상단 메뉴바(헤더) UI 구현 | dogui1018 |
| 08-14 | [#11](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/11) | feat: analyze-target-project 스킬 추가 및 Skill 카탈로그 문서 정리 | wook3964 |

<a id="2-editor-frame"></a>

## 2. 에디터의 골격이 서다

08-21 ~ 08-31 · 공유 스토어 위에 레이어 트리·캔버스·속성 패널·메뉴바가 붙어 편집기가 모양을 갖췄다.

- 병합 PR 18건 · 커밋 80개 · 새 이슈 26건
- PR 작성: GAMMJ 5 · wook3964 5 · dogui1018 5 · SunMyunC 2 · Yumesa2025 1

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 08-24 | [#21](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/21) | feat: 에디터 공유 스토어 도입 | GAMMJ |
| 08-25 | [#7](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/7) | feat: 디자인 토큰 시스템 및 다크/라이트 테마 스위칭 | SunMyunC |
| 08-25 | [#23](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/23) | fix: 스키마 검증 오류 메시지를 위반 종류별로 다르게 생성 | wook3964 |
| 08-25 | [#25](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/25) | feat: visual-spec-to-react가 Visual Spec 여러 개를 한 번에 처리하게 한다 | wook3964 |
| 08-25 | [#27](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/27) | feat: 이미 생성된 화면에 대한 후속 피드백을 JSON 수정 → 재생성으로 반영한다 | wook3964 |
| 08-25 | [#28](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/28) | feat: Figma 디자인 UI 구현 (레이어 트리 · 툴바 · 메뉴바 · 속성 패널) | SunMyunC |
| 08-25 | [#30](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/30) | feat: 세부설정 패널을 스토어에 연결하고 캔버스 임시 구현 추가 | GAMMJ |
| 08-25 | [#31](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/31) | feat: 헤더 메뉴바 File/View 드롭다운 및 View 메뉴 기능 연결 | dogui1018 |
| 08-28 | [#34](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/34) | refactor: 고정 워크스페이스 경로로 전환 — analyze-target-project 제거 | wook3964 |
| 08-28 | [#36](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/36) | feat: visual-spec-to-react가 컴포넌트 단위로 파일을 분리 생성한다 | wook3964 |
| 08-28 | [#37](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/37) | feat: File 메뉴 Export 연결 | dogui1018 |
| 08-28 | [#48](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/48) | refactor: 세부설정 패널 공통 컴포넌트/훅 추출 및 UI 버그 수정 | GAMMJ |
| 08-28 | [#49](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/49) | feat: File 메뉴 New/Open 연결 | dogui1018 |
| 08-28 | [#51](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/51) | feat: File 메뉴 Save/Save as 연결 | dogui1018 |
| 08-28 | [#53](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/53) | feat(editor): 캔버스 Ctrl+휠 줌 인터랙션 | dogui1018 |
| 08-29 | [#55](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/55) | fix: 세부설정 패널 값이 반영되지 않거나 형제 요소에 간섭하는 문제 수정 | GAMMJ |
| 08-29 | [#39](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/39) | chore: 협업 규칙 문서를 5인 팀과 현재 저장소 구조에 맞게 갱신 | Yumesa2025 |
| 08-31 | [#58](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/58) | feat: 캔버스 아트보드를 고정하고 크기 필드에 실측 px를 표시 | GAMMJ |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 08-21 | [#20](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/20) | feat: 에디터 공유 스토어 도입 | GAMMJ |
| 08-21 | [#22](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/22) | fix: 스키마 검증 오류 메시지가 위반 필드와 무관하게 상수로 나온다 | wook3964 |
| 08-21 | [#24](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/24) | feat: visual-spec-to-react가 Visual Spec 여러 개를 한 번에 처리하게 한다 | wook3964 |
| 08-21 | [#26](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/26) | feat: 이미 생성된 화면에 대한 후속 피드백을 JSON 수정 → 재생성으로 반영한다 | wook3964 |
| 08-25 | [#29](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/29) | feat: 세부설정 패널 UI 구현 및 스토어 연결 | GAMMJ |
| 08-25 | [#32](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/32) | feat: File 메뉴 Export 연결 | dogui1018 |
| 08-25 | [#33](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/33) | refactor: 고정 워크스페이스 경로로 전환 — analyze-target-project 제거, 파일 위치 질문 제거 | wook3964 |
| 08-25 | [#35](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/35) | feat: Ticket Compiler — IR을 컴포넌트별 파일로 분리 생성하고 상대 경로 import 규칙 적용 | wook3964 |
| 08-28 | [#40](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/40) | refactor: 세부설정 패널이 Command Engine을 우회해 IR을 직접 수정한다 | Yumesa2025 |
| 08-28 | [#41](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/41) | feat: 스펙 문서를 열고 저장할 수 없다 — File 메뉴가 동작하지 않고 편집 대상이 하드코딩돼 있다 | Yumesa2025 |
| 08-28 | [#42](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/42) | feat: CLI와 .visual-spec/ 작업공간이 없다 — 제품 정의의 배송 경로가 코드로 존재하지 않는다 | Yumesa2025 |
| 08-28 | [#43](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/43) | feat: 레이어 트리가 하드코딩된 목록을 보여준다 — 실제 노드 트리와 연결되지 않았다 | Yumesa2025 |
| 08-28 | [#44](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/44) | feat: 도구 모음(Select/Frame/Text/Hand)이 동작하지 않아 GUI로 노드를 만들 수 없다 | Yumesa2025 |
| 08-28 | [#45](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/45) | bug: package.json의 main이 존재하지 않는 src/index.ts를 가리킨다 | Yumesa2025 |
| 08-28 | [#46](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/46) | refactor: fill의 교차축 의미가 Canvas 구현으로 사실상 결정됐는데 06에 반영되지 않았다 | Yumesa2025 |
| 08-28 | [#47](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/47) | feat: File 메뉴 New/Open 연결 | dogui1018 |
| 08-28 | [#50](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/50) | feat: File 메뉴 Save/Save as 연결 | dogui1018 |
| 08-28 | [#52](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/52) | feat: 캔버스 마우스 휠 팬 / Ctrl+휠 줌 인터랙션 | dogui1018 |
| 08-28 | [#54](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/54) | bug: 세부설정 패널에서 조정한 값이 반영되지 않거나 형제 요소에 간섭하는 문제 | GAMMJ |
| 08-29 | [#56](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/56) | feat: File 메뉴 Import 항목이 noop으로 남아 있고, 무엇을 하는 항목인지 정의된 적이 없다 | Yumesa2025 |
| 08-29 | [#57](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/57) | feat: 캔버스 아트보드와 크기 편집이 Figma 동작과 어긋난다 | GAMMJ |
| 08-29 | [#59](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/59) | bug: 크기 입력칸에 포커스가 있을 때 캔버스를 스크롤하면 Fill/Hug가 Fixed로 바뀐다 | GAMMJ |
| 08-29 | [#60](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/60) | feat: 스키마 v0.2 — ProjectSpec을 추가해 파일 1개에 여러 페이지를 담는다 (동결 해제 필요) | GAMMJ |
| 08-29 | [#61](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/61) | feat: 스토어와 캔버스가 활성 페이지 개념을 갖는다 | GAMMJ |
| 08-29 | [#62](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/62) | feat: 세부설정 패널에서 페이지 이름과 해상도를 편집한다 | GAMMJ |
| 08-29 | [#63](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/63) | feat: 레이어 트리 루트에 페이지 폴더를 두고 눌러서 캔버스를 전환한다 | GAMMJ |

<a id="3-richer-language"></a>

## 3. 표현의 폭을 넓히다 — 스키마와 편집 모델

09-01 ~ 09-11 · 노드 5종·여러 페이지 프로젝트(v0.2)로 스키마를 넓히고, 노드·페이지 필드 편집을 Command에 연결했다.

- 병합 PR 32건 · 커밋 116개 · 새 이슈 25건
- PR 작성: wook3964 12 · GAMMJ 8 · dogui1018 7 · Yumesa2025 4 · SunMyunC 1

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 09-01 | [#64](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/64) | fix: 숫자 입력칸에 휠이 닿으면 포커스를 떼 값이 바뀌지 않게 함 | GAMMJ |
| 09-01 | [#67](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/67) | feat: Visual Spec v0.1에 ImageNode 추가 | dogui1018 |
| 09-01 | [#69](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/69) | feat: File 메뉴 Import 연결 (이미지 파일 가져오기) | dogui1018 |
| 09-01 | [#71](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/71) | fix: image 노드 지원을 스킬 3개에 반영 | wook3964 |
| 09-01 | [#38](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/38) | docs: 검증기 변경에 맞춰 스킬 정정하고 07 구현 현황을 실측 갱신 | Yumesa2025 |
| 09-02 | [#76](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/76) | feat(schema): v0.2 ProjectSpec 추가 — 파일 1개에 여러 페이지를 담는다 | GAMMJ |
| 09-02 | [#80](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/80) | feat: 스토어와 캔버스가 활성 페이지 개념을 갖는다 | GAMMJ |
| 09-02 | [#84](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/84) | feat : 레이어 트리를 스토어에 연결 | dogui1018 |
| 09-04 | [#77](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/77) | feat(editor): 홈(진입) 화면 추가 — 화면 목록(1개) + 새 화면 | wook3964 |
| 09-04 | [#85](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/85) | feat: 페이지 이름·해상도 편집과 캔버스 채우기 모드 | GAMMJ |
| 09-04 | [#83](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/83) | feat: 스키마에 Button/Input 노드 타입과 Grid 레이아웃 추가 | wook3964 |
| 09-04 | [#68](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/68) | feat: 캔버스 하단 툴바 도구 동작 구현 | SunMyunC |
| 09-07 | [#88](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/88) | feat: 스타일 표현력 확장 1단계 — Shadow · Opacity · Blur · Stroke 정렬 | GAMMJ |
| 09-08 | [#79](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/79) | feat: Command 타입 5종 + 순수 적용기 + undo/redo 스택 도입 | wook3964 |
| 09-08 | [#81](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/81) | feat: Ticket 스키마 v0.1 — IR을 컴포넌트 구현 단위로 분해하는 순수 함수 | wook3964 |
| 09-09 | [#98](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/98) | docs: 07 구현 현황을 develop 실제 코드로 재실측 — 홈 화면·레이어 트리·도구 모음·집계 8건 정정 | Yumesa2025 |
| 09-09 | [#97](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/97) | docs: 05-schema를 정본 스키마 기준으로 갱신 — v0.1/v0.2 병행 상태와 노드 5종 반영 | Yumesa2025 |
| 09-09 | [#96](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/96) | fix: 선택 표시를 노드 outline에서 캔버스 오버레이로 분리 | GAMMJ |
| 09-09 | [#100](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/100) | feat: 레이어 트리에 페이지 폴더 추가 | dogui1018 |
| 09-09 | [#99](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/99) | feat(canvas): 리사이즈 핸들로 선택 노드 크기를 조절한다 | wook3964 |
| 09-09 | [#103](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/103) | fix: 아무것도 그리지 않는 테두리를 스펙에 남기지 않는다 | GAMMJ |
| 09-11 | [#106](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/106) | feat: visual-spec CLI 골격 — bin 필드와 init 명령 ([#42](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/42)) | wook3964 |
| 09-11 | [#102](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/102) | refactor(editor): setNodeField가 Command Engine을 거치도록 한다 ([#40](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/40)) | wook3964 |
| 09-11 | [#109](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/109) | feat: 레이어 트리에서 노드 삭제 기능 추가 | dogui1018 |
| 09-11 | [#107](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/107) | feat: visual-spec CLI에 skills 명령 추가 — 스킬 5종을 대상 프로젝트에 설치한다 ([#104](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/104)) | wook3964 |
| 09-11 | [#111](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/111) | feat: 속성 패널을 능력 단위로 분리해 image·button·input 편집을 연다 | GAMMJ |
| 09-11 | [#108](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/108) | feat: visual-spec CLI를 인자 없이 실행하면 GUI를 띄운다 ([#105](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/105)) | wook3964 |
| 09-11 | [#116](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/116) | feat: 레이어 트리에서 드래그로 순서 변경 | dogui1018 |
| 09-11 | [#117](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/117) | fix(cli): Windows에서 npx visual-spec이 spawn EINVAL로 죽는 것을 고친다 ([#115](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/115)) | Yumesa2025 |
| 09-11 | [#113](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/113) | fix: package.json의 main이 없는 파일을 가리키던 것을 정리 — 필드 제거 ([#45](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/45)) | wook3964 |
| 09-11 | [#119](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/119) | docs: fill의 교차축 의미를 06-schema-freeze에 결정으로 옮긴다 ([#46](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/46)) | wook3964 |
| 09-11 | [#120](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/120) | feat: 레이어 트리에 되돌리기(Undo/Redo) 버튼 추가 | dogui1018 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 09-01 | [#65](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/65) | feat: Visual Spec 스키마에 ImageNode 추가 (v0.1 동결 해제) | dogui1018 |
| 09-01 | [#66](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/66) | feat : File 메뉴 Import 연결 (이미지 파일 가져오기) | dogui1018 |
| 09-01 | [#70](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/70) | fix: image 노드 지원 스킬 반영 — visual-spec-authoring·visual-spec-to-react가 ImageNode를 모른다 | wook3964 |
| 09-02 | [#72](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/72) | feat: 홈(진입) 화면 구현 — 화면 목록 + 빈 상태 | wook3964 |
| 09-02 | [#73](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/73) | feat: Command Engine 도입 — GUI/자연어 공용 편집 명령 | wook3964 |
| 09-02 | [#74](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/74) | feat: Ticket 스키마 v0.1 정의 — IR을 컴포넌트 구현 단위로 표현한다 | wook3964 |
| 09-02 | [#75](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/75) | feat: 스키마에 Button/Input 노드 타입과 Grid 레이아웃 추가 (v0.1 미조정 항목 해소) | wook3964 |
| 09-02 | [#78](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/78) | feat: 스타일 표현력 확장 — Shadow · Opacity · Stroke 정렬 · 모서리별 반경 · 다중 채우기 (동결 해제 필요) | GAMMJ |
| 09-02 | [#82](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/82) | feat : 레이어 트리를 스토어에 연결 (노드 목록 렌더링 + 선택 동기화) | dogui1018 |
| 09-04 | [#86](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/86) | feat: 아트보드를 세로로 자라는 문서로 만든다 — 스크롤되는 페이지를 만들 수 없다 | GAMMJ |
| 09-04 | [#87](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/87) | feat: 레이어 트리에 페이지 폴더 UI 추가 | dogui1018 |
| 09-04 | [#89](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/89) | refactor: 아무것도 그리지 않는 border 객체가 스펙에 남는다 — 효과 필드와 기준이 다르다 | GAMMJ |
| 09-08 | [#90](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/90) | bug: 선택 테두리가 노드의 불투명도·블러를 함께 받는다 — 반투명 노드를 고르면 선택 표시가 흐려진다 | GAMMJ |
| 09-08 | [#91](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/91) | feat: GUI로 만든 노드를 지울 수 없다 — removeNode·Delete 키가 없고 도구 커서 힌트도 없다 | GAMMJ |
| 09-08 | [#92](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/92) | refactor: 속성 패널 섹션이 노드 타입에 묶여 있다 — image·button·input은 아직 편집할 수 없다 | GAMMJ |
| 09-08 | [#93](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/93) | feat: 캔버스에서 리사이즈 핸들로 노드 크기 조절 | wook3964 |
| 09-08 | [#94](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/94) | refactor: 정본 스키마의 src 설명과 Import가 실제로 넣는 값이 다르다 — 검증은 통과한다 | Yumesa2025 |
| 09-08 | [#95](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/95) | refactor: measureStore·viewStore 주석이 editorStore 계약을 아직 "4-멤버"라고 부른다 — 실제로는 11개다 | Yumesa2025 |
| 09-09 | [#101](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/101) | feat: 레이어 트리에서 노드(레이어) 삭제 기능 추가 | dogui1018 |
| 09-10 | [#104](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/104) | feat: npx visual-spec skills — 스킬 5종을 대상 프로젝트에 설치한다 | wook3964 |
| 09-10 | [#105](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/105) | feat: 인자 없는 npx visual-spec — GUI를 띄운다 | wook3964 |
| 09-11 | [#110](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/110) | feat: 레이어 트리에서 드래그로 순서 변경 | dogui1018 |
| 09-11 | [#112](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/112) | chore: npm 공개 배포로 전환할지 정한다 — private: true 가 npx visual-spec 을 막고 있다 | Yumesa2025 |
| 09-11 | [#115](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/115) | bug: npx visual-spec (인자 없는 GUI 실행)이 Windows에서 spawn EINVAL 로 죽는다 — CI가 ubuntu라 안 잡힌다 | Yumesa2025 |
| 09-11 | [#118](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/118) | feat: 레이어 트리에 되돌리기(Undo/Redo) 버튼 추가 | dogui1018 |

<a id="4-hands-on-editor"></a>

## 4. 손에 붙는 편집기, 굳어지는 계약

09-12 ~ 09-26 · 피그마에 가까운 조작감을 다듬고, GUI를 작업공간에 연결하고, Command 계약을 동결했다.

- 병합 PR 29건 · 커밋 90개 · 새 이슈 27건
- PR 작성: GAMMJ 9 · wook3964 7 · Yumesa2025 7 · dogui1018 6

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 09-15 | [#124](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/124) | feat: 레이어 트리 드래그로 다른 프레임에 재부모화하기 | dogui1018 |
| 09-15 | [#122](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/122) | fix(editor): 이어지는 필드 편집을 하나의 Undo 단계로 합친다 ([#121](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/121)) | wook3964 |
| 09-15 | [#126](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/126) | refactor: 채우기 모드(View ▸ Fill Viewport)를 걷어낸다 | GAMMJ |
| 09-15 | [#130](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/130) | feat(editor): 아트보드 세로 성장과 캔버스 기본 동작 ([#86](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/86), [#91](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/91)) | GAMMJ |
| 09-15 | [#135](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/135) | feat(editor): 레이어 트리에서 레이어 이름 바꾸기 | dogui1018 |
| 09-15 | [#134](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/134) | feat(editor): 새로고침해도 작업 중이던 프로젝트가 사라지지 않는다 ([#128](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/128)) | wook3964 |
| 09-15 | [#137](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/137) | feat(editor): 도구 키보드 단축키와 스페이스 임시 팬 ([#136](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/136)) | GAMMJ |
| 09-16 | [#139](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/139) | feat(editor): 브라우저 기본 우클릭 메뉴를 막는다 ([#138](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/138)) | GAMMJ |
| 09-18 | [#141](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/141) | feat(editor): TextField 연속 타이핑을 undo 한 단계로 합친다 ([#132](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/132)) | Yumesa2025 |
| 09-18 | [#140](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/140) | docs: ImageNode.src 설명과 스토어 주석을 실제 코드에 맞춘다 ([#94](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/94), [#95](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/95)) | Yumesa2025 |
| 09-18 | [#142](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/142) | feat(editor): insertNode·addPage·removePage를 Undo/Redo에 태운다 ([#131](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/131)) | Yumesa2025 |
| 09-18 | [#143](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/143) | docs: 이슈 [#131](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/131)·[#132](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/132) 머지를 문서에 반영하고 테스트 집계를 전수 재실측한다 | Yumesa2025 |
| 09-19 | [#144](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/144) | docs: 자연어 변환 설계안 (docs/08-natural-language.md) | Yumesa2025 |
| 09-19 | [#145](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/145) | feat: GUI를 .visual-spec/ 워크스페이스에 연결한다 ([#133](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/133), [#112](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/112)) | Yumesa2025 |
| 09-19 | [#147](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/147) | fix: updateScreen·updateNode가 스키마에 없는 경로를 거부한다 ([#146](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/146)) | Yumesa2025 |
| 09-19 | [#163](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/163) | feat(editor): 그리드 레이아웃을 상세 패널에서 만들 수 있게 한다 ([#160](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/160)) | GAMMJ |
| 09-19 | [#164](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/164) | feat(editor): 캔버스 조작을 피그마에 맞춘다 — 커서 기준 줌·중클릭 팬·보기 단축키 ([#161](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/161)) | GAMMJ |
| 09-19 | [#165](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/165) | feat(editor): 캔버스에 간격·거리 표시와 hover 미리보기를 넣는다 ([#162](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/162)) | GAMMJ |
| 09-20 | [#166](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/166) | refactor(editor): Canvas.tsx 를 네 모듈로 가른다 ([#148](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/148)) | GAMMJ |
| 09-20 | [#167](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/167) | feat: 여러 노드 필드 변경을 하나의 트랜잭션으로 처리 ([#149](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/149)) | wook3964 |
| 09-20 | [#168](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/168) | chore: Command 스키마를 v0.1로 고정 ([#153](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/153)) | wook3964 |
| 09-20 | [#169](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/169) | feat: 구현 티켓을 GUI에서 생성하고 표시 ([#156](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/156)) | wook3964 |
| 09-20 | [#170](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/170) | fix: 메뉴바에 현재 문서 제목을 표시 ([#158](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/158)) | wook3964 |
| 09-20 | [#171](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/171) | chore: 브랜드 파비콘을 추가 ([#159](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/159)) | wook3964 |
| 09-20 | [#172](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/172) | feat: 자식 크기를 한 번에 균등하게 맞추는 버튼을 Layout 섹션에 넣는다 ([#150](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/150)) | dogui1018 |
| 09-21 | [#173](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/173) | feat: 캔버스 조작 단축키 4종을 추가한다 — 줌·복제·진입·형제이동 ([#151](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/151)) | dogui1018 |
| 09-21 | [#174](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/174) | feat(editor): 더블클릭 진입 · Tab 형제 이동 · Ctrl+D 복제 · Shift+2 ([#151](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/151)) | GAMMJ |
| 09-21 | [#175](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/175) | feat: 캔버스에 컨텍스트 메뉴를 붙인다 ([#152](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/152)) | dogui1018 |
| 09-21 | [#176](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/176) | feat: 신뢰할 수 없는 Command 배열용 G2·G3 관문과 전부-또는-전무 커밋 추가 ([#154](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/154)) | dogui1018 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 09-13 | [#121](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/121) | bug: Undo가 타이핑 도중의 중간 글자만 되돌린다 — history가 키 입력마다 쌓인다 | wook3964 |
| 09-14 | [#123](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/123) | feat: 레이어 트리 드래그로 다른 프레임에 재부모화하기 | dogui1018 |
| 09-15 | [#125](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/125) | refactor: 채우기 모드(View ▸ Fill Viewport)를 걷어낸다 — 캔버스 기능들과 계속 충돌한다 | GAMMJ |
| 09-15 | [#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) | feat: 배경에 그라디언트와 다중 채우기를 넣는다 — (동결 해제 필요, 후순위) | GAMMJ |
| 09-15 | [#128](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/128) | feat: 새로고침하면 작업 중이던 프로젝트가 사라진다 — 지속성이 전혀 없다 | wook3964 |
| 09-15 | [#129](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/129) | feat: 레이어 트리에서 레이어 이름 바꾸기 | dogui1018 |
| 09-15 | [#131](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/131) | fix: 노드 생성과 페이지 추가·삭제가 Undo에 안 쌓인다 — 페이지를 지우면 되돌릴 수 없다 | Yumesa2025 |
| 09-15 | [#132](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/132) | fix: 문자열 입력칸은 Undo 합치기에서 빠져 있다 — 이름·텍스트가 한 글자씩 되돌아간다 | Yumesa2025 |
| 09-15 | [#133](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/133) | feat: .visual-spec/ 워크스페이스를 GUI에 연결한다 — 폴더는 만들지만 아무도 읽고 쓰지 않는다 | Yumesa2025 |
| 09-15 | [#136](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/136) | feat: 도구를 키보드로 바꿀 수 없다 — V/H/F/T 단축키와 스페이스 임시 팬이 없다 | GAMMJ |
| 09-15 | [#138](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/138) | feat: 앱 전역에서 브라우저 기본 우클릭 메뉴를 막는다 — 캔버스 커스텀 메뉴의 사전 작업 | GAMMJ |
| 09-18 | [#146](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/146) | fix: applyUpdateScreen이 경로를 검사하지 않아 오타가 no-op이 아니라 IR 오염이 된다 | Yumesa2025 |
| 09-19 | [#148](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/148) | refactor: Canvas.tsx 가 1538줄이다 — 소프트 상한 800의 두 배 | GAMMJ |
| 09-19 | [#149](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/149) | feat: editorStore 에 여러 노드를 한 Undo 단계로 쓰는 수단이 없다 | GAMMJ |
| 09-19 | [#150](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/150) | feat: 형제 노드의 크기를 한 번에 맞출 수 없다 — 라벨과 밸류의 W/H 가 제각각이다 | GAMMJ |
| 09-19 | [#151](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/151) | feat: 남은 피그마 캔버스 편의기능 — 더블클릭 진입 · Tab 형제 이동 · Ctrl+D 복제 · Shift+2 | GAMMJ |
| 09-19 | [#152](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/152) | feat: 캔버스 우클릭 메뉴를 만든다 — [#138](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/138) 에서 기본 메뉴를 막아 두기만 했다 | GAMMJ |
| 09-19 | [#153](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/153) | chore: Command 스키마를 v0.1로 고정한다 — TypeScript 타입뿐이라 런타임에 아무것도 검사하지 않는다 | Yumesa2025 |
| 09-19 | [#154](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/154) | feat: 자연어가 낸 Command를 검증하고 한 단계로 커밋하는 파이프라인 — 지금 편집 경로엔 검증이 없다 | Yumesa2025 |
| 09-19 | [#155](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/155) | feat: 자연어 부분 수정 — MVP 생성 3종 중 자연어 2종이 코드 0줄이다 | Yumesa2025 |
| 09-19 | [#156](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/156) | feat: 코드 생성을 GUI에서 시작할 수 없다 — compileTickets를 부르는 곳이 없다 | Yumesa2025 |
| 09-19 | [#157](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/157) | feat: Export·검증 — 지금 Export는 스펙 JSON이고 React 코드를 내보내는 경로가 없다 | Yumesa2025 |
| 09-19 | [#158](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/158) | fix: 상단 타이틀이 하드코딩돼 있다 — 어느 프로젝트를 열든 'Untitled Project — DashboardPage.gui'다 | Yumesa2025 |
| 09-19 | [#159](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/159) | chore: favicon이 없어 GUI를 띄울 때마다 콘솔에 404가 남는다 | Yumesa2025 |
| 09-19 | [#160](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/160) | feat: 그리드 레이아웃을 GUI로 만들 수 없다 — 스키마와 렌더는 있는데 입력 수단만 없다 | GAMMJ |
| 09-19 | [#161](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/161) | feat: 캔버스 조작이 피그마와 달라 불편하다 — 줌이 커서를 안 따라가고 중클릭 팬·보기 단축키가 없다 | GAMMJ |
| 09-19 | [#162](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/162) | feat: 캔버스에서 간격·거리를 볼 수 없다 — 패널을 봐야 하고, 무엇이 잡힐지도 클릭해야 안다 | GAMMJ |

<a id="5-words-to-screens"></a>

## 5. 말이 화면이 되다 — 자연어와 코드 생성

09-27 ~ 10-02 · 자연어 수정·생성, 코드 ZIP 내보내기, 에이전트 실행 왕복이 이어지며 처음부터 끝까지의 길이 생겼다.

- 병합 PR 14건 · 커밋 33개 · 새 이슈 14건
- PR 작성: dogui1018 5 · wook3964 4 · GAMMJ 3 · Yumesa2025 2

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 09-27 | [#177](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/177) | feat: 자연어 부분 수정 1차 — 에이전트 경유 파일 교환 경로와 입력창 ([#155](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/155)) | Yumesa2025 |
| 09-27 | [#178](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/178) | feat: 생성된 React 코드를 검증해 결과 폴더 ZIP으로 내보내기 ([#157](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/157)) | Yumesa2025 |
| 09-28 | [#191](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/191) | feat: createNode를 노드 5종 + 부분 덮어쓰기로 확장 ([#182](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/182)) | wook3964 |
| 09-28 | [#192](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/192) | feat: 자연어 화면 생성 — 빈 화면 생성 경로가 이미 있었음을 증명 ([#183](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/183)) | wook3964 |
| 09-29 | [#197](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/197) | feat: 구현 티켓 패널에 에이전트 실행 왕복 연결 ([#184](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/184)) | dogui1018 |
| 09-29 | [#198](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/198) | fix: 새로고침 후 Save가 다른 파일을 만드는 문제 수정 ([#185](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/185)) | dogui1018 |
| 09-29 | [#195](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/195) | feat: CreateNodeCommand에 삽입 위치(index) 추가 ([#193](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/193)) | wook3964 |
| 09-29 | [#199](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/199) | fix: 홈 화면이 실제 파일 목록을 읽도록 배선 ([#186](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/186)) | dogui1018 |
| 09-29 | [#196](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/196) | feat: 자연어 요청에 응답하는 에이전트용 스킬 문서 추가 ([#194](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/194)) | wook3964 |
| 09-29 | [#200](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/200) | chore: Ticket 스키마를 v0.1로 고정 ([#179](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/179)) | GAMMJ |
| 09-30 | [#201](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/201) | docs: Visual Spec 스키마 문서를 정본과 맞춘다 ([#180](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/180)) | GAMMJ |
| 10-01 | [#202](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/202) | docs: 반응형 IR 설계와 후속 범위를 결정한다 ([#181](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/181)) | GAMMJ |
| 10-01 | [#203](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/203) | chore: docs/09 번호 충돌 해소 — 09-shortcuts.md를 10로 옮김 ([#190](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/190)) | dogui1018 |
| 10-01 | [#204](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/204) | chore: CLI가 쓰이지 않는 preview/ 폴더를 더 이상 만들지 않게 함 ([#189](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/189)) | dogui1018 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 09-27 | [#179](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/179) | chore: Ticket 스키마만 v0.1 동결을 못 거쳤다 — JSON Schema 정본이 없어 런타임에 아무것도 검사하지 않는다 | Yumesa2025 |
| 09-27 | [#180](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/180) | docs: 05-schema.md가 정본 스키마와 어긋난다 — 그리고 07의 지적 자체도 낡았다 | Yumesa2025 |
| 09-27 | [#181](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/181) | feat: 반응형(데스크톱·모바일) IR 설계 결정 — 02는 MVP 포함인데 스키마는 제외했고 설계 초안이 아예 없다 | Yumesa2025 |
| 09-27 | [#182](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/182) | feat: 기본값 채우기 계층 — createNode가 frame·text만 만들어 자연어 생성이 53칸을 다 받아야 한다 | Yumesa2025 |
| 09-27 | [#183](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/183) | feat: 자연어 화면 생성 — 생성 3종 중 마지막 하나가 비어 있다 | Yumesa2025 |
| 09-27 | [#184](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/184) | feat: 티켓 실행 B안 — [#156](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/156)이 남긴 A안에는 에이전트 왕복이 없다 | Yumesa2025 |
| 09-27 | [#185](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/185) | fix: 새로고침 뒤 Save가 다른 파일에 쓰인다 — documentStore.fileName이 영속화되지 않아 PR [#145](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/145)가 고친 버그가 재발한다 | Yumesa2025 |
| 09-27 | [#186](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/186) | feat: 홈 화면이 프로젝트를 항상 1개로 고정한다 — specs/를 읽으면 0개·여러 개가 이미 가능하다 | Yumesa2025 |
| 09-27 | [#187](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/187) | feat: 캔버스에서 드래그로 형제 순서를 바꿀 수 없다 — 레이어 트리와 우클릭 메뉴로만 된다 | Yumesa2025 |
| 09-27 | [#188](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/188) | chore: Export한 결과 폴더가 실제 프로젝트에서 tsc를 통과하는지 아무도 확인한 적이 없다 | Yumesa2025 |
| 09-27 | [#189](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/189) | chore: CLI가 MVP에서 제외된 preview/ 폴더를 계속 만든다 — 미들웨어는 안 만든다 | Yumesa2025 |
| 09-27 | [#190](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/190) | chore: docs에 09가 둘이다 — 같은 날 79초 차이로 머지된 두 PR이 같은 번호를 집었다 | Yumesa2025 |
| 09-28 | [#193](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/193) | feat: CreateNodeCommand에 삽입 위치(index) 추가 | wook3964 |
| 09-28 | [#194](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/194) | feat: 자연어 요청에 응답하는 에이전트용 스킬 문서 | wook3964 |

<a id="6-busiest-day"></a>

## 6. 몰아친 하루 — 배경과 반응형

10-03 ~ 10-04 · 캔버스 드래그, 채우기 겹 배경(v0.3), 반응형 스키마와 그룹이 이어졌다.

- 병합 PR 24건 · 커밋 130개 · 새 이슈 22건
- PR 작성: Yumesa2025 23 · dogui1018 1

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 10-04 | [#205](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/205) | docs: Export 결과물이 실제 프로젝트에서 컴파일되는지 1회 수동 QA ([#188](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/188)) | dogui1018 |
| 10-04 | [#206](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/206) | feat: 캔버스에서 노드를 끌어 형제 순서·부모를 바꾼다 ([#187](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/187)) | Yumesa2025 |
| 10-04 | [#208](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/208) | fix: 리사이즈 한 번이 Undo 한 단계가 되게 한다 ([#207](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/207)) | Yumesa2025 |
| 10-04 | [#210](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/210) | fix: 값이 그대로인 입력은 커밋하지 않아 빈 Undo 단계를 막는다 ([#209](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/209)) | Yumesa2025 |
| 10-04 | [#211](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/211) | docs: 배경 채우기(그라디언트·다중) 설계를 결정한다 ([#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127)) | Yumesa2025 |
| 10-04 | [#212](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/212) | feat: 배경을 채우기 겹 배열(Fill[])로, 문서 버전을 0.3으로 전환한다 ([#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) 1단계) | Yumesa2025 |
| 10-04 | [#213](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/213) | feat: 배경 linear 그라디언트와 여러 겹을 캔버스에 그린다 ([#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) 2단계) | Yumesa2025 |
| 10-04 | [#214](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/214) | feat: 배경 섹션을 채우기 겹 목록 편집기로 넓힌다 ([#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) 3단계) | Yumesa2025 |
| 10-04 | [#215](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/215) | docs: 스킬과 08에 그라디언트·여러 겹 배경 작성·편집·코드 생성을 가르친다 ([#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) 4단계) | Yumesa2025 |
| 10-04 | [#216](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/216) | feat: 그라디언트 예제를 더하고 [#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) 문서를 마무리한다 ([#127](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/127) 5단계) | Yumesa2025 |
| 10-04 | [#237](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/237) | feat: GUI 티켓 응답 스킬과 프로토콜 예제 검증 추가 ([#217](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/217)) | Yumesa2025 |
| 10-04 | [#238](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/238) | docs: 현재 구현 현황과 검증 기준 정정 ([#233](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/233)) | Yumesa2025 |
| 10-04 | [#239](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/239) | fix: 로그인 예제에 입력창과 버튼 추가 ([#218](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/218)) | Yumesa2025 |
| 10-04 | [#240](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/240) | fix: 빈 Undo·Export 무알림·무효 색상 입력 개선 ([#228](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/228) [#230](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/230) [#231](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/231)) | Yumesa2025 |
| 10-04 | [#241](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/241) | docs: 통합 사용 가이드와 실제·수동 QA 결과 기록 ([#220](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/220) [#221](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/221)) | Yumesa2025 |
| 10-04 | [#242](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/242) | docs: 현재 로그인 예제 재현과 병합 기준 정정 | Yumesa2025 |
| 10-04 | [#243](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/243) | fix: 티켓의 중복 컴포넌트 이름을 유효한 식별자로 생성 | Yumesa2025 |
| 10-04 | [#244](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/244) | feat: 홈 프로젝트를 최근 수정순으로 정렬 ([#227](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/227) 일부) | Yumesa2025 |
| 10-04 | [#249](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/249) | feat: 자연어 배경 겹 삭제·재정렬 적용 전 확인 ([#234](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/234)) | Yumesa2025 |
| 10-04 | [#246](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/246) | fix: GUI 시작 시 스킬 사본 차이와 갱신 명령 안내 ([#229](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/229)) | Yumesa2025 |
| 10-04 | [#250](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/250) | feat: 단일 노드 그룹 만들기와 해제 ([#225](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/225)) | Yumesa2025 |
| 10-04 | [#251](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/251) | fix: 명시적인 숫자 컴포넌트 이름을 접미사보다 먼저 예약 | Yumesa2025 |
| 10-04 | [#245](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/245) | feat: 반응형 선택 스키마와 누적 override 검증 ([#222](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/222)) | Yumesa2025 |
| 10-04 | [#248](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/248) | feat: 반응형 React 코드 생성 지침과 경계값 검증 ([#224](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/224)) | Yumesa2025 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 10-04 | [#207](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/207) | fix: 리사이즈 한 번을 Ctrl+Z 한 번에 되돌릴 수 없다 — 마우스 이동마다 Undo 단계가 쌓인다 | Yumesa2025 |
| 10-04 | [#209](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/209) | fix: 숫자·색상 칸에서 값이 그대로인 입력이 직전 Undo 단계를 덮어쓴다 — useDraftInput에 TextField의 가드가 없다 | Yumesa2025 |
| 10-04 | [#217](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/217) | feat: 티켓 응답 스킬의 실제 AI 처리 완료 검증 | Yumesa2025 |
| 10-04 | [#218](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/218) | fix: 로그인 예제에 버튼이 없어 MVP 수직 슬라이스를 재현할 수 없다 | Yumesa2025 |
| 10-04 | [#219](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/219) | docs: GUI가 Claude Code/Codex를 직접 실행할지 안내만 할지 정해야 한다 — 02와 구현이 어긋나 있다 | Yumesa2025 |
| 10-04 | [#220](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/220) | chore: 실제 AI를 포함한 MVP 전체 흐름 검증 | Yumesa2025 |
| 10-04 | [#221](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/221) | docs: README '현재 구현 상태'가 골격 단계에 멈춰 있다 — 처음부터 끝까지 쓰는 가이드도 없다 | Yumesa2025 |
| 10-04 | [#222](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/222) | feat: 반응형 정본 스키마가 없다 — 설계([#181](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/181))만 끝났다 (12 후속 1) | Yumesa2025 |
| 10-04 | [#223](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/223) | feat: 반응형을 GUI에서 다룰 수 없다 — breakpoint 선택·override 편집 (12 후속 2) | Yumesa2025 |
| 10-04 | [#224](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/224) | feat: 코드 생성이 반응형 블록을 모른다 (12 후속 3) | Yumesa2025 |
| 10-04 | [#225](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/225) | feat: Composition의 Group/Ungroup이 없다 — 04가 MVP에 넣었다 | Yumesa2025 |
| 10-04 | [#226](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/226) | feat: GUI 직접 조작으로 button·input을 만들 수단이 없다 — 02와 04가 어긋난다 | Yumesa2025 |
| 10-04 | [#227](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/227) | feat: 홈 목록이 최근 수정순이 아니고 카드 액션이 없다 — 목록에 mtime이 없다 | Yumesa2025 |
| 10-04 | [#228](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/228) | fix: 이미 선택된 세그먼트를 다시 누르면 빈 Undo 단계가 쌓인다 | Yumesa2025 |
| 10-04 | [#229](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/229) | fix: 0.3 전환 후 사용자 프로젝트의 옛 스킬 사본이 조용히 깨진다 — skills 명령이 버전을 확인하지 않는다 | Yumesa2025 |
| 10-04 | [#230](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/230) | fix: File ▸ Export가 검증에 실패해도 아무것도 표시하지 않는다 | Yumesa2025 |
| 10-04 | [#231](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/231) | fix: 무효 hex 상태에서 불투명도 입력이 적용되지 않는 이유를 알 수 없다 | Yumesa2025 |
| 10-04 | [#232](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/232) | fix: 탭을 여러 개 열면 나중에 저장한 탭이 앞 탭의 변경을 덮어쓴다 | Yumesa2025 |
| 10-04 | [#233](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/233) | docs: 07·04에 지금 사실과 다른 서술이 남아 있다 — 테스트 집계도 낡았다 | Yumesa2025 |
| 10-04 | [#234](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/234) | feat: 자연어 배경 편집에서 겹 순서가 뒤집히거나 기존 겹이 빠져도 아무 경고가 없다 | Yumesa2025 |
| 10-04 | [#235](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/235) | feat: 배경 image 채우기가 없다 — '사진 위 반투명 그라디언트'를 아직 표현할 수 없다 | Yumesa2025 |
| 10-04 | [#236](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/236) | refactor: Canvas.tsx가 1023줄이다 — '임시 스탠드인'을 정식으로 둘지 교체할지 정해야 한다 | Yumesa2025 |

<a id="7-first-run"></a>

## 7. 첫 완주 — 로그인 예제의 전체 흐름 검증

10-05 ~ 10-05 · 로그인 예제를 실제 Codex 3웨이브·4티켓으로 생성하고, Export한 코드를 독립 앱에서 검증했다.

- 병합 PR 13건 · 커밋 37개 · 새 이슈 29건
- PR 작성: Yumesa2025 13

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 10-05 | [#252](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/252) | fix: 반응형 코드 생성 정렬·Tailwind 호환성·설치 문서 참조 수정 | Yumesa2025 |
| 10-05 | [#253](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/253) | docs: 수동 에이전트 실행 정책과 수용 기준 확정 ([#219](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/219)) | Yumesa2025 |
| 10-05 | [#254](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/254) | feat: 이미지 배경 스키마와 호환 계약 추가 ([#235](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/235)) | Yumesa2025 |
| 10-05 | [#255](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/255) | refactor: DOM Canvas를 렌더링·선택·드래그 역할로 분리 ([#236](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/236)) | Yumesa2025 |
| 10-05 | [#247](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/247) | feat: 반응형 미리보기와 상속 override 편집 ([#223](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/223)) | Yumesa2025 |
| 10-05 | [#256](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/256) | feat: 삽입 메뉴에서 Button과 Input 직접 생성 ([#226](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/226)) | Yumesa2025 |
| 10-05 | [#257](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/257) | feat: 이미지 배경 편집·렌더·자산 Export 연결 ([#235](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/235)) | Yumesa2025 |
| 10-05 | [#258](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/258) | fix: 다중 탭 저장 충돌을 중지하고 초안 보존 ([#232](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/232)) | Yumesa2025 |
| 10-05 | [#259](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/259) | feat: 홈 프로젝트 이름과 저장 파일명을 안전하게 동기화 ([#227](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/227)) | Yumesa2025 |
| 10-05 | [#260](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/260) | docs: MVP 병합 상태와 실제 AI 재검증 결과 정리 | Yumesa2025 |
| 10-05 | [#261](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/261) | docs: 실제 Codex MVP 전체 흐름 검증 완료 | Yumesa2025 |
| 10-05 | [#263](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/263) | docs: [#237](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/237)~[#261](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/261) 병합 후 구현 현황·낡은 상태 문장·README 목차 최신화 | Yumesa2025 |
| 10-05 | [#264](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/264) | docs: 스키마 버전 표기·스토어 편집 필드 표·홈 현재 상태 갱신 ([#263](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/263) 보류분) | Yumesa2025 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 10-05 | [#262](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/262) | fix: Windows에서 pnpm test 7건이 실패한다 — .gitattributes가 없어 CRLF로 받고, 스킬 경고 경로에 \와 /가 섞인다 | Yumesa2025 |
| 10-05 | [#265](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/265) | feat: 화면 사이의 관계를 저장할 자리가 없다 — 모달·화면 이동·재사용 위젯이 IR에 남지 않는다 (epic) | Yumesa2025 |
| 10-05 | [#267](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/267) | fix: 문서 전환 전 미저장 초안을 보존한다 | Yumesa2025 |
| 10-05 | [#268](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/268) | fix: Grid 코드 매핑의 열 정의와 교차축 정렬을 GUI와 맞춘다 | Yumesa2025 |
| 10-05 | [#269](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/269) | fix: 코드 생성의 크기·줄바꿈 규칙을 Canvas와 맞춘다 | Yumesa2025 |
| 10-05 | [#270](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/270) | fix: Export 이미지 참조를 번들러에서 해석되도록 생성한다 | Yumesa2025 |
| 10-05 | [#271](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/271) | fix: 변경된 스펙의 낡은 티켓 실행을 차단한다 | Yumesa2025 |
| 10-05 | [#272](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/272) | fix: Export 결과를 검사한 문서와 페이지에 연결한다 | Yumesa2025 |
| 10-05 | [#273](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/273) | fix: 다중 탭 AI 요청의 파일 덮어쓰기 경합을 막는다 | Yumesa2025 |
| 10-05 | [#274](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/274) | fix: 자산을 읽지 못한 Export를 성공으로 안내하지 않는다 | Yumesa2025 |
| 10-05 | [#275](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/275) | fix: 숨겨진 Canvas 툴바를 키보드 탐색에서 제외한다 | Yumesa2025 |
| 10-05 | [#276](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/276) | style: 활성 안내 텍스트의 대비를 확보한다 | Yumesa2025 |
| 10-05 | [#277](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/277) | feat: 설치 가능한 GUI 런타임 패키지를 구성한다 | Yumesa2025 |
| 10-05 | [#278](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/278) | feat: Claude Code/Codex 스킬 발견과 로컬 계약 제공을 완성한다 | Yumesa2025 |
| 10-05 | [#279](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/279) | feat: 외부 에이전트 대화를 열린 GUI 편집으로 연결한다 | Yumesa2025 |
| 10-05 | [#280](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/280) | feat: GUI와 생성 앱의 화면 크기·폰트·배치 통합 계약을 맞춘다 | Yumesa2025 |
| 10-05 | [#281](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/281) | feat: 생성 파일의 프로젝트 소유권과 스펙 버전을 기록한다 | Yumesa2025 |
| 10-05 | [#282](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/282) | feat: 재생성 전 수동 코드 변경을 감지하고 보존한다 | Yumesa2025 |
| 10-05 | [#283](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/283) | style: 에이전트 전달과 코드 생성·Export 단계를 안내한다 | Yumesa2025 |
| 10-05 | [#284](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/284) | feat: 수동 에이전트 요청 상태와 재시도·취소를 명확히 한다 | Yumesa2025 |
| 10-05 | [#285](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/285) | docs: 실행 앱 범위와 입력·상태·접근성 스펙을 합의한다 | Yumesa2025 |
| 10-05 | [#286](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/286) | style: 처음 시작하는 사용자와 자연어 초안 경로를 설계한다 | Yumesa2025 |
| 10-05 | [#287](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/287) | style: 작은 창에서 패널과 Canvas 공간을 확보한다 | Yumesa2025 |
| 10-05 | [#288](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/288) | style: 프로젝트 관리와 파일 선택·손상 파일 안내를 정리한다 | Yumesa2025 |
| 10-05 | [#289](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/289) | style: 저장·선택·반응형 편집 상태와 용어를 통일한다 | Yumesa2025 |
| 10-05 | [#290](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/290) | style: 사용자 화면의 공용 스타일·폰트·상태 범위를 정한다 | Yumesa2025 |
| 10-05 | [#291](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/291) | chore: CI에 lint·production build·브라우저·설치 경로 검사를 추가한다 | Yumesa2025 |
| 10-05 | [#292](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/292) | test: 실제 사용자 흐름과 AI 시각 비교 회귀를 고정한다 | Yumesa2025 |
| 10-05 | [#293](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/293) | chore: 프로젝트·노드·이미지 규모별 성능을 실측한다 | Yumesa2025 |

<a id="8-polishing"></a>

## 8. 제품으로 다듬다

10-06 ~ 10-08 수집 시점 · 생성 코드와 캔버스의 정합성, 편집 안정성, 접근성, 설치 가능한 런타임을 다듬고 있다.

- 병합 PR 21건 · 커밋 125개 · 새 이슈 10건
- PR 작성: wook3964 8 · GAMMJ 7 · dogui1018 5 · Yumesa2025 1

### 병합 PR

| 병합일 | PR | 내용 | 작성 |
|---|---|---|---|
| 10-06 | [#266](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/266) | docs: 이슈·PR 제목 형식과 라벨 1개 규칙을 정한다 | Yumesa2025 |
| 10-06 | [#295](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/295) | fix: 변경된 스펙의 낡은 티켓 실행을 차단한다 ([#271](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/271)) | wook3964 |
| 10-06 | [#294](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/294) | fix: 문서 전환 전 미저장 초안을 보존한다 ([#267](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/267)) | wook3964 |
| 10-06 | [#296](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/296) | fix: 다중 탭 AI 요청의 파일 덮어쓰기 경합을 막는다 ([#273](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/273)) | wook3964 |
| 10-06 | [#298](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/298) | feat: Claude Code·Codex 스킬 발견과 설치 버전의 로컬 계약을 제공한다 ([#278](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/278)) | wook3964 |
| 10-06 | [#299](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/299) | fix: 코드 생성 크기·줄바꿈 규칙을 Canvas와 맞춘다 ([#269](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/269)) | GAMMJ |
| 10-06 | [#300](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/300) | fix: 편집하지 않은 데모 문서로 홈 카드를 열 때 확인창을 띄우지 않는다 ([#297](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/297)) | wook3964 |
| 10-07 | [#305](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/305) | fix: Export 결과를 검사한 문서와 페이지에 연결한다 ([#272](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/272)) | GAMMJ |
| 10-07 | [#301](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/301) | fix: 숨긴 Toolbar가 Tab/Shift+Tab 포커스에서 빠지도록 inert 추가 ([#275](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/275)) | dogui1018 |
| 10-07 | [#304](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/304) | fix: Export 이미지 참조를 번들러에서 해석되도록 생성한다 ([#270](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/270)) | GAMMJ |
| 10-07 | [#306](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/306) | style: 활성 안내 텍스트의 대비를 확보한다 ([#276](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/276)) | dogui1018 |
| 10-07 | [#307](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/307) | style: 에이전트 전달과 코드 생성·Export 단계를 안내한다 ([#283](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/283)) | dogui1018 |
| 10-07 | [#308](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/308) | fix: Grid 코드 매핑의 열 정의와 교차축 정렬을 GUI와 맞춘다 ([#268](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/268)) | GAMMJ |
| 10-08 | [#310](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/310) | fix: 자산을 읽지 못한 Export를 성공으로 안내하지 않는다 ([#274](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/274)) | GAMMJ |
| 10-08 | [#303](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/303) | feat: 에이전트 대화의 편집을 열린 GUI에 Command로 반영한다 ([#279](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/279)) | wook3964 |
| 10-08 | [#311](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/311) | docs: Export 현재 제공 범위와 입력·접근성 후속 제안을 정리한다 ([#285](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/285)) | wook3964 |
| 10-08 | [#309](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/309) | feat: 열린 파일의 디스크 변경을 감지해 Undo 가능하게 불러온다 ([#279](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/279)) | wook3964 |
| 10-08 | [#312](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/312) | style: 홈 화면에 자연어 초안 작성 패널을 추가한다 ([#286](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/286)) | dogui1018 |
| 10-08 | [#320](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/320) | feat: 설치 가능한 GUI 런타임 패키지 구성 | GAMMJ |
| 10-08 | [#329](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/329) | docs: PR 스킬의 base 브랜치 규칙을 명확히 한다 ([#328](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/328)) | GAMMJ |
| 10-08 | [#321](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/321) | style: 좌우 패널을 개별로 접고 폭을 조절할 수 있게 한다 ([#287](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/287)) | dogui1018 |

### 새 이슈

| 등록일 | 이슈 | 내용 | 작성 |
|---|---|---|---|
| 10-06 | [#297](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/297) | fix: 편집하지 않았는데 홈 카드를 열면 "저장하지 않은 제목 없는 문서" 확인창이 뜬다 — [#294](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/294)가 데모 문서를 편집본으로 판정 | wook3964 |
| 10-06 | [#302](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/302) | fix: 저장 안 한 초안이 있을 때 New/Open/카드 열기가 멈춘 것처럼 보인다 — settle()의 window.confirm이 안내 없이 떠 렌더러를 막는다 | dogui1018 |
| 10-08 | [#314](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/314) | chore: GUI가 사용자에게도 React 개발 모드로 돈다 — 노드 1000개 편집 한 번에 약 175ms(production이면 약 24ms) | wook3964 |
| 10-08 | [#315](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/315) | refactor: 홈 카드 미리보기가 노드 트리를 DOM으로 전부 그린다 — 프로젝트 100 × 노드 1000에서 홈 진입 1.1~2.0초·DOM 17만 개 | wook3964 |
| 10-08 | [#316](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/316) | refactor: 홈이 모든 프로젝트를 읽고 파싱·검증한 뒤에야 그린다 — 큰 작업공간에서 홈 진입 시간의 약 12% | wook3964 |
| 10-08 | [#317](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/317) | refactor: 노드 하나를 고쳐도 캔버스·레이어 트리가 크게 다시 렌더된다 — production에서도 노드 1000개 편집 JS가 한 프레임 예산을 넘는다 | wook3964 |
| 10-08 | [#318](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/318) | chore: 큰 이미지의 표시 시간과 비트맵 메모리를 재지 않았다 — [#293](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/293)에서 판단을 보류한 항목 | wook3964 |
| 10-08 | [#319](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/319) | fix: 이름 없는 워크스페이스 초안을 Home에서 이어서 열 수 없다 | Yumesa2025 |
| 10-08 | [#322](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/322) | refactor: 홈 카드 미리보기가 원본 큰 이미지를 그대로 디코딩한다 — 서로 다른 큰 이미지가 많은 작업공간에서 홈만으로 메모리가 GB 단위로 는다 | wook3964 |
| 10-08 | [#328](https://github.com/visual-spec-labs/Visual-Spec-Builder/issues/328) | docs: PR 스킬이 base 브랜치를 develop으로 고정하지 않는다 | GAMMJ |
