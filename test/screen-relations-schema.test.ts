import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import login from "../examples/login-screen.json";
import fixture from "./fixtures/screen-relations-project.json";
import {
  migrateToV03,
  toVisualSpec,
  validateProjectSpec,
  validateVisualSpec,
  type ProjectSpec,
  type ScreenSpec,
} from "@/features/editor/schema";

const EXAMPLES_DIR = new URL("../examples/", import.meta.url);
const examples = readdirSync(EXAMPLES_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => [file, JSON.parse(readFileSync(new URL(file, EXAMPLES_DIR), "utf8"))] as const);

function project() {
  return structuredClone(fixture) as unknown as ProjectSpec;
}
function loginButton(spec: ProjectSpec) {
  return spec.pages.login.nodes.loginButton as unknown as Record<string, unknown>;
}
/** login-screen 예제의 노드 하나에 action을 붙인 화면 문서. */
function screenWithAction(nodeType: string, action: unknown) {
  const spec = structuredClone(login) as unknown as { screen: ScreenSpec };
  const entry = Object.entries(spec.screen.nodes).find(([, node]) => node.type === nodeType);
  if (entry === undefined) throw new Error(`login-screen에 ${nodeType} 노드가 없다`);
  (entry[1] as unknown as Record<string, unknown>).action = action;
  return spec;
}
function schemaOnly(result: ReturnType<typeof validateVisualSpec>) {
  return !result.valid && result.issues.every((issue) => issue.code === "schema");
}

describe("화면 종류·연결 선택 확장 (#265 S1-1)", () => {
  it.each(examples)("기존 예제 %s는 고치지 않고 그대로 통과하며 새 필드를 쓰지 않는다", (_file, spec) => {
    const result = "pages" in spec ? validateProjectSpec(spec) : validateVisualSpec(spec);
    expect(result).toEqual({ valid: true, issues: [] });
    expect(JSON.stringify(spec)).not.toMatch(/"(kind|action)":/);
  });

  it("kind·action을 쓴 프로젝트 fixture가 통과하고 입력을 바꾸지 않는다", () => {
    const spec = project();
    const before = JSON.stringify(spec);
    expect(validateProjectSpec(spec)).toEqual({ valid: true, issues: [] });
    expect(migrateToV03(spec)).toBe(spec);
    expect(JSON.stringify(spec)).toBe(before);
  });

  it("각 페이지를 화면 문서로 내보내도 구조 검증을 통과한다", () => {
    for (const page of Object.values(project().pages)) {
      expect(validateVisualSpec(toVisualSpec(page))).toEqual({ valid: true, issues: [] });
    }
  });

  it("kind 생략과 명시 page는 둘 다 유효하다", () => {
    const spec = project();
    expect(spec.pages.login.kind).toBeUndefined();
    expect(spec.pages.dashboard.kind).toBe("page");
    spec.pages.login.kind = "page";
    delete spec.pages.dashboard.kind;
    expect(validateProjectSpec(spec).valid).toBe(true);
  });

  it.each(["dialog", "Page", "", null, 1, ["page"]])("kind %j를 스키마 단계에서 거부한다", (kind) => {
    const spec = structuredClone(login) as unknown as { screen: Record<string, unknown> };
    spec.screen.kind = kind;
    expect(schemaOnly(validateVisualSpec(spec))).toBe(true);
  });

  it.each([
    { type: "navigate", target: "dashboard" },
    { type: "openModal", target: "resetPassword" },
    { type: "close" },
  ])("button의 action $type 갈래를 받는다", (action) => {
    expect(validateVisualSpec(screenWithAction("button", action)).valid).toBe(true);
  });

  it.each(["frame", "text", "input"])("%s 노드의 action을 거부한다(초기에는 button만)", (nodeType) => {
    expect(schemaOnly(validateVisualSpec(screenWithAction(nodeType, { type: "close" })))).toBe(true);
  });

  it("image 노드의 action을 거부한다", () => {
    const spec = structuredClone(login) as unknown as { screen: ScreenSpec };
    spec.screen.nodes.hero = { type: "image", name: "Hero", box: { width: 100, height: 100 }, src: "assets/a.png", fit: "cover" };
    const root = spec.screen.nodes[spec.screen.root];
    if (root.type !== "frame") throw new Error("root는 frame이다");
    root.children.push({ node: "hero" });
    expect(validateVisualSpec(spec).valid).toBe(true);
    (spec.screen.nodes.hero as unknown as Record<string, unknown>).action = { type: "close" };
    expect(schemaOnly(validateVisualSpec(spec))).toBe(true);
  });

  it.each([
    ["action null", null],
    ["배열", [{ type: "close" }]],
    ["navigate에 target 없음", { type: "navigate" }],
    ["openModal에 target 없음", { type: "openModal" }],
    ["close에 target", { type: "close", target: "login" }],
    ["추가 필드", { type: "navigate", target: "dashboard", url: "/dashboard" }],
    ["모르는 type", { type: "submit" }],
    ["외부 URL type", { type: "openUrl", target: "https://example.com" }],
    ["빈 target", { type: "navigate", target: "" }],
    ["PageId 형식이 아닌 target", { type: "navigate", target: "대시보드 페이지" }],
    ["숫자 target", { type: "openModal", target: 1 }],
  ])("잘못된 action(%s)을 스키마 단계에서 거부한다", (_label, action) => {
    expect(schemaOnly(validateVisualSpec(screenWithAction("button", action)))).toBe(true);
  });

  it("프로젝트 안의 잘못된 action도 스키마 오류로 보고한다", () => {
    const spec = project();
    loginButton(spec).action = { type: "navigate", target: "dashboard", extra: true };
    const result = validateProjectSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.issues.every((issue) => issue.code === "schema")).toBe(true);
  });

  it.each([
    ["action", { action: { type: "close" } }],
    ["kind", { kind: "modal" }],
  ])("반응형 override로 %s를 바꿀 수 없다", (_field, patch) => {
    const spec = structuredClone(login) as unknown as { screen: ScreenSpec };
    const buttonId = Object.keys(spec.screen.nodes).find((id) => spec.screen.nodes[id].type === "button");
    if (buttonId === undefined) throw new Error("login-screen에 button이 없다");
    spec.screen.responsive = { breakpoints: { wide: { minWidthPx: 768 } }, overrides: { wide: { [buttonId]: patch } } } as ScreenSpec["responsive"];
    expect(schemaOnly(validateVisualSpec(spec))).toBe(true);
  });

  // 참조 무결성(대상 존재·대상 kind·close 문맥·첫 화면 kind)은 S1-2 프로젝트 검증 몫이다.
  // S1-1 스키마는 모양만 본다 — S1-2가 IssueCode를 추가하면 아래 기대를 그 코드로 바꾼다.
  it("S1-1은 참조 무결성을 검사하지 않는다 — 모양이 맞으면 통과한다", () => {
    const missing = project();
    loginButton(missing).action = { type: "navigate", target: "nowhere" };
    expect(validateProjectSpec(missing).valid).toBe(true);

    const wrongKind = project();
    loginButton(wrongKind).action = { type: "openModal", target: "dashboard" };
    expect(validateProjectSpec(wrongKind).valid).toBe(true);

    const modalFirst = project();
    modalFirst.pageOrder = ["resetPassword", "login", "dashboard", "notificationWidget"];
    expect(validateProjectSpec(modalFirst).valid).toBe(true);
  });
});
