import { create } from "zustand";

/**
 * 홈 화면의 자연어 초안 작성 패널 ↔ 에디터 전용 전달 스토어(#286).
 *
 * `navigationStore.ts`와 같은 이유로 모듈 바깥 상태가 필요하다 — `App.tsx`가
 * `screen === "home" ? <HomeScreen/> : <EditorLayout/>`로 두 화면을 완전히
 * 다른 서브트리로 마운트/언마운트하므로, 홈에서 입력한 문구를 React
 * props/context로 에디터에 넘길 자리가 없다.
 *
 * `draft`를 "쓰고 한 번 읽으면 사라지는" 값으로 둔다 — `consumeDraft`가 읽으면서
 * 바로 비운다. 비우지 않으면 사용자가 에디터 ↔ 홈을 오갈 때마다 같은 옛 문구가
 * `NaturalLanguageBar`에 계속 다시 채워진다.
 */
export interface HomeDraftState {
  draft: string | null;
  setDraft: (text: string) => void;
  /** 값을 돌려주면서 비운다. 없으면 `null`. */
  consumeDraft: () => string | null;
}

export const useHomeDraftStore = create<HomeDraftState>((set, get) => ({
  draft: null,
  setDraft: (text) => set({ draft: text }),
  consumeDraft: () => {
    const draft = get().draft;
    if (draft !== null) set({ draft: null });
    return draft;
  },
}));
