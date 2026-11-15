// Atomic frame extraction and responsive-preserving detach. Deterministic fixture only.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowserWorkspace } from './harness.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'vs-widget-command-'));
let runner;
try {
  await mkdir(join(workspace, 'specs'));
  const project = JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json', import.meta.url), 'utf8'));
  project.name = 'ExtractProject';
  const login = project.pages.login;
  const root = login.nodes.root;
  login.nodes.card = { ...structuredClone(root), name: 'Card', box: { width: 200, height: 100 }, children: [{ node: 'title' }] };
  root.children = [{ node: 'card' }, ...root.children.filter(child => child.node !== 'title')];
  login.responsive = { breakpoints: { wide: { minWidthPx: 700 } }, overrides: { wide: { card: { box: { width: 240 } }, title: { color: '#112233' } } } };
  await writeFile(join(workspace, 'specs/extract.json'), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole('button').filter({ hasText: /ExtractProject.*페이지/s }).click();
  const card = page.locator('[data-node-id="card"]');
  await page.getByRole('button', { name: 'Card', exact: true }).click();
  await page.getByRole('combobox', { name: '반응형 편집 기준' }).selectOption('');
  await page.getByRole('button', { name: '위젯으로 추출' }).click();
  await page.getByRole('button', { name: '위젯 연결 해제' }).waitFor();
  const extracted = await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec);
  assert.equal(extracted.pages.login.nodes.card.type, 'instance');
  assert.equal(extracted.pages['widget-1'].kind, 'widget');
  assert.equal(extracted.pages.login.responsive.overrides.wide.card.box.width, 240);
  await card.getByText('로그인').waitFor();
  await page.getByRole('button', { name: '위젯 연결 해제' }).click();
  await page.getByRole('button', { name: '위젯으로 추출' }).waitFor();
  const detached = await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec);
  assert.equal(detached.pages.login.nodes.card.type, 'frame');
  assert.equal(detached.pages.login.responsive.overrides.wide.card.box.width, 240);
  assert.equal(detached.pages['widget-1'].nodes.title.content, '로그인');
  await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().undo());
  await page.getByRole('button', { name: 'Card', exact: true }).click();
  await page.getByRole('button', { name: '위젯 연결 해제' }).waitFor();
  await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().undo());
  assert.equal(await page.evaluate(async () => (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec.pages['widget-1']), undefined);
  assert.deepEqual(errors, []);
  console.log('PASS widget GUI extract, responsive split, detach, source retention, atomic Undo (fixture; no real AI)');
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
