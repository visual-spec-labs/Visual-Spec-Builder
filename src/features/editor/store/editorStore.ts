import { create } from "zustand";

import { applyCommand } from "@/features/editor/command/applyCommand";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  initHistory,
  pushHistory,
  redo as historyRedo,
  undo as historyUndo,
  type HistoryState,
} from "@/features/editor/command/history";
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

/** 시드는 v0.1 예제라 페이지 1개짜리 프로젝트로 넓혀 시작한다. */
const initialSpec = migrateV01(seedSpec);

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
   * 페이지별 실행 취소 스택(#40). 페이지마다 독립적이다 — 다른 페이지를 편집해도
   * 이 페이지의 undo/redo에는 안 걸린다. setNodeField가 성공할 때마다 여기에
   * 쌓인다. 아직 없는 페이지 id는 history가 없다는 뜻이지 에러가 아니다 —
   * undo/redo가 조용히 아무 일도 안 한다.
   */
  history: Record<PageId, HistoryState<ScreenSpec>>;
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
   * 호출부는 이 변화를 모른다. 성공한 변경마다 history에도 쌓인다.
   */
  setNodeField: (id: NodeId, path: string, value: unknown) => void;
  /**
   * 페이지 자체의 값을 바꾼다. 이름과 크기(해상도)가 대상이다.
   * 예: setPageField("home", "size.width", 1920)
   * 패널이 호출한다.
   *
   * #40 리뷰(GAMMJ, PR #102): setNodeField와 같은 이유로 이것도 Command
   * Engine(updateScreen)을 거치고 history에 쌓인다 — 시그니처는 그대로다.
   * 안 그러면 "노드 편집 → 해상도 변경 → undo"가 둘 다 되돌리는 놀람이 있었다.
   */
  setPageField: (pageId: PageId, path: string, value: unknown) => void;
  /** 빈 페이지를 끝에 추가하고 그 페이지로 이동한다. 트리가 호출한다. */
  addPage: () => void;
  /**
   * 페이지를 지운다. 마지막 한 장은 지우지 않는다 — pages가 비면 캔버스가
   * 그릴 것이 없어지고 스키마의 minProperties도 깨진다.
   * 활성 페이지를 지우면 같은 자리의 이웃으로 옮겨 간다.
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
   * #40: 아직 history에 안 쌓인다 — insertNode는 이 PR 범위 밖이다(변경 범위
   * 참고, 이슈 본문). 그래서 insertNode 직후 setNodeField를 부르면 history의
   * 직전 스냅샷이 그 삽입 이전 상태가 되는데, undo 구현이 그 경우도 다루도록
   * 방어해뒀다 — 아래 setNodeField 구현의 주석 참고.
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
  /** 활성 페이지를 한 단계 되돌린다. 되돌릴 것이 없으면 아무 일도 안 한다. */
  undo: () => void;
  /** 활성 페이지를 한 단계 다시 실행한다. 다시 실행할 것이 없으면 아무 일도 안 한다. */
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
 * pageOrder는 최소 1개를 보장하는 튜플이라 배열 연산 결과를 그대로 넣을 수 없다.
 * 비지 않음은 호출부가 지킨다(addPage는 더하기만 하고, removePage는 마지막 한 장을 막는다).
 */
function asPageOrder(ids: PageId[]): ProjectSpec["pageOrder"] {
  return ids as ProjectSpec["pageOrder"];
}

/**
 * 페이지의 히스토리 항목을 가져오되, present를 실제 현재 페이지로 맞춰서 준다.
 * setNodeField(push 직전)와 undo/redo(점프 직전) 양쪽에서 쓴다.
 *
 * insertNode처럼 history를 안 거치는 다른 액션이 그 사이에 페이지를 바꿨을 수
 * 있다(#40 — insertNode는 이 PR 범위 밖이라 손대지 않았다). 그러면
 * history.present가 실제 현재 페이지보다 낡은 채로 남는다.
 *
 * **알려진 한계 — 이 함수로 전부 고쳐지지 않는다.** setNodeField 직전에 맞추면
 * "그다음 setNodeField"부터는 past 사슬이 정확해져서(예: 필드를 두 번 고치는
 * 동안 그 사이의 insertNode도 한 단계는 undo에서 살아남는다), 되짚어 갈 스냅숏
 * 자체가 필요하다는 점은 못 없앤다. **insertNode 하나만 하고 바로 undo를 부르면
 * (그 사이·이후에 setNodeField가 한 번도 없었으면) past에 남아 있는 마지막
 * 스냅숏은 insertNode 이전 것뿐이라, 그 삽입까지 함께 되돌아간다.** insertNode
 * 자체를 추적하는 건 이 PR 범위 밖이다 — 필요해지면 별도 이슈로 다룬다.
 *
 * **또 다른 알려진 한계 — 스냅숏이 트랜잭션이 아니라 setNodeField/setPageField
 * 호출 한 번 단위로 쌓인다.** `ui/properties/fields/useDraftInput.ts`(패널
 * 소유 — 이 PR에서 안 건드림)는 숫자 입력칸에서 파싱 가능한 키 입력마다 즉시
 * onCommit을 부른다. 즉 "16"을 타이핑하면 "1" 커밋 → "16" 커밋으로 history에
 * 두 단계가 쌓인다(#40 리뷰, GAMMJ, PR #102). `history.ts`가 원래 의도한
 * "트랜잭션 하나당 한 번"(PRD 13장)과는 다르다. Undo/Redo를 실제로 부를 UI가
 * 아직 없어서(EDITOR_STORE_CONTRACT.md 참고) 지금 당장 체감되는 문제는 아니라
 * 이 PR에서 고치지 않는다 — UI가 생길 때 debounce/commit-on-blur 같은 처리를
 * useDraftInput 쪽에 넣거나, Command 자체를 묶는 방식(Transaction)을 실제로
 * 쓰기 시작해야 한다.
 */
function reconciledHistory(
  history: Record<PageId, HistoryState<ScreenSpec>>,
  pageId: PageId,
  currentPage: ScreenSpec,
): HistoryState<ScreenSpec> {
  const existing = history[pageId];
  if (existing === undefined) return initHistory(currentPage);
  if (existing.present === currentPage) return existing;
  return { ...existing, present: currentPage };
}

export const useEditorStore = create<EditorState>((set) => ({
  spec: initialSpec,
  activePageId: initialSpec.pageOrder[0],
  selectedId: null,
  history: {},
  select: (id) => set({ selectedId: id }),
  selectPage: (id) =>
    set((state) => {
      if (id === state.activePageId || !hasKey(state.spec.pages, id)) {
        return state;
      }

      return { activePageId: id, selectedId: null };
    }),
  setNodeField: (id, path, value) =>
    set((state) => {
      const page = state.spec.pages[state.activePageId];
      const node = page?.nodes[id];
      if (page === undefined || node === undefined) {
        return state;
      }

      // #40: setByPath를 직접 부르는 대신 updateNode Command를 만들어
      // applyCommand로 적용한다 — 결과는 이전과 동일하지만(둘 다 setByPath를
      // 쓴다) 이제 Command Engine을 거친다.
      const nextPage = applyCommand(page, { type: "updateNode", id, path, value });
      if (nextPage === page) return state;

      const nextHistory = pushHistory(
        reconciledHistory(state.history, state.activePageId, page),
        nextPage,
      );

      return {
        spec: withPage(state.spec, state.activePageId, nextPage),
        history: { ...state.history, [state.activePageId]: nextHistory },
      };
    }),
  setPageField: (pageId, path, value) =>
    set((state) => {
      const page = state.spec.pages[pageId];
      if (page === undefined) {
        return state;
      }

      const nextPage = applyCommand(page, { type: "updateScreen", path, value });
      if (nextPage === page) return state;

      const nextHistory = pushHistory(reconciledHistory(state.history, pageId, page), nextPage);

      return {
        spec: withPage(state.spec, pageId, nextPage),
        history: { ...state.history, [pageId]: nextHistory },
      };
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

      return {
        spec: {
          ...state.spec,
          pages: { ...state.spec.pages, [id]: page },
          pageOrder: asPageOrder([...state.spec.pageOrder, id]),
        },
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

      // #40 리뷰(GAMMJ, PR #102): 여기서 history[id]를 안 지우면 loadSpec이
      // 막은 것과 똑같은 사고가 난다 — generateNodeId가 빈 순번을 재사용해서
      // (지운 페이지가 "page-1"이면 다음 addPage도 "page-1"을 받는다) 새로 만든
      // 빈 페이지가 지운 페이지의 history를 그대로 이어받는다. 그 페이지에서
      // undo 한 번이 "지워진 페이지의 옛 내용"을 불러온다 — 결정적으로 재현됨.
      const nextHistory = { ...state.history };
      delete nextHistory[id];

      // 지운 자리에 올라온 페이지로 옮긴다. 마지막 장을 지웠으면 그 앞으로.
      const isActive = state.activePageId === id;
      const fallback = nextOrder[Math.min(removedAt, nextOrder.length - 1)];

      return {
        spec: {
          ...state.spec,
          pages: nextPages,
          pageOrder: asPageOrder(nextOrder),
        },
        history: nextHistory,
        activePageId: isActive ? fallback : state.activePageId,
        selectedId: isActive ? null : state.selectedId,
      };
    }),
  loadSpec: (spec) => {
    const project = "screen" in spec ? migrateV01(spec) : spec;
    set({
      spec: project,
      activePageId: project.pageOrder[0],
      selectedId: null,
      // #40: 완전히 다른 프로젝트로 갈아 끼우는 시점이라 history도 비운다.
      // 안 비우면 새 프로젝트가 옛 프로젝트와 우연히 같은 페이지 id를 써서
      // (예: 마이그레이션이 항상 만드는 "page1") 남의 히스토리를 이어받는
      // 사고가 난다 — undo 한 번이 방금 연 파일이 아니라 전에 열려 있던
      // 파일의 옛 상태로 튀어버린다.
      history: {},
    });
  },
  insertNode: (parentId, id, node) =>
    set((state) => {
      const page = state.spec.pages[state.activePageId];
      const parent = page?.nodes[parentId];
      if (page === undefined || parent === undefined || parent.type !== "frame") {
        return state;
      }

      return {
        spec: withPage(state.spec, state.activePageId, {
          ...page,
          nodes: {
            ...page.nodes,
            [parentId]: { ...parent, children: [...parent.children, { node: id }] },
            [id]: node,
          },
        }),
        selectedId: id,
      };
    }),
  removeNode: (id) =>
    set((state) => {
      const page = state.spec.pages[state.activePageId];
      if (page === undefined) return state;

      // #40과 같은 이유로 deleteNode Command를 통해 적용한다 — root 보호와
      // 연쇄 삭제는 applyDeleteNode(command/applyCommand.ts)가 이미 한다.
      const nextPage = applyCommand(page, { type: "deleteNode", id });
      if (nextPage === page) return state;

      const nextHistory = pushHistory(
        reconciledHistory(state.history, state.activePageId, page),
        nextPage,
      );

      return {
        spec: withPage(state.spec, state.activePageId, nextPage),
        history: { ...state.history, [state.activePageId]: nextHistory },
        // 지운 노드나 그 자손이 선택 중이었으면 nextPage.nodes에 더 이상 없다.
        selectedId:
          state.selectedId !== null && nextPage.nodes[state.selectedId] === undefined
            ? null
            : state.selectedId,
      };
    }),
  moveNode: (id, newParentId, index) =>
    set((state) => {
      const page = state.spec.pages[state.activePageId];
      if (page === undefined) return state;

      // root 보호와 순환 방지는 applyMoveNode(command/applyCommand.ts)가 이미 한다.
      const nextPage = applyCommand(page, { type: "moveNode", id, newParentId, index });
      if (nextPage === page) return state;

      const nextHistory = pushHistory(
        reconciledHistory(state.history, state.activePageId, page),
        nextPage,
      );

      return {
        spec: withPage(state.spec, state.activePageId, nextPage),
        history: { ...state.history, [state.activePageId]: nextHistory },
      };
    }),
  undo: () =>
    set((state) => {
      const page = state.spec.pages[state.activePageId];
      const pageHistory = reconciledHistory(state.history, state.activePageId, page);
      if (!historyCanUndo(pageHistory)) return state;

      const nextHistory = historyUndo(pageHistory);
      return {
        spec: withPage(state.spec, state.activePageId, nextHistory.present),
        history: { ...state.history, [state.activePageId]: nextHistory },
        // 되돌린 뒤의 트리에는 지금 선택된 id가 없을 수 있다(예: undo가 방금
        // 만든 노드를 지운 상태로 되돌림) — select 로직을 새로 만드는 대신
        // loadSpec/selectPage와 같은 원칙(불확실하면 선택을 비운다)을 따른다.
        selectedId: null,
      };
    }),
  redo: () =>
    set((state) => {
      const page = state.spec.pages[state.activePageId];
      const pageHistory = reconciledHistory(state.history, state.activePageId, page);
      if (!historyCanRedo(pageHistory)) return state;

      const nextHistory = historyRedo(pageHistory);
      return {
        spec: withPage(state.spec, state.activePageId, nextHistory.present),
        history: { ...state.history, [state.activePageId]: nextHistory },
        selectedId: null,
      };
    }),
}));
