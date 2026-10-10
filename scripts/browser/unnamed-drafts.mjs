// Live Chromium regression checks for #319. Uses a disposable workspace.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/unnamed-drafts.mjs
// Playwright is an optional QA runner, not an application dependency.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkBulkRegression } from "./unnamed-drafts-bulk.mjs";
import { startBrowserWorkspace } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-unnamed-"));
const specs = join(workspace, "specs");
await mkdir(specs);
let runner;
try {
  runner = await startBrowserWorkspace(workspace);
  const { newContext, url } = runner;
  const context = await newContext();
  const agentRequests = [];
  context.on("request", request => {
    if (request.method() === "PUT" && /\/runtime\/(nl-request|ticket-request)\.json/.test(request.url())) agentRequests.push(request.url());
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  const notices = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { notices.push(dialog.message()); await dialog.accept(); });
  await page.goto(url);
  await page.getByRole("button", { name: "빈 캔버스에서 시작" }).waitFor();
  const status = target => target.locator('[role="status"][aria-label="저장 상태"]');
  const waitStatus = async (target, text) => { await status(target).filter({ hasText: text }).waitFor(); };
  async function state(target = page) {
    return target.evaluate(async () => {
      const { useEditorStore: editor } = await import("/src/features/editor/store/editorStore.ts");
      const { useDocumentStore: document } = await import("/src/features/editor/store/documentStore.ts");
      const { readRecovery } = await import("/src/features/editor/store/specStorage.ts");
      return { key: readRecovery()?.key, spec: editor.getState().spec, file: document.getState().fileName };
    });
  }
  async function edit(name, target = page) {
    await target.evaluate(async name => {
      const { useEditorStore: editor } = await import("/src/features/editor/store/editorStore.ts");
      editor.getState().setPageField(editor.getState().activePageId, "name", name);
    }, name);
    await target.waitForTimeout(650);
  }
  const drafts = page.getByRole("region", { name: "보관한 초안" });
  await page.getByRole("button", { name: "빈 캔버스에서 시작" }).click();
  await page.getByRole("button", {name: "파일", exact: true}).waitFor();
  await edit("Fixture draft A");
  const original = await state();
  await waitStatus(page, "파일 미저장 · 브라우저 초안 보관됨");
  await page.getByRole("button", { name: "홈으로" }).click();
  await drafts.getByRole("button", { name: "이어서 열기" }).click();
  await page.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(), original);
  await page.getByRole("button", { name: "홈으로" }).click();
  await page.reload();
  await drafts.getByRole("button", { name: "이어서 열기" }).waitFor();
  assert.deepEqual(await state(), original);
  await drafts.getByRole("button", { name: "이어서 열기" }).click();
  await page.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(), original);
  await waitStatus(page, "파일 미저장 · 브라우저 초안 보관됨");
  console.log("PASS empty workspace Home/Resume/reload", original.key, createHash("sha256").update(JSON.stringify(original.spec)).digest("hex"));

  // A real opener copies sessionStorage; the new tab must use an independent UUID.
  const popupPromise = context.waitForEvent("page");
  await page.evaluate(url => window.open(url), url);
  const other = await popupPromise;
  other.on("pageerror", error => errors.push(error.message));
  await other.getByRole("region", { name: "보관한 초안" }).waitFor();
  assert.notEqual((await state(other)).key, original.key);
  assert.deepEqual((await state(other)).spec, original.spec);
  const otherOriginal = other.getByRole("listitem").filter({hasText: original.key.split(":").pop()});
  await otherOriginal.getByRole("button", { name: "이어서 열기" }).click();
  await other.getByText(/다른 탭에서 사용 중인 초안/).waitFor();
  await otherOriginal.getByRole("button", { name: "삭제…" }).click();
  await other.getByRole("alertdialog").getByRole("button", { name: "초안 삭제", exact: true }).click();
  await other.getByText(/다른 탭에서 사용 중인 초안/).waitFor();
  assert.deepEqual(await state(), original);
  assert.equal(await page.evaluate(key => localStorage.getItem(key) !== null, original.key), true);
  console.log("PASS opener identity isolation; active other-tab Resume/delete refusal");
  await other.close();

  // Browser history navigation: leaving and returning is a full document restore.
  await page.goto("about:blank");
  await page.goBack();
  await drafts.getByRole("button", { name: "이어서 열기" }).waitFor();
  assert.deepEqual(await state(), original);
  await page.goForward();
  await page.goBack();
  await drafts.getByRole("button", { name: "이어서 열기" }).waitFor();
  assert.deepEqual(await state(), original);
  console.log("PASS browser Back/Forward UUID/content");

  // Deletion is separately confirmed and cancellation retains bytes and UUID.
  await drafts.getByRole("button", { name: "삭제…", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "취소", exact: true }).click();
  assert.deepEqual(await state(), original);
  await drafts.getByRole("button", { name: "이어서 열기" }).click();
  await page.getByRole("button", {name: "파일", exact: true}).waitFor();
  await page.evaluate(async () => {
    const { saveSpecAs } = await import("/src/features/editor/ui/exportSpecAsJson.ts");
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    window.pendingSave = saveSpecAs(useEditorStore.getState().spec);
  });
  await page.getByRole("alertdialog").getByRole("button", { name: "취소", exact: true }).click();
  assert.deepEqual(await state(), original);
  // Fail only this fixture's PUT; failure must preserve the unnamed identity.
  await page.route("**/file/specs/*", async route => {
    if (route.request().method() === "PUT") await route.fulfill({ status: 507, contentType: "application/json", body: JSON.stringify({error:"fixture disk full"}) });
    else await route.continue();
  });
  async function saveAs(name) {
    await page.evaluate(async () => {
      const { saveSpecAs } = await import("/src/features/editor/ui/exportSpecAsJson.ts");
      const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
      window.pendingSave = saveSpecAs(useEditorStore.getState().spec);
    });
    await page.getByRole("alertdialog").getByRole("textbox").fill(name);
    await page.getByRole("alertdialog").getByRole("button", { name: "저장", exact: true }).click();
    await page.evaluate(() => window.pendingSave);
  }
  await saveAs("Fixture saved");
  await waitStatus(page, "파일 저장 실패");
  assert.deepEqual(await state(), original);
  await page.unroute("**/file/specs/*");
  await saveAs("Fixture saved");
  await page.waitForTimeout(650);
  assert.equal((await state()).file, "Fixture saved.json");
  await waitStatus(page, "파일 저장됨");
  assert.deepEqual(JSON.parse(await readFile(join(specs, "Fixture saved.json"), "utf8")), original.spec);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), original.key), null);
  await page.getByRole("button", { name: "홈으로" }).click();
  await page.getByRole("button").filter({ hasText: /Untitled.*페이지/s }).click();
  assert.deepEqual((await state()).spec, original.spec);
  console.log("PASS Save as cancel/failure retain draft; successful real Save retires UUID and reopens exact content");
  async function newFromEditor() {
    await page.getByRole("button", {name: "파일", exact: true}).click();
    await page.getByRole("menuitem", {name: "새로 만들기", exact: true}).click();
  }
  await newFromEditor(); // named, unedited control: no transition warning
  await edit("Fixture draft B");
  const second = await state();
  await page.getByRole("button", {name: "홈으로"}).click();
  await page.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await page.getByRole("alertdialog").getByRole("button", {name: "취소", exact: true}).click();
  assert.deepEqual(await state(), second);
  await page.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await page.getByRole("alertdialog").getByRole("button", {name: "초안 보관 후 이동", exact: true}).click();
  assert.notEqual((await state()).key, second.key);
  await page.getByRole("button", {name: "홈으로"}).click();
  await drafts.getByRole("button", {name: "이어서 열기"}).click();
  await page.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(), second);
  await page.getByRole("button", {name: "홈으로"}).click();
  await drafts.getByRole("button", {name: "삭제…", exact: true}).click();
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "취소");
  await page.getByRole("alertdialog").getByRole("button", {name: "초안 삭제", exact: true}).click();
  await page.waitForFunction(key => localStorage.getItem(key) === null, second.key);
  await page.reload();
  await page.getByRole("button", {name: "+ 새 프로젝트", exact: true}).waitFor();
  assert.notEqual((await state()).key, second.key);
  assert.equal(await drafts.count(), 0);
  assert.deepEqual(JSON.parse(await readFile(join(specs, "Fixture saved.json"), "utf8")), original.spec);
  console.log("PASS existing workspace Cancel/keep/New/archive Resume; confirmed deletion stays deleted after reload and preserves disk");

  await page.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await edit("Fixture race C");
  const race = await state();
  await newFromEditor();
  await page.getByRole("alertdialog").getByRole("button", {name: "초안 보관 후 이동", exact: true}).click();
  await page.getByRole("button", {name: "홈으로"}).click();
  await page.waitForTimeout(650); // pristine blank is the independent startup snapshot
  const contender = await context.newPage();
  contender.on("pageerror", error => errors.push(error.message));
  await contender.goto(url);
  await contender.getByRole("region", {name: "보관한 초안"}).waitFor();
  const resume = target => target.evaluate(async key => {
    const { listUnnamedDrafts, useUnnamedDraftStore } = await import("/src/features/editor/store/unnamedDraftStore.ts");
    return useUnnamedDraftStore.getState().resume(listUnnamedDrafts().find(item => item.key === key));
  }, race.key);
  const results = await Promise.all([resume(page), resume(contender)]);
  assert.deepEqual([...results].sort(), ["busy", "ok"]);
  const winner = results[0] === "ok" ? page : contender;
  const loser = winner === page ? contender : page;
  assert.deepEqual(await state(winner), race);
  await winner.close();
  await loser.getByRole("region", {name: "보관한 초안"}).getByRole("button", {name: "이어서 열기"}).click();
  await loser.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(loser), race);
  await edit("After ownership transfer", loser);
  const afterTransfer = await state(loser);
  assert.equal(afterTransfer.key, race.key);
  await loser.reload();
  await loser.getByRole("region", {name: "보관한 초안"}).waitFor();
  assert.deepEqual(await state(loser), afterTransfer);
  assert.deepEqual(agentRequests, []);
  console.log("PASS simultaneous Resume has one owner; owner close permits exact-UUID handoff, edits and reload; no agent requests");

  // A leaves; B resumes its UUID without editing; A returns with copied identity
  // but a failed ownership claim. Same-key Resume must refuse B's active lock,
  // then explicitly reacquire after B closes (not keep a forever-false ready).
  for (const returningAction of ["resume", "delete"]) {
  const returning = await newContext();
  const tabA = await returning.newPage();
  tabA.on("dialog", d => d.accept());
  await tabA.goto(url);
  await tabA.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await tabA.getByRole("button", {name: "파일", exact: true}).waitFor();
  await edit("Return ownership fixture", tabA);
  const returningDraft = await state(tabA);
  await tabA.goto("about:blank");
  const tabB = await returning.newPage();
  await tabB.goto(url);
  const row = target => target.getByRole("listitem").filter({hasText: returningDraft.key.split(":").pop()});
  await row(tabB).getByRole("button", {name: "이어서 열기"}).click();
  const tabBPrompt = tabB.getByRole("alertdialog").getByRole("button", {name: "초안 보관 후 이동", exact: true});
  await tabBPrompt.click();
  await tabB.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(tabB), returningDraft);
  const tryOwnedAction = async () => {
    if (returningAction === "delete") {
      await row(tabA).getByRole("button", {name: "삭제…"}).click();
      await tabA.getByRole("alertdialog").getByRole("button", {name: "초안 삭제", exact: true}).click();
    } else await row(tabA).getByRole("button", {name: "이어서 열기"}).click();
  };
  await tabA.goBack();
  await tryOwnedAction();
  await tabA.getByText(/다른 탭에서 사용 중인 초안/).waitFor();
  assert.deepEqual(await state(tabA), returningDraft);
  await tabA.reload();
  await tryOwnedAction();
  await tabA.getByText(/다른 탭에서 사용 중인 초안/).waitFor();
  assert.deepEqual(await state(tabB), returningDraft);
  assert.equal(await tabA.evaluate(async () => (await import("/src/features/editor/store/persistenceStatusStore.ts")).usePersistenceStatusStore.getState().draft.owner), "blocked");
  await tabB.close();
  if (returningAction === "delete") {
    await row(tabA).getByRole("button", {name: "삭제…"}).click();
    await tabA.getByRole("alertdialog").getByRole("button", {name: "취소", exact: true}).click();
    assert.deepEqual(await state(tabA), returningDraft);
    assert.equal(await tabA.evaluate(key => localStorage.getItem(key) !== null, returningDraft.key), true);
    await tryOwnedAction();
    await tabA.waitForFunction(key => localStorage.getItem(key) === null, returningDraft.key);
    assert.notEqual((await state(tabA)).key, returningDraft.key);
    await tabA.reload();
    await tabA.getByRole("button", {name: "+ 새 프로젝트", exact: true}).waitFor();
    assert.equal(await row(tabA).count(), 0);
    assert.deepEqual(JSON.parse(await readFile(join(specs, "Fixture saved.json"), "utf8")), original.spec);
    await returning.close();
    console.log("PASS returning tab Delete refuses active B, preserves Cancel, and reacquires after B closes without Resume; reload stays deleted and disk is intact");
    continue;
  }
  await row(tabA).getByRole("button", {name: "이어서 열기"}).click();
  await tabA.getByRole("button", {name: "파일", exact: true}).waitFor();
  await edit("Reacquired after owner closed", tabA);
  const reacquired = await state(tabA);
  assert.equal(reacquired.key, returningDraft.key);
  assert.deepEqual(await tabA.evaluate(key => JSON.parse(localStorage.getItem(key)).spec, returningDraft.key), reacquired.spec);
  await tabA.evaluate(async () => {
    const {saveSpecAs} = await import("/src/features/editor/ui/exportSpecAsJson.ts");
    const {useEditorStore} = await import("/src/features/editor/store/editorStore.ts");
    window.pending = saveSpecAs(useEditorStore.getState().spec);
  });
  await tabA.getByRole("alertdialog").getByRole("textbox").fill("Reacquired fixture");
  await tabA.getByRole("alertdialog").getByRole("button", {name: "저장", exact: true}).click();
  await tabA.evaluate(() => window.pending);
  assert.equal((await state(tabA)).file, "Reacquired fixture.json");
  assert.deepEqual(JSON.parse(await readFile(join(specs, "Reacquired fixture.json"), "utf8")), reacquired.spec);
  await returning.close();
  console.log("PASS Back/reload while B owns same UUID refuses Resume; B close permits explicit reacquisition, autosave and disk Save");

  }

  const isolated = await newContext();
  const noWorkspace = await isolated.newPage();
  await noWorkspace.route("**/__vs/**", route => route.fulfill({status:404, body:"missing"}));
  await noWorkspace.goto(url);
  await noWorkspace.getByText("프로젝트 1개", {exact: true}).waitFor();
  assert.equal(await noWorkspace.getByRole("region", {name: "보관한 초안"}).count(), 0);
  assert.equal(await noWorkspace.evaluate(async () => (await import("/src/features/editor/ui/newSpec.ts")).newSpec()), true);
  assert.equal(await noWorkspace.getByRole("alertdialog").count(), 0);
  await isolated.close();
  console.log("PASS first-run demo/pristine blank and no-workspace controls have no recovery warning");
  const withoutLocks = await newContext();
  await withoutLocks.addInitScript(() => Object.defineProperty(navigator, "locks", {value: undefined}));
  const memory = await withoutLocks.newPage();
  memory.on("pageerror", error => errors.push(error.message));
  await memory.goto(url);
  await memory.getByText("프로젝트 2개", {exact: true}).waitFor();
  await memory.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await memory.getByRole("button", {name: "파일", exact: true}).waitFor();
  await edit("Memory-only fixture", memory);
  const memoryState = await state(memory);
  await waitStatus(memory, "파일 미저장 · 현재 탭에만 보관");
  await memory.getByRole("button", {name: "홈으로"}).click();
  await memory.getByText("브라우저 보관 대기 — 이 탭을 닫지 마세요.", {exact: true}).waitFor();
  await memory.getByRole("region", {name: "보관한 초안"}).getByRole("button", {name: "이어서 열기"}).click();
  await memory.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(memory), memoryState);
  await memory.getByRole("button", {name: "파일", exact: true}).click();
  await memory.getByRole("menuitem", {name: "새로 만들기", exact: true}).click();
  await memory.getByRole("alertdialog").getByText("초안을 보관할 수 없습니다", {exact: true}).waitFor();
  await memory.getByRole("alertdialog").getByRole("button", {name: "현재 작업 유지", exact: true}).click();
  await memory.getByRole("button", {name: "파일", exact: true}).waitFor();
  assert.deepEqual(await state(memory), memoryState);
  await withoutLocks.close();
  console.log("PASS unavailable Web Locks: Home resumes memory-only draft; failed preservation cannot replace it");

  // #351: 최근 보관순·요약 표시와 "모두 삭제…"(이 탭 초안·다른 탭 사용 중 제외, 취소 무변경).
  const bulk = await newContext();
  const tab = await bulk.newPage();
  tab.on("pageerror", error => errors.push(error.message));
  await tab.goto(url);
  await tab.getByRole("button", {name: "+ 새 프로젝트", exact: true}).click();
  await tab.getByRole("button", {name: "File", exact: true}).waitFor();
  const bulkKeys = [];
  for (const name of ["Bulk draft 1", "Bulk draft 2", "Bulk draft 3"]) {
    await edit(name, tab);
    bulkKeys.push((await state(tab)).key);
    await tab.getByRole("button", {name: "File", exact: true}).click();
    await tab.getByRole("menuitem", {name: "New", exact: true}).click();
    await tab.getByRole("alertdialog").getByRole("button", {name: "초안 보관 후 이동", exact: true}).click();
    await tab.waitForFunction(key => JSON.parse(sessionStorage.getItem("visual-spec:tab-recovery")).key !== key, bulkKeys.at(-1));
  }
  await tab.waitForTimeout(650); // pristine blank이 다음 탭의 시작 스냅샷이 된다
  await tab.getByRole("button", {name: "홈으로"}).click();
  const bulkRegion = tab.getByRole("region", {name: "보관한 초안"});
  const uuidOrder = async (target, count = 3) => {
    const items = target.getByRole("region", {name: "보관한 초안"}).getByRole("listitem");
    await target.waitForFunction(([selector, count]) => document.querySelectorAll(selector).length === count,
      ['section[aria-label="보관한 초안"] li', count]);
    return (await items.allInnerTexts())
      .map(text => bulkKeys.findIndex(key => text.includes(key.split(":").pop())));
  };
  assert.deepEqual(await uuidOrder(tab), [2, 1, 0]);
  for (const text of await bulkRegion.getByRole("listitem").allInnerTexts()) {
    assert.match(text, /마지막 보관 .+ · 페이지 1개 · 첫 페이지 Bulk draft \d 1440×900 · 레이어 1개/);
  }
  assert.deepEqual(await tab.evaluate(keys => keys.map(key => typeof JSON.parse(localStorage.getItem(`${key}:meta`)).savedAt), bulkKeys),
    ["number", "number", "number"]);
  const holder = await bulk.newPage();
  holder.on("pageerror", error => errors.push(error.message));
  await holder.goto(url);
  assert.deepEqual(await uuidOrder(holder), [2, 1, 0]);
  await holder.getByRole("listitem").filter({hasText: bulkKeys[0].split(":").pop()}).getByRole("button", {name: "이어서 열기"}).click();
  await holder.getByRole("button", {name: "File", exact: true}).waitFor();
  const held = await state(holder);
  assert.equal(held.key, bulkKeys[0]);
  await bulkRegion.getByRole("button", {name: "모두 삭제…", exact: true}).click();
  const bulkDialog = tab.getByRole("alertdialog");
  await bulkDialog.getByText(/초안 2개를 삭제합니다\. 제외 1개/).waitFor();
  assert.equal(await tab.evaluate(() => document.activeElement.textContent), "취소");
  await bulkDialog.getByRole("button", {name: "취소", exact: true}).click();
  assert.deepEqual(await uuidOrder(tab), [2, 1, 0]);
  assert.deepEqual(await tab.evaluate(keys => keys.map(key => localStorage.getItem(key) !== null), bulkKeys), [true, true, true]);
  await bulkRegion.getByRole("button", {name: "모두 삭제…", exact: true}).click();
  await bulkDialog.getByRole("button", {name: "초안 2개 삭제", exact: true}).click();
  await bulkRegion.getByRole("status").filter({hasText: "초안 2개를 삭제했습니다. 건너뜀 0개(사용 중이거나 변경됨), 실패 0개, 제외 1개"}).waitFor();
  assert.deepEqual(await uuidOrder(tab, 1), [0]);
  assert.equal(await bulkRegion.getByRole("button", {name: "모두 삭제…", exact: true}).count(), 0);
  assert.deepEqual(await tab.evaluate(keys => keys.map(key => [localStorage.getItem(key) !== null, localStorage.getItem(`${key}:meta`) !== null, localStorage.getItem(`${key}:deleted`)]), bulkKeys),
    [[true, true, null], [false, false, "1"], [false, false, "1"]]);
  assert.deepEqual(await state(holder), held);
  await tab.reload();
  await bulkRegion.waitFor();
  assert.deepEqual(await uuidOrder(tab, 1), [0]);
  await bulk.close();
  console.log("PASS recent-first drafts with time/summary; bulk delete excludes the other-tab owner, Cancel keeps all, reload stays deleted");
  for (const scenario of ["date", "pending", "query", "lock", "query-open", "lock-open", "cas", "failure"]) await checkBulkRegression(runner, scenario);
  assert.deepEqual(errors, []);
  console.log("PASS no page errors");
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
