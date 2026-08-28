import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import type { FrameNode, NodeId, TextNode } from "@/features/editor/schema";

import { boxStyle, type Direction } from "./canvasLayout";

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

function frameStyle(
  node: FrameNode,
  parentDirection: Direction | undefined,
): CSSProperties {
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
    ...boxStyle(node.box, parentDirection),
    background: node.background?.color,
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: node.border?.radius,
    boxSizing: "border-box",
  };
}

function textStyle(
  node: TextNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
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

function RenderNode({
  id,
  parentDirection,
}: {
  id: NodeId;
  /** 부모 프레임의 레이아웃 방향. 최상위 노드는 부모가 없어 undefined. */
  parentDirection?: Direction;
}) {
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
      <div
        style={{ ...textStyle(node, parentDirection), ...outline }}
        onClick={handleClick}
      >
        {node.content}
      </div>
    );
  }

  return (
    <div
      style={{ ...frameStyle(node, parentDirection), ...outline }}
      onClick={handleClick}
    >
      {node.children.map((child) => (
        <RenderNode
          key={child.node}
          id={child.node}
          parentDirection={node.layout.direction}
        />
      ))}
    </div>
  );
}

/**
 * 줌 단계(ZOOM_MIN..ZOOM_MAX, ZOOM_STEP 간격)마다 리터럴 scale 클래스를 매핑한다.
 * 인라인 style 없이도 동적 줌을 표현하기 위함 — 문자열이 소스에 그대로 존재해야
 * Tailwind JIT가 클래스를 정적으로 찾아낼 수 있다 (docs/DESIGN-TOKEN-RULES.md 인라인 스타일 금지).
 */
const ZOOM_SCALE_CLASS: Record<number, string> = {
  25: "scale-[0.25]",
  50: "scale-[0.5]",
  75: "scale-[0.75]",
  100: "scale-[1]",
  125: "scale-[1.25]",
  150: "scale-[1.5]",
  175: "scale-[1.75]",
  200: "scale-[2]",
  225: "scale-[2.25]",
  250: "scale-[2.5]",
  275: "scale-[2.75]",
  300: "scale-[3]",
  325: "scale-[3.25]",
  350: "scale-[3.5]",
  375: "scale-[3.75]",
  400: "scale-[4]",
};

export function Canvas() {
  const root = useEditorStore((state) => state.spec.screen.root);
  const size = useEditorStore((state) => state.spec.screen.size);
  const select = useEditorStore((state) => state.select);
  const zoom = useViewStore((s) => s.zoom);
  const showGrid = useViewStore((s) => s.showGrid);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;

    function handleWheel(event: WheelEvent) {
      // 일반 휠/트랙패드 스크롤은 overflow-auto 네이티브 스크롤(팬)에 맡긴다.
      // Ctrl+휠(트랙패드 핀치도 브라우저가 ctrlKey=true로 보낸다)만 줌으로 가로챈다.
      if (!event.ctrlKey) return;
      event.preventDefault();
      const { zoomIn, zoomOut } = useViewStore.getState();
      if (event.deltaY < 0) {
        zoomIn();
      } else if (event.deltaY > 0) {
        zoomOut();
      }
    }

    // React의 JSX onWheel은 passive 리스너로 등록될 수 있어 preventDefault가
    // 안 먹는다 — { passive: false }로 직접 등록해야 브라우저 기본 페이지
    // 줌을 확실히 막을 수 있다.
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <main
      ref={mainRef}
      className="relative overflow-auto bg-surface-canvas p-8 [grid-area:canvas]"
      onClick={() => select(null)}
    >
      {showGrid && <div className="canvas-grid pointer-events-none absolute inset-0" />}
      <div
        className={`mx-auto origin-top bg-surface-raised shadow-sm ${ZOOM_SCALE_CLASS[zoom]}`}
        style={{ width: size.width, minHeight: size.height }}
      >
        <RenderNode id={root} />
      </div>
      <span className="absolute bottom-3 left-3 rounded-control bg-surface-raised px-2 py-1 text-xs text-content-muted shadow-card">
        {zoom}%
      </span>
    </main>
  );
}
