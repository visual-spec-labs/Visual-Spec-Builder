import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-448-b12-"));
let runner;
try {
  await mkdir(join(workspace, "specs"), { recursive: true });
  const fixture = JSON.parse(await readFile(new URL("../../examples/dashboard-cards.json", import.meta.url), "utf8"));
  await writeFile(join(workspace, "specs/B12.json"), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name: "B12" } }));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const warnings = [];
  page.on("dialog", async dialog => {
    if (dialog.type() === "beforeunload") warnings.push({ type: dialog.type(), at: Date.now() });
    await dialog.accept();
  });
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /B12.*페이지/s }).click();
  const status = page.locator('[role="status"][aria-label="저장 상태"]');
  await status.filter({ hasText: "파일 저장됨" }).waitFor();
  await page.evaluate(async () => {
    const { useEditorStore: s } = await import("/src/features/editor/store/editorStore.ts");
    const state = s.getState();
    const pageId = state.activePageId;
    state.setPageField(pageId, "name", "B12 edited");
    state.undo();
    state.redo();
  });
  await status.filter({ hasText: "수정됨 · 파일 미저장" }).waitFor();
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장", exact: true }).click();
  await status.filter({ hasText: "파일 저장됨" }).waitFor();
  const saveFinished = Date.now();
  await page.waitForTimeout(400);
  const elapsed = Date.now() - saveFinished;
  await page.reload();
  await page.getByRole("button").filter({ hasText: /B12.*페이지/s }).click();
  await status.filter({ hasText: "파일 저장됨" }).waitFor();
  console.log(`PASS B-12: save followed by reload after ${elapsed}ms raised ${warnings.length} beforeunload warnings`);
  assert.deepEqual(warnings, []);
  await context.close();
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
