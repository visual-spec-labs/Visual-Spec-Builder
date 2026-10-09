// 수동 fixture만 사용한다. 에이전트·모델 프로세스는 실행하지 않는다.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-export-journey-"));
let runner;
try {
  for (const dir of ["specs", "assets", "generated/pages"]) await mkdir(join(workspace, dir), { recursive: true });
  const fixture = JSON.parse(await readFile(new URL("../../examples/image-hero.json", import.meta.url), "utf8"));
  const project = { version: fixture.version, name: "Journey", pageOrder: ["alpha", "beta"], pages: {
    alpha: { ...fixture.screen, name: "Alpha" }, beta: { ...fixture.screen, name: "Beta" },
  } };
  await writeFile(join(workspace, "specs/customer-copy.json"), JSON.stringify(project));
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await writeFile(join(workspace, "assets/hero.png"), image);
  for (const name of ["Alpha", "Beta"]) await writeFile(join(workspace, `generated/pages/${name}.tsx`),
    `import hero from "../assets/hero.png"; export default function ${name}() { return <img src={hero} alt="fixture" />; }`);

  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], downloads = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("download", download => downloads.push(download));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /Journey.*페이지/s }).click();
  await page.getByRole("button", { name: "File", exact: true }).waitFor();
  // 문서 신원 단언을 위해 상태를 읽는다. 아래 사용자 조작은 GUI로 실행한다.
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.documentStore = (await import("/src/features/editor/store/documentStore.ts")).useDocumentStore;
    window.exports = (await import("/src/features/editor/store/exportStore.ts")).useExportStore;
  });
  const snapshot = () => page.evaluate(() => ({ spec: editor.getState().spec,
    documentId: editor.getState().documentId, fileName: documentStore.getState().fileName,
    history: editor.getState().history }));
  const before = await snapshot();
  assert.equal(before.fileName, "customer-copy.json");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export Code", exact: true }).click();
  await page.waitForFunction(() => exports.getState().status === "ready");
  assert.equal(await page.evaluate(() => exports.getState().target.pageId), "alpha");
  await page.getByRole("button", { name: "Beta", exact: true }).click();
  await page.getByText(/이전 검사 결과를 지웠습니다/).waitFor();
  assert.equal(await page.getByRole("button", { name: "결과 폴더 ZIP 내려받기", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => exports.getState().report), null);
  await page.getByRole("button", { name: "다시 검사", exact: true }).click();
  await page.waitForFunction(() => exports.getState().status === "ready");
  assert.equal(await page.evaluate(() => exports.getState().target.pageId), "beta");
  before.history.present.activePageId = "beta";
  assert.deepEqual(await snapshot(), before);
  console.log("PASS Export page switch invalidates old results; rescan targets Beta and preserves document identity/history");

  // 검사 성공 후 다운로드 전에 실제 자산 파일이 사라지는 상황을 재현한다.
  await rm(join(workspace, "assets/hero.png"));
  await page.getByRole("button", { name: "결과 폴더 ZIP 내려받기", exact: true }).click();
  await page.getByRole("alert").getByText("hero.png", { exact: true }).waitFor();
  assert.equal(downloads.length, 0);
  await writeFile(join(workspace, "assets/hero.png"), image);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "전체 ZIP 다시 시도", exact: true }).click();
  const download = await downloadEvent;
  const bytes = await readFile(await download.path());
  // 현재 ZIP의 비압축 항목에서 파일명과 실제 바이트를 확인한다.
  const entries = new Map();
  for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const size = bytes.readUInt32LE(offset + 18), length = bytes.readUInt16LE(offset + 26);
    const start = offset + 30 + length + bytes.readUInt16LE(offset + 28);
    entries.set(bytes.subarray(offset + 30, offset + 30 + length).toString(), bytes.subarray(start, start + size));
    offset = start + size;
  }
  const asset = [...entries].find(([name]) => name.endsWith("/assets/hero.png"));
  assert.ok(asset, "ZIP must contain restored asset");
  assert.deepEqual(asset[1], image);
  assert.ok([...entries.keys()].some(name => name.endsWith("/pages/Beta.tsx")));
  assert.match(download.suggestedFilename(), /Journey/i);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(errors, []);
  assert.equal(downloads.length, 1);
  console.log("PASS missing asset blocks download; retry reads restored bytes into ZIP; no document mutation or page errors");
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
