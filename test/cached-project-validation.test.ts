import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import { createCachedProjectValidator, validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";

it("cached validation exactly matches full validation across edits, recovery, mutation and history", () => {
  const cached = createCachedProjectValidator();
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  const compare = (value: unknown) => expect(cached(value)).toEqual(validateProjectSpec(value));
  compare(project); compare(project);
  const original = structuredClone(project);
  // Same object, mutated content: neither valid nor invalid page results may go stale.
  project.pages.login.nodes.loginButton.box.width = 23;
  compare(project);
  const button = project.pages.login.nodes.loginButton;
  if (button.type !== "button") throw Error("fixture");
  button.action = { type: "navigate", target: "missing" };
  compare(project);
  project.pages.dashboard.kind = "modal";
  button.action = { type: "navigate", target: "dashboard" };
  compare(project);
  delete button.action;
  compare(project);
  project.pageOrder = ["resetPassword", "login", "dashboard"];
  compare(project);
  project.pages.login.root = "missing";
  compare(project); compare(project);
  compare(original); // Undo / external document identity.
  compare({ ...original, pages: { ...original.pages, renamed: original.pages.login } });
  compare({ ...original, version: "bad" });
  compare({ ...original, unexpected: true });
  compare(null);
  const invalid = { ...original, pages: { ...original.pages, login: { ...original.pages.login, root: "missing" } } };
  const result = cached(invalid);
  result.issues[0].message = "caller mutation";
  compare(invalid);
});

it("matches every checked-in project fixture including malformed schema and responsive graphs", () => {
  const cached = createCachedProjectValidator();
  const directory = join(process.cwd(), "test/fixtures");
  for (const name of readdirSync(directory, { recursive: true, encoding: "utf8" }).filter(name => name.endsWith(".json"))) {
    const value: unknown = JSON.parse(readFileSync(join(directory, name), "utf8"));
    expect(cached(value)).toEqual(validateProjectSpec(value));
    expect(cached(value)).toEqual(validateProjectSpec(value));
  }
});

it("does not alias non-JSON mutations or skip malformed page schemas", () => {
  const cached = createCachedProjectValidator();
  for (const value of [NaN, Infinity, undefined, null, "fill", -1, {}, []]) {
    const project = structuredClone(fixture) as unknown as ProjectSpec;
    expect(cached(project)).toEqual(validateProjectSpec(project));
    Object.assign(project.pages.login.nodes.loginButton.box, { width: value });
    expect(cached(project)).toEqual(validateProjectSpec(project));
  }
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  const snapshot = structuredClone(project.pages.login);
  cached(project);
  Object.assign(project.pages.login, { toJSON: () => snapshot, unexpected: true });
  expect(cached(project)).toEqual(validateProjectSpec(project));
});

it("matches full validation for a deterministic sequence of edits and Undo-like snapshots", () => {
  const cached = createCachedProjectValidator();
  let project = structuredClone(fixture) as unknown as ProjectSpec;
  const history: ProjectSpec[] = [];
  for (let i = 0; i < 150; i++) {
    history.push(project);
    const pageId = project.pageOrder[i % project.pageOrder.length];
    const page = structuredClone(project.pages[pageId]);
    if (i % 5 === 0) page.kind = i % 2 ? "modal" : "page";
    else if (i % 5 === 1) page.root = i % 2 ? "missing" : "root";
    else if (i % 5 === 2) page.size.width = i;
    else if (i % 5 === 3) page.name = `Name ${i}`;
    else page.responsive = { breakpoints: [], overrides: {} } as unknown as ProjectSpec["pages"][string]["responsive"];
    project = { ...project, pages: { ...project.pages, [pageId]: page } };
    expect(cached(project)).toEqual(validateProjectSpec(project));
    expect(cached(history[i >> 1])).toEqual(validateProjectSpec(history[i >> 1]));
  }
});

it("falls back for prototypes and non-enumerable fields instead of trusting a JSON alias", () => {
  const cached = createCachedProjectValidator();
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  cached(project);
  Object.setPrototypeOf(project.pages.login, { unexpected: true });
  expect(cached(project)).toEqual(validateProjectSpec(project));
  Object.setPrototypeOf(project.pages.login, Object.prototype);
  const box = project.pages.login.nodes.loginButton.box;
  Object.defineProperty(box, "width", { value: 30, enumerable: false, configurable: true });
  expect(cached(project)).toEqual(validateProjectSpec(project));
  Object.defineProperty(box, "width", { value: "invalid", enumerable: false, configurable: true });
  expect(cached(project)).toEqual(validateProjectSpec(project));
});

it("preserves diagnostic order after deleting and reinserting an unchanged node", () => {
  const cached = createCachedProjectValidator();
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  const nodes = project.pages.login.nodes;
  nodes.orphanA = structuredClone(nodes.title);
  nodes.orphanB = structuredClone(nodes.title);
  const before = validateProjectSpec(project);
  expect(cached(project)).toEqual(before); // Cache the invalid page, including issue order.
  const orphanPaths = (result: typeof before) => result.issues
    .filter(issue => issue.code === "orphan-node").map(issue => issue.path);
  expect(orphanPaths(before)).toEqual(["/pages/login/nodes/orphanA", "/pages/login/nodes/orphanB"]);
  const unchangedNode = nodes.orphanA;
  delete nodes.orphanA;
  nodes.orphanA = unchangedNode;
  const after = validateProjectSpec(project);
  expect(orphanPaths(after)).toEqual(["/pages/login/nodes/orphanB", "/pages/login/nodes/orphanA"]);
  expect(cached(project)).toEqual(after);
  expect(cached(project)).toEqual(after); // Reuse must preserve the new order too.
});
