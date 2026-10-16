import type { ProjectSpec } from "@/features/editor/schema";
import type { ProjectPlan } from "@/features/editor/ticket/types";
import { buildProjectInputSnapshot, projectAssetPaths, type ProjectInputSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
import { canonicalJson, sha256Hex } from "./contentHash";

export const PROJECT_TEMPLATE_VERSION = "project-runtime-2/assets-2";
const hash = (value: unknown) => sha256Hex(new TextEncoder().encode(canonicalJson(value)));

/** Runtime progress is not generation input. Array ordering remains meaningful. */
export function structuralProjectPlan(plan: ProjectPlan) {
  return { ...plan, tickets: plan.tickets.map(({ status: _status, error: _error, ...ticket }) => ticket) };
}

/** S1 has no widget instances. Validate the full project before using this traversal. */
function renderClosure(project: ProjectSpec, sourcePageId: string): string[] {
  const seen = new Set<string>();
  const pending = [sourcePageId];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    const screen = project.pages[id];
    if (!screen || screen.kind === "widget") throw Error("S1 생성 화면이 아닙니다.");
    seen.add(id);
    for (const node of Object.values(screen.nodes)) {
      if (node.type === "button" && node.action?.type === "openModal") pending.push(node.action.target);
    }
  }
  return [...seen].sort();
}

/** Revalidates the complete snapshot; does not infer provenance from ticket status. */
export function projectGenerationFingerprints(inputSnapshot: ProjectInputSnapshot, templateVersion = PROJECT_TEMPLATE_VERSION): {
  project: string; pages: Record<string, string>; closures: Record<string, string[]>;
} {
  const prepared = buildProjectInputSnapshot(inputSnapshot.requestId, inputSnapshot.project, inputSnapshot.plan, inputSnapshot.assets);
  const snapshot = JSON.parse(prepared.content) as ProjectInputSnapshot;
  if (inputSnapshot.protocol !== 1 || inputSnapshot.projectId !== snapshot.project.projectId) throw Error("입력 snapshot 신원이 다릅니다.");
  if (!templateVersion.trim()) throw Error("생성 정책 버전이 필요합니다.");
  const project = snapshot.project;
  const plan = structuralProjectPlan(snapshot.plan);
  const assets = snapshot.assets.map(({ dataBase64: _bytes, ...mapping }) => mapping);
  const pages: Record<string, string> = Object.create(null);
  const closures: Record<string, string[]> = Object.create(null);
  const generatedIds = project.pageOrder.filter(id => project.pages[id].kind !== "widget");
  const screens = (ids: string[]) => ids.map(id => ({ id, screen: project.pages[id] }));
  for (const id of generatedIds) {
    const closure = renderClosure(project, id);
    closures[id] = closure;
    const referenced = new Set(projectAssetPaths({ ...project, pageOrder: [closure[0]!, ...closure.slice(1)] }));
    pages[id] = hash({ projectId: project.projectId, sourcePageId: id, templateVersion,
      screens: screens(closure), tickets: plan.tickets.filter(ticket => closure.includes(ticket.sourcePageId)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      assets: assets.filter(asset => referenced.has(asset.sourcePath)) });
  }
  return { project: hash({ projectId: project.projectId, pageOrder: project.pageOrder,
    screens: screens([...generatedIds].sort()), plan, templateVersion, assets }), pages, closures };
}

export function projectGenerationPath(projectId: string): string {
  if (!projectId) throw Error("프로젝트 신원이 필요합니다.");
  return `runtime/project-generation-${sha256Hex(new TextEncoder().encode(projectId))}.json`;
}
