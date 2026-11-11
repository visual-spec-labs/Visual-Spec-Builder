import { describe, expect, it } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import type { ProjectSpec } from "@/features/editor/schema";
import { interactionCommand, interactionTargets, interactionWarning } from "@/features/editor/ui/properties/interactionPatch";

const project = () => structuredClone(fixture) as unknown as ProjectSpec;
describe("Interaction commands and candidate lists", () => {
  it("uses dedicated removal and whole-object replacement, never guessed targets", () => {
    expect(interactionCommand("b", "none")).toEqual({ type: "removeNodeAction", id: "b" });
    expect(interactionCommand("b", "close")).toEqual({ type: "updateNode", id: "b", path: "action", value: { type: "close" } });
    for (const type of ["navigate", "openModal"] as const) {
      expect(interactionCommand("b", type)).toBeNull();
      expect(interactionCommand("b", type, "target")).toEqual({ type: "updateNode", id: "b", path: "action", value: { type, target: "target" } });
    }
  });
  it("filters by effective kind, retains order, labels duplicate names with identity", () => {
    const spec = project(); spec.pages.login.name = spec.pages.dashboard.name;
    expect(interactionTargets(spec, "navigate").map((option) => option.value)).toEqual(["login", "dashboard"]);
    expect(interactionTargets(spec, "openModal").map((option) => option.value)).toEqual(["resetPassword"]);
    expect(interactionTargets(spec, "navigate")[0].label).toContain("(login)");
    spec.pages.dashboard.kind = "widget";
    expect(interactionTargets(spec, "navigate").map((option) => option.value)).toEqual(["login"]);
    expect(interactionTargets(spec, "close")).toEqual([]);
  });
  it("shows missing target, wrong kind and invalid close from the shared validator", () => {
    const spec = project();
    expect(interactionWarning(spec, "login", "loginButton")).toBeNull();
    delete spec.pages.dashboard;
    expect(interactionWarning(spec, "login", "loginButton")).toContain("dashboard");
    spec.pages.resetPassword.kind = "widget";
    expect(interactionWarning(spec, "login", "forgotButton")).toContain("modal");
    spec.pages.resetPassword.kind = "page";
    expect(interactionWarning(spec, "resetPassword", "closeButton")).toContain("close");
    expect(interactionWarning(spec, "login", "title")).toBeNull();
  });
});
