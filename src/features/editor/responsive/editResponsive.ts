import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveViewStore } from "./responsiveViewStore";
import { patchResponsiveNode } from "./resolveResponsive";

/** 패널은 현재 합성값을 보여 주되 선택 breakpoint의 희소 패치만 쓴다. */
export function editResponsiveNode(pageId: string, breakpoint: string, nodeId: string, path: string, value: unknown, continueEdit = false) {
  const store = useEditorStore.getState();
  const screen = store.spec.pages[pageId];
  if (!screen) return;
  // 기반 선택 필드 삭제와 달리 override에는 명시적인 기본값이 필요하다.
  const explicit = value === undefined
    ? path === "opacity" ? 1 : path === "blur" ? 0 : path === "background" ? [] : path === "border" ? { width: 0, color: "#000000", radius: 0 } : value
    : value;
  if (explicit === undefined) {
    useResponsiveViewStore.getState().reportError("이 속성은 상속 목록의 해제로 되돌리세요. 이 폭에서 테두리를 숨기려면 너비를 0으로 설정하세요.");
    return;
  }
  const responsive = patchResponsiveNode(screen, breakpoint, nodeId, path, explicit);
  useResponsiveViewStore.getState().reportError(store.setResponsive(pageId, responsive, continueEdit));
}
