import { create } from "zustand";

/**
 * 홈 화면 ↔ 에디터 전환 전용 스토어.
 *
 * 별도 라우터 라이브러리를 쓰지 않는다 — 지금은 화면이 둘뿐이고 URL을 공유할
 * 필요가 없는 로컬 브라우저 앱이라, 상태 하나로 충분하다. IR/선택을 다루는
 * editorStore, 캔버스 뷰를 다루는 viewStore와 분리한다 — 이건 둘 중 어디에도
 * 속하지 않는 "지금 어느 화면을 보여줄지"만 다루는 상태다.
 */
export type AppScreen = "home" | "editor";

const SCREEN_STATE_KEY = "visualSpecActiveScreen";
type HistoryStatePort = { state: unknown; replaceState: (state: unknown, unused: string) => void };

function getHistory(): HistoryStatePort | undefined {
  return (globalThis as unknown as { window?: { history?: HistoryStatePort } }).window?.history;
}

function initialScreen(): AppScreen {
  try {
    const state = getHistory()?.state;
    return typeof state === "object" && state !== null && SCREEN_STATE_KEY in state &&
      (state as Record<string, unknown>)[SCREEN_STATE_KEY] === "editor" ? "editor" : "home";
  } catch {
    return "home";
  }
}

function persistScreen(screen: AppScreen): void {
  try {
    const browserHistory = getHistory();
    if (!browserHistory) return;
    const current = browserHistory.state && typeof browserHistory.state === "object" ? browserHistory.state : {};
    browserHistory.replaceState({ ...current, [SCREEN_STATE_KEY]: screen }, "");
  } catch {
    // Navigation still works when browser history state is unavailable.
  }
}

export interface NavigationState {
  /** 지금 보여줄 화면. 시작은 항상 홈이다(docs/04-gui-spec.md §2). */
  screen: AppScreen;
  openEditor: () => void;
  openHome: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: initialScreen(),
  openEditor: () => { persistScreen("editor"); set({ screen: "editor" }); },
  openHome: () => { persistScreen("home"); set({ screen: "home" }); },
}));
