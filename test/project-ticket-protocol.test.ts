import { describe, expect, it } from "vitest";
import type { ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket";
import { buildProjectInputSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
import { buildProjectTicketRequest, parseProjectTicketResponse, validateProjectTicketRequest, PROJECT_TICKET_PROTOCOL_VERSION } from "@/features/editor/ticket/projectTicketProtocol";
import { TICKET_PROTOCOL_VERSION, parseTicketResponse } from "@/features/editor/ticket/ticketProtocol";
import fixture from "./fixtures/screen-relations-project.json";

function setup() {
  const project = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: "project" };
  const plan = compileProjectTickets(project);
  const snapshot = buildProjectInputSnapshot("wave_1", project, plan, []);
  const args = { requestId: "wave_1", projectRoot: "my-project", snapshotContent: snapshot.content,
    snapshotSha256: snapshot.sha256, ticketIds: plan.tickets.filter(ticket => ticket.dependsOn.length === 0).map(ticket => ticket.id) };
  const request = buildProjectTicketRequest(args);
  return { project, plan, snapshot, args, request };
}
function response() {
  const setupValue = setup();
  return { ...setupValue, body: { protocol: 4, requestId: setupValue.request.id,
    results: setupValue.request.tickets.map(ticket => ({ ticketId: ticket.id, status: "done" as "done" | "failed", message: "" })) } };
}

describe("additive project protocol 4", () => {
  it("keeps v3 separate and builds source-aware paths from verified snapshot bytes", () => {
    const { request, snapshot } = setup();
    expect(TICKET_PROTOCOL_VERSION).toBe(3); expect(PROJECT_TICKET_PROTOCOL_VERSION).toBe(4);
    expect(validateProjectTicketRequest(request, snapshot.content, "my-project").valid).toBe(true);
    expect(request.inputSnapshotPath).toBe("runtime/project-input-wave_1.json");
    expect(request.assets).toEqual([]);
    for (const ticket of request.tickets) {
      expect(ticket.filePath).toBe(`my-project/${ticket.sourcePageId}/${ticket.kind === "page" ? "pages" : "components"}/${ticket.componentName}.tsx`);
      expect(ticket.outputPath).toBe(`staging/wave_1/${ticket.filePath}`);
    }
    expect(request.tickets.some(ticket => ticket.id.startsWith("project:"))).toBe(false);
    const { body } = response();
    expect(parseTicketResponse(JSON.stringify(body), request.id).kind).toBe("malformed");
    expect(parseProjectTicketResponse(JSON.stringify({ ...body, protocol: 3 }), request)).toMatchObject({ kind: "malformed", code: "version-mismatch" });
    expect(validateProjectTicketRequest({ ...request, protocol: 3 }, snapshot.content, "my-project")).toMatchObject({ valid: false, code: "version-mismatch" });
  });

  it.each(["../escape", "a/b", "a\\b", "CON", "nul.txt", "trailing.", "trailing ", "trailing\u00a0", "bad\u007fname", ""])("rejects unsafe project root %j", projectRoot => {
    const { args } = setup(); expect(() => buildProjectTicketRequest({ ...args, projectRoot })).toThrow();
  });

  it("rejects empty/duplicate/unplanned/GUI waves and unmet dependencies", () => {
    const { args, plan } = setup();
    for (const ticketIds of [[], [args.ticketIds[0], args.ticketIds[0]], ["missing"], ["project:host"], [plan.tickets.find(t => t.dependsOn.length > 0)!.id]]) {
      expect(() => buildProjectTicketRequest({ ...args, ticketIds })).toThrow();
    }
  });

  it("accepts a dependent wave only after its snapshot records done dependencies", () => {
    const { args, plan, project } = setup();
    for (const ticket of plan.tickets) ticket.status = "done";
    const snapshot = buildProjectInputSnapshot("next", project, plan, []);
    const ticket = plan.tickets.find(t => t.dependsOn.length > 0)!;
    expect(buildProjectTicketRequest({ ...args, requestId: "next", snapshotContent: snapshot.content, snapshotSha256: snapshot.sha256, ticketIds: [ticket.id] }).tickets).toHaveLength(1);
  });

  it("rejects case-only page directories even with different component filenames", () => {
    const { project, args } = setup();
    project.pages.Login = structuredClone(project.pages.login); project.pages.Login.name = "OtherName";
    for (const node of Object.values(project.pages.Login.nodes)) node.name += "Other";
    project.pageOrder.push("Login");
    const plan = compileProjectTickets(project);
    const snapshot = buildProjectInputSnapshot(args.requestId, project, plan, []);
    expect(() => buildProjectTicketRequest({ ...args, snapshotContent: snapshot.content, snapshotSha256: snapshot.sha256 })).toThrow(/PageId/);
  });

  it.each([
    ["extra", (v: ReturnType<typeof buildProjectTicketRequest> & Record<string, unknown>) => { v.extra = true; }],
    ["undefined extra", v => { v.extra = undefined; }],
    ["legacy page", v => { v.page = v.project.pages.login; }],
    ["source", v => { v.tickets[0].sourcePageId = "dashboard"; }],
    ["file path", v => { v.tickets[0].filePath = "../elsewhere.tsx"; }],
    ["output path", v => { v.tickets[0].outputPath = "generated/direct.tsx"; }],
    ["snapshot path", v => { v.inputSnapshotPath = "runtime/other.json"; }],
    ["response path", v => { v.responsePath = "runtime/other.json"; }],
    ["project mismatch", v => { v.project.name = "changed"; }],
    ["plan mismatch", v => { v.plan.entryPageId = "dashboard"; }],
    ["null assets", v => { (v as Record<string, unknown>).assets = null; }],
  ] satisfies [string, (v: ReturnType<typeof buildProjectTicketRequest> & Record<string, unknown>) => void][])("rejects request %s", (_, change) => {
    const { request, snapshot } = setup(); change(request as typeof request & Record<string, unknown>);
    expect(validateProjectTicketRequest(request, snapshot.content, "my-project").valid).toBe(false);
  });

  it("requires the expected project owner root and matching immutable bytes", () => {
    const { request, snapshot } = setup();
    expect(validateProjectTicketRequest(request, snapshot.content, "other-owner")).toMatchObject({ valid: false, code: "invalid-output-path" });
    expect(validateProjectTicketRequest(request, snapshot.content + " ", "my-project")).toMatchObject({ valid: false, code: "stale-input" });
  });

  it("ignores stale IDs before version checks and requires exact successful/failed result membership", () => {
    const { request, body } = response();
    expect(parseProjectTicketResponse(JSON.stringify({ protocol: 3, requestId: "old" }), request)).toEqual({ kind: "stale" });
    body.results[0].status = "failed"; body.results[0].message = "generation failed";
    expect(parseProjectTicketResponse(JSON.stringify(body), request)).toMatchObject({ kind: "results", results: body.results });
    const duplicate = { ...body, results: [body.results[0], ...body.results] };
    expect(parseProjectTicketResponse(JSON.stringify(duplicate), request)).toMatchObject({ kind: "malformed", code: "duplicate-ticket" });
    expect(parseProjectTicketResponse(JSON.stringify({ ...body, results: body.results.slice(1) }), request)).toMatchObject({ kind: "malformed", code: "missing-ticket" });
    body.results[0].ticketId = "project:entry";
    expect(parseProjectTicketResponse(JSON.stringify(body), request)).toMatchObject({ kind: "malformed", code: "unexpected-ticket" });
  });

  it.each([{ status: "failed" }, { status: "failed", message: " " }, { status: "done", message: null }, { status: ["done"] }, { status: "done", extra: 1 }])("rejects malformed result %j", patch => {
    const { request, body } = response(); Object.assign(body.results[0], patch);
    expect(parseProjectTicketResponse(JSON.stringify(body), request).kind).toBe("malformed");
  });
});

describe('project protocol review regressions', () => {
  it.each(['CON', 'NUL', 'COM1'])('rejects staging directory device name %s', requestId => {
    const { project, plan, args } = setup();
    const snapshot = buildProjectInputSnapshot(requestId, project, plan, []);
    expect(() => buildProjectTicketRequest({ ...args, requestId, snapshotContent: snapshot.content, snapshotSha256: snapshot.sha256 })).toThrow();
  });
  it('directs a newer responder to update the GUI', () => {
    const { request, body } = response();
    expect(parseProjectTicketResponse(JSON.stringify({ ...body, protocol: 5 }), request)).toMatchObject({ kind: 'malformed', code: 'version-mismatch', message: expect.stringMatching(/GUI.*업데이트/) });
  });
  it('rejects a complete request exceeding PUT size even when its snapshot fits', () => {
    const { project, plan, args } = setup();
    plan.tickets[0].status = 'failed'; plan.tickets[0].error = '';
    const initial = buildProjectInputSnapshot(args.requestId, project, plan, []);
    plan.tickets[0].error = 'x'.repeat(32 * 1024 * 1024 - new TextEncoder().encode(initial.content).length - 16);
    const snapshot = buildProjectInputSnapshot(args.requestId, project, plan, []);
    expect(new TextEncoder().encode(snapshot.content).length).toBeLessThan(32 * 1024 * 1024);
    expect(() => buildProjectTicketRequest({ ...args, snapshotContent: snapshot.content, snapshotSha256: snapshot.sha256 })).toThrow(/32 MiB/);
  }, 30_000);
});
