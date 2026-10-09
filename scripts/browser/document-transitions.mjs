// Live Chromium regression checks for #302. Uses a disposable workspace.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/document-transitions.mjs
// Playwright is an optional QA runner, not an application dependency.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const repo = fileURLToPath(new URL("../../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "vs-dialogs-"));
const specs = join(workspace, "specs");
await mkdir(specs);
const fixture = JSON.parse(await readFile(join(repo, "examples/dashboard-cards.json"), "utf8"));
for (const name of ["Alpha", "Beta"]) {
  await writeFile(join(specs, `${name}.json`), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name } }));
}
await writeFile(join(specs, "broken.json"), "{bad json");
const server = spawn(process.execPath, [join(repo, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "0"], {
  cwd: repo, env: { ...process.env, VISUAL_SPEC_WORKSPACE: workspace }, stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Vite startup timed out: ${output}`)), 15000);
    server.once("exit", code => { clearTimeout(timer); reject(new Error(`Vite exited ${code}: ${output}`)); });
    server.stderr.on("data", chunk => { output += chunk; });
    server.stdout.on("data", chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
  const context = await browser.newContext();
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
  await page.getByRole("button", { name: "+ 새 프로젝트", exact: true }).click();
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.documentStore = (await import("/src/features/editor/store/documentStore.ts")).useDocumentStore;
    window.prompts = (await import("/src/features/editor/store/promptDialogStore.ts")).usePromptDialogStore;
    window.newSpec = (await import("/src/features/editor/ui/newSpec.ts")).newSpec;
    editor.getState().setPageField(editor.getState().activePageId, "name", "Untitled draft");
    editor.getState().select("root");
  });
  const snapshot = () => page.evaluate(() => JSON.stringify({ spec: editor.getState().spec,
    selected: editor.getState().selectedId, history: editor.getState().history, file: documentStore.getState().fileName }));
  const before = await snapshot();
  async function menu(name) {
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
  for (let i = 0; i < 2; i++) {
    await menu("New");
    await dialog.getByText("현재 문서를 떠나시겠습니까?").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "취소");
    await cycle();
    await page.keyboard.press("Delete");
    await page.keyboard.press("Control+z");
    const ticks = await page.evaluate(() => new Promise(resolve => setTimeout(() => resolve(42), 30)));
    assert.equal(ticks, 42);
    await page.screenshot({ path: join(workspace, "transition.png") });
    await page.keyboard.press("Escape");
    assert.equal(await snapshot(), before);
  }
  await menu("Open");
  await dialog.getByRole("button", {name: "Alpha.json", exact: true}).click();
  await dialog.getByText("현재 문서를 떠나시겠습니까?").waitFor();
  await dialog.getByRole("button", {name: "취소", exact: true}).click();
  assert.equal(await snapshot(), before);
  await page.getByRole("button", {name: "홈으로"}).click();
  await page.getByRole("button").filter({hasText: /Alpha.*페이지/s}).click();
  await dialog.getByText("현재 문서를 떠나시겠습니까?").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await snapshot(), before);
  console.log("PASS New/Open/card cancellation preserves untitled document, history and selection; Tab/Shift+Tab, Escape, shortcuts, timers and screenshot remain responsive");

  await page.evaluate(() => { window.first = newSpec(); });
  await dialog.waitFor();
  await page.evaluate(() => {
    window.oldId = prompts.getState().state.requestId;
    window.second = newSpec();
  });
  await page.waitForFunction(() => prompts.getState().state.requestId !== window.oldId);
  assert.equal(await page.evaluate(() => window.first), false);
  await page.evaluate(() => prompts.getState().resolve("confirm", window.oldId));
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.second), false);
  assert.equal(await snapshot(), before);
  console.log("PASS replacement cancels previous request and ignores old approval");

  await page.evaluate(() => { window.pending = newSpec(); });
  await dialog.waitFor();
  const changed = await page.evaluate(async () => {
    const {readRecovery, serializeStoredDocument} = await import("/src/features/editor/store/specStorage.ts");
    const recovery = readRecovery();
    return {key: recovery.key, raw: serializeStoredDocument({...recovery.document,
      spec: {...recovery.document.spec, name: "Other tab draft"}})};
  });
  const other = await context.newPage();
  await other.route("**/storage-event-source", route => route.fulfill({contentType: "text/html", body: "<title>Second tab</title>"}));
  await other.goto(`${url}storage-event-source`);
  await other.evaluate(({key, raw}) => localStorage.setItem(key, raw), changed);
  assert.equal(await page.evaluate(() => window.pending), false);
  await dialog.getByText("다른 탭에서 이 프로젝트를 변경했습니다").waitFor();
  assert.equal(await snapshot(), before);
  assert.equal(await other.evaluate(key => localStorage.getItem(key), changed.key), changed.raw);
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[role="alertdialog"]')?.getAttribute("aria-labelledby")), "save-conflict-title");
  await other.close();
  console.log("PASS real second-tab storage conflict cancels confirmation, preserves both drafts and hands off focus");

  const clean = await browser.newContext();
  const accepted = await clean.newPage();
  accepted.on("dialog", async d => { notices.push(d.message()); await d.dismiss(); });
  await accepted.goto(url);
  await accepted.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await accepted.evaluate(async () => {
    const {useEditorStore: e} = await import("/src/features/editor/store/editorStore.ts");
    e.getState().setPageField(e.getState().activePageId, "name", "Accept draft");
    const {newSpec} = await import("/src/features/editor/ui/newSpec.ts");
    window.result = newSpec();
  });
  await accepted.getByRole("button", {name: "계속하기", exact: true}).click();
  assert.equal(await accepted.evaluate(() => window.result), true);
  assert.equal(await accepted.getByRole("alertdialog").count(), 0);
  await clean.close();
  assert.deepEqual(notices, []);
  assert.deepEqual(errors, []);
  console.log("PASS explicit approval transitions; zero native dialogs or page errors");
} finally {
  await browser?.close();
  server.kill();
  await rm(workspace, { recursive: true, force: true });
}
