// S1-2: real Chromium, fixture-only. No external requests or model calls.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

function withoutProjectId(spec) {
  const content = structuredClone(spec);
  delete content.projectId;
  return content;
}

const workspace = await mkdtemp(join(tmpdir(), "vs-relations-recovery-"));
const fixture = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
let runner;
try {
  await mkdir(join(workspace, "specs"));
  const original = JSON.stringify(fixture);
  await writeFile(join(workspace, "specs/original.json"), original);
  runner = await startBrowserWorkspace(workspace);
  const scenarios = [
    ["action-target-missing", spec => { delete spec.pages.dashboard; spec.pageOrder = spec.pageOrder.filter(id => id !== "dashboard"); }],
    ["first-page-kind", spec => { for (const id of ["login", "dashboard"]) delete spec.pages[id]; spec.pageOrder = spec.pageOrder.filter(id => !["login", "dashboard"].includes(id)); }],
    ["action-target-kind", spec => { spec.pages.login.nodes.loginButton.action = { type: "openModal", target: "dashboard" }; }],
    ["navigate-to-non-page", spec => { spec.pages.login.nodes.loginButton.action.target = "resetPassword"; }],
    ["action-source-invalid", spec => { spec.pages.login.nodes.loginButton.action = { type: "close" }; }],
  ];
  for (const [code, breakIt] of scenarios) {
    const spec = structuredClone(fixture); breakIt(spec);
    await writeFile(join(workspace, "specs/invalid.json"), JSON.stringify(spec));
    const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = [], alerts = [], downloads = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
    page.on("download", download => downloads.push(download));
    page.on("request", request => { if (["PUT", "POST", "DELETE"].includes(request.method()) && /\/(specs|generated)\//.test(request.url())) writes.push(request.url()); });
    await page.goto(runner.url);
    // Seed the existing autosave format; reload and Resume use the actual product restore path.
    await page.evaluate(spec => {
      localStorage.clear(); sessionStorage.clear();
      const raw = JSON.stringify({ fileName: null, spec });
      localStorage.setItem("visual-spec:project", raw);
      localStorage.setItem("visual-spec:autosave:draft:relation-fixture", raw);
    }, spec);
    await page.reload();
    const draft = page.getByRole("region", { name: "보관한 초안" }).getByRole("listitem").filter({ hasText: "초안 relation-fixture" });
    await draft.getByRole("button", { name: "이어서 열기" }).click();
    const notice = page.getByRole("region", { name: "화면 관계 오류" });
    await notice.getByText(new RegExp(`\\[${code}\\]`)).waitFor();
    await notice.getByText(/이전 Undo 기록을 복원하지 않습니다/).waitFor();
    const loaded = await page.evaluate(async () => (await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState().spec);
    const expected = { ...spec, projectId: loaded.projectId };
    assert.ok(loaded.projectId, "restored legacy project receives an identity");
    assert.deepEqual(withoutProjectId(loaded), spec, "restore preserves the fixture content");
    if (process.env.VSB_QA_ARTIFACTS) {
      await mkdir(process.env.VSB_QA_ARTIFACTS, { recursive: true });
      await page.screenshot({ path: join(process.env.VSB_QA_ARTIFACTS, `${code}.png`) });
    }
    await page.evaluate(async expected => {
      const { useEditorStore: editor } = await import("/src/features/editor/store/editorStore.ts");
      if (editor.getState().history.past.length !== 0) throw Error("unexpected restored Undo");
      editor.getState().undo();
      if (JSON.stringify(editor.getState().spec) !== JSON.stringify(expected)) throw Error("restore/Undo changed spec");
    }, expected);
    const state = () => page.evaluate(async () => {
      const { useEditorStore: editor } = await import("/src/features/editor/store/editorStore.ts");
      const { useDocumentStore: document } = await import("/src/features/editor/store/documentStore.ts");
      const { usePersistenceStatusStore: persistence } = await import("/src/features/editor/store/persistenceStatusStore.ts");
      return { spec: editor.getState().spec, history: editor.getState().history, fileName: document.getState().fileName,
        attempt: persistence.getState().attempt, draft: localStorage.getItem("visual-spec:autosave:draft:relation-fixture") };
    });
    const before = await state();
    writes.length = 0;
    for (const label of ["저장", "다른 이름으로 저장"]) {
      await page.getByRole("button", { name: "파일", exact: true }).click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      assert.match(alerts.at(-1), new RegExp(`\\[${code}\\]`));
      assert.match(alerts.at(-1), /파일을 저장하지 않았습니다/);
      const after = await state();
      assert.deepEqual(after.spec, before.spec); assert.deepEqual(after.history, before.history);
      assert.equal(after.fileName, before.fileName); assert.equal(after.draft, before.draft);
      assert.equal(after.attempt.phase, "failed");
    }
    assert.equal(downloads.length, 0); assert.deepEqual(writes, []);
    const failed = await state();
    const downloadPromise = page.waitForEvent("download");
    await notice.getByRole("button", { name: "미검증 복구 사본 다운로드" }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^unvalidated-recovery-.*\.json$/);
    const downloaded = await readFile(await download.path(), "utf8");
    assert.deepEqual(JSON.parse(downloaded), expected);
    assert.deepEqual(await state(), failed);
    // Follow the visible guidance: place a differently named COPY in the nonempty
    // workspace specs folder, then select it through File → Open (no internal picker).
    await notice.getByText(/기존 파일과 다른 이름으로 작업공간 \.visual-spec\/specs\/에 넣은 뒤/).waitFor();
    const recoveryName = download.suggestedFilename();
    await writeFile(join(workspace, "specs", recoveryName), downloaded, { flag: "wx" });
    await page.getByRole("button", { name: "파일", exact: true }).click();
    await page.getByRole("menuitem", { name: "열기", exact: true }).click();
    const openFailure = page.waitForEvent("dialog");
    await page.getByRole("alertdialog").getByRole("button", { name: recoveryName, exact: true }).click();
    await openFailure;
    assert.match(alerts.at(-1), /열 수 없습니다/); assert.match(alerts.at(-1), new RegExp(code));
    assert.deepEqual((await state()).spec, expected);
    // Workspace Open also reports details and preserves both current draft and disk bytes.
    await page.getByRole("button", { name: "파일", exact: true }).click();
    await page.getByRole("menuitem", { name: "열기", exact: true }).click();
    const workspaceFailure = page.waitForEvent("dialog");
    await page.getByRole("alertdialog").getByRole("button", { name: "invalid.json", exact: true }).click();
    await workspaceFailure;
    assert.match(alerts.at(-1), new RegExp(code));
    assert.deepEqual((await state()).spec, expected);
    assert.equal(await readFile(join(workspace, "specs/original.json"), "utf8"), original);
    assert.equal(await readFile(join(workspace, "specs/invalid.json"), "utf8"), JSON.stringify(spec));
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    // Simulate a deliberate edit of a NEW downloaded copy, never automatic product repair.
    const repaired = JSON.parse(downloaded);
    if (code === "first-page-kind") {
      repaired.pages.dashboard = structuredClone(fixture.pages.dashboard);
      delete repaired.pages.dashboard.nodes.logoutButton.action;
      repaired.pageOrder.unshift("dashboard");
    } else {
      repaired.pages.login.nodes.loginButton.action = { type: "navigate", target: "login" };
    }
    const repairedName = `repaired-${code}.json`;
    await writeFile(join(workspace, "specs", repairedName), JSON.stringify(repaired), { flag: "wx" });
    await page.getByRole("button", { name: "파일", exact: true }).click();
    await page.getByRole("menuitem", { name: "열기", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: repairedName, exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "초안 보관 후 이동" }).click();
    await notice.waitFor({ state: "detached" });
    assert.deepEqual((await state()).spec, repaired);
    assert.equal((await state()).fileName, repairedName);
    assert.equal(await readFile(join(workspace, "specs", recoveryName), "utf8"), downloaded);
    assert.equal(await page.evaluate(async () => {
      const { parseSpecJson } = await import("/src/features/editor/store/loadSpec.ts");
      const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
      return parseSpecJson(JSON.stringify(useEditorStore.getState().spec)).ok;
    }), true);
    assert.deepEqual(JSON.parse((await state()).draft).spec, expected);
    assert.equal(await readFile(join(workspace, "specs/original.json"), "utf8"), original);
    assert.deepEqual(writes, []);
    console.log(`PASS ${code}: restore/empty Undo, detailed Save/Save as/Open failures, exact recovery download, repaired COPY opens through File menu in nonempty workspace; draft/original preserved`);
    await context.close();
    await rm(join(workspace, "specs", recoveryName));
    await rm(join(workspace, "specs", repairedName));
  }
  // Structure errors are still rejected by restoration; raw source remains available.
  const context = await runner.newContext(); const page = await context.newPage();
  await page.goto(runner.url);
  const mixed = structuredClone(fixture);
  delete mixed.pages.dashboard; mixed.pageOrder = mixed.pageOrder.filter(id => id !== "dashboard");
  mixed.pages.login.root = "ghost";
  const mixedResult = await page.evaluate(async spec => {
    const { parseStoredDocument } = await import("/src/features/editor/store/specStorage.ts");
    const { listUnnamedDrafts } = await import("/src/features/editor/store/unnamedDraftStore.ts");
    const raw = JSON.stringify({ fileName: null, spec });
    const key = "visual-spec:autosave:draft:mixed"; localStorage.setItem(key, raw);
    return { rejected: parseStoredDocument(raw) === undefined, listed: listUnnamedDrafts().some(draft => draft.key === key), retained: localStorage.getItem(key) === raw };
  }, mixed);
  assert.deepEqual(mixedResult, { rejected: true, listed: false, retained: true });
  await page.reload();
  await page.getByRole("button", { name: "+ 새 프로젝트", exact: true }).waitFor();
  assert.equal(await page.getByRole("listitem").filter({ hasText: "초안 mixed" }).count(), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("visual-spec:autosave:draft:mixed")).spec), mixed);
  // A valid project still opens/saves and does not show the recovery notice.
  await page.getByRole("button").filter({ hasText: new RegExp(`${fixture.name}.*페이지`, "s") }).click();
  await page.getByRole("button", { name: "파일", exact: true }).waitFor();
  assert.equal(await page.getByRole("region", { name: "화면 관계 오류" }).count(), 0);
  const opened = await page.evaluate(async () => (await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState().spec);
  assert.deepEqual(withoutProjectId(opened), fixture);
  // A successful HTTP response precedes the Save alert. Await its acceptance before
  // closing the context; otherwise dialog.accept races teardown on CI.
  const saveNoticeHandled = new Promise((resolve, reject) => {
    page.once("dialog", async dialog => {
      try {
        assert.match(dialog.message(), /저장했습니다/);
        await dialog.accept();
        resolve();
      } catch (error) { reject(error); }
    });
  });
  const saved = page.waitForResponse(response => response.request().method() === "PUT" && response.url().includes("specs/original.json"));
  await page.getByRole("button", { name: "파일", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장", exact: true }).click();
  // Product stores a normalized JSON representation; validate the resulting data.
  assert.equal((await saved).ok(), true);
  await saveNoticeHandled;
  assert.deepEqual(JSON.parse(await readFile(join(workspace, "specs/original.json"), "utf8")), opened);
  console.log("PASS mixed structural errors rejected/raw retained; valid Open/Save control without warning");
  await context.close();
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
