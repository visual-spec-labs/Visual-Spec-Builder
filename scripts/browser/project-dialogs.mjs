// Live Chromium regression checks for #288/#332. Uses a disposable workspace.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/project-dialogs.mjs
// Playwright is an optional QA runner, not an application dependency.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startBrowserWorkspace } from "./harness.mjs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "vs-dialogs-"));
const specs = join(workspace, "specs");
await mkdir(specs);
const fixture = JSON.parse(await readFile(join(repo, "examples/dashboard-cards.json"), "utf8"));
for (const name of ["Alpha", "Beta"]) {
  await writeFile(join(specs, `${name}.json`), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name } }));
}
await writeFile(join(specs, "broken.json"), "{bad json");
let runner;
try {
  runner = await startBrowserWorkspace(workspace);
  const { newContext, url } = runner;
  const context = await newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  const notices = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { notices.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(url);
  await page.getByRole("button", { name: "Alpha 이름 변경" }).waitFor();
  const dialog = page.getByRole("alertdialog");
  const focusInside = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="alertdialog"]')));
  async function cycle() {
    for (const key of ["Tab", "Shift+Tab"]) for (let i = 0; i < 12; i++) {
      await page.keyboard.press(key);
      assert.equal(await focusInside(), true, `${key} escaped the dialog`);
    }
  }
  await page.getByRole("button", { name: "Alpha 이름 변경" }).click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Alpha 이름 변경");
  await page.keyboard.press("Enter");
  assert.equal(await dialog.getByRole("textbox").inputValue(), "Alpha");
  await cycle();
  assert.equal(await page.getByRole("button", { name: "+ 새 프로젝트", exact: true }).evaluate(button => Boolean(button.closest("[inert]"))), true);
  await dialog.getByRole("textbox").fill("Do not reuse");
  // Background is now inert, so exercise replacement through the same public
  // async entrypoint used by callers (a stale response may replace a prompt).
  await page.evaluate(async () => {
    const { promptText } = await import("/src/features/editor/store/promptDialogStore.ts");
    window.replacement = promptText({ title: "프로젝트 이름 변경", initialValue: "Beta" });
  });
  assert.equal(await dialog.getByRole("textbox").inputValue(), "Beta");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.replacement), null);
  assert.equal(await dialog.count(), 0);
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Alpha 이름 변경");
  await page.keyboard.press("Enter");
  assert.equal(await dialog.getByRole("textbox").inputValue(), "Alpha");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Alpha 이름 변경" }).count(), 1);
  console.log("PASS Rename focus cycle, inert background, replacement input, Escape, opener restoration and keyboard continuation");

  await page.getByRole("button").filter({ hasText: /Alpha.*페이지/s }).click();
  await page.getByRole("button", { name: "File", exact: true }).waitFor();
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.documentStore = (await import("/src/features/editor/store/documentStore.ts")).useDocumentStore;
    editor.getState().setPageField(editor.getState().activePageId, "name", "Unsaved marker");
    editor.getState().select("header");
  });
  const snapshot = () => page.evaluate(() => JSON.stringify({ spec: editor.getState().spec,
    selected: editor.getState().selectedId, history: editor.getState().history, file: documentStore.getState().fileName }));
  const before = await snapshot();
  async function menu(name) {
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
  for (const action of ["Open", "Save as", "Open", "Save as"]) {
    await menu(action);
    await dialog.waitFor();
    await cycle();
    if (action === "Open") {
      await page.keyboard.press("Delete");
      await page.keyboard.press("Control+z");
    }
    await page.keyboard.press("Escape");
    assert.equal(await snapshot(), before, `${action} altered document, selection or history`);
  }
  // A later caller cancels the interrupted Open/Save-as promise; resolving its
  // replacement must not resume the abandoned operation or change the draft.
  for (const action of ["Open", "Save as"]) {
    await page.evaluate(async action => {
      const { saveSpecAs } = await import("/src/features/editor/ui/exportSpecAsJson.ts");
      const { openSpec } = await import("/src/features/editor/ui/openSpecFromFile.ts");
      window.firstRequest = action === "Open" ? openSpec() : saveSpecAs(editor.getState().spec);
    }, action);
    await dialog.waitFor();
    await page.evaluate(async () => {
      const { promptText } = await import("/src/features/editor/store/promptDialogStore.ts");
      window.replacement = promptText({ title: "Replacement", initialValue: "Fresh value" });
    });
    await page.evaluate(() => window.firstRequest);
    assert.equal(await dialog.getByRole("textbox").inputValue(), "Fresh value");
    await page.keyboard.press("Escape");
    assert.equal(await snapshot(), before);
  }
  console.log("PASS interrupted Open/Save as resolve without changing the document");
  await menu("Save as");
  await dialog.getByRole("textbox").fill("취소할 이름");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(await snapshot(), before);
  await menu("Open");
  await dialog.getByRole("button", { name: "broken.json", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
  assert.equal(await snapshot(), before);
  assert.ok(notices.some(message => message.includes("broken.json")));
  console.log("PASS repeated Open/Save as cancellation, Delete/Undo isolation, corrupt selection, document/history preservation");

  await menu("Save as");
  await dialog.getByRole("textbox").fill("한글 사본");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => documentStore.getState().fileName === "한글 사본.json");
  const saved = JSON.parse(await readFile(join(specs, "한글 사본.json"), "utf8"));
  assert.equal(saved.pages[saved.pageOrder[0]].name, "Unsaved marker");
  assert.equal(await page.evaluate(() => editor.getState().selectedId), "header");
  await page.getByRole("button", { name: "홈으로" }).click();
  await page.getByRole("button", { name: "Alpha 이름 변경" }).first().click();
  await dialog.getByRole("textbox").fill("한글 이름 변경");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "한글 이름 변경 이름 변경" }).waitFor();
  assert.ok(JSON.parse(await readFile(join(specs, "한글 이름 변경.json"), "utf8")));
  console.log("PASS Save as and Rename Enter submit to real workspace");

  // Intentionally ignore AbortSignal on this one delayed response: the
  // generation guard must reject stale work even if cancellation loses a race.
  await page.evaluate(() => {
    const original = window.fetch;
    let first = true;
    window.fetch = async (...args) => {
      if (String(args[0]).includes("/file/specs/broken.json") && first) {
        first = false;
        const response = await original(args[0], { ...args[1], signal: undefined });
        window.delayedRead = true;
        await new Promise(resolve => { window.releaseRead = resolve; });
        return response;
      }
      return original(...args);
    };
  });
  await page.getByRole("button", { name: "다시 확인", exact: true }).click();
  await page.waitForFunction(() => window.delayedRead);
  await writeFile(join(specs, "broken.json"), JSON.stringify(fixture));
  await page.getByRole("button", { name: "다시 확인", exact: true }).click();
  await page.getByText("프로젝트 4개", { exact: true }).waitFor();
  await page.evaluate(() => window.releaseRead());
  await page.waitForTimeout(200);
  assert.equal(await page.getByText("프로젝트 4개", { exact: true }).count(), 1);
  assert.equal(await page.getByText(/손상된 파일/).count(), 0);
  // A real second-tab storage event must hand the whole modal session to the
  // save-conflict dialog, not autofocus invisible controls behind Save as.
  await page.getByRole("button").filter({ hasText: /Beta.*페이지/s }).click();
  await page.getByRole("button", { name: "File", exact: true }).waitFor();
  await page.evaluate(() => {
    editor.getState().setPageField(editor.getState().activePageId, "name", "Keep conflict draft");
    editor.getState().select("header");
  });
  const beforeConflict = await snapshot();
  const changed = await page.evaluate(async () => {
    const { projectStorageKey, serializeStoredDocument } = await import("/src/features/editor/store/specStorage.ts");
    const spec = structuredClone(editor.getState().spec);
    spec.name = "Other tab edit";
    return { key: projectStorageKey(documentStore.getState().fileName, ""),
      raw: serializeStoredDocument({spec, fileName: documentStore.getState().fileName,
        diskRevision: documentStore.getState().diskRevision}) };
  });
  await page.evaluate(async () => {
    const { saveSpecAs } = await import("/src/features/editor/ui/exportSpecAsJson.ts");
    window.conflictPrompt = saveSpecAs(editor.getState().spec);
  });
  await dialog.getByRole("textbox").fill("Never write this");
  const other = await context.newPage();
  // A same-origin blank document avoids mounting another editor/autosave.
  await other.route("**/storage-event-source", route => route.fulfill({contentType: "text/html", body: "<title>Second tab</title>"}));
  await other.goto(`${url}storage-event-source`);
  await other.evaluate(({key, raw}) => localStorage.setItem(key, raw), changed);
  await page.waitForFunction(async () => (await import("/src/features/editor/store/saveConflictStore.ts")).useSaveConflictStore.getState().paused);
  assert.equal(await page.evaluate(() => window.conflictPrompt), null);
  assert.equal(await dialog.count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[role="alertdialog"]')?.getAttribute("aria-labelledby")), "save-conflict-title");
  assert.equal(await snapshot(), beforeConflict);
  await dialog.getByRole("button", {name: "취소 — 내 작업 유지"}).click();
  assert.equal(await snapshot(), beforeConflict);
  assert.equal(await page.evaluate(async () => (await import("/src/features/editor/store/saveConflictStore.ts")).useSaveConflictStore.getState().paused), true);
  await other.close();
  console.log("PASS second-tab conflict cancels pending Save as, owns visible focus, and preserves paused draft/history");
  assert.deepEqual(errors, []);
  console.log("PASS delayed Retry cannot overwrite newer repaired-file result; no page errors");
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
