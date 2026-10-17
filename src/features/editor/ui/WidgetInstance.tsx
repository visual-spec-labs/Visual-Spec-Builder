import type { Action, InstanceNode, NodeId, ProjectSpec, ScreenSpec } from "@/features/editor/schema";
import type { MouseEventHandler, ReactNode, Ref } from "react";
import { resolveResponsiveScreen } from "@/features/editor/responsive/resolveResponsive";
import { boxStyle, type Direction } from "./canvasLayout";
import { buttonStyle, frameStyle, imageStyle, inputStyle, textStyle } from "./nodeStyles";

/** Resolve the source at the host viewport, then apply only the instance's direct text overrides. */
export function resolvedWidget(project: ProjectSpec, instance: InstanceNode, width: number): ScreenSpec | null {
  const source = Object.prototype.hasOwnProperty.call(project.pages, instance.ref) ? project.pages[instance.ref] : undefined;
  if (!source || source.kind !== "widget") return null;
  const responsive = resolveResponsiveScreen(source, width);
  if (!instance.overrides) return responsive;
  const nodes = { ...responsive.nodes };
  for (const [id, override] of Object.entries(instance.overrides)) {
    const original = nodes[id];
    if (!original || (original.type !== "text" && original.type !== "button")) return null;
    nodes[id] = { ...original, ...override };
  }
  return { ...responsive, nodes };
}

function WidgetNode({ project, screen, id, direction, width, ancestry, nodePath = new Set(), onAction }: {
  project: ProjectSpec; screen: ScreenSpec; id: NodeId; direction?: Direction; width: number;
  ancestry: ReadonlySet<string>; nodePath?: ReadonlySet<NodeId>; onAction?: (action?: Action) => void;
}) {
  if (nodePath.has(id)) return null;
  const node = screen.nodes[id];
  if (!node || node.visible === false) return null;
  if (node.type === "instance") return <WidgetInstance project={project} instance={node} width={width} direction={direction} ancestry={ancestry} onAction={onAction} />;
  if (node.type === "text") return <div style={textStyle(node, direction)}>{node.content}</div>;
  if (node.type === "image") return <div role="img" aria-label={node.name} style={imageStyle(node, direction)} />;
  if (node.type === "input") return onAction
    ? <input aria-label={node.name} placeholder={node.placeholder} style={inputStyle(node, direction)} />
    : <div style={inputStyle(node, direction)}>{node.placeholder}</div>;
  if (node.type === "button") return onAction
    ? <button type="button" style={buttonStyle(node, direction)} onClick={() => onAction(node.action)}>{node.content}</button>
    : <div style={buttonStyle(node, direction)}>{node.content}</div>;
  const nextPath = new Set(nodePath).add(id);
  return <div style={frameStyle(node, direction)}>{node.children.map(child =>
    <WidgetNode key={child.node} project={project} screen={screen} id={child.node} direction={node.layout.direction} width={width} ancestry={ancestry} nodePath={nextPath} onAction={onAction} />
  )}</div>;
}

/** The wrapper is the selected host node; source children never expose stored node IDs in the DOM. */
export function WidgetInstance({ project, instance, width, direction, ancestry = new Set(), onAction, hostRef, hostNodeId, onClick, onDoubleClick, onContextMenu, children }: {
  project: ProjectSpec; instance: InstanceNode; width: number; direction?: Direction;
  ancestry?: ReadonlySet<string>; onAction?: (action?: Action) => void;
  hostRef?: Ref<HTMLDivElement>; hostNodeId?: NodeId;
  onClick?: MouseEventHandler<HTMLDivElement>; onDoubleClick?: MouseEventHandler<HTMLDivElement>; onContextMenu?: MouseEventHandler<HTMLDivElement>;
  children?: ReactNode;
}) {
  if (instance.visible === false) return null;
  const source = ancestry.has(instance.ref) ? null : resolvedWidget(project, instance, width);
  const path = new Set(ancestry).add(instance.ref);
  return <div ref={hostRef} data-node-id={hostNodeId} role="group" aria-label={instance.name} onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} style={{ ...boxStyle(instance.box, direction), display: "flex", flexDirection: "column", boxSizing: "border-box", ...(children ? { position: "relative" as const } : {}) }}>
    {source ? <WidgetNode project={project} screen={source} id={source.root} direction="column" width={width} ancestry={path} onAction={onAction} /> : <span>위젯 참조를 표시할 수 없습니다</span>}
    {children}
  </div>;
}
