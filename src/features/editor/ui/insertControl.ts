import type { PageId } from "@/features/editor/schema";
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

/** Insert a same-project widget through the existing project-validated createNode path. */
export function insertWidget(ref: PageId): void {
  const { spec, activePageId, selectedId, insertNode } = useEditorStore.getState();
  const widget = Object.hasOwn(spec.pages, ref) ? spec.pages[ref] : undefined;
  const screen = spec.pages[activePageId];
  if (!screen || widget?.kind !== "widget") return;
  const parentId = resolveInsertParent({ nodes: screen.nodes, root: screen.root, clickedId: selectedId ?? screen.root });
  insertNode(parentId, generateNodeId("instance", screen.nodes), {
    type: "instance", name: widget.name, ref, box: { width: widget.size.width, height: widget.size.height },
  });
}
