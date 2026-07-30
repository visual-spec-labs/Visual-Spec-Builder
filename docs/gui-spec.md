# GUI Spec — Visual Spec Builder

Visual Spec Builder의 화면 구성과 각 영역의 기능을 정리한 GUI 기획 명세서입니다. MVP 범위와 추가 기능, 그리고 아직 결정되지 않은 항목을 함께 기록해 팀이 동일한 기준으로 논의할 수 있도록 합니다.

**상태 표기 범례**

| 마커 | 의미 |
|---|---|
| ✅ | MVP 포함 |
| ➕ | 추가 기능 (MVP 이후) |
| ⚠️ | MVP 제외 |
| ❓ | 미확정 |

## 목차

1. [전체 레이아웃 구조](#1-전체-레이아웃-구조)
2. [상단 메뉴바](#2-상단-메뉴바)
3. [캔버스 (GUI 결과·수정 화면)](#3-캔버스-gui-결과수정-화면)
4. [레이어 계층 구조 (좌측 트리)](#4-레이어-계층-구조-좌측-트리)
5. [세부설정 패널 (우측)](#5-세부설정-패널-우측)
6. [도구 모음 (하단)](#6-도구-모음-하단)
7. [정리 요약 — MVP vs 추가 기능](#7-정리-요약--mvp-vs-추가-기능)
8. [미확정 / 추가 논의가 필요한 항목](#8-미확정--추가-논의가-필요한-항목)

---

## 1. 전체 레이아웃 구조

화면은 크게 5개 영역으로 구성됩니다.

| 영역 | 위치 | 역할 |
|---|---|---|
| 상단 메뉴바 | 최상단 | File / View / Help |
| 레이어 트리 | 좌측 | 화면(노드) 계층 구조 탐색 |
| 캔버스(결과·수정 화면) | 중앙 | GUI 생성 결과 확인 및 직접 편집 |
| 세부설정 패널 | 우측 | 선택 요소의 속성 편집 |
| 도구 모음 | 하단 | 선택/생성 도구 전환 |

---

## 2. 상단 메뉴바

### 2.1 File

| 기능 | 설명 | 비고 |
|---|---|---|
| New / Open | 새 프로젝트 생성, 기존 파일 열기 | Open은 폴더 단위로 저장된 프로젝트를 불러옴 |
| Save / Save as | 작업 내용 저장, 다른 이름으로 저장 | 프로젝트 폴더 형태로 저장 |
| Import / Export | 이미지·코드·디자인 파일 가져오기 / 최종 결과물(PDF, PNG, SVG 등) 내보내기 | Export 시 최종 결과물이 폴더로 생성되고 zip으로 추출 |
| Version History | 과거 작업 히스토리 확인 및 복구 | ❓ 미확정 — undo와의 관계, File 메뉴 포함 여부 논의 필요. MVP 제외 가능성 |

### 2.2 View

| 기능 | 설명 |
|---|---|
| Zoom In/Out | 퍼센트 단위 확대/축소, 마우스 휠 = 화면 이동, Ctrl+휠 = 확대/축소 |
| Fit to Screen | 화면 크기에 맞게 캔버스 자동 조정 |
| Show/Hide Grid | 캔버스 그리드(격자) 표시 여부 |
| Panels/Sidebars | 좌우 패널(트리, 세부설정 등) 표시 여부 |

### 2.3 Help

| 기능 | 설명 |
|---|---|
| Documentation/Guide | 사용 설명서 및 튜토리얼 링크 |
| Keyboard Shortcuts | 단축키 일람표 |
| Release Notes | 업데이트 내역 안내 |
| Support/Contact | 버그 제보 및 문의 창구 |

⚠️ Help 메뉴는 MVP 범위에서 제외

---

## 3. 캔버스 (GUI 결과·수정 화면)

중앙 캔버스는 실제 생성 결과를 확인하고 직접 수정하는 핵심 작업 공간입니다.

- 현재 화면명 표시
- 줌 인/아웃 컨트롤
- 캔버스 작업 영역
- 선택 요소 테두리 표시
- 드래그·리사이즈 핸들
- 정렬 가이드(스냅 라인)
- 빈 화면 안내 문구
- 생성 결과 미리보기
- 실행 상태 표시
- 마우스 우클릭 컨텍스트 메뉴 — Composition(구성 및 편집)

### Composition 컨텍스트 메뉴

| 기능 | 설명 |
|---|---|
| Group / Ungroup | 여러 레이어를 하나로 묶거나 해제. 복잡한 구조 생성의 핵심 |
| Component / Asset | 자주 쓰는 요소를 등록해 재사용 가능한 부품으로 전환 |
| Layer Order | 레이어 앞/뒤 순서 제어. Bring to Front / Send to Back |

---

## 4. 레이어 계층 구조 (좌측 트리)

- 화면명 표시
- 노드 계층 트리(부모-자식 구조)
- 펼치기/접기 버튼
- 노드 작업 아이콘
- 선택 상태 하이라이트 표시
- 노드 추가 버튼
- 잠금 토글
- 드래그로 순서 변경

### 트리 하단 편집 컨트롤

- 현재 선택된(편집 대상) 요소 표시
- 요소 추가 / 삭제
- 테마·사이즈 변경
- 스타일 변경 → 적용/Export
- 반응형 설정
- 기능(동작) 정의
- 되돌리기(Undo)

❓ 미확정: 새 레이어 명명 규칙, 선택 방식(★ 표시된 항목) → 추후 논의 필요

### 예시 트리 구조 (DashboardPage)

```
DashboardPage
├── Sidebar
│   ├── Logo
│   ├── Navigation
│   └── UserProfile
└── Main
    ├── Header
    └── Content
        ├── MetricGrid
        └── ProductTable
```

---

## 5. 세부설정 패널 (우측)

선택한 요소의 속성을 편집하는 영역입니다.

| 속성 그룹 | 세부 항목 |
|---|---|
| Layout | position, width, height, 회전 |
| Color | 채우기 색상 |
| Background | background-color |
| Font | weight, size, 종류, 정렬(상/하/좌/우) |
| Border | color, weight, radius |
| Shadow | x, y, blur, spread, color |
| Export | JSON 내보내기 |
| Align / Distribute | 정렬(왼쪽/가운데/오른쪽) 및 균등 간격 배분 |

---

## 6. 도구 모음 (하단)

| 도구 | 아이콘 역할 | MVP 포함 여부 |
|---|---|---|
| Selection Tool(이동) | 요소를 선택하고 이동시키는 기본 화살표 | ✅ MVP |
| Frame | 사각형 등 프레임(배경색·radius 포함) 생성 | ✅ MVP |
| Text | 텍스트 입력 도구 | ✅ MVP |
| Hand / Zoom | 화면 이동 및 특정 영역 확대 | ✅ MVP |
| Shape / Pen | 도형(원, 선) 및 벡터 패스 생성 | ➕ 추가 기능(MVP 이후) |
| Image | 이미지 삽입 | ➕ 추가 기능(MVP 이후) |

**MVP 도구 세트:** Select · Frame · Text · Hand

**❓ 미확정 사항**

- 도구 선택 후 Esc 입력 시 Select 도구로 자동 복귀 여부
- Frame 선택 시 배경색·radius가 기본으로 도형에 적용되는지
- 모양(Shape) 도구가 기본 도형(사각형/원 등) 제공 도구인지, 공용 컴포넌트로 처리할지
- 캔버스에서 드래그로 도형 생성 시 생성된 요소를 root에 자동 추가하는 흐름

---

## 7. 정리 요약 — MVP vs 추가 기능

| 구분 | MVP 포함 | MVP 제외 / 추가 기능 |
|---|---|---|
| 메뉴바 | File, View | Help |
| File 세부 | New/Open, Save/Save as, Import/Export | Version History(논의 필요) |
| 도구 | Select, Frame, Text, Hand | Image, Shape/Pen |
| 편집 패널 | 레이어 트리, 세부설정, Composition(Group/Component/Layer Order) | - |

---

## 8. 미확정 / 추가 논의가 필요한 항목

- [ ] ❓ Version History와 Undo의 관계, File 메뉴 포함 여부
- [ ] ❓ 레이어 새 명명 규칙 및 선택 카드 UI
- [ ] ❓ 도구 선택 후 Esc 동작
- [ ] ❓ Frame 도구의 기본 스타일(배경색/radius) 자동 적용 여부
- [ ] ❓ Shape 도구의 기본 도형 처리 방식(공용 컴포넌트 여부)
- [ ] ❓ 캔버스 드래그 생성 시 root 트리 자동 추가 로직
