# 03. 사용자 플로우와 내부 구조

> 출처: ClickUp 팀 문서 `PRD 1차`

## 전체 경로

```
라이브러리 설치
→ 프로젝트 초기화
→ localhost 편집기 실행
→ 자연어 또는 직접 조작으로 화면 구성
→ 캔버스에서 결과 확인·수정
→ 기능과 동작 정의
→ 구현 순서 지정
→ Claude Code로 실제 코드 구현
```

## 내부 구조

```
GUI 이벤트 ─────────┐
                    ├→ Command Engine → IR Store
자연어 Agent ───────┘
                           ↓
                    Canvas Renderer
                           ↓
                    Ticket Compiler
                           ↓
                    Claude Code
```

핵심은 **Command Engine**이다. 사용자가 버튼을 직접 옮겨도, 자연어로 요청해도 같은 명령이 나온다.

```json
{ "type": "MOVE_NODE", "nodeId": "submit-button", "parentId": "form-actions", "index": 1 }
```

입력 방식만 다르고 결과는 완전히 같다.

## 자연어는 코드가 아니라 명령을 만든다

사용자가 입력한다.

```
상품 관리 대시보드 화면을 만들어줘.
왼쪽에는 고정 사이드바가 있고, 위쪽에는 검색창과 사용자 프로필이 있는 헤더가 있어.
본문에는 이번 달 매출 카드 3개와 아래에 상품 목록 테이블을 배치해줘.
```

AI는 React 코드를 만들지 않고 다음을 수행한다.

```
자연어 분석 → 화면 구조 계획 → 캔버스 조작 명령 생성 → IR 변경 → 캔버스에 표시
```

내부적으로 만들어지는 명령:

```json
[
  { "command": "createNode", "node": { "id": "dashboard-page", "type": "container", "layout": "row" } },
  { "command": "createNode", "node": { "id": "sidebar", "type": "container", "width": { "mode": "fixed", "value": 240 } } },
  { "command": "appendChild", "parentId": "dashboard-page", "childId": "sidebar" }
]
```

즉 자연어는 화면을 이미지로 생성하는 것이 아니라 **편집기가 실행할 구조적 명령을 생성**한다.

## 자연어 명령의 종류

초기부터 자유로운 프롬프트를 전부 지원하기보다 내부 명령 종류를 제한한다. 이 명령 집합이 자연어와 GUI의 공용 API가 된다.

| 분류 | 명령 |
|---|---|
| 구조 | 요소 생성 · 삭제 · 이동, 부모 변경, 순서 변경, 그룹 생성, 컴포넌트화 |
| 레이아웃 | Row/Column/Grid 변경, 정렬, 간격, 크기 모드, 반응형 규칙 추가 |
| 스타일 | 색상 토큰, 테두리, 반경, 타이포그래피 |
| 의미 | 버튼 지정, 목록 지정, 반복 컴포넌트 지정, 기존 컴포넌트 연결 |
| 구현 | 기능 그룹 지정, 우선순위 설정, 컴포넌트 분리, 구현 티켓 생성 |

## 자연어 요청의 적용 범위

가장 자주 생기는 문제는 "어디를 바꾸라는 것인지" 모호하다는 점이다. 입력창 위에 작업 범위를 항상 표시한다.

```
적용 대상
○ 현재 선택 요소: ProductCard
○ 현재 화면: Product List
○ 전체 프로젝트
```

기본값:

| 상태 | 기본 범위 |
|---|---|
| 요소를 선택함 | 선택 요소 |
| 아무것도 선택 안 함 | 현재 화면 |
| 전체 프로젝트 | 사용자가 명시적으로 선택해야만 |

전체 프로젝트 변경은 위험하므로 자연어로 자동 판단하게 두지 않는다.

## 변경 미리보기와 승인

변경 규모에 따라 다르게 처리한다.

**작은 변경** — 바로 적용하고 알림만 띄운다.

```
ProductGrid의 gap을 24px에서 16px로 변경했습니다.  [되돌리기]
```

**큰 변경** — 적용 전에 계획을 보여준다.

```
예상 변경 사항
- Sidebar를 Drawer로 변경
- Header에 MenuButton 추가
- MetricGrid를 3열에서 1열로 변경
- 8개 노드 수정, 2개 노드 추가

[적용] [계획 수정] [취소]
```

기준은 변경되는 노드 수나 구조 변경 여부로 판단한다.

> MVP에서는 모든 요청을 계획 단계 없이 바로 적용하고 Undo로 대응해도 된다. 계획 확인은 복잡한 변경에만 넣는 것이 장기적으로 자연스럽다.

## Undo / Redo

자연어 편집에서 Undo는 필수다. 직접 조작과 자연어 조작을 **같은 명령 로그**에 저장한다.

```
1. AI: Dashboard 구조 생성
2. 사용자: Sidebar 너비 변경
3. AI: MetricCard 3개 추가
4. 사용자: ProductTable 위치 이동
5. AI: 모바일 레이아웃 적용
```

AI가 한 요청으로 여러 노드를 수정했다면 그 요청 전체를 하나의 트랜잭션으로 묶는다.

```json
{
  "transactionId": "tx-105",
  "source": "natural-language",
  "prompt": "모바일에서는 카드가 한 줄에 하나씩 보이게 해줘",
  "commands": [ ... ]
}
```

## 기능(동작) 정의

사용자는 시각 배치뿐 아니라 동작도 자연어로 설명할 수 있다. AI는 이를 코딩하지 않고 동작 스펙으로 저장한다.

```json
{
  "interactions": [
    { "source": "product-search-input", "event": "change",
      "action": { "type": "filter", "target": "product-list", "field": "name" } },
    { "source": "product-card", "event": "click",
      "action": { "type": "navigate", "target": "/products/:productId" } }
  ]
}
```

> 위 형태의 인터랙션 스펙은 IR 스키마(현재 0.3)의 제외 범위다. v0.1 동결 때부터 제외였고 v0.2·v0.3과 반응형 선택
> 확장(#245)에서도 `events`·`props`·`bindings`는 들어오지 않았다. `button`·`input`의 `content`·`placeholder`도
> 표시용 텍스트일 뿐이다. [05-schema.md](05-schema.md)의 MVP 제외 범위,
> [06-schema-freeze.md](06-schema-freeze.md)의 "이 계약이 보장하지 않는 것" 참고.
>
> **예외 — 화면 관계(#265).** 위 예시 가운데 화면 이동은 형태를 바꿔 MVP 범위에 들어왔다. `button` 노드에
> `action` 하나를 두며, 갈래는 페이지 이동·모달 열기·닫기 세 가지다. navigate/openModal의 대상은 URL 경로
> (`/products/:productId`)가 아니라 같은 프로젝트의 PageId다. close는 target이 없고 modal/widget의 button에
> 허용하며, page 자체 button에서는 오류로 제안한다(24 D4·D6). 화면 종류(`kind`)와 재사용 위젯(`instance`)도 함께 들어온다. 설계는
> [24](24-screen-relations-design.md), 범위와 단계는 [02](02-mvp-scope.md#화면-관계-265)에 있다.
> **현재 제공 범위는 S1-1 저장 형태와 임시 차단이다(#355).** 선택 kind/action은 보존하지만 이 필드의 Command 편집과
> 관계 화면의 코드 생성·출력 수용·Export는 차단한다. 참조 검증은 S1-2, 자연어로 연결을 만드는 일은 S1-10이다. 제품 방향의 범위 반영이 팀 계약·단계 채택이나 후속 착수·병합 승인은 아니다(02의 계획 차이 표).
> 예시의 `filter`, `change` 같은 이벤트 이름, 카드처럼 button이 아닌 노드의 클릭, URL 대상은 계속 제외다.
>
> **정정 이력 (2026-10-10, #265 S0-2)**
> 이 메모는 인터랙션 전체를 제외라고만 적어 #265 설계([24](24-screen-relations-design.md), #339)와 맞지 않았다.
> 화면 관계 예외 문단을 더했다. 후속 검토에서 close의 대상 없음·허용 문맥과 #355 구현/develop 미반영을 구분했다. 제공 기능은 바뀌지 않았다.

## 대표 사용 플로우 3가지

### A. Prompt-first

```
설치 → localhost 실행 → "쇼핑몰 메인 페이지를 만들어줘"
→ AI가 전체 구조 생성 → 직접 미세 조정 → 구현
```

빠르게 초안을 만들고 싶은 사용자에게 적합하다.

### B. Canvas-first

```
설치 → localhost 실행 → 빈 화면
→ 컨테이너와 요소를 직접 배치 → 필요한 부분만 자연어 보정 → 구현
```

구조를 직접 통제하고 싶은 사용자에게 적합하다.

### C. Conversation-first

```
설치 → localhost 실행 → "먼저 헤더를 만들어줘" → 확인
→ "그 아래에 카드 3개를 추가해줘" → 확인
→ "이제 테이블을 넣어줘" → 직접 위치 수정 → 구현
```

한 단계씩 대화하며 조립하는 방식이다. 이 세 번째가 제품의 차별적인 사용 방식이 될 수 있다.

세 방식은 배타적인 모드가 아니다. **어떻게 시작하든 이후에는 자연어와 직접 조작을 자유롭게 섞을 수 있다.** 이 점이 홈화면 설계의 전제이기도 하다 — [04-gui-spec.md](04-gui-spec.md) 참고.

> **S1-1 통합 정정 (2026-10-10, #355)**
> 위 S0-2 이력의 Draft/develop 미반영은 당시 기록이다. 현재 선택 필드 저장·임시 차단만 제공하며
> 후속 관계 기능과 팀 설계·스키마 승인 상태를 완료로 표시하지 않는다.
