import { describe, expect, it } from "vitest";
import type { ButtonNode, FrameNode, ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets, compileTickets, ProjectPlanError, validateProjectPlan, validateProjectPlanContext } from "@/features/editor/ticket";
import fixture from "./fixtures/screen-relations-project.json";

function project(): ProjectSpec {
  return { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: "stable-project" };
}

describe("project compiler and contextual plan boundary", () => {
  it("plans every page/modal in order, keeps widgets explicit, and does not mutate inputs", () => {
    const source = project();
    const before = structuredClone(source);
    const plan = compileProjectTickets(source);
    expect(source).toEqual(before);
    expect(validateProjectPlan(plan).valid).toBe(true);
    expect(validateProjectPlanContext(plan, source).valid).toBe(true);
    expect(plan.routes.map(route => route.pageId)).toEqual(["login", "dashboard"]);
    expect(plan.entryPageId).toBe("login");
    expect(plan.excludedPages).toEqual([{ pageId: "notificationWidget", reason: "widget-not-supported-in-s1" }]);
    expect(plan.artifacts[0].dependsOn).toEqual(plan.tickets.filter(t => t.kind === "page").map(t => t.id));
    expect(new Set(plan.tickets.map(t => t.sourcePageId))).toEqual(new Set(["login", "dashboard", "resetPassword"]));
    expect(new Set(plan.tickets.map(t => t.id)).size).toBe(plan.tickets.length);
  });

  it("keeps identity across display renames and distinguishes the same root ID in different pages", () => {
    const source = project();
    const before = compileProjectTickets(source);
    source.pages.login.name = "Renamed";
    const after = compileProjectTickets(source);
    expect(after.tickets.map(t => t.id)).toEqual(before.tickets.map(t => t.id));
    expect(after.tickets.find(t => t.kind === "page" && t.sourcePageId === "login")?.componentName).toBe("Renamed");
    expect(validateProjectPlanContext(before, source).valid).toBe(false);
  });

  it("rejects missing project identity without assigning one", () => {
    const source = project(); delete source.projectId;
    expect(() => compileProjectTickets(source)).toThrow(ProjectPlanError);
    expect(source.projectId).toBeUndefined();
  });

  it("rejects invalid widgets before excluding them", () => {
    const source = project();
    source.pages.notificationWidget.nodes.bad = { ...structuredClone(source.pages.login.nodes.loginButton), action: { type: "navigate", target: "missing" } } as ButtonNode;
    (source.pages.notificationWidget.nodes.root as FrameNode).children.push({ node: "bad" });
    expect(() => compileProjectTickets(source)).toThrow(/target|대상|missing/);
  });

  it("does not turn navigation/modal cycles into generation dependencies", () => {
    const source = project();
    source.pages.secondModal = structuredClone(source.pages.resetPassword);
    source.pageOrder.push("secondModal");
    (source.pages.resetPassword.nodes.closeButton as ButtonNode).action = { type: "openModal", target: "secondModal" };
    (source.pages.secondModal.nodes.closeButton as ButtonNode).action = { type: "openModal", target: "resetPassword" };
    const plan = compileProjectTickets(source);
    expect(validateProjectPlanContext(plan, source).valid).toBe(true);
    for (const ticket of plan.tickets) for (const dependency of ticket.dependsOn) {
      expect(plan.tickets.find(t => t.id === dependency)?.sourcePageId).toBe(ticket.sourcePageId);
    }
  });

  it("compares action intent for repeated subtrees while preserving the legacy planner", () => {
    const source = project();
    const screen = source.pages.login;
    const button = structuredClone(screen.nodes.loginButton) as ButtonNode;
    screen.nodes.other = { ...structuredClone(button), action: { type: "navigate", target: "login" } };
    screen.nodes.group = { ...structuredClone(screen.nodes.root), children: [{ node: "loginButton" }, { node: "other" }] } as FrameNode;
    (screen.nodes.root as FrameNode).children = [{ node: "group" }, { node: "title" }, { node: "forgotButton" }];
    expect(compileTickets(screen).some(t => t.instances.length === 2)).toBe(true);
    expect(compileProjectTickets(source).tickets.some(t => t.instances.length === 2)).toBe(false);
    (screen.nodes.other as ButtonNode).action = { target: "dashboard", type: "navigate" };
    expect(compileProjectTickets(source).tickets.some(t => t.instances.length === 2)).toBe(true);
  });

  it.each([
    ["duplicate global IDs", (p: ReturnType<typeof compileProjectTickets>) => { p.tickets[1].id = p.tickets[0].id; }],
    ["missing dependency", p => { p.tickets[0].dependsOn = ["missing"]; }],
    ["self dependency", p => { p.tickets[0].dependsOn = [p.tickets[0].id]; }],
    ["dependency cycle", p => { p.tickets[0].dependsOn = [p.tickets[1].id]; p.tickets[1].dependsOn = [p.tickets[0].id]; }],
    ["cross-page dependency", p => { p.tickets[0].dependsOn = [p.tickets.find(t => t.sourcePageId === "dashboard")!.id]; }],
    ["missing source", p => { p.tickets[0].sourcePageId = "missing"; }],
    ["foreign instance", p => { p.tickets[0].instances = ["logoutButton"]; }],
    ["omitted ticket", p => { p.tickets.pop(); }],
    ["wrong root instance", p => { p.tickets.find(t => t.kind === "page")!.instances = ["title"]; }],
    ["route points at component", p => { p.routes[0].ticketId = p.tickets[0].id; }],
    ["modal route", p => { p.routes.push({ pageId: "resetPassword", ticketId: p.tickets.find(t => t.kind === "page" && t.sourcePageId === "resetPassword")!.id }); }],
    ["wrong entry", p => { p.entryPageId = "dashboard"; }],
    ["duplicate artifact membership", p => { p.artifacts[1] = structuredClone(p.artifacts[0]); }],
    ["wrong artifact dependencies", p => { p.artifacts[0].dependsOn = []; }],
    ["omitted exclusion", p => { p.excludedPages = []; }],
    ["different project identity", p => { p.projectId = "other"; }],
  ] satisfies [string, (p: ReturnType<typeof compileProjectTickets>) => void][])("rejects shape-valid %s", (_, change) => {
    const source = project(); const plan = compileProjectTickets(source); change(plan);
    expect(validateProjectPlan(plan).valid).toBe(true);
    expect(validateProjectPlanContext(plan, source).valid).toBe(false);
  });

  it("allows execution status changes but rejects malformed and hostile input", () => {
    const source = project(); const plan = compileProjectTickets(source);
    plan.tickets[0].status = "failed"; plan.tickets[0].error = "retry";
    expect(validateProjectPlanContext(plan, source).valid).toBe(true);
    expect(validateProjectPlanContext({}, source).valid).toBe(false);
    expect(validateProjectPlanContext(new Proxy({}, { ownKeys() { throw Error("hostile"); } }), source).valid).toBe(false);
  });
});
