import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { Action, NodeId, ProjectSpec, ScreenSpec } from "@/features/editor/schema";
import { resolveResponsiveScreen } from "@/features/editor/responsive/resolveResponsive";
import type { Direction } from "./canvasLayout";
import { buttonStyle, frameStyle, imageStyle, inputStyle, textStyle } from "./nodeStyles";
import { WidgetInstance } from "./WidgetInstance";

function viewport() {
  const visual = window.visualViewport;
  return { width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight,
    left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0, layoutWidth: window.innerWidth };
}

/** Read-only rendering: preview events never enter editor selection/drag/Undo paths. */
function PreviewNode({ project, width, screen, id, direction, action, rootStyle }: {
  project: ProjectSpec; width: number; screen: ScreenSpec; id: NodeId; direction?: Direction; action: (action?: Action) => void; rootStyle?: CSSProperties;
}) {
  const node = screen.nodes[id];
  if (!node || node.visible === false) return null;
  const props = { "data-preview-node": id };
  if (node.type === "text") return <div {...props} style={textStyle(node, direction)}>{node.content}</div>;
  if (node.type === "image") return <div {...props} role="img" aria-label={node.name} style={imageStyle(node, direction)} />;
  if (node.type === "input") return <input {...props} aria-label={node.name} placeholder={node.placeholder} style={inputStyle(node, direction)} />;
  if (node.type === "button") return <button {...props} type="button" style={buttonStyle(node, direction)} onClick={() => action(node.action)}>{node.content}</button>;
  if (node.type === "instance") return <WidgetInstance project={project} instance={node} width={width} direction={direction} onAction={action} />;
  return <div {...props} style={{ ...frameStyle(node, direction), ...rootStyle }}>
    {node.children.map(child => <PreviewNode key={child.node} project={project} width={width} screen={screen} id={child.node} direction={node.layout.direction} action={action} />)}
  </div>;
}

/** D6 preview uses the real browser host viewport, not the editable panel's preferred width. */
export function ModalPreview({ project, pageId, editorSurface, onClose, onNavigate }: {
  project: ProjectSpec; pageId: string; editorSurface: RefObject<HTMLElement | null>; onClose: () => void; onNavigate: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [modalId, setModalId] = useState(pageId);
  const [view, setView] = useState(viewport);
  const source = project.pages[modalId];
  const screen = source && resolveResponsiveScreen(source, view.layoutWidth);
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current;
    const locked = [document.documentElement, document.body, editorSurface.current].filter((node): node is HTMLElement => node !== null)
      .map(node => ({ node, value: node.style.getPropertyValue("overflow"), priority: node.style.getPropertyPriority("overflow"), left: node.scrollLeft, top: node.scrollTop }));
    for (const { node } of locked) node.style.setProperty("overflow", "hidden");
    element?.showModal();
    return () => {
      element?.close();
      for (const { node, value, priority, left, top } of locked) {
        if (value) node.style.setProperty("overflow", value, priority);
        else node.style.removeProperty("overflow");
        node.scrollTo(left, top);
      }
      const target = trigger instanceof HTMLElement && trigger.isConnected ? trigger : editorSurface.current;
      target?.focus({ preventScroll: true });
    };
  }, [editorSurface]);
  useEffect(() => {
    const update = () => setView(viewport());
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    (panel.current?.querySelector<HTMLElement>("button, input") ?? panel.current)?.focus();
  }, [modalId]);
  if (!screen || source.kind !== "modal") return null;
  function run(action?: Action) {
    if (action?.type === "close") onClose();
    else if (action?.type === "openModal" && project.pages[action.target]?.kind === "modal") setModalId(action.target);
    else if (action?.type === "navigate" && project.pages[action.target] && (project.pages[action.target].kind ?? "page") === "page") {
      onClose(); onNavigate(action.target);
    }
  }
  const availableHeight = `max(0px, calc(${view.height}px - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))`;
  return <dialog ref={dialog} aria-label={`${screen.name} 모달 미리보기`} className="m-0 max-h-none max-w-none border-0 p-0 backdrop:bg-transparent"
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== "Tab") return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")]
        .filter(element => element.getClientRects().length > 0);
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }}
    style={{ position: "fixed", left: view.left, top: view.top, width: view.width, height: view.height, background: "rgba(0,0,0,0.4)" }}>
    <div className="flex h-full w-full items-center justify-center" style={{ padding: "calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))", boxSizing: "border-box" }}>
      <div ref={panel} tabIndex={-1} data-testid="modal-preview-panel" style={{ width: screen.size.width, maxWidth: "100%", minHeight: `min(${screen.size.height}px, ${availableHeight})`, maxHeight: availableHeight, overflow: "auto", overscrollBehavior: "contain" }}
        onFocusCapture={event => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}>
        <PreviewNode project={project} width={view.layoutWidth} screen={screen} id={screen.root} action={run} rootStyle={{ width: "100%", height: "auto", minHeight: `min(${screen.size.height}px, ${availableHeight})`, flex: "none", boxSizing: "border-box" }} />
      </div>
    </div>
    <button type="button" className="absolute right-2 top-2 rounded bg-surface px-2 py-1 text-content" onClick={onClose}>미리보기 닫기</button>
  </dialog>;
}
