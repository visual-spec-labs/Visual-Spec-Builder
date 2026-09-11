import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  Frame as FrameIcon,
  Image as ImageIcon,
  MousePointerClick as ButtonIcon,
  Plus,
  TextCursorInput as InputIcon,
  Trash2,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { resolveImportParent } from "@/features/editor/store/resolveImportParent";
import type { FrameNode, Node, NodeId, PageId } from "@/features/editor/schema";

/** 깊이별 들여쓰기 — Tailwind 스페이싱 스케일만 사용(임의값 금지). */
const INDENT_BY_DEPTH = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14"];

const TYPE_ICON: Record<Node["type"], LucideIcon> = {
  frame: FrameIcon,
  text: TypeIcon,
  image: ImageIcon,
  button: ButtonIcon,
  input: InputIcon,
};

/** "레이어 추가" 버튼이 만드는 기본 Frame. blankSpec의 root frame과 같은 규격이다. */
function blankFrameNode(): FrameNode {
  return {
    type: "frame",
    name: "Frame",
    box: { width: "auto", height: "auto" },
    layout: {
      direction: "column",
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: "start",
      crossAxis: "start",
    },
    children: [],
  };
}

/** 같은 부모 안에서 드래그로 순서를 바꿀 때 뜨는 상태 — 드래그 중인 노드와 그 부모. */
type DragState = { id: NodeId; parentId: NodeId };

function LayerRow({
  id,
  depth,
  parentId,
  isCollapsed,
  onToggleCollapse,
  dragState,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  id: NodeId;
  depth: number;
  /** 이 노드의 부모 id. root는 부모가 없어 null — 드래그·드롭 대상 모두에서 제외한다. */
  parentId: NodeId | null;
  isCollapsed: (id: NodeId) => boolean;
  onToggleCollapse: (id: NodeId) => void;
  dragState: DragState | null;
  onDragStart: (id: NodeId, parentId: NodeId) => void;
  onDrop: (targetId: NodeId, targetParentId: NodeId) => void;
  onDragEnd: () => void;
}) {
  const node = useEditorStore(
    (state) => state.spec.pages[state.activePageId].nodes[id],
  );
  const isRoot = useEditorStore(
    (state) => state.spec.pages[state.activePageId].root === id,
  );
  const selectedId = useEditorStore((state) => state.selectedId);
  const select = useEditorStore((state) => state.select);
  const setNodeField = useEditorStore((state) => state.setNodeField);
  const removeNode = useEditorStore((state) => state.removeNode);
  const [isDragOver, setIsDragOver] = useState(false);

  if (node === undefined) return null;

  const hasChildren = node.type === "frame" && node.children.length > 0;
  const isOpen = !isCollapsed(id);
  const isSelected = selectedId === id;
  const isVisible = node.visible !== false;
  const Icon = TYPE_ICON[node.type];
  const indent = INDENT_BY_DEPTH[Math.min(depth, INDENT_BY_DEPTH.length - 1)];

  // root는 부모가 없어 옮길 수 없다(moveNode도 store에서 막는다) — 드래그 자체를 안 건다.
  const isDraggable = !isRoot && parentId !== null;
  // 같은 부모의 형제끼리만 드롭을 받는다 — 이번 범위는 순서 변경뿐, 다른 프레임으로
  // 옮기는 재부모화는 별도 이슈로 미뤘다(이슈 #110 본문 참고).
  const isDropTarget =
    dragState !== null && parentId !== null && dragState.parentId === parentId && dragState.id !== id;
  const isBeingDragged = dragState?.id === id;

  return (
    <>
      <li>
        <div
          draggable={isDraggable}
          onDragStart={
            isDraggable
              ? (event) => {
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox는 dragstart에서 setData를 안 부르면 드래그 자체를 취소한다.
                  // 실제 이동 로직은 dataTransfer가 아니라 아래 dragState(React 상태)로 한다 —
                  // dragover 중에는 브라우저가 getData 값을 안 내준다(types만 보인다).
                  event.dataTransfer.setData("text/plain", id);
                  onDragStart(id, parentId);
                }
              : undefined
          }
          onDragEnd={onDragEnd}
          onDragEnter={
            isDropTarget
              ? (event) => {
                  // dragover뿐 아니라 dragenter에도 preventDefault가 필요하다 — 안 그러면
                  // 마우스가 자식 요소(이름 <span> 등) 경계를 넘나들 때마다 브라우저가
                  // "여기 드롭 가능" 상태를 잃어버려 drop 자체가 취소된다(실측 확인, 이슈 #110).
                  event.preventDefault();
                  setIsDragOver(true);
                }
              : undefined
          }
          onDragLeave={isDropTarget ? () => setIsDragOver(false) : undefined}
          onDragOver={isDropTarget ? (event) => event.preventDefault() : undefined}
          onDrop={
            isDropTarget
              ? (event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                  onDrop(id, parentId);
                }
              : undefined
          }
          className={`group flex w-full items-center gap-1 rounded-control py-1 pr-1 ${indent} ${
            isSelected
              ? "bg-primary-subtle text-primary"
              : "text-content-muted hover:bg-hover hover:text-content"
          } ${isBeingDragged ? "opacity-40" : ""} ${
            isDragOver ? "outline outline-2 -outline-offset-2 outline-primary" : ""
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleCollapse(id)}
              aria-label={isOpen ? "접기" : "펼치기"}
              aria-expanded={isOpen}
              className="flex size-4 shrink-0 items-center justify-center"
            >
              {isOpen ? (
                <ChevronDown size={12} aria-hidden="true" />
              ) : (
                <ChevronRight size={12} aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="size-4 shrink-0" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={() => select(id)}
            aria-current={isSelected ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <Icon size={13} className="shrink-0 text-content-subtle" aria-hidden="true" />
            <span className="truncate">{node.name}</span>
          </button>

          <button
            type="button"
            onClick={() => setNodeField(id, "visible", !isVisible)}
            aria-label={isVisible ? "숨기기" : "표시"}
            className={`flex size-5 shrink-0 items-center justify-center ${
              isVisible ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            }`}
          >
            {isVisible ? (
              <Eye size={13} aria-hidden="true" />
            ) : (
              <EyeOff size={13} aria-hidden="true" />
            )}
          </button>

          {isRoot ? null : (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`"${node.name}" 레이어를 삭제할까요?`)) {
                  removeNode(id);
                }
              }}
              aria-label="레이어 삭제"
              className="flex size-5 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </li>

      {hasChildren && isOpen
        ? (node as FrameNode).children.map((child) => (
            <LayerRow
              key={child.node}
              id={child.node}
              depth={depth + 1}
              parentId={id}
              isCollapsed={isCollapsed}
              onToggleCollapse={onToggleCollapse}
              dragState={dragState}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))
        : null}
    </>
  );
}

function PageFolderRow({
  pageId,
  isCollapsed,
  onToggleCollapse,
  dragState,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  pageId: PageId;
  isCollapsed: (id: NodeId) => boolean;
  onToggleCollapse: (id: NodeId) => void;
  dragState: DragState | null;
  onDragStart: (id: NodeId, parentId: NodeId) => void;
  onDrop: (targetId: NodeId, targetParentId: NodeId) => void;
  onDragEnd: () => void;
}) {
  const page = useEditorStore((state) => state.spec.pages[pageId]);
  const isActive = useEditorStore((state) => state.activePageId === pageId);
  const canDelete = useEditorStore((state) => state.spec.pageOrder.length > 1);
  const selectPage = useEditorStore((state) => state.selectPage);
  const removePage = useEditorStore((state) => state.removePage);

  return (
    <li>
      <div
        className={`group flex w-full items-center gap-1 rounded-control py-1 pr-1 pl-2 ${
          isActive
            ? "bg-primary-subtle text-primary"
            : "text-content-muted hover:bg-hover hover:text-content"
        }`}
      >
        <button
          type="button"
          onClick={() => selectPage(pageId)}
          aria-current={isActive ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Folder size={13} className="shrink-0 text-content-subtle" aria-hidden="true" />
          <span className="truncate font-medium">{page.name}</span>
        </button>

        {canDelete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`"${page.name}" 페이지를 삭제할까요?`)) {
                removePage(pageId);
              }
            }}
            aria-label="페이지 삭제"
            className="flex size-5 shrink-0 items-center justify-center opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {isActive ? (
        <ul>
          <LayerRow
            id={page.root}
            depth={1}
            parentId={null}
            isCollapsed={isCollapsed}
            onToggleCollapse={onToggleCollapse}
            dragState={dragState}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        </ul>
      ) : null}
    </li>
  );
}

/**
 * 좌측 레이어 트리 — 프로젝트의 페이지를 폴더로 나열하고, 활성 페이지
 * 폴더 아래에 그 페이지의 노드 트리를 root부터 재귀 렌더링한다.
 */
export function LayerTree() {
  const pageOrder = useEditorStore((state) => state.spec.pageOrder);
  const activePageId = useEditorStore((state) => state.activePageId);
  const nodeCount = useEditorStore(
    (state) => Object.keys(state.spec.pages[state.activePageId].nodes).length,
  );
  /** 페이지마다 노드 id가 겹칠 수 있어 "페이지id:노드id" 합성 키로 접힘 상태를 분리한다. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /** 지금 드래그 중인 노드 — 드롭받을 수 있는 곳은 같은 parentId를 가진 형제뿐이다. */
  const [dragState, setDragState] = useState<DragState | null>(null);

  function handleDragStart(id: NodeId, parentId: NodeId) {
    setDragState({ id, parentId });
  }

  function handleDragEnd() {
    setDragState(null);
  }

  /**
   * 형제 목록에서 드래그한 노드를 targetId 자리로 옮긴다. dragState.parentId와
   * targetParentId가 다르면(LayerRow가 isDropTarget으로 이미 걸러내지만 방어적으로
   * 한 번 더 확인한다) 아무 일도 안 한다 — 이번 범위는 같은 부모 안 순서 변경뿐이다.
   *
   * moveNode는 대상 노드를 먼저 children에서 뺀 뒤 index에 끼워 넣으므로, 드래그한
   * 노드가 목표보다 앞에 있었으면 제거로 인해 목표 자리가 한 칸 당겨진다 — 그만큼
   * 보정해야 "드롭한 자리에 정확히 들어간다."
   */
  function handleDrop(targetId: NodeId, targetParentId: NodeId) {
    if (dragState !== null && dragState.parentId === targetParentId && dragState.id !== targetId) {
      const { spec, activePageId, moveNode } = useEditorStore.getState();
      const parent = spec.pages[activePageId].nodes[targetParentId];

      if (parent !== undefined && parent.type === "frame") {
        const fromIndex = parent.children.findIndex((child) => child.node === dragState.id);
        const toIndex = parent.children.findIndex((child) => child.node === targetId);

        if (fromIndex !== -1 && toIndex !== -1) {
          const index = fromIndex < toIndex ? toIndex - 1 : toIndex;
          moveNode(dragState.id, targetParentId, index);
        }
      }
    }

    setDragState(null);
  }

  function collapseKey(id: NodeId) {
    return `${activePageId}:${id}`;
  }

  function isCollapsed(id: NodeId) {
    return collapsed.has(collapseKey(id));
  }

  function toggleCollapse(id: NodeId) {
    const key = collapseKey(id);
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleAddFrame() {
    const { spec, activePageId, selectedId, insertNode } =
      useEditorStore.getState();
    const page = spec.pages[activePageId];
    const parentId = resolveImportParent(page, selectedId);
    const id = generateNodeId("frame", page.nodes);
    insertNode(parentId, id, blankFrameNode());
  }

  return (
    <aside className="flex flex-col overflow-hidden border-r border-line bg-surface [grid-area:tree]">
      <h2 className="px-3 pt-3 pb-2 text-xs font-semibold tracking-wide text-content-muted uppercase">
        Layers
      </h2>

      <ul className="flex-1 overflow-auto px-1 pb-2 text-sm">
        {pageOrder.map((pageId) => (
          <PageFolderRow
            key={pageId}
            pageId={pageId}
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
            dragState={dragState}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}

        <li>
          <button
            type="button"
            onClick={() => useEditorStore.getState().addPage()}
            className="flex w-full items-center gap-1.5 rounded-control py-1 pr-1 pl-2 text-left text-content-subtle hover:bg-hover hover:text-content"
          >
            <Plus size={13} className="shrink-0" aria-hidden="true" />
            <span>새 페이지</span>
          </button>
        </li>
      </ul>

      <footer className="flex items-center justify-between border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={handleAddFrame}
          aria-label="레이어 추가"
          className="rounded-control p-0.5 text-content-muted hover:bg-hover hover:text-content"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <span className="font-mono text-xs text-content-subtle">{nodeCount} layers</span>
      </footer>
    </aside>
  );
}
