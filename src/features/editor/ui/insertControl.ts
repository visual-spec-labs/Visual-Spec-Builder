import { createNode } from "@/features/editor/store/createNode";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";

import { resolveInsertParent } from "./selection";

/** Insert 메뉴도 붙여넣기와 같은 부모 규칙과 기존 createNode Command를 쓴다. */
export function insertControl(kind: "button" | "input"): void {
  const { spec, activePageId, selectedId, insertNode } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];
  const parentId = resolveInsertParent({ nodes, root, clickedId: selectedId ?? root });
  insertNode(parentId, generateNodeId(kind, nodes), createNode(kind));
}
