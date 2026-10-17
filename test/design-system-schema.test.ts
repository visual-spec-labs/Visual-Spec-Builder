import { describe, expect, it } from "vitest";

import { migrateToV04, migrateToV03, migrateV01, toStandaloneVisualSpec, validateProjectSpec, validateVisualSpec } from "@/features/editor/schema";
import type { Node, ProjectSpec, VisualSpec } from "@/features/editor/schema";
import dashboard from "../examples/dashboard-cards.json";

function project(): ProjectSpec {
  return migrateV01(structuredClone(migrateToV04(migrateToV03(dashboard))) as VisualSpec);
}

describe("project design-system schema v0.4", () => {
  it("accepts matching stable color and typography references", () => {
    const spec = project();
    const title = Object.values(spec.pages.page1.nodes).find((node) => node.type === "text");
    if (title?.type !== "text") throw new Error("fixture needs a text node");
    spec.styles = {
      colors: { "color-primary": { name: "Primary", value: "#123456" } },
      typography: { "text-heading": { name: "Heading", value: structuredClone(title.typography) } },
    };
    title.color = "#123456";
    title.styleRefs = { colors: { color: "color-primary" }, typography: "text-heading" };
    expect(validateProjectSpec(spec)).toEqual({ valid: true, issues: [] });
  });

  it("rejects missing catalog items, invalid targets, and stale literal snapshots", () => {
    const spec = project();
    const title = Object.values(spec.pages.page1.nodes).find((node: Node) => node.type === "text");
    if (title?.type !== "text") throw new Error("fixture needs a text node");
    title.styleRefs = { colors: { color: "missing", "not-a-color": "missing" } };
    expect(validateProjectSpec(spec).issues.map(({ code }) => code)).toContain("style-reference-invalid");

    spec.styles = { colors: { "color-primary": { name: "Primary", value: "#123456" } } };
    title.color = "#FFFFFF";
    title.styleRefs = { colors: { color: "color-primary" } };
    expect(validateProjectSpec(spec).issues.map(({ code }) => code)).toContain("style-value-mismatch");
  });

  it("rejects case-insensitive duplicate display names within a style family", () => {
    const spec = project();
    spec.styles = { colors: {
      "color-primary": { name: "Primary", value: "#123456" },
      "color-accent": { name: " primary ", value: "#654321" },
    } };
    expect(validateProjectSpec(spec).issues.map(({ code }) => code)).toContain("style-name-duplicate");
  });

  it("materializes a validated standalone copy without refs and leaves the project untouched", () => {
    const spec = project();
    const title = Object.values(spec.pages.page1.nodes).find((node) => node.type === "text");
    if (title?.type !== "text") throw new Error("fixture needs a text node");
    title.color = "#123456";
    title.styleRefs = { colors: { color: "color-primary" } };
    spec.styles = { colors: { "color-primary": { name: "Primary", value: "#123456" } } };
    const before = structuredClone(spec);

    const standalone = toStandaloneVisualSpec(spec, "page1");

    expect(validateVisualSpec(standalone).valid).toBe(true);
    expect(Object.values(standalone.screen.nodes).every((node) => !("styleRefs" in node) || node.styleRefs === undefined)).toBe(true);
    expect(spec).toEqual(before);
    expect(spec.pages.page1.nodes).toEqual(before.pages.page1.nodes);
  });
});
