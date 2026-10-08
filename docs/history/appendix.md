# 부록 — 단계별 상세 기록

> 이 파일은 GitHub 기록과 `docs/history/data/*.json`의 수집 스냅숏을 정리한 부록이다. 생성 스크립트는 아직 저장소에 없다. 요약 정정은 `phases.json`과 함께 반영하며 원래 집계·PR 행은 보존한다.
> 날짜는 한국 시간(KST) 기준 병합일이다. 수집 시점은 2026-10-08T11:02:17.618Z이며 이후 병합은 포함하지 않는다. 집계 단위·리뷰 분류·AI 별칭과 공개 출처의 한계는 [본문의 기록 기준](./README.md#이-기록에-대하여)을 따른다.

## 단계 요약

| 단계 | 기간 | 병합 PR | 리뷰 승인 | 커밋 | 새 이슈 |
|---|---|---:|---:|---:|---:|
| [0. 프롤로그 — 한 문장에서 출발하다](#0-prologue) | 07-24 ~ 07-31 | 1 | 0 | 9 | 0 |
| [1. 기초 공사 — 방향을 다듬고 규칙을 세우다](#1-groundwork) | 08-01 ~ 08-20 | 11 | 0 | 36 | 6 |
| [2. 에디터의 골격이 서다](#2-editor-frame) | 08-21 ~ 08-31 | 18 | 18 | 80 | 26 |
| [3. 표현의 폭을 넓히다 — 스키마와 편집 모델](#3-richer-language) | 09-01 ~ 09-11 | 32 | 28 | 116 | 25 |
| [4. 손에 붙는 편집기, 굳어지는 계약](#4-hands-on-editor) | 09-12 ~ 09-26 | 29 | 27 | 90 | 27 |
| [5. 말이 화면이 되다 — 자연어와 코드 생성](#5-words-to-screens) | 09-27 ~ 10-02 | 14 | 12 | 33 | 14 |
| [6. 몰아친 하루 — 배경과 반응형](#6-busiest-day) | 10-03 ~ 10-04 | 24 | 3 | 142 | 22 |
| [7. 첫 완주 — MVP 전 구간 검증](#7-first-run) | 10-05 ~ 10-05 | 13 | 1 | 25 | 29 |
| [8. 제품으로 다듬다](#8-polishing) | 10-06 ~ 10-08 수집 시점 | 21 | 21 | 125 | 10 |

<a id="0-prologue"></a>

## 0. 프롤로그 — 한 문장에서 출발하다

07-24 ~ 07-31 · 다섯 명이 MVP 범위와 데모 목표 한 문장을 정하고, 스키마 v0.1을 동결했다.

- 병합 PR 1건 (리뷰 승인 0건) · 커밋 9개 · 새 이슈 0건
- PR 작성: Yumesa2025 1

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 07-30 | [#1](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/1) | feat: Visual Spec Schema v0.1 — JSON 스키마와 TypeScript 타입 구현 | Yumesa2025 | — |

<a id="1-groundwork"></a>

## 1. 기초 공사 — 방향을 다듬고 규칙을 세우다

08-01 ~ 08-20 · "기존 프로젝트 분석"을 내려놓고 독립 작업공간으로 방향을 굳힌 뒤, 하루 만에 CI·스킬·문서 체계를 세웠다.

- 병합 PR 11건 (리뷰 승인 0건) · 커밋 36개 · 새 이슈 6건
- PR 작성: Yumesa2025 7 · GAMMJ 2 · wook3964 2

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 08-06 | [#4](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/4) | chore: pnpm 전환 · GitHub 이슈 템플릿 추가 · tsconfig baseUrl 제거 | GAMMJ | — |
| 08-11 | [#6](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/6) | feat: 로컬 GUI 에디터 레이아웃 골격 추가 | GAMMJ | — |
| 08-14 | [#9](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/9) | feat: Visual Spec → React 코드 생성 Skill 초안 추가 | wook3964 | — |
| 08-20 | [#13](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/13) | chore: 이슈/PR 템플릿을 Conventional Commit 라벨 체계에 맞춤 | Yumesa2025 | — |
| 08-20 | [#12](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/12) | feat: analyze-target-project 스킬 추가 및 Skill 설명 문서 정리 | wook3964 | — |
| 08-20 | [#14](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/14) | docs: 기획 문서를 읽는 순서대로 재편하고 홈 화면 명세 추가 | Yumesa2025 | — |
| 08-20 | [#15](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/15) | docs: 스킬 문서의 깨진 PROJECT_OVERVIEW 참조를 01-overview로 수정 | Yumesa2025 | — |
| 08-20 | [#16](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/16) | chore: PR/푸시에서 타입체크·테스트·스키마 드리프트를 검사하는 CI 추가 | Yumesa2025 | — |
| 08-20 | [#17](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/17) | feat: Agent Skills 번들 6종 추가하고 배포 원본을 skills/ 로 정리 | Yumesa2025 | — |
| 08-20 | [#18](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/18) | docs: 구현 현황 문서 07 추가 — 무엇이 되고 무엇이 남았는지 | Yumesa2025 | — |
| 08-20 | [#19](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/19) | chore: 기여 규칙 문서와 GitHub 거버넌스 파일 추가 | Yumesa2025 | — |

<a id="2-editor-frame"></a>

## 2. 에디터의 골격이 서다

08-21 ~ 08-31 · 공유 스토어 위에 레이어 트리·캔버스·속성 패널·메뉴바가 붙어 편집기가 모양을 갖췄다.

- 병합 PR 18건 (리뷰 승인 18건) · 커밋 80개 · 새 이슈 26건
- PR 작성: GAMMJ 5 · wook3964 5 · dogui1018 5 · SunMyunC 2 · Yumesa2025 1

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 08-24 | [#21](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/21) | feat: 에디터 공유 스토어 도입 | GAMMJ | 승인 |
| 08-25 | [#7](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/7) | feat: 디자인 토큰 시스템 및 다크/라이트 테마 스위칭 | SunMyunC | 승인 |
| 08-25 | [#23](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/23) | fix: 스키마 검증 오류 메시지를 위반 종류별로 다르게 생성 | wook3964 | 승인 |
| 08-25 | [#25](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/25) | feat: visual-spec-to-react가 Visual Spec 여러 개를 한 번에 처리하게 한다 | wook3964 | 승인 |
| 08-25 | [#27](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/27) | feat: 이미 생성된 화면에 대한 후속 피드백을 JSON 수정 → 재생성으로 반영한다 | wook3964 | 승인 |
| 08-25 | [#28](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/28) | feat: Figma 디자인 UI 구현 (레이어 트리 · 툴바 · 메뉴바 · 속성 패널) | SunMyunC | 승인 |
| 08-25 | [#30](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/30) | feat: 세부설정 패널을 스토어에 연결하고 캔버스 임시 구현 추가 | GAMMJ | 승인 |
| 08-25 | [#31](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/31) | feat: 헤더 메뉴바 File/View 드롭다운 및 View 메뉴 기능 연결 | dogui1018 | 승인 |
| 08-28 | [#34](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/34) | refactor: 고정 워크스페이스 경로로 전환 — analyze-target-project 제거 | wook3964 | 승인 |
| 08-28 | [#36](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/36) | feat: visual-spec-to-react가 컴포넌트 단위로 파일을 분리 생성한다 | wook3964 | 승인 |
| 08-28 | [#37](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/37) | feat: File 메뉴 Export 연결 | dogui1018 | 승인 |
| 08-28 | [#48](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/48) | refactor: 세부설정 패널 공통 컴포넌트/훅 추출 및 UI 버그 수정 | GAMMJ | 승인 |
| 08-28 | [#49](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/49) | feat: File 메뉴 New/Open 연결 | dogui1018 | 승인 |
| 08-28 | [#51](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/51) | feat: File 메뉴 Save/Save as 연결 | dogui1018 | 승인 |
| 08-28 | [#53](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/53) | feat(editor): 캔버스 Ctrl+휠 줌 인터랙션 | dogui1018 | 승인 |
| 08-29 | [#55](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/55) | fix: 세부설정 패널 값이 반영되지 않거나 형제 요소에 간섭하는 문제 수정 | GAMMJ | 승인 |
| 08-29 | [#39](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/39) | chore: 협업 규칙 문서를 5인 팀과 현재 저장소 구조에 맞게 갱신 | Yumesa2025 | 승인 |
| 08-31 | [#58](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/58) | feat: 캔버스 아트보드를 고정하고 크기 필드에 실측 px를 표시 | GAMMJ | 승인 |

이슈 일괄 등록: 08-29 GAMMJ 6건 · 08-28 Yumesa2025 7건

<a id="3-richer-language"></a>

## 3. 표현의 폭을 넓히다 — 스키마와 편집 모델

09-01 ~ 09-11 · 노드 5종·여러 페이지 프로젝트(v0.2)로 스키마를 넓히고, 노드·페이지 필드 편집을 Command에 연결했다. 노드 삽입과 페이지 추가·삭제의 Undo는 이후 #142에서 이어졌다.

- 병합 PR 32건 (리뷰 승인 28건) · 커밋 116개 · 새 이슈 25건
- PR 작성: wook3964 12 · GAMMJ 8 · dogui1018 7 · Yumesa2025 4 · SunMyunC 1

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 09-01 | [#64](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/64) | fix: 숫자 입력칸에 휠이 닿으면 포커스를 떼 값이 바뀌지 않게 함 | GAMMJ | 승인 |
| 09-01 | [#67](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/67) | feat: Visual Spec v0.1에 ImageNode 추가 | dogui1018 | 승인 |
| 09-01 | [#69](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/69) | feat: File 메뉴 Import 연결 (이미지 파일 가져오기) | dogui1018 | 승인 |
| 09-01 | [#71](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/71) | fix: image 노드 지원을 스킬 3개에 반영 | wook3964 | — |
| 09-01 | [#38](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/38) | docs: 검증기 변경에 맞춰 스킬 정정하고 07 구현 현황을 실측 갱신 | Yumesa2025 | — |
| 09-02 | [#76](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/76) | feat(schema): v0.2 ProjectSpec 추가 — 파일 1개에 여러 페이지를 담는다 | GAMMJ | — |
| 09-02 | [#80](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/80) | feat: 스토어와 캔버스가 활성 페이지 개념을 갖는다 | GAMMJ | 승인 |
| 09-02 | [#84](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/84) | feat : 레이어 트리를 스토어에 연결 | dogui1018 | 승인 |
| 09-04 | [#77](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/77) | feat(editor): 홈(진입) 화면 추가 — 화면 목록(1개) + 새 화면 | wook3964 | 승인 |
| 09-04 | [#85](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/85) | feat: 페이지 이름·해상도 편집과 캔버스 채우기 모드 | GAMMJ | 승인 |
| 09-04 | [#83](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/83) | feat: 스키마에 Button/Input 노드 타입과 Grid 레이아웃 추가 | wook3964 | 승인 |
| 09-04 | [#68](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/68) | feat: 캔버스 하단 툴바 도구 동작 구현 | SunMyunC | — |
| 09-07 | [#88](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/88) | feat: 스타일 표현력 확장 1단계 — Shadow · Opacity · Blur · Stroke 정렬 | GAMMJ | 승인 |
| 09-08 | [#79](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/79) | feat: Command 타입 5종 + 순수 적용기 + undo/redo 스택 도입 | wook3964 | 승인 |
| 09-08 | [#81](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/81) | feat: Ticket 스키마 v0.1 — IR을 컴포넌트 구현 단위로 분해하는 순수 함수 | wook3964 | 승인 |
| 09-09 | [#98](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/98) | docs: 07 구현 현황을 develop 실제 코드로 재실측 — 홈 화면·레이어 트리·도구 모음·집계 8건 정정 | Yumesa2025 | 승인 |
| 09-09 | [#97](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/97) | docs: 05-schema를 정본 스키마 기준으로 갱신 — v0.1/v0.2 병행 상태와 노드 5종 반영 | Yumesa2025 | 승인 |
| 09-09 | [#96](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/96) | fix: 선택 표시를 노드 outline에서 캔버스 오버레이로 분리 | GAMMJ | 승인 |
| 09-09 | [#100](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/100) | feat: 레이어 트리에 페이지 폴더 추가 | dogui1018 | 승인 |
| 09-09 | [#99](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/99) | feat(canvas): 리사이즈 핸들로 선택 노드 크기를 조절한다 | wook3964 | 승인 |
| 09-09 | [#103](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/103) | fix: 아무것도 그리지 않는 테두리를 스펙에 남기지 않는다 | GAMMJ | 승인 |
| 09-11 | [#106](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/106) | feat: visual-spec CLI 골격 — bin 필드와 init 명령 (#42) | wook3964 | 승인 |
| 09-11 | [#102](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/102) | refactor(editor): setNodeField가 Command Engine을 거치도록 한다 (#40) | wook3964 | 승인 |
| 09-11 | [#109](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/109) | feat: 레이어 트리에서 노드 삭제 기능 추가 | dogui1018 | 승인 |
| 09-11 | [#107](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/107) | feat: visual-spec CLI에 skills 명령 추가 — 스킬 5종을 대상 프로젝트에 설치한다 (#104) | wook3964 | 승인 |
| 09-11 | [#111](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/111) | feat: 속성 패널을 능력 단위로 분리해 image·button·input 편집을 연다 | GAMMJ | 승인 |
| 09-11 | [#108](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/108) | feat: visual-spec CLI를 인자 없이 실행하면 GUI를 띄운다 (#105) | wook3964 | 승인 |
| 09-11 | [#116](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/116) | feat: 레이어 트리에서 드래그로 순서 변경 | dogui1018 | 승인 |
| 09-11 | [#117](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/117) | fix(cli): Windows에서 npx visual-spec이 spawn EINVAL로 죽는 것을 고친다 (#115) | Yumesa2025 | 승인 |
| 09-11 | [#113](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/113) | fix: package.json의 main이 없는 파일을 가리키던 것을 정리 — 필드 제거 (#45) | wook3964 | 승인 |
| 09-11 | [#119](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/119) | docs: fill의 교차축 의미를 06-schema-freeze에 결정으로 옮긴다 (#46) | wook3964 | 승인 |
| 09-11 | [#120](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/120) | feat: 레이어 트리에 되돌리기(Undo/Redo) 버튼 추가 | dogui1018 | 승인 |

<a id="4-hands-on-editor"></a>

## 4. 손에 붙는 편집기, 굳어지는 계약

09-12 ~ 09-26 · 피그마에 가까운 조작감을 다듬고, GUI를 작업공간에 연결하고, Command 계약을 동결했다.

- 병합 PR 29건 (리뷰 승인 27건) · 커밋 90개 · 새 이슈 27건
- PR 작성: GAMMJ 9 · wook3964 7 · Yumesa2025 7 · dogui1018 6

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 09-15 | [#124](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/124) | feat: 레이어 트리 드래그로 다른 프레임에 재부모화하기 | dogui1018 | 승인 |
| 09-15 | [#122](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/122) | fix(editor): 이어지는 필드 편집을 하나의 Undo 단계로 합친다 (#121) | wook3964 | 승인 |
| 09-15 | [#126](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/126) | refactor: 채우기 모드(View ▸ Fill Viewport)를 걷어낸다 | GAMMJ | 승인 |
| 09-15 | [#130](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/130) | feat(editor): 아트보드 세로 성장과 캔버스 기본 동작 (#86, #91) | GAMMJ | 승인 |
| 09-15 | [#135](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/135) | feat(editor): 레이어 트리에서 레이어 이름 바꾸기 | dogui1018 | 승인 |
| 09-15 | [#134](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/134) | feat(editor): 새로고침해도 작업 중이던 프로젝트가 사라지지 않는다 (#128) | wook3964 | 승인 |
| 09-15 | [#137](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/137) | feat(editor): 도구 키보드 단축키와 스페이스 임시 팬 (#136) | GAMMJ | 승인 |
| 09-16 | [#139](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/139) | feat(editor): 브라우저 기본 우클릭 메뉴를 막는다 (#138) | GAMMJ | 승인 |
| 09-18 | [#141](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/141) | feat(editor): TextField 연속 타이핑을 undo 한 단계로 합친다 (#132) | Yumesa2025 | 승인 |
| 09-18 | [#140](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/140) | docs: ImageNode.src 설명과 스토어 주석을 실제 코드에 맞춘다 (#94, #95) | Yumesa2025 | 승인 |
| 09-18 | [#142](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/142) | feat(editor): insertNode·addPage·removePage를 Undo/Redo에 태운다 (#131) | Yumesa2025 | 승인 |
| 09-18 | [#143](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/143) | docs: 이슈 #131·#132 머지를 문서에 반영하고 테스트 집계를 전수 재실측한다 | Yumesa2025 | 승인 |
| 09-19 | [#144](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/144) | docs: 자연어 변환 설계안 (docs/08-natural-language.md) | Yumesa2025 | 승인 |
| 09-19 | [#145](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/145) | feat: GUI를 .visual-spec/ 워크스페이스에 연결한다 (#133, #112) | Yumesa2025 | 변경 요청 |
| 09-19 | [#147](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/147) | fix: updateScreen·updateNode가 스키마에 없는 경로를 거부한다 (#146) | Yumesa2025 | 변경 요청 |
| 09-19 | [#163](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/163) | feat(editor): 그리드 레이아웃을 상세 패널에서 만들 수 있게 한다 (#160) | GAMMJ | 승인 |
| 09-19 | [#164](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/164) | feat(editor): 캔버스 조작을 피그마에 맞춘다 — 커서 기준 줌·중클릭 팬·보기 단축키 (#161) | GAMMJ | 승인 |
| 09-19 | [#165](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/165) | feat(editor): 캔버스에 간격·거리 표시와 hover 미리보기를 넣는다 (#162) | GAMMJ | 승인 |
| 09-20 | [#166](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/166) | refactor(editor): Canvas.tsx 를 네 모듈로 가른다 (#148) | GAMMJ | 승인 |
| 09-20 | [#167](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/167) | feat: 여러 노드 필드 변경을 하나의 트랜잭션으로 처리 (#149) | wook3964 | 승인 |
| 09-20 | [#168](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/168) | chore: Command 스키마를 v0.1로 고정 (#153) | wook3964 | 승인 |
| 09-20 | [#169](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/169) | feat: 구현 티켓을 GUI에서 생성하고 표시 (#156) | wook3964 | 승인 |
| 09-20 | [#170](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/170) | fix: 메뉴바에 현재 문서 제목을 표시 (#158) | wook3964 | 승인 |
| 09-20 | [#171](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/171) | chore: 브랜드 파비콘을 추가 (#159) | wook3964 | 승인 |
| 09-20 | [#172](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/172) | feat: 자식 크기를 한 번에 균등하게 맞추는 버튼을 Layout 섹션에 넣는다 (#150) | dogui1018 | 승인 |
| 09-21 | [#173](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/173) | feat: 캔버스 조작 단축키 4종을 추가한다 — 줌·복제·진입·형제이동 (#151) | dogui1018 | 승인 |
| 09-21 | [#174](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/174) | feat(editor): 더블클릭 진입 · Tab 형제 이동 · Ctrl+D 복제 · Shift+2 (#151) | GAMMJ | 승인 |
| 09-21 | [#175](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/175) | feat: 캔버스에 컨텍스트 메뉴를 붙인다 (#152) | dogui1018 | 승인 |
| 09-21 | [#176](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/176) | feat: 신뢰할 수 없는 Command 배열용 G2·G3 관문과 전부-또는-전무 커밋 추가 (#154) | dogui1018 | 승인 |

이슈 일괄 등록: 09-19 GAMMJ 8건 · 09-19 Yumesa2025 7건

<a id="5-words-to-screens"></a>

## 5. 말이 화면이 되다 — 자연어와 코드 생성

09-27 ~ 10-02 · 자연어 수정·생성, 코드 ZIP 내보내기, 에이전트 실행 왕복이 이어지며 처음부터 끝까지의 길이 생겼다.

- 병합 PR 14건 (리뷰 승인 12건) · 커밋 33개 · 새 이슈 14건
- PR 작성: dogui1018 5 · wook3964 4 · GAMMJ 3 · Yumesa2025 2

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 09-27 | [#177](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/177) | feat: 자연어 부분 수정 1차 — 에이전트 경유 파일 교환 경로와 입력창 (#155) | Yumesa2025 | — |
| 09-27 | [#178](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/178) | feat: 생성된 React 코드를 검증해 결과 폴더 ZIP으로 내보내기 (#157) | Yumesa2025 | — |
| 09-28 | [#191](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/191) | feat: createNode를 노드 5종 + 부분 덮어쓰기로 확장 (#182) | wook3964 | 승인 |
| 09-28 | [#192](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/192) | feat: 자연어 화면 생성 — 빈 화면 생성 경로가 이미 있었음을 증명 (#183) | wook3964 | 승인 |
| 09-29 | [#197](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/197) | feat: 구현 티켓 패널에 에이전트 실행 왕복 연결 (#184) | dogui1018 | 승인 |
| 09-29 | [#198](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/198) | fix: 새로고침 후 Save가 다른 파일을 만드는 문제 수정 (#185) | dogui1018 | 승인 |
| 09-29 | [#195](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/195) | feat: CreateNodeCommand에 삽입 위치(index) 추가 (#193) | wook3964 | 승인 |
| 09-29 | [#199](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/199) | fix: 홈 화면이 실제 파일 목록을 읽도록 배선 (#186) | dogui1018 | 승인 |
| 09-29 | [#196](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/196) | feat: 자연어 요청에 응답하는 에이전트용 스킬 문서 추가 (#194) | wook3964 | 승인 |
| 09-29 | [#200](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/200) | chore: Ticket 스키마를 v0.1로 고정 (#179) | GAMMJ | 승인 |
| 09-30 | [#201](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/201) | docs: Visual Spec 스키마 문서를 정본과 맞춘다 (#180) | GAMMJ | 승인 |
| 10-01 | [#202](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/202) | docs: 반응형 IR 설계와 후속 범위를 결정한다 (#181) | GAMMJ | 승인 |
| 10-01 | [#203](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/203) | chore: docs/09 번호 충돌 해소 — 09-shortcuts.md를 10로 옮김 (#190) | dogui1018 | 승인 |
| 10-01 | [#204](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/204) | chore: CLI가 쓰이지 않는 preview/ 폴더를 더 이상 만들지 않게 함 (#189) | dogui1018 | 승인 |

이슈 일괄 등록: 09-27 Yumesa2025 12건

<a id="6-busiest-day"></a>

## 6. 몰아친 하루 — 배경과 반응형

10-03 ~ 10-04 · 캔버스 드래그, 채우기 겹 배경(v0.3), 반응형 스키마와 그룹이 하루에 들어왔다. 커밋 142개.

- 병합 PR 24건 (리뷰 승인 3건) · 커밋 142개 · 새 이슈 22건
- PR 작성: Yumesa2025 23 · dogui1018 1

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 10-04 | [#205](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/205) | docs: Export 결과물이 실제 프로젝트에서 컴파일되는지 1회 수동 QA (#188) | dogui1018 | 승인 |
| 10-04 | [#206](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/206) | feat: 캔버스에서 노드를 끌어 형제 순서·부모를 바꾼다 (#187) | Yumesa2025 | — |
| 10-04 | [#208](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/208) | fix: 리사이즈 한 번이 Undo 한 단계가 되게 한다 (#207) | Yumesa2025 | — |
| 10-04 | [#210](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/210) | fix: 값이 그대로인 입력은 커밋하지 않아 빈 Undo 단계를 막는다 (#209) | Yumesa2025 | — |
| 10-04 | [#211](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/211) | docs: 배경 채우기(그라디언트·다중) 설계를 결정한다 (#127) | Yumesa2025 | — |
| 10-04 | [#212](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/212) | feat: 배경을 채우기 겹 배열(Fill[])로, 문서 버전을 0.3으로 전환한다 (#127 1단계) | Yumesa2025 | 승인 |
| 10-04 | [#213](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/213) | feat: 배경 linear 그라디언트와 여러 겹을 캔버스에 그린다 (#127 2단계) | Yumesa2025 | — |
| 10-04 | [#214](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/214) | feat: 배경 섹션을 채우기 겹 목록 편집기로 넓힌다 (#127 3단계) | Yumesa2025 | — |
| 10-04 | [#215](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/215) | docs: 스킬과 08에 그라디언트·여러 겹 배경 작성·편집·코드 생성을 가르친다 (#127 4단계) | Yumesa2025 | — |
| 10-04 | [#216](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/216) | feat: 그라디언트 예제를 더하고 #127 문서를 마무리한다 (#127 5단계) | Yumesa2025 | — |
| 10-04 | [#237](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/237) | feat: GUI 티켓 응답 스킬과 프로토콜 예제 검증 추가 (#217) | Yumesa2025 | — |
| 10-04 | [#238](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/238) | docs: 현재 구현 현황과 검증 기준 정정 (#233) | Yumesa2025 | — |
| 10-04 | [#239](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/239) | fix: 로그인 예제에 입력창과 버튼 추가 (#218) | Yumesa2025 | — |
| 10-04 | [#240](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/240) | fix: 빈 Undo·Export 무알림·무효 색상 입력 개선 (#228 #230 #231) | Yumesa2025 | — |
| 10-04 | [#241](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/241) | docs: 통합 사용 가이드와 실제·수동 QA 결과 기록 (#220 #221) | Yumesa2025 | — |
| 10-04 | [#242](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/242) | docs: 현재 로그인 예제 재현과 병합 기준 정정 | Yumesa2025 | — |
| 10-04 | [#243](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/243) | fix: 티켓의 중복 컴포넌트 이름을 유효한 식별자로 생성 | Yumesa2025 | — |
| 10-04 | [#244](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/244) | feat: 홈 프로젝트를 최근 수정순으로 정렬 (#227 일부) | Yumesa2025 | — |
| 10-04 | [#249](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/249) | feat: 자연어 배경 겹 삭제·재정렬 적용 전 확인 (#234) | Yumesa2025 | — |
| 10-04 | [#246](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/246) | fix: GUI 시작 시 스킬 사본 차이와 갱신 명령 안내 (#229) | Yumesa2025 | — |
| 10-04 | [#250](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/250) | feat: 단일 노드 그룹 만들기와 해제 (#225) | Yumesa2025 | — |
| 10-04 | [#251](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/251) | fix: 명시적인 숫자 컴포넌트 이름을 접미사보다 먼저 예약 | Yumesa2025 | — |
| 10-04 | [#245](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/245) | feat: 반응형 선택 스키마와 누적 override 검증 (#222) | Yumesa2025 | 승인 |
| 10-04 | [#248](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/248) | feat: 반응형 React 코드 생성 지침과 경계값 검증 (#224) | Yumesa2025 | — |

이슈 일괄 등록: 10-04 Yumesa2025 22건

<a id="7-first-run"></a>

## 7. 첫 완주 — MVP 전 구간 검증

10-05 ~ 10-05 · 반응형·이미지 배경·실행 정책을 마무리하고, 로그인 예제의 설치부터 Export·독립 앱 통합까지 실제 Codex 3웨이브·4티켓으로 검증했다. 인증 기능·픽셀 동일성·AI 생성 출력 전반의 검증은 아니다.

- 병합 PR 13건 (리뷰 승인 1건) · 커밋 25개 · 새 이슈 29건
- PR 작성: Yumesa2025 13

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 10-05 | [#252](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/252) | fix: 반응형 코드 생성 정렬·Tailwind 호환성·설치 문서 참조 수정 | Yumesa2025 | — |
| 10-05 | [#253](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/253) | docs: 수동 에이전트 실행 정책과 수용 기준 확정 (#219) | Yumesa2025 | — |
| 10-05 | [#254](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/254) | feat: 이미지 배경 스키마와 호환 계약 추가 (#235) | Yumesa2025 | — |
| 10-05 | [#255](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/255) | refactor: DOM Canvas를 렌더링·선택·드래그 역할로 분리 (#236) | Yumesa2025 | — |
| 10-05 | [#247](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/247) | feat: 반응형 미리보기와 상속 override 편집 (#223) | Yumesa2025 | — |
| 10-05 | [#256](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/256) | feat: 삽입 메뉴에서 Button과 Input 직접 생성 (#226) | Yumesa2025 | 승인 |
| 10-05 | [#257](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/257) | feat: 이미지 배경 편집·렌더·자산 Export 연결 (#235) | Yumesa2025 | — |
| 10-05 | [#258](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/258) | fix: 다중 탭 저장 충돌을 중지하고 초안 보존 (#232) | Yumesa2025 | — |
| 10-05 | [#259](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/259) | feat: 홈 프로젝트 이름과 저장 파일명을 안전하게 동기화 (#227) | Yumesa2025 | — |
| 10-05 | [#260](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/260) | docs: MVP 병합 상태와 실제 AI 재검증 결과 정리 | Yumesa2025 | — |
| 10-05 | [#261](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/261) | docs: 실제 Codex MVP 전체 흐름 검증 완료 | Yumesa2025 | — |
| 10-05 | [#263](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/263) | docs: #237~#261 병합 후 구현 현황·낡은 상태 문장·README 목차 최신화 | Yumesa2025 | — |
| 10-05 | [#264](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/264) | docs: 스키마 버전 표기·스토어 편집 필드 표·홈 현재 상태 갱신 (#263 보류분) | Yumesa2025 | — |

이슈 일괄 등록: 10-05 Yumesa2025 29건

<a id="8-polishing"></a>

## 8. 제품으로 다듬다

10-06 ~ 10-08 수집 시점 · 생성 코드와 캔버스의 정합성, 편집 안정성, 접근성, 설치 가능한 런타임을 다듬고 있다.

- 병합 PR 21건 (리뷰 승인 21건) · 커밋 125개 · 새 이슈 10건
- PR 작성: wook3964 8 · GAMMJ 7 · dogui1018 5 · Yumesa2025 1

| 병합일 | PR | 내용 | 작성 | 리뷰 |
|---|---|---|---|---|
| 10-06 | [#266](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/266) | docs: 이슈·PR 제목 형식과 라벨 1개 규칙을 정한다 | Yumesa2025 | 승인 |
| 10-06 | [#295](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/295) | fix: 변경된 스펙의 낡은 티켓 실행을 차단한다 (#271) | wook3964 | 승인 |
| 10-06 | [#294](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/294) | fix: 문서 전환 전 미저장 초안을 보존한다 (#267) | wook3964 | 승인 |
| 10-06 | [#296](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/296) | fix: 다중 탭 AI 요청의 파일 덮어쓰기 경합을 막는다 (#273) | wook3964 | 승인 |
| 10-06 | [#298](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/298) | feat: Claude Code·Codex 스킬 발견과 설치 버전의 로컬 계약을 제공한다 (#278) | wook3964 | 승인 |
| 10-06 | [#299](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/299) | fix: 코드 생성 크기·줄바꿈 규칙을 Canvas와 맞춘다 (#269) | GAMMJ | 승인 |
| 10-06 | [#300](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/300) | fix: 편집하지 않은 데모 문서로 홈 카드를 열 때 확인창을 띄우지 않는다 (#297) | wook3964 | 승인 |
| 10-07 | [#305](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/305) | fix: Export 결과를 검사한 문서와 페이지에 연결한다 (#272) | GAMMJ | 승인 |
| 10-07 | [#301](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/301) | fix: 숨긴 Toolbar가 Tab/Shift+Tab 포커스에서 빠지도록 inert 추가 (#275) | dogui1018 | 승인 |
| 10-07 | [#304](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/304) | fix: Export 이미지 참조를 번들러에서 해석되도록 생성한다 (#270) | GAMMJ | 승인 |
| 10-07 | [#306](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/306) | style: 활성 안내 텍스트의 대비를 확보한다 (#276) | dogui1018 | 승인 |
| 10-07 | [#307](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/307) | style: 에이전트 전달과 코드 생성·Export 단계를 안내한다 (#283) | dogui1018 | 승인 |
| 10-07 | [#308](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/308) | fix: Grid 코드 매핑의 열 정의와 교차축 정렬을 GUI와 맞춘다 (#268) | GAMMJ | 승인 |
| 10-08 | [#310](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/310) | fix: 자산을 읽지 못한 Export를 성공으로 안내하지 않는다 (#274) | GAMMJ | 승인 |
| 10-08 | [#303](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/303) | feat: 에이전트 대화의 편집을 열린 GUI에 Command로 반영한다 (#279) | wook3964 | 승인 |
| 10-08 | [#311](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/311) | docs: Export 현재 제공 범위와 입력·접근성 후속 제안을 정리한다 (#285) | wook3964 | 승인 |
| 10-08 | [#309](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/309) | feat: 열린 파일의 디스크 변경을 감지해 Undo 가능하게 불러온다 (#279) | wook3964 | 승인 |
| 10-08 | [#312](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/312) | style: 홈 화면에 자연어 초안 작성 패널을 추가한다 (#286) | dogui1018 | 승인 |
| 10-08 | [#320](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/320) | feat: 설치 가능한 GUI 런타임 패키지 구성 | GAMMJ | 승인 |
| 10-08 | [#329](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/329) | docs: PR 스킬의 base 브랜치 규칙을 명확히 한다 (#328) | GAMMJ | 승인 |
| 10-08 | [#321](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/321) | style: 좌우 패널을 개별로 접고 폭을 조절할 수 있게 한다 (#287) | dogui1018 | 승인 |

이슈 일괄 등록: 10-08 wook3964 6건
