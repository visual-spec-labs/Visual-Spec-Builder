import { describe, expect, it } from "vitest";
import login from "../examples/login-screen.json";
import { migrateToV03, migrateV01, validateProjectSpec, validateVisualSpec, type VisualSpec } from "@/features/editor/schema";

function withFill(fill: unknown) {
  const spec = structuredClone(login);
  (spec.screen.nodes.root as { background: unknown }).background = [fill];
  return spec;
}
describe("image background contract (#235)", () => {
  it.each(["cover", "contain", "fill"])("accepts %s in screen/project/responsive backgrounds", (fit) => {
    const spec = withFill({ type: "image", src: "assets/hero.png", fit });
    expect(validateVisualSpec(spec).valid).toBe(true);
    expect(validateProjectSpec(migrateV01(spec as VisualSpec)).valid).toBe(true);
    expect(validateVisualSpec({ ...spec, screen: { ...spec.screen, responsive: {
      breakpoints: { wide: { minWidthPx: 768 } }, overrides: { wide: { root: { background: [{ type: "image", src: "assets/hero.png", fit }] } } },
    } } }).valid).toBe(true);
  });
  it.each([
    { type: "image", src: "", fit: "cover" },
    { type: "image", src: "assets/a.png", fit: "repeat" },
    { type: "image", src: "assets/a.png", fit: "cover", repeat: true },
    { type: "image", src: "assets/a.png" },
  ])("rejects malformed image fill %j", (fill) => {
    expect(validateVisualSpec(withFill(fill)).valid).toBe(false);
  });
  it("keeps existing v0.3 identity and migrates legacy solid without loss", () => {
    expect(migrateToV03(login)).toBe(login);
    const legacy = structuredClone(login);
    (legacy as { version: string }).version = "0.1";
    (legacy.screen.nodes.root as { background: unknown }).background = { color: "#FFFFFF" };
    const before = JSON.stringify(legacy);
    const migrated = migrateToV03(legacy);
    expect(validateVisualSpec(migrated).valid).toBe(true);
    expect(JSON.stringify(legacy)).toBe(before);
    expect((migrated as VisualSpec).screen.nodes.root).toMatchObject({ background: [{ type: "solid", color: "#FFFFFF" }] });
  });
});
