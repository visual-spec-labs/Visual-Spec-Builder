import {
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";

import { createNode, type NodeKind } from "@/features/editor/store/createNode";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { useMeasureStore } from "@/features/editor/store/measureStore";
import { useToolStore } from "@/features/editor/store/toolStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import type {
  ButtonNode,
  FrameNode,
  ImageNode,
  InputNode,
  NodeId,
  PageId,
  TextNode,
} from "@/features/editor/schema";

import { boxStyle, type Direction } from "./canvasLayout";
import { resolveClickTarget, resolveInsertParent } from "./selection";

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

/**
 * grid는 최소 구현이다 — 열 N개짜리 균등 그리드로만 그린다(자동 배치, 아이템별
 * 셀 지정 없음). mainAxis/crossAxis는 grid에 뜻이 없어 무시한다. 정식 구현은
 * 후속 작업(이 파일 자체가 "임시 스탠드인" — 위 주석 참고).
 */
function displayStyle(layout: FrameNode["layout"]): CSSProperties {
  if (layout.direction === "grid") {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${layout.columns ?? 1}, 1fr)`,
    };
  }
  return { display: "flex", flexDirection: layout.direction };
}

function frameStyle(
  node: FrameNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { layout } = node;
  return {
    ...displayStyle(layout),
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

function imageStyle(
  node: ImageNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  return {
    ...boxStyle(node.box, parentDirection),
    backgroundImage: `url(${node.src})`,
    backgroundSize: node.fit === "fill" ? "100% 100%" : node.fit,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

/** frame(배경/테두리) + text(타이포그래피)를 합친 모양 — 최소 구현. 클릭 동작은 없다(인터랙션은 v0.1 제외). */
function buttonStyle(
  node: ButtonNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: node.color,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    background: node.background?.color,
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: node.border?.radius,
    boxSizing: "border-box",
    cursor: "default",
  };
}

/** placeholder 텍스트만 흐리게 보여준다 — 실제 입력 상호작용은 없다(value/onChange는 스키마에 없음). */
function inputStyle(
  node: InputNode,
  parentDirection: Direction | undefined,
): CSSProperties {
  const { typography } = node;
  return {
    ...boxStyle(node.box, parentDirection),
    display: "flex",
    alignItems: "center",
    color: node.color,
    opacity: 0.6,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: `${typography.lineHeight}px`,
    letterSpacing: typography.letterSpacing,
    textAlign: typography.textAlign,
    background: node.background?.color,
    border: node.border
      ? `${node.border.width}px solid ${node.border.color}`
      : undefined,
    borderRadius: node.border?.radius,
    boxSizing: "border-box",
  };
}

/**
 * 선택된 노드가 실제로 몇 px로 그려졌는지 재서 스토어에 올린다.
 * transform: scale은 offsetWidth/Height에 영향을 주지 않으므로 줌과 무관한 실측값이다.
 */
function useReportMeasuredSize(
  ref: RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    const element = ref.current;
    if (!active || element === null) return;

    function report() {
      if (element === null) return;
      useMeasureStore.getState().setSize({
        width: Math.round(element.offsetWidth),
        height: Math.round(element.offsetHeight),
      });
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      observer.disconnect();
      useMeasureStore.getState().setSize(null);
    };
  }, [ref, active]);
}

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
function handleNodeClick(clickedId: NodeId, event: ReactMouseEvent) {
  // 중첩된 부모의 핸들러까지 함께 실행되면 어느 노드를 클릭했는지 알 수 없다.
  event.stopPropagation();

  const tool = useToolStore.getState().activeTool;
  const { spec, activePageId, select } = useEditorStore.getState();
  const { nodes, root } = spec.pages[activePageId];

  if (tool === "frame" || tool === "text") {
    insertNewNode(tool, resolveInsertParent({ nodes, root, clickedId }));
    return;
  }

  // Select 도구 — Cmd(macOS) / Ctrl(Windows)를 누르면 상세 지정(최하위)
  select(
    resolveClickTarget({
      nodes,
      root,
      clickedId,
      deep: event.metaKey || event.ctrlKey,
    }),
  );
}

/** 아트보드 바깥(캔버스 바탕)을 클릭했을 때. */
function handleBackgroundClick() {
  const tool = useToolStore.getState().activeTool;
  const { spec, activePageId, select } = useEditorStore.getState();

  if (tool === "frame" || tool === "text") {
    insertNewNode(tool, spec.pages[activePageId].root);
    return;
  }

  select(null);
}

function RenderNode({
  id,
  parentDirection,
}: {
  id: NodeId;
  /** 부모 프레임의 레이아웃 방향. 최상위 노드는 부모가 없어 undefined. */
  parentDirection?: Direction;
}) {
  const node = useEditorStore(
    (state) => state.spec.pages[state.activePageId].nodes[id],
  );
  const selectedId = useEditorStore((state) => state.selectedId);
  const ref = useRef<HTMLDivElement>(null);
  const selected = selectedId === id;

  useReportMeasuredSize(ref, selected && node?.visible !== false);

  if (node === undefined || node.visible === false) {
    return null;
  }

  const outline = selected ? { outline: "2px solid #F97316", outlineOffset: 1 } : {};

  if (node.type === "text") {
    return (
      <div
        ref={ref}
        // 스펙상의 노드 id를 DOM에 그대로 남긴다 — 중첩 안쪽을 상세 지정했을 때
        // 어떤 item이 잡혔는지 개발자 도구에서 바로 확인할 수 있다.
        data-node-id={id}
        style={{ ...textStyle(node, parentDirection), ...outline }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        {node.content}
      </div>
    );
  }

  if (node.type === "image") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...imageStyle(node, parentDirection), ...outline }}
        onClick={(event) => handleNodeClick(id, event)}
      />
    );
  }

  if (node.type === "button") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...buttonStyle(node, parentDirection), ...outline }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        {node.content}
      </div>
    );
  }

  if (node.type === "input") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...inputStyle(node, parentDirection), ...outline }}
        onClick={(event) => handleNodeClick(id, event)}
      >
        {node.placeholder}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-node-id={id}
      style={{ ...frameStyle(node, parentDirection), ...outline }}
      onClick={(event) => handleNodeClick(id, event)}
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

export function Canvas() {
  const activePageId = useEditorStore((state) => state.activePageId);
  const root = useEditorStore((state) => state.spec.pages[state.activePageId].root);
  const size = useEditorStore((state) => state.spec.pages[state.activePageId].size);
  const screenName = useEditorStore((state) => state.spec.pages[state.activePageId].name);
  const selectedId = useEditorStore((state) => state.selectedId);
  const zoom = useViewStore((s) => s.zoom);
  const showGrid = useViewStore((s) => s.showGrid);
  const fillViewport = useViewStore((s) => s.fillViewport);
  const viewport = useViewStore((s) => s.viewport);
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

  // 뷰포트 실측값을 스토어에 올린다 — Fit to Screen이 이 값으로 확대율을 계산한다.
  useEffect(() => {
    const node = mainRef.current;
    if (node === null) return;

    function report() {
      if (node === null) return;
      const style = getComputedStyle(node);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      useViewStore.getState().setViewport({
        width: Math.max(0, node.clientWidth - padX),
        height: Math.max(0, node.clientHeight - padY),
      });
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    useViewStore.getState().setContent(size);
  }, [size]);

  // 처음 열었을 때는 Figma처럼 아트보드 전체가 보이도록 맞춘다.
  // 100%로 시작하면 아트보드가 뷰포트보다 커서 캔버스 바탕이 안 보이고,
  // 아트보드가 "캔버스 위에 얹힌 오브젝트"로 읽히지 않는다.
  //
  // 페이지를 바꿀 때도 다시 맞춘다. 1440×900에서 390×844로 옮겼는데 확대율이
  // 그대로면 아트보드가 뷰포트 구석에 조그맣게 남는다.
  //
  // 채우기 모드에서는 "뷰포트 가로 = 페이지 가로"가 곧 규칙이므로 한 번만 맞추면
  // 안 된다. 창을 줄이거나 해상도를 바꿀 때마다 다시 맞춰야 계속 꽉 찬다.
  const fittedFor = useRef<PageId | null>(null);
  useEffect(() => {
    if (viewport === null) return;
    if (!fillViewport && fittedFor.current === activePageId) return;
    fittedFor.current = activePageId;
    useViewStore.getState().fitToScreen();
  }, [viewport, activePageId, fillViewport, size]);

  const scale = zoom / 100;

  // scrollbar-gutter는 세로 스크롤바 자리를 항상 비워둔다. 없으면 채우기 모드에서
  // 되먹임 진동이 난다: 스크롤바 등장 → clientWidth 감소 → 배율 축소 → 내용이 짧아져
  // 스크롤바 소멸 → clientWidth 복귀 → 다시 등장…이 무한 반복된다.
  return (
    <main
      ref={mainRef}
      className={`relative overflow-auto bg-surface-canvas [grid-area:canvas] [scrollbar-gutter:stable] ${
        fillViewport ? "" : "p-8"
      }`}
      onClick={handleBackgroundClick}
    >
      {/*
        TODO(캔버스 담당): 격자를 Figma처럼 "캔버스 평면에 깔린" 배경으로 바꿀 것.
        지금은 absolute inset-0으로 뷰포트에 고정돼 있어, 스크롤·줌을 해도 격자가
        따라 움직이지 않고 벽지처럼 제자리에 머문다. 그래서 아트보드가 캔버스 위에
        놓여 있다는 느낌이 깨진다. 격자는 아트보드와 같은 변환(스크롤 오프셋 + 줌)을
        받는 레이어에 그려야 하고, 칸 크기도 줌에 비례해야 한다
        (--canvas-grid-size * scale). 스냅 기능은 아직 없으며 순수 배경 표시다.
      */}
      {showGrid && !fillViewport && (
        <div className="canvas-grid pointer-events-none absolute inset-0" />
      )}

      {/*
        바깥 박스는 "확대된 크기만큼의 자리"를 차지한다. transform: scale은 보이는
        크기만 바꾸고 레이아웃 박스는 그대로라, 이 박스가 없으면 스크롤 범위가
        확대율과 어긋난다(25%인데도 100% 크기의 빈 공간이 남는 식).
      */}
      <div
        className="relative mx-auto"
        style={{ width: size.width * scale, height: size.height * scale }}
      >
        {/*
          Figma처럼 아트보드 위에 화면 이름을 띄운다. 경계를 알려주는 가장 강한
          단서라, 그림자만으로는 부족한 어두운 테마에서 특히 중요하다.
          확대율과 무관하게 항상 같은 크기로 보이도록 아트보드 바깥에 둔다.
          채우기 모드에서는 경계가 곧 뷰포트 경계라 이름표도 그림자도 필요 없다.
        */}
        {!fillViewport && (
          <span
            onClick={(event) => event.stopPropagation()}
            className="absolute bottom-full left-0 mb-1 max-w-full truncate text-xs text-content-muted"
          >
            {screenName}
          </span>
        )}
        {/*
          아트보드. 페이지 size로 고정하고 좌상단 기준으로 확대해 바깥 박스를 정확히 채운다.
          자식이 커져도 아트보드는 그대로고 넘치는 만큼 밖으로 삐져나온다(Figma와 동일).

          scale은 Tailwind 클래스가 아니라 인라인 transform이다 — 확대율이 25% 배수가
          아닌 임의값(예: 57%)까지 가야 Fit/채우기가 여백 없이 정확히 맞는다. 바로 위
          width/height와 같은 부류(스펙에서 계산된 치수)이므로
          docs/DESIGN-TOKEN-RULES.md의 인라인 스타일 금지 예외에 해당한다.
        */}
        <div
          className={`relative bg-surface-raised origin-top-left ${
            fillViewport ? "" : "shadow-modal"
          }`}
          style={{
            width: size.width,
            height: size.height,
            transform: `scale(${scale})`,
          }}
        >
          <RenderNode id={root} />
        </div>
      </div>

      {/*
        표시 전용 배지. main의 자식이라 클릭이 바탕 핸들러까지 올라가는데, 생성
        도구가 켜져 있으면 배지를 눌렀을 뿐인데 노드가 생긴다. 클릭을 통과시키면
        (pointer-events-none) 결국 바탕을 누른 것이 되므로 여기서 삼킨다.
      */}
      <div
        onClick={(event) => event.stopPropagation()}
        className="absolute bottom-3 left-3 flex items-center gap-2"
      >
        <span className="rounded-control bg-surface-raised px-2 py-1 text-xs text-content-muted shadow-card">
          {Math.round(zoom)}%
        </span>
        {/*
          선택된 노드의 id. Cmd/Ctrl+클릭으로 중첩 안쪽을 상세 지정했을 때
          의도한 item이 잡혔는지 눈으로 바로 확인하는 용도다.
        */}
        {selectedId !== null && (
          <span
            aria-label="선택한 노드 id"
            className="rounded-control bg-surface-raised px-2 py-1 font-mono text-xs text-content shadow-card"
          >
            #{selectedId}
          </span>
        )}
      </div>
    </main>
  );
}
