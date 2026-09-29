import { useEffect } from "react";

import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { saveSpecToStorage } from "@/features/editor/store/specStorage";
import type { ProjectSpec } from "@/features/editor/schema";
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
 * **디바운스 중에 탭이 닫히는 경우를 놓치지 않는다.** 타이머가 아직 안 끝났는데
 * 새로고침하거나 탭을 닫으면(=이 기능이 막으려는 바로 그 상황) 대기 중이던 마지막
 * 변경이 유실된다 — 셀프 리뷰 중 이 구멍을 확인하고, `beforeunload`에서 남은
 * 타이머를 취소하고 그 자리에서 즉시 저장하도록 `flushPending`을 추가했다.
 * `beforeunload`가 100% 보장되진 않는다(일부 모바일 브라우저, 강제 종료 등)는
 * 알려진 한계다 — 그런 경우는 최후 방어선인 File > Save(수동 다운로드)가 있다.
 *
 * **파일명도 같이 저장한다**(이슈 #185) — `saveSpecToStorage`가 `spec`과
 * `documentStore.fileName`을 한 값으로 묶어 쓰므로(`specStorage.ts` 참고),
 * 저장 시점의 최신 파일명을 매번 `useDocumentStore.getState()`로 읽는다. 파일명
 * 변화 자체(Open·Save·Save as·New)는 이 구독과 별개로 아래 두 번째 구독이
 * **디바운스 없이** 즉시 저장한다 — spec 내용 편집처럼 연달아 바뀌는 값이 아니라
 * 한 번씩만 바뀌므로 디바운스가 필요 없고, 걸어 두면 "Save as로 이름만 바꾸고
 * 편집 없이 바로 새로고침"에서 새 이름이 아직 저장 안 된 채로 남는다.
 */
function useSpecAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: ProjectSpec | undefined;

    function flushPending() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (pending !== undefined) {
        saveSpecToStorage(pending, useDocumentStore.getState().fileName);
        pending = undefined;
      }
    }

    const unsubscribeSpec = useEditorStore.subscribe((state, prevState) => {
      if (state.spec === prevState.spec) return;
      pending = state.spec;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        saveSpecToStorage(state.spec, useDocumentStore.getState().fileName);
        pending = undefined;
        timer = undefined;
      }, SPEC_SAVE_DEBOUNCE_MS);
    });

    const unsubscribeFileName = useDocumentStore.subscribe((state, prevState) => {
      if (state.fileName === prevState.fileName) return;
      saveSpecToStorage(useEditorStore.getState().spec, state.fileName);
    });

    window.addEventListener("beforeunload", flushPending);

    return () => {
      window.removeEventListener("beforeunload", flushPending);
      flushPending();
      unsubscribeSpec();
      unsubscribeFileName();
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
