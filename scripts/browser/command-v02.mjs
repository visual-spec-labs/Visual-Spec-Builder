// Fixture producers + real GUI/server. No model call. S1-3 transport and Undo acceptance.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-command-v02-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "CommandV02";
  await writeFile(join(workspace, "specs/commands.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /CommandV02.*페이지/s }).click();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });
  const baseline = await page.evaluate(() => ({ spec: editor.getState().spec, past: editor.getState().history.past.length }));
  async function waitFile(name, predicate, arg) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const data = JSON.parse(await readFile(join(workspace, "runtime", name), "utf8"));
        if (predicate(data, arg)) return data;
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${name}`);
  }
  const state = await waitFile("gui-state.json", data => data.pageId === "login");
  assert.equal(state.protocol, 2); assert.equal(state.capabilities.commandVersion, "0.2");
  assert.ok(state.capabilities.commands.includes("removeNodeAction"));
  // New producer refuses an old/capability-less GUI before writing (skill fixture, not an AI run).
  const canProduce = data => data.protocol === 2 && data.capabilities?.commandVersion === "0.2"
    && data.capabilities.commands.includes("removeNodeAction");
  assert.equal(canProduce({ ...state, protocol: 1 }), false);
  assert.equal(canProduce({ ...state, capabilities: undefined }), false);
  assert.equal(canProduce(state), true);
  const commands = [{ type: "removeNodeAction", id: "loginButton" }];
  for (const [id, version] of [["old", { protocol: 1 }], ["missing-version", { protocol: 2 }]]) {
    await writeFileAtomic(join(workspace, "runtime/agent-edit.json"), JSON.stringify({ id, ...version, baseStateRevision: state.stateRevision, pageId: "login", commands }));
    const result = await waitFile("agent-edit-result.json", (data, id) => data.requestId === id, id);
    assert.equal(result.status, "invalid"); assert.equal(result.protocol, 2);
    assert.deepEqual(await page.evaluate(() => ({ spec: editor.getState().spec, past: editor.getState().history.past.length })), baseline);
  }
  await writeFileAtomic(join(workspace, "runtime/agent-edit.json"), JSON.stringify({ protocol: 2, commandVersion: "0.2", id: "new", baseStateRevision: state.stateRevision, pageId: "login", commands }));
  const result = await waitFile("agent-edit-result.json", data => data.requestId === "new");
  assert.equal(result.status, "applied");
  assert.equal(await page.evaluate(() => editor.getState().history.past.length), baseline.past + 1);
  assert.equal(await page.evaluate(() => Object.hasOwn(editor.getState().spec.pages.login.nodes.loginButton, "action")), false);
  await page.evaluate(() => editor.getState().undo());
  assert.deepEqual(await page.evaluate(() => editor.getState().spec), baseline.spec);
  await page.evaluate(() => editor.getState().redo());
  assert.equal(await page.evaluate(() => Object.hasOwn(editor.getState().spec.pages.login.nodes.loginButton, "action")), false);
  // A real NL request/response round trip through the UI, using a deterministic producer.
  await page.getByRole("textbox", { name: "자연어 편집 요청" }).fill("버튼의 이동을 복원해 줘");
  await page.getByRole("textbox", { name: "자연어 편집 요청" }).press("Enter");
  const nl = await waitFile("nl-request.json", data => Boolean(data.id));
  assert.equal(nl.protocol, 2); assert.equal(nl.commandVersion, "0.2");
  await writeFileAtomic(join(workspace, "runtime/nl-response.json"), JSON.stringify({ protocol: 2, commandVersion: "0.2", requestId: nl.id,
    commands: [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "navigate", target: "dashboard" } }] }));
  await page.waitForFunction(() => editor.getState().spec.pages.login.nodes.loginButton.action?.target === "dashboard");
  assert.equal(await page.evaluate(() => editor.getState().history.past.length), baseline.past + 2);
  // Real controlled TextField rejection must not consume the next Undo checkpoint.
  await page.evaluate(() => editor.getState().select(null));
  const beforeName = await page.evaluate(() => editor.getState().spec);
  const name = page.getByRole("textbox", { name: "이름", exact: true });
  await name.fill("");
  assert.deepEqual(await page.evaluate(() => editor.getState().spec), beforeName);
  await name.fill("Renamed");
  await name.blur();
  await page.evaluate(() => editor.getState().undo());
  assert.deepEqual(await page.evaluate(() => editor.getState().spec), beforeName);
  assert.deepEqual(errors, []);
  console.log("PASS Command v0.2: capabilities; old/missing-version direct requests rejected without mutation; new direct edit/Undo/Redo; NL protocol 2 round trip. Fixture producers, no AI.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
