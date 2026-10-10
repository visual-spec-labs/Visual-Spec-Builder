// Real Chromium + workspace HTTP; no model. Regression for #281 registry corruption and pending rename.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, unlink, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startBrowserWorkspace } from './harness.mjs';
const workspace = await mkdtemp(join(tmpdir(), 'vsb-generation-ownership-'));
await mkdir(join(workspace, 'specs'));
const fixture = JSON.parse(await readFile(new URL('../../examples/dashboard-cards.json', import.meta.url), 'utf8'));
for (const name of ['a', 'b', 'c'])
    await writeFile(join(workspace, `specs/${name}.json`), JSON.stringify({ ...fixture, screen: { ...fixture.screen, name } }));
const runner = await startBrowserWorkspace(workspace);
try {
    const context = await runner.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(runner.url);
    async function init() {
        await page.evaluate(async () => {
            window.gt = await import('/src/features/editor/ui/generationTarget.ts');
            window.ex = await import('/src/features/editor/ui/exportGeneratedCode.ts');
            window.seed = (await import('/src/features/editor/store/seedSpec.ts')).seedSpec.screen;
            window.compile = (await import('/src/features/editor/ticket/compileTickets.ts')).compileTickets;
            window.owner = n => ({ fileName: n, documentId: 1, pageId: 'page1', projectPageIds: ['page1'] });
            window.scan = n => ex.scanGeneratedCode(seed, 'page1', owner(n));
            window.zip = async (s) => { let captured; const original = URL.createObjectURL; URL.createObjectURL = b => { captured = b; return 'blob:fixture'; }; const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = () => { }; try {
                const result = await ex.downloadGeneratedBundle('audit', s.files, s.report, compile(seed));
                return { result, text: captured ? await captured.text() : null };
            }
            finally {
                URL.createObjectURL = original;
                HTMLAnchorElement.prototype.click = click;
            } };
        });
    }
    await init();
    async function generate(n, mark) { const r = await page.evaluate(n => gt.ensureGenerationTarget(owner(n)), n); assert.equal(r.ok, true); const file = join(workspace, 'generated', r.target.root, 'pages/Home.tsx'); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, `export default function Home(){return null} // ${mark}`); return r.target; }
    const p1 = await generate('my shop.json', 'FOREIGN_SPACE');
    const p2 = await generate('my-shop.json', 'OWN_DASH');
    assert.equal(p1.root, 'my-shop/page1');
    assert.equal(p2.root, 'my-shop-2/page1');
    const manifestPath = join(workspace, 'runtime/generation-manifest.json');
    const valid = JSON.parse(await readFile(manifestPath, 'utf8'));
    const baseline = await page.evaluate(async () => { const s = await scan('my-shop.json'); return { kind: s.kind, location: s.location, zip: await zip(s) }; });
    assert.ok(baseline.zip.text.includes('OWN_DASH'));
    assert.ok(!baseline.zip.text.includes('FOREIGN_SPACE'));
    for (const [label, body] of [['entries-null', { ...valid, entries: null }], ['projects-null', { protocol: 2, projects: null, entries: {} }]]) {
        await writeFile(manifestPath, JSON.stringify(body));
        const result = await page.evaluate(async () => { const s = await scan('my-shop.json'); return { kind: s.kind, location: s.location, zip: s.kind === 'ready' ? await zip(s) : null }; });
        assert.equal(result.kind, 'unavailable');
        assert.equal(result.zip, null);
        console.log('PASS malformed registry blocks Export and ZIP', label);
    }
    // Real 404 and valid empty registries retain direct-to-react fallback.
    for (const body of [null, { protocol: 1, entries: {} }, { protocol: 2, projects: {}, entries: {} }]) {
        if (body === null)
            await unlink(manifestPath);
        else
            await writeFile(manifestPath, JSON.stringify(body));
        const result = await page.evaluate(async () => { const s = await scan('my shop.json'); return { kind: s.kind, zip: await zip(s) }; });
        assert.equal(result.kind, 'ready');
        assert.ok(result.zip.text.includes('FOREIGN_SPACE'));
    }
    console.log('PASS confirmed 404 / valid v1 / valid unregistered v2 direct output ZIP');
    await writeFile(manifestPath, JSON.stringify(valid));
    const a = await generate('a.json', 'A_KNOWN');
    const b = await generate('b.json', 'B_STALE');
    await generate('c.json', 'C_STALE');
    await unlink(join(workspace, 'specs/b.json'));
    await unlink(join(workspace, 'specs/c.json'));
    await page.reload();
    await init();
    await page.evaluate(async () => { window.held = await (await import('/src/features/editor/ui/agentRequestLock.ts')).holdRequestLock('ticket', 'audit-holder'); });
    await page.getByRole('button', { name: 'a 이름 변경', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('textbox').fill('b');
    await page.getByRole('alertdialog').locator('button[type=submit]').click();
    await page.waitForFunction(() => document.body.innerText.includes('생성 기록') && document.body.innerText.includes('다음'));
    console.log('PASS actual Home rename warning visible', await page.locator('body').innerText().then(t => t.split('\n').filter(s => s.includes('생성 기록') || s.includes('다음')).join(' ')));
    assert.ok(JSON.parse(await readFile(join(workspace, 'specs/b.json'), 'utf8')));
    const renamed = await page.evaluate(async () => { const s = await scan('b.json'); return { kind: s.kind, location: s.location, zip: await zip(s) }; });
    assert.equal(renamed.location.projectId, a.projectId);
    assert.ok(renamed.zip.text.includes('A_KNOWN'));
    assert.ok(!renamed.zip.text.includes('B_STALE'));
    // Rename B→C while the same lock remains held: provenance must still resolve A.
    await page.getByRole('button', { name: 'b 이름 변경', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('textbox').fill('c');
    await page.getByRole('alertdialog').locator('button[type=submit]').click();
    await page.getByRole('button', { name: 'c 이름 변경', exact: true }).waitFor();
    const chained = await page.evaluate(async () => { const s = await scan('c.json'); return { location: s.location, zip: await zip(s) }; });
    assert.equal(chained.location.projectId, a.projectId);
    assert.ok(chained.zip.text.includes('A_KNOWN'));
    assert.ok(!/B_STALE|C_STALE/.test(chained.zip.text));
    await page.evaluate(() => held.release());
    const next = await page.evaluate(() => gt.ensureGenerationTarget(owner('c.json')));
    assert.equal(next.target.projectId, a.projectId);
    assert.notEqual(next.target.projectId, b.projectId);
    const recovered = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(recovered.projects[a.projectId].fileName, 'c.json');
    assert.equal(Object.values(recovered.projects).filter(p => p.fileName === 'c.json').length, 1);
    assert.ok((await readFile(join(workspace, 'generated/b/page1/pages/Home.tsx'), 'utf8')).includes('B_STALE'));
    assert.ok((await readFile(join(workspace, 'generated/c/page1/pages/Home.tsx'), 'utf8')).includes('C_STALE'));
    console.log('PASS actual Home A→B→C while locked, Export/ZIP and next target preserve A; stale destination files retained');
    // Deliver one real GUI ticket with a deterministic response after recovery.
    await page.getByRole('button').filter({ hasText: /c.*페이지/s }).click();
    await page.getByRole('button', { name: 'File', exact: true }).waitFor();
    await page.evaluate(async () => {
        window.editor = (await import('/src/features/editor/store/editorStore.ts')).useEditorStore;
        window.tickets = (await import('/src/features/editor/store/ticketStore.ts')).useTicketStore;
        const { activePageId, spec } = editor.getState();
        tickets.getState().compile(activePageId, spec.pages[activePageId]);
        const runner = await import('/src/features/editor/ui/ticketRunner.ts');
        void runner.runOneTicket(tickets.getState().tickets.find(ticket => ticket.dependsOn.length === 0).id);
    });
    await page.waitForFunction(() => tickets.getState().wait?.phase === 'waiting');
    const request = JSON.parse(await readFile(join(workspace, 'runtime/ticket-request.json'), 'utf8'));
    assert.equal(request.generatedRoot, 'a/page1');
    for (const ticket of request.tickets) {
        const path = join(workspace, ticket.outputPath);
        await mkdir(join(path, '..'), { recursive: true });
        await writeFile(path, 'export default function Fixture(){return null} // NEXT_A');
    }
    const response = join(workspace, request.responsePath);
    await writeFile(response + '.tmp', JSON.stringify({ protocol: request.protocol, requestId: request.id,
        results: request.tickets.map(ticket => ({ ticketId: ticket.id, status: 'done' })) }));
    await rename(response + '.tmp', response);
    await page.waitForFunction(() => !tickets.getState().running);
    assert.equal(await page.evaluate(id => tickets.getState().tickets.find(ticket => ticket.id === id).status,
        request.tickets[0].id), 'done');
    for (const ticket of request.tickets) {
        assert.ok((await readFile(join(workspace, 'generated', ticket.filePath), 'utf8')).includes('NEXT_A'));
    }
    const accepted = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(accepted.entries[request.tickets[0].filePath].projectId, a.projectId);
    assert.ok((await readFile(join(workspace, 'generated/b/page1/pages/Home.tsx'), 'utf8')).includes('B_STALE'));
    assert.ok((await readFile(join(workspace, 'generated/c/page1/pages/Home.tsx'), 'utf8')).includes('C_STALE'));
    console.log('PASS next GUI ticket accepts fake response under A identity/root; B and C bytes unchanged');

}
finally {
    await runner.close();
    await rm(workspace, { recursive: true, force: true });
}
