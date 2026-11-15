import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-state-styles-"));
let runner;
try {
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext();
  const page = await context.newPage();
  await page.goto(runner.url);
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");

  for (const align of ["outside", "center"]) {
    await page.evaluate(async (borderAlign) => {
      const { buttonStyle } = await import("/src/features/editor/ui/nodeStyles.ts");
      const node = {
        type: "button", name: "State test", content: "State test",
        box: { width: 120, height: 40 }, color: "#202020",
        typography: { fontFamily: "Arial", fontSize: 14, fontWeight: 400, lineHeight: 20, letterSpacing: 0, textAlign: "left" },
        background: [{ type: "solid", color: "#101010" }],
        border: { width: 4, color: "#303030", align: borderAlign },
        states: {
          hover: { background: "#111111", color: "#121212", borderColor: "#131313" },
          focus: { color: "#222222", borderColor: "#232323" },
          pressed: { borderColor: "#333333" },
        },
      };
      document.querySelector("#vs-state-test")?.remove();
      const element = document.createElement("div");
      element.id = "vs-state-test";
      element.className = "vs-control-node";
      element.tabIndex = 0;
      for (const state of ["hover", "focus", "pressed"]) {
        for (const property of ["background", "color", "borderColor"]) {
          if (node.states[state]?.[property]) element.dataset[`vs${state[0].toUpperCase()}${state.slice(1)}${property[0].toUpperCase()}${property.slice(1).replace("Color", "")}`] = "true";
        }
      }
      for (const [name, value] of Object.entries(buttonStyle(node))) {
        if (name.startsWith("--")) element.style.setProperty(name, value);
        else element.style[name] = value;
      }
      document.body.append(element);
    }, align);
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#vs-state-test" });
    const check = async (pseudo, background, color, ring) => {
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: pseudo });
      const computed = await page.locator("#vs-state-test").evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, color: style.color, shadow: style.boxShadow };
      });
      assert.equal(computed.background, background, `${align}: ${pseudo} background`);
      assert.equal(computed.color, color, `${align}: ${pseudo} color`);
      assert.match(computed.shadow, new RegExp(ring), `${align}: ${pseudo} border ring`);
    };
    await check([], "rgb(16, 16, 16)", "rgb(32, 32, 32)", "48, 48, 48");
    await check(["hover"], "rgb(17, 17, 17)", "rgb(18, 18, 18)", "19, 19, 19");
    await check(["hover", "focus", "focus-visible"], "rgb(17, 17, 17)", "rgb(34, 34, 34)", "35, 35, 35");
    await check(["hover", "focus", "focus-visible", "active"], "rgb(17, 17, 17)", "rgb(34, 34, 34)", "51, 51, 51");
  }
  await context.close();
  console.log("Chromium state styles: outside/center and per-property hover/focus/pressed passed");
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
