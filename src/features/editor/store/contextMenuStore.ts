import { create } from "zustand";

import type { NodeId } from "@/features/editor/schema";

/**
 * 캔버스 컨텍스트 메뉴가 뜬 대상과 자리(#152).
 *
 * IR도 선택도 아닌 순수 UI 상태라 editorStore와 분리한다(viewStore와 같은
 * 이유). `handleNodeClick`류가 이미 `useEditorStore.getState()`로 직접
 * 읽고 쓰는 모듈 전역 함수라, 이 상태도 같은 방식(getState/훅)으로 다룰 수
 * 있게 별도 스토어로 둔다 — Canvas.tsx의 재귀 트리(RenderNode)에 setter를
 * prop으로 뚫어 내리지 않아도 된다.
 */
export interface ContextMenuTarget {
  nodeId: NodeId;
  x: number;
  y: number;
}

interface ContextMenuState {
  target: ContextMenuTarget | null;
  open: (target: ContextMenuTarget) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
