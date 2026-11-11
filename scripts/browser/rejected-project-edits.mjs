// Real UI rejection checks in a relation-invalid recovery document; no model calls.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-rejected-edits-"));
let runner;
try {
  for (const dir of ["specs", "runtime", "generated"]) await mkdir(join(workspace, dir), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "RejectedEdits";
  for (const screen of Object.values(project.pages)) screen.name = "Same name";
  await writeFile(join(workspace, "specs/flow.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /RejectedEdits.*페이지/s }).click();
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.view = (await import("/src/features/editor/store/viewStore.ts")).useViewStore;
    window.responsive = (await import("/src/features/editor/responsive/responsiveViewStore.ts")).useResponsiveViewStore;
  });
  for (const kind of ["page", "modal", "widget"]) assert.ok(await page.getByRole("button", { name: `Same name, 화면 종류: ${kind}`, exact: true }).count() > 0);
  // Simulate the restored legacy document accepted by the recovery boundary.
  await page.evaluate(() => {
    const broken = structuredClone(editor.getState().spec);
    delete broken.pages.dashboard;
    broken.pageOrder = broken.pageOrder.filter(id => id !== "dashboard");
    broken.pages.login.responsive = { breakpoints: { small: { minWidthPx: 500 } }, overrides: {} };
    editor.getState().loadSpec(broken);
    responsive.getState().setWidth("login", 400);
    view.getState().setZoom(0.73);
  });
  const state = () => page.evaluate(() => ({ spec: editor.getState().spec, history: editor.getState().history,
    content: view.getState().content, zoom: view.getState().zoom, widths: responsive.getState().widths }));
  let before = await state();
  await page.getByRole("combobox", { name: "해상도", exact: true }).selectOption("390x844");
  assert.deepEqual(await state(), before, "rejected preset must not change content, zoom or document");
  await page.evaluate(() => responsive.getState().setWidth("login", 500));
  before = await state();
  await page.getByRole("textbox", { name: "새 분기점 ID", exact: true }).fill("tablet");
  await page.getByRole("spinbutton", { name: "새 분기점 최소 폭", exact: true }).fill("768");
  await page.getByRole("region", { name: "반응형 편집" }).getByRole("button", { name: "추가", exact: true }).click();
  assert.deepEqual(await state(), before, "rejected breakpoint must not change preview or document");
  assert.equal(await page.getByRole("textbox", { name: "새 분기점 ID", exact: true }).inputValue(), "tablet");
  assert.equal(await page.getByRole("spinbutton", { name: "새 분기점 최소 폭", exact: true }).inputValue(), "768");
  assert.ok(await page.getByRole("region", { name: "반응형 편집" }).getByRole("alert").textContent());
  const minimum = page.getByRole("spinbutton", { name: "분기점 최소 폭", exact: true });
  await minimum.fill("600"); await minimum.blur();
  assert.deepEqual(await state(), before, "rejected existing breakpoint edit must not change preview");
  assert.equal(await minimum.inputValue(), "600", "retain rejected input for correction");
  assert.ok(await page.getByRole("region", { name: "반응형 편집" }).getByRole("alert").textContent());
  // Positive control: same controls commit normally once a valid document is loaded.
  await page.evaluate(project => editor.getState().loadSpec(project), project);
  await page.getByRole("combobox", { name: "해상도", exact: true }).selectOption("390x844");
  assert.deepEqual((await state()).content, { width: 390, height: 844 });
  await page.getByRole("textbox", { name: "새 분기점 ID", exact: true }).fill("tablet");
  await page.getByRole("region", { name: "반응형 편집" }).getByRole("button", { name: "추가", exact: true }).click();
  assert.equal((await state()).widths.login, 768);
  assert.equal(await page.getByRole("textbox", { name: "새 분기점 ID", exact: true }).inputValue(), "");
  if (process.env.VSB_MEASURE_PROJECT_VALIDATION === "1") {
    const measurements = await page.evaluate(async project => {
      const { validateProjectSpec, createCachedProjectValidator } = await import("/src/features/editor/schema/index.ts");
      const rows = [];
      for (const count of [1, 10, 50]) {
        const screen = structuredClone(project.pages.login);
        screen.nodes = { root: { ...screen.nodes.root, children: [] } };
        for (let i = 0; i < 200; i++) {
          screen.nodes[`text${i}`] = { ...project.pages.login.nodes.title, name: `Text${i}` };
          screen.nodes.root.children.push({ node: `text${i}` });
        }
        const candidate = { version: "0.3", name: "Measurement", pages: {}, pageOrder: [] };
        for (let i = 0; i < count; i++) { candidate.pages[`page${i}`] = structuredClone(screen); candidate.pageOrder.push(`page${i}`); }
        assertValid(candidate);
        function assertValid(value) { if (!validateProjectSpec(value).valid) throw Error("Invalid benchmark fixture"); }
        const cached = createCachedProjectValidator();
        const validationSamples = { full: [], cached: [] };
        cached(candidate);
        for (let i = 0; i < 40; i++) {
          const next = { ...candidate, pages: { ...candidate.pages, page0: { ...candidate.pages.page0, size: { ...candidate.pages.page0.size, width: 1000 + i } } } };
          const order = i % 2 ? ["full", "cached"] : ["cached", "full"];
          for (const mode of order) {
            const start = performance.now();
            const result = (mode === "full" ? validateProjectSpec : cached)(next);
            if (!result.valid) throw Error("Validator benchmark rejected valid edit");
            if (i >= 10) validationSamples[mode].push(performance.now() - start);
          }
        }
        for (const values of Object.values(validationSamples)) values.sort((a,b) => a-b);
        const validationOnly = Object.fromEntries(Object.entries(validationSamples).map(([mode, values]) => [mode, { p50ms: values[15], p95ms: values[28] }]));
        editor.getState().loadSpec(candidate);
        const samples = [];
        for (let i = 0; i < 40; i++) {
          const start = performance.now();
          if (!editor.getState().setPageField("page0", "size.width", 1000 + i, true)) throw Error("Benchmark edit rejected");
          if (i >= 10) samples.push(performance.now() - start);
        }
        samples.sort((a,b) => a-b);
        rows.push({ pages: count, nodes: count * 201, samples: samples.length, p50ms: samples[15], p95ms: samples[28], validationOnly });
      }
      return rows;
    }, project);
    console.log("MEASUREMENT synchronous validated GUI store edit (includes subscribers, excludes paint):", JSON.stringify(measurements));
  }
  assert.deepEqual(errors, []);
  console.log("PASS rejected presets/responsive edits retain document, view and input; effective kinds accessible; valid edits commit.");
} finally { try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); } }
