import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Frame as FrameIcon,
  Image as ImageIcon,
  Plus,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { resolveImportParent } from "@/features/editor/store/resolveImportParent";
import type { FrameNode, Node, NodeId } from "@/features/editor/schema";

/** 깊이별 들여쓰기 — Tailwind 스페이싱 스케일만 사용(임의값 금지). */
const INDENT_BY_DEPTH = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14"];

const TYPE_ICON: Record<Node["type"], LucideIcon> = {
  frame: FrameIcon,
  text: TypeIcon,
  image: ImageIcon,
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

function LayerRow({
  id,
  depth,
  collapsed,
  onToggleCollapse,
}: {
  id: NodeId;
  depth: number;
  collapsed: Set<NodeId>;
  onToggleCollapse: (id: NodeId) => void;
}) {
  const node = useEditorStore(
    (state) => state.spec.pages[state.activePageId].nodes[id],
  );
  const selectedId = useEditorStore((state) => state.selectedId);
  const select = useEditorStore((state) => state.select);
  const setNodeField = useEditorStore((state) => state.setNodeField);

  if (node === undefined) return null;

  const hasChildren = node.type === "frame" && node.children.length > 0;
  const isOpen = !collapsed.has(id);
  const isSelected = selectedId === id;
  const isVisible = node.visible !== false;
  const Icon = TYPE_ICON[node.type];
  const indent = INDENT_BY_DEPTH[Math.min(depth, INDENT_BY_DEPTH.length - 1)];

  return (
    <>
      <li>
        <div
          className={`group flex w-full items-center gap-1 rounded-control py-1 pr-1 ${indent} ${
            isSelected
              ? "bg-primary-subtle text-primary"
              : "text-content-muted hover:bg-hover hover:text-content"
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
        </div>
      </li>

      {hasChildren && isOpen
        ? (node as FrameNode).children.map((child) => (
            <LayerRow
              key={child.node}
              id={child.node}
              depth={depth + 1}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
            />
          ))
        : null}
    </>
  );
}

/** 좌측 레이어 트리 — editorStore의 활성 페이지를 root부터 재귀 렌더링한다. */
export function LayerTree() {
  const root = useEditorStore(
    (state) => state.spec.pages[state.activePageId].root,
  );
  const nodeCount = useEditorStore(
    (state) => Object.keys(state.spec.pages[state.activePageId].nodes).length,
  );
  const [collapsed, setCollapsed] = useState<Set<NodeId>>(new Set());

  function toggleCollapse(id: NodeId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
        <LayerRow id={root} depth={0} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
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
