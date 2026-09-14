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
  Redo2,
  TextCursorInput as InputIcon,
  Trash2,
  Type as TypeIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { collectSubtreeIds } from "@/features/editor/command/applyCommand";
import { canRedo, canUndo } from "@/features/editor/command/history";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { resolveImportParent } from "@/features/editor/store/resolveImportParent";
import { resolveLayerDrop } from "@/features/editor/ui/layerDrop";
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

/**
 * 레이어 트리 드래그 중에 뜨는 상태 — 드래그 중인 노드, 그 부모, 그리고 자기 자신+모든
 * 자손 id(subtreeIds). subtreeIds는 순환 방지용이다 — 자기 자신이나 자기 자손 위로는
 * 옮길 수 없으므로(#123, resolveLayerDrop이 이 집합으로 드롭 대상 여부를 가른다) 매
 * dragover마다 다시 계산하지 않도록 드래그 시작 시점에 한 번만 구한다.
 */
type DragState = { id: NodeId; parentId: NodeId; subtreeIds: Set<NodeId> };

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
  /**
   * 이 노드의 부모 id. root는 부모가 없어 null이다 — 드래그 대상에서는 제외되지만
   * (root는 옮길 수 없다), 드롭 대상에서는 제외되지 않는다. root도 frame이라
   * resolveLayerDrop이 "안으로 넣기"로 받아, 중첩된 노드를 최상위로 옮기는 통로가 된다.
   */
  parentId: NodeId | null;
  isCollapsed: (id: NodeId) => boolean;
  onToggleCollapse: (id: NodeId) => void;
  dragState: DragState | null;
  onDragStart: (id: NodeId, parentId: NodeId) => void;
  onDrop: (targetId: NodeId, targetParentId: NodeId | null) => void;
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
  // 형제 순서 변경과 다른 프레임으로의 재부모화 둘 다 이 행이 받는다(#123) — 어느 쪽인지는
  // 실제로 놓을 때 resolveLayerDrop(순수 함수, ui/layerDrop.ts)이 이 행이 frame인지 아닌지로
  // 가른다. 여기서는 자기 자신·자기 자손 위에 놓는 것만 미리 걸러 드롭 표시를 안 띄운다
  // (subtreeIds는 자기 자신도 포함한다 — 순환 방지의 최종 방어선은 moveNode 쪽에 있다).
  const isDropTarget = dragState !== null && !dragState.subtreeIds.has(id);
  const isBeingDragged = dragState?.id === id;
  // resolveLayerDrop과 같은 기준(frame이면 안으로, 아니면 그 앞자리로)으로 드롭 표시를
  // 나눈다 — frame 위는 테두리(그 안에 들어간다), 그 외는 행 위쪽 선(그 자리 앞에
  // 끼워진다)이다. 실제로 항상 "그 앞"인 이유는 resolveLayerDrop 주석 참고.
  const isFrame = node.type === "frame";
  const showNestOutline = isDragOver && isFrame;
  const showInsertLine = isDragOver && !isFrame;

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
          className={`group relative flex w-full items-center gap-1 rounded-control py-1 pr-1 ${indent} ${
            isSelected
              ? "bg-primary-subtle text-primary"
              : "text-content-muted hover:bg-hover hover:text-content"
          } ${isBeingDragged ? "opacity-40" : ""} ${
            showNestOutline ? "outline outline-2 -outline-offset-2 outline-primary" : ""
          }`}
        >
          {showInsertLine ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-0.5 -translate-y-1/2 rounded-full bg-primary"
            />
          ) : null}

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
  onDrop: (targetId: NodeId, targetParentId: NodeId | null) => void;
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
  /** 활성 페이지를 아직 한 번도 안 고쳤으면 history에 항목이 없다 — 그럴 땐 둘 다 false. */
  const canUndoNow = useEditorStore((state) => {
    const pageHistory = state.history[state.activePageId];
    return pageHistory !== undefined && canUndo(pageHistory);
  });
  const canRedoNow = useEditorStore((state) => {
    const pageHistory = state.history[state.activePageId];
    return pageHistory !== undefined && canRedo(pageHistory);
  });

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      // 패널의 입력칸 등에서는 브라우저 기본 되돌리기(텍스트 편집 undo)를 그대로 둔다 —
      // 여기서 가로채면 "방금 타이핑한 글자"가 아니라 "직전 노드 편집"이 되돌아간다.
      if (isEditableTarget(event.target)) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      const { undo, redo } = useEditorStore.getState();

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y" && event.ctrlKey && !event.shiftKey) {
        // Ctrl+Y는 Windows 관례의 다시 실행이다. metaKey(Cmd+Y)는 안 건드린다 —
        // macOS에는 이 조합에 대응하는 다시 실행 관례가 없다.
        event.preventDefault();
        redo();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleDragStart(id: NodeId, parentId: NodeId) {
    const { spec, activePageId } = useEditorStore.getState();
    const nodes = spec.pages[activePageId].nodes;
    setDragState({ id, parentId, subtreeIds: collectSubtreeIds(nodes, id) });
  }

  function handleDragEnd() {
    setDragState(null);
  }

  /**
   * 드래그한 노드를 targetId 행에 놓았을 때 무엇을 할지 resolveLayerDrop(순수 함수,
   * ui/layerDrop.ts)으로 정하고 moveNode로 적용한다(#123) — targetId가 frame이면 그
   * 자식 끝으로 재부모화하고, 아니면 그 노드가 속한 부모 안에서 그 자리로 순서를
   * 바꾼다(부모가 dragState의 원래 부모와 달라도 이제 허용하므로 이 경로로도
   * 재부모화가 일어난다). 순환 등으로 유효한 대상이 아니면 resolveLayerDrop이 null을
   * 돌려주고 아무 일도 안 한다.
   */
  function handleDrop(targetId: NodeId, targetParentId: NodeId | null) {
    if (dragState !== null) {
      const { spec, activePageId, moveNode } = useEditorStore.getState();
      const nodes = spec.pages[activePageId].nodes;

      const target = resolveLayerDrop({
        nodes,
        dragId: dragState.id,
        dragParentId: dragState.parentId,
        targetId,
        targetParentId,
      });

      if (target !== null) {
        moveNode(dragState.id, target.newParentId, target.index);
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAddFrame}
            aria-label="레이어 추가"
            className="rounded-control p-0.5 text-content-muted hover:bg-hover hover:text-content"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => useEditorStore.getState().undo()}
            disabled={!canUndoNow}
            aria-label="되돌리기"
            className="rounded-control p-0.5 text-content-muted hover:bg-hover hover:text-content disabled:pointer-events-none disabled:opacity-30"
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => useEditorStore.getState().redo()}
            disabled={!canRedoNow}
            aria-label="다시 실행"
            className="rounded-control p-0.5 text-content-muted hover:bg-hover hover:text-content disabled:pointer-events-none disabled:opacity-30"
          >
            <Redo2 className="size-4" aria-hidden="true" />
          </button>
        </div>
        <span className="font-mono text-xs text-content-subtle">{nodeCount} layers</span>
      </footer>
    </aside>
  );
}
