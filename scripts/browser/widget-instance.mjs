// Deterministic widget GUI journey; no model request.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowserWorkspace } from './harness.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'vs-widget-instance-'));
let runner;
try {
  await mkdir(join(workspace, 'specs'));
  const project = JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json', import.meta.url), 'utf8'));
  project.name = 'WidgetProject';
  await writeFile(join(workspace, 'specs/widgets.json'), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole('button').filter({ hasText: /WidgetProject.*페이지/s }).click();
  await page.getByRole('button', { name: '파일', exact: true }).waitFor();
  await page.getByRole('combobox', { name: '위젯 배치' }).selectOption('notificationWidget');
  const host = page.locator('[data-node-id="instance-1"]');
  await host.getByText('새 알림').waitFor();
  await page.getByRole('combobox', { name: '위젯 배치' }).selectOption('notificationWidget');
  const sibling = page.locator('[data-node-id="instance-2"]');
  await sibling.getByText('새 알림').waitFor();
  await host.click();
  await page.getByRole('textbox', { name: 'Title 내용 재정의' }).fill('맞춤 알림');
  await host.getByText('맞춤 알림').waitFor();
  await sibling.getByText('새 알림').waitFor();
  assert.equal(await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages.notificationWidget.nodes.title.content), '새 알림');
  const beforeUndo = await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().history.past.length);
  assert.equal(beforeUndo, 3);
  await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().undo());
  await host.getByText('새 알림').waitFor();
  await page.getByRole('button', { name: '파일', exact: true }).click();
  await page.getByRole('menuitem', { name: '저장', exact: true }).click();
  await page.locator('[role="status"][aria-label="저장 상태"]').filter({ hasText: '파일 저장됨' }).waitFor();
  await page.reload();
  await page.getByRole('button').filter({ hasText: /WidgetProject.*페이지/s }).click();
  await page.locator('[data-node-id="instance-1"]').getByText('새 알림').waitFor();
  await page.locator('[data-node-id="instance-2"]').getByText('새 알림').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS widget GUI insert, source render, override, Undo, save and reopen (fixture; no real AI)');
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
