# 에디터 상태 공유 계약 (Store Contract)

캔버스 · 레이어 트리 · 세부설정 패널이 **하나의 Zustand 스토어**를 공유해 서로 연결되는 방식을 정의한다.
세 파트를 각자 다른 사람이 만들더라도 이 계약만 지키면 자동으로 맞물린다.

> 한 줄 요약: **스토어 하나만 같이 쓰면 끝.** 트리·캔버스는 `select(id)`만 부르고, 패널은 `setNodeField`로 값만 바꾼다.

---

## 1. 진실 원천은 스토어 하나

파일: `src/features/editor/store/editorStore.ts`

세 파트 모두 이 스토어 **하나만** 구독한다. 각자 별도의 상태(로컬 useState 등)로 선택/스펙을 관리하지 않는다.

```ts
import { useEditorStore } from "@/features/editor/store/editorStore";
```

---

## 2. 스토어가 제공하는 것 — 계약의 전부 (5개)

| 이름 | 타입 | 뭐냐 | 누가 쓰나 |
|---|---|---|---|
| `spec` | `VisualSpec` | 편집 중인 화면 전체 데이터 | 셋 다 **읽음** (렌더링) |
| `selectedId` | `NodeId \| null` | 지금 선택된 노드 id | 셋 다 **읽음** (하이라이트) |
| `select` | `(id: NodeId \| null) => void` | 노드 선택 / 해제 | **트리 · 캔버스**가 호출 |
| `setNodeField` | `(id: NodeId, path: string, value: unknown) => void` | 값 하나 변경 | **패널 · 캔버스(드래그)**가 호출 |
| `loadSpec` | `(spec: VisualSpec) => void` | 스펙 전체 교체 + 선택 해제(New/Open) | **MenuBar**가 호출 |

`loadSpec`은 `spec`을 통째로 바꾸면서 `selectedId`도 함께 `null`로 리셋한다.
그러지 않으면 새 스펙에 우연히 같은 id(`root`, `cardA` 등)가 있을 때
의도치 않은 노드가 선택된 것처럼 보일 수 있다.

`setNodeField`의 `path`는 노드 내부 경로를 점(`.`)으로 표기한다.

```ts
setNodeField("cardA", "box.width", 320);
setNodeField("cardA", "layout.gap", 16);
setNodeField("cardA", "background.color", "#FFFFFF");
setNodeField("headerTitle", "typography.fontSize", 24);
```

- 스토어는 이 경로로 **불변 업데이트**를 수행한다(원본을 직접 바꾸지 않음).
- 값이 바뀌면 그 노드를 읽는 모든 파트가 자동으로 다시 그려진다. → "피그마처럼 즉시 반영".

---

## 3. 누가 무엇을 하나

| | **레이어 트리** | **캔버스** | **세부설정 패널** |
|---|---|---|---|
| **담당** | 팀원 | 팀원 | 나 |
| **읽기** | `spec`, `selectedId` | `spec`, `selectedId` | `spec`, `selectedId` |
| **호출** | 노드 클릭 → `select(id)` | 노드 클릭 → `select(id)`<br>드래그/리사이즈 → `setNodeField` | 값 편집 → `setNodeField` |
| **역할** | 계층 트리 렌더 + 선택 표시 | 화면 렌더 + 선택 표시 | 선택 노드 속성 편집 |

**연결은 이게 전부다.** 트리/캔버스가 `select(id)`만 불러주면 패널이 그 노드에 맞게 알아서 바뀌고,
패널이 `setNodeField`로 값을 바꾸면 캔버스가 알아서 다시 그린다.

---

## 4. 스키마 타입은 정해진 경로에서만 import

`SCHEMA_V0.1_FREEZE.md` 규칙 그대로. 셋 다 여기서만 가져온다.

```ts
import type {
  VisualSpec,
  ScreenSpec,
  Node,
  FrameNode,
  TextNode,
  NodeId,
} from "@/features/editor/schema";
```

---

## 5. 지금 편집 가능한 필드 (스키마 v0.1 범위)

세부설정 패널은 v0.1에 실제로 존재하는 필드만 다룬다.

**Frame 노드**

| 섹션 | 필드 | 경로 |
|---|---|---|
| Layout | 방향 / 간격 / 패딩 / 주축 정렬 / 교차축 정렬 | `layout.direction`, `layout.gap`, `layout.padding.*`, `layout.mainAxis`, `layout.crossAxis` |
| Size | width / height | `box.width`, `box.height` |
| Background | 배경색 | `background.color` |
| Border | 두께 / 색 / 라운드 | `border.width`, `border.color`, `border.radius` |
| 기타 | 표시 여부 | `visible` |

**Text 노드**

| 섹션 | 필드 | 경로 |
|---|---|---|
| Content | 텍스트 내용 | `content` |
| Size | width / height | `box.width`, `box.height` |
| Font | 종류 / 크기 / 굵기 / 행간 / 자간 / 정렬 | `typography.fontFamily`, `typography.fontSize`, `typography.fontWeight`, `typography.lineHeight`, `typography.letterSpacing`, `typography.textAlign` |
| Color | 글자색 | `color` |
| 기타 | 표시 여부 | `visible` |

> **X / Y / Rotation / Shadow는 아직 없음.** 스키마 v0.1이 Auto Layout 전용이라 절대좌표·회전·그림자 필드가 없다.
> 필요해지면 스키마 v0.2로 확장한다(아래 규칙 참고). 패널은 그때 필드 한 줄만 추가하면 되도록 설계돼 있다.

---

## 6. 지킬 규칙 (팀 공통)

1. **`spec`을 직접 수정하지 않는다.** 반드시 `setNodeField`(또는 `select`)를 통해서만 변경한다.
2. 스토어 외의 곳에서 선택 상태/스펙을 따로 두지 않는다.
3. 스키마 확장(rotation, shadow, 절대좌표 등)은 **별도 PR + 팀 합의**로만 한다(`SCHEMA_V0.1_FREEZE.md §변경 규칙`).
   - `visual-spec.schema.json` 수정 → `pnpm generate:types` → 예제·테스트 갱신 → typecheck·test 통과.
4. 파일 소유: **패널 내부는 내가, 트리·캔버스는 팀원이** 담당한다. 서로의 파일은 건드리지 않는다.

---

## 7. 통합 전에 각자 독립 개발하는 법

- 스토어는 `examples/dashboard-cards.json`을 초기값으로 시드해 둔다.
  → 트리·캔버스·패널이 아직 없어도 각자 실제 데이터로 개발/테스트 가능.
- 트리/캔버스가 준비되면 같은 스토어에 `select`만 연결하면 즉시 맞물린다.
