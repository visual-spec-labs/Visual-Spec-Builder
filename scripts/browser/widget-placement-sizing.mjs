// #474: real GUI extraction/placement across desktop/mobile pages. Fixture only.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowserWorkspace } from './harness.mjs';
const workspace = await mkdtemp(join(tmpdir(), 'vs-widget-sizing-'));
let runner;
try {
  await mkdir(join(workspace, 'specs'));
  const project = JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json', import.meta.url), 'utf8'));
  project.name = 'WidgetSizing';
  const source = project.pages.login;
  source.size = { width: 1440, height: 900 };
  const boxes = [{ width: 'fill', height: 'auto' }, { width: 'auto', height: 'auto' }, { width: 240, height: 72 }];
  source.nodes.root.children = [];
  for (const [i, box] of boxes.entries()) {
    source.nodes[`card${i}`] = { ...structuredClone(source.nodes.root), name: `Card${i}`, box, children: [{ node: `label${i}` }] };
    source.nodes[`label${i}`] = { ...structuredClone(source.nodes.title), name: `Label${i}`, content: 'Header', box: { width: 'auto', height: 'auto' } };
    source.nodes.root.children.push({ node: `card${i}` });
  }
  source.nodes = Object.fromEntries(Object.entries(source.nodes).filter(([id]) => id === source.root || /^card[0-2]$|^label[0-2]$/.test(id)));
  const target = project.pages.dashboard;
  target.size = { width: 390, height: 844 };
  target.nodes.root.children = [];
  target.nodes = { root: target.nodes.root };
  await writeFile(join(workspace, 'specs/sizing.json'), JSON.stringify(project));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole('button').filter({ hasText: /WidgetSizing.*페이지/s }).click();
  const state = () => page.evaluate(async () => {
    const { spec, selectedId, activePageId } = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState();
    return { spec, selectedId, activePageId };
  });
  const refs = [];
  for (let i = 0; i < boxes.length; i++) {
    await page.getByRole('button', { name: `Card${i}`, exact: true }).click();
    await page.getByRole('button', { name: '위젯으로 추출', exact: true }).click();
    const current = await state();
    refs.push(current.spec.pages.login.nodes[`card${i}`].ref);
    assert.deepEqual(current.spec.pages[refs[i]].defaultInstanceBox, boxes[i]);
  }
  await page.getByRole('button', { name: `${target.name}, 화면 종류: page`, exact: true }).click();
  for (let i = 0; i < boxes.length; i++) {
    await page.getByRole('combobox', { name: '위젯 배치' }).selectOption(refs[i]);
    const current = await state();
    assert.deepEqual(current.spec.pages.dashboard.nodes[current.selectedId].box, boxes[i]);
    const element = page.locator(`[data-node-id="${current.selectedId}"]`).first();
    const measured = await element.evaluate(el => ({ width: parseFloat(getComputedStyle(el).width), height: parseFloat(getComputedStyle(el).height) }));
    assert.ok(measured.width <= 390, JSON.stringify(measured));
    assert.ok(measured.height < 200, JSON.stringify(measured));
    await page.getByRole('button', { name: '되돌리기', exact: true }).click();
    assert.equal((await state()).spec.pages.dashboard.nodes[current.selectedId], undefined);
    await page.getByRole('button', { name: '다시 실행', exact: true }).click();
    assert.deepEqual((await state()).spec.pages.dashboard.nodes[current.selectedId].box, boxes[i]);
  }
  await page.getByRole('button', { name: '파일', exact: true }).click();
  await page.getByRole('menuitem', { name: '저장', exact: true }).click();
  await page.locator('[role="status"][aria-label="저장 상태"]').filter({ hasText: '파일 저장됨' }).waitFor();
  const saved = JSON.parse(await readFile(join(workspace, 'specs/sizing.json'), 'utf8'));
  for (let i = 0; i < boxes.length; i++) assert.deepEqual(saved.pages[refs[i]].defaultInstanceBox, boxes[i]);
  assert.deepEqual(errors, []);
  console.log('PASS Fill/Hug, Hug/Hug, fixed extraction and mobile placement, measured dimensions, Undo/Redo and saved defaults (fixture)');
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
