import { useEffect, useRef, type RefObject } from "react";
import type { NodeId } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useMeasureStore } from "@/features/editor/store/measureStore";
import type { Direction } from "./canvasLayout";
import { handleNodeClick, handleNodeDoubleClick, handleNodeContextMenu } from "./canvasSelection";
import { ResizeHandles } from "./CanvasResizeHandles";
import { buttonStyle, frameStyle, imageStyle, inputStyle, textStyle } from "./nodeStyles";

/** 스펙 트리의 DOM 렌더링과 선택 노드 실측. 이벤트 해석은 canvasSelection에 위임한다. */
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

export function RenderNode({
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

  // position: relative는 리사이즈 핸들(ResizeHandles)이 이 노드 기준으로 앉기
  // 위한 것 — 선택 안 됐을 때는 핸들도 안 그리니 필요 없다. 선택 시각 표시
  // 자체는 이 값이 아니라 아래 useSelectionRect 기반 오버레이가 맡는다.
  const resizeAnchor = selected ? { position: "relative" as const } : {};

  if (node.type === "text") {
    return (
      <div
        ref={ref}
        // 스펙상의 노드 id를 DOM에 그대로 남긴다 — 중첩 안쪽을 상세 지정했을 때
        // 어떤 item이 잡혔는지 개발자 도구에서 바로 확인할 수 있다.
        data-node-id={id}
        style={{ ...textStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
        onDoubleClick={(event) => handleNodeDoubleClick(id, event)}
        onContextMenu={(event) => handleNodeContextMenu(id, event)}
      >
        {node.content}
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  if (node.type === "image") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...imageStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
        onDoubleClick={(event) => handleNodeDoubleClick(id, event)}
        onContextMenu={(event) => handleNodeContextMenu(id, event)}
      >
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  if (node.type === "button") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...buttonStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
        onDoubleClick={(event) => handleNodeDoubleClick(id, event)}
        onContextMenu={(event) => handleNodeContextMenu(id, event)}
      >
        {node.content}
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  if (node.type === "input") {
    return (
      <div
        ref={ref}
        data-node-id={id}
        style={{ ...inputStyle(node, parentDirection), ...resizeAnchor }}
        onClick={(event) => handleNodeClick(id, event)}
        onDoubleClick={(event) => handleNodeDoubleClick(id, event)}
        onContextMenu={(event) => handleNodeContextMenu(id, event)}
      >
        <span style={{ opacity: 0.6 }}>{node.placeholder}</span>
        {selected && <ResizeHandles id={id} box={node.box} />}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-node-id={id}
      style={{ ...frameStyle(node, parentDirection), ...resizeAnchor }}
      onClick={(event) => handleNodeClick(id, event)}
      onDoubleClick={(event) => handleNodeDoubleClick(id, event)}
      onContextMenu={(event) => handleNodeContextMenu(id, event)}
    >
      {node.children.map((child) => (
        <RenderNode
          key={child.node}
          id={child.node}
          parentDirection={node.layout.direction}
        />
      ))}
      {selected && <ResizeHandles id={id} box={node.box} />}
    </div>
  );
}

