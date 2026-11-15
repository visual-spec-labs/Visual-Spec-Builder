import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/screen-relations-project.json";
import type { ButtonNode, InputNode, InstanceNode, ProjectSpec } from "@/features/editor/schema";
import { WidgetInstance } from "@/features/editor/ui/WidgetInstance";
import { ModalPreview } from "@/features/editor/ui/ModalPreview";
import { controlStateProps } from "@/features/editor/ui/controlStateProps";

function setup() {
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  const button = structuredClone(project.pages.login.nodes.loginButton) as ButtonNode;
  button.states = { hover: { background: "#112233" }, focus: { color: "#445566" }, pressed: { borderColor: "#778899" } };
  const input: InputNode = { type: "input", name: "State input", placeholder: "Input", box: button.box,
    typography: button.typography, color: button.color, background: button.background, states: button.states };
  const widget = project.pages.notificationWidget;
  const root = widget.nodes[widget.root];
  if (root.type !== "frame") throw new Error("fixture root");
  widget.nodes.button = button;
  widget.nodes.input = input;
  root.children = [{ node: "button" }, { node: "input" }];
  const instance: InstanceNode = { type: "instance", name: "State widget", ref: "notificationWidget", box: { width: 200, height: 100 } };
  return { project, instance, button, input };
}

function expectStateHooks(html: string, count: number) {
  for (const attribute of ["class=\"vs-control-node\"", "data-vs-hover-background=\"true\"", "data-vs-focus-color=\"true\"", "data-vs-pressed-border=\"true\""]) {
    expect(html.split(attribute)).toHaveLength(count + 1);
  }
  expect(html).not.toContain("data-vs-hover-color");
  expect(html).not.toContain("data-vs-focus-background");
  expect(html).not.toContain("data-vs-pressed-background");
  for (const variable of ["--vs-hover-background:#112233", "--vs-focus-color:#445566", "--vs-pressed-border-color:#778899"]) {
    expect(html.split(variable)).toHaveLength(count + 1);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("control state hooks in widget and modal renderers", () => {
  it("omits inactive property flags so CSS state fallback remains per-property", () => {
    expect(controlStateProps(undefined)).toEqual({ className: "vs-control-node",
      "data-vs-hover-background": undefined, "data-vs-hover-color": undefined, "data-vs-hover-border": undefined,
      "data-vs-focus-background": undefined, "data-vs-focus-color": undefined, "data-vs-focus-border": undefined,
      "data-vs-pressed-background": undefined, "data-vs-pressed-color": undefined, "data-vs-pressed-border": undefined });
  });

  it.each([false, true])("renders matching CSS hooks while preserving native controls=%s", (interactive) => {
    const { project, instance } = setup();
    const html = renderToStaticMarkup(createElement(WidgetInstance, { project, instance, width: 800,
      ...(interactive ? { onAction: () => undefined } : {}) }));
    expectStateHooks(html, 2);
    expect(html.includes("<button")).toBe(interactive);
    expect(html.includes("<input")).toBe(interactive);
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("data-node-id");
  });

  it("keeps the same hooks on ordinary controls and widget controls in modal previews", () => {
    const { project, instance, button, input } = setup();
    const modal = project.pages.resetPassword;
    const root = modal.nodes[modal.root];
    if (root.type !== "frame") throw new Error("fixture root");
    modal.nodes.button = button;
    modal.nodes.input = input;
    modal.nodes.instance = instance;
    root.children = [{ node: "button" }, { node: "input" }, { node: "instance" }];
    vi.stubGlobal("window", { innerWidth: 1000, innerHeight: 800 });
    const html = renderToStaticMarkup(createElement(ModalPreview, { project, pageId: "resetPassword",
      editorSurface: { current: null }, onClose: () => undefined, onNavigate: () => undefined }));
    expectStateHooks(html, 4);
    expect(html.match(/<input/g)).toHaveLength(2);
    expect(html.match(/<button/g)).toHaveLength(3); // Two spec buttons plus the preview close control.
  });
});
