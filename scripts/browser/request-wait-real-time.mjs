// 실제 경과 시간 + 실제 Chromium·Vite HTTP: 티켓 요청의 연결 끊김→복구, 대기 연장, 180초 timeout 상태 전이(#359).
// 모델 응답은 결정적 파일 fixture다. 가상 시간 회귀(test/agent-request-wait.test.ts 등)와 달리 브라우저 타이머와
// 벽시계로 진행하므로 실행에 약 3분 30초가 걸린다. 필수 여정 묶음(120초 상한)에는 넣지 않는다.
// VSB_REAL_TIMEOUT=0이면 180초 timeout 단계만 건너뛰고 그 사실을 출력한다(skip을 PASS로 세지 않는다).
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";

const WAIT_WINDOW_MS = 180_000; // ui/agentRequestWait.ts AGENT_WAIT_WINDOW_MS
const workspace = await mkdtemp(join(tmpdir(), "vs-request-wait-real-time-"));
const exists = path => access(path).then(() => true, () => false);
let runner;
const errors = [];
async function readRequest() { return JSON.parse(await readFile(join(workspace, "runtime/ticket-request.json"), "utf8")); }
async function stage(request, text) {
  const path = join(workspace, request.tickets[0].outputPath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, text);
}
async function respond(request) {
  await writeFileAtomic(join(workspace, request.responsePath), JSON.stringify({ protocol: request.protocol, requestId: request.id,
    results: request.tickets.map(ticket => ({ ticketId: ticket.id, status: "done" })) }));
}
try {
  await mkdir(join(workspace, "specs"), { recursive: true });
  const spec = JSON.parse(await readFile(new URL("../../examples/image-hero.json", import.meta.url), "utf8"));
  await writeFile(join(workspace, "specs/wait.json"), JSON.stringify(spec));
  runner = await startBrowserWorkspace(workspace);
  const context = await runner.newContext({ viewport: { width: 1440, height: 1000 } });
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
  async function start() {
    await page.evaluate(() => { void runner.runOneTicket(tickets.getState().tickets.find(t => t.status === "pending" && t.dependsOn.length === 0).id); });
    await page.waitForFunction(() => tickets.getState().wait?.phase === "waiting");
    return readRequest();
  }
  const waitState = () => page.evaluate(() => ({ ...tickets.getState().wait, now: Date.now() }));

  // 1. 임시 출력 근거 → 연결 끊김 → 복구 → 같은 요청 수용
  const first = await start();
  await stage(first, "export function Fixture() { return <div>reconnected</div>; }");
  await page.getByText("에이전트가 이 요청의 임시 출력 1/1개를 썼습니다", { exact: false }).waitFor();
  const lostAt = Date.now();
  await page.route("**/__vs/**", route => route.abort());
  await page.getByText("작업공간 연결이 끊겼습니다", { exact: false }).waitFor();
  const lostAfter = Date.now() - lostAt;
  assert.equal((await waitState()).phase, "connectionLost");
  await page.waitForTimeout(3000); // 끊긴 상태를 실제로 유지한다(잠금 기한 30초보다 짧게)
  assert.equal((await waitState()).phase, "connectionLost");
  await page.unroute("**/__vs/**");
  const restoredAt = Date.now();
  await page.waitForFunction(() => tickets.getState().wait?.phase === "waiting");
  const restoredAfter = Date.now() - restoredAt;
  assert.equal((await readRequest()).id, first.id); // 복구 뒤에도 같은 요청이다
  await respond(first);
  await page.waitForFunction(() => !tickets.getState().running);
  const target = join(workspace, "generated", first.tickets[0].filePath);
  assert.equal(await readFile(target, "utf8"), "export function Fixture() { return <div>reconnected</div>; }");
  const manifest = async () => JSON.parse(await readFile(join(workspace, "runtime/generation-manifest.json"), "utf8"));
  assert.equal((await manifest()).entries[first.tickets[0].filePath].requestId, first.id);
  console.log(`PASS real elapsed: staged evidence -> connectionLost after ${lostAfter}ms -> held 3s -> waiting after ${restoredAfter}ms -> same request accepted`);

  // 2. 대기 연장: 같은 요청 ID, 기한 = max(기한, 지금+180초), 중복 클릭은 누적되지 않는다
  await page.evaluate(() => {
    const { activePageId, spec } = editor.getState();
    tickets.getState().compile(activePageId, spec.pages[activePageId]);
  });
  const second = await start();
  const before = await waitState();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "대기 연장", exact: true }).click();
  const extended = await waitState();
  assert.equal((await readRequest()).id, second.id);
  assert.ok(extended.deadline > before.deadline, "연장 뒤 기한이 늘어야 한다");
  assert.ok(extended.deadline >= extended.now + WAIT_WINDOW_MS - 1000, "연장 기한은 지금+180초 근처다");
  await page.getByRole("button", { name: "대기 연장", exact: true }).click();
  const twice = await waitState();
  assert.ok(twice.deadline - extended.deadline < 5000, "중복 클릭은 180초를 더 쌓지 않는다");
  await page.getByRole("button", { name: "중지", exact: true }).click();
  await page.waitForFunction(() => !tickets.getState().running);
  assert.equal(await exists(join(workspace, "runtime/ticket-request.json")), false);
  console.log(`PASS real elapsed: extend moved deadline +${extended.deadline - before.deadline}ms, second click +${twice.deadline - extended.deadline}ms, same request; Stop removed request`);

  // 3. 실제 180초 timeout → 늦은 응답·임시 출력은 수용하지 않는다 → 새 요청은 성공
  if (process.env.VSB_REAL_TIMEOUT === "0") {
    console.log("SKIP real 180s timeout (VSB_REAL_TIMEOUT=0) — not counted as PASS");
  } else {
    const third = await start();
    const startedAt = Date.now();
    const { deadline } = await waitState();
    const thirdTarget = join(workspace, "generated", third.tickets[0].filePath);
    const beforeBytes = await exists(thirdTarget) ? await readFile(thirdTarget, "utf8") : null;
    await page.waitForFunction(() => !tickets.getState().running, null, { timeout: WAIT_WINDOW_MS + 30_000, polling: 1000 });
    const elapsed = Date.now() - startedAt;
    const ended = await page.evaluate(() => ({ runError: tickets.getState().runError, retryable: tickets.getState().runErrorRetryable,
      statuses: tickets.getState().tickets.map(t => [t.id, t.status]), now: Date.now() }));
    // 기한은 요청 저장 직후 정해진다. 끝난 시각이 그 기한 뒤이고 실제로 3분 가까이 흘렀는지 본다.
    assert.ok(ended.now >= deadline, `timeout은 기한 뒤여야 한다(${deadline - ended.now}ms 이르다)`);
    assert.ok(elapsed >= WAIT_WINDOW_MS - 2000, `실제 경과가 180초에 못 미친다(${elapsed}ms)`);
    assert.match(ended.runError ?? "", /대기 시간 안에 응답이 오지 않았습니다/);
    assert.equal(ended.retryable, true);
    assert.equal(await exists(join(workspace, "runtime/ticket-request.json")), false);
    assert.equal(Object.fromEntries(ended.statuses)[third.tickets[0].id], "pending");
    await page.getByText("대기 시간 안에 응답이 오지 않았습니다", { exact: false }).first().waitFor();
    // 만료된 요청의 늦은 임시 출력·응답
    await stage(third, "late after timeout");
    await respond(third);
    await page.waitForTimeout(5000);
    assert.equal(await exists(thirdTarget) ? await readFile(thirdTarget, "utf8") : null, beforeBytes);
    assert.notEqual((await manifest()).entries[third.tickets[0].filePath]?.requestId, third.id);
    // 새 요청(새 ID)은 정상 수용된다
    const retry = await start();
    assert.notEqual(retry.id, third.id);
    await stage(retry, "export function Fixture() { return <div>retry after timeout</div>; }");
    await respond(retry);
    await page.waitForFunction(() => !tickets.getState().running);
    assert.equal(await readFile(join(workspace, "generated", retry.tickets[0].filePath), "utf8"),
      "export function Fixture() { return <div>retry after timeout</div>; }");
    assert.equal((await manifest()).entries[retry.tickets[0].filePath].requestId, retry.id);
    console.log(`PASS real elapsed: timeout after ${elapsed}ms, ticket pending, late staged output/response not accepted, retry accepted`);
  }
  assert.deepEqual(errors, []);
  console.log("PASS request wait real-time journey; page errors 0");
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
