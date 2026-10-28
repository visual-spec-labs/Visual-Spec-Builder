// Overflow guidance must remain readable without painting over editable content.
// Fixture only: no external agent or model invocation.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-overflow-notice-"));
let runner;
try {
  await mkdir(join(workspace, "specs"));
  const fixture = JSON.parse(await readFile(new URL("../../examples/login-screen.json", import.meta.url), "utf8"));
  const screen = fixture.screen;
  screen.name = "Overflow";
  screen.size = { width: 1440, height: 900 };
  const root = screen.nodes.root;
  root.layout = { direction: "column", gap: 24, padding: { top: 24, right: 24, bottom: 24, left: 24 }, mainAxis: "start", crossAxis: "stretch" };
  root.children = [{ node: "card1" }, { node: "card2" }, { node: "card3" }, { node: "lastButton" }];
  const button = { ...screen.nodes.loginButton, name: "LastButton", content: "마지막 버튼", box: { width: "fill", height: 44 } };
  screen.nodes = { root, lastButton: button };
  for (let i = 1; i <= 3; i++) screen.nodes[`card${i}`] = {
    type: "frame", name: `Card${i}`, box: { width: "fill", height: 300 },
    layout: { direction: "column", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: "start", crossAxis: "stretch" },
    children: [], background: [{ type: "solid", color: "#E5E7EB" }],
  };
  const short = structuredClone(screen);
  short.name = "Short"; short.nodes.root.children = [{ node: "lastButton" }];
  for (let i = 1; i <= 3; i++) delete short.nodes[`card${i}`];
  const modal = structuredClone(screen); modal.name = "OverflowModal"; modal.kind = "modal";
  await writeFile(join(workspace, "specs/overflow.json"), JSON.stringify({ version: fixture.version, name: "OverflowNotice", pageOrder: ["long", "short", "modal"], pages: { long: screen, short, modal } }));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1000, height: 350 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /OverflowNotice.*페이지/s }).click();
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.view = (await import("/src/features/editor/store/viewStore.ts")).useViewStore;
  });
  const surface = page.getByTestId("editor-canvas-surface");
  const initialSpec = await page.evaluate(() => editor.getState().spec);
  const notice = page.getByRole("status").filter({ hasText: /페이지 높이 900px 넘침/ });
  const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  let checked = 0;
  for (const [width, height] of [[1000, 350], [1000, 300], [760, 700], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const preview of [384, 320]) {
      await page.getByRole("spinbutton", { name: "미리보기 폭", exact: true }).fill(String(preview));
      for (const zoom of [100, 25, 200]) {
        await page.evaluate(zoom => view.getState().setZoom(zoom), zoom);
        await notice.waitFor();
        await surface.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.waitForTimeout(80);
        // At 200% in an 81px viewport, bottom padding alone can scroll the
        // button above the surface. Bring that content back into view first.
        if (zoom === 200) await page.locator('[data-node-id="lastButton"]').evaluate(el => el.scrollIntoView({ block: "center", inline: "nearest" }));
        const banner = await notice.boundingBox();
        const canvas = await surface.boundingBox();
        const buttonBox = await page.locator('[data-node-id="lastButton"]').boundingBox();
        console.log(JSON.stringify({ width, height, preview, zoom, banner, canvas, buttonBox }));
        if (process.env.VSB_QA_ARTIFACTS) {
          await mkdir(process.env.VSB_QA_ARTIFACTS, { recursive: true });
          await page.screenshot({ path: join(process.env.VSB_QA_ARTIFACTS, `overflow-${width}-${height}-${preview}-${zoom}.png`) });
        }
        // At 200% the button can be taller than the viewport; only its painted,
        // scroll-clipped part is eligible for hit testing (not its raw DOM bounds).
        const visible = { x: Math.max(buttonBox.x, canvas.x), y: Math.max(buttonBox.y, canvas.y) };
        visible.width = Math.min(buttonBox.x + buttonBox.width, canvas.x + canvas.width - 20) - visible.x;
        visible.height = Math.min(buttonBox.y + buttonBox.height, canvas.y + canvas.height) - visible.y;
        assert.ok(visible.width > 0 && visible.height > 0, "final button remains reachable by scrolling");
        assert.equal(intersects(banner, visible), false, "notice must not cover the visible final button");
        // The floating toolbar can cover the center while scrolling. Check that
        // the visible button still has a reachable point, separate from notice geometry.
        assert.equal(await page.evaluate(box => [0.15, 0.5, 0.85].some(x => [0.15, 0.5, 0.85].some(y =>
          document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)?.closest('[data-node-id]')?.getAttribute('data-node-id') === "lastButton")), visible), true);
        assert.ok(banner.y >= 0 && banner.y + banner.height <= height, "notice must fit the viewport");
        assert.equal(intersects(banner, canvas), false, "notice must reserve space outside the scroll surface");
        assert.equal(await notice.evaluate(el => el.scrollWidth <= el.clientWidth), true, "notice text must wrap within its width");
        checked++;
      }
    }
    await page.evaluate(() => editor.getState().selectPage("modal"));
    await notice.waitFor();
    assert.equal(intersects(await notice.boundingBox(), await page.getByRole("button", { name: "모달 미리보기", exact: true }).boundingBox()), false);
    await page.evaluate(() => editor.getState().selectPage("long"));
  }
  await page.evaluate(() => editor.getState().selectPage("short"));
  await notice.waitFor({ state: "detached" });
  await page.evaluate(() => editor.getState().selectPage("long"));
  await notice.waitFor();
  assert.deepEqual(await page.evaluate(() => editor.getState().spec), initialSpec, "view changes must not change the document");
  assert.deepEqual(errors, []);
  console.log(`PASS overflow notice: ${checked} viewport/preview/zoom combinations, last button unobscured, modal trigger separate, no-overflow page removes notice; no model call`);
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
