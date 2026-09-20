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

## 2. 스토어가 제공하는 것 — 계약의 전부 (17개)

**파일 1개 = 프로젝트 1개**다. 프로젝트는 페이지 여러 장을 담고, 캔버스에는 그중 한 장만 뜬다. 그 한 장을 가리키는 것이 `activePageId`다.

| 이름 | 타입 | 뭐냐 | 누가 쓰나 |
|---|---|---|---|
| `spec` | `ProjectSpec` | 편집 중인 **프로젝트 전체** | 셋 다 **읽음** |
| `activePageId` | `PageId` | 지금 캔버스에 떠 있는 페이지 | 셋 다 **읽음** |
| `selectedId` | `NodeId \| null` | 선택된 노드 id (활성 페이지 안) | 셋 다 **읽음** (하이라이트) |
| `history` | `HistoryState<EditorSnapshot>` | 프로젝트 하나의 실행 취소 스택(#40, 단위는 #131에서 프로젝트로 올렸다) | 보통 안 읽는다 — `undo`/`redo`가 대신 씀. 트리 footer만 버튼 비활성화 판정에 읽는다 |
| `select` | `(id: NodeId \| null) => void` | 노드 선택 / 해제 | **트리 · 캔버스**가 호출 |
| `selectPage` | `(id: PageId) => void` | 캔버스에 띄울 페이지 전환 | **트리**가 호출 |
| `setNodeField` | `(id: NodeId, path: string, value: unknown, continueEdit?: boolean) => void` | 노드 값 하나 변경 | **패널 · 캔버스(드래그)**가 호출 |
| `setNodeFields` | `(patches: readonly NodeFieldPatch[], continueEdit?: boolean) => void` | 여러 노드 필드를 **한 번의 렌더·Undo 단계**로 변경(#149) | 정렬·배분·크기 맞추기·다중 선택 기능이 호출 |
| `setPageField` | `(pageId: PageId, path: string, value: unknown, continueEdit?: boolean) => void` | 페이지 이름 · 크기(해상도) 변경 | **패널**이 호출 |
| `addPage` | `() => void` | 빈 페이지를 끝에 추가하고 이동 | **트리**가 호출 |
| `removePage` | `(id: PageId) => void` | 페이지 삭제(#131부터 되돌릴 수 있다) | **트리**가 호출 |
| `loadSpec` | `(spec: VisualSpec \| ProjectSpec) => void` | 스펙 전체 교체 + 선택 해제 + history 초기화(New/Open) | **MenuBar**가 호출 |
| `insertNode` | `(parentId: NodeId, id: NodeId, node: Node) => void` | 새 노드를 parentId(frame) 자식 끝에 추가하고 선택(Import) | **MenuBar**가 호출 |
| `removeNode` | `(id: NodeId) => void` | 노드 삭제. 프레임이면 자손까지 연쇄 삭제, root는 지우지 않음 | **트리**가 호출 |
| `moveNode` | `(id: NodeId, newParentId: NodeId, index: number) => void` | 노드를 newParentId의 children 중 index 위치로 옮김. root 이동 불가, 순환 방지 | **트리**가 호출(드래그) |
| `undo` | `() => void` | 프로젝트의 마지막 편집을 한 단계 되돌림(#40, #131) | **트리**가 호출(footer 버튼 · Cmd/Ctrl+Z, #118) |
| `redo` | `() => void` | 되돌린 편집을 한 단계 다시 실행(#40, #131) | **트리**가 호출(footer 버튼 · Cmd/Ctrl+Shift+Z · Ctrl+Y, #118) |

### setNodeField·setNodeFields·setPageField·removeNode·moveNode·insertNode는 Command Engine을 거친다 (#40, #101, #110, #131, #149)

기존 단일 편집 함수의 **시그니처는 그대로다** — 호출부(패널의 `useNodeField.ts`·`PageProperties.tsx`, 트리의 "표시" 토글·삭제 버튼·드래그)는 바뀌지 않는다. 내부에서는 `command/applyCommand.ts`의 `updateNode`·`updateScreen`·`deleteNode`·`moveNode`·`createNode` Command를 만들어 적용한다. `setNodeFields`는 여러 `updateNode` Command를 `applyTransaction`으로 먼저 한 페이지 사본에 적용한 뒤, 최종 결과만 Zustand `set` 한 번과 history 한 단계로 커밋한다. 따라서 중간 노드만 바뀐 화면은 구독자에게 보이지 않는다.

`setNodeFields`의 patch는 입력 순서대로 적용한다. 없는 노드나 허용되지 않은 경로처럼 `applyCommand`가 no-op으로 판정한 patch는 건너뛰고 나머지는 적용하며, 전부 no-op이거나 배열이 비었으면 spec 참조와 history를 그대로 둔다. **이름이 `applyTransaction`이어도 전부 성공하거나 전부 실패하는 원자적 트랜잭션은 아니다.** 유효하지 않은 patch가 섞이면 신호 없이 부분 적용되는 것이 현재 계약이다. `continueEdit`은 `setNodeField`와 같은 계약이라, 다중 선택 입력을 연속 타이핑할 때 두 번째 batch부터 직전 단계에 병합할 수 있다.

이 배치 계약에는 `insertNode`·`removeNode`·`moveNode`를 넣지 않았다. 이 액션들은 `selectedId`를 새 노드로 옮기거나 삭제된 선택을 해제하는 규칙까지 동반해 단순 필드 patch와 결과 계약이 다르다. 여러 구조 변경을 한 동작으로 묶을 실제 기능이 생기면 선택 상태까지 포함한 별도 API로 정한다.

부수 효과로 성공한 변경마다 `history`에도 쌓인다 — `removeNode`·`moveNode`·`insertNode`도 undo 대상이다. **`addPage`·`removePage`는 Command Engine을 안 거치지만 `history`에는 쌓인다**(#131) — `applyCommand`는 화면 한 장(`ScreenSpec`)만 다루고 "페이지가 여러 장"이라는 개념을 아예 모르므로, `pages`·`pageOrder`를 바꾸는 이 둘은 Command로 표현되지 않는다(페이지 단위 Command는 필요해지면 별도 이슈로 다룬다). 스토어가 직접 스냅숏을 만들어 얹는다.

이제 `spec`을 바꾸는 모든 액션이 `history`에 쌓이므로 **"이 액션 뒤에 바로 `undo`를 부르면 그 앞의 편집까지 함께 되돌아간다"는 #40의 한계는 없어졌다.** 그걸 방어하던 `editorStore.ts`의 `reconciledHistory`(push·점프 직전에 `present`를 실제 현재 상태로 맞춰주던 함수)도 함께 지웠다 — `present`가 낡을 수 있는 경로 자체가 없어졌다. 대신 `selectPage`는 새 단계를 쌓지 않으면서 `present`의 `activePageId`만 갈아 끼운다(페이지 전환은 편집이 아니지만, 안 맞춰두면 다음 편집이 past에 밀어 넣는 스냅숏이 "전에 보던 페이지"를 가리킨다). `removePage`가 지운 페이지의 `history` 항목을 지우던 처리(#40 리뷰, GAMMJ, PR #102)도 사라졌다 — 스택이 페이지 id로 묶여 있지 않으니 `generateNodeId`의 id 재사용으로 남의 undo 스택을 물려받는 누수가 구조적으로 불가능하다.

### Undo/Redo는 프로젝트 하나의 스택이다 (#131)

`history`의 한 단계는 `EditorSnapshot`(`{ spec, activePageId }` — `editorStore.ts`가 export한다)이다. **`undo`는 프로젝트 전체에서 마지막 편집 하나를 되돌린다.** 페이지별 독립 스택이었던 #40~#128 시절과 달라진 점이다 — 페이지 A를 고친 뒤 페이지 B에서 `undo`를 누르면 이제 A의 편집이 되돌아간다.

왜 올렸나 — `removePage`를 되돌릴 수 있게 하려면 다른 길이 없었다. 페이지별 스택으로는 되돌릴 내용(지워지는 페이지의 스택)이 지우는 것과 함께 사라지고, 애초에 `pages`·`pageOrder`는 `ScreenSpec` 하나에 담기지 않는다. 페이지 조작만 담는 스택을 따로 두는 안도 있었지만, 스택이 둘이면 "페이지 추가 → 노드 편집 → `undo` 두 번"의 순서를 어느 한쪽만 보고 정할 수 없다(둘 사이의 시간 순서를 또 따로 기억해야 한다). 스택 하나면 그 문제가 생기지 않는다. 자세한 근거는 `editorStore.ts`의 `EditorSnapshot` 주석에 있다.

**스냅숏이 `activePageId`를 함께 들고 있어서, 되돌린 편집이 다른 페이지에 있었으면 캔버스도 그 페이지로 옮겨 간다** — 안 그러면 방금 되돌린 변화가 화면 밖에서 조용히 일어난다. `addPage`를 되돌리는 경우엔 필수다(보고 있던 그 페이지가 사라지므로, 함께 되돌리지 않으면 `activePageId`가 없는 페이지를 가리킨다).

스냅숏은 `spec`을 통째로 들지만 안 건드린 페이지는 참조를 그대로 공유한다(`withPage`) — 한 단계가 실제로 더 쓰는 메모리는 얕은 객체 두 개다.

스냅숏을 만드는 자리는 `editorStore.ts`의 `makeSnapshot(spec, activePageId)` 하나다(#131 리뷰, wook3964, PR #142) — `applied`·`addPage`·`removePage` 셋이 각자 `{ spec, activePageId }`를 조립하고 있으면 `EditorSnapshot`에 필드가 늘 때 세 곳을 손으로 맞춰야 하고, 하나를 놓쳐도 타입이 안 잡아준다. 그 위의 `applied(state, pageId, command, continueEdit?)` 헬퍼가 **"Command 적용 → 결과가 원본과 같은 참조면 `null`(빈 단계를 안 쌓는다) → 스냅숏 한 단계"** 순서를 모아 두고, `setNodeField`·`setPageField`·`insertNode`·`removeNode`·`moveNode`가 전부 이걸 쓴다. `addPage`·`removePage`만 Command로 표현되지 않아 이 헬퍼를 안 거치고 직접 `makeSnapshot`을 쌓는다.

`loadSpec`(New/Open)은 `history`를 새로 시작한다(`initHistory`) — 이어 쓰면 `undo` 한 번이 방금 연 파일이 아니라 전에 열려 있던 파일의 옛 상태로 튀어버린다. New/Open 자신은 되돌릴 대상이 아니다.

**스냅숏은 호출 한 번 단위로 쌓이지만, `continueEdit: true`로 부른 호출은 병합된다(#121).** `ui/properties/fields/useDraftInput.ts`(패널 소유)는 파싱 가능한 키 입력마다 즉시 커밋한다 — 예를 들어 간격 칸에 "16"을 타이핑하면 `setNodeField("cardA", "layout.gap", 1)` → `setNodeField("cardA", "layout.gap", 16, true)`가 연달아 불린다. 두 번째 호출처럼 `continueEdit`이 `true`면 `pushHistory` 대신 `replacePresent`(`command/history.ts`)로 present만 갈아 끼운다 — history에 새 단계를 안 쌓고 직전 체크포인트에 이번 값을 덮어쓴다. **기본값은 `false`다** — 이 매개변수를 모르는 기존 호출부(캔버스 드래그, 레이어 트리 표시 토글)는 그대로 호출마다 새 단계를 쌓는다.

**"같은 편집을 잇는 중인지"는 스토어가 추측하지 않는다.** 노드 id·경로가 같다고 병합하면, 레이어 트리의 "표시" 토글처럼 같은 경로를 반복 호출해도 매번 별개 편집이어야 하는 호출부까지 잘못 합쳐진다. 그래서 병합 여부는 **그걸 실제로 아는 호출부만** 판단한다 — 입력칸이 "지금 이 커밋이 방금 그 타이핑 burst의 다음 글자인지"를 로컬 ref로 추적해뒀다가 `continueEdit`으로 넘긴다. 추적기 자체는 `ui/properties/fields/editBurst.ts`(#132)에 있다 — React를 모르는 순수 구현 `createEditBurst()`와 그걸 컴포넌트 수명 동안 붙들어 두는 훅 `useEditBurst()` 둘로 되어 있고, `useDraftInput`과 `TextField`가 같은 것을 쓴다. 입력칸이 포커스를 잃으면(`handleBlur`/`onBlur` → `burst.end()`) burst가 끝나서 다음 편집(같은 칸이라도)은 `continueEdit: false`로 새 단계를 만든다. `NumberField`/`SizeField`/`ColorField`/`TextField`의 `onChange` prop이 이 두 번째 인자를 받아 그대로 전달해야 병합이 동작한다 — 무시하고 `(value) => ...`처럼 한 인자만 받아도 값 반영 자체는 되지만 그 필드는 키 입력마다 undo 단계가 쌓이는 예전 동작으로 돌아간다.

**`TextField`(노드 이름 · 텍스트 content 등)도 이제 합쳐진다(#132).** 다만 숫자·색상 칸과 달리 `useDraftInput`은 안 쓰고 burst 추적만 쓴다 — 문자열은 파싱할 것이 없어 parse/normalize가 항등이라 draft가 할 일이 없고, draft를 두면 입력칸이 스토어 값이 아니라 로컬 상태로 그려진다. 한글은 IME 조합(`ㄱ`→`가`→`각`) 중에도 매 단계가 `onChange`로 올라오므로 그 사이에 값의 출처를 바꾸면 조합 중인 글자와 커서가 흔들릴 여지가 생긴다(조합 중 올라오는 단계들도 같은 burst라 한 단계로 합쳐진다). `onChange`는 `(value: string, continueEdit?: boolean) => void`로 넓어졌고 `onBlur`가 burst를 끊는다. **값이 그대로면 아예 커밋하지 않는 가드도 들어갔다**(`fields/TextField.tsx:40`) — 글자를 선택해 같은 글자로 덮어쓸 때 실제로 이 입력이 올라온다. 실제로 손댄 호출부는 `PageProperties.tsx:71`의 페이지 이름 칸 하나뿐이었다 — `ContentSection.tsx`의 텍스트 content · `placeholder` · 이미지 `src`는 `useNodeField`의 세터를 그대로 넘기고 있어서 `continueEdit`이 이미 끝까지 이어지고 있었다.

**아직 남은 결함 — 그 가드는 `TextField`에만 있다.** `useDraftInput` 계열(숫자·색상 칸)은 파싱만 성공하면 값이 지금과 같아도 커밋한다. 스토어 쪽은 Command가 같은 참조를 돌려줘 no-op이지만(`applied`가 `null`을 준다), 입력칸의 burst는 그 no-op 커밋으로 이미 시작된 뒤다 — 그래서 **뒤따르는 입력이 `continueEdit: true`로 올라가 직전 *남의* undo 체크포인트를 덮어쓴다.** 예를 들어 간격을 16으로 바꾼 직후 그 칸 맨 앞에 `0`을 하나 넣으면(`"016"` → `Number("016")` = 16, 값은 그대로) burst만 시작되고, 이어서 아무 글자나 더 치는 순간 방금의 "간격 16" 단계가 통째로 사라진다. 고치려면 `useDraftInput`에도 "파싱 결과가 현재 값과 같으면 커밋하지 않는다"를 넣어야 하는데, 값 비교가 타입마다 달라(숫자·색상 문자열·`Size` 유니온) `TextField`의 한 줄짜리 가드처럼 끝나지 않는다 — #132의 범위 밖으로 남겼다.

### Undo/Redo UI (#118)

`ui/LayerTree.tsx` footer에 Undo/Redo 버튼이 있다(비활성화는 `command/history.ts`의 `canUndo`/`canRedo`에 `history`를 그대로 넘겨 판단한다 — 스택이 하나뿐이라(#131) 페이지를 바꿔도 판정이 그대로다. 아직 아무것도 안 고쳤으면 `past`/`future`가 비어서 둘 다 꺼진다). 같은 파일이 `document`에 `keydown` 리스너를 걸어 Cmd/Ctrl+Z(되돌리기)·Cmd/Ctrl+Shift+Z·Ctrl+Y(다시 실행, Windows 관례라 `metaKey`는 안 본다)도 받는다. `event.target`이 input·textarea·`contenteditable`이면 아무 것도 안 한다 — 안 그러면 텍스트 칸에서 브라우저 기본 되돌리기(방금 타이핑한 글자)를 가로채 버린다.

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

**실수로 지웠으면 `undo`로 되돌린다**(#131) — 지운 페이지와 그 노드 전부가 돌아오고 지우기 전에 보던 페이지로 옮겨 간다. #131 전에는 이 조작만 되돌릴 방법이 없어서 그대로 데이터 유실이었다.

### loadSpec은 v0.1도 받는다

`loadSpec`은 `VisualSpec`(v0.1 화면 파일)과 `ProjectSpec`(v0.2 프로젝트 파일)을 모두 받는다. v0.1이 들어오면 `migrateV01`로 페이지 1장짜리 프로젝트로 넓힌다. **그래서 예전에 저장한 파일도 그대로 열리고, MenuBar는 어느 버전인지 몰라도 된다.**

`insertNode`는 `parentId`가 없거나 frame이 아니면(그리고 `id`가 이미 있으면 — #131부터
`createNode` Command가 함께 판정한다) 아무 것도 하지 않는다 — 호출자가
`resolveImportParent`(`store/resolveImportParent.ts`, 순수 함수)로 유효한 frame id를
먼저 골라서 넘겨야 한다. 새 노드 id는 `store/nodeId.ts`의 `generateNodeId`로 만든다.
Import(이미지) · 도구 모음 · 트리의 프레임 추가가 모두 이 함수를 쓰므로 셋 다
`undo` 한 번으로 되돌아간다(#131).

### removeNode는 root를 지우지 않고, 지운 노드가 자손이면 연쇄 삭제한다

`removeNode`는 `command/applyCommand.ts`의 `deleteNode` Command로 적용된다. 페이지 `root`를 넘기면 무시한다 — `removePage`가 마지막 페이지를 막는 것과 같은 이유로, root가 없으면 스키마가 깨진다. 지우려는 노드가 프레임이면 그 자손까지 전부 지운다(고아 노드를 남기지 않기 위해서). 지운 노드나 그 자손이 `selectedId`였으면 선택을 해제한다 — 없는 노드를 계속 선택 상태로 두면 패널이 그 노드를 못 찾는다. `setNodeField`와 같은 이유로 `history`에도 쌓이므로 `undo`로 되돌릴 수 있다.

### moveNode는 root를 옮기지 않고, 자기 자손 밑으로는 못 옮긴다

`moveNode`는 `command/applyCommand.ts`의 `moveNode` Command로 적용된다. 페이지 `root`를 넘기면 무시한다 — 옮길 수 없는 노드라 옮기면 트리 구조 자체가 깨진다. `newParentId`가 옮기려는 노드 자신이거나 그 자손이면 무시한다(순환 방지 — `applyMoveNode`가 `collectSubtreeIds`로 판정한다). `index`는 `newParentId`의 children 길이로 clamp되므로 범위를 벗어나도 안전하다. `setNodeField`와 같은 이유로 `history`에도 쌓이므로 `undo`로 되돌릴 수 있다.

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
| **호출** | 노드 클릭 → `select(id)`<br>**페이지 폴더 클릭 → `selectPage(id)`**<br>페이지 추가/삭제 → `addPage` / `removePage`<br>노드 삭제 → `removeNode(id)`<br>드래그로 순서 변경 → `moveNode(id, newParentId, index)`<br>되돌리기/다시 실행 → `undo` / `redo` | 노드 클릭 → `select(id)`<br>드래그/리사이즈 → `setNodeField` | 값 편집 → `setNodeField`<br>페이지 이름·해상도 → `setPageField` |
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
