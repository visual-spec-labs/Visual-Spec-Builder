import { create } from "zustand";

/**
 * 하단 도구 모음의 활성 도구 전용 스토어.
 *
 * IR/선택 상태를 다루는 editorStore와 분리한다 — 활성 도구는 스펙에 저장되지
 * 않는 순수 UI 상태라서 viewStore(줌·그리드·패널)와 같은 층에 속한다.
 * 활성 도구를 값 하나로 두었으므로 "한 번에 하나만 활성"은 구조적으로 보장된다.
 */
export type ToolId = "select" | "frame" | "text" | "hand";

export interface ToolState {
  /** 지금 선택된 도구. 캔버스가 이 값으로 클릭·드래그 동작을 바꾼다. */
  activeTool: ToolId;
  /**
   * 스페이스바를 누르기 직전의 도구. 누르고 있지 않으면 null.
   *
   * 스페이스 임시 팬(누르는 동안만 손 도구)이 떼었을 때 돌아갈 곳이다. 이 값이
   * null 인지 아닌지가 곧 "지금 스페이스를 누르고 있는가"이기도 하다.
   */
  toolBeforeSpace: ToolId | null;
  setActiveTool: (tool: ToolId) => void;
  beginSpacePan: () => void;
  endSpacePan: () => void;
}

/**
 * 상태를 Canvas의 ref가 아니라 스토어에 두는 이유.
 *
 * 하나는 테스트다 — 이 저장소는 컴포넌트를 렌더할 수 없고(`environment: "node"`),
 * zustand 스토어는 node에서 그대로 돌아간다. 다른 하나는 표시다 — 스페이스를
 * 누르는 동안 도구 모음의 손 버튼이 켜져야 하는데, 그러려면 activeTool 자체가
 * 바뀌어야 한다. 그 덕에 커서(Canvas가 구독)와 팬 동작(getState로 읽음)도 따로
 * 배선할 것 없이 따라온다.
 */
export const useToolStore = create<ToolState>((set, get) => ({
  activeTool: "select",
  toolBeforeSpace: null,

  // 도구를 명시적으로 고르면 임시 팬은 취소된다. 누르고 있던 스페이스를 떼도
  // 되돌리지 않는다 — 방금 고른 도구를 빼앗는 꼴이기 때문이다.
  setActiveTool: (tool) => set({ activeTool: tool, toolBeforeSpace: null }),

  // **이미 누르고 있으면 아무것도 하지 않는다.** 키를 누르고 있으면 keydown이
  // 반복해서 들어오는데, 두 번째에 직전 도구로 "hand"가 저장되면 스페이스를 떼도
  // 손 도구로 돌아와 영영 빠져나갈 수 없다. Canvas 쪽에서 event.repeat로도 한 번
  // 거르지만, 갇히는 대가가 커서 여기서도 막는다.
  beginSpacePan: () => {
    if (get().toolBeforeSpace !== null) return;
    set({ toolBeforeSpace: get().activeTool, activeTool: "hand" });
  },

  // 누르고 있지 않았으면 아무것도 하지 않는다. keyup 과 window blur 양쪽에서
  // 부르므로 중복 호출이 정상 경로다.
  endSpacePan: () => {
    const previous = get().toolBeforeSpace;
    if (previous === null) return;
    set({ activeTool: previous, toolBeforeSpace: null });
  },
}));
