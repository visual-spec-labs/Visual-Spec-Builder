import { create } from "zustand";

import type { Node, NodeId, VisualSpec } from "@/features/editor/schema";

import { setByPath } from "./path";
import { seedSpec } from "./seedSpec";

/**
 * 캔버스 · 레이어 트리 · 세부설정 패널이 공유하는 단일 스토어.
 * 계약 상세: docs/EDITOR_STORE_CONTRACT.md
 */
export interface EditorState {
  /** 편집 중인 화면 전체. 직접 수정하지 말고 setNodeField로만 바꾼다. */
  spec: VisualSpec;
  /** 현재 선택된 노드 id. 없으면 null. */
  selectedId: NodeId | null;
  /** 노드 선택/해제. 트리·캔버스가 호출한다. */
  select: (id: NodeId | null) => void;
  /**
   * 선택 노드의 값 하나를 점 표기 경로로 변경한다(불변 업데이트).
   * 예: setNodeField("cardA", "layout.gap", 16)
   * 패널(편집)과 캔버스(드래그)가 호출한다.
   */
  setNodeField: (id: NodeId, path: string, value: unknown) => void;
  /**
   * 스펙 전체를 교체하고 선택을 해제한다(New/Open).
   * selectedId도 함께 초기화한다 — 그러지 않으면 새 스펙에 우연히 같은
   * id(root, cardA 등)가 있을 때 의도치 않은 노드가 선택된 것처럼 보인다.
   * MenuBar가 호출한다.
   */
  loadSpec: (spec: VisualSpec) => void;
  /**
   * 새 노드를 parentId(frame) 자식 목록 끝에 추가하고 선택한다(Import).
   * parentId가 없거나 frame이 아니면 아무 것도 하지 않는다 — 호출자가
   * resolveImportParent 등으로 유효한 frame id를 먼저 골라서 넘겨야 한다.
   */
  insertNode: (parentId: NodeId, id: NodeId, node: Node) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  spec: seedSpec,
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  setNodeField: (id, path, value) =>
    set((state) => {
      const node = state.spec.screen.nodes[id];
      if (node === undefined) {
        return state;
      }

      const nextNode = setByPath(node, path, value);

      return {
        spec: {
          ...state.spec,
          screen: {
            ...state.spec.screen,
            nodes: {
              ...state.spec.screen.nodes,
              [id]: nextNode,
            },
          },
        },
      };
    }),
  loadSpec: (spec) => set({ spec, selectedId: null }),
  insertNode: (parentId, id, node) =>
    set((state) => {
      const parent = state.spec.screen.nodes[parentId];
      if (parent === undefined || parent.type !== "frame") {
        return state;
      }

      return {
        spec: {
          ...state.spec,
          screen: {
            ...state.spec.screen,
            nodes: {
              ...state.spec.screen.nodes,
              [parentId]: { ...parent, children: [...parent.children, { node: id }] },
              [id]: node,
            },
          },
        },
        selectedId: id,
      };
    }),
}));
