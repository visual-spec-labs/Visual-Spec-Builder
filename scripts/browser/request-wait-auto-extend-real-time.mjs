// 실제 경과 시간 + 실제 Chromium·Vite HTTP: 수동 "대기 연장" 클릭 없이, 같은 임시 출력 파일의
// 내용 변화(activityEvidence, #432 PR #451 리뷰)만으로 180초 창을 넘겨 응답을 받는 성공 경로.
// request-wait-real-time.mjs의 실제 180초 timeout 경로와는 반대 결과(성공)를 실측한다 —
// 가상 시간 회귀(test/agent-request-wait.test.ts 등)는 자동연장 로직은 보지만 실제 서버 폴링·
// 잠금 임대가 그 시간 동안 버티는지는 보지 않는다. 모델 응답은 결정적 파일 fixture다.
// 실행에 약 3분 30초가 걸린다. 필수 여정 묶음(120초 상한)에는 넣지 않는다.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBrowserWorkspace, writeFileAtomic } from "./harness.mjs";

const WAIT_WINDOW_MS = 180_000; // ui/agentRequestWait.ts AGENT_WAIT_WINDOW_MS
const workspace = await mkdtemp(join(tmpdir(), "vs-request-wait-auto-extend-"));
const exists = path => access(path).then(() => true, () => false);
let runner;
const errors = [];
async function waitForRequestRemoved() {
  const path = join(workspace, "runtime/ticket-request.json");
  const deadline = Date.now() + 5000;
  while (await exists(path) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(await exists(path), false, "request file must be removed within 5s");
}
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
async function manifest() { return JSON.parse(await readFile(join(workspace, "runtime/generation-manifest.json"), "utf8")); }
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
  await page.getByRole("button", { name: "파일", exact: true }).waitFor();
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
  const running = () => page.evaluate(() => tickets.getState().running);

  // 자동연장: "대기 연장"을 한 번도 누르지 않고, 같은 파일을 두 번째로 다른 내용으로 고쳐 써서
  // (개수는 그대로, 내용만 변화 — activityEvidence) 180초 원래 창을 넘겨 응답을 받는다.
  const request = await start();
  const startedAt = Date.now();
  const before = await waitState();
  await stage(request, "export function Fixture() { return <div>draft 1</div>; }");
  await page.getByText("에이전트가 이 요청의 임시 출력 1/1개를 썼습니다", { exact: false }).waitFor();
  const afterFirstEvidence = await waitState();
  assert.ok(afterFirstEvidence.deadline >= before.deadline, "첫 증거(개수 0→1)도 기한을 줄이지 않아야 한다");

  // 원래 창(180초) 안에서 아직 살아 있는지 확인 — 아직은 자동연장 없이도 당연히 살아 있다.
  await page.waitForTimeout(175_000);
  assert.ok(await running(), "175초 지점에서는 원래 창 안이라 당연히 살아 있어야 한다");

  // 같은 경로, 다른 내용 — 개수는 안 늘지만 activityEvidence로 또 연장된다.
  await stage(request, "export function Fixture() { return <div>draft 2</div>; }");
  await page.waitForTimeout(3000); // 폴링 간격(1초)보다 넉넉히 둬 내용 변화를 관찰할 시간을 준다
  const afterSecondEvidence = await waitState();
  assert.ok(
    afterSecondEvidence.deadline - afterFirstEvidence.deadline > 160_000,
    `activityEvidence로 기한이 거의 새 180초 창만큼 더 밀렸어야 한다(${afterSecondEvidence.deadline - afterFirstEvidence.deadline}ms)`,
  );

  // 원래 창을 분명히 넘긴 시점에도, 수동 연장을 한 번도 누르지 않고 여전히 살아 있다.
  await page.waitForTimeout(30_000); // 총 경과 ~205초 — 원래 180초 창을 넘겼다
  const elapsedBeforeRespond = Date.now() - startedAt;
  assert.ok(elapsedBeforeRespond > WAIT_WINDOW_MS, `원래 180초 창을 실제로 넘겨야 한다(${elapsedBeforeRespond}ms)`);
  assert.ok(await running(), "자동연장 없이는 이미 timeout됐을 시점에도 수동 클릭 없이 살아 있어야 한다");
  assert.equal((await readRequest()).id, request.id); // 여전히 같은 요청 — 재시도(새 ID)가 아니다

  await respond(request);
  await page.waitForFunction(() => !tickets.getState().running);
  const totalElapsed = Date.now() - startedAt;
  const target = join(workspace, "generated", request.tickets[0].filePath);
  assert.equal(await readFile(target, "utf8"), "export function Fixture() { return <div>draft 2</div>; }");
  assert.equal((await manifest()).entries[request.tickets[0].filePath].requestId, request.id);
  await waitForRequestRemoved();

  assert.deepEqual(errors, []);
  console.log(`PASS real elapsed: auto-extend via activityEvidence (no manual "대기 연장") survived ${totalElapsed}ms (> ${WAIT_WINDOW_MS}ms window); same request accepted; page errors 0`);
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
}
