import { useCallback } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { getByPath } from "@/features/editor/store/path";

/**
 * 선택된 노드의 한 필드를 점 표기 경로로 읽고 쓰는 훅.
 * [값, 세터]를 반환한다. 컨트롤은 이 훅만 쓰면 store를 몰라도 된다.
 *
 * 나중에 필드를 추가할 때(예: rotation) 이 훅으로 한 줄이면 연결된다:
 *   const [rotation, setRotation] = useNodeField<number>("rotation");
 */
export function useNodeField<T>(path: string): [T | undefined, (value: T) => void] {
  const selectedId = useEditorStore((state) => state.selectedId);
  const value = useEditorStore((state) => {
    if (selectedId === null) {
      return undefined;
    }
    const node = state.spec.screen.nodes[selectedId];
    return node === undefined ? undefined : getByPath(node, path);
  }) as T | undefined;

  const setNodeField = useEditorStore((state) => state.setNodeField);

  const setValue = useCallback(
    (next: T) => {
      if (selectedId !== null) {
        setNodeField(selectedId, path, next);
      }
    },
    [selectedId, path, setNodeField],
  );

  return [value, setValue];
}
