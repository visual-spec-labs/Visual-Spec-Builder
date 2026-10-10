// #362 regression fixtures: real Chromium, deferred Web Locks, no model calls.
import assert from "node:assert/strict";

export async function checkBulkRegression(runner, scenario) {
  const context = await runner.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(runner.url);
    await page.getByRole("button", { name: /^(빈 캔버스에서 시작|\+ 새 프로젝트)$/ }).click();
    await page.getByRole("button", { name: "File", exact: true }).waitFor();
    if (scenario.endsWith("open")) await page.route("**/__vs/list/specs", route => route.fulfill({
      json: { files: ["review-fixture.json"] }, headers: { "x-visual-spec-workspace": "1" },
    }));
    const keys = await page.evaluate(async scenario => {
      const { useEditorStore: editor } = await import("/src/features/editor/store/editorStore.ts");
      const { useUnnamedDraftStore: drafts, notifyUnnamedDrafts } = await import("/src/features/editor/store/unnamedDraftStore.ts");
      const { useNavigationStore: navigation } = await import("/src/features/editor/store/navigationStore.ts");
      const { newSpec } = await import("/src/features/editor/ui/newSpec.ts");
      const { openSpec } = await import("/src/features/editor/ui/openSpecFromFile.ts");
      window.startOpen = () => { window.newRequest = openSpec(); };
      window.startNew = () => { window.newRequest = newSpec(); };
      // Keep the active draft pending while Home and its confirmation render.
      const setItem = Storage.prototype.setItem;
      if (scenario === "pending") Storage.prototype.setItem = function(key, value) {
        if (key.startsWith("visual-spec:autosave:draft:")) throw new DOMException("fixture", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
      editor.getState().setPageField(editor.getState().activePageId, "name", "Bulk review active");
      const document = drafts.getState().active.document;
      const keys = ["a-review", "b-review"].map(id => `visual-spec:autosave:draft:${id}`);
      for (const key of keys) {
        setItem.call(localStorage, key, JSON.stringify({ ...document, spec: { ...document.spec, name: key } }));
        setItem.call(localStorage, `${key}:meta`, JSON.stringify({ savedAt: scenario === "date" ? 1e20 : 1000 }));
      }
      window.restoreStorage = () => { Storage.prototype.setItem = setItem; };
      notifyUnnamedDrafts(); navigation.getState().openHome();
      return keys;
    }, scenario);
    const region = page.getByRole("region", { name: "보관한 초안" });
    if (scenario === "date") {
      await region.getByText(/시각 정보 없음/).first().waitFor();
      assert.equal(await region.getByRole("listitem").count(), 3);
    } else if (scenario === "pending") {
      await region.getByText(/브라우저 보관 대기/).waitFor();
      await region.getByRole("button", { name: "모두 삭제…" }).click();
      await page.getByRole("alertdialog").getByText(/초안 2개를 삭제합니다\. 제외 1개/).waitFor();
      await page.getByRole("button", { name: "초안 2개 삭제", exact: true }).click();
      await region.getByRole("status").filter({ hasText: /삭제했습니다.*제외 1개/ }).waitFor();
      await page.evaluate(() => window.restoreStorage());
    } else if (scenario === "failure") {
      await page.evaluate(key => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, value) {
          if (k === `${key}:deleted`) throw new DOMException("fixture", "QuotaExceededError");
          return original.call(this, k, value);
        };
        window.restoreStorage = () => { Storage.prototype.setItem = original; };
      }, keys[0]);
      await region.getByRole("button", { name: "모두 삭제…" }).click();
      await page.getByRole("button", { name: "초안 2개 삭제", exact: true }).click();
      await region.getByRole("status").filter({ hasText: /초안 1개를 삭제했습니다.*실패 1개/ }).waitFor();
      assert.deepEqual(await page.evaluate(keys => keys.map(key => [!!localStorage.getItem(key), localStorage.getItem(`${key}:deleted`)]), keys), [[true, null], [false, "1"]]);
      await page.evaluate(() => window.restoreStorage());
      await region.getByRole("button", { name: "모두 삭제…" }).click();
      await page.getByRole("button", { name: "초안 1개 삭제", exact: true }).click();
      await region.getByRole("status").filter({ hasText: /초안 1개를 삭제했습니다.*실패 0개/ }).waitFor();
    } else {
      const query = scenario.startsWith("query");
      const opening = scenario.endsWith("open");
      if (query) await page.evaluate(() => {
        const original = navigator.locks.query.bind(navigator.locks);
        navigator.locks.query = async () => {
          window.queryWaiting = true;
          await new Promise(resolve => { window.releaseQuery = resolve; });
          return original();
        };
      });
      else await page.evaluate(async key => {
        await new Promise(resolve => {
          window.lockHeld = navigator.locks.request(key, () => {
            resolve();
            return new Promise(unlock => { window.releaseLock = unlock; });
          });
        });
      }, keys[0]);
      await region.getByRole("button", { name: "모두 삭제…" }).click();
      if (query) await page.waitForFunction(() => window.queryWaiting);
      else {
        await page.getByRole("button", { name: "초안 2개 삭제", exact: true }).click();
        await page.waitForFunction(async key => (await navigator.locks.query()).pending.some(lock => lock.name === key), keys[0]);
      }
      if (scenario === "cas") {
        const other = await context.newPage();
        await other.goto(runner.url);
        const changed = await other.evaluate(key => {
          const document = JSON.parse(localStorage.getItem(key));
          document.spec.name = "Changed in another tab after confirmation";
          const raw = JSON.stringify(document); localStorage.setItem(key, raw); return raw;
        }, keys[0]);
        await page.evaluate(async () => { window.releaseLock(); await window.lockHeld; });
        await region.getByRole("status").filter({ hasText: /초안 1개를 삭제했습니다. 건너뜀 1개/ }).waitFor();
        assert.deepEqual(await page.evaluate(keys => keys.map(key => [localStorage.getItem(key), localStorage.getItem(`${key}:deleted`)]), keys), [[changed, null], [null, "1"]]);
        await other.close();
        assert.deepEqual(errors, []);
        console.log("PASS bulk regression CAS changed in another tab while waiting for mutation lock");
        return;
      }
      await page.evaluate(opening => opening ? window.startOpen() : window.startNew(), opening);
      const dialog = page.getByRole("alertdialog");
      const title = opening ? "스펙 열기" : "현재 문서를 떠나시겠습니까?";
      await dialog.getByRole("heading", { name: title }).waitFor();
      if (query) await page.evaluate(() => window.releaseQuery());
      else await page.evaluate(async () => { window.releaseLock(); await window.lockHeld; });
      // Wait until the old bulk operation finishes before checking the newer prompt.
      await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="보관한 초안"] button')]
        .some(button => button.textContent === "모두 삭제…" && !button.disabled));
      assert.equal(await dialog.getByRole("heading").innerText(), title);
      await dialog.getByRole("button", { name: "취소", exact: true }).click();
      assert.equal(await page.evaluate(() => window.newRequest), opening ? undefined : false);
      assert.deepEqual(await page.evaluate(keys => keys.map(key => [!!localStorage.getItem(key), localStorage.getItem(`${key}:deleted`)]), keys), [[true, null], [true, null]]);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS bulk regression ${scenario}`);
  } finally { await context.close(); }
}
