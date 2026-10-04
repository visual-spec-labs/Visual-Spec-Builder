import type { MouseEvent as ReactMouseEvent } from "react";
import type { NodeId } from "@/features/editor/schema";
import { useContextMenuStore } from "@/features/editor/store/contextMenuStore";
import { createNode, type NodeKind } from "@/features/editor/store/createNode";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { useToolStore } from "@/features/editor/store/toolStore";
import { clickBoundary, resolveClickTarget, resolveInsertParent } from "./selection";

/** DOM 이벤트를 기존 선택 규칙과 Store Command 액션에 연결한다. */
/** 새 노드를 만들어 부모에 붙이고, 도구를 Select로 되돌린다. */
function insertNewNode(kind: NodeKind, parentId: NodeId) {
  const { spec, activePageId, insertNode } = useEditorStore.getState();
  const { nodes } = spec.pages[activePageId];
  insertNode(parentId, generateNodeId(kind, nodes), createNode(kind));
  // 피그마와 같은 흐름 — 하나 만들면 바로 그것을 만질 수 있게 선택 도구로 돌아온다.
  useToolStore.getState().setActiveTool("select");
}

/**
 * 노드를 클릭했을 때 활성 도구에 따라 무엇을 할지 정한다.
 *
 * 스토어를 구독하는 대신 getState로 읽는다 — 재귀 렌더 트리의 모든 노드에
 * 핸들러를 내려보내거나 도구가 바뀔 때마다 트리 전체를 다시 그리지 않기 위해서다.
 */
export function handleNodeClick(clickedId: NodeId, event: ReactMouseEvent) {
  // 중첩된 부모의 핸들러까지 함께 실행되면 어느 노드를 클릭했는지 알 수 없다.
  event.stopPropagation();

  const tool = useToolStore.getState().activeTool;
  if (tool === "hand") return; // 팬 전용 도구 — 선택을 바꾸지 않는다

  const { spec, activePageId, focusRootId, select } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];

  if (tool === "frame" || tool === "text") {
    insertNewNode(tool, resolveInsertParent({ nodes, root, clickedId }));
    return;
  }

  // Select 도구 — Cmd(macOS) / Ctrl(Windows)를 누르면 상세 지정(최하위).
  // 경계는 clickBoundary가 정한다(#151) — 더블클릭으로 들어간 프레임 안에서는
  // 그 프레임의 자식이 "최상위"가 되지만, 클릭이 그 밖(다른 가지)이면 진짜
  // root로 물러난다.
  select(
    resolveClickTarget({
      nodes,
      root: clickBoundary(nodes, root, focusRootId, clickedId),
      clickedId,
      deep: event.metaKey || event.ctrlKey,
    }),
  );
}

/**
 * 노드를 더블클릭했을 때 그 안으로 "들어간다"(#151, 피그마와 같은 진입).
 *
 * 지금 클릭 경계로 한 번 골라(= 평소 클릭이 고를 대상) 그게 자식 있는 프레임이면
 * 그 프레임을 새 경계(focusRootId)로 세우고, 그 새 경계로 다시 한 번 골라 그
 * 안의 대상을 선택한다 — 새 해석 규칙을 만들지 않고 `resolveClickTarget`를
 * 경계만 바꿔 두 번 부르는 것으로 푼다.
 */
export function handleNodeDoubleClick(clickedId: NodeId, event: ReactMouseEvent) {
  event.stopPropagation();

  const tool = useToolStore.getState().activeTool;
  if (tool !== "select") return; // 진입은 Select 도구에서만 뜻이 있다

  const { spec, activePageId, focusRootId, select, enterFocus } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];

  const entered = resolveClickTarget({
    nodes,
    root: clickBoundary(nodes, root, focusRootId, clickedId),
    clickedId,
    deep: false,
  });
  const enteredNode = nodes[entered];
  if (enteredNode === undefined || enteredNode.type !== "frame" || enteredNode.children.length === 0) {
    return; // 들어갈 자식이 없다 — 문맥을 바꿀 이유가 없다
  }

  enterFocus(entered);
  select(resolveClickTarget({ nodes, root: entered, clickedId, deep: false }));
}

/**
 * 노드를 우클릭했을 때 컨텍스트 메뉴를 연다(#152).
 *
 * 선택 해석은 좌클릭(handleNodeClick)과 완전히 같다 — 같은 `clickBoundary`로
 * 진입 문맥을 존중하고, Ctrl/Cmd로 상세 지정도 그대로 받는다. 새 규칙을 만들지
 * 않고 기존 걸 얹기만 한다. 대상을 먼저 선택한 뒤 메뉴를 연다 — 우클릭이
 * 선택을 바꾸는 건 대부분의 편집기와 같은 관례다.
 *
 * Hand 도구는 팬 전용이라 좌클릭도 선택을 안 바꾸므로 메뉴도 안 띄운다.
 * `preventDefault`는 항상 부른다 — EditorLayout의 블랭킷 차단(shouldSuppressContextMenu)
 * 에 기대지 않고 이 자리에서 스스로 브라우저 메뉴를 막는다.
 */
export function handleNodeContextMenu(clickedId: NodeId, event: ReactMouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  const tool = useToolStore.getState().activeTool;
  if (tool !== "select") return;

  const { spec, activePageId, focusRootId, select } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];

  const resolved = resolveClickTarget({
    nodes,
    root: clickBoundary(nodes, root, focusRootId, clickedId),
    clickedId,
    deep: event.metaKey || event.ctrlKey,
  });

  select(resolved);
  useContextMenuStore.getState().open({ nodeId: resolved, x: event.clientX, y: event.clientY });
}

/** 아트보드 바깥(캔버스 바탕)을 클릭했을 때. */
export function handleBackgroundClick() {
  const tool = useToolStore.getState().activeTool;
  if (tool === "hand") return;

  const { spec, activePageId, select } = useEditorStore.getState();

  if (tool === "frame" || tool === "text") {
    insertNewNode(tool, spec.pages[activePageId].root);
    return;
  }

  select(null); // 선택 문맥(focusRootId)도 함께 비워진다 — select의 계약(#151)
}

