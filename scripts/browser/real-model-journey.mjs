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
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const { values: args, positionals: [phase] } = parseArgs({ allowPositionals: true, options: {
  root: { type: "string" }, url: { type: "string" },
  agent: { type: "string", default: "claude" }, model: { type: "string" },
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
  const version = (command) => { try { return execFileSync(command, ["--version"], { encoding: "utf8", shell: true }).trim(); } catch (error) { return `unavailable: ${error.message.split("\n")[0]}`; } };
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
 */
async function runAgent(page, instruction, tag) {
  const started = Date.now();
  // 부모 세션의 인증·세션 변수를 물려주지 않는다. 사용자가 새 터미널에서 실행한 것과 같은 조건이다.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(ANTHROPIC_|CLAUDECODE$|CLAUDE_CODE_|CLAUDE_PID$|CLAUDE_EFFORT$)/.test(key)));
  const output = join(evidence, `${tag}-agent.json`);
  const argv = args.agent === "codex"
    ? ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "--ephemeral", "-C", ws, "--color", "never",
      "--json", ...(args.model ? ["-m", args.model] : []), "-"]
    : ["-p", "--output-format", "json", "--setting-sources", "project", "--permission-mode", "acceptEdits",
      "--allowedTools", "Bash(node:*)", "--no-session-persistence", ...(args.model ? ["--model", args.model] : [])];
  // 지시문은 셸 인자가 아니라 stdin으로 넘긴다(Windows .cmd 실행기에 한글·따옴표를 넣지 않는다).
  const child = spawn(args.agent, argv, { cwd: ws, env, shell: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(instruction);
  const exited = new Promise((done) => child.on("exit", (code) => done(code)));
  let extensions = 0;
  while (await Promise.race([exited.then(() => false), sleep(20000).then(() => true)])) {
    const extend = page.getByRole("button", { name: "대기 연장", exact: true });
    if (await extend.count() > 0 && await extend.first().isVisible()) { await extend.first().click(); extensions += 1; }
  }
  const code = await exited;
  await writeFile(output, stdout, "utf8");
  let summary = null;
  try {
    if (args.agent === "codex") {
      summary = { events: stdout.trim().split("\n").length };
    } else {
      const result = JSON.parse(stdout.slice(stdout.indexOf("{")));
      summary = { isError: result.is_error, numTurns: result.num_turns, durationApiMs: result.duration_api_ms,
        models: Object.keys(result.modelUsage ?? {}), permissionDenials: result.permission_denials?.length ?? 0,
        result: String(result.result ?? "").slice(0, 2000) };
    }
  } catch (error) { summary = { parseError: error.message }; }
  return { agent: args.agent, argv, exitCode: code, seconds: Math.round((Date.now() - started) / 1000),
    extensions, stderrTail: stderr.slice(-500), output: relative(root, output), summary };
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
  await button("File").click();
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
  // 홈 카드는 파일 이름이 아니라 프로젝트 이름(spec.name)을 보인다.
  await page.getByRole("button").filter({ hasText: new RegExp(`${args.card ?? args.doc}.*페이지`, "s") }).first().click();
  await button("File").waitFor();
  await discardDraft();
  if (args.page) await selectPage(args.page);
}
let discardedDrafts = 0;
async function selectPage(name) {
  await button(name).first().click();
  await page.waitForFunction((name) => document.querySelector('[data-testid="responsive-artboard"]') !== null && name, name);
}
// Save 결과는 window.alert로 알린다. 문구를 증거로 남기고 닫는다.
const alerts = [];
page.on("dialog", async (dialog) => { alerts.push(dialog.message()); await dialog.accept(); });
async function save() {
  const count = alerts.length;
  await menu("Save");
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
  const agent = await runAgent(page, instruction, tag);
  const status = page.locator('section[aria-label="자연어 편집"] [role="status"]');
  await page.waitForFunction(() => !document.querySelector('section[aria-label="자연어 편집"] textarea, section[aria-label="자연어 편집"] input')?.disabled, null, { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  const response = await readJson(join(vs, "runtime/nl-response.json"));
  await writeFile(join(evidence, `${tag}-nl-response.json`), JSON.stringify(response, null, 2), "utf8");
  return { requestId: request.id, scope: request.scope, pageId: request.pageId, instructionSent: instruction,
    responseRequestId: response?.requestId ?? null, commands: response?.commands?.length ?? null,
    guiStatus: (await status.innerText()).trim(), agent };
}

try {
  if (phase === "draft") {
    await page.goto(args.url);
    await page.getByText("자연어로 초안 만들기").first().click();
    await page.getByLabel("자연어 초안 설명", { exact: true }).fill(args.instruction);
    await button("초안 만들기").click();
    await button("File").waitFor();
    const result = await nlRequest(label);
    await menu("Save as");
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
    await button("에이전트에 전달").click();
    const waves = [];
    let lastId = null;
    for (let wave = 1; wave <= 8; wave++) {
      let request;
      for (let i = 0; i < 300 && !request; i++) {
        const current = await readJson(requestPath);
        if (current && current.id !== lastId) request = current;
        else if (!await page.evaluate(() => tickets.getState().running)) break;
        else await sleep(100);
      }
      if (!request) break;
      lastId = request.id;
      await writeFile(join(evidence, `${label}-wave${wave}-request.json`), JSON.stringify(request, null, 2), "utf8");
      const agent = await runAgent(page, instruction, `${label}-wave${wave}`);
      // 응답을 수용하면 다음 웨이브 요청을 쓰거나, 덮어쓰기 확인을 띄우거나, 실행을 끝낸다.
      let review = null;
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
        if (!state.running || (current && current.id !== lastId)) break;
        await sleep(200);
      }
      const ticketState = await page.evaluate(() => ({ running: tickets.getState().running, runError: tickets.getState().runError,
        tickets: tickets.getState().tickets.map(({ id, componentName, kind, status, error }) => ({ id, componentName, kind, status, error })) }));
      waves.push({ wave, requestId: request.id, tickets: request.tickets.map((ticket) => ticket.id), agent, review, after: ticketState });
      if (!ticketState.running) break;
    }
    const generatedAfter = await listFiles(join(vs, "generated"));
    await page.screenshot({ path: join(evidence, `${label}-tickets.png`) });
    await record({ page: args.page, instructionSent: instruction, waves, generatedBefore, generatedAfter,
      manifest: await readJson(join(vs, "runtime/generation-manifest.json")) });
  } else if (phase === "touch") {
    // 사용자가 생성 파일을 직접 고친 상황(#282). 덮어쓰기 확인이 떠야 정상이다.
    const path = join(vs, "generated", args.file);
    const before = await readFile(path);
    await writeFile(path, Buffer.concat([before, Buffer.from(args.append ?? "\n// 사용자가 직접 고친 줄\n")]));
    await record({ file: args.file, before: sha256(before), after: sha256(await readFile(path)) });
  } else if (phase === "export") {
    await openDocument();
    await page.evaluate(async () => { window.exports = (await import("/src/features/editor/store/exportStore.ts")).useExportStore; });
    await menu("Export Code");
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
  await record({ error: error.message.split("\n")[0], dialogs, pageErrors, alerts });
  process.exitCode = 1;
} finally {
  await context.close();
}
