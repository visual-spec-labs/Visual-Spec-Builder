# 02. MVP 범위

> 출처: ClickUp 팀 문서 `Visual Spec Builder MVP`

이 문서가 **범위 판단의 기준**이다. `PRD 1차`와 충돌하는 내용이 있으면 이 문서를 따른다.

## 설치와 실행

```bash
npm install -D visual-spec-builder
npx visual-spec init
npx visual-spec
```

`init`은 현재 프로젝트를 분석하거나 변경하지 않고 전용 작업공간만 만든다.

```
.visual-spec/
├── specs/        화면 JSON 스펙
├── generated/    생성된 React 코드
├── preview/
├── assets/
└── runtime/
```

화면과 컴포넌트는 이 작업공간 안에서만 제작된다.

## MVP 포함 범위

| 구분 | 항목 |
|---|---|
| 환경 | React + Vite, TypeScript, Tailwind CSS |
| 작업공간 | 독립 `.visual-spec/` 디렉터리 |
| GUI | localhost 캔버스 편집기 |
| 생성 | 자연어 화면 생성, 자연어 부분 수정, 직접 캔버스 편집 |
| 레이아웃 | Row / Column / Grid |
| 노드 | Container / Text / Button / Input / Image |
| 크기 | Fixed / Fill / Hug |
| 반응형 | 데스크톱 · 모바일 레이아웃 |
| 편집 | Undo / Redo |
| 저장 | 공통 JSON 스키마 |
| 코드 생성 | Claude Code 또는 Codex 실행 |
| 출력 | 기능 폴더 Export |

대표 화면은 **관리자 대시보드**다.

## MVP 제외 범위

| 항목 | 사유 |
|---|---|
| **React Preview (`localhost:4174`)** | MVP 문서에서 취소선 처리됨. 캔버스 스펙과 실제 React 결과를 나란히 비교하는 단계는 MVP에 넣지 않는다 |
| 기존 프로젝트 자동 병합 | Export 폴더를 사용자가 직접 통합한다 |
| Panda CSS / styled-components 출력 | 같은 IR을 쓰는 출력 어댑터로 나중에 추가 |
| Image · Shape · Pen 도구 | [04-gui-spec.md](04-gui-spec.md) 도구 모음 참고 |
| Help 메뉴 | 동일 |

스키마 수준의 제외 범위는 [05-schema.md](05-schema.md)에 따로 있다.

> **정정 이력 (2026-08-15)**
> `01-overview.md`의 이전 버전에는 전체 흐름 마지막에 "결과 화면 확인" 단계가 있었다.
> MVP 문서에서 해당 절이 취소선 처리되어 제외 항목으로 옮겼다.

## 스키마 계약

MVP는 다음 세 가지 스키마를 v0.1로 고정한다.

- IR 스키마 v0.1 — 화면 구조 ([05-schema.md](05-schema.md))
- Command 스키마 v0.1 — 편집 명령
- Ticket 스키마 v0.1 — 구현 작업 단위

## 결과물 원칙

Export된 폴더는 가능한 한 독립적으로 동작해야 한다.

- 프로젝트 전용 경로 별칭 사용 금지
- 상대 경로 import 사용
- 필요한 컴포넌트 함께 포함
- 필요한 패키지 목록 제공
- 실행 방법과 통합 방법을 README에 작성

```javascript
// 사용하지 않음
import { Button } from "@/components/ui/Button";

// 상대 경로 사용
import { Button } from "./components/Button";
```

Export 결과 예시:

```
visual-spec-export/
└── dashboard/
    ├── components/
    │   ├── DashboardHeader.tsx
    │   ├── Sidebar.tsx
    │   ├── StatCard.tsx
    │   └── UserTable.tsx
    ├── DashboardPage.tsx
    ├── styles/
    ├── assets/
    ├── package.json
    └── README.md
```

## 구현 단위

MVP는 아래 여섯 덩어리로 나뉜다.

| 단위 | 책임 |
|---|---|
| IR · 스키마 | `screen.schema.ts` — layout, node, screen, style, size |
| Command Engine | GUI와 자연어가 공통으로 쓰는 편집 명령. `command.schema.ts`, history manager |
| 자연어 변환 | 자연어 → Command 변환 |
| Ticket Compiler · Agent | IR을 컴포넌트 구현 작업으로 분할, 실행 순서 결정, 티켓 상태 관리 |
| localhost GUI · Canvas | 사용자가 보는 Studio. **IR을 직접 수정하지 않고 Command Engine을 호출한다** |
| Export · 검증 | 생성된 React 코드를 결과 폴더로 내보내기 |

GUI가 IR을 직접 건드리지 않는다는 제약이 핵심이다. 드래그 동작도 `MOVE_NODE` 커맨드를 거쳐 IR을 바꾸고 캔버스를 재렌더링한다.
