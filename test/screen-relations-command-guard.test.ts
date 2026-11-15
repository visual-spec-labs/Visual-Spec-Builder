import { beforeEach, describe, expect, it } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import { applyCommandWithReason, buildDuplicateCommands, applyTransaction } from "@/features/editor/command/applyCommand";
import { isEditableNodePath, isEditableScreenPath } from "@/features/editor/command/editablePath";
import { validateCommand, validateTransaction, type Command } from "@/features/editor/command";
import { runTransactionGates } from "@/features/editor/command/transactionGate";
import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";

const project = () => structuredClone(fixture) as unknown as ProjectSpec;
const editor = () => useEditorStore.getState();
beforeEach(() => editor().loadSpec(project()));

describe("화면 관계 Command v0.2 (#265 S1-3)", () => {
  it("kind와 button의 action 전체만 허용한다", () => {
    const page = project().pages.login;
    expect(isEditableScreenPath(page, "kind")).toBe(true);
    expect(isEditableNodePath(page.nodes.loginButton, "action")).toBe(true);
    for (const path of ["action.type", "action.target"]) expect(isEditableNodePath(page.nodes.loginButton, path)).toBe(false);
    expect(isEditableNodePath(page.nodes.root, "action")).toBe(false);
    expect(isEditableScreenPath(page, "nodes")).toBe(false);
  });

  it("createNode.action은 G1 형태 검사 뒤 기존 프로젝트 G3에서 대상을 확인한다", () => {
    const spec = project();
    const command: Command = { type: "createNode", id: "copy", parentId: "root", node: spec.pages.login.nodes.loginButton };
    expect(validateCommand(command).valid).toBe(true);
    expect(validateTransaction({ version: "0.3", commands: [command] }).valid).toBe(true);
    expect(runTransactionGates(spec, "login", [command]).ok).toBe(true);
    const invalid: Command = { ...command, node: { ...command.node, action: { type: "navigate", target: "missing" } } as typeof command.node };
    expect(runTransactionGates(spec, "login", [invalid])).toMatchObject({ ok: false, failure: { kind: "invalid", issues: [{ code: "action-target-missing" }] } });
  });

  it("action은 합치지 않고 전체 교체하여 close에 target이 남지 않는다", () => {
    const page = project().pages.resetPassword;
    const next = applyTransaction(page, [
      { type: "updateNode", id: "closeButton", path: "action", value: { type: "navigate", target: "login" } },
      { type: "updateNode", id: "closeButton", path: "action", value: { type: "close" } },
    ]);
    expect(next.nodes.closeButton).toMatchObject({ action: { type: "close" } });
    expect(next.nodes.closeButton).not.toHaveProperty("action.target");
  });

  it.each([null, undefined, {}, { type: "navigate" }, { type: "close", target: "login" }])("무효 action %j는 원본과 history를 유지한다", (value) => {
    const state = editor();
    editor().setNodeField("loginButton", "action", value);
    expect(editor().spec).toBe(state.spec);
    expect(editor().history).toBe(state.history);
  });

  it("전용 제거는 속성 자체를 지우고 Undo/Redo 한 번이다", () => {
    const before = editor().spec;
    editor().removeNodeAction("loginButton");
    expect(editor().spec.pages.login.nodes.loginButton).not.toHaveProperty("action");
    expect(editor().history.past).toHaveLength(1);
    editor().undo(); expect(editor().spec).toBe(before);
    editor().redo(); expect(editor().spec.pages.login.nodes.loginButton).not.toHaveProperty("action");
  });

  it.each(["root", "missing", "title"])("제거 불가 대상 %s는 G2에서 전체 요청을 거부한다", (id) => {
    const commands: Command[] = [{ type: "updateScreen", path: "name", value: "changed" }, { type: "removeNodeAction", id }];
    const state = editor();
    expect(editor().applyGuardedTransaction("login", commands)).toMatchObject({ ok: false, failure: { kind: "noOp" } });
    expect(editor().spec).toBe(state.spec); expect(editor().history).toBe(state.history);
  });

  it("action 없는 button 제거도 no-op이며 GUI history가 늘지 않는다", () => {
    editor().removeNodeAction("loginButton"); const state = editor();
    editor().removeNodeAction("loginButton");
    expect(editor().history).toBe(state.history);
    expect(applyCommandWithReason(state.spec.pages.login, { type: "removeNodeAction", id: "loginButton" }).reason).toBeDefined();
  });

  it("GUI 관계 배치의 뒤 명령이 무효이면 앞 명령도 적용하지 않는다", () => {
    const state = editor();
    editor().setNodeFields([{ id: "title", path: "content", value: "changed" }, { id: "loginButton", path: "action.target", value: "login" }]);
    expect(editor().spec).toBe(state.spec); expect(editor().history).toBe(state.history);
  });

  it.each(["dashboard", "login", "resetPassword"])("kind 변경이 프로젝트 참조/첫 page를 깨면 %s 변경을 거부한다", (id) => {
    const state = editor();
    editor().setPageField(id, "kind", id === "resetPassword" ? "page" : "modal");
    expect(editor().spec).toBe(state.spec); expect(editor().history).toBe(state.history);
  });

  it("GUI/NL action 변경 성공은 한 번의 Undo로 복원된다", () => {
    const before = editor().spec;
    expect(editor().applyGuardedTransaction("login", [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "openModal", target: "resetPassword" } }]).ok).toBe(true);
    expect(validateProjectSpec(editor().spec).valid).toBe(true);
    editor().undo(); expect(editor().spec).toBe(before);
    editor().redo(); expect(editor().spec.pages.login.nodes.loginButton).toMatchObject({ action: { type: "openModal", target: "resetPassword" } });
  });

  it("노드 복제는 action을 보존한다", () => {
    const login = project().pages.login;
    const duplicate = buildDuplicateCommands(login.nodes, "loginButton", login.nodes, "root", 1)!;
    const next = applyTransaction(login, duplicate.commands);
    expect(next.nodes[duplicate.newRootId]).toMatchObject({ action: { type: "navigate", target: "dashboard" } });
  });
});
