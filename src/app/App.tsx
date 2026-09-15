import { useEffect } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { saveSpecToStorage } from "@/features/editor/store/specStorage";
import { EditorLayout } from "@/features/editor/ui/EditorLayout";
import { HomeScreen } from "@/features/editor/ui/HomeScreen";
import { ThemeProvider } from "@/features/editor/ui/ThemeProvider";

/** spec이 바뀌고 이만큼 조용하면 저장한다 — 타이핑 매 글자마다 저장하지 않는다. */
const SPEC_SAVE_DEBOUNCE_MS = 500;

/**
 * spec이 바뀔 때마다(디바운스) localStorage에 자동저장한다(이슈 #128).
 * 앱 최상단에서 마운트 동안 한 번만 구독한다 — editorStore.ts 자체에 넣지
 * 않은 이유는 store/editorStore.ts 상단 주석 참고.
 *
 * **알려진 한계.** 디바운스 중(마지막 변경 후 500ms 이내) 새로고침하면 그 변경은
 * 저장되지 않는다 — 예를 들어 File > New 직후 바로 새로고침하면 새 프로젝트가
 * 아니라 그 전 프로젝트가 복원된다. File > Save(수동 다운로드)는 이 한계와
 * 무관하게 항상 즉시 저장된다.
 */
function useSpecAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      if (state.spec === prevState.spec) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => saveSpecToStorage(state.spec), SPEC_SAVE_DEBOUNCE_MS);
    });

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

export function App() {
  const screen = useNavigationStore((s) => s.screen);
  useSpecAutosave();

  return (
    <ThemeProvider>
      {screen === "home" ? <HomeScreen /> : <EditorLayout />}
    </ThemeProvider>
  );
}
