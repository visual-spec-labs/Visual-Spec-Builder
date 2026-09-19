import { create } from "zustand";

import { applyTransaction } from "@/features/editor/command/applyCommand";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  initHistory,
  pushHistory,
  redo as historyRedo,
  replacePresent,
  undo as historyUndo,
  type HistoryState,
} from "@/features/editor/command/history";
import type { Command } from "@/features/editor/command/types";
import { migrateV01 } from "@/features/editor/schema";
import type {
  Node,
  NodeId,
  PageId,
  ProjectSpec,
  ScreenSpec,
  VisualSpec,
} from "@/features/editor/schema";

import { blankSpec } from "./blankSpec";
import { generateNodeId } from "./nodeId";
import { seedSpec } from "./seedSpec";
import { loadStoredSpec } from "./specStorage";

/**
 * 이슈 #128 — localStorage에 자동저장된 프로젝트가 있으면 그걸로 시작하고,
 * 없거나 깨졌으면(검증 실패) 시드로 시작한다. 시드는 v0.1 예제라 페이지
 * 1개짜리 프로젝트로 넓힌다. 실제 저장은 App.tsx가 spec 변경을 구독해서 한다
 * (이 파일에 넣지 않은 이유는 그러면 이 스토어를 import하는 모든 테스트가
 * 매번 디바운스 타이머를 만들게 되기 때문이다).
 */
const initialSpec = loadStoredSpec() ?? migrateV01(seedSpec);

/**
 * Undo/Redo 한 단계의 단위 — 프로젝트 전체와 그때 보고 있던 페이지를 함께 담는다.
 *
 * #40에서는 `Record<PageId, HistoryState<ScreenSpec>>`(페이지별 독립 스택)이었다.
 * #131에서 단위를 프로젝트로 올렸다. 이유는 두 가지다.
 *
 * 1. `removePage`는 페이지별 스택으로는 되돌릴 수가 없다 — 되돌릴 내용(지워지는
 *    페이지의 스택)이 지우는 것과 함께 사라지고, 애초에 `pages`·`pageOrder`는
 *    ScreenSpec 하나에 담기지 않는다. 지금 데이터 유실이 나는 곳이 여기였다.
 * 2. 그래서 페이지 조작만 담는 스택을 따로 두는 안(이슈 #131의 후보 (a))도
 *    있었지만, 스택이 둘이면 "페이지 추가 → 노드 편집 → undo 두 번"의 순서를
 *    어느 한쪽만 보고 정할 수 없다 — 둘 사이의 시간 순서를 또 따로 기억해야
 *    한다. 스택 하나면 그 문제가 생기지 않는다.
 *
 * 대가는 **undo가 프로젝트 전체에서 마지막 편집 하나를 되돌린다**는 것이다 —
 * 페이지별 독립이 없어진다. 대신 되돌린 편집이 있던 페이지로 함께 옮겨 가므로
 * (스냅숏이 `activePageId`를 들고 있는 이유다) 보고 있지 않은 페이지가 조용히
 * 바뀌는 일은 없다. `addPage`를 되돌리는 경우에는 필수다 — 지금 보고 있는 그
 * 페이지가 사라지므로 `activePageId`를 같이 되돌리지 않으면 없는 페이지를
 * 가리킨다.
 *
 * 스냅숏은 `spec`을 통째로 들지만 안 건드린 페이지는 참조를 그대로 공유한다
 * (`withPage`) — 한 단계가 실제로 더 쓰는 메모리는 얕은 객체 두 개다.
 */
export interface EditorSnapshot {
  spec: ProjectSpec;
  activePageId: PageId;
}

/** `setNodeFields`가 한 번에 적용할 노드 필드 변경 하나. */
export interface NodeFieldPatch {
  id: NodeId;
  path: string;
  value: unknown;
}

/**
 * 캔버스 · 레이어 트리 · 세부설정 패널이 공유하는 단일 스토어.
 * 계약 상세: docs/EDITOR_STORE_CONTRACT.md
 */
export interface EditorState {
  /** 편집 중인 프로젝트 전체. 직접 수정하지 말고 아래 함수로만 바꾼다. */
  spec: ProjectSpec;
  /** 지금 캔버스에 떠 있는 페이지 id. 항상 spec.pages 안에 있다. */
  activePageId: PageId;
  /** 현재 선택된 노드 id. 없으면 null. 활성 페이지 안의 id다. */
  selectedId: NodeId | null;
  /**
   * 프로젝트 하나의 실행 취소 스택(#40, 단위는 #131에서 프로젝트로 올렸다 —
   * EditorSnapshot 주석 참고). spec을 바꾸는 모든 액션이 성공할 때마다 여기에
   * 쌓이므로 `present`는 항상 지금 상태와 같다. 그래서 되돌릴 것이 있는지는
   * `command/history.ts`의 `canUndo`/`canRedo`에 그대로 물으면 된다.
   */
  history: HistoryState<EditorSnapshot>;
  /** 노드 선택/해제. 트리·캔버스가 호출한다. */
  select: (id: NodeId | null) => void;
  /**
   * 캔버스에 띄울 페이지를 바꾸고 선택을 해제한다.
   * selectedId를 비우는 이유는 loadSpec과 같다 — 페이지마다 root, cardA 같은
   * id가 겹치므로 그대로 두면 엉뚱한 노드가 선택된 것처럼 보인다.
   * 레이어 트리가 호출한다.
   */
  selectPage: (id: PageId) => void;
  /**
   * 활성 페이지에 있는 노드의 값 하나를 점 표기 경로로 변경한다(불변 업데이트).
   * 예: setNodeField("cardA", "layout.gap", 16)
   * 패널(편집)과 캔버스(드래그)가 호출한다.
   *
   * #40: 내부적으로 command/applyCommand.ts의 updateNode Command를 만들어
   * 적용한다 — "GUI는 IR을 직접 수정하지 않고 Command Engine을 호출한다"는
   * 02-mvp-scope.md 제약을 이 함수 안에서 충족한다. 시그니처는 그대로라
   * 대부분의 호출부는 이 변화를 모른다. 성공한 변경마다 history에도 쌓인다.
   *
   * `continueEdit`(#121, 기본 false)이 true면 새 단계를 쌓지 않고 present만
   * 갈아 끼운다 — 직전 호출이 만든 undo 체크포인트에 이번 값을 겹쳐 쓴다.
   * **호출하는 쪽이 "이건 같은 편집의 다음 글자다"를 알 때만 true를 넘긴다**
   * (`ui/properties/fields/useDraftInput.ts`가 타이핑 burst를 추적해서 넘긴다).
   * 기본값 false라 캔버스 드래그·레이어 트리 표시 토글처럼 이 매개변수를
   * 모르는 기존 호출부는 전과 똑같이 호출마다 새 단계를 쌓는다.
   */
  setNodeField: (id: NodeId, path: string, value: unknown, continueEdit?: boolean) => void;
  /**
   * 활성 페이지의 여러 노드 필드를 한 동작으로 바꾼다(#149).
   * 모든 patch를 순서대로 적용한 최종 결과만 한 번 set하고 history에도 한 단계만
   * 쌓는다. 크기 맞추기·정렬·다중 선택처럼 사용자 동작 하나가 여러 노드에 걸칠 때
   * 쓴다. 빈 배열이나 전부 no-op인 배열은 아무 단계도 만들지 않는다.
   *
   * `continueEdit`은 setNodeField와 같은 뜻이다. 다중 선택된 노드의 값을 입력칸
   * 하나로 연속 편집할 때, 두 번째 batch부터 true를 넘기면 첫 batch가 만든 undo
   * 단계에 이어 붙는다.
   *
   * 생성·삭제·이동은 포함하지 않는다. 그 액션들은 selectedId 변경/해제 규칙까지
   * 동반하므로 필드 patch와 같은 배치 계약으로 묶지 않고 필요할 때 별도로 정한다.
   */
  setNodeFields: (patches: readonly NodeFieldPatch[], continueEdit?: boolean) => void;
  /**
   * 페이지 자체의 값을 바꾼다. 이름과 크기(해상도)가 대상이다.
   * 예: setPageField("home", "size.width", 1920)
   * 패널이 호출한다.
   *
   * #40 리뷰(GAMMJ, PR #102): setNodeField와 같은 이유로 이것도 Command
   * Engine(updateScreen)을 거치고 history에 쌓인다 — 시그니처는 그대로다.
   * 안 그러면 "노드 편집 → 해상도 변경 → undo"가 둘 다 되돌리는 놀람이 있었다.
   * `continueEdit`도 setNodeField와 같다(#121) — 기본 false.
   */
  setPageField: (pageId: PageId, path: string, value: unknown, continueEdit?: boolean) => void;
  /**
   * 빈 페이지를 끝에 추가하고 그 페이지로 이동한다. 트리가 호출한다.
   * #131: history에 쌓인다 — undo하면 추가된 페이지가 사라지고 직전에 보던
   * 페이지로 돌아간다.
   */
  addPage: () => void;
  /**
   * 페이지를 지운다. 마지막 한 장은 지우지 않는다 — pages가 비면 캔버스가
   * 그릴 것이 없어지고 스키마의 minProperties도 깨진다.
   * 활성 페이지를 지우면 같은 자리의 이웃으로 옮겨 간다.
   *
   * #131: history에 쌓인다 — undo하면 지운 페이지와 그 노드 전부가 돌아온다.
   * 그 전까지는 이 조작만 되돌릴 방법이 없어서 그대로 데이터 유실이었다.
   */
  removePage: (id: PageId) => void;
  /**
   * 스펙 전체를 교체하고 선택을 해제한다(New/Open).
   * v0.1 문서를 받으면 페이지 1개짜리 프로젝트로 넓힌다. 그래서 기존 파일도
   * 그대로 열리고, 호출자(MenuBar)는 어느 버전인지 신경 쓰지 않아도 된다.
   */
  loadSpec: (spec: VisualSpec | ProjectSpec) => void;
  /**
   * 새 노드를 활성 페이지의 parentId(frame) 자식 목록 끝에 추가하고 선택한다(Import).
   * parentId가 없거나 frame이 아니면 아무 것도 하지 않는다 — 호출자가
   * resolveImportParent 등으로 유효한 frame id를 먼저 골라서 넘겨야 한다.
   *
   * #131: setNodeField와 같은 이유로 command/applyCommand.ts의 createNode
   * Command를 거치고 history에도 쌓인다 — 삽입 직후 undo 한 번이 그 노드만
   * 지운다. Import(이미지)·도구 모음·트리의 프레임 추가가 모두 이 함수를 쓰므로
   * 셋 다 되돌릴 수 있다. 이미 있는 id는 덮어쓰지 않는다(applyCreateNode).
   */
  insertNode: (parentId: NodeId, id: NodeId, node: Node) => void;
  /**
   * 활성 페이지에서 노드 하나를 지운다. command/applyCommand.ts의 deleteNode
   * Command를 통해 적용된다 — 그 노드가 프레임이면 자손까지 연쇄 삭제하고,
   * 페이지 root는 지우지 않는다(스키마가 root를 필수로 요구하므로 —
   * removePage가 마지막 페이지를 막는 것과 같은 이유). setNodeField와 같은
   * 이유로 history에도 쌓인다. 지운 노드나 그 자손이 선택 중이었으면
   * selectedId를 비운다. 레이어 트리가 호출한다.
   */
  removeNode: (id: NodeId) => void;
  /**
   * 활성 페이지에서 노드를 newParentId(frame)의 children 중 index 위치로
   * 옮긴다. command/applyCommand.ts의 moveNode Command를 통해 적용된다 —
   * root는 옮기지 않고, 자기 자신이나 자기 자손 밑으로는 못 옮긴다(순환
   * 방지, applyMoveNode가 이미 한다). setNodeField와 같은 이유로 history에도
   * 쌓인다. 레이어 트리가 드래그로 순서를 바꿀 때 호출한다.
   */
  moveNode: (id: NodeId, newParentId: NodeId, index: number) => void;
  /**
   * 프로젝트의 마지막 편집을 한 단계 되돌린다. 되돌릴 것이 없으면 아무 일도
   * 안 한다. 되돌린 편집이 다른 페이지에 있었으면 그 페이지로 옮겨 간다(#131).
   */
  undo: () => void;
  /** 되돌린 편집을 한 단계 다시 실행한다. 다시 실행할 것이 없으면 아무 일도 안 한다. */
  redo: () => void;
}

function hasKey(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/** 페이지 하나만 갈아 끼운 새 spec. 나머지 페이지는 참조가 그대로 유지된다. */
function withPage(
  spec: ProjectSpec,
  pageId: PageId,
  page: ScreenSpec,
): ProjectSpec {
  return { ...spec, pages: { ...spec.pages, [pageId]: page } };
}

/**
 * Undo 스냅숏 하나를 만든다. `applied`·`addPage`·`removePage`가 전부 이걸 쓴다.
 *
 * #131 리뷰(wook3964, PR #142): 세 곳이 각자 `{ spec, activePageId }`를 직접
 * 조립하고 있었다. EditorSnapshot에 필드가 늘면(예: selectedId) 세 곳을 손으로
 * 맞춰야 하고, 하나를 놓쳐도 타입이 잡아주지 않은 채 조용히 낡은 스냅숏이
 * 쌓인다. 생성자를 하나로 두면 추가할 곳도 한 곳이다.
 */
function makeSnapshot(spec: ProjectSpec, activePageId: PageId): EditorSnapshot {
  return { spec, activePageId };
}

/**
 * pageOrder는 최소 1개를 보장하는 튜플이라 배열 연산 결과를 그대로 넣을 수 없다.
 * 비지 않음은 호출부가 지킨다(addPage는 더하기만 하고, removePage는 마지막 한 장을 막는다).
 */
function asPageOrder(ids: PageId[]): ProjectSpec["pageOrder"] {
  return ids as ProjectSpec["pageOrder"];
}

/**
 * Command 하나를 pageId 페이지에 적용하고 그 결과를 history에 한 단계로 얹는다.
 * setNodeField·setPageField·insertNode·removeNode·moveNode가 전부 이 순서를
 * 따르므로(적용 → 아무것도 안 바뀌면 그대로 → 스냅숏 한 단계) 여기 모았다.
 * 페이지 목록까지 바꾸는 addPage·removePage는 Command로 표현되지 않아
 * (applyCommand는 페이지가 여러 장이라는 걸 아예 모른다) 이걸 안 쓴다.
 *
 * 없는 페이지거나 적용 결과가 원본과 같은 참조면(applyCommand가 규칙 위반으로
 * no-op일 때) null을 준다 — 호출부가 state를 그대로 반환해서 history에도 빈
 * 단계가 안 쌓이게 한다.
 *
 * `continueEdit`(#121, 기본 false)이 true면 새 단계를 쌓지 않고 present만
 * 갈아 끼운다 — 직전 호출이 만든 undo 체크포인트에 이번 값을 겹쳐 쓴다.
 * **호출하는 쪽이 "이건 같은 편집의 다음 글자다"를 알 때만 true가 들어온다**
 * (`ui/properties/fields/useDraftInput.ts`가 타이핑 burst를 추적해서 넘긴다).
 * 스토어가 "직전 호출과 같은 키인지" 스스로 추측하는 방식(예: 노드 id·경로가
 * 같으면 병합)은 일부러 안 썼다 — 레이어 트리의 표시 토글처럼 같은 경로를 여러
 * 번 눌러도 매번 별개의 편집인 호출부까지 잘못 병합해버리기 때문이다.
 */
function applied(
  state: EditorState,
  pageId: PageId,
  command: Command,
  continueEdit = false,
): Pick<EditorState, "spec" | "history"> | null {
  return appliedTransaction(state, pageId, [command], continueEdit);
}

/**
 * Command 여러 개를 한 페이지 사본에 먼저 적용하고 최종 결과만 history에 얹는다.
 * Zustand의 set 콜백 한 번 안에서 호출되므로 중간 화면은 구독자에게 보이지 않는다.
 */
function appliedTransaction(
  state: EditorState,
  pageId: PageId,
  commands: Command[],
  continueEdit = false,
): Pick<EditorState, "spec" | "history"> | null {
  const page = state.spec.pages[pageId];
  if (page === undefined) return null;

  const nextPage = applyTransaction(page, commands);
  if (nextPage === page) return null;

  const spec = withPage(state.spec, pageId, nextPage);
  // 스냅숏의 activePageId는 `state.activePageId`가 아니라 편집이 일어난 `pageId`다.
  // 이 단계로 undo/redo하면 바뀐 내용이 눈앞에 있어야 한다(#131, PR #142).
  const next = makeSnapshot(spec, pageId);

  return {
    spec,
    history: continueEdit
      ? replacePresent(state.history, next)
      : pushHistory(state.history, next),
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  spec: initialSpec,
  activePageId: initialSpec.pageOrder[0],
  selectedId: null,
  history: initHistory(makeSnapshot(initialSpec, initialSpec.pageOrder[0])),
  select: (id) => set({ selectedId: id }),
  selectPage: (id) =>
    set((state) => {
      if (id === state.activePageId || !hasKey(state.spec.pages, id)) {
        return state;
      }

      // 페이지 전환은 편집이 아니라 새 단계를 쌓지 않는다. 다만 present는 지금
      // 상태를 그대로 비추고 있어야 한다 — 안 맞춰두면 다음 편집이 past에 밀어
      // 넣는 스냅숏이 "전에 보던 페이지"를 가리켜서, 그 편집을 되돌릴 때 엉뚱한
      // 페이지로 튄다(#131).
      return {
        activePageId: id,
        selectedId: null,
        history: replacePresent(state.history, makeSnapshot(state.spec, id)),
      };
    }),
  setNodeField: (id, path, value, continueEdit = false) =>
    set((state) => {
      // #40: setByPath를 직접 부르는 대신 updateNode Command를 만들어
      // applyCommand로 적용한다 — 결과는 이전과 동일하지만(둘 다 setByPath를
      // 쓴다) 이제 Command Engine을 거친다. 없는 노드 id면 applyUpdateNode가
      // 원본을 그대로 돌려주므로 applied가 null을 준다.
      const next = applied(
        state,
        state.activePageId,
        { type: "updateNode", id, path, value },
        continueEdit,
      );
      return next ?? state;
    }),
  setNodeFields: (patches, continueEdit = false) =>
    set((state) => {
      const commands: Command[] = patches.map(({ id, path, value }) => ({
        type: "updateNode",
        id,
        path,
        value,
      }));
      const next = appliedTransaction(
        state,
        state.activePageId,
        commands,
        continueEdit,
      );
      return next ?? state;
    }),
  setPageField: (pageId, path, value, continueEdit = false) =>
    set((state) => {
      const next = applied(
        state,
        pageId,
        { type: "updateScreen", path, value },
        continueEdit,
      );
      return next ?? state;
    }),
  addPage: () =>
    set((state) => {
      const id = generateNodeId("page", state.spec.pages);
      // blankSpec의 nodes를 그대로 물리면 페이지끼리 같은 객체를 공유한다.
      // 지금은 어디서도 변형하지 않지만, 얕게 복사해 그 전제를 없앤다.
      const page: ScreenSpec = {
        ...blankSpec.screen,
        name: `Page ${state.spec.pageOrder.length + 1}`,
        nodes: { ...blankSpec.screen.nodes },
      };

      const spec: ProjectSpec = {
        ...state.spec,
        pages: { ...state.spec.pages, [id]: page },
        pageOrder: asPageOrder([...state.spec.pageOrder, id]),
      };

      return {
        spec,
        // #131: 페이지까지 옮기는 액션이라 스냅숏을 직접 만든다 — undo하면
        // 이 페이지가 사라지므로 activePageId도 함께 되돌아가야 한다.
        history: pushHistory(state.history, makeSnapshot(spec, id)),
        activePageId: id,
        selectedId: null,
      };
    }),
  removePage: (id) =>
    set((state) => {
      if (state.spec.pageOrder.length <= 1 || !hasKey(state.spec.pages, id)) {
        return state;
      }

      const removedAt = state.spec.pageOrder.indexOf(id);
      const nextOrder = state.spec.pageOrder.filter((pageId) => pageId !== id);
      const nextPages = { ...state.spec.pages };
      delete nextPages[id];

      // 지운 자리에 올라온 페이지로 옮긴다. 마지막 장을 지웠으면 그 앞으로.
      const isActive = state.activePageId === id;
      const fallback = nextOrder[Math.min(removedAt, nextOrder.length - 1)];
      const activePageId = isActive ? fallback : state.activePageId;

      const spec: ProjectSpec = {
        ...state.spec,
        pages: nextPages,
        pageOrder: asPageOrder(nextOrder),
      };

      return {
        spec,
        // #131: 스냅숏이 spec 전체라 past에 남은 직전 단계가 지워진 페이지와
        // 그 노드를 전부 들고 있다 — undo 한 번이면 그대로 돌아온다. 페이지별
        // 스택 시절엔 되돌릴 대상(history[id])이 지우는 것과 함께 사라져서
        // (#40 리뷰, GAMMJ, PR #102에서 의도적으로 지웠다) 이 조작만 유일하게
        // 되돌릴 수 없었다. 같은 리뷰가 지적한 "지운 페이지의 스택을 id 재사용
        // 으로 새 페이지가 물려받는" 누수도 스택이 하나가 되면서 사라진다.
        history: pushHistory(state.history, makeSnapshot(spec, activePageId)),
        activePageId,
        selectedId: isActive ? null : state.selectedId,
      };
    }),
  loadSpec: (spec) => {
    const project = "screen" in spec ? migrateV01(spec) : spec;
    set({
      spec: project,
      activePageId: project.pageOrder[0],
      selectedId: null,
      // #40: 완전히 다른 프로젝트로 갈아 끼우는 시점이라 history도 새로 시작
      // 한다. 이어 쓰면 undo 한 번이 방금 연 파일이 아니라 전에 열려 있던
      // 파일의 옛 상태로 튀어버린다 — New/Open은 되돌릴 대상이 아니다.
      history: initHistory(makeSnapshot(project, project.pageOrder[0])),
    });
  },
  insertNode: (parentId, id, node) =>
    set((state) => {
      // #131: 직접 노드를 만들지 않고 createNode Command를 거친다 — parent가
      // frame인지, id가 이미 있는지는 applyCreateNode가 판정한다.
      const next = applied(state, state.activePageId, {
        type: "createNode",
        parentId,
        id,
        node,
      });
      if (next === null) return state;

      return { ...next, selectedId: id };
    }),
  removeNode: (id) =>
    set((state) => {
      // #40과 같은 이유로 deleteNode Command를 통해 적용한다 — root 보호와
      // 연쇄 삭제는 applyDeleteNode(command/applyCommand.ts)가 이미 한다.
      const next = applied(state, state.activePageId, { type: "deleteNode", id });
      if (next === null) return state;

      const nodes = next.spec.pages[state.activePageId].nodes;
      return {
        ...next,
        // 지운 노드나 그 자손이 선택 중이었으면 지운 뒤의 nodes에 더 이상 없다.
        selectedId:
          state.selectedId !== null && nodes[state.selectedId] === undefined
            ? null
            : state.selectedId,
      };
    }),
  moveNode: (id, newParentId, index) =>
    set((state) => {
      // root 보호와 순환 방지는 applyMoveNode(command/applyCommand.ts)가 이미 한다.
      const next = applied(state, state.activePageId, {
        type: "moveNode",
        id,
        newParentId,
        index,
      });
      return next ?? state;
    }),
  undo: () =>
    set((state) => {
      if (!historyCanUndo(state.history)) return state;

      const nextHistory = historyUndo(state.history);
      return {
        spec: nextHistory.present.spec,
        // 되돌린 편집이 다른 페이지에 있었으면 그 페이지로 옮겨 간다. 스냅숏이
        // 늘 짝이 맞는 (spec, activePageId)라 여기서 존재 확인이 필요 없다.
        activePageId: nextHistory.present.activePageId,
        history: nextHistory,
        // 되돌린 뒤의 트리에는 지금 선택된 id가 없을 수 있다(예: undo가 방금
        // 만든 노드를 지운 상태로 되돌림) — select 로직을 새로 만드는 대신
        // loadSpec/selectPage와 같은 원칙(불확실하면 선택을 비운다)을 따른다.
        selectedId: null,
      };
    }),
  redo: () =>
    set((state) => {
      if (!historyCanRedo(state.history)) return state;

      const nextHistory = historyRedo(state.history);
      return {
        spec: nextHistory.present.spec,
        activePageId: nextHistory.present.activePageId,
        history: nextHistory,
        selectedId: null,
      };
    }),
}));
