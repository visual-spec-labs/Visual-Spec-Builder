// Real canvas/modal preview, deterministic document; no model invocation.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-canvas-relations-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "CanvasRelations";
  const modal = project.pages.resetPassword;
  modal.nodes.root.box = { width: 12, height: 12 };
  modal.responsive = { breakpoints: { desktop: { minWidthPx: 800 } }, overrides: { desktop: { title: { typography: { fontSize: 32 } } } } };
  project.pages.secondModal = structuredClone(modal);
  project.pages.secondModal.name = "SecondModal";
  project.pageOrder.push("secondModal");
  modal.nodes.replace = { ...structuredClone(modal.nodes.closeButton), name: "Replace", content: "다른 모달", action: { type: "openModal", target: "secondModal" } };
  modal.nodes.root.children.push({ node: "replace" });
  await writeFile(join(workspace, "specs/relations.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /CanvasRelations.*페이지/s }).click();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });
  const state = () => page.evaluate(() => ({ spec: editor.getState().spec, past: editor.getState().history.past, future: editor.getState().history.future }));
  const initial = await state();
  assert.equal(await page.locator("[data-relation-marker]").count(), 2);
  const button = page.locator('[data-node-id="loginButton"]');
  const sizeBefore = await button.evaluate(el => [el.offsetWidth, el.offsetHeight]);
  await page.getByRole("button", { name: "LoginButton", exact: true }).click();
  assert.deepEqual(await button.evaluate(el => [el.offsetWidth, el.offsetHeight]), sizeBefore);
  await page.getByTestId("relation-target").click();
  assert.equal(await page.evaluate(() => editor.getState().activePageId), "dashboard");
  assert.deepEqual(await state(), initial);
  await page.evaluate(() => { editor.getState().selectPage("login"); editor.getState().select("forgotButton"); });
  await page.getByTestId("relation-target").click();
  assert.equal(await page.evaluate(() => editor.getState().activePageId), "resetPassword");
  const trigger = page.getByRole("button", { name: "모달 미리보기", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "ResetPasswordModal 모달 미리보기" });
  const panel = page.getByTestId("modal-preview-panel");
  const bounds = await panel.boundingBox();
  assert.equal(Math.round(bounds.width), 480); assert.equal(Math.round(bounds.height), 320);
  assert.equal(Math.round(bounds.x + bounds.width / 2), 720);
  assert.equal(Math.round(bounds.y + bounds.height / 2), 500);
  assert.equal(await dialog.locator('[data-preview-node="root"]').evaluate(el => el.offsetWidth), 480, "root.box does not override panel width");
  assert.equal(await dialog.locator('[data-preview-node="title"]').evaluate(el => getComputedStyle(el).fontSize), "32px", "breakpoint uses 1440px host, not 480px panel");
  await page.mouse.click(4, 500);
  assert.equal(await dialog.count(), 1, "backdrop click keeps preview open");
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
  }
  await dialog.getByRole("button", { name: "다른 모달", exact: true }).click();
  await page.getByRole("dialog", { name: "SecondModal 모달 미리보기" }).waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 1);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "SecondModal 모달 미리보기" }).waitFor({ state: "detached" });
  await dialog.waitFor({ state: "detached" });
  assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
  assert.deepEqual(await state(), initial);

  await trigger.click();
  await page.setViewportSize({ width: 360, height: 240 });
  await page.waitForFunction(() => document.querySelector('[data-testid="modal-preview-panel"]').offsetWidth === 328);
  const small = await panel.boundingBox();
  assert.equal(Math.round(small.width), 328); assert.ok(small.height <= 208);
  assert.ok(small.x >= 16 && small.y >= 16);
  assert.equal(await dialog.locator('[data-preview-node="title"]').evaluate(el => getComputedStyle(el).fontSize), "20px");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.deepEqual(await state(), initial);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => editor.getState().setNodeField("title", "box.height", 2000));
  const longBefore = await state();
  await trigger.click();
  assert.equal(await panel.evaluate(el => el.scrollHeight > el.clientHeight), true, "long content scrolls internally");
  await dialog.getByRole("button", { name: "닫기", exact: true }).focus();
  assert.ok(await panel.evaluate(el => el.scrollTop) > 0);
  await page.keyboard.press("Escape");
  assert.deepEqual(await state(), longBefore);

  // Make both the editor and document genuinely scrollable; native dialog alone
  // must not be assumed to lock either background scroll position.
  const surface = page.getByTestId("editor-canvas-surface");
  await page.evaluate(() => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const spacer = document.createElement('div'); spacer.id = 'scroll-fixture'; spacer.style.height = '3000px'; document.body.append(spacer);
    document.querySelector('[data-testid="editor-canvas-surface"]').scrollTop = 100;
    window.scrollTo(0, 100);
  });
  await trigger.focus();
  const beforeScroll = await page.evaluate(() => ({ window: window.scrollY, canvas: document.querySelector('[data-testid="editor-canvas-surface"]').scrollTop }));
  await trigger.press('Enter');
  await dialog.waitFor();
  await page.mouse.move(4, 500); await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(() => ({ window: window.scrollY, canvas: document.querySelector('[data-testid="editor-canvas-surface"]').scrollTop })), beforeScroll, 'backdrop wheel cannot move document or canvas');
  await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const bottom = await panel.evaluate(el => el.scrollTop);
  const panelBounds = await panel.boundingBox();
  await page.mouse.move(panelBounds.x + 10, panelBounds.y + 10); await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  assert.equal(await panel.evaluate(el => el.scrollTop), bottom, 'panel remains at bottom boundary');
  assert.deepEqual(await page.evaluate(() => ({ window: window.scrollY, canvas: document.querySelector('[data-testid="editor-canvas-surface"]').scrollTop })), beforeScroll, 'panel boundary does not chain to background');
  await page.mouse.wheel(0, -300); await page.waitForTimeout(200);
  assert.ok(await panel.evaluate(el => el.scrollTop) < bottom, 'panel still scrolls away from its boundary');
  // Browser-only nested overflow fixture: the current IR has no overflow field.
  // Exercise chaining from this inner scroller through the real modal panel.
  await panel.evaluate(el => {
    const nested = document.createElement('div'); nested.id = 'nested-scroll-fixture';
    nested.style.cssText = 'height:120px;overflow:auto;flex:none';
    const content = document.createElement('div'); content.style.height = '900px';
    nested.append(content); el.prepend(nested); el.scrollTop = 0;
  });
  const nested = page.locator('#nested-scroll-fixture');
  const nestedBounds = await nested.boundingBox();
  await page.mouse.move(nestedBounds.x + 15, nestedBounds.y + 15); await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
  assert.ok(await nested.evaluate(el => el.scrollTop) > 0, 'nested content consumes wheel inside its range');
  assert.equal(await panel.evaluate(el => el.scrollTop), 0);
  await nested.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
  assert.ok(await panel.evaluate(el => el.scrollTop) > 0, 'inner boundary transfers scrolling to modal panel');
  assert.deepEqual(await page.evaluate(() => ({ window: window.scrollY, canvas: document.querySelector('[data-testid="editor-canvas-surface"]').scrollTop })), beforeScroll, 'nested chain stays inside modal');
  // Remove the actual opening control while the dialog is open.
  await trigger.evaluate(el => el.remove());
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await surface.evaluate(el => document.activeElement === el), true, 'removed trigger falls back to stable editor surface');
  assert.deepEqual(await page.evaluate(() => ({ window: window.scrollY, canvas: document.querySelector('[data-testid="editor-canvas-surface"]').scrollTop })), beforeScroll, 'closing and focus restore preserve scroll positions');
  assert.deepEqual(await page.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow]), ['auto', 'auto']);
  assert.equal(await surface.evaluate(el => el.style.overflow), '', 'original canvas overflow style restored');
  await page.mouse.move(4, 500); await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => window.scrollY) > beforeScroll.window, 'document scrolling resumes after close');
  assert.deepEqual(await state(), longBefore);
  assert.deepEqual(errors, []);
  console.log("PASS canvas: markers/target navigation preserve document and Undo; modal host breakpoint, clamp, root sizing, backdrop, Tab/Escape/focus restoration, internal scroll; fixture only");
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
