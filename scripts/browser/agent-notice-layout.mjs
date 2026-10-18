// #442: 외부 에이전트 적용 알림이 자연어 "요청" 버튼을 가리지 않고, 붙잡지 않으면 저절로 닫힌다.
// Fixture producer + real GUI/server. No model call.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-agent-notice-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "AgentNotice";
  await writeFile(join(workspace, "specs/notice.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  // 고객 테스트(#431 B)에서 겹침을 본 창 크기.
  const context = await runner.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /AgentNotice.*페이지/s }).click();
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
  const state = await waitFile("gui-state.json", data => data.pageId === "login");
  await writeFileAtomic(join(workspace, "runtime/agent-edit.json"), JSON.stringify({ protocol: 2, commandVersion: "0.3", id: "direct",
    baseStateRevision: state.stateRevision, pageId: "login", commands: [{ type: "removeNodeAction", id: "loginButton" }] }));
  assert.equal((await waitFile("agent-edit-result.json", data => data.requestId === "direct")).status, "applied");

  const notice = page.getByRole("status").filter({ hasText: "외부 에이전트가 편집을 적용했습니다" });
  await notice.waitFor();
  const submit = page.getByRole("button", { name: "요청", exact: true });
  const input = page.getByRole("textbox", { name: "자연어 편집 요청" });
  const bar = page.getByRole("region", { name: "자연어 편집" });
  const [noticeBox, submitBox, barBox] = [await notice.boundingBox(), await submit.boundingBox(), await bar.boundingBox()];
  assert.ok(noticeBox.y + noticeBox.height <= barBox.y, `notice ${JSON.stringify(noticeBox)} overlaps NL bar ${JSON.stringify(barBox)}`);
  assert.ok(noticeBox.y + noticeBox.height <= submitBox.y, "notice overlaps the 요청 button");

  // 알림을 닫지 않고 실제 클릭으로 다음 요청을 보낸다 — 가려져 있으면 Playwright 클릭이 실패한다.
  await input.fill("제목을 크게 해줘");
  await submit.click();
  assert.equal((await waitFile("nl-request.json", data => data.instruction === "제목을 크게 해줘")).scope.kind, "screen");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(await notice.isVisible(), true);

  // 마우스를 올려 둔 동안은 닫히지 않고(되돌리기를 누르려는 중), 떼면 저절로 닫힌다.
  await notice.hover();
  await page.waitForTimeout(9000);
  assert.equal(await notice.isVisible(), true, "hovered notice closed");
  await page.mouse.move(10, 450);
  await notice.waitFor({ state: "hidden", timeout: 10000 });
  // 자동으로 닫혀도 Undo 한 단계는 그대로다.
  await page.evaluate(() => editor.getState().undo());
  assert.equal(await page.evaluate(() => Object.hasOwn(editor.getState().spec.pages.login.nodes.loginButton, "action")), true);
  assert.deepEqual(errors, []);
  console.log("PASS agent notice layout: 1440x900 applied notice sits above the NL bar, 요청 stays clickable, hover holds it, otherwise auto-closes; Undo kept. Fixture producer, no AI.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
