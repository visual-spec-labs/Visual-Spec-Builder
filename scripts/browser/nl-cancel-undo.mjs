// #448 B-6·B-11: 자연어 취소는 무엇이 됐는지 남기고, 자연어 되돌리기는 고른 노드를 그대로 둔다.
// Fixture producer + real GUI/server. No model call.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-nl-cancel-undo-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "NlCancelUndo";
  await writeFile(join(workspace, "specs/cancel-undo.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /NlCancelUndo.*페이지/s }).click();
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
  async function send(instruction) {
    await input.fill(instruction);
    await input.press("Enter");
    const request = await waitFile("nl-request.json", data => Boolean(data.id) && !seen.has(data.id));
    seen.add(request.id);
    return request;
  }
  async function respond(request, value) {
    await writeFileAtomic(join(workspace, "runtime/nl-response.json"), JSON.stringify({ protocol: 2, commandVersion: "0.3", requestId: request.id,
      commands: [{ type: "updateNode", id: "loginButton", path: "background", value }] }));
  }
  const original = await background();

  // B-6 대기 중 취소: 상태 줄이 비지 않고, 에이전트는 계속 돌 수 있다고 알린다. 늦은 응답은 버린다.
  const late = await send("버튼 색을 빨간색으로");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await status.getByText("요청을 취소했습니다").waitFor();
  assert.match(await status.innerText(), /에이전트는 계속 작업할 수 있으니 필요하면 에이전트 쪽에서 멈추세요/);
  await respond(late, [{ type: "solid", color: "#DC2626" }]);
  await page.waitForTimeout(2500);
  assert.deepEqual(await background(), original);
  assert.match(await status.innerText(), /요청을 취소했습니다/);

  // B-6 배경 확인에서 적용 취소: 적용하지 않았다고 남긴다.
  await respond(await send("버튼을 그라디언트로"), [{ type: "linear", angle: 90, stops: [{ color: "#4F46E5", at: 0 }, { color: "#1E40AF", at: 1 }] }]);
  await page.getByRole("button", { name: "적용 취소" }).click();
  await status.getByText("배경 변경을 적용하지 않았습니다").waitFor();
  assert.doesNotMatch(await status.innerText(), /에이전트/);
  assert.deepEqual(await background(), original);

  // B-11 고른 노드에 자연어 편집 → 결과 줄의 되돌리기: 값은 돌아가고 선택은 남는다.
  await page.evaluate(() => editor.getState().select("loginButton"));
  await respond(await send("버튼 색을 진한 파란색으로"), [{ type: "solid", color: "#1E40AF" }]);
  await page.waitForFunction(() => editor.getState().spec.pages.login.nodes.loginButton.background[0].color === "#1E40AF");
  await status.getByRole("button", { name: "되돌리기" }).click();
  await page.waitForFunction(() => editor.getState().spec.pages.login.nodes.loginButton.background[0].color !== "#1E40AF");
  assert.deepEqual(await background(), original);
  assert.equal(await page.evaluate(() => editor.getState().selectedId), "loginButton");
  assert.deepEqual(errors, []);
  console.log("PASS NL cancel/undo: waiting cancel and confirm cancel leave a status line (late response ignored); NL undo restores the value and keeps the selected node. Fixture producer, no AI.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
