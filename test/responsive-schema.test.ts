import { describe, expect, it } from "vitest";
import login from "../examples/login-screen.json";
import hero from "../examples/image-hero.json";
import example from "../examples/responsive-cards.json";
import { validateVisualSpec, validateProjectSpec, visualSpecJsonSchema } from "@/features/editor/schema";
import Ajv2020 from "ajv/dist/2020";

function fixture() {
  const spec = structuredClone(example);
  const root = spec.screen.root;
  return { spec, root, responsive: spec.screen.responsive };
}
function validatePatch(patch: unknown, baseBorder?: unknown) {
  const { spec, root } = fixture();
  const input = spec as unknown as { screen: { nodes: Record<string, Record<string, unknown>>; responsive: { breakpoints: object; overrides: object } } };
  delete input.screen.nodes[root].border;
  if (baseBorder !== undefined) input.screen.nodes[root].border = baseBorder;
  input.screen.responsive = { breakpoints: { a: { minWidthPx: 1 } }, overrides: { a: { [root]: patch } } };
  return validateVisualSpec(input);
}

describe("반응형 선택 확장 (#222)", () => {
  it("새 예제·기존 필드 생략·빈 맵을 허용하고 입력을 변경하지 않는다", () => {
    const { spec } = fixture();
    const before = JSON.stringify(spec);
    expect(validateVisualSpec(spec).valid).toBe(true);
    expect(JSON.stringify(spec)).toBe(before);
    expect(validateVisualSpec({ ...spec, screen: { ...spec.screen, responsive: undefined } }).valid).toBe(true);
    expect(validateVisualSpec({ ...spec, screen: { ...spec.screen, responsive: { breakpoints: {}, overrides: {} } } }).valid).toBe(true);
  });
  it("객체는 희소 상속하고 배열은 통째로 교체한다", () => {
    expect(validatePatch({ box: { width: 300 }, layout: { padding: { top: 1 } }, background: [] }).valid).toBe(true);
    expect(validatePatch({ background: [{ type: "linear", angle: 0, stops: [{ color: "#000000", at: 0 }] }] }).valid).toBe(false);
  });
  it.each([0, -1, "768", null])("폭 %s를 거부한다", (width) => {
    const { spec, responsive } = fixture();
    Object.assign(responsive.breakpoints.tablet, { minWidthPx: width });
    expect(validateVisualSpec(spec).valid).toBe(false);
  });
  it("중복 폭과 선언되지 않은 breakpoint/node를 각각 보고한다", () => {
    const { spec, responsive } = fixture();
    responsive.breakpoints.desktop.minWidthPx = 768;
    Object.assign(responsive.overrides, { missing: {} });
    Object.assign(responsive.overrides.tablet, { absent: {} });
    expect(validateVisualSpec(spec).issues.map((i) => i.code)).toEqual(expect.arrayContaining([
      "responsive-duplicate-width", "responsive-breakpoint-missing", "responsive-node-missing",
    ]));
  });
  it.each(["type", "name", "content", "placeholder", "src", "children", "shadow", "unknown"])("%s 변경을 거부한다", (field) => {
    expect(validatePatch({ [field]: "changed" }).valid).toBe(false);
  });
  it.each([
    { type: "text", patch: { typography: { fontSize: 20 }, color: "#123456", opacity: 0.5 }, invalid: { fit: "cover" } },
    { type: "image", patch: { fit: "contain", blur: 2 }, invalid: { color: "#123456" } },
    { type: "button", patch: { typography: { fontWeight: 600 }, border: { width: 1, color: "#000000", radius: 4 } }, invalid: { opacity: 0.5 } },
    { type: "input", patch: { color: "#123456", background: [] }, invalid: { blur: 2 } },
  ])("$type에 정의된 표현 속성만 상속한다", ({ type, patch, invalid }) => {
    const source = [...Object.values(login.screen.nodes), ...Object.values(hero.screen.nodes)].find((node) => node.type === type);
    expect(source).toBeDefined();
    const { spec, root } = fixture();
    const rootNode = structuredClone(spec.screen.nodes[root as keyof typeof spec.screen.nodes]);
    const screen = { ...spec.screen, nodes: { [root]: { ...rootNode, children: [{ node: "leaf" }] }, leaf: source },
      responsive: { breakpoints: { a: { minWidthPx: 700 } }, overrides: { a: { leaf: patch } } } };
    expect(validateVisualSpec({ ...spec, screen }).valid).toBe(true);
    const bad = { ...screen, responsive: { ...screen.responsive, overrides: { a: { leaf: invalid } } } };
    expect(validateVisualSpec({ ...spec, screen: bad }).issues.some((issue) => issue.code === "responsive-node-property")).toBe(true);
  });
  it("숫자 소수 폭은 유효하고 알 수 없는 키·빈 ID·null은 무효다", () => {
    const { spec } = fixture();
    Object.assign(spec.screen.responsive, { breakpoints: { fractional: { minWidthPx: 767.5 } }, overrides: {} });
    expect(validateVisualSpec(spec).valid).toBe(true);
    for (const responsive of [null, { breakpoints: { "": { minWidthPx: 1 } }, overrides: {} }, { breakpoints: {}, overrides: {}, other: true }]) {
      expect(validateVisualSpec({ ...spec, screen: { ...spec.screen, responsive } }).valid).toBe(false);
    }
  });
  it("타입이 다른 노드의 표현 필드를 거부한다", () => {
    expect(validatePatch({ fit: "cover" }).issues.some((i) => i.code === "responsive-node-property")).toBe(true);
  });
  it("상속할 border가 없으면 일부 필드로 새 border를 만들 수 없다", () => {
    expect(validatePatch({ border: { width: 2 } }).issues.some((i) => i.code === "responsive-effective-node")).toBe(true);
    expect(validatePatch({ border: { width: 2, color: "#000000", radius: 0 } }).valid).toBe(true);
    expect(validatePatch({ border: { width: 2 } }, { width: 1, color: "#000000", radius: 0 }).valid).toBe(true);
  });
  it("숫자 반경에서 객체 전환 시 네 모서리를 요구하고 객체끼리는 희소 상속한다", () => {
    const partial = { border: { radius: { topLeft: 10 } } };
    expect(validatePatch(partial, { width: 1, color: "#000000", radius: 0 }).valid).toBe(false);
    expect(validatePatch(partial, { width: 1, color: "#000000", radius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 } }).valid).toBe(true);
  });
  it("ID 순서가 아닌 폭 순서로 이전 override를 누적한다", () => {
    const { spec, root } = fixture();
    delete (spec.screen.nodes[root as keyof typeof spec.screen.nodes] as { border?: unknown }).border;
    Object.assign(spec.screen.responsive, { breakpoints: { a: { minWidthPx: 900 }, z: { minWidthPx: 400 } }, overrides: {
      a: { [root]: { border: { width: 3 } } }, z: { [root]: { border: { width: 1, color: "#000000", radius: 0 } } },
    } });
    expect(validateVisualSpec(spec).valid).toBe(true);
    Object.assign(spec.screen.responsive.breakpoints, { a: { minWidthPx: 300 } });
    expect(validateVisualSpec(spec).valid).toBe(false);
  });
  it("반응형 gradient stop 순서도 검사한다", () => {
    expect(validatePatch({ background: [{ type: "linear", angle: 0, stops: [{ color: "#000000", at: 1 }, { color: "#FFFFFF", at: 0 }] }] }).issues.some((i) => i.code === "gradient-stop-order")).toBe(true);
  });
  it("project에서도 같은 계약을 적용하고 페이지 오류 경로를 보존한다", () => {
    const { spec, responsive } = fixture();
    responsive.breakpoints.desktop.minWidthPx = 768;
    const project = { version: "0.3", name: "Project", pages: { home: spec.screen }, pageOrder: ["home"] };
    expect(validateProjectSpec(project).issues).toContainEqual(expect.objectContaining({ code: "responsive-duplicate-width", path: "/pages/home/responsive/breakpoints/tablet/minWidthPx" }));
  });
  it("prototype 이름을 상속된 breakpoint/node로 오인하지 않는다", () => {
    const { spec } = fixture();
    Object.assign(spec.screen.responsive, JSON.parse('{"breakpoints":{"a":{"minWidthPx":1}},"overrides":{"constructor":{},"a":{"__proto__":{}}}}'));
    expect(validateVisualSpec(spec).issues.map((i) => i.code)).toEqual(expect.arrayContaining(["responsive-breakpoint-missing", "responsive-node-missing"]));
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
  it("같은 0.3이라도 확장 전 schema는 responsive 문서를 거부한다", () => {
    const oldSchema = structuredClone(visualSpecJsonSchema);
    delete (oldSchema.$defs.ScreenSpec.properties as Record<string, unknown>).responsive;
    const oldValidator = new Ajv2020().compile(oldSchema);
    expect(oldValidator(example)).toBe(false);
    const { spec } = fixture();
    const { responsive: _responsive, ...screen } = spec.screen;
    void _responsive;
    expect(oldValidator({ ...spec, screen })).toBe(true);
  });
});
