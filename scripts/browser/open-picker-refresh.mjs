// Live Chromium regression checks for external JSON browse and editor reload recovery.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/open-picker-refresh.mjs
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startBrowserWorkspace } from "./harness.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "vs-open-picker-refresh-"));
await mkdir(join(workspace, "specs"));
const fixture = JSON.parse(await readFile(join(repo, "examples/dashboard-cards.json"), "utf8"));
await writeFile(join(workspace, "specs", "Alpha.json"), JSON.stringify({
  ...fixture,
  screen: { ...fixture.screen, name: "Alpha" },
}));

let runner;
try {
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto(runner.url);
  await page.getByRole("button", { name: "Alpha 이름 변경" }).waitFor();
  await page.getByRole("button").filter({ hasText: /Alpha.*페이지/s }).click();
  await page.getByRole("button", { name: "파일", exact: true }).waitFor();

  await page.getByRole("button", { name: "파일", exact: true }).click();
  const menuZ = await page.locator("header").evaluate(element => getComputedStyle(element).zIndex);
  assert.equal(menuZ, "20", "the menu bar must stack above the side panels");
  await page.getByRole("menuitem", { name: "열기", exact: true }).click();

  const picker = page.getByRole("alertdialog");
  await picker.getByRole("button", { name: "파일 찾아보기…", exact: true }).waitFor();
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    picker.getByRole("button", { name: "파일 찾아보기…", exact: true }).click(),
  ]);
  const localSpec = { ...fixture, screen: { ...fixture.screen, name: "Local Editorial" } };
  await fileChooser.setFiles({
    name: "local-editorial.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(localSpec)),
  });
  await page.waitForFunction(async () => {
    const [{ useEditorStore }, { useDocumentStore }] = await Promise.all([
      import("/src/features/editor/store/editorStore.ts"),
      import("/src/features/editor/store/documentStore.ts"),
    ]);
    return useEditorStore.getState().spec.name === "Local Editorial"
      && useDocumentStore.getState().downloadFileName === "local-editorial.json";
  });

  await page.reload();
  await page.getByRole("button", { name: "파일", exact: true }).waitFor();
  await page.waitForFunction(async () => {
    const [{ useEditorStore }, { useDocumentStore }] = await Promise.all([
      import("/src/features/editor/store/editorStore.ts"),
      import("/src/features/editor/store/documentStore.ts"),
    ]);
    return useEditorStore.getState().spec.name === "Local Editorial"
      && useDocumentStore.getState().downloadFileName === "local-editorial.json";
  });
  assert.deepEqual(errors, []);
  console.log("PASS external JSON chooser opens from the workspace picker; menu stacks above panels; reload restores the active editor and selected project");
  await context.close();
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
