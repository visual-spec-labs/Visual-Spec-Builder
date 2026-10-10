// #292 실제 모델 여정 도구(real-model-journey.mjs)의 무비용 회귀(PR #358 리뷰). 실제 Chromium + 작업공간 서버를 쓰고
// 에이전트는 가짜 CLI다 — 모델을 부르지 않는다. 단계 실패가 명령 종료 코드 1로 전파되는지, argv가 셸 해석 없이
// 원문으로 가는지(Windows는 공백 경로의 .cmd 실행기, POSIX는 실행 스크립트), 프로젝트 카드를 이름 글자 그대로
// 고르는지 본다. CI 필수 묶음(run-journeys.sh)에는 넣지 않은 수동 검사다(docs/28 2절).
//   node scripts/browser/real-model-journey-fake.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startBrowserWorkspace } from "./harness.mjs";

const journey = fileURLToPath(new URL("./real-model-journey.mjs", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "vs-real-model-fake-"));
const vs = join(root, "ws/.visual-spec");
const bin = join(root, "agent bin");
const agentLog = join(root, "agent-calls.jsonl");
// 셸이 끼면 깨지는 모델 이름. 실제 모델 이름이 아니라 argv 보존 확인용이다.
const model = 'fake "model" & | > $HOME %PATH% (v2)';

const FAKE_AGENT = `import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
const mode = process.env.FAKE_AGENT_MODE;
appendFileSync(process.env.FAKE_AGENT_LOG, JSON.stringify({ mode, argv: process.argv.slice(2), input }) + "\\n", "utf8");
const vs = join(process.cwd(), ".visual-spec");
const read = (path) => JSON.parse(readFileSync(join(vs, path), "utf8"));
// GUI가 읽는 중에 빈 파일을 보지 않도록 임시 파일에 쓴 뒤 rename한다(응답 스킬 계약).
const write = (path, text) => {
  const target = join(vs, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target + ".tmp", text, "utf8");
  renameSync(target + ".tmp", target);
};
if (mode === "exit1") { process.stderr.write("가짜 에이전트: 인증이 만료되었습니다"); process.exit(1); }
if (mode.startsWith("nl-")) {
  const request = read("runtime/nl-request.json");
  const body = { protocol: 1, requestId: request.id };
  if (mode === "nl-wrong-id") write(request.responsePath, JSON.stringify({ ...body, requestId: "nl-earlier", commands: [] }));
  if (mode === "nl-error") write(request.responsePath, JSON.stringify({ ...body, error: "가짜 에이전트가 요청을 거절했습니다." }));
  // 형식은 맞지만 없는 노드를 고치는 응답 — GUI가 적용 관문에서 거부한다.
  if (mode === "nl-invalid") write(request.responsePath, JSON.stringify({ ...body,
    commands: [{ type: "updateNode", id: "missing-node", path: "name", value: "X" }] }));
  if (mode === "nl-ok") write(request.responsePath, JSON.stringify({ ...body,
    commands: [{ type: "updateNode", id: request.page.root, path: "name", value: "FakeRoot" }] }));
} else if (mode.startsWith("tickets-")) {
  const request = read("runtime/ticket-request.json");
  const done = mode === "tickets-ok";
  if (done) for (const ticket of request.tickets) write(ticket.outputPath, "export function Fake() { return null; }\\n");
  write(request.responsePath, JSON.stringify({ protocol: 2, requestId: request.id, results: request.tickets.map((ticket) =>
    done ? { ticketId: ticket.id, status: "done" } : { ticketId: ticket.id, status: "failed", message: "가짜 빌드 실패" }) }));
}
process.stdout.write(JSON.stringify({ is_error: false, num_turns: 1, result: "fake " + mode }));
`;

// 카드 이름 → 파일 이름. 정규식 원문이면 오류가 나거나(Design (v2) 다른 카드와 맞는(A.B ↔ AxB, A*B ↔ AAAB) 이름들이다.
const PROJECTS = {
  "design-v2-open": "Design (v2", "design-v2": "Design (v2)", "a-dot-b": "A.B", "a-x-b": "AxB",
  "a-star-b": "A*B", "aaab": "AAAB", "twin-1": "Twin", "twin-2": "Twin",
};

let runner;
let failed = false;
try {
  await mkdir(join(vs, "specs"), { recursive: true });
  await mkdir(bin, { recursive: true });
  const login = JSON.parse(await readFile(new URL("../../examples/login-screen.json", import.meta.url), "utf8")).screen;
  for (const [file, name] of Object.entries(PROJECTS)) {
    const screen = structuredClone(login);
    // AxB의 미리보기에는 "A.B"라는 글자가 그려진다. 카드 제목만 비교해야 한다.
    if (file === "a-x-b") screen.nodes.title.content = "A.B";
    await writeFile(join(vs, "specs", `${file}.json`), JSON.stringify({ version: "0.3", name, pageOrder: ["login"], pages: { login: screen } }), "utf8");
  }
  await writeFile(join(bin, "fake-agent.mjs"), FAKE_AGENT, "utf8");
  let agentBin;
  if (process.platform === "win32") {
    // npm 전역 설치(claude.cmd)와 같은 모양: 공백 경로의 .cmd가 %*로 node에 인자를 다시 넘긴다.
    agentBin = join(bin, "fake agent.cmd");
    await writeFile(agentBin, `@ECHO off\r\n"${process.execPath}" "%~dp0fake-agent.mjs" %*\r\n`, "utf8");
  } else {
    agentBin = join(bin, "fake agent");
    await writeFile(agentBin, `#!${process.execPath}\nimport(${JSON.stringify(join(bin, "fake-agent.mjs"))});\n`, "utf8");
    chmodSync(agentBin, 0o755);
  }

  runner = await startBrowserWorkspace(vs);
  const specHash = async () => Object.fromEntries(await Promise.all(Object.keys(PROJECTS).map(async (file) =>
    [file, JSON.parse(await readFile(join(vs, "specs", `${file}.json`), "utf8")).pages.login.nodes.root.name])));

  /** real-model-journey.mjs를 실제 명령으로 실행하고 종료 코드와 마지막 증거 줄을 돌려준다. */
  async function journeyRun(mode, phase, options) {
    const argv = [journey, phase, "--root", root, "--url", runner.url, "--agent-bin", agentBin, "--model", model, "--label", mode,
      ...Object.entries(options).flatMap(([key, value]) => [`--${key}`, value])];
    const logPath = join(root, "evidence/log.jsonl");
    const seen = existsSync(logPath) ? (await readFile(logPath, "utf8")).trim().split("\n").length : 0;
    const child = spawn(process.execPath, argv, { env: { ...process.env, FAKE_AGENT_MODE: mode, FAKE_AGENT_LOG: agentLog },
      stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const code = await new Promise((done) => child.on("close", done));
    // 이번 실행이 남긴 줄만 본다. 실패 줄이 있으면 그것, 없으면 단계 결과 줄이다(뒤에 alert 기록 줄이 붙을 수 있다).
    const entries = (await readFile(logPath, "utf8")).trim().split("\n").slice(seen).map((line) => JSON.parse(line));
    // 잠금 만료를 앞당기지 않는다. 실패한 단계가 요청 잠금을 풀어야 바로 다음 사례가 요청을 쓸 수 있다.
    return { code, last: entries.find((entry) => entry.error !== undefined) ?? entries[0], output };
  }
  async function expectFailure(name, mode, phase, options, message, check) {
    const before = await specHash();
    const { code, last, output } = await journeyRun(mode, phase, options);
    assert.equal(code, 1, `${name}: 종료 코드 1이어야 합니다.\n${output.slice(-2000)}`);
    assert.match(last.error ?? "", message, `${name}: ${last.error}`);
    check?.(last);
    assert.deepEqual(await specHash(), before, `${name}: 실패한 단계가 스펙을 바꿨습니다.`);
    console.log(`PASS ${name}: exit ${code} — ${last.error}`);
  }
  async function expectSuccess(name, mode, phase, options, changedFile) {
    const before = await specHash();
    const { code, last, output } = await journeyRun(mode, phase, options);
    assert.equal(code, 0, `${name}: 종료 코드 0이어야 합니다.\n${output.slice(-2000)}`);
    assert.equal(last.error, undefined, `${name}: ${last.error}`);
    const after = await specHash();
    if (changedFile) assert.deepEqual(after, { ...before, [changedFile]: "FakeRoot" }, `${name}: 요청한 문서만 바뀌어야 합니다.`);
    console.log(`PASS ${name}: exit 0`);
    return last;
  }

  const nl = (card, doc) => ({ card, doc, instruction: "제목을 바꿔 주세요" });
  // 1. 실패 전파: 비정상 종료 / exit 0이지만 응답 없음 / 이전 요청 응답 / 오류 응답 / GUI 적용 거부 / 미완료 티켓
  await expectFailure("exit 1", "exit1", "nl", nl("Design (v2", "design-v2-open"), /종료 코드 1로 끝났습니다/, (last) => {
    assert.equal(last.details.exitCode, 1);
    assert.equal(last.details.stage, "exit");
    assert.match(last.details.stderrTail, /인증이 만료되었습니다/);
  });
  await expectFailure("exit 0, 응답 없음", "nl-silent", "nl", nl("Design (v2", "design-v2-open"), /nl-response\.json이 없습니다/);
  await expectFailure("이전 요청의 requestId", "nl-wrong-id", "nl", nl("Design (v2", "design-v2-open"), /"nl-earlier"의 응답입니다/);
  await expectFailure("오류 응답", "nl-error", "nl", nl("Design (v2", "design-v2-open"), /오류 응답을 썼습니다/);
  await expectFailure("GUI 적용 거부", "nl-invalid", "nl", nl("Design (v2", "design-v2-open"), /GUI가 응답을 거부했습니다/);
  await expectFailure("미완료 티켓", "tickets-failed", "tickets", { card: "A*B", doc: "a-star-b" }, /완료되지 않은 티켓: .*=failed\(가짜 빌드 실패\)/,
    (last) => assert.equal(last.details.stage, "tickets"));
  // 2. 카드 이름: 글자 그대로 하나만 연다. 같은 이름이 둘이거나 없으면 실패한다.
  await expectFailure("같은 이름 카드 2개", "nl-ok", "nl", nl("Twin", "twin-1"), /"Twin"인 프로젝트 카드가 2개/);
  await expectFailure("없는 카드", "nl-ok", "nl", nl("A.", "a-dot-b"), /"A\."인 프로젝트 카드가 없습니다/);
  // 3. 정상 완료: 요청한 문서만 바뀌고, 가짜 CLI가 받은 argv·stdin이 원문 그대로다.
  for (const [card, doc] of [["Design (v2", "design-v2-open"], ["A.B", "a-dot-b"], ["A*B", "a-star-b"]]) {
    const last = await expectSuccess(`정상 완료 — 카드 ${card}`, "nl-ok", "nl", nl(card, doc), doc);
    assert.equal(last.guiState, "success");
  }
  const tickets = await expectSuccess("티켓 정상 완료", "tickets-ok", "tickets", { card: "A.B", doc: "a-dot-b" });
  assert.ok(tickets.final.tickets.length > 1 && tickets.final.tickets.every((ticket) => ticket.status === "done"));
  assert.equal(tickets.final.running, false);

  const calls = (await readFile(agentLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  for (const call of calls) {
    assert.deepEqual(call.argv.slice(-2), ["--model", model]);
    assert.ok(call.argv.includes("Bash(node:*)"));
    assert.match(call.input, /nl-request\.json|ticket-request\.json/);
  }
  console.log(`PASS argv·stdin 원문 보존: 가짜 CLI ${calls.length}회(${process.platform === "win32" ? "공백 경로 .cmd" : "POSIX 실행 스크립트"})`);
} catch (error) {
  failed = true;
  throw error;
} finally {
  await runner?.close();
  if (!failed) await rm(root, { recursive: true, force: true });
  else console.error(`증거를 남겼습니다: ${root}`);
}
