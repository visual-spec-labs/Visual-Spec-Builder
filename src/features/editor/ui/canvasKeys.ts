import { useEffect, type RefObject } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import { useViewStore, ZOOM_DEFAULT } from "@/features/editor/store/viewStore";

import {
  isSpacePanKey,
  shouldDeleteSelection,
  toolForKey,
  viewCommandForKey,
  type ViewCommand,
} from "./canvasInput";
import { readZoomAnchor, type ZoomAnchor } from "./canvasZoom";

/**
 * 캔버스의 키보드 입력 — 받을지 말지는 `canvasInput.ts` 의 순수 함수가 정하고,
 * 여기는 **리스너 배선과 동작**만 한다.
 *
 * `Canvas.tsx` 에서 잘라 온 것이고 동작은 바뀌지 않았다(2026-09-19·이슈 #148).
 */

/**
 * 캔버스의 키보드 입력을 한 곳에서 받는다 — 노드 삭제(#91)와 도구 단축키(#136).
 *
 * **리스너를 하나로 둔다.** 둘로 나누면 "무엇을 받고 무엇을 비켜설지" 판단이 두
 * 군데로 갈라져 반드시 어긋난다 — 한쪽에만 타이핑 검사를 더하는 식으로.
 *
 * window에서 듣는 이유는 캔버스가 포커스를 받을 수 있는 요소가 아니어서다 — div에
 * tabIndex를 주면 클릭마다 포커스 링이 생기고 탭 순서에도 끼어든다. 그래서 비켜설
 * 조건이 중요해지는데, 그 판단은 전부 canvasInput의 순수 함수가 한다. 여기 남은
 * 것은 동작과 이벤트 배선뿐이다.
 */
export function useCanvasKeys(
  mainRef: RefObject<HTMLElement | null>,
  outerRef: RefObject<HTMLDivElement | null>,
  anchorRef: RefObject<ZoomAnchor | null>,
) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const keyInput = {
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        tagName: target?.tagName,
        contentEditable: target?.isContentEditable ?? false,
        role: target?.getAttribute("role") ?? undefined,
      };

      // 보기 단축키를 먼저 본다. Ctrl+0·Ctrl+- 는 브라우저 페이지 줌이기도 해서
      // 여기서 막지 않으면 캔버스와 페이지가 같이 커진다.
      const view = viewCommandForKey(keyInput);
      if (view !== null) {
        event.preventDefault();
        runViewCommand(view, mainRef.current, outerRef.current, anchorRef);
        return;
      }

      // 스페이스 임시 팬 — 누르는 동안만 손 도구. 고정 전환보다 먼저 본다.
      if (isSpacePanKey(keyInput)) {
        // 스페이스는 스크롤 키다. 캔버스가 overflow-auto라 한 화면씩 내려간다.
        event.preventDefault();
        // 키를 누르고 있으면 keydown이 반복해서 들어온다. 스토어도 멱등이지만
        // 갇히는 대가가 커서 여기서도 거른다.
        if (!event.repeat) useToolStore.getState().beginSpacePan();
        return;
      }

      // 스페이스를 누르고 있는 동안에는 다른 도구 키를 무시한다. 규칙 하나로 두는
      // 편이 "복귀 대상을 바꾼다" 같은 영리한 처리보다 예측 가능하다.
      if (useToolStore.getState().toolBeforeSpace !== null) return;

      const tool = toolForKey(keyInput);
      if (tool !== null) {
        event.preventDefault();
        useToolStore.getState().setActiveTool(tool);
        return;
      }

      // 노드 삭제(#91). 만들기만 되고 지우는 방법이 없었다 — 레이어 트리에는 삭제
      // 버튼이 생겼지만(#101) 캔버스에서 고른 노드를 캔버스에서 지울 수 없었다.
      // root 보호·자손 연쇄 삭제·선택 해제·history 적재는 editorStore.removeNode
      // (= deleteNode Command)가 이미 한다. 여기서는 "언제 부를지"만 정한다.
      const { selectedId, removeNode } = useEditorStore.getState();
      const shouldDelete = shouldDeleteSelection({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        tagName: target?.tagName,
        contentEditable: target?.isContentEditable ?? false,
        hasSelection: selectedId !== null,
      });
      if (!shouldDelete || selectedId === null) return;

      // Backspace는 브라우저에 따라 "뒤로 가기"가 남아 있다.
      event.preventDefault();
      removeNode(selectedId);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") useToolStore.getState().endSpacePan();
    }

    // **blur가 없으면 갇힌다.** 스페이스를 누른 채 Alt+Tab 하면 keyup이 영영 오지
    // 않아 손 도구에서 빠져나올 수 없고, 사용자는 이유를 알 수 없다.
    function releaseSpacePan() {
      useToolStore.getState().endSpacePan();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseSpacePan);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseSpacePan);
    };
  }, [mainRef, outerRef, anchorRef]);
}

/**
 * 보기 단축키를 실제 동작으로 옮긴다.
 *
 * 줌은 **뷰포트 한가운데**를 기준으로 잡는다. 휠 줌은 커서가 기준점이지만
 * 단축키에는 커서 위치라는 개념이 없고, 보통 화면 가운데를 보고 있기 때문이다.
 */
// export 하지 않는다 — useCanvasKeys 가 유일한 호출자이고, 밖에서 직접 부르면
// keydown 의 순서 보장(보기 명령 → 스페이스 팬 → 도구 키 → 삭제)을 건너뛰게 된다.
function runViewCommand(
  command: ViewCommand,
  main: HTMLElement | null,
  outer: HTMLDivElement | null,
  anchorRef: RefObject<ZoomAnchor | null>,
) {
  if (command === "deselect") {
    useEditorStore.getState().select(null);
    return;
  }

  const { zoom: before, zoomIn, zoomOut, setZoom, fitToScreen } = useViewStore.getState();

  if (command === "zoomFit") {
    // 화면 맞춤에는 앵커를 세우지 않는다. "전체를 보이게"가 뜻인데 커서·화면
    // 한가운데를 붙잡아 두면 문서 중간에 머물러 위쪽이 잘린 채로 남는다.
    //
    // 스크롤은 **여기서 건드리지 않는다.** fitToScreen 은 zoom 만 바꾸고 레이아웃은
    // 다음 렌더에서 갱신되므로, 지금 scrollWidth 를 읽으면 옛 너비다. 확대율이
    // ZOOM_MIN 에 걸려 내용이 여전히 뷰포트보다 넓은 경우(6000px 문서를 1200px
    // 뷰포트에 넣으면 20% 가 맞지만 25% 로 잘린다) 새 최댓값을 넘는 값을 써서
    // 브라우저가 오른쪽 끝으로 붙여 버린다. useZoomAnchor 가 렌더 뒤에 맞춘다.
    anchorRef.current = { fit: true };
    fitToScreen();
    // 이미 맞춤 배율이면 값이 안 바뀌어 effect 가 안 돈다 — 앵커를 남기면 나중
    // 줌이 소비한다(아래 끝값 처리와 같은 이유).
    if (useViewStore.getState().zoom === before) anchorRef.current = null;
    return;
  }

  // 나머지 줌은 **뷰포트 한가운데**를 기준으로 잡는다. 휠 줌은 커서가 기준이지만
  // 단축키에는 커서 위치라는 개념이 없고, 보통 화면 가운데를 보고 있기 때문이다.
  if (main !== null && outer !== null) {
    const rect = main.getBoundingClientRect();
    anchorRef.current = readZoomAnchor(
      outer,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  }

  // switch 로 두어 새 명령을 추가할 때 조용히 다른 동작으로 새지 않게 한다.
  switch (command) {
    case "zoomIn":
      zoomIn();
      break;
    case "zoomOut":
      zoomOut();
      break;
    case "zoomReset":
      setZoom(ZOOM_DEFAULT);
      break;
  }

  // 끝값에서 눌러 값이 그대로면 렌더도 useZoomAnchor 도 안 돈다 — 앵커를 남기면
  // 나중 줌이 옛 기준점을 소비한다(휠 쪽과 같은 이유).
  if (useViewStore.getState().zoom === before) anchorRef.current = null;
}
