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
  for (const name of ["Alpha", "Beta"]) {
    await writeFile(join(specs, `${name}.json`), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name } }));
  }
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext();
  const [tabA, tabB] = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of [tabA, tabB]) page.setDefaultTimeout(10000);
  const errors = [];
  for (const page of [tabA, tabB]) page.on("pageerror", error => errors.push(error.message));
  const alphaCard = page => page.getByRole("button", { name: /Alpha.*파일: Alpha\.json/s });
  await tabA.goto(runner.url);
  await alphaCard(tabA).click();
  await tabA.getByRole("button", { name: "홈으로" }).waitFor();
  await tabA.waitForTimeout(700);
  await tabB.goto(runner.url);
  await alphaCard(tabB).click();
  await tabB.getByRole("button", { name: "홈으로" }).waitFor();
  await tabB.waitForTimeout(700);
  const draftEdit = await tabB.evaluate(async () => {
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    const state = useEditorStore.getState();
    const accepted = state.setPageField(state.activePageId, "name", "B recovered draft");
    return { accepted, name: useEditorStore.getState().spec.pages[state.activePageId].name };
  });
  assert.deepEqual(draftEdit, { accepted: true, name: "B recovered draft" }, "Tab B must contain a real unsaved page edit");
  // Let A's storage write arrive inside B's debounce window. B must preserve
  // its edit only in tab recovery instead of first publishing it to shared storage.
  await tabB.waitForTimeout(100);
  await tabA.evaluate(async () => {
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    const state = useEditorStore.getState();
    state.setPageField(state.activePageId, "name", "A latest autosave");
  });
  await tabA.waitForTimeout(700);
  const pausedBeforeReload = await tabB.evaluate(async () => {
    const { useSaveConflictStore } = await import("/src/features/editor/store/saveConflictStore.ts");
    const { readRecovery } = await import("/src/features/editor/store/specStorage.ts");
    return { paused: useSaveConflictStore.getState().paused,
      name: readRecovery()?.document.spec.pages[Object.keys(readRecovery().document.spec.pages)[0]].name };
  });
  assert.deepEqual(pausedBeforeReload, { paused: true, name: "B recovered draft" }, "A's autosave must preserve B's pre-debounce draft");
  await tabB.reload();
  await alphaCard(tabB).waitFor();
  assert.equal(await tabB.getByRole("alertdialog").count(), 0, "Home remains usable after restoring a conflicted tab");
  await alphaCard(tabB).click();
  await tabB.getByRole("button", { name: "홈으로" }).waitFor();
  await tabB.getByRole("alertdialog").waitFor();
  const recovered = await tabB.evaluate(async () => {
    const { readRecovery } = await import("/src/features/editor/store/specStorage.ts");
    return readRecovery()?.document.spec.pages[Object.keys(readRecovery().document.spec.pages)[0]].name;
  });
  assert.equal(recovered, "B recovered draft", "opening the same project must preserve the tab's recovered draft");

  // The conflict dialog covers Editor navigation. Return to Home with the
  // protected recovery intact, as a reload-restored tab does.
  await tabB.evaluate(async () => {
    const { useNavigationStore } = await import("/src/features/editor/store/navigationStore.ts");
    useNavigationStore.getState().openHome();
  });
  await tabB.getByRole("button", { name: /Beta.*파일: Beta\.json/s }).click();
  await tabB.getByRole("button", { name: "홈으로" }).waitFor();
  assert.equal(await tabB.getByRole("alertdialog").count(), 0, "a different project does not inherit Alpha's conflict");
  const archived = await tabB.evaluate(async () => {
    const { readArchivedRecovery } = await import("/src/features/editor/store/specStorage.ts");
    return readArchivedRecovery("Alpha.json")?.document.spec.pages;
  });
  assert.equal(Object.values(archived ?? {})[0]?.name, "B recovered draft", "switching projects archives Alpha's conflicted draft");
  const editable = await tabB.evaluate(async () => {
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    const { useDocumentStore } = await import("/src/features/editor/store/documentStore.ts");
    const { useSaveConflictStore } = await import("/src/features/editor/store/saveConflictStore.ts");
    const state = useEditorStore.getState();
    state.setPageField(state.activePageId, "name", "Beta editable");
    return { fileName: useDocumentStore.getState().fileName, paused: useSaveConflictStore.getState().paused,
      name: useEditorStore.getState().spec.pages[state.activePageId].name };
  });
  assert.deepEqual(editable, { fileName: "Beta.json", paused: false, name: "Beta editable" });
  await tabB.getByRole("button", { name: "홈으로" }).click();
  await alphaCard(tabB).waitFor();
  assert.equal(await tabB.getByRole("alertdialog").count(), 0, "returning Home after editing Beta stays unblocked");
  await alphaCard(tabB).click();
  await tabB.getByRole("alertdialog").waitFor();
  const restoredArchived = await tabB.evaluate(async () => {
    const { useEditorStore } = await import("/src/features/editor/store/editorStore.ts");
    const state = useEditorStore.getState();
    const beta = JSON.parse(localStorage.getItem("visual-spec:autosave:file:beta.json") ?? "null");
    return { restoredAlpha: state.spec.pages[state.activePageId].name,
      preservedBeta: beta?.spec.pages[Object.keys(beta.spec.pages)[0]].name };
  });
  assert.deepEqual(restoredArchived, { restoredAlpha: "B recovered draft", preservedBeta: "Beta editable" },
    "restoring archived Alpha must settle and preserve Beta's pending edit first");
  assert.deepEqual(errors, []);
  console.log("PASS real two-tab conflict recovery preserves Alpha draft and keeps Beta editable");
  await context.close();
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
