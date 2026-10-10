// #289 저장 상태 표시의 실제 Chromium 회귀. 임시 작업공간과 지정 fixture만 사용한다.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/save-status.mjs
// Playwright is an optional QA runner, not an application dependency.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startBrowserWorkspace } from "./harness.mjs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "vs-save-status-"));
const specs = join(workspace, "specs");
await mkdir(specs);
const fixture = JSON.parse(await readFile(join(repo, "examples/dashboard-cards.json"), "utf8"));
for (const name of ["Status A", "Status B"]) {
  await writeFile(join(specs, `${name}.json`), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name } }));
}
let runner;
try {
  runner = await startBrowserWorkspace(workspace);
  const { newContext, url } = runner;
  const context = await newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());
  const status = page.locator('[role="status"][aria-label="저장 상태"]');
  const waitStatus = async text => { await status.filter({hasText: text}).waitFor(); };
  const menu = async name => {
    await page.getByRole("button", {name:"파일", exact:true}).click();
    await page.getByRole("menuitem", {name, exact:true}).click();
  };
  const edit = async name => page.evaluate(async name => {
    const {useEditorStore: s} = await import("/src/features/editor/store/editorStore.ts");
    s.getState().setPageField(s.getState().activePageId, "name", name);
  }, name);
  const state = async () => page.evaluate(async () => {
    const {useEditorStore: s} = await import("/src/features/editor/store/editorStore.ts");
    return s.getState().spec;
  });
  await page.goto(url);
  await page.getByRole("button").filter({hasText: /Status A.*페이지/s}).click();
  await waitStatus("파일 저장됨");
  await edit("직접 편집한 내용");
  await waitStatus("수정됨 · 파일 미저장 · 브라우저 초안 보관됨");
  const before = await state();
  await menu("다른 이름으로 저장");
  await page.getByRole("alertdialog").getByRole("button", {name:"취소", exact:true}).click();
  assert.deepEqual(await state(), before);
  await waitStatus("수정됨 · 파일 미저장");
  await page.route("**/file/specs/*", async route => {
    if (route.request().method() === "PUT") await route.fulfill({status:507, contentType:"application/json", body:JSON.stringify({error:"fixture full"})});
    else await route.continue();
  });
  await menu("저장"); await waitStatus("파일 저장 실패");
  assert.deepEqual(await state(), before);
  await page.unroute("**/file/specs/*");
  await menu("저장"); await waitStatus("파일 저장됨");
  assert.deepEqual(JSON.parse(await readFile(join(specs,"Status A.json"),"utf8")), before);
  console.log("PASS real save, failed save and cancelled Save as match disk bytes");

  // 요청 시점의 내용만 디스크에 써도 나중에 편집한 현재 문서는 저장됨이 아니다.
  await edit("요청 시점");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/file/specs/*", async route => {
    if (route.request().method() === "PUT") await gate;
    await route.continue();
  });
  await menu("저장"); await waitStatus("파일 저장 중");
  await edit("대기 중 추가 편집"); release();
  await waitStatus("수정됨 · 파일 미저장");
  const disk = JSON.parse(await readFile(join(specs,"Status A.json"),"utf8"));
  assert.notDeepEqual(disk, await state());
  await page.unroute("**/file/specs/*");
  console.log("PASS pending Save never marks later edits saved");

  // 읽기 실패 후 예전 저장 증거를 계속 표시하지 않는다.
  await menu("저장"); await waitStatus("파일 저장됨");
  // UI의 일시적인 미확인 상태와 주입한 실패를 혼동하지 않도록 실제 응답도 확인한다.
  const observedRead = statusCode => page.waitForResponse(response =>
    response.request().method() === "GET" && response.url().includes("/file/specs/") && response.status() === statusCode);
  const failedRead = observedRead(503);
  await page.route("**/file/specs/*", async route => {
    if (route.request().method() === "GET") await route.fulfill({status:503, body:"fixture unavailable"});
    else await route.continue();
  });
  await failedRead;
  await waitStatus("파일 저장 미확인");
  const recoveredRead = observedRead(200);
  await page.unroute("**/file/specs/*");
  await recoveredRead;
  await waitStatus("파일 저장됨");

  // 다른 탭의 보관본 변경은 실제 storage 이벤트로 충돌 표시를 만든다.
  await edit("내 충돌 초안");
  const other = await context.newPage();
  await other.goto(url);
  await other.getByRole("button", {name:"+ 새 프로젝트", exact:true}).waitFor();
  await other.evaluate(async () => {
    const {projectStorageKey, serializeStoredDocument} = await import("/src/features/editor/store/specStorage.ts");
    const key = projectStorageKey("Status A.json", "");
    const doc = JSON.parse(localStorage.getItem(key));
    doc.spec.name = "다른 탭의 변경";
    localStorage.setItem(key, serializeStoredDocument(doc));
  });
  await waitStatus("충돌 · 저장 중단");
  assert.equal((await state()).pages.page1.name, "내 충돌 초안");
  await other.close();
  // 충돌 UI의 기존 선택을 사용한다. 불러온 초안도 디스크와 다르면 수정됨이다.
  await page.getByRole("button", {name:/최신.*불러오기/}).click();
  await waitStatus("수정됨 · 파일 미저장");
  console.log("PASS failed disk observation and actual cross-tab conflict/recovery labels");

  // 파일 전환 시 이전 문서의 실패·저장 증거가 남지 않는다.
  await page.getByRole("button", {name:"홈으로"}).click();
  await page.getByRole("button").filter({hasText:/Status B.*페이지/s}).click();
  await waitStatus("파일 저장됨");
  assert.equal((await state()).name, "Status B");
  const artifacts = process.env.VSB_QA_ARTIFACTS ?? join(tmpdir(), "vs-save-status-qa");
  await mkdir(artifacts, {recursive:true});
  const details = page.locator('details').filter({has: status});
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await details.getAttribute("open"), "");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await page.screenshot({path:join(artifacts, `${theme}.png`)});
  }
  await page.keyboard.press("Escape");
  assert.equal(await details.getAttribute("open"), null);
  console.log("PASS document replacement and keyboard state explanation");
  // 지연 baseline r1보다 먼저 완료된 poll r2를 이전 응답이 덮지 않아야 한다.
  let releaseBaseline;
  let baselineCaptured;
  const baselineGate = new Promise(resolve => { releaseBaseline = resolve; });
  const captured = new Promise(resolve => { baselineCaptured = resolve; });
  let firstRead = true;
  await page.route("**/file/specs/*", async route => {
    if (route.request().method() === "GET" && firstRead) {
      firstRead = false;
      const response = await route.fetch();
      baselineCaptured();
      await baselineGate;
      await route.fulfill({response});
    } else await route.continue();
  });
  await page.evaluate(async () => {
    const {useEditorStore:s} = await import("/src/features/editor/store/editorStore.ts");
    s.getState().loadSpec(structuredClone(s.getState().spec));
  });
  await captured;
  const currentB = await state();
  await writeFile(join(specs, "Status B.json"), JSON.stringify({...currentB, name:"외부 r2"}));
  await waitStatus("외부 파일 변경");
  await page.getByRole("button", {name:"내 편집 유지", exact:true}).click();
  await page.evaluate(async () => {
    const {usePersistenceStatusStore:s} = await import("/src/features/editor/store/persistenceStatusStore.ts");
    const {useAgentEditStore:a} = await import("/src/features/editor/store/agentEditStore.ts");
    window.qaDiskObservations = [];
    window.qaNotices = [];
    s.subscribe(state => window.qaDiskObservations.push(state.disk));
    a.subscribe((next, prev) => { if (next.diskNotice !== prev.diskNotice && next.diskNotice) window.qaNotices.push(next.diskNotice); });
  });
  releaseBaseline();
  await page.waitForTimeout(3500);
  await waitStatus("외부 파일 변경");
  assert.equal(await page.evaluate(() => window.qaDiskObservations.some(d => d?.json && JSON.parse(d.json).name === "Status B")), false);
  await page.unroute("**/file/specs/*");
  await page.route("**/file/specs/*", route => route.request().method() === "GET"
    ? route.fulfill({status:503, body:"transient failure"}) : route.continue());
  await waitStatus("파일 저장 미확인");
  await page.unroute("**/file/specs/*");
  await waitStatus("외부 파일 변경");
  await page.getByRole("button", {name:"홈으로"}).click();
  // 같은 메모리 문서를 Resume하는 navigation 경로. 파일을 다시 여는 동작과 구별한다.
  await page.evaluate(async () => {
    const {useNavigationStore:s} = await import("/src/features/editor/store/navigationStore.ts");
    s.getState().openEditor();
  });
  await waitStatus("외부 파일 변경");
  await page.waitForTimeout(3200);
  assert.equal(await page.evaluate(() => window.qaNotices.length), 0);
  assert.deepEqual(await state(), currentB);
  console.log("PASS delayed r1 cannot overwrite r2; failed GET and Home/Resume recover without duplicate notice or false saved");
  const fallbackContext = await newContext();
  const fallback = await fallbackContext.newPage();
  fallback.on("dialog", d => d.accept());
  fallback.on("pageerror", e => errors.push(e.message));
  await fallback.route("**/__vs/**", route => route.fulfill({status:404, body:"no workspace"}));
  await fallback.goto(url);
  await fallback.getByRole("button").filter({hasText:/DashboardPage.*페이지/s}).click();
  await fallback.getByRole("button", {name:"파일", exact:true}).click();
  const download = fallback.waitForEvent("download");
  await fallback.getByRole("menuitem", {name:"저장", exact:true}).click();
  await download;
  await fallback.locator('[role="status"][aria-label="저장 상태"]').filter({hasText:"다운로드 요청됨"}).waitFor();
  assert.equal((await fallback.locator('[role="status"][aria-label="저장 상태"]').textContent()).includes("파일 저장됨"), false);
  await fallbackContext.close();
  const quotaContext = await newContext();
  await quotaContext.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("visual-spec:autosave:") || key === "visual-spec:tab-recovery") throw new DOMException("fixture quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const quota = await quotaContext.newPage();
  quota.on("pageerror", e => errors.push(e.message));
  await quota.goto(url);
  await quota.getByRole("button", {name:"+ 새 프로젝트", exact:true}).click();
  await quota.getByRole("button", {name:"파일", exact:true}).waitFor();
  await quota.evaluate(async () => {
    const {useEditorStore:s} = await import("/src/features/editor/store/editorStore.ts");
    s.getState().setPageField(s.getState().activePageId, "name", "보관 실패 fixture");
  });
  await quota.locator('[role="status"][aria-label="저장 상태"]').filter({hasText:"파일 미저장 · 초안 보관 실패"}).waitFor();
  await quotaContext.close();
  console.log("PASS actual download fallback is not saved; browser storage failure is explicit");
  assert.deepEqual(errors, []);
  console.log("PASS no page errors; fixture sha256", createHash("sha256").update(JSON.stringify(fixture)).digest("hex"));
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
