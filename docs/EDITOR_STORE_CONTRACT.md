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

## 2. 스토어가 제공하는 것 — 계약의 전부 (15개)

**파일 1개 = 프로젝트 1개**다. 프로젝트는 페이지 여러 장을 담고, 캔버스에는 그중 한 장만 뜬다. 그 한 장을 가리키는 것이 `activePageId`다.

| 이름 | 타입 | 뭐냐 | 누가 쓰나 |
|---|---|---|---|
| `spec` | `ProjectSpec` | 편집 중인 **프로젝트 전체** | 셋 다 **읽음** |
| `activePageId` | `PageId` | 지금 캔버스에 떠 있는 페이지 | 셋 다 **읽음** |
| `selectedId` | `NodeId \| null` | 선택된 노드 id (활성 페이지 안) | 셋 다 **읽음** (하이라이트) |
| `history` | `Record<PageId, HistoryState<ScreenSpec>>` | 페이지별 실행 취소 스택(#40) | 보통 안 읽는다 — `undo`/`redo`가 대신 씀 |
| `select` | `(id: NodeId \| null) => void` | 노드 선택 / 해제 | **트리 · 캔버스**가 호출 |
| `selectPage` | `(id: PageId) => void` | 캔버스에 띄울 페이지 전환 | **트리**가 호출 |
| `setNodeField` | `(id: NodeId, path: string, value: unknown) => void` | 노드 값 하나 변경 | **패널 · 캔버스(드래그)**가 호출 |
| `setPageField` | `(pageId: PageId, path: string, value: unknown) => void` | 페이지 이름 · 크기(해상도) 변경 | **패널**이 호출 |
| `addPage` | `() => void` | 빈 페이지를 끝에 추가하고 이동 | **트리**가 호출 |
| `removePage` | `(id: PageId) => void` | 페이지 삭제 | **트리**가 호출 |
| `loadSpec` | `(spec: VisualSpec \| ProjectSpec) => void` | 스펙 전체 교체 + 선택 해제 + history 초기화(New/Open) | **MenuBar**가 호출 |
| `insertNode` | `(parentId: NodeId, id: NodeId, node: Node) => void` | 새 노드를 parentId(frame) 자식 끝에 추가하고 선택(Import) | **MenuBar**가 호출 |
| `removeNode` | `(id: NodeId) => void` | 노드 삭제. 프레임이면 자손까지 연쇄 삭제, root는 지우지 않음 | **트리**가 호출 |
| `undo` | `() => void` | 활성 페이지를 한 단계 되돌림(#40) | 아직 아무도 안 부름 — 버튼·단축키는 범위 밖 |
| `redo` | `() => void` | 활성 페이지를 한 단계 다시 실행(#40) | 위와 같음 |

### setNodeField·setPageField·removeNode는 이제 Command Engine을 거친다 (#40, #101)

셋 다 **시그니처는 그대로다** — 호출부(패널의 `useNodeField.ts`·`PageProperties.tsx`, 트리의 "표시" 토글·삭제 버튼)는 하나도 안 바뀐다. 달라진 건 내부뿐이다: 이전엔 `setByPath`를 직접 불렀지만, 이제 `command/applyCommand.ts`의 `updateNode`(노드 대상)·`updateScreen`(화면 자신의 `name`·`size` 대상 — #40 리뷰, GAMMJ, PR #102에서 추가)·`deleteNode`(노드 삭제 대상 — #101, `removeNode`가 이 경로로 옮겨오면서 Command Engine이 이미 갖고 있던 연쇄 삭제·root 보호 로직을 그대로 재사용했다) Command를 만들어 적용한다. `02-mvp-scope.md`가 못박은 "GUI는 IR을 직접 수정하지 않고 Command Engine을 호출한다" 제약을 이 함수 안에서 충족한다 — 이슈 #40 참고.

부수 효과로 성공한 변경마다 `history`에도 쌓인다 — `removeNode`도 이제 undo 대상이다. `insertNode`·`addPage`·`removePage`는 **아직 이 경로를 안 거친다** — #40의 변경 범위 밖이다. 그래서 이런 액션 뒤에 바로 `undo`를 부르면, 그 액션의 결과까지 함께 되돌아갈 수 있다(직전 tracked 체크포인트로 점프하므로). `editorStore.ts`의 `reconciledHistory` 주석에 이 한계가 자세히 적혀 있다. `removePage`는 지운 페이지의 `history` 항목도 함께 지운다 — 안 그러면 `generateNodeId`가 빈 순번을 재사용할 때 새 페이지가 지운 페이지의 undo 스택을 이어받는다(#40 리뷰, GAMMJ, PR #102 — 결정적으로 재현됨).

### Undo/Redo는 페이지별로 독립이다

`history`는 페이지 id로 나뉘어 있다 — 페이지 A를 고쳐도 페이지 B의 undo 스택에는 안 걸린다. 아직 한 번도 안 고친 페이지는 `history`에 항목이 없고, `undo`/`redo`는 그 경우 조용히 아무 일도 안 한다.

`loadSpec`(New/Open)은 `history`를 통째로 비운다 — 안 비우면 새로 연 프로젝트가 이전 프로젝트와 우연히 같은 페이지 id(예: 마이그레이션이 항상 만드는 `"page1"`)를 써서 남의 undo 스택을 이어받는 사고가 난다.

**스냅숏은 트랜잭션이 아니라 호출 한 번 단위로 쌓인다.** `ui/properties/fields/useDraftInput.ts`(패널 소유)는 파싱 가능한 키 입력마다 즉시 커밋하므로, 예를 들어 간격 칸에 "16"을 타이핑하면 history에 두 단계가 쌓인다(#40 리뷰, GAMMJ, PR #102). Undo/Redo UI가 없는 지금은 체감되지 않지만, UI가 생기면 debounce나 실제 Transaction 묶음이 필요해진다.

**아직 없는 것 — Undo/Redo를 실제로 부를 UI.** 버튼도 단축키(Cmd/Ctrl+Z)도 없다. 스토어 액션만 있고 아무도 호출하지 않는다 — Command Engine PR(#79)이 `applyCommand`/`history.ts`만 만들고 GUI 연결은 범위 밖으로 남긴 것과 같은 패턴이다.

### 노드를 다루는 함수는 활성 페이지를 알아서 찾는다

`select`와 `setNodeField`, `insertNode`는 **시그니처가 예전 그대로다.** 노드 편집은 언제나 활성 페이지 안에서 일어나므로 스토어가 내부적으로 `spec.pages[activePageId]`를 본다. 호출하는 쪽은 페이지를 신경 쓰지 않아도 된다.

```ts
// 페이지가 생겨도 이 호출들은 하나도 안 바뀐다
select("cardA");
setNodeField("cardA", "layout.gap", 16);
```

노드를 **읽을** 때만 경로가 한 단계 깊어진다.

```ts
const node = useEditorStore((s) => s.spec.pages[s.activePageId].nodes[id]);
```

### 페이지를 바꾸면 선택이 풀린다

`selectPage`는 `activePageId`를 바꾸면서 `selectedId`를 `null`로 되돌린다. 페이지마다 `root`, `cardA` 같은 id가 겹치므로, 그대로 두면 엉뚱한 노드가 선택된 것처럼 보인다. `loadSpec`이 선택을 초기화하는 것과 같은 이유다.

없는 페이지 id를 넘기면 아무 일도 일어나지 않는다.

### 마지막 페이지는 지울 수 없다

`removePage`는 페이지가 한 장뿐이면 무시한다. `pages`가 비면 캔버스가 그릴 것이 없어지고 스키마의 `minProperties: 1`도 깨진다.

활성 페이지를 지우면 **같은 자리에 올라온 이웃**으로 옮겨 간다. 마지막 장을 지웠으면 그 앞 페이지로 간다.

### loadSpec은 v0.1도 받는다

`loadSpec`은 `VisualSpec`(v0.1 화면 파일)과 `ProjectSpec`(v0.2 프로젝트 파일)을 모두 받는다. v0.1이 들어오면 `migrateV01`로 페이지 1장짜리 프로젝트로 넓힌다. **그래서 예전에 저장한 파일도 그대로 열리고, MenuBar는 어느 버전인지 몰라도 된다.**

`insertNode`는 `parentId`가 없거나 frame이 아니면 아무 것도 하지 않는다 — 호출자가
`resolveImportParent`(`store/resolveImportParent.ts`, 순수 함수)로 유효한 frame id를
먼저 골라서 넘겨야 한다. 새 노드 id는 `store/nodeId.ts`의 `generateNodeId`로 만든다.

### removeNode는 root를 지우지 않고, 지운 노드가 자손이면 연쇄 삭제한다

`removeNode`는 `command/applyCommand.ts`의 `deleteNode` Command로 적용된다. 페이지 `root`를 넘기면 무시한다 — `removePage`가 마지막 페이지를 막는 것과 같은 이유로, root가 없으면 스키마가 깨진다. 지우려는 노드가 프레임이면 그 자손까지 전부 지운다(고아 노드를 남기지 않기 위해서). 지운 노드나 그 자손이 `selectedId`였으면 선택을 해제한다 — 없는 노드를 계속 선택 상태로 두면 패널이 그 노드를 못 찾는다. `setNodeField`와 같은 이유로 `history`에도 쌓이므로 `undo`로 되돌릴 수 있다.

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
| **읽기** | `spec`, `activePageId`, `selectedId` | `spec`, `activePageId`, `selectedId` | `spec`, `activePageId`, `selectedId` |
| **호출** | 노드 클릭 → `select(id)`<br>**페이지 폴더 클릭 → `selectPage(id)`**<br>페이지 추가/삭제 → `addPage` / `removePage`<br>노드 삭제 → `removeNode(id)` | 노드 클릭 → `select(id)`<br>드래그/리사이즈 → `setNodeField` | 값 편집 → `setNodeField`<br>페이지 이름·해상도 → `setPageField` |
| **역할** | 루트에 페이지 폴더, 그 아래 계층 트리 + 선택 표시 | **활성 페이지** 렌더 + 선택 표시 | 선택 노드 · 활성 페이지 속성 편집 |

**연결은 이게 전부다.** 트리/캔버스가 `select(id)`만 불러주면 패널이 그 노드에 맞게 알아서 바뀌고,
패널이 `setNodeField`로 값을 바꾸면 캔버스가 알아서 다시 그린다.

---

## 4. 스키마 타입은 정해진 경로에서만 import

`SCHEMA_V0.1_FREEZE.md` 규칙 그대로. 셋 다 여기서만 가져온다.

```ts
import type {
  ProjectSpec,
  VisualSpec,
  ScreenSpec,
  PageId,
  Node,
  FrameNode,
  TextNode,
  ImageNode,
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

**Image 노드**

Import로 삽입은 되지만 세부설정 패널에는 아직 편집 필드가 없다(플레이스홀더만 표시).
`box.width/height`는 삽입 시점의 이미지 원본 픽셀 크기로 채워진다.

> **X / Y / Rotation / Shadow는 아직 없음.** 스키마 v0.1이 Auto Layout 전용이라 절대좌표·회전·그림자 필드가 없다.
> 필요해지면 스키마 v0.2로 확장한다(아래 규칙 참고). 패널은 그때 필드 한 줄만 추가하면 되도록 설계돼 있다.

---

## 6. 지킬 규칙 (팀 공통)

1. **`spec`을 직접 수정하지 않는다.** 반드시 `setNodeField` / `setPageField`(또는 `select` / `selectPage`)를 통해서만 변경한다.
2. 스토어 외의 곳에서 선택 상태/스펙을 따로 두지 않는다.
3. 스키마 확장(rotation, shadow, 절대좌표 등)은 **별도 PR + 팀 합의**로만 한다(`SCHEMA_V0.1_FREEZE.md §변경 규칙`).
   - `visual-spec.schema.json` 수정 → `pnpm generate:types` → 예제·테스트 갱신 → typecheck·test 통과.
4. 파일 소유: **패널 내부는 내가, 트리·캔버스는 팀원이** 담당한다. 서로의 파일은 건드리지 않는다.

---

## 7. 통합 전에 각자 독립 개발하는 법

- 스토어는 `examples/dashboard-cards.json`을 초기값으로 시드해 둔다.
  → 트리·캔버스·패널이 아직 없어도 각자 실제 데이터로 개발/테스트 가능.
- 트리/캔버스가 준비되면 같은 스토어에 `select`만 연결하면 즉시 맞물린다.
