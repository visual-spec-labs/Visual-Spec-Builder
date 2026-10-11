// #292 낡은 티켓 여정: 실제 Chromium + 작업공간 HTTP. 모델 응답은 결정적인 파일 fixture다.
// 응답 대기 중 편집 → 다음 웨이브 중단·Export 오래됨 → Undo/Redo·페이지/문서 전환 → 다시 생성 후 현재.
import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";

const STALE = "화면이 바뀌었습니다. 현재 스펙으로 티켓을 다시 생성해야 전달할 수 있습니다.";
const workspace = await mkdtemp(join(tmpdir(), "vs-stale-ticket-"));
const requestPath = join(workspace, "runtime/ticket-request.json");
let runner;
try {
  for (const dir of ["specs", "assets"]) await mkdir(join(workspace, dir), { recursive: true });
  const hero = JSON.parse(await readFile(new URL("../../examples/image-hero.json", import.meta.url), "utf8"));
  // 컴포넌트 티켓과 페이지 티켓이 서로 다른 웨이브가 되도록 버튼 두 개를 같은 컴포넌트로 둔다.
  const alpha = structuredClone(hero.screen);
  alpha.name = "Alpha";
  const card = { type: "frame", name: "Card", box: { width: "fill", height: "auto" },
    layout: { direction: "column", gap: 8, padding: { top: 8, right: 8, bottom: 8, left: 8 }, mainAxis: "start", crossAxis: "stretch" },
    children: [] };
  alpha.nodes.cardA = { ...card, children: [{ node: "labelA" }] };
  alpha.nodes.cardB = { ...card, children: [{ node: "labelB" }] };
  for (const id of ["labelA", "labelB"]) alpha.nodes[id] = { ...hero.screen.nodes.caption, name: "Label" };
  alpha.nodes.root.children.push({ node: "cardA" }, { node: "cardB" });
  await writeFile(join(workspace, "specs/journey.json"), JSON.stringify({ version: hero.version, name: "Journey",
    pageOrder: ["alpha", "beta"], pages: { alpha, beta: { ...hero.screen, name: "Beta" } } }));
  await writeFile(join(workspace, "specs/other.json"), JSON.stringify({ ...hero, screen: { ...hero.screen, name: "Other" } }));
  await copyFile(new URL("../../test/fixtures/layout-parity/assets/hero.png", import.meta.url), join(workspace, "assets/hero.png"));

  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole("button").filter({ hasText: /Journey.*페이지/s }).click();
  await page.getByRole("button", { name: "파일", exact: true }).waitFor();
  // 상태 판독용이다. 아래 사용자 조작(전달·편집·되돌리기·전환·다시 생성)은 GUI로 실행한다.
  await page.evaluate(async () => {
    window.editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.tickets = (await import("/src/features/editor/store/ticketStore.ts")).useTicketStore;
    window.exports = (await import("/src/features/editor/store/exportStore.ts")).useExportStore;
  });
  const button = name => page.getByRole("button", { name, exact: true });
  const staleNotice = page.getByText(STALE, { exact: true });
  const layer = name => page.locator("div.group").filter({ has: button(name) });
  const ticketState = () => page.evaluate(() => ({ running: tickets.getState().running,
    statuses: tickets.getState().tickets.map(ticket => ticket.status) }));

  // 응답을 수용하면 GUI가 요청 파일을 지운다. 없음(null)도 "새 요청 없음"이다.
  const currentRequestId = () => readFile(requestPath, "utf8").then(text => JSON.parse(text).id, () => null);
  let lastRequestId = null;
  /** GUI가 새 요청을 쓸 때까지 기다린다. 같은 요청 파일을 두 번 처리하지 않는다. */
  async function nextRequest() {
    for (const started = Date.now(); Date.now() - started < 15000;) {
      const request = await readFile(requestPath, "utf8").then(JSON.parse, () => null);
      if (request && request.id !== lastRequestId) { lastRequestId = request.id; return request; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const state = await page.evaluate(() => { const { running, runError, wait, overwriteReview, tickets: list } = tickets.getState();
      return { running, runError, wait, overwriteReview: overwriteReview !== null, statuses: list.map(ticket => ticket.status) }; });
    throw new Error(`GUI did not write a new ticket request: ${JSON.stringify(state)}`);
  }
  async function respond(request) {
    for (const ticket of request.tickets) {
      const path = join(workspace, ticket.outputPath);
      await mkdir(join(path, ".."), { recursive: true });
      const name = ticket.componentName;
      await writeFile(path, ticket.kind === "page"
        ? `export default function ${name}() { return <main data-node-id="root" />; }\n`
        : `export function ${name}() { return <div />; }\n`);
    }
    await writeFileAtomic(join(workspace, request.responsePath), JSON.stringify({ protocol: request.protocol, requestId: request.id,
      results: request.tickets.map(ticket => ({ ticketId: ticket.id, status: "done" })) }));
  }
  /** 남은 웨이브를 모두 fixture로 응답해 전체 티켓을 끝낸다. */
  async function deliverAll() {
    await button("에이전트에 전달").click();
    await respond(await nextRequest());
    // 응답한 웨이브를 GUI가 수용하면 다음 웨이브의 새 요청을 쓰거나 실행을 끝낸다.
    for (const started = Date.now(); Date.now() - started < 30000;) {
      const id = await currentRequestId();
      if (id !== null && id !== lastRequestId) { await respond(await nextRequest()); continue; }
      const state = await ticketState();
      if (!state.running) { assert.ok(state.statuses.every(status => status === "done"), JSON.stringify(state)); return; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("ticket waves did not finish");
  }
  async function exportFreshness() {
    await button("파일").click();
    await page.getByRole("menuitem", { name: "코드 내보내기", exact: true }).click();
    await page.waitForFunction(() => exports.getState().status === "ready");
    // 페이지 티켓은 화면 전체를 입력으로 삼으므로 레이어 표시를 바꾸면 반드시 오래됨이다.
    // 컴포넌트 티켓은 기준에 따라 현재로 남을 수 있어(#281 컴포넌트 단위 지문) 전체 판정은 따로 읽는다.
    const freshness = await page.evaluate(() => {
      const { freshness, report } = exports.getState();
      const pageTicket = tickets.getState().tickets.find(ticket => ticket.kind === "page").id;
      return { overall: freshness?.overall, page: freshness?.tickets.find(entry => entry.ticketId === pageTicket)?.freshness,
        errors: report?.errorCount };
    });
    await button("코드 Export 닫기").click();
    return freshness;
  }

  // 1. 컴포넌트 웨이브 응답을 기다리는 동안 레이어를 숨긴다. 받은 결과는 반영하되 다음 웨이브는 쓰지 않는다.
  await button("구현 티켓").click();
  const planned = await ticketState();
  assert.ok(planned.statuses.length >= 2, `expected component + page waves: ${JSON.stringify(planned)}`);
  await button("에이전트에 전달").click();
  const componentWave = await nextRequest();
  assert.ok(componentWave.tickets.every(ticket => ticket.kind !== "page"), "first wave must not include the dependent page");
  await layer("Caption").getByRole("button", { name: "숨기기", exact: true }).click();
  await staleNotice.waitFor();
  await respond(componentWave);
  await page.waitForFunction(() => !tickets.getState().running);
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.ok([null, componentWave.id].includes(await currentRequestId()), "stale plan must not write the next wave");
  const afterEdit = await ticketState();
  assert.ok(afterEdit.statuses.includes("done") && afterEdit.statuses.includes("pending"), JSON.stringify(afterEdit));
  assert.equal(await button("에이전트에 전달").isDisabled(), true);
  assert.equal(await button("전달").count(), 0, "stale tickets must not offer per-ticket delivery");
  console.log("PASS edit while waiting: accepted wave stays done, next wave is not requested, delivery is disabled");

  // 2. Undo로 같은 페이지 객체에 돌아오면 다시 전달할 수 있고, Redo는 다시 낡음으로 막는다.
  await button("되돌리기").click();
  await staleNotice.waitFor({ state: "detached" });
  assert.equal(await button("에이전트에 전달").isDisabled(), false);
  await button("다시 실행").click();
  await staleNotice.waitFor();
  assert.equal(await button("에이전트에 전달").isDisabled(), true);
  // 다른 페이지로 갔다 돌아오면 같은 객체라 다시 현재다. 다른 페이지에 있는 동안은 낡음이다.
  await button("Beta").click();
  await page.waitForFunction(() => editor.getState().activePageId === "beta");
  await staleNotice.waitFor();
  await button("Alpha").click();
  await page.waitForFunction(() => editor.getState().activePageId === "alpha");
  await staleNotice.waitFor();
  console.log("PASS Undo restores deliverability; Redo and page switch keep the old plan blocked");

  // 3. 다시 생성 → 전체 전달 → Export 현재. 이후 편집하면 Export가 오래됨을 보인다.
  await button("다시 생성").click();
  await staleNotice.waitFor({ state: "detached" });
  await deliverAll();
  assert.deepEqual(await exportFreshness(), { overall: "current", page: "current", errors: 0 });
  await button("구현 티켓").click();
  await layer("Caption").getByRole("button", { name: "표시", exact: true }).click();
  await staleNotice.waitFor();
  const edited = await exportFreshness();
  assert.equal(edited.page, "stale");
  assert.ok(["stale", "partial"].includes(edited.overall), JSON.stringify(edited));
  console.log("PASS regenerate → all waves current; a later GUI edit marks Export stale");

  // 4. 편집 직후 다른 문서로 전환하면 이전 문서의 계획은 전달할 수 없다. 같은 문서로 돌아와도 새 문서 신원이다.
  await button("구현 티켓").click();
  await staleNotice.waitFor({ state: "detached" });
  const requestBefore = await currentRequestId();
  await layer("Caption").getByRole("button", { name: "숨기기", exact: true }).click();
  await button("파일").click();
  await page.getByRole("menuitem", { name: "열기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "other.json", exact: true }).click();
  await page.waitForFunction(() => editor.getState().spec.name === "Other");
  await staleNotice.waitFor();
  assert.equal(await button("에이전트에 전달").isDisabled(), true);
  await button("파일").click();
  await page.getByRole("menuitem", { name: "열기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "journey.json", exact: true }).click();
  await page.waitForFunction(() => editor.getState().spec.name === "Journey");
  await staleNotice.waitFor();
  assert.equal(await button("에이전트에 전달").isDisabled(), true);
  assert.equal(await currentRequestId(), requestBefore, "document switch must not write a request");
  assert.deepEqual(errors, []);
  console.log("PASS edit then document switch (and back) keeps the previous plan undeliverable; no request written; page errors 0");
} finally {
  try { await runner?.close(); } finally { await rm(workspace, { recursive: true, force: true }); }
}
