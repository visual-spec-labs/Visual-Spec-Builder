import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";
import { collectSubtreeIds } from "@/features/editor/command/applyCommand";
import { compileScreenTickets } from "./compileTickets";
import { referencedWidgets } from "./widgetReachability";
import type { ProjectPlan, ProjectTicket } from "./types";
import { validateProjectPlan } from "./validate";

export interface ProjectPlanIssue {
  code: "project" | "shape" | "identity" | "dependency" | "plan";
  path: string;
  message: string;
}
export interface ProjectPlanValidation {
  valid: boolean;
  issues: ProjectPlanIssue[];
}
export class ProjectPlanError extends Error {
  constructor(public readonly issues: ProjectPlanIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ProjectPlanError";
  }
}

/** No generated identity: opening legacy documents must assign projectId first. */
function inputIssues(project: unknown): ProjectPlanIssue[] {
  const result = validateProjectSpec(project);
  if (!result.valid) return result.issues.map(issue => ({ ...issue, code: "project" }));
  if (!(project as ProjectSpec).projectId) {
    return [{ code: "identity", path: "/projectId", message: "프로젝트 생성에는 안정 projectId가 필요합니다." }];
  }
  return [];
}

function buildPlan(project: ProjectSpec): ProjectPlan {
  const tickets: ProjectTicket[] = [];
  const routes: ProjectPlan["routes"] = [];
  const roots: string[] = [];
  const excludedPages: ProjectPlan["excludedPages"] = [];
  const widgets = referencedWidgets(project);
  const widgetRoots = new Map([...widgets].map(id => [id, JSON.stringify([id, "component", project.pages[id].root])]));
  for (const sourcePageId of project.pageOrder) {
    const screen = project.pages[sourcePageId];
    const isWidget = screen.kind === "widget";
    if (isWidget && !widgets.has(sourcePageId)) {
      excludedPages.push({ pageId: sourcePageId, reason: "unreferenced-widget" });
      continue;
    }
    const local = compileScreenTickets(screen, true, true);
    const ids = new Map(local.map(ticket => [ticket.id, JSON.stringify([sourcePageId, isWidget && ticket.kind === "page" ? "component" : ticket.kind, ticket.instances[0]])]));
    for (const ticket of local) {
      const id = ids.get(ticket.id)!;
      const refs = new Set(ticket.instances.flatMap(nodeId => [...collectSubtreeIds(screen.nodes, nodeId)].flatMap(id => {
        const node = screen.nodes[id]; return node.type === "instance" ? [node.ref] : [];
      })));
      const dependsOn = [...new Set([...ticket.dependsOn.map(dep => ids.get(dep)!), ...[...refs].map(ref => widgetRoots.get(ref)! )])];
      tickets.push({ ...ticket, kind: isWidget && ticket.kind === "page" ? "component" : ticket.kind,
        ...(isWidget && ticket.kind === "page" ? { widgetRoot: true as const } : {}), version: "0.2", sourcePageId, id, dependsOn });
      if (ticket.kind === "page" && !isWidget) {
        roots.push(id);
        if ((screen.kind ?? "page") === "page") routes.push({ pageId: sourcePageId, ticketId: id });
      }
    }
  }
  return {
    version: "0.2", projectId: project.projectId!, tickets, routes,
    entryPageId: project.pageOrder[0], excludedPages,
    artifacts: [
      { id: "project:routes", kind: "routes", filePath: "runtime/Routes.ts", dependsOn: roots },
      { id: "project:host", kind: "host", filePath: "runtime/Host.tsx", dependsOn: ["project:routes"] },
      { id: "project:entry", kind: "entry", filePath: "runtime/Entry.tsx", dependsOn: ["project:host"] },
    ],
  };
}

// Object insertion order is immaterial; array order is part of the plan contract.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function planIssues(plan: ProjectPlan, project: ProjectSpec): ProjectPlanIssue[] {
  const issues: ProjectPlanIssue[] = [];
  const all = [...plan.tickets, ...plan.artifacts];
  const byId = new Map(all.map(item => [item.id, item]));
  if (byId.size !== all.length) issues.push({ code: "identity", path: "/", message: "티켓과 프로젝트 산출물 ID는 전역에서 유일해야 합니다." });
  for (const item of all) {
    for (const dep of item.dependsOn) {
      const target = byId.get(dep);
      if (!target || dep === item.id || ("sourcePageId" in item &&
        (!("sourcePageId" in target) || target.kind !== "component" ||
          (target.sourcePageId !== item.sourcePageId && !target.widgetRoot)))) {
        issues.push({ code: "dependency", path: "/", message: `허용되지 않는 생성 의존: ${item.id} → ${dep}` });
      }
    }
  }
  // Kahn traversal avoids recursion on untrusted dependency depth.
  const remaining = new Map(all.map(item => [item.id, new Set(item.dependsOn).size]));
  const dependents = new Map<string, string[]>();
  for (const item of all) for (const dep of new Set(item.dependsOn)) {
    dependents.set(dep, [...(dependents.get(dep) ?? []), item.id]);
  }
  const ready = [...remaining.keys()].filter(id => remaining.get(id) === 0);
  let visited = 0;
  for (let i = 0; i < ready.length; i++) {
    visited++;
    for (const id of dependents.get(ready[i]) ?? []) {
      remaining.set(id, remaining.get(id)! - 1);
      if (remaining.get(id) === 0) ready.push(id);
    }
  }
  if (visited !== byId.size) issues.push({ code: "dependency", path: "/", message: "생성 의존이 순환하거나 없는 ID를 참조합니다." });

  // Reconstruct the authoritative plan. This also verifies complete membership,
  // source-local instances, route/root correspondence, naming and artifact edges.
  // Status/error are execution state, never structural identity.
  const expected = buildPlan(project);
  const structural = { ...plan, tickets: plan.tickets.map(({ status: _status, error: _error, ...ticket }) => ticket) };
  const expectedStructural = { ...expected, tickets: expected.tickets.map(({ status: _status, ...ticket }) => ticket) };
  if (canonical(structural) !== canonical(expectedStructural)) {
    issues.push({ code: "plan", path: "/", message: "프로젝트 계획이 현재 프로젝트의 화면·티켓·경로·산출물과 일치하지 않습니다." });
  }
  return issues;
}

/** Required trust boundary before adopting an external/stored plan; shape alone is insufficient. */
export function validateProjectPlanContext(input: unknown, project: unknown): ProjectPlanValidation {
  try {
    const projectIssues = inputIssues(project);
    if (projectIssues.length) return { valid: false, issues: projectIssues };
    const shape = validateProjectPlan(input);
    if (!shape.valid) return { valid: false, issues: shape.issues.map(issue => ({ ...issue, code: "shape" })) };
    const issues = planIssues(input as ProjectPlan, project as ProjectSpec);
    return { valid: issues.length === 0, issues };
  } catch {
    return { valid: false, issues: [{ code: "plan", path: "/", message: "프로젝트 계획 검증 중 오류가 발생했습니다." }] };
  }
}

/** Pure project compiler. Invalid documents (including widgets) fail before planning. */
export function compileProjectTickets(project: ProjectSpec): ProjectPlan {
  const issues = inputIssues(project);
  if (issues.length) throw new ProjectPlanError(issues);
  const plan = buildPlan(project);
  const result = validateProjectPlanContext(plan, project);
  if (!result.valid) throw new ProjectPlanError(result.issues);
  return plan;
}
