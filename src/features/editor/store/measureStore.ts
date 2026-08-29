import { create } from "zustand";

/**
 * 선택된 노드가 캔버스에서 실제로 몇 px로 그려졌는지 담는다.
 *
 * Auto(Hug)·Fill은 스펙에 숫자가 없어 패널이 크기를 알 수 없다. 캔버스가 실측값을
 * 여기 올려주면 패널이 그 값을 px 칸에 보여주고, Fixed로 전환할 때 현재 크기를
 * 그대로 이어받을 수 있다(예전엔 100px로 튀었다).
 *
 * IR이 아닌 순수 파생 UI 상태이므로 editorStore의 4-멤버 계약과 분리한다.
 * 참고: docs/EDITOR_STORE_CONTRACT.md
 */
export interface MeasuredSize {
  width: number;
  height: number;
}

export interface MeasureState {
  /** 선택 노드의 실측 크기. 선택이 없거나 아직 못 쟀으면 null. */
  size: MeasuredSize | null;
  setSize: (size: MeasuredSize | null) => void;
}

export const useMeasureStore = create<MeasureState>((set) => ({
  size: null,
  setSize: (size) =>
    set((state) => {
      // 같은 값이면 리렌더를 만들지 않는다(ResizeObserver가 자주 부른다).
      if (
        state.size === size ||
        (state.size !== null &&
          size !== null &&
          state.size.width === size.width &&
          state.size.height === size.height)
      ) {
        return state;
      }
      return { size };
    }),
}));
