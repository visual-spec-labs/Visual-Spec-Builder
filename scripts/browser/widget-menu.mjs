// Widget insert and context actions through the visible GUI. Deterministic fixture only.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowserWorkspace } from './harness.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'vs-widget-menu-'));
let runner;
try {
  await mkdir(join(workspace, 'specs'));
  const project = JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json', import.meta.url), 'utf8'));
  project.name = 'WidgetMenuProject';
  const login = project.pages.login;
  const root = login.nodes.root;
  login.nodes.card = { ...structuredClone(root), name: 'Card', box: { width: 200, height: 100 }, children: [] };
  root.children.push({ node: 'card' });
  await writeFile(join(workspace, 'specs/widget-menu.json'), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole('button').filter({ hasText: /WidgetMenuProject.*페이지/s }).click();
  const card = page.locator('[data-node-id="card"]');
  await card.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '위젯으로 만들기' }).click();
  let state = await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState());
  assert.equal(state.spec.pages.login.nodes.card.type, 'instance');
  await page.getByRole('button', { name: '삽입' }).click();
  await page.getByRole('menuitem', { name: /위젯: Card \(widget-1\)/ }).click();
  state = await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState());
  assert.equal(state.spec.pages.login.nodes[state.selectedId].ref, 'widget-1');
  await page.locator('[data-node-id="card"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '원본 위젯으로 이동' }).click();
  assert.equal(await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().activePageId), 'widget-1');
  await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().selectPage('login'));
  await page.locator('[data-node-id="card"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: '인스턴스 분리' }).click();
  assert.equal(await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages.login.nodes.card.type), 'frame');
  await page.getByRole('button', { name: '삽입' }).click();
  await page.getByRole('menuitem', { name: /위젯: Card \(widget-1\)/ }).waitFor();
  await page.evaluate(async () => {
    const editor = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore;
    editor.getState().undo(); // detach
    editor.getState().undo(); // insert
    editor.getState().undo(); // extract: the widget no longer exists
  });
  await page.getByRole('menuitem', { name: /위젯: Card \(widget-1\)/ }).waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PASS widget insert, context extract/detach, source navigation, open-menu Undo (fixture; no real AI)');
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
