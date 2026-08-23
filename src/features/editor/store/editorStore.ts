import { create } from "zustand";

import type { NodeId, VisualSpec } from "@/features/editor/schema";

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
}));
