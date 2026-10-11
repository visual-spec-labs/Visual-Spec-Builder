// #292 실제 모델 여정의 수동 실행 도구. **CI에서 실행하지 않는다** — 실제 모델 비용과 사용자 인증이 든다.
// 사용자가 할 일을 단계별로 대신한다: GUI는 Chromium으로 조작하고, 에이전트는 이 기기에 설치·인증된
// Claude Code(`claude -p`) 또는 Codex(`codex exec`)를 GUI가 보여 주는 지시문 그대로 비대화형으로 실행한다.
// QA 도구는 응답·생성 파일을 쓰지 않는다. 단계마다 <root>/evidence/에 요청·결과·소요 시간을 남긴다.
//
//   node scripts/browser/real-model-journey.mjs setup --root <QA 폴더>
//   (별도 터미널) cd <QA 폴더>/ws && BROWSER=none node <저장소>/bin/visual-spec.mjs
//   node scripts/browser/real-model-journey.mjs <단계> --root <QA 폴더> --url <GUI 주소> [옵션]
//
// 단계: draft(홈 자연어 초안) · nl(현재 페이지 자연어 수정) · add-page · edit(속성 칸 GUI 편집) ·
//       tickets(구현 티켓 전체 전달) · touch(생성 파일 수동 수정) · export(ZIP 내려받기) · snapshot
// 에이전트가 시작하지 못했거나 0이 아닌 코드·signal로 끝났거나, 응답·GUI 적용·티켓 완료가 확인되지 않으면
// 그 단계는 실패로 기록하고 종료 코드 1로 끝난다(PR #358 리뷰). 판정 규칙은 real-model-agent.mjs에 있다.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { openProjectCard } from "./project-card.mjs";
import { AgentRunError, agentArgv, agentSpawnPlan, nlFailure, readNlGuiState, runAgentProcess, summarizeAgentOutput,
  ticketRunFailure } from "./real-model-agent.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const { values: args, positionals: [phase] } = parseArgs({ allowPositionals: true, options: {
  root: { type: "string" }, url: { type: "string" },
  agent: { type: "string", default: "claude" }, "agent-bin": { type: "string" }, model: { type: "string" },
  doc: { type: "string", default: "real-flow" }, card: { type: "string" }, page: { type: "string" },
  instruction: { type: "string" }, node: { type: "string" }, field: { type: "string" }, value: { type: "string" },
  file: { type: "string" }, append: { type: "string" }, overwrite: { type: "string", default: "backup" },
  label: { type: "string" },
} });
if (!args.root) throw new Error("--root <QA 폴더>가 필요합니다.");
const root = resolve(args.root);
const ws = join(root, "ws");
const vs = join(ws, ".visual-spec");
const evidence = join(root, "evidence");
await mkdir(evidence, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const label = args.label ?? phase;
async function record(entry) {
  const line = { at: new Date().toISOString(), phase, label, ...entry };
  await appendFile(join(evidence, "log.jsonl"), `${JSON.stringify(line)}\n`, "utf8");
  console.log(JSON.stringify(line, null, 2));
}
const readJson = (path) => readFile(path, "utf8").then(JSON.parse, () => null);

if (phase === "setup") {
  await mkdir(join(vs, "assets"), { recursive: true });
  const cli = join(repo, "bin/visual-spec.mjs");
  for (const command of ["init", "skills"]) execFileSync(process.execPath, [cli, command], { cwd: ws, stdio: "inherit" });
  // 사용자가 쓸 이미지를 작업공간 assets/에 둔 상태에서 시작한다(1200×600 PNG).
  const hero = join(vs, "assets/hero.png");
  await copyFile(join(repo, "test/fixtures/layout-parity/assets/hero.png"), hero);
  // 버전 확인도 셸을 거치지 않는다(Windows .cmd는 agentSpawnPlan이 따로 다룬다).
  const version = (command) => {
    const plan = agentSpawnPlan(command, ["--version"]);
    const result = spawnSync(plan.file, plan.args, { ...plan.options, encoding: "utf8" });
    if (result.error || result.status !== 0) return `unavailable: ${(result.error?.message || result.stderr || `exit ${result.status}`).split("\n")[0]}`;
    return result.stdout.trim();
  };
  await record({ repoHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
    node: process.version, pnpm: version("pnpm"), claude: version("claude"), codex: version("codex"),
    heroSha256: sha256(await readFile(hero)) });
  process.exit(0);
}
if (!args.url) throw new Error("--url <GUI 주소>가 필요합니다.");

/** 작업공간 파일 목록과 해시. 단계 전후 비교와 증거용이다. */
async function listFiles(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    out[relative(dir, path).replaceAll("\\", "/")] = sha256(await readFile(path));
  }
  return out;
}

/**
 * GUI가 보여 주는 지시문을 그대로 에이전트에 준다. 실행하는 동안 GUI의 "대기 연장"을 눌러
 * 사용자가 하듯 같은 요청의 기한만 미룬다(새 요청을 만들지 않는다).
 * 시작 실패·0이 아닌 종료 코드·signal 종료·Claude 결과 is_error는 AgentRunError로 단계를 실패시킨다.
 */
async function runAgent(page, instruction, tag) {
  // 부모 세션의 인증·세션 변수를 물려주지 않는다. 사용자가 새 터미널에서 실행한 것과 같은 조건이다.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(ANTHROPIC_|CLAUDECODE$|CLAUDE_CODE_|CLAUDE_PID$|CLAUDE_EFFORT$)/.test(key)));
  const output = join(evidence, `${tag}-agent.json`);
  const argv = agentArgv(args.agent, { ws, model: args.model });
  // 셸을 거치지 않고 argv를 그대로 넘기고, 지시문은 인자가 아니라 stdin으로 넘긴다.
  // --agent-bin은 PATH 밖의 실행 파일(또는 검증용 가짜 CLI)을 가리킨다. 인자 형식은 --agent가 정한다.
  const plan = agentSpawnPlan(args["agent-bin"] ?? args.agent, argv);
  let extensions = 0;
  let run;
  try {
    run = await runAgentProcess(plan, { cwd: ws, env, input: instruction, step: tag, onTick: async () => {
      const extend = page.getByRole("button", { name: "대기 연장", exact: true });
      if (await extend.count() > 0 && await extend.first().isVisible()) { await extend.first().click(); extensions += 1; }
    } });
  } catch (error) {
    if (error instanceof AgentRunError) error.details = { ...error.details, agent: args.agent, argv, extensions };
    throw error;
  }
  await writeFile(output, run.stdout, "utf8");
  const { summary, failure } = summarizeAgentOutput(args.agent, run.stdout);
  const result = { agent: args.agent, argv, exitCode: run.exitCode, signal: run.signal, seconds: run.seconds,
    extensions, stderrTail: run.stderrTail.slice(-500), output: relative(root, output), summary };
  if (failure) throw new AgentRunError(`${tag}: ${failure}`, { step: tag, stage: "agent-result", ...result });
  return result;
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const context = await chromium.launchPersistentContext(join(root, "profile"), {
  executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"], viewport: { width: 1440, height: 1000 }, acceptDownloads: true,
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(20000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
async function menu(name) {
  await button("파일").click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
// 앞 단계가 실패해 저장하지 않은 자동저장 초안이 남았으면 저장된 파일로 시작한다(기록에 남긴다).
async function discardDraft() {
  const draft = page.getByRole("alertdialog").filter({ hasText: "저장하지 않은 초안이 있습니다" });
  if (!await draft.waitFor({ timeout: 2000 }).then(() => true, () => false)) return;
  discardedDrafts += 1;
  await draft.getByRole("button", { name: "저장된 파일 내용으로 계속", exact: true }).click();
}
async function openDocument() {
  await page.goto(args.url);
  await discardDraft();
  // 홈 카드는 파일 이름이 아니라 프로젝트 이름(spec.name)을 보인다. 이름이 정확히 같은 카드 하나만 연다.
  await openProjectCard(page, args.card ?? args.doc);
  await button("파일").waitFor();
  await discardDraft();
  if (args.page) await selectPage(args.page);
}
let discardedDrafts = 0;
async function selectPage(name) {
  await button(name).first().click();
  await page.waitForFunction((name) => document.querySelector('[data-testid="responsive-artboard"]') !== null && name, name);
}
// 브라우저에서 실행한다(tickets 단계가 window.tickets에 ticketStore를 둔 뒤). 실행 상태와 티켓별 상태를 읽는다.
const readTicketState = () => ({ running: tickets.getState().running, runError: tickets.getState().runError,
  tickets: tickets.getState().tickets.map(({ id, componentName, kind, status, error }) => ({ id, componentName, kind, status, error })) });
// Save 결과는 window.alert로 알린다. 문구를 증거로 남기고 닫는다.
const alerts = [];
page.on("dialog", async (dialog) => { alerts.push(dialog.message()); await dialog.accept(); });
async function save() {
  const count = alerts.length;
  await menu("저장");
  for (let i = 0; i < 100 && alerts.length === count; i++) await sleep(100);
  if (!alerts.slice(count).some((message) => message.startsWith("저장했습니다"))) throw new Error(`Save 실패: ${alerts.slice(count)}`);
  // 저장 리비전을 자동저장 기록에 반영하는 0.5초 디바운스가 끝난 뒤 닫는다(사람이 바로 탭을 닫지 않는 경우).
  await sleep(1500);
}
/** 자연어 요청을 보내고 실제 에이전트로 응답하게 한 뒤 GUI 판정을 기록한다. */
async function nlRequest(tag) {
  const requestPath = join(vs, "runtime/nl-request.json");
  const before = (await readJson(requestPath))?.id ?? null;
  await page.getByRole("region", { name: "자연어 편집" }).getByRole("button", { name: "요청", exact: true }).click()
    .catch(() => page.locator('section[aria-label="자연어 편집"]').getByRole("button", { name: "요청", exact: true }).click());
  let request;
  for (let i = 0; i < 100 && !request; i++) {
    const current = await readJson(requestPath);
    if (current && current.id !== before) request = current;
    else await sleep(100);
  }
  if (!request) throw new Error("GUI가 nl-request.json을 쓰지 않았습니다.");
  await writeFile(join(evidence, `${tag}-nl-request.json`), JSON.stringify(request, null, 2), "utf8");
  const instruction = await page.evaluate(async () =>
    (await import("/src/features/editor/ui/agentHandoff.ts")).buildNlAgentInstruction());
  try {
    return await awaitNlResult(request, instruction, tag);
  } catch (error) {
    // GUI가 아직 응답을 기다리면 사용자처럼 취소하고, 다음 폴링이 요청 잠금을 푸는 것(DELETE)까지 기다린다.
    // 그러지 않으면 탭을 닫은 뒤에도 잠금이 30초 남아 다음 단계의 요청이 막힌다.
    const cancel = page.locator('section[aria-label="자연어 편집"]').getByRole("button", { name: "취소", exact: true });
    if (await cancel.isVisible().catch(() => false)) {
      const released = page.waitForResponse((response) => response.request().method() === "DELETE"
        && response.url().includes("/request-lock/nl"), { timeout: 10000 }).catch(() => null);
      await cancel.click().catch(() => {});
      if (!await released) error.message += " (요청 잠금 해제를 확인하지 못했습니다)";
    }
    throw error;
  }
}
async function awaitNlResult(request, instruction, tag) {
  const agent = await runAgent(page, instruction, tag);
  // 종료 코드 0만으로 성공이라 하지 않는다. 이번 requestId의 유효한 응답이 있고 GUI가 적용을 끝내야 성공이다.
  const responseText = await readFile(join(vs, "runtime/nl-response.json"), "utf8").catch(() => null);
  let response = null;
  try { response = responseText === null ? null : JSON.parse(responseText); } catch { /* malformed로 판정한다 */ }
  await writeFile(join(evidence, `${tag}-nl-response.json`), responseText ?? "null", "utf8");
  // 응답이 없거나 다른 요청 것이면 에이전트가 이미 끝났으므로 GUI 기한까지 기다리지 않는다.
  const gui = response?.requestId === request.id && !response.error
    ? await page.waitForFunction(readNlGuiState, null, { timeout: 60000, polling: 250 })
      .then((handle) => handle.jsonValue(), () => ({ kind: "timeout" }))
    : null;
  const result = { requestId: request.id, scope: request.scope, pageId: request.pageId, instructionSent: instruction,
    responseRequestId: response?.requestId ?? null, commands: response?.commands?.length ?? null,
    guiState: gui?.kind ?? null, guiStatus: gui?.text ?? null, agent };
  const failure = nlFailure({ requestId: request.id, response, malformed: responseText !== null && response === null, gui });
  if (failure) throw new AgentRunError(`${tag}: ${failure}`, { step: tag, stage: "nl-response", ...result });
  return result;
}

try {
  if (phase === "draft") {
    await page.goto(args.url);
    await page.getByText("자연어로 초안 만들기").first().click();
    await page.getByLabel("자연어 초안 설명", { exact: true }).fill(args.instruction);
    await button("초안 만들기").click();
    await button("파일").waitFor();
    const result = await nlRequest(label);
    await menu("다른 이름으로 저장");
    await page.getByRole("alertdialog").getByRole("textbox").fill(args.doc);
    await page.keyboard.press("Enter");
    await sleep(1500);
    await record({ ...result, savedAs: `${args.doc}.json`, specSha256: sha256(await readFile(join(vs, `specs/${args.doc}.json`))) });
  } else if (phase === "add-page") {
    await openDocument();
    await button("새 페이지").click();
    await sleep(500);
    await save();
    await record({ pages: (await readJson(join(vs, `specs/${args.doc}.json`)))?.pageOrder });
  } else if (phase === "nl") {
    await openDocument();
    if (args.node) await button(args.node).first().click();
    await page.locator('section[aria-label="자연어 편집"] textarea, section[aria-label="자연어 편집"] input[aria-label="자연어 편집 요청"]').first().fill(args.instruction);
    const result = await nlRequest(label);
    await save();
    await record({ ...result, specSha256: sha256(await readFile(join(vs, `specs/${args.doc}.json`))) });
  } else if (phase === "edit") {
    await openDocument();
    await button(args.node).first().click();
    // 반응형 페이지는 미리보기 폭의 분기점 재정의를 편집한다. 기본값(base)을 고쳐야 모든 폭에 반영된다.
    const basis = page.getByLabel("반응형 편집 기준", { exact: true });
    if (await basis.count() > 0) await basis.selectOption("");
    const field = page.getByLabel(args.field, { exact: true }).first();
    await field.fill(args.value);
    await field.press("Tab");
    await save();
    await record({ node: args.node, field: args.field, value: args.value,
      specSha256: sha256(await readFile(join(vs, `specs/${args.doc}.json`))) });
  } else if (phase === "tickets") {
    await openDocument();
    await page.evaluate(async () => { window.tickets = (await import("/src/features/editor/store/ticketStore.ts")).useTicketStore; });
    await button("구현 티켓").click();
    const instruction = await page.evaluate(async () =>
      (await import("/src/features/editor/ui/agentHandoff.ts")).buildTicketAgentInstruction());
    const requestPath = join(vs, "runtime/ticket-request.json");
    const generatedBefore = await listFiles(join(vs, "generated"));
    // 앞 단계가 남긴 요청 파일을 이번 웨이브로 착각하지 않는다.
    let lastId = (await readJson(requestPath))?.id ?? null;
    await button("에이전트에 전달").click();
    const waves = [];
    const maxWaves = 8;
    // 반복·대기 상한에 닿으면 성공으로 끝내지 않고 이유를 남긴다.
    let limit = null;
    for (let wave = 1; ; wave++) {
      let request;
      let finished = false;
      for (let i = 0; i < 300 && !request && !finished; i++) {
        const current = await readJson(requestPath);
        if (current && current.id !== lastId) request = current;
        else if (!await page.evaluate(() => tickets.getState().running)) finished = true;
        else await sleep(100);
      }
      if (finished) break;
      if (!request) { limit = `웨이브 ${wave} 요청을 30초 안에 받지 못했습니다(running=true).`; break; }
      if (wave > maxWaves) { limit = `웨이브가 ${maxWaves}개를 넘었습니다.`; break; }
      lastId = request.id;
      await writeFile(join(evidence, `${label}-wave${wave}-request.json`), JSON.stringify(request, null, 2), "utf8");
      const agent = await runAgent(page, instruction, `${label}-wave${wave}`);
      // 응답을 수용하면 다음 웨이브 요청을 쓰거나, 덮어쓰기 확인을 띄우거나, 실행을 끝낸다.
      let review = null;
      let settled = false;
      for (let i = 0; i < 600; i++) {
        const state = await page.evaluate(() => ({ running: tickets.getState().running, review: tickets.getState().overwriteReview !== null }));
        const current = await readJson(requestPath);
        if (state.review) {
          review = { text: (await page.locator("text=백업 후 덮어쓰기").first().locator("xpath=ancestor::section[1]").innerText().catch(() => "")).slice(0, 3000) };
          await page.screenshot({ path: join(evidence, `${label}-wave${wave}-overwrite-review.png`) });
          if (args.overwrite === "backup") {
            await button("모두 백업 후 덮어쓰기").click();
            await page.getByRole("button", { name: /^선택대로 적용/ }).click();
          } else {
            await button("전체 취소").click();
          }
          review.decision = args.overwrite;
          await page.waitForFunction(() => tickets.getState().overwriteReview === null);
          continue;
        }
        if (!state.running || (current && current.id !== lastId)) { settled = true; break; }
        await sleep(200);
      }
      const ticketState = await page.evaluate(readTicketState);
      waves.push({ wave, requestId: request.id, tickets: request.tickets.map((ticket) => ticket.id), agent, review, after: ticketState });
      if (!settled) { limit = `웨이브 ${wave} 응답 수용을 120초 안에 확인하지 못했습니다.`; break; }
      if (!ticketState.running) break;
    }
    const generatedAfter = await listFiles(join(vs, "generated"));
    await page.screenshot({ path: join(evidence, `${label}-tickets.png`) });
    const final = await page.evaluate(readTicketState);
    const failure = ticketRunFailure({ waves, final, limit });
    await record({ page: args.page, instructionSent: instruction, waves, final, failure, generatedBefore, generatedAfter,
      manifest: await readJson(join(vs, "runtime/generation-manifest.json")) });
    if (failure) throw new AgentRunError(`${label}: ${failure}`, { step: label, stage: "tickets", final, limit });
  } else if (phase === "touch") {
    // 사용자가 생성 파일을 직접 고친 상황(#282). 덮어쓰기 확인이 떠야 정상이다.
    const path = join(vs, "generated", args.file);
    const before = await readFile(path);
    await writeFile(path, Buffer.concat([before, Buffer.from(args.append ?? "\n// 사용자가 직접 고친 줄\n")]));
    await record({ file: args.file, before: sha256(before), after: sha256(await readFile(path)) });
  } else if (phase === "export") {
    await openDocument();
    await page.evaluate(async () => { window.exports = (await import("/src/features/editor/store/exportStore.ts")).useExportStore; });
    await menu("코드 내보내기");
    await page.waitForFunction(() => exports.getState().status === "ready", null, { timeout: 60000 });
    const state = await page.evaluate(() => {
      const { report, freshness, target } = exports.getState();
      return { target: { pageId: target?.pageId, projectName: target?.projectName, fileName: target?.fileName }, fileCount: report?.fileCount, errorCount: report?.errorCount, coverage: report?.coverage,
        issues: report?.issues, freshness: freshness?.overall, ticketFreshness: freshness?.tickets };
    });
    await page.screenshot({ path: join(evidence, `${label}-export.png`) });
    const download = page.waitForEvent("download");
    await button("결과 폴더 ZIP 내려받기").click();
    const file = await download;
    const zip = join(evidence, `${label}-${file.suggestedFilename()}`);
    await file.saveAs(zip);
    await record({ page: args.page, ...state, zip: relative(root, zip), zipSha256: sha256(await readFile(zip)), zipBytes: (await stat(zip)).size });
  } else if (phase === "snapshot") {
    await record({ specs: await listFiles(join(vs, "specs")), generated: await listFiles(join(vs, "generated")),
      runtime: await listFiles(join(vs, "runtime")) });
  } else {
    throw new Error(`알 수 없는 단계: ${phase}`);
  }
  if (pageErrors.length > 0 || alerts.length > 0 || discardedDrafts > 0) await record({ pageErrors, alerts, discardedDrafts });
} catch (error) {
  // 실패도 증거로 남긴다. 성공으로 덮지 않는다.
  await page.screenshot({ path: join(evidence, `${label}-error.png`) }).catch(() => {});
  const dialogs = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')]
    .map((dialog) => dialog.textContent.slice(0, 500))).catch(() => []);
  // 실패 단계·종료 코드·signal·stderr(AgentRunError.details)를 함께 남긴다.
  await record({ error: error.message.split("\n")[0], details: error.details ?? null, dialogs, pageErrors, alerts });
  process.exitCode = 1;
} finally {
  await context.close();
}
