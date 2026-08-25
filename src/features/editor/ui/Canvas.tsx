import type { CSSProperties, MouseEvent } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import type { FrameNode, NodeId, Size, TextNode } from "@/features/editor/schema";

/**
 * 중앙 캔버스.
 *
 * ⚠️ 임시 스탠드인: 패널 편집이 즉시 반영되는지 눈으로 확인하려고 만든 최소 렌더러.
 * 팀원(캔버스 담당)이 정식 구현으로 교체할 예정. 계약은 spec을 읽고, 클릭 시 select(),
 * 드래그/리사이즈 시 setNodeField를 부르면 된다. 참고: docs/EDITOR_STORE_CONTRACT.md
 */
const MAIN_AXIS: Record<string, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
};

const CROSS_AXIS: Record<string, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

function sizeToCss(size: Size): string {
  if (size === "fill") return "100%";
  if (size === "auto") return "auto";
  return `${size}px`;
}

function frameStyle(node: FrameNode): CSSProperties {
  const { layout } = node;
  return {
    display: "flex",
    flexDirection: layout.direction,
    gap: layout.gap,
    paddingTop: layout.padding.top,
    paddingRight: layout.padding.right,
    paddingBottom: layout.padding.bottom,
    paddingLeft: layout.padding.left,
    justifyContent: MAIN_AXIS[layout.mainAxis],
    alignItems: CROSS_AXIS[layout.crossAxis],
    width: sizeToCss(node.box.width),
    height: sizeToCss(node.box.height),
    background: node.background?.color,
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: node.border?.radius,
    boxSizing: "border-box",
  };
}

function textStyle(node: TextNode): CSSProperties {
  const { typography } = node;
  return {
    width: sizeToCss(node.box.width),
    height: sizeToCss(node.box.height),
    color: node.color,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    whiteSpace: "pre-wrap",
  };
}

function RenderNode({ id }: { id: NodeId }) {
  const node = useEditorStore((state) => state.spec.screen.nodes[id]);
  const selectedId = useEditorStore((state) => state.selectedId);
  const select = useEditorStore((state) => state.select);

  if (node === undefined || node.visible === false) {
    return null;
  }

  const selected = selectedId === id;
  const outline = selected ? { outline: "2px solid #F97316", outlineOffset: 1 } : {};

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    select(id);
  }

  if (node.type === "text") {
    return (
      <div style={{ ...textStyle(node), ...outline }} onClick={handleClick}>
        {node.content}
      </div>
    );
  }

  return (
    <div style={{ ...frameStyle(node), ...outline }} onClick={handleClick}>
      {node.children.map((child) => (
        <RenderNode key={child.node} id={child.node} />
      ))}
    </div>
  );
}

export function Canvas() {
  const root = useEditorStore((state) => state.spec.screen.root);
  const size = useEditorStore((state) => state.spec.screen.size);
  const select = useEditorStore((state) => state.select);

  return (
    <main
      className="overflow-auto bg-surface-canvas p-8 [grid-area:canvas]"
      onClick={() => select(null)}
    >
      <div
        className="mx-auto bg-surface-raised shadow-sm"
        style={{ width: size.width, minHeight: size.height }}
      >
        <RenderNode id={root} />
      </div>
    </main>
  );
}
