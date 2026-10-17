import { describe, expect, it } from "vitest";

import { migrateToV04, migrateToV03, migrateV01, validateProjectSpec } from "@/features/editor/schema";
import { stateStyleVariables } from "@/features/editor/ui/nodeStyles";
import type { ProjectSpec } from "@/features/editor/schema";
import login from "../examples/login-screen.json";

function project(): ProjectSpec {
  return migrateV01(migrateToV04(migrateToV03(login)) as import("@/features/editor/schema").VisualSpec);
}

describe("button/input state styles", () => {
  it.each(Array.from({ length: 8 }, (_, mask) => mask))("validates active state combination %i", (mask) => {
    const spec = project();
    const button = Object.values(spec.pages.page1.nodes).find((node) => node.type === "button");
    if (button?.type !== "button") throw new Error("fixture needs a button");
    const names = ["hover", "focus", "pressed"] as const;
    const states: NonNullable<typeof button.states> = {};
    names.forEach((name, index) => {
      if (mask & (1 << index)) states[name] = { background: `#00000${index}`, color: "#FFFFFF", borderColor: "#123456" };
    });
    button.states = states;
    expect(validateProjectSpec(spec).valid).toBe(true);
  });

  it("exposes separate CSS variables for each state property", () => {
    expect(stateStyleVariables({ hover: { background: "#111111", color: "#222222", borderColor: "#333333" }, focus: { color: "#444444" } })).toMatchObject({
      "--vs-hover-background": "#111111",
      "--vs-hover-color": "#222222",
      "--vs-hover-border-color": "#333333",
      "--vs-focus-color": "#444444",
    });
  });

  it("requires a state to define at least one supported property", () => {
    const spec = project();
    const button = Object.values(spec.pages.page1.nodes).find((node) => node.type === "button");
    if (button?.type !== "button") throw new Error("fixture needs a button");
    (button as unknown as { states: unknown }).states = { hover: {} };
    expect(validateProjectSpec(spec).valid).toBe(false);
  });
});
