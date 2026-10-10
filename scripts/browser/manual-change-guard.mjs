// #282: real Vite HTTP + Chromium, with a fixture agent (no model invocation).
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-guard-"));
const target = join(workspace, "generated/components/Header.tsx");
const original = Buffer.from('\ufeffexport function Header() { return <header>manual</header>; }\r\n');
const next = 'export function Header() { return <header>new</header>; }\n';
let runner;
try {
  await mkdir(join(workspace, "generated/components"), { recursive: true });
  await writeFile(target, original);
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(runner.url);
  await page.evaluate(async () => {
    const { useEditorStore } = await import('/src/features/editor/store/editorStore.ts');
    const { useTicketStore } = await import('/src/features/editor/store/ticketStore.ts');
    const { useDocumentStore } = await import('/src/features/editor/store/documentStore.ts');
    const { seedSpec } = await import('/src/features/editor/store/seedSpec.ts');
    const runner = await import('/src/features/editor/ui/ticketRunner.ts');
    useEditorStore.getState().loadSpec(seedSpec);
    (await import('/src/features/editor/store/navigationStore.ts')).useNavigationStore.getState().openEditor();
    useDocumentStore.setState({ fileName: 'shop.json' });
    const state = useEditorStore.getState();
    useTicketStore.getState().compile(state.activePageId, state.spec.pages[state.activePageId]);
    window.guard = { tickets: useTicketStore, runner };
    window.run = runner.runOneTicket('Header');
  });
  async function respond() {
    let request;
    for (let i = 0; i < 150; i++) {
      try { request = JSON.parse(await readFile(join(workspace, 'runtime/ticket-request.json'), 'utf8')); break; } catch { await new Promise(r => setTimeout(r, 50)); }
    }
    assert.ok(request);
    const dir = join(workspace, 'staging', request.id, 'components');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'Header.tsx'), next);
    await writeFileAtomic(join(workspace, 'runtime/ticket-response.json'), JSON.stringify({ protocol: request.protocol, requestId: request.id, results: [{ ticketId: 'Header', status: 'done' }] }));
    await page.waitForFunction(() => window.guard.tickets.getState().overwriteReview !== null);
  }
  await respond();
  // The actual panel must be visible, not just store state.
  await page.getByRole('region', { name: '덮어쓰기 전 확인' }).waitFor();
  assert.deepEqual(await readFile(target), original);
  await page.getByRole('button', { name: '전체 취소', exact: true }).click();
  await page.evaluate(() => window.run);
  assert.deepEqual(await readFile(target), original);
  await page.evaluate(() => { window.run = window.guard.runner.runOneTicket('Header'); });
  await respond();
  await page.getByRole('radio', { name: '백업 후 덮어쓰기', exact: true }).check();
  await page.getByRole('button', { name: '선택대로 적용 (덮어쓰기 1개)', exact: true }).click();
  await page.evaluate(() => window.run);
  assert.equal(await readFile(target, 'utf8'), next);
  const run = await page.evaluate(() => window.guard.tickets.getState().lastRun);
  assert.deepEqual(await readFile(join(workspace, run.backupRoot, 'files/components/Header.tsx')), original);
  await page.getByRole('button', { name: '마지막 적용 되돌리기', exact: true }).click();
  await page.waitForFunction(() => !window.guard.tickets.getState().running);
  assert.deepEqual(await readFile(target), original);
  assert.deepEqual(errors, []);
  console.log('PASS #282 actual review, cancel, retry, overwrite, BOM/CRLF backup, undo, page errors 0');
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
