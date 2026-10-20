// #441: 자연어 배경 확인창이 바뀌는 값을 보여 주고, 단색 한 겹 교체는 묻지 않고 적용한다.
// Fixture producer + real GUI/server. No model call.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-nl-background-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "NlBackground";
  await writeFile(join(workspace, "specs/background.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /NlBackground.*페이지/s }).click();
  await page.evaluate(async () => { window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore; });
  async function waitFile(name, predicate) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const data = JSON.parse(await readFile(join(workspace, "runtime", name), "utf8"));
        if (predicate(data)) return data;
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${name}`);
  }
  const input = page.getByRole("textbox", { name: "자연어 편집 요청" });
  const status = page.getByRole("region", { name: "자연어 편집" }).getByRole("status");
  const background = () => page.evaluate(() => editor.getState().spec.pages.login.nodes.loginButton.background);
  const seen = new Set();
  async function ask(instruction, value) {
    await input.fill(instruction);
    await input.press("Enter");
    const request = await waitFile("nl-request.json", data => Boolean(data.id) && !seen.has(data.id));
    seen.add(request.id);
    await writeFileAtomic(join(workspace, "runtime/nl-response.json"), JSON.stringify({ protocol: 2, commandVersion: "0.3", requestId: request.id,
      commands: [{ type: "updateNode", id: "loginButton", path: "background", value }] }));
  }
  const past = () => page.evaluate(() => editor.getState().history.past.length);
  const start = await past();

  // 단색 → 단색: 고객 B의 "버튼 색을 진한 파란색으로"는 확인 없이 바로 적용된다.
  await ask("버튼 색을 진한 파란색으로", [{ type: "solid", color: "#1E40AF" }]);
  await page.waitForFunction(() => editor.getState().spec.pages.login.nodes.loginButton.background[0].color === "#1E40AF");
  assert.equal(await page.getByRole("button", { name: "변경 적용" }).count(), 0);
  assert.equal(await past(), start + 1);

  // 단색 → 그라디언트: 겹 종류가 바뀌므로 묻되, 무엇이 무엇으로 바뀌는지 보여 준다.
  await ask("버튼을 그라디언트로", [{ type: "linear", angle: 90, stops: [{ color: "#4F46E5", at: 0 }, { color: "#1E40AF", at: 1 }] }]);
  await page.getByRole("button", { name: "변경 적용" }).waitFor();
  const text = await status.innerText();
  assert.match(text, /LoginButton 배경: 단색 #1E40AF → 선형 그라디언트 90° \(#4F46E5 0%, #1E40AF 100%\)/);
  assert.doesNotMatch(text, /겹/);
  assert.deepEqual(await background(), [{ type: "solid", color: "#1E40AF" }]);
  await page.getByRole("button", { name: "변경 적용" }).click();
  await page.waitForFunction(() => editor.getState().spec.pages.login.nodes.loginButton.background[0].type === "linear");
  assert.equal(await past(), start + 2);
  assert.deepEqual(errors, []);
  console.log("PASS NL background confirm: solid→solid applies without asking; solid→gradient shows before/after values in plain words, then applies as one Undo step. Fixture producer, no AI.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
