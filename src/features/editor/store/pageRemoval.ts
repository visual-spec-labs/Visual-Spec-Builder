import { validateProjectSpec, type NodeId, type PageId, type ProjectSpec } from "@/features/editor/schema";

export interface IncomingAction {
  pageId: PageId;
  nodeId: NodeId;
  pageName: string;
  nodeName: string;
}

export function canRemovePage(spec: ProjectSpec, id: PageId): boolean {
  if (!Object.hasOwn(spec.pages, id)) return false;
  return spec.pageOrder.some((other) => other !== id && spec.pages[other] !== undefined && (spec.pages[other].kind ?? "page") === "page");
}

/** Only surviving sources belong in the reviewed impact list. No mutation. */
export function incomingActions(spec: ProjectSpec, id: PageId): IncomingAction[] {
  return Object.entries(spec.pages).filter(([pageId]) => pageId !== id).flatMap(([pageId, page]) =>
    Object.entries(page.nodes).flatMap(([nodeId, node]) =>
      node.type === "button" && node.action && "target" in node.action && node.action.target === id
        ? [{ pageId, nodeId, pageName: page.name, nodeName: node.name }] : []),
  ).sort((a, b) => a.pageId.localeCompare(b.pageId) || a.nodeId.localeCompare(b.nodeId));
}

export function preparePageRemoval(spec: ProjectSpec, id: PageId): { ok: true; spec: ProjectSpec } | { ok: false; message: string } {
  if (!canRemovePage(spec, id)) return { ok: false, message: "일반 page는 최소 한 장 남아야 합니다. 삭제 대상이 있는지 확인하세요." };
  const pages = { ...spec.pages };
  delete pages[id];
  for (const source of incomingActions(spec, id)) {
    const page = pages[source.pageId];
    const node = page.nodes[source.nodeId];
    if (node.type !== "button") continue;
    const next = { ...node }; delete next.action;
    pages[source.pageId] = { ...page, nodes: { ...page.nodes, [source.nodeId]: next } };
  }
  const order = spec.pageOrder.filter((pageId) => pageId !== id);
  if (spec.pageOrder[0] === id) {
    const first = order.findIndex((pageId) => (pages[pageId].kind ?? "page") === "page");
    if (first > 0) order.unshift(...order.splice(first, 1));
  }
  const candidate: ProjectSpec = { ...spec, pages, pageOrder: order as ProjectSpec["pageOrder"] };
  const result = validateProjectSpec(candidate);
  return result.valid ? { ok: true, spec: candidate } : {
    ok: false, message: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
  };
}
