// Actual Chromium + workspace HTTP; model responses are deterministic file fixtures.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace } from "./harness.mjs";

const workspace = await mkdtemp(join(tmpdir(), "vs-request-generation-"));
let runner;
const errors = [];
async function readRequest() { return JSON.parse(await readFile(join(workspace, "runtime/ticket-request.json"), "utf8")); }
async function respond(request, text) {
  for (const ticket of request.tickets) {
    const path = join(workspace, ticket.outputPath);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, text);
  }
  await writeFile(join(workspace, request.responsePath), JSON.stringify({ protocol: 2, requestId: request.id,
    results: request.tickets.map(ticket => ({ ticketId: ticket.id, status: "done" })) }));
}
try {
  await mkdir(join(workspace, "specs"), { recursive: true });
  const spec = JSON.parse(await readFile(new URL("../../examples/image-hero.json", import.meta.url), "utf8"));
  await writeFile(join(workspace, "specs/generation.json"), JSON.stringify(spec));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  async function tab() {
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(runner.url);
    await page.getByRole("button").filter({ hasText: /페이지/s }).first().click();
    await page.getByRole("button", { name: "File", exact: true }).waitFor();
    await page.evaluate(async () => {
      window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
      window.tickets = (await import("/src/features/editor/store/ticketStore.ts")).useTicketStore;
      window.runner = await import("/src/features/editor/ui/ticketRunner.ts");
      const { activePageId, spec } = editor.getState();
      tickets.getState().compile(activePageId, spec.pages[activePageId]);
      tickets.setState({ isOpen: true });
    });
    return page;
  }
  const a = await tab(), b = await tab();
  async function start(page) {
    await page.evaluate(() => { void runner.runOneTicket(tickets.getState().tickets.find(t => t.status === "pending" && t.dependsOn.length === 0).id); });
    await page.waitForFunction(() => tickets.getState().wait?.phase === "waiting");
    return readRequest();
  }
  const first = await start(a);
  await a.getByRole("button", { name: "대기 연장", exact: true }).click();
  assert.equal((await readRequest()).id, first.id);
  await a.getByRole("button", { name: "중지", exact: true }).click();
  await a.waitForFunction(() => !tickets.getState().running);
  await respond(first, "cancelled A");
  const second = await start(b);
  const good = "export function Fixture() { return <div>B</div>; }";
  await respond(second, good);
  await b.waitForFunction(() => !tickets.getState().running);
  const target = join(workspace, "generated", second.tickets[0].filePath);
  assert.equal(await readFile(target, "utf8"), good);
  await respond(first, "late cancelled A");
  assert.equal(await readFile(target, "utf8"), good);
  console.log("PASS UI extend / Stop / retry B / late A preserves accepted B bytes");

  // Pause A's promotion PUT, invalidate its lease, let B publish, then deliver A.
  for (const action of ["expire", "cancel", "compile"]) {
  await a.evaluate(() => {
    const { activePageId, spec } = editor.getState();
    tickets.getState().compile(activePageId, spec.pages[activePageId]);
  });
  let unblock;
  const barrier = new Promise(resolve => { unblock = resolve; });
  let entered;
  const reached = new Promise(resolve => { entered = resolve; });
  await a.route("**/__vs/file/generated/**", async route => {
    if (route.request().method() === "PUT") { entered(); await barrier; }
    await route.continue();
  });
  const stale = await start(a);
  await respond(stale, "stale promotion A");
  await reached;
  const lockPath = join(workspace, "runtime/.ticket-request.lock");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  assert.equal(lock.owner, stale.id);
  if (action === "expire") await writeFile(lockPath, JSON.stringify({ ...lock, expiresAt: Date.now() - 1 }));
  if (action === "cancel") await a.getByRole("button", { name: "중지", exact: true }).click();
  if (action === "compile") await a.evaluate(() => {
    const { activePageId, spec } = editor.getState();
    tickets.getState().compile(activePageId, spec.pages[activePageId]);
  });
  await b.evaluate(() => {
    const { activePageId, spec } = editor.getState();
    tickets.getState().compile(activePageId, spec.pages[activePageId]);
  });
  const latest = await start(b);
  await respond(latest, good + " // latest");
  await b.waitForFunction(() => !tickets.getState().running);
  unblock();
  await a.waitForFunction(() => !tickets.getState().running);
  assert.equal(await readFile(target, "utf8"), good + " // latest");
  const manifest = JSON.parse(await readFile(join(workspace, "runtime/generation-manifest.json"), "utf8"));
  assert.equal(manifest.entries[latest.tickets[0].filePath].requestId, latest.id);
  console.log(`PASS two Chromium tabs: ${action} / B accepted / delayed A PUT rejected; B manifest and bytes retained`);
  await a.unroute("**/__vs/file/generated/**");
  }

  assert.deepEqual(errors, []);
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
