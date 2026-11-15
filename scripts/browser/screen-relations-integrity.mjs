// S1-4 actual Chromium/UI with deterministic fixtures, never a model call.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-relations-integrity-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const fixture = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  fixture.name = "IntegrityFlow";
  fixture.pages.resetPassword.nodes.closeButton.action = { type: "navigate", target: "dashboard" };
  await writeFile(join(workspace, "specs/flow.json"), JSON.stringify(fixture));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /IntegrityFlow.*페이지/s }).click();
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.confirmRemoval = (await import("/src/features/editor/ui/confirmPageRemoval.ts")).confirmPageRemoval;
    window.validate = (await import("/src/features/editor/schema/index.ts")).validateProjectSpec;
    window.observed = [];
    window.stopObserving = editor.subscribe((state, previous) => { if (state.spec !== previous.spec) observed.push(validate(state.spec).valid); });
  });
  const state = () => page.evaluate(() => ({ spec: editor.getState().spec, selectedId: editor.getState().selectedId,
    activePageId: editor.getState().activePageId, history: editor.getState().history }));
  const original = await state();
  const deletion = () => page.getByRole("button", { name: "DashboardPage, 화면 종류: page", exact: true }).locator("..").getByRole("button", { name: "페이지 삭제", exact: true });
  async function deleteWithAnswer(accept) {
    const handled = new Promise((resolve, reject) => page.once("dialog", async dialog => {
      try {
        assert.match(dialog.message(), /연결 2개/);
        assert.match(dialog.message(), /LoginButton \(loginButton\)/);
        assert.match(dialog.message(), /CloseButton \(closeButton\)/);
        if (accept) await dialog.accept(); else await dialog.dismiss();
        resolve();
      } catch (error) { reject(error); }
    }));
    await deletion().click(); await handled;
  }
  await deleteWithAnswer(false);
  assert.deepEqual(await state(), original, "cancellation preserves document, selection and history");
  await deleteWithAnswer(true);
  await page.waitForFunction(() => !editor.getState().spec.pages.dashboard);
  const deleted = await state();
  assert.equal(deleted.history.past.length, 1);
  assert.equal(deleted.spec.pages.login.nodes.loginButton.action, undefined);
  assert.equal(deleted.spec.pages.resetPassword.nodes.closeButton.action, undefined);
  assert.deepEqual(await page.evaluate(() => observed), [true], "subscribers see only a valid final project");
  await page.getByRole("button", { name: "되돌리기", exact: true }).click();
  assert.deepEqual((await state()).spec, original.spec);
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  assert.deepEqual((await state()).spec, deleted.spec);
  // Actual workspace Save and Open, followed by reload restoration.
  const saved = page.waitForResponse(response => response.request().method() === "PUT" && response.url().includes("specs/flow.json"));
  const notice = new Promise((resolve, reject) => page.once("dialog", async dialog => {
    try { assert.match(dialog.message(), /저장했습니다/); await dialog.accept(); resolve(); } catch (error) { reject(error); }
  }));
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장", exact: true }).click();
  assert.equal((await saved).ok(), true); await notice;
  assert.deepEqual(JSON.parse(await readFile(join(workspace, "specs/flow.json"), "utf8")), deleted.spec);
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("menuitem", { name: "열기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "flow.json", exact: true }).click();
  assert.deepEqual((await state()).spec, deleted.spec);
  await page.reload();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });
  assert.deepEqual(await page.evaluate(() => editor.getState().spec), deleted.spec);
  // Deferred dialog fixture executes the real confirmation lifecycle with live store mutations.
  await page.evaluate(async ({ original }) => {
    window.confirmRemoval = (await import("/src/features/editor/ui/confirmPageRemoval.ts")).confirmPageRemoval;
    for (const change of ["document", "incoming", "undo"]) {
      editor.getState().loadSpec(structuredClone(original));
      let answer;
      const messages = [];
      const pending = confirmRemoval("dashboard", () => new Promise(resolve => { answer = resolve; }), message => messages.push(message));
      if (change === "document") {
        const other = structuredClone(original); other.projectId = crypto.randomUUID(); editor.getState().loadSpec(other);
      } else if (change === "incoming") {
        editor.getState().setNodeField("forgotButton", "action", { type: "navigate", target: "dashboard" });
      } else { editor.getState().setPageField("login", "name", "Edited"); editor.getState().undo(); }
      const current = editor.getState(); answer(true);
      if (await pending || editor.getState() !== current || messages.length !== 1) throw Error(`stale ${change} confirmation mutated current state`);
    }
  }, { original: original.spec });
  assert.deepEqual(errors, []);
  console.log("PASS S1-4: UI cancel/impact list/atomic cleanup/one Undo+Redo; Save/Open/reload; deferred stale-document/inbound-change/edit→Undo rejection preserves current work. Fixture only.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
