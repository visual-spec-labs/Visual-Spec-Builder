import { beforeEach, describe, expect, it } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import type { FrameNode, ProjectSpec } from "@/features/editor/schema";
import { buildDestinationCatalog, buildNlRequest, buildWidgetSourceCatalog, parseNlResponse } from "@/features/editor/nl/nlProtocol";
import { useEditorStore } from "@/features/editor/store/editorStore";
const project = () => structuredClone(fixture) as unknown as ProjectSpec;
const editor = () => useEditorStore.getState();
const input = (spec: ProjectSpec) => ({ id: "request", instruction: "connect", pageId: "login", page: spec.pages.login, scope: { kind: "screen" as const, nodeId: null, label: "screen" } });
const navigate = [{ type: "updateNode" as const, id: "loginButton", path: "action", value: { type: "navigate", target: "dashboard" } }];
beforeEach(() => editor().loadSpec(project()));

describe("NL read-only destination catalog", () => {
  it("preserves stable IDs and duplicate names, normalizes kind, copies metadata only", () => {
    const spec = project(); spec.pages.dashboard.name = spec.pages.login.name;
    const request = buildNlRequest({ ...input(spec), project: spec });
    expect(request.destinations).toEqual([
      { pageId: "login", name: spec.pages.login.name, kind: "page" },
      { pageId: "dashboard", name: spec.pages.login.name, kind: "page" },
      { pageId: "resetPassword", name: spec.pages.resetPassword.name, kind: "modal" },
      { pageId: "notificationWidget", name: spec.pages.notificationWidget.name, kind: "widget" },
    ]);
    expect(request).not.toHaveProperty("project");
    expect(request.destinations?.every((item) => Object.keys(item).sort().join() === "kind,name,pageId")).toBe(true);
    spec.pages.login.name = "Changed";
    expect(request.destinations?.[0].name).not.toBe("Changed");
    spec.pages.dashboard.kind = "widget";
    expect(buildDestinationCatalog(spec)[1].kind).toBe("widget");
  });
  it("keeps protocol-2 legacy request construction and legacy response shape compatible", () => {
    const spec = project(); const legacy = buildNlRequest(input(spec));
    const extended = buildNlRequest({ ...input(spec), project: spec });
    expect(legacy).not.toHaveProperty("destinations");
    const { destinations, ...oldFields } = extended;
    expect(destinations).toHaveLength(4); expect(oldFields).toEqual(legacy);
    // A protocol-2 producer using only old request fields still returns the unchanged wire format.
    const response = JSON.stringify({ protocol: legacy.protocol, commandVersion: legacy.commandVersion, requestId: legacy.id, commands: navigate });
    expect(parseNlResponse(response, extended.id)).toEqual({ kind: "commands", commands: navigate });
  });
  it("does not expand Command mutation addressing with a destination pageId", () => {
    expect(parseNlResponse(JSON.stringify({ protocol: 2, commandVersion: "0.2", requestId: "request", commands: [{ ...navigate[0], pageId: "dashboard" }] }), "request").kind).toBe("invalid");
    const before = editor().spec;
    expect(editor().applyGuardedTransaction("login", [{ type: "updateNode", id: "closeButton", path: "action", value: { type: "close" } }]).ok).toBe(false);
    expect(editor().spec).toBe(before);
  });
  it("applies whole actions to the active page only and Undo restores intent", () => {
    const before = editor().spec;
    const result = editor().applyGuardedTransaction("login", [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "openModal", target: "resetPassword" } }]);
    expect(result.ok).toBe(true);
    expect(editor().spec.pages.dashboard).toBe(before.pages.dashboard);
    expect(editor().spec.pages.resetPassword).toBe(before.pages.resetPassword);
    expect(editor().history.past).toHaveLength(1);
    editor().undo(); expect(editor().spec).toBe(before);
  });
  it.each(["deleted", "kind"])("old catalog does not bypass current-project G3 after target %s change", (change) => {
    const request = buildNlRequest({ ...input(editor().spec), project: editor().spec });
    if (change === "deleted") editor().removePage("dashboard");
    else { editor().removeNodeAction("loginButton"); editor().setPageField("dashboard", "kind", "widget"); }
    expect(request.destinations?.find((item) => item.pageId === "dashboard")?.kind).toBe("page");
    const before = editor();
    const result = editor().applyGuardedTransaction("login", navigate);
    expect(result.ok).toBe(false);
    expect(editor().spec).toBe(before.spec); expect(editor().history).toBe(before.history);
  });
  it("rejects invented targets and wrong source context through existing G3", () => {
    const before = editor();
    for (const value of [{ type: "navigate", target: "invented" }, { type: "close" }]) {
      expect(editor().applyGuardedTransaction("login", [{ type: "updateNode", id: "loginButton", path: "action", value }]).ok).toBe(false);
      expect(editor().spec).toBe(before.spec);
    }
  });
  it('includes only referenced widget sources as read-only context and preserves their snapshot', () => {
    const spec=project();
    spec.pages.login.nodes.shared={type:'instance',name:'Shared',box:{width:200,height:80},ref:'notificationWidget'};
    (spec.pages.login.nodes.root as FrameNode).children.push({node:'shared'});
    const request=buildNlRequest({...input(spec),project:spec});
    expect(request.widgets?.map(item=>item.pageId)).toEqual(['notificationWidget']);
    expect(request.widgets?.[0].screen.nodes.title).toEqual(spec.pages.notificationWidget.nodes.title);
    spec.pages.notificationWidget.nodes.title.name='Changed';
    expect(request.widgets?.[0].screen.nodes.title.name).not.toBe('Changed');
    expect(buildWidgetSourceCatalog(spec,spec.pages.dashboard)).toEqual([]);
    expect(request).not.toHaveProperty('project');
  });
  it('uses the current project G3 for NL instance overrides and rejects stale source IDs', () => {
    const spec=project();
    spec.pages.login.nodes.shared={type:'instance',name:'Shared',box:{width:200,height:80},ref:'notificationWidget'};
    (spec.pages.login.nodes.root as FrameNode).children.push({node:'shared'});
    editor().loadSpec(spec);
    const before=editor().spec;
    const command={type:'updateNode' as const,id:'shared',path:'overrides',value:{title:{content:'Custom',color:'#445566'}}};
    const response=JSON.stringify({protocol:2,commandVersion:'0.2',requestId:'request',commands:[command]});
    expect(parseNlResponse(response,'request').kind).toBe('commands');
    expect(editor().applyGuardedTransaction('login',[command]).ok).toBe(true);
    expect(editor().history.past).toHaveLength(1);
    editor().undo();expect(editor().spec).toBe(before);
    expect(editor().applyGuardedTransaction('login',[{...command,value:{missing:{content:'x'}}}]).ok).toBe(false);
    expect(editor().spec).toBe(before);
  });
});
