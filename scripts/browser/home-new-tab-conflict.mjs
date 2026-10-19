// Home remains usable when a restored session has a pending save conflict.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startBrowserWorkspace } from "./harness.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "vs-home-conflict-"));
let runner;
try {
  const specs = join(workspace, "specs");
  await mkdir(specs);
  const fixture = JSON.parse(await readFile(join(repo, "examples/dashboard-cards.json"), "utf8"));
  await writeFile(join(specs, "Alpha.json"), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name: "Alpha" } }));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  const card = page.getByRole("button", { name: /Alpha.*파일: Alpha\.json/s });
  await card.waitFor();
  await page.evaluate(async () => {
    const { useSaveConflictStore } = await import("/src/features/editor/store/saveConflictStore.ts");
    useSaveConflictStore.getState().pause();
  });
  assert.equal(await page.getByRole("alertdialog").count(), 0, "Home must not be blocked by the editor conflict dialog");
  await card.click();
  await page.getByRole("button", { name: "홈으로" }).waitFor();
  await page.getByRole("alertdialog").waitFor();
  assert.equal(await page.getByRole("heading", { name: "다른 탭에서 이 프로젝트를 변경했습니다" }).count(), 1);
  assert.deepEqual(errors, []);
  console.log("PASS conflicted restored session leaves Home usable and retains conflict protection after opening a project");
  await context.close();
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
