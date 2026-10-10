// Real HTTP and two Chromium tabs: equal bytes do not prove historical ownership.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";
const workspace = await mkdtemp(join(tmpdir(), "vs-recovery-provenance-"));
// shop.json 프로젝트의 page1 생성 자리(#281).
const file = "shop/page1/components/Header.tsx";
const target = join(workspace, "generated", file);
const old = "export function Header() { return <header>old</header>; }\n";
const next = "export function Header() { return <header>same A and B</header>; }\n";
let runner;
try {
  await mkdir(join(workspace, "generated/shop/page1/components"), { recursive: true });
  await writeFile(target, old);
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext();
  const errors = [];
  async function tab() {
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(runner.url);
    await page.evaluate(async () => {
      window.editor = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore;
      window.tickets = (await import('/src/features/editor/store/ticketStore.ts')).useTicketStore;
      window.runner = await import('/src/features/editor/ui/ticketRunner.ts');
      editor.getState().loadSpec((await import('/src/features/editor/store/seedSpec.ts')).seedSpec);
      (await import('/src/features/editor/store/documentStore.ts')).useDocumentStore.setState({ fileName: 'shop.json' });
      (await import('/src/features/editor/store/navigationStore.ts')).useNavigationStore.getState().openEditor();
      window.saveConflict = (await import('/src/features/editor/store/saveConflictStore.ts')).useSaveConflictStore;
      window.persistence = (await import('/src/features/editor/store/persistenceStatusStore.ts')).usePersistenceStatusStore;
    });
    // 두 탭이 같은 shop.json 자동저장 키를 쓴다. 앞 탭의 첫 자동저장(500ms 디바운스)이 끝나기 전에 뒤 탭이
    // 기준을 읽으면 뒤 탭은 같은 내용이어도 "다른 탭에서 이 프로젝트를 변경했습니다"로 멈추고 그 대화상자가
    // 덮어쓰기 확인 라디오를 가린다(#359, docs/28 5절 4번). 뒤 탭 준비가 앞 탭 준비 뒤 500ms 안에 끝나면
    // 생기는 순서라 실행 속도에 달렸고 OS와 무관하다. 이 탭의 내용이 공용 자동저장에 반영된 뒤 다음 탭을 연다.
    await page.waitForFunction(() => persistence.getState().draft?.shared === true);
    return page;
  }
  const a = await tab(), b = await tab();
  // 준비 순서가 바뀌어 충돌 대화상자가 떠 있으면 라디오 timeout 대신 원인을 바로 보인다.
  for (const page of [a, b]) assert.equal(await page.evaluate(() => saveConflict.getState().paused), false, 'fixture: save conflict dialog');
  async function start(page, text) {
    await page.evaluate(() => {
      const { activePageId, spec } = editor.getState();
      tickets.getState().compile(activePageId, spec.pages[activePageId]);
      window.run = runner.runOneTicket('Header');
    });
    await page.waitForFunction(() => tickets.getState().wait?.phase === 'waiting');
    const request = JSON.parse(await readFile(join(workspace, 'runtime/ticket-request.json'), 'utf8'));
    const output = join(workspace, request.tickets[0].outputPath);
    await mkdir(join(output, '..'), { recursive: true });
    await writeFile(output, text);
    await writeFileAtomic(join(workspace, request.responsePath), JSON.stringify({ protocol: request.protocol, requestId: request.id, results: [{ticketId:'Header',status:'done'}] }));
    return request;
  }
  async function settle(page) {
    await page.waitForFunction(() => tickets.getState().overwriteReview !== null || !tickets.getState().running);
    if (await page.evaluate(() => tickets.getState().overwriteReview !== null)) {
      await page.getByRole('radio', { name: '백업 후 덮어쓰기', exact: true }).check();
      await page.getByRole('button', { name: '선택대로 적용 (덮어쓰기 1개)', exact: true }).click();
    }
    await page.evaluate(() => window.run);
  }
  await start(a, old);
  await settle(a);
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  let entered;
  const reached = new Promise(resolve => { entered = resolve; });
  await a.route('**/__vs/file/generated/shop/page1/components/Header.tsx', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    entered();
    await gate;
    await route.fulfill({ status: 503, headers: response.headers(), body: JSON.stringify({ error: 'fixture: applied A, response lost' }) });
  });
  const requestA = await start(a, next);
  await reached;
  assert.equal(await readFile(target, 'utf8'), next);
  const lockPath = join(workspace, 'runtime/.ticket-request.lock');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  assert.equal(lock.owner, requestA.id);
  await writeFileAtomic(lockPath, JSON.stringify({ ...lock, expiresAt: Date.now() - 1 }));
  const requestB = await start(b, next);
  await settle(b);
  unblock();
  await a.evaluate(() => window.run);
  await a.unroute('**/__vs/file/generated/shop/page1/components/Header.tsx');
  const manifest = async () => JSON.parse(await readFile(join(workspace, 'runtime/generation-manifest.json'), 'utf8'));
  assert.equal(await readFile(target, 'utf8'), next);
  assert.equal((await manifest()).entries[file].requestId, requestB.id);
  await a.getByRole('button', { name: '마지막 적용 되돌리기', exact: true }).click();
  await a.waitForFunction(() => !tickets.getState().running);
  assert.equal(await readFile(target, 'utf8'), next);
  assert.equal((await manifest()).entries[file].requestId, requestB.id);
  console.log('PASS A applied/lost lease -> B accepts identical bytes -> A compensation and recovery retry preserve B bytes and manifest');

  const latest = next + '// another normal generation\n';
  await start(a, latest);
  await settle(a);
  const newerB = await start(b, latest);
  await settle(b);
  await a.getByRole('button', { name: '마지막 적용 되돌리기', exact: true }).click();
  await a.waitForFunction(() => !tickets.getState().running);
  assert.equal(await readFile(target, 'utf8'), latest);
  assert.equal((await manifest()).entries[file].requestId, newerB.id);
  assert.deepEqual(errors, []);
  console.log('PASS manual undo of older successful A refuses identical bytes reaccepted by B; page errors 0');
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
