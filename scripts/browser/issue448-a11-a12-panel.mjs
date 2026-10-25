// #448 A-11/A-12: verify inspector key exit, radius-only border defaults, and independent px line height.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/issue448-a11-a12-panel.mjs
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-448-a11-a12-"));
let runner;
try {
  await mkdir(join(workspace, "specs"), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../examples/dashboard-cards.json", import.meta.url), "utf8"));
  project.screen.name = "Issue448Panel";
  project.screen.nodes.headerTitle.typography = {
    fontFamily: "Pretendard", fontSize: 14, fontWeight: 700, lineHeight: 20, letterSpacing: 0, textAlign: "left",
  };
  await writeFile(join(workspace, "specs/inspector.json"), JSON.stringify(project));

  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /Issue448Panel.*페이지/s }).click();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });

  await page.getByRole("button", { name: "Title", exact: true }).click();
  const name = page.getByRole("textbox", { name: "노드 이름" });
  await name.fill("MenuImage");
  await name.press("Enter");
  assert.equal(await name.evaluate(element => document.activeElement !== element), true, "Enter must leave the name field");
  await name.focus();
  await name.press("Escape");
  assert.equal(await name.evaluate(element => document.activeElement !== element), true, "Escape must leave the name field");
  await page.keyboard.type("t");
  const editedName = await page.evaluate(() => {
    const state = editor.getState();
    return state.spec.pages[state.activePageId].nodes.headerTitle.name;
  });
  assert.equal(editedName, "MenuImage", "typing after Escape must not append to the node name");

  await page.getByRole("button", { name: "Header", exact: true }).click();
  const beforeRadius = await page.evaluate(() => {
    const state = editor.getState();
    return state.spec.pages[state.activePageId].nodes.header.border;
  });
  assert.equal(beforeRadius, undefined);
  await page.getByRole("spinbutton", { name: "모서리 반경" }).fill("12");
  await page.waitForFunction(() => {
    const state = editor.getState();
    return state.spec.pages[state.activePageId].nodes.header.border?.radius === 12;
  });
  const radiusBorder = await page.evaluate(() => {
    const state = editor.getState();
    return state.spec.pages[state.activePageId].nodes.header.border;
  });
  assert.deepEqual(radiusBorder, { width: 0, color: "#000000", radius: 12 });
  assert.equal(await page.getByRole("textbox", { name: "테두리색 hex" }).inputValue(), "#000000");

  await page.getByRole("button", { name: "MenuImage", exact: true }).click();
  await page.getByRole("spinbutton", { name: "크기" }).fill("18");
  await page.waitForFunction(() => {
    const state = editor.getState();
    return state.spec.pages[state.activePageId].nodes.headerTitle.typography.fontSize === 18;
  });
  const typography = await page.evaluate(() => {
    const state = editor.getState();
    return state.spec.pages[state.activePageId].nodes.headerTitle.typography;
  });
  assert.equal(typography.fontSize, 18);
  assert.equal(typography.lineHeight, 20, "px line height is an independent typography field");
  assert.equal(await page.getByRole("spinbutton", { name: "행간" }).inputValue(), "20");

  console.log("PASS A-11/A-12: Enter and Escape blur the node name; radius-only border stays width 0; px line height remains independent");
  await context.close();
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
