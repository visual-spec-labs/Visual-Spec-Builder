import { useEditorStore } from "@/features/editor/store/editorStore";
import { useToolStore } from "@/features/editor/store/toolStore";

/**
 * Esc 규칙(#352, docs/04-gui-spec.md §8). Frame·Text·Hand 도구에서는
 * 선택을 유지한 채 Select 도구로 돌아가고, Select 도구에서는 선택을 해제한다.
 *
 * 스페이스 임시 손 도구 중에는 기존처럼 선택만 해제한다. 이때 도구를 바꾸면
 * `toolBeforeSpace`가 지워져 스페이스를 뗐을 때 원래 도구로 돌아가지 못한다.
 */
export function runEscapeCommand(): void {
  const { activeTool, toolBeforeSpace, setActiveTool } = useToolStore.getState();
  if (toolBeforeSpace === null && activeTool !== "select") {
    setActiveTool("select");
    return;
  }
  useEditorStore.getState().select(null);
}
