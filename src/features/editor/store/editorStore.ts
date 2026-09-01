import { create } from "zustand";

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
import { setByPath } from "./path";
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
   */
  setNodeField: (id: NodeId, path: string, value: unknown) => void;
  /**
   * 페이지 자체의 값을 바꾼다. 이름과 크기(해상도)가 대상이다.
   * 예: setPageField("home", "size.width", 1920)
   * 패널이 호출한다.
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
   */
  insertNode: (parentId: NodeId, id: NodeId, node: Node) => void;
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

export const useEditorStore = create<EditorState>((set) => ({
  spec: initialSpec,
  activePageId: initialSpec.pageOrder[0],
  selectedId: null,
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

      return {
        spec: withPage(state.spec, state.activePageId, {
          ...page,
          nodes: { ...page.nodes, [id]: setByPath(node, path, value) },
        }),
      };
    }),
  setPageField: (pageId, path, value) =>
    set((state) => {
      const page = state.spec.pages[pageId];
      if (page === undefined) {
        return state;
      }

      return { spec: withPage(state.spec, pageId, setByPath(page, path, value)) };
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

      // 지운 자리에 올라온 페이지로 옮긴다. 마지막 장을 지웠으면 그 앞으로.
      const isActive = state.activePageId === id;
      const fallback = nextOrder[Math.min(removedAt, nextOrder.length - 1)];

      return {
        spec: {
          ...state.spec,
          pages: nextPages,
          pageOrder: asPageOrder(nextOrder),
        },
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
}));
