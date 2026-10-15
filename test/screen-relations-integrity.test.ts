import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { canRemovePage, incomingActions } from "@/features/editor/store/pageRemoval";
import { confirmPageRemoval } from "@/features/editor/ui/confirmPageRemoval";
import { copySelection, pasteClipboard } from "@/features/editor/ui/clipboard";
import { buildExportPayload } from "@/features/editor/store/exportSpec";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { parseStoredDocument, serializeStoredDocument } from "@/features/editor/store/specStorage";
const project = () => structuredClone(fixture) as unknown as ProjectSpec;
const editor = () => useEditorStore.getState();
beforeEach(() => { editor().loadSpec(project()); vi.stubGlobal("window", { alert: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("프로젝트 참조 원자성 (#265 S1-4)", () => {
  it("여러 페이지의 유입을 삭제와 한 snapshot으로 정리하고 Undo/Redo한다", () => {
    const spec = project();
    const close = spec.pages.resetPassword.nodes.closeButton;
    if (close.type !== "button") throw Error("button");
    close.action = { type: "navigate", target: "dashboard" };
    editor().loadSpec(spec);
    const before = editor().spec;
    expect(incomingActions(before, "dashboard")).toHaveLength(2);
    const observed: ProjectSpec[] = [];
    const stop = useEditorStore.subscribe((state, previous) => { if (state.spec !== previous.spec) observed.push(state.spec); });
    editor().removePage("dashboard"); stop();
    expect(observed).toHaveLength(1);
    expect(validateProjectSpec(observed[0]).valid).toBe(true);
    expect(observed[0].pages.login.nodes.loginButton).not.toHaveProperty("action");
    expect(observed[0].pages.resetPassword.nodes.closeButton).not.toHaveProperty("action");
    expect(observed[0].pages.login.nodes.forgotButton).toBe(before.pages.login.nodes.forgotButton);
    expect(before.pages.login.nodes.loginButton).toHaveProperty("action");
    expect(editor().history.past).toHaveLength(1);
    editor().undo(); expect(editor().spec).toBe(before);
    editor().redo(); expect(editor().spec).toBe(observed[0]);
  });
  it("첫 page 삭제는 남은 첫 page만 앞으로 옮기고 마지막 실제 page 삭제는 막는다", () => {
    const spec = project(); spec.pageOrder = ["login", "resetPassword", "dashboard", "noticeWidget"];
    // Fixture widget id may differ; add one explicitly for this ordering assertion.
    spec.pages.noticeWidget = { ...structuredClone(spec.pages.dashboard), kind: "widget" };
    for (const node of Object.values(spec.pages.noticeWidget.nodes)) if (node.type === "button") delete node.action;
    // Preserve any other fixture pages in their original relative order.
    for (const id of Object.keys(spec.pages)) if (!spec.pageOrder.includes(id)) spec.pageOrder.push(id);
    editor().loadSpec(spec);
    editor().removePage("login");
    expect(editor().spec.pageOrder.slice(0, 3)).toEqual(["dashboard", "resetPassword", "noticeWidget"]);
    expect(validateProjectSpec(editor().spec).valid).toBe(true);
    expect(canRemovePage(editor().spec, "dashboard")).toBe(false);
    const before = editor(); editor().removePage("dashboard");
    expect(editor().spec).toBe(before.spec); expect(editor().history).toBe(before.history);
  });
  it("유효한 삭제 뒤 Save/Open과 자동 저장 복원은 관계를 유지한다", () => {
    editor().removePage("dashboard"); const spec = editor().spec;
    expect(buildExportPayload(spec).ok).toBe(true);
    expect(parseSpecJson(JSON.stringify(spec))).toMatchObject({ ok: true });
    expect(parseStoredDocument(serializeStoredDocument({ fileName: "flow.json", spec }))?.spec).toEqual(spec);
  });
  it("외부 교체가 참조를 깨면 현재 작업과 history를 보존한다", () => {
    const next = project(); delete next.pages.dashboard;
    next.pageOrder = next.pageOrder.filter((id) => id !== "dashboard") as ProjectSpec["pageOrder"];
    const before = editor(); editor().replaceSpecFromOutside(next);
    expect(editor().spec).toBe(before.spec); expect(editor().history).toBe(before.history);
  });
});

describe("삭제 확인은 검토한 문서/영향에만 적용", () => {
  it("취소는 목록을 보여 주고 spec/선택/history를 바꾸지 않는다", async () => {
    editor().select("loginButton"); const before = editor();
    const confirm = vi.fn(() => false);
    expect(await confirmPageRemoval("dashboard", confirm, vi.fn())).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("LoginButton (loginButton)"));
    expect(editor()).toBe(before);
  });
  it.each(["document", "reopen", "incoming", "same-count", "target", "order", "undo"])("확인 중 %s 변경이면 현재 상태를 보존하며 거부한다", async (change) => {
    let answer!: (value: boolean) => void;
    const pending = confirmPageRemoval("dashboard", () => new Promise<boolean>((resolve) => { answer = resolve; }), vi.fn());
    if (change === "document" || change === "reopen") {
      const next = structuredClone(editor().spec);
      if (change === "document") next.projectId = "00000000-0000-4000-8000-000000000001";
      editor().loadSpec(next);
    } else if (change === "incoming") {
      editor().selectPage("resetPassword"); editor().setNodeField("closeButton", "action", { type: "navigate", target: "dashboard" });
    } else if (change === "same-count") {
      editor().removeNodeAction("loginButton"); editor().setNodeField("forgotButton", "action", { type: "navigate", target: "dashboard" });
    } else if (change === "target") {
      editor().setPageField("dashboard", "name", "New target");
    } else if (change === "order") {
      const next = structuredClone(editor().spec);
      next.pageOrder = ["login", ...next.pageOrder.slice(1).reverse()];
      editor().replaceSpecFromOutside(next);
    } else { editor().setPageField("login", "name", "Changed"); editor().undo(); }
    const current = editor(); answer(true);
    expect(await pending).toBe(false);
    expect(editor()).toBe(current);
    expect(editor().spec.pages.dashboard).toBeDefined();
  });
  it("선택만 변경되면 검토한 동일 후보를 한 번 삭제할 수 있다", async () => {
    let answer!: (value: boolean) => void;
    const pending = confirmPageRemoval("dashboard", () => new Promise<boolean>((resolve) => { answer = resolve; }), vi.fn());
    editor().select("loginButton"); answer(true);
    expect(await pending).toBe(true); expect(editor().history.past).toHaveLength(1);
    expect(editor().spec.pages.dashboard).toBeUndefined();
  });
});

describe("클립보드 신원과 관계 보존", () => {
  it("같은 프로젝트의 다른 페이지는 target을 유지하고 다른 프로젝트의 같은 PageId는 거부한다", () => {
    const state = editor(); copySelection(state.spec.pages.login.nodes, "loginButton");
    editor().selectPage("dashboard"); pasteClipboard();
    expect(editor().history.past).toHaveLength(1);
    expect(validateProjectSpec(editor().spec).valid).toBe(true);
    const copied = editor().spec.pages.dashboard.nodes[editor().selectedId!];
    expect(copied).toMatchObject({ action: { type: "navigate", target: "dashboard" } });
    editor().loadSpec(project()); const other = editor(); pasteClipboard();
    expect(editor().spec).toBe(other.spec); expect(editor().history).toBe(other.history);
    expect(window.alert).toHaveBeenCalled();
  });
  it("복사 후 대상 삭제는 clipboard를 변조하지 않고 붙여넣기 전체를 거부한다", () => {
    copySelection(editor().spec.pages.login.nodes, "loginButton");
    editor().removePage("dashboard"); const before = editor(); pasteClipboard();
    expect(editor().spec).toBe(before.spec); expect(editor().history).toBe(before.history);
    editor().undo(); pasteClipboard();
    expect(editor().spec.pages.login.nodes[editor().selectedId!]).toMatchObject({ action: { target: "dashboard" } });
  });
  it("close의 새 source 문맥과 출처 없는 action은 거부하고 관계 없는 트리는 허용한다", () => {
    copySelection(editor().spec.pages.resetPassword.nodes, "closeButton"); const before = editor(); pasteClipboard();
    expect(editor().spec).toBe(before.spec);
    editor().pasteNode({ rootId: "x", nodes: { x: before.spec.pages.login.nodes.loginButton } }, "root");
    expect(editor().spec).toBe(before.spec);
    copySelection(before.spec.pages.login.nodes, "title"); editor().loadSpec(project()); pasteClipboard();
    expect(editor().history.past).toHaveLength(1);
  });
  it("복제·Group/Ungroup은 button action을 유지한다", () => {
    editor().duplicateNode("loginButton");
    expect(editor().spec.pages.login.nodes[editor().selectedId!]).toMatchObject({ action: { target: "dashboard" } });
    editor().groupNode("loginButton"); const wrapper = editor().selectedId!;
    editor().ungroupNode(wrapper);
    expect(editor().spec.pages.login.nodes.loginButton).toMatchObject({ action: { target: "dashboard" } });
    expect(validateProjectSpec(editor().spec).valid).toBe(true);
  });
});
