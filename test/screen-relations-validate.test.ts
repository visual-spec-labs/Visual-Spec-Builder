import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import fixture from "./fixtures/screen-relations-project.json";
import {
  isScreenRelationIssue,
  toVisualSpec,
  validateProjectSpec,
  validateVisualSpec,
  type Action,
  type ProjectSpec,
  type ScreenSpec,
} from "@/features/editor/schema";

/**
 * 화면 관계 참조 무결성(#265 S1-2, docs/24 §5). 프로젝트 문서에서만 검사하고,
 * 형태 오류는 S1-1처럼 `schema`로 남는다(test/screen-relations-schema.test.ts).
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function project(): ProjectSpec {
  return structuredClone(fixture) as unknown as ProjectSpec;
}
/** 지정한 버튼의 action을 바꾼다. undefined면 지운다. */
function setAction(spec: ProjectSpec, pageId: string, nodeId: string, action: Action | undefined): void {
  const node = spec.pages[pageId].nodes[nodeId];
  if (node.type !== "button") throw new Error(`${pageId}/${nodeId}는 button이 아니다`);
  if (action === undefined) delete node.action;
  else node.action = action;
}
/** fixture의 modal을 복제해 두 번째 modal을 만든다(modal → modal openModal 확인용). */
function withSecondModal(spec: ProjectSpec): ProjectSpec {
  const second = structuredClone(spec.pages.resetPassword) as ScreenSpec;
  second.name = "TermsModal";
  return { ...spec, pages: { ...spec.pages, terms: second }, pageOrder: [...spec.pageOrder, "terms"] as ProjectSpec["pageOrder"] };
}
function issuesOf(spec: ProjectSpec) {
  return validateProjectSpec(spec).issues.map(({ code, path }) => ({ code, path }));
}

const LOGIN_TARGET = "/pages/login/nodes/loginButton/action/target";

describe("화면 관계 참조 무결성 — 정상 (#265 S1-2)", () => {
  it("fixture의 navigate·openModal·close·widget이 모두 통과한다", () => {
    expect(validateProjectSpec(project())).toEqual({ valid: true, issues: [] });
  });

  it("kind를 생략한 화면을 page로 보고 navigate 대상으로 받는다", () => {
    const spec = project();
    expect(spec.pages.login.kind).toBeUndefined();
    // dashboard → login(kind 생략)으로 이동한다.
    expect(spec.pages.dashboard.nodes.logoutButton).toMatchObject({ action: { type: "navigate", target: "login" } });
    delete spec.pages.dashboard.kind;
    expect(validateProjectSpec(spec).valid).toBe(true);
  });

  it("자기 자신을 가리키는 navigate(page)와 openModal(modal)을 허용한다", () => {
    const spec = project();
    setAction(spec, "login", "loginButton", { type: "navigate", target: "login" });
    setAction(spec, "resetPassword", "closeButton", { type: "openModal", target: "resetPassword" });
    expect(validateProjectSpec(spec)).toEqual({ valid: true, issues: [] });
  });

  it("modal이 다른 modal을 여는 교체와 modal에서 page로 가는 navigate를 허용한다", () => {
    const spec = withSecondModal(project());
    setAction(spec, "resetPassword", "closeButton", { type: "openModal", target: "terms" });
    setAction(spec, "terms", "closeButton", { type: "navigate", target: "dashboard" });
    expect(validateProjectSpec(spec)).toEqual({ valid: true, issues: [] });
  });

  it("modal과 widget의 버튼에 있는 close를 허용한다", () => {
    const spec = project();
    const widget = spec.pages.notificationWidget;
    const closeButton = structuredClone(spec.pages.resetPassword.nodes.closeButton);
    if (closeButton.type !== "button") throw new Error("closeButton은 button이다");
    widget.nodes.dismiss = { ...closeButton, action: { type: "close" } };
    const root = widget.nodes.root;
    if (root.type !== "frame") throw new Error("widget root는 frame이다");
    root.children.push({ node: "dismiss" });
    expect(validateProjectSpec(spec)).toEqual({ valid: true, issues: [] });
  });

  it("관계를 쓰지 않는 프로젝트는 그대로 통과한다(기존 0.3 문서)", () => {
    const spec = project();
    for (const [pageId, page] of Object.entries(spec.pages)) {
      delete page.kind;
      for (const [nodeId, node] of Object.entries(page.nodes)) {
        if (node.type === "button") setAction(spec, pageId, nodeId, undefined);
      }
    }
    expect(validateProjectSpec(spec)).toEqual({ valid: true, issues: [] });
  });
});

describe("화면 관계 참조 무결성 — 위반 (#265 S1-2)", () => {
  it.each(["navigate", "openModal"] as const)("%s 대상이 pages에 없으면 action-target-missing", (type) => {
    const spec = project();
    setAction(spec, "login", "loginButton", { type, target: "nowhere" });
    expect(issuesOf(spec)).toEqual([{ code: "action-target-missing", path: LOGIN_TARGET }]);
  });

  it.each([
    ["kind 생략 page", "login"],
    ["명시 page", "dashboard"],
    ["widget", "notificationWidget"],
  ])("openModal 대상이 %s이면 action-target-kind", (_label, target) => {
    const spec = project();
    setAction(spec, "login", "loginButton", { type: "openModal", target });
    expect(issuesOf(spec)).toEqual([{ code: "action-target-kind", path: LOGIN_TARGET }]);
  });

  it.each([
    ["modal", "resetPassword"],
    ["widget", "notificationWidget"],
  ])("navigate 대상이 %s이면 navigate-to-non-page", (_label, target) => {
    const spec = project();
    setAction(spec, "login", "loginButton", { type: "navigate", target });
    expect(issuesOf(spec)).toEqual([{ code: "navigate-to-non-page", path: LOGIN_TARGET }]);
  });

  it.each([
    ["kind 생략", "login", "loginButton"],
    ["명시 page", "dashboard", "logoutButton"],
  ])("%s page의 버튼에 있는 close는 action-source-invalid", (_label, pageId, nodeId) => {
    const spec = project();
    setAction(spec, pageId, nodeId, { type: "close" });
    expect(issuesOf(spec)).toEqual([{ code: "action-source-invalid", path: `/pages/${pageId}/nodes/${nodeId}/action` }]);
  });

  it.each([
    ["modal", "resetPassword"],
    ["widget", "notificationWidget"],
  ])("첫 화면이 %s이면 /pageOrder/0의 first-page-kind", (_label, first) => {
    const spec = project();
    spec.pageOrder = [first, ...spec.pageOrder.filter((id) => id !== first)] as ProjectSpec["pageOrder"];
    expect(issuesOf(spec)).toEqual([{ code: "first-page-kind", path: "/pageOrder/0" }]);
  });

  it("첫 화면이 page이면 순서 뒤쪽의 modal·widget은 문제없다", () => {
    const spec = project();
    spec.pageOrder = ["dashboard", "notificationWidget", "resetPassword", "login"];
    expect(validateProjectSpec(spec).valid).toBe(true);
  });

  it("pageOrder[0]이 pages에 없으면 page-order-mismatch만 보고하고 first-page-kind를 겹쳐 내지 않는다", () => {
    const spec = project();
    spec.pageOrder = ["ghost", "resetPassword", "login", "dashboard", "notificationWidget"];
    expect(issuesOf(spec)).toEqual([{ code: "page-order-mismatch", path: "/pageOrder/0" }]);
  });

  it("숨김 버튼과 반응형 화면의 action도 기본값 기준으로 한 번만 검사한다", () => {
    const spec = project();
    setAction(spec, "login", "loginButton", { type: "navigate", target: "nowhere" });
    const button = spec.pages.login.nodes.loginButton;
    if (button.type !== "button") throw new Error("button이어야 한다");
    button.visible = false;
    spec.pages.login.responsive = {
      breakpoints: { tablet: { minWidthPx: 768 }, desktop: { minWidthPx: 1200 } },
      overrides: { tablet: { loginButton: { visible: true } }, desktop: { loginButton: { color: "#000000" } } },
    };
    expect(issuesOf(spec)).toEqual([{ code: "action-target-missing", path: LOGIN_TARGET }]);
  });

  it("여러 위반을 한 번에 모두 보고한다", () => {
    const spec = project();
    spec.pageOrder = ["resetPassword", "login", "dashboard", "notificationWidget"];
    setAction(spec, "login", "loginButton", { type: "navigate", target: "resetPassword" });
    setAction(spec, "login", "forgotButton", { type: "openModal", target: "gone" });
    setAction(spec, "dashboard", "logoutButton", { type: "close" });
    expect(issuesOf(spec)).toEqual([
      { code: "first-page-kind", path: "/pageOrder/0" },
      { code: "navigate-to-non-page", path: LOGIN_TARGET },
      { code: "action-target-missing", path: "/pages/login/nodes/forgotButton/action/target" },
      { code: "action-source-invalid", path: "/pages/dashboard/nodes/logoutButton/action" },
    ]);
  });

  it("형태 오류는 스키마 단계에서 끝나 관계 코드를 섞지 않는다", () => {
    const spec = project() as unknown as { pages: Record<string, { nodes: Record<string, Record<string, unknown>> }> };
    spec.pages.login.nodes.loginButton.action = { type: "navigate" };
    spec.pages.login.nodes.forgotButton.action = { type: "openModal", target: "gone" };
    const result = validateProjectSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.every((issue) => issue.code === "schema")).toBe(true);
  });
});

describe("화면 관계 검사의 경계 (#265 S1-2)", () => {
  it("화면 문서(VisualSpec)는 외부 PageId를 검사하지 않는다", () => {
    const spec = project();
    setAction(spec, "login", "loginButton", { type: "navigate", target: "nowhere" });
    setAction(spec, "login", "forgotButton", { type: "close" });
    expect(validateVisualSpec(toVisualSpec(spec.pages.login))).toEqual({ valid: true, issues: [] });
    expect(validateVisualSpec(toVisualSpec(spec.pages.resetPassword))).toEqual({ valid: true, issues: [] });
  });

  it("isScreenRelationIssue는 새 관계 코드 다섯 개만 참으로 본다", () => {
    const codes = ["action-target-missing", "action-target-kind", "navigate-to-non-page", "action-source-invalid", "first-page-kind"] as const;
    for (const code of codes) expect(isScreenRelationIssue({ code, path: "/", message: "" })).toBe(true);
    for (const code of ["schema", "root-missing", "page-order-mismatch", "responsive-node-missing"] as const) {
      expect(isScreenRelationIssue({ code, path: "/", message: "" })).toBe(false);
    }
  });

  it("기존 examples는 관계 검사를 더해도 그대로 통과한다", () => {
    const dir = join(REPO_ROOT, "examples");
    const files = readdirSync(dir).filter((file) => file.endsWith(".json"));
    expect(files).toHaveLength(11);
    for (const file of files) {
      const spec: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const result = typeof spec === "object" && spec !== null && "pages" in spec ? validateProjectSpec(spec) : validateVisualSpec(spec);
      expect(result, file).toEqual({ valid: true, issues: [] });
    }
  });

  it("CLI validate(계약 번들)도 같은 코드와 경로로 실패한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "visual-spec-relations-"));
    try {
      const spec = project();
      setAction(spec, "login", "loginButton", { type: "navigate", target: "nowhere" });
      const file = join(dir, "dangling.json");
      writeFileSync(file, JSON.stringify(spec), "utf8");
      let stdout = "";
      let status = 0;
      try {
        stdout = execFileSync("node", [join(REPO_ROOT, "bin/visual-spec.mjs"), "validate", file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (error) {
        const e = error as { stdout?: string; status?: number };
        stdout = e.stdout ?? "";
        status = e.status ?? 1;
      }
      expect(status).toBe(1);
      expect(stdout).toContain(`[action-target-missing] ${LOGIN_TARGET}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
