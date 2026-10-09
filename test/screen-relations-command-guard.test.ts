import { describe, expect, it } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import { applyCommandWithReason, buildDuplicateCommands, applyTransaction } from "@/features/editor/command/applyCommand";
import { isEditableNodePath, isEditableScreenPath } from "@/features/editor/command/editablePath";
import { validateCommand, validateTransaction, type Command } from "@/features/editor/command";
import { validateVisualSpec, type ButtonNode, type ProjectSpec, type ScreenSpec } from "@/features/editor/schema";

// #265 S1-1 임시 가드의 계약이다. S1-3이 kind·action Command 경로를 열 때 이 파일의 기대를 바꾼다.
function page(id: keyof typeof fixture.pages): ScreenSpec {
  return structuredClone((fixture as unknown as ProjectSpec).pages[id]);
}
const PLAIN_BUTTON: ButtonNode = {
  type: "button", name: "Plain", box: { width: "auto", height: 40 }, content: "확인",
  typography: { fontFamily: "Inter", fontSize: 14, fontWeight: 600, lineHeight: 1.5, letterSpacing: 0, textAlign: "left" },
  color: "#FFFFFF",
};

describe("화면 관계 필드 Command 임시 가드 (#265 S1-1, S1-3에서 제거)", () => {
  it("updateScreen은 kind를 쓰지 못하고 기존 화면 경로는 그대로 쓴다", () => {
    const modal = page("resetPassword");
    expect(isEditableScreenPath(modal, "kind")).toBe(false);
    expect(isEditableScreenPath(page("login"), "kind")).toBe(false);
    expect(isEditableScreenPath(modal, "name")).toBe(true);
    expect(isEditableScreenPath(modal, "size.width")).toBe(true);
    expect(isEditableScreenPath(modal, "responsive")).toBe(true);
    expect(isEditableScreenPath(modal, "nodes")).toBe(false);
  });

  it.each(["action", "action.type", "action.target"])("updateNode는 button의 %s 경로를 쓰지 못한다", (path) => {
    const login = page("login");
    expect(isEditableNodePath(login.nodes.loginButton, path)).toBe(false);
    expect(isEditableNodePath(PLAIN_BUTTON, path)).toBe(false);
  });

  it("button의 기존 경로는 회귀하지 않는다", () => {
    const button = page("login").nodes.loginButton;
    for (const path of ["content", "color", "visible", "box.width", "typography.fontSize", "background", "border", "border.width"]) {
      expect(isEditableNodePath(button, path)).toBe(true);
    }
    expect(isEditableNodePath(PLAIN_BUTTON, "border.width")).toBe(false);
  });

  it("applyCommand는 kind·action 쓰기를 no-op으로 돌려준다", () => {
    const login = page("login");
    const commands: Command[] = [
      { type: "updateScreen", path: "kind", value: "modal" },
      { type: "updateNode", id: "loginButton", path: "action", value: { type: "close" } },
      { type: "updateNode", id: "loginButton", path: "action.target", value: "resetPassword" },
    ];
    for (const command of commands) {
      const result = applyCommandWithReason(login, command);
      expect(result.screen).toBe(login);
      expect(result.reason).toBeDefined();
    }
  });

  it("G1은 action이 붙은 createNode를 거부하고 action 없는 createNode는 그대로 받는다", () => {
    const withAction = { type: "createNode", parentId: "root", id: "go", node: { ...PLAIN_BUTTON, action: { type: "navigate", target: "dashboard" } } };
    const plain = { type: "createNode", parentId: "root", id: "plain", node: PLAIN_BUTTON };

    expect(validateCommand(plain)).toEqual({ valid: true, issues: [] });
    expect(validateCommand(withAction)).toMatchObject({ valid: false, issues: [{ code: "schema", path: "/node/action" }] });

    expect(validateTransaction({ commands: [plain] })).toEqual({ valid: true, issues: [] });
    expect(validateTransaction({ commands: [plain, withAction] })).toMatchObject({
      valid: false, issues: [{ code: "schema", path: "/commands/1/node/action" }],
    });
  });

  it("앱 안의 복제는 G1을 거치지 않아 불러온 문서의 action을 보존한다", () => {
    const login = page("login");
    const duplicate = buildDuplicateCommands(login.nodes, "loginButton", login.nodes, "root", 1);
    expect(duplicate).not.toBeNull();
    if (duplicate === null) return;
    const next = applyTransaction(login, duplicate.commands);
    expect(next.nodes[duplicate.newRootId]).toMatchObject({ action: { type: "navigate", target: "dashboard" } });
    expect(validateVisualSpec({ version: "0.3", screen: next }).valid).toBe(true);
  });
});
