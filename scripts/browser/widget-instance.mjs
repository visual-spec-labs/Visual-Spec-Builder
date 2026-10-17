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
  const widget = project.pages.notificationWidget;
  widget.nodes = Object.fromEntries(Object.entries(widget.nodes).map(([id, node]) => [id === 'title' ? '__proto__' : id, node]));
  widget.nodes.root.children[0].node = '__proto__';
  widget.nodes.demoButton = structuredClone(project.pages.login.nodes.loginButton);
  widget.nodes.demoButton.action = undefined;
  const loginExample = JSON.parse(await readFile(new URL('../../examples/login-screen.json', import.meta.url), 'utf8'));
  widget.nodes.demoInput = structuredClone(Object.values(loginExample.screen.nodes).find(node => node.type === 'input'));
  widget.nodes.root.children.push({ node: 'demoButton' }, { node: 'demoInput' });
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
  assert.equal(await host.locator('button,input').count(), 0, 'canvas widget descendants are not native interactive controls');
  await host.click();
  await page.getByRole('textbox', { name: 'Title 내용 재정의' }).fill('맞춤 알림');
  await page.getByRole('textbox', { name: 'Title 내용 재정의' }).pressSequentially('!');
  await host.getByText('맞춤 알림!').waitFor();
  await sibling.getByText('새 알림').waitFor();
  assert.equal(await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages.notificationWidget.nodes.__proto__.content), '새 알림');
  assert.equal(await page.evaluate(async () => {
    const node = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages.login.nodes['instance-1'];
    return Object.hasOwn(node.overrides, '__proto__');
  }), true);
  assert.equal(await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().history.past.length), 3);
  const hex = page.getByRole('textbox', { name: 'Title 색 재정의 hex' });
  await hex.fill('#');
  assert.equal(await hex.inputValue(), '#', 'incomplete color stays in the draft');
  assert.equal(await page.evaluate(async () => {
    const node = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages.login.nodes['instance-1'];
    return Object.hasOwn(node.overrides.__proto__, 'color');
  }), false);
  await hex.fill('#445566');
  await hex.blur();
  assert.equal(await page.evaluate(async () => {
    const node = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages.login.nodes['instance-1'];
    return node.overrides.__proto__.color;
  }), '#445566');
  const beforeUndo = await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().history.past.length);
  assert.equal(beforeUndo, 4);
  await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().undo());
  await host.getByText('맞춤 알림!').waitFor();
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
