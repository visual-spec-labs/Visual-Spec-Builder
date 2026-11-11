// #448 A-7: an image path edit commits on blur, so typing does not request every prefix.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_BIN=/usr/bin/chromium \
//   node scripts/browser/issue448-a7-image-path.mjs
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-448-a7-"));
let runner;
try {
  await mkdir(join(workspace, "specs"), { recursive: true });
  const project = JSON.parse(await readFile(new URL("../../test/fixtures/screen-relations-project.json", import.meta.url), "utf8"));
  project.name = "A7Path";
  project.pages.login.nodes.picture = {
    type: "image", name: "PathImage", box: { width: 200, height: 100 }, src: "assets/original.png", fit: "cover",
  };
  project.pages.login.nodes.root.children.push({ node: "picture" });
  await writeFile(join(workspace, "specs/a7.json"), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const requested = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/__vs/file/assets/")) requested.push(request.url());
  });
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /A7Path.*페이지/s }).click();
  await page.getByRole("button", { name: "PathImage", exact: true }).click();
  await page.getByRole("textbox", { name: "경로 (src)" }).waitFor();
  await page.waitForTimeout(150);
  requested.length = 0;

  const field = page.getByRole("textbox", { name: "경로 (src)" });
  const fieldId = await field.getAttribute("id");
  await field.fill("");
  await field.pressSequentially("assets/replacement.png", { delay: 25 });
  assert.deepEqual(requested, [], "typing must not request partial path prefixes");
  const beforeCommit = await page.evaluate(async () => {
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    return useEditorStore.getState().spec.pages.login.nodes.picture.src;
  });
  assert.equal(beforeCommit, "assets/original.png");

  await field.press("Tab");
  await page.waitForFunction(id => document.activeElement?.id !== id, fieldId);
  await page.waitForTimeout(100);
  assert.deepEqual(requested.map(url => new URL(url).pathname), ["/__vs/file/assets/replacement.png"]);
  const afterCommit = await page.evaluate(async () => {
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    return useEditorStore.getState().spec.pages.login.nodes.picture.src;
  });
  assert.equal(afterCommit, "assets/replacement.png");
  console.log("PASS A-7: path typing issued 0 requests; blur committed the path with 1 request");
  await context.close();
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
