import { findParentId } from "./applyCommand";
import type { Command } from "./types";
import type { FrameNode, NodeId, ScreenSpec } from "@/features/editor/schema";
import { generateNodeId } from "@/features/editor/store/nodeId";

function location(screen: ScreenSpec, id: NodeId) {
  if (id === screen.root || !Object.prototype.hasOwnProperty.call(screen.nodes, id)) return null;
  const parentId = findParentId(screen.nodes, id);
  const parent = parentId === undefined ? undefined : screen.nodes[parentId];
  if (parentId === undefined || parent?.type !== "frame") return null;
  const index = parent.children.findIndex((child) => child.node === id);
  return index < 0 ? null : { parentId, parent, index };
}

/** 단일 노드를 같은 형제 자리에 감싼다. 기존 노드/스타일은 변경하지 않는다. */
export function buildGroupCommands(screen: ScreenSpec, id: NodeId) {
  const at = location(screen, id);
  if (at === null) return null;
  const groupId = generateNodeId("group", screen.nodes);
  // 크기는 선택 노드를 따르고, 1자식 wrapper에는 추가 여백/장식을 두지 않는다.
  // 부모가 grid여도 wrapper의 한 자식은 column으로 놓아 별도 열을 만들지 않는다.
  const node: FrameNode = {
    type: "frame", name: "Group", box: { ...screen.nodes[id].box },
    // 자식만 숨기면 fixed/fill wrapper가 빈 공간을 차지한다. 숨김만 계승한다.
    ...(screen.nodes[id].visible === false ? { visible: false } : {}),
    layout: {
      direction: at.parent.layout.direction === "row" ? "row" : "column",
      gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: "start", crossAxis: "stretch",
    },
    children: [],
  };
  const commands: Command[] = [
    { type: "createNode", id: groupId, parentId: at.parentId, index: at.index, node },
    { type: "moveNode", id, newParentId: groupId, index: 0 },
  ];
  const responsive = screen.responsive;
  if (responsive) {
    let copiedVisibility = false;
    const overrides = Object.fromEntries(Object.entries(responsive.overrides).map(([key, patches]) => {
      const visible = patches[id]?.visible;
      if (typeof visible !== "boolean") return [key, patches];
      copiedVisibility = true;
      // 크기·배치 등 원노드 전용 override는 wrapper에 적용하지 않는다.
      return [key, { ...patches, [groupId]: { visible } }];
    }));
    if (copiedVisibility) {
      commands.push({ type: "updateScreen", path: "responsive", value: { ...responsive, overrides } });
    }
  }
  return { commands, selectedId: groupId };
}

/** 자식을 먼저 옮긴 뒤 빈 frame을 지운다. root는 대상이 아니다. */
export function buildUngroupCommands(screen: ScreenSpec, id: NodeId) {
  const at = location(screen, id);
  const node = screen.nodes[id];
  if (at === null || node?.type !== "frame") return null;
  const commands: Command[] = node.children.map((child, offset) => ({
    type: "moveNode", id: child.node, newParentId: at.parentId, index: at.index + offset,
  }));
  commands.push({ type: "deleteNode", id });
  return { commands, selectedId: node.children[0]?.node ?? at.parentId };
}
