// #442: 외부 에이전트 적용 알림이 자연어 "요청" 버튼을 가리지 않고, 마우스·포커스로 붙잡지 않으면 저절로 닫힌다.
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
  await page.evaluate(async () => { window.agentEdit = (await import("/src/features/editor/store/agentEditStore.ts")).useAgentEditStore; });
  let revision = (await waitFile("gui-state.json", data => data.pageId === "login")).stateRevision;
  // 편집·Undo 뒤에는 GUI가 새 상태 버전을 쓸 때까지 기다린다 — 옛 버전으로 보내면 낡은 요청으로 거절된다.
  async function nextRevision() {
    revision = (await waitFile("gui-state.json", data => data.pageId === "login" && data.stateRevision !== revision)).stateRevision;
  }
  async function applyEdit(id, commands) {
    await writeFileAtomic(join(workspace, "runtime/agent-edit.json"), JSON.stringify({ protocol: 2, commandVersion: "0.3", id,
      baseStateRevision: revision, pageId: "login", commands }));
    const result = await waitFile("agent-edit-result.json", data => data.requestId === id);
    assert.equal(result.status, "applied", result.message);
    await nextRevision();
    await page.waitForFunction(id => window.agentEdit.getState().notice?.requestId === id, id);
  }
  await applyEdit("direct", [{ type: "removeNodeAction", id: "loginButton" }]);

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
  await nextRevision();
  assert.equal(await page.evaluate(() => Object.hasOwn(editor.getState().spec.pages.login.nodes.loginButton, "action")), true);

  // 마우스와 포커스는 따로 붙잡는다. 9초(닫힘 시간 8초 + 여유)를 기다려도 남아 있어야 한다.
  const close = notice.getByRole("button", { name: "닫기" });
  const away = () => page.mouse.move(10, 450);
  const held = async (label) => { await page.waitForTimeout(9000); assert.equal(await notice.isVisible(), true, label); };
  const closes = () => notice.waitFor({ state: "hidden", timeout: 10000 });

  // 키보드 포커스만 — 마우스 없이도 닫히지 않고, 포커스가 나가면 닫힌다.
  await away();
  await applyEdit("focus-only", [{ type: "removeNodeAction", id: "forgotButton" }]);
  await close.focus();
  await held("focused notice closed");
  await input.focus();
  await closes();

  // 마우스+포커스에서 마우스만 떼도 포커스가 붙잡는다.
  await applyEdit("hover-focus-leave", [{ type: "removeNodeAction", id: "loginButton" }]);
  await notice.hover();
  await close.focus();
  await away();
  await held("notice closed on mouseleave while focus stayed inside");
  await input.focus();
  await closes();

  // 마우스+포커스에서 포커스만 밖으로 나가도 마우스가 붙잡는다.
  await applyEdit("hover-focus-blur", [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "navigate", target: "dashboard" } }]);
  await notice.hover();
  await close.focus();
  await input.focus();
  await held("notice closed on blur while pointer stayed inside");
  await away();
  await closes();

  // 포인터를 움직이지 않은 채 새 알림으로 바뀌어도 붙잡은 상태가 이어진다.
  await applyEdit("swap-a", [{ type: "updateNode", id: "forgotButton", path: "action", value: { type: "navigate", target: "dashboard" } }]);
  await notice.hover();
  await applyEdit("swap-b", [{ type: "updateNode", id: "loginButton", path: "action", value: { type: "openModal", target: "resetPassword" } }]);
  await held("replacement notice closed while pointer stayed inside");
  await away();
  await closes();

  // 확인 알림의 "적용"을 키보드로 누르면 그 버튼이 사라진다 — 브라우저는 이때 blur를 보내지 않으므로
  // 포커스가 이미 밖에 있는데 붙잡은 채로 남으면 안 된다(PR #450 리뷰).
  await writeFileAtomic(join(workspace, "runtime/agent-edit.json"), JSON.stringify({ protocol: 2, commandVersion: "0.3", id: "confirm-keyboard",
    baseStateRevision: revision, pageId: "login", commands: [{ type: "updateNode", id: "root", path: "background",
      value: [{ type: "linear", angle: 180, stops: [{ color: "#4F46E5", at: 0 }, { color: "#1E40AF", at: 1 }] }] }] }));
  assert.equal((await waitFile("agent-edit-result.json", data => data.requestId === "confirm-keyboard")).status, "pending");
  const confirm = page.getByRole("status").filter({ hasText: "외부 에이전트가 배경을 바꾸려 합니다" });
  await confirm.getByRole("button", { name: "적용", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal((await waitFile("agent-edit-result.json", data => data.requestId === "confirm-keyboard" && data.status !== "pending")).status, "applied");
  await notice.waitFor();
  await nextRevision();
  await input.focus();
  await closes();

  assert.deepEqual(errors, []);
  console.log("PASS agent notice layout: 1440x900 applied notice sits above the NL bar, 요청 stays clickable; hover and focus hold it independently (focus only, leave with focus, blur with hover, replaced under the pointer, confirm accepted by keyboard), otherwise auto-closes; Undo kept. Fixture producer, no AI.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
