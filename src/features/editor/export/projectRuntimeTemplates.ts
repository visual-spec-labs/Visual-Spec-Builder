import type { ProjectProvenanceContext } from "./projectGenerationProvenance";
import { projectProvenanceContext } from "./projectGenerationProvenance";

/** GUI-owned artifacts only. Agent tickets never authorize overwriting these files. */
export function renderProjectRuntime(input: ProjectProvenanceContext): Map<string, string> {
  const context = projectProvenanceContext(input.snapshot, input.projectRoot);
  const plan = context.snapshot.plan;
  const roots = plan.tickets.filter(ticket => ticket.kind === "page");
  const aliases = new Map(roots.map((ticket, index) => [ticket.sourcePageId, `Screen${index}`]));
  const imports = roots.map(ticket => `import ${aliases.get(ticket.sourcePageId)} from ${JSON.stringify(`../${ticket.sourcePageId}/pages/${ticket.componentName}`)};`);
  const pages = plan.routes.map(route => `[${JSON.stringify(route.pageId)}, ${aliases.get(route.pageId)}]`);
  const modals = roots.filter(ticket => context.snapshot.project.pages[ticket.sourcePageId].kind === "modal");
  const routes = [
    'import type { ComponentType } from "react";', ...imports,
    'export interface ScreenActions { onNavigate: (target: string) => void; onOpenModal: (target: string) => void; onClose: () => void; }',
    `export const entryPageId = ${JSON.stringify(plan.entryPageId)};`,
    `export const pageScreens = new Map<string, ComponentType<ScreenActions>>([${pages.join(",")}]);`,
    `export const modalScreens = new Map<string, ComponentType<ScreenActions>>([${modals.map(ticket => `[${JSON.stringify(ticket.sourcePageId)}, ${aliases.get(ticket.sourcePageId)}]`).join(",")}]);`,
    `export const modalNames = new Map<string, string>([${modals.map(ticket => `[${JSON.stringify(ticket.sourcePageId)}, ${JSON.stringify(context.snapshot.project.pages[ticket.sourcePageId].name || ticket.sourcePageId)}]`).join(",")}]);`,
    `export const modalSizes = new Map<string, { width: number; height: number }>([${modals.map(ticket => `[${JSON.stringify(ticket.sourcePageId)}, ${JSON.stringify(context.snapshot.project.pages[ticket.sourcePageId].size)}]`).join(",")}]);`,
  ].join("\n") + "\n";
  const files = new Map<string, string>([
    [`${context.projectRoot}/runtime/Routes.ts`, routes],
    [`${context.projectRoot}/runtime/Host.tsx`, HOST_SOURCE],
    [`${context.projectRoot}/runtime/Entry.tsx`, 'import ProjectHost from "./Host";\nexport default function ProjectEntry() { return <ProjectHost />; }\n'],
  ]);
  const expected = context.outputs.filter(output => output.scope === "project").map(output => output.filePath).sort();
  if (JSON.stringify([...files.keys()].sort()) !== JSON.stringify(expected)) throw Error("프로젝트 artifact 계획과 템플릿 출력이 다릅니다.");
  return files;
}

const HOST_SOURCE = String.raw`import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { entryPageId, pageScreens, modalScreens, modalSizes, modalNames, type ScreenActions } from "./Routes";
function viewport() {
  const visual = window.visualViewport;
  return { width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight, left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0 };
}
function ModalSurface({ id, actions, trigger, fallback }: { id: string; actions: ScreenActions; trigger: RefObject<HTMLElement | null>; fallback: RefObject<HTMLDivElement | null> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(viewport);
  const Screen = modalScreens.get(id)!;
  const size = modalSizes.get(id)!;
  useEffect(() => {
    const element = dialog.current!;
    const locked = [document.documentElement, document.body, fallback.current].filter((node): node is HTMLElement => node !== null).map(node => ({ node, overflow: node.style.getPropertyValue("overflow"), priority: node.style.getPropertyPriority("overflow"), left: node.scrollLeft, top: node.scrollTop }));
    for (const item of locked) item.node.style.setProperty("overflow", "hidden");
    element.showModal();
    return () => {
      element.close();
      for (const item of locked) {
        if (item.overflow) item.node.style.setProperty("overflow", item.overflow, item.priority);
        else item.node.style.removeProperty("overflow");
        item.node.scrollTo(item.left, item.top);
      }
      (trigger.current?.isConnected ? trigger.current : fallback.current)?.focus({ preventScroll: true });
    };
  }, [trigger, fallback]);
  useEffect(() => {
    const update = () => setView(viewport());
    window.addEventListener("resize", update); window.visualViewport?.addEventListener("resize", update); window.visualViewport?.addEventListener("scroll", update);
    return () => { window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, []);
  useEffect(() => { panel.current?.scrollTo(0, 0); (panel.current?.querySelector<HTMLElement>("button:not(:disabled),input:not(:disabled),a[href],select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])") ?? panel.current)?.focus(); }, [id]);
  const availableHeight = "max(0px, calc(" + view.height + "px - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))";
  const minimumHeight = "min(" + size.height + "px, " + availableHeight + ")";
  return <dialog ref={dialog} aria-label={modalNames.get(id) ?? id} className="vsb-project-dialog"
    onClick={event => event.stopPropagation()}
    onCancel={event => { event.preventDefault(); actions.onClose(); }}
    onKeyDown={event => {
      event.stopPropagation(); if (event.key !== "Tab") return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),a[href],select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")].filter(item => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === items[0] || !items.includes(document.activeElement as HTMLElement))) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }}
    style={{ position:"fixed", left:view.left, top:view.top, width:view.width, height:view.height, margin:0, maxWidth:"none", maxHeight:"none", border:0, padding:0, background:"rgba(0,0,0,0.4)" }}>
    <style>{".vsb-project-dialog::backdrop{background:transparent}.vsb-project-modal-content > *{width:100%!important;height:auto!important;min-height:" + minimumHeight + "!important;flex:none!important;box-sizing:border-box!important}"}</style>
    <div style={{ display:"flex", width:"100%", height:"100%", alignItems:"center", justifyContent:"center", boxSizing:"border-box", padding:"calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))" }}>
      <div ref={panel} tabIndex={-1} className="vsb-project-modal-content" style={{ width:size.width, maxWidth:"100%", minHeight:minimumHeight, maxHeight:availableHeight, overflow:"auto", overscrollBehavior:"contain" }} onFocusCapture={event => event.target.scrollIntoView({ block:"nearest", inline:"nearest" })}>
        <Screen {...actions} />
      </div>
    </div>
  </dialog>;
}
export default function ProjectHost() {
  const [pageId, setPageId] = useState(entryPageId);
  const [modalId, setModalId] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const fallback = useRef<HTMLDivElement>(null);
  const onClose = useCallback(() => setModalId(null), []);
  const onNavigate = useCallback((target: string) => { if (pageScreens.has(target)) { setPageId(target); setModalId(null); } }, []);
  const onOpenModal = useCallback((target: string) => {
    if (!modalScreens.has(target)) return;
    if (modalId === null) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setModalId(target);
  }, [modalId]);
  const actions = { onNavigate, onOpenModal, onClose };
  const Page = pageScreens.get(pageId)!;
  return <div ref={fallback} tabIndex={-1} data-vsb-project-host="">
    <Page {...actions} />
    {modalId !== null && <ModalSurface id={modalId} actions={actions} trigger={trigger} fallback={fallback} />}
  </div>;
}
`;
