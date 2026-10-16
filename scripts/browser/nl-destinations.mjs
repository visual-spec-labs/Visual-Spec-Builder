// S1-10 real controls and persistence; fixture project, no model call.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-nl-catalog-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "CatalogFlow";
  project.pages.otherDashboard = structuredClone(project.pages.dashboard);
  project.pageOrder.push("otherDashboard");
  await writeFile(join(workspace, "specs/flow.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /CatalogFlow.*페이지/s }).click();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });
  const state = () => page.evaluate(() => ({ spec: editor.getState().spec, history: editor.getState().history }));
  await page.getByRole("button", { name: "LoginButton", exact: true }).click();
  const prompt = page.getByRole("textbox", { name: "자연어 편집 요청", exact: true });
  let previousId;
  async function request(instruction) {
    await prompt.fill(instruction); await prompt.press("Enter");
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const data = JSON.parse(await readFile(join(workspace, "runtime/nl-request.json"), "utf8"));
        if (data.id !== previousId) { previousId = data.id; return data; }
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error("NL request not written");
  }
  async function respond(req, payload) {
    await writeFileAtomic(join(workspace, "runtime/nl-response.json"), JSON.stringify({ protocol: req.protocol, commandVersion: req.commandVersion, requestId: req.id, ...payload }));
  }
  const before = await state();
  const ambiguous = await request("LoginButton을 DashboardPage로 연결해 줘");
  assert.equal(ambiguous.protocol, 2); assert.equal(ambiguous.commandVersion, "0.2");
  assert.equal(ambiguous.pageId, "login"); assert.equal(ambiguous.scope.nodeId, "loginButton");
  assert.equal(ambiguous.destinations.length, 5);
  for (const item of ambiguous.destinations) assert.deepEqual(Object.keys(item).sort(), ["kind", "name", "pageId"]);
  const matches = ambiguous.destinations.filter(item => item.name === "DashboardPage" && item.kind === "page");
  assert.deepEqual(matches.map(item => item.pageId), ["dashboard", "otherDashboard"]);
  // Deterministic skill-policy fixture: ambiguous names produce an error, never first-match guessing.
  await respond(ambiguous, { error: "DashboardPage가 중복됩니다. dashboard / otherDashboard 중 PageId를 지정하세요." });
  await page.getByText(/DashboardPage가 중복됩니다/).waitFor();
  assert.deepEqual(await state(), before);
  const modal = await request("LoginButton은 resetPassword 모달을 열어 줘");
  assert.equal(modal.destinations.find(item => item.pageId === "resetPassword").kind, "modal");
  await respond(modal, { commands: [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "openModal", target: "resetPassword" } }] });
  await page.waitForFunction(() => editor.getState().spec.pages.login.nodes.loginButton.action?.type === "openModal");
  for (const id of before.spec.pageOrder.filter(id => id !== "login")) assert.deepEqual((await state()).spec.pages[id], before.spec.pages[id]);
  // Legacy protocol-2 producer shape: reads old fields and emits no catalog/extra response metadata.
  const legacy = await request("현재 화면 이름을 NL Renamed로 바꿔 줘");
  await respond(legacy, { commands: [{ type: "updateScreen", path: "name", value: "NL Renamed" }] });
  await page.waitForFunction(() => editor.getState().spec.pages.login.name === "NL Renamed");
  const stale = await request("LoginButton을 dashboard로 이동하게 해 줘");
  await page.evaluate(() => editor.getState().setPageField("dashboard", "kind", "widget"));
  const changed = await state();
  assert.equal(changed.spec.pages.dashboard.kind, "widget");
  await respond(stale, { commands: [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "navigate", target: "dashboard" } }] });
  await page.getByText("문서나 화면이 바뀌었습니다. 변경된 상태에서 다시 요청하세요.", { exact: true }).waitFor();
  assert.deepEqual(await state(), changed);
  const expected = changed.spec;
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && r.url().includes("specs/flow.json"));
  const notice = new Promise(resolve => page.once("dialog", async d => { await d.accept(); resolve(); }));
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장", exact: true }).click();
  assert.equal((await saved).ok(), true); await notice;
  assert.deepEqual(JSON.parse(await readFile(join(workspace, "specs/flow.json"), "utf8")), expected);
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("menuitem", { name: "열기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "flow.json", exact: true }).click();
  assert.deepEqual((await state()).spec, expected);
  await page.reload();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });
  assert.deepEqual((await state()).spec, expected);
  assert.deepEqual(errors, []);
  console.log("PASS S1-10: actual NL request catalog metadata; duplicate-name clarification fixture; active-page-only action; legacy protocol-2 response; stale-target edit rejected; Save/Open/reload. Fixture producer, no AI.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
