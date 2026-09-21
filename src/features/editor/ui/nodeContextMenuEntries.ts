import { findParentId } from "@/features/editor/command/applyCommand";
import type { NodeId } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";

import { copySelection, hasClipboard, pasteClipboard } from "./clipboard";
import type { ActionEntry, MenuEntry } from "./menuEntry";
import { reorderedIndex, type ReorderDirection } from "./reorderSibling";

/**
 * `nodeId`를 형제 배열에서 `direction`으로 옮긴다. 부모가 없거나(root) frame이
 * 아니면(있을 수 없지만 방어) 아무 것도 하지 않는다 — moveNode 자신도 같은
 * 경우 no-op이지만, 호출 전에 걸러야 새 인덱스 계산에서 예외가 안 난다.
 */
function moveInSiblingOrder(nodeId: NodeId, direction: ReorderDirection): void {
  const { spec, activePageId, moveNode } = useEditorStore.getState();
  const { nodes } = spec.pages[activePageId];

  const parentId = findParentId(nodes, nodeId);
  if (parentId === undefined) return;

  const parent = nodes[parentId];
  if (parent.type !== "frame") return;

  const children = parent.children.map((child) => child.node);
  const newIndex = reorderedIndex(children, nodeId, direction);
  if (newIndex === null) return;

  moveNode(nodeId, parentId, newIndex);
}

/**
 * 캔버스 컨텍스트 메뉴(#152)의 항목을 만든다. `nodeId`는 우클릭이 고른 노드다
 * (Canvas.tsx가 resolveClickTarget으로 이미 정해 select까지 마친 상태).
 *
 * store를 매번 새로 읽는다(getState) — MenuBar의 액션 핸들러와 같은 이유로
 * 메뉴가 열리는 순간의 최신 값이면 충분하고, 반응형 구독은 필요 없다.
 *
 * root는 삭제·복제·순서 바꾸기 대상이 아니다(store가 이미 막지만, 눌러도
 * 아무 일 없는 항목을 활성 상태로 보여주지 않는다 — layoutPatch.ts의
 * "효과 없는 컨트롤은 숨기거나 끈다"는 원칙과 같다).
 */
export function buildNodeContextMenuEntries(nodeId: NodeId): MenuEntry[] {
  const { spec, activePageId } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];
  const isRoot = nodeId === root;

  const parentId = isRoot ? undefined : findParentId(nodes, nodeId);
  const parent = parentId !== undefined ? nodes[parentId] : undefined;
  const siblings =
    parent !== undefined && parent.type === "frame"
      ? parent.children.map((child) => child.node)
      : [];
  const index = siblings.indexOf(nodeId);
  const atFront = index <= 0;
  const atBack = index === -1 || index >= siblings.length - 1;

  function reorderEntry(label: string, direction: ReorderDirection, disabled: boolean): ActionEntry {
    return {
      kind: "action",
      label,
      disabled: isRoot || disabled,
      onSelect: () => moveInSiblingOrder(nodeId, direction),
    };
  }

  return [
    {
      kind: "action",
      label: "복제",
      disabled: isRoot,
      onSelect: () => useEditorStore.getState().duplicateNode(nodeId),
    },
    {
      kind: "action",
      label: "복사",
      onSelect: () => copySelection(nodes, nodeId),
    },
    {
      kind: "action",
      label: "붙여넣기",
      disabled: !hasClipboard(),
      onSelect: pasteClipboard,
    },
    { kind: "separator" },
    reorderEntry("맨 앞으로 가져오기", "front", atFront),
    reorderEntry("앞으로 가져오기", "forward", atFront),
    reorderEntry("뒤로 보내기", "backward", atBack),
    reorderEntry("맨 뒤로 보내기", "back", atBack),
    { kind: "separator" },
    {
      kind: "action",
      label: "삭제",
      disabled: isRoot,
      onSelect: () => useEditorStore.getState().removeNode(nodeId),
    },
  ];
}
