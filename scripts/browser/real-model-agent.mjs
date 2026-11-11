// #292 실제 모델 여정(real-model-journey.mjs)의 에이전트 실행과 단계 성공 판정.
// 브라우저·실제 모델 없이 test/real-model-agent.test.ts가 가짜 CLI로 검증한다(PR #358 리뷰).
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";

/** 사용자가 새 터미널에서 실행한 것과 같은 조건의 에이전트 인자. 지시문은 인자가 아니라 stdin으로 넘긴다. */
export function agentArgv(agent, { ws, model } = {}) {
  if (agent === "codex") {
    return ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "--ephemeral", "-C", ws, "--color", "never",
      "--json", ...(model ? ["-m", model] : []), "-"];
  }
  if (agent === "claude") {
    return ["-p", "--output-format", "json", "--setting-sources", "project", "--permission-mode", "acceptEdits",
      "--allowedTools", "Bash(node:*)", "--no-session-persistence", ...(model ? ["--model", model] : [])];
  }
  throw new Error(`--agent는 claude 또는 codex입니다: ${agent}`);
}

const isFile = (path) => { try { return statSync(path).isFile(); } catch { return false; } };

/**
 * Windows에서 셸 없이 실행할 파일을 찾는다. 확장자가 없으면 셸처럼 PATH × PATHEXT 순서로 찾는다
 * (npm 전역 설치는 `claude`(sh 스크립트)와 `claude.cmd`를 함께 두므로 확장자 없는 파일은 건너뛴다).
 */
export function resolveWindowsCommand(command, env = process.env) {
  const exts = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const candidates = (base) => (extname(base) ? [base] : exts.map((ext) => `${base}${ext}`));
  if (isAbsolute(command) || /[\\/]/.test(command)) return candidates(command).find(isFile) ?? null;
  const dirs = (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    const found = candidates(join(dir, command)).find(isFile);
    if (found) return found;
  }
  return null;
}

// cmd.exe가 해석하는 문자. 캐럿으로 글자 그대로 만든다.
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/**
 * .cmd/.bat 실행기에 넘길 인자 하나. MSVCRT 규칙으로 따옴표를 감싼 뒤 cmd 메타문자를 두 번 escape한다.
 * npm 실행기(claude.cmd 등)는 `%*`로 인자를 node에 다시 넘겨 cmd가 한 번 더 해석하기 때문이다.
 * 한 번만 escape하면 `a\"b` 뒤의 `^`가 사라지는 것을 실측했다.
 */
export function quoteCmdShimArgument(arg) {
  const quoted = `"${String(arg).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1")}"`;
  return quoted.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

/**
 * 에이전트 실행 계획. 어떤 OS에서도 `shell: true`를 쓰지 않는다.
 * - POSIX: 실행 파일과 argv를 그대로 넘긴다(`Bash(node:*)`가 셸 문법으로 해석되지 않는다).
 * - Windows .exe: 그대로 넘긴다. Node가 MSVCRT 규칙으로 인자를 감싼다.
 * - Windows .cmd/.bat: Node가 셸 없이 실행하지 못하므로 cmd.exe /d /s /c에 직접 escape한 명령 줄을 넘긴다.
 */
export function agentSpawnPlan(command, argv, { platform = process.platform, env = process.env } = {}) {
  if (platform !== "win32") return { file: command, args: [...argv], options: { shell: false } };
  const resolved = resolveWindowsCommand(command, env) ?? command;
  if (/\.(cmd|bat)$/i.test(resolved)) {
    const line = [resolved.replace(CMD_META, "^$1"), ...argv.map(quoteCmdShimArgument)].join(" ");
    return { file: env.ComSpec ?? env.COMSPEC ?? "cmd.exe", args: ["/d", "/s", "/c", `"${line}"`],
      options: { shell: false, windowsVerbatimArguments: true } };
  }
  return { file: resolved, args: [...argv], options: { shell: false } };
}

/** 실패 단계·종료 코드·stderr를 함께 남기는 실행 실패. real-model-journey가 증거에 기록한다. */
export class AgentRunError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "AgentRunError";
    this.details = details;
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * 에이전트를 실행하고 끝날 때까지 기다린다. 시작 실패·signal 종료·0이 아닌 종료 코드는 AgentRunError다.
 * 실행 중에는 `tickMs`마다 `onTick`을 부른다(GUI의 대기 연장).
 */
export async function runAgentProcess(plan, { cwd, env, input = "", step = "agent", onTick, tickMs = 20000 } = {}) {
  const started = Date.now();
  let child;
  try {
    child = spawn(plan.file, plan.args, { ...plan.options, cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) {
    throw new AgentRunError(`${step}: 에이전트를 시작하지 못했습니다 — ${error.message}`,
      { step, stage: "spawn", command: plan.file, exitCode: null, signal: null, stderrTail: "" });
  }
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  // 시작하지 못했거나 먼저 끝난 프로세스에 쓰다 난 EPIPE는 종료 판정으로 넘긴다.
  child.stdin.on("error", () => {});
  child.stdin.end(input);
  const exited = new Promise((done) => {
    child.once("error", (error) => done({ error }));
    child.once("close", (code, signal) => done({ code, signal }));
  });
  let ticks = 0;
  let outcome;
  while (!(outcome = await Promise.race([exited, sleep(tickMs).then(() => null)]))) {
    ticks += 1;
    await onTick?.();
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  const base = { step, command: plan.file, exitCode: outcome.code ?? null, signal: outcome.signal ?? null,
    stderrTail: stderr.slice(-2000), stdoutTail: stdout.slice(-2000), seconds };
  if (outcome.error) {
    throw new AgentRunError(`${step}: 에이전트를 시작하지 못했습니다 — ${outcome.error.message}`, { ...base, stage: "spawn" });
  }
  if (outcome.signal) {
    throw new AgentRunError(`${step}: 에이전트가 signal ${outcome.signal}로 끝났습니다.`, { ...base, stage: "exit" });
  }
  if (outcome.code !== 0) {
    throw new AgentRunError(`${step}: 에이전트가 종료 코드 ${outcome.code}로 끝났습니다.`, { ...base, stage: "exit" });
  }
  return { ...base, stdout, stderr, ticks };
}

/**
 * 에이전트 출력 요약과 출력 자체의 실패 여부. Claude는 `-p --output-format json` 결과의 is_error를 본다.
 * Codex `--json`의 이벤트 형식은 여기서 판정하지 않는다(종료 코드와 GUI 판정에 맡긴다).
 */
export function summarizeAgentOutput(agent, stdout) {
  if (agent === "codex") return { summary: { events: stdout.trim().split("\n").filter(Boolean).length }, failure: null };
  let result;
  try {
    result = JSON.parse(stdout.slice(stdout.indexOf("{")));
  } catch (error) {
    return { summary: { parseError: error.message }, failure: "에이전트 결과 JSON을 읽지 못했습니다." };
  }
  const summary = { isError: result.is_error, numTurns: result.num_turns, durationApiMs: result.duration_api_ms,
    models: Object.keys(result.modelUsage ?? {}), permissionDenials: result.permission_denials?.length ?? 0,
    result: String(result.result ?? "").slice(0, 2000) };
  return { summary, failure: result.is_error === true ? `에이전트 결과가 오류입니다: ${summary.result.slice(0, 300)}` : null };
}

/**
 * 자연어 단계의 실패 이유. 성공이면 null이다.
 * 에이전트가 끝난 뒤의 응답 파일과 GUI 판정을 모두 본다 — 종료 코드 0만으로 성공이라 하지 않는다.
 * `gui.kind`: success(적용·되돌리기 표시) | error | confirmation(배경 변경 확인 대기) | timeout.
 */
export function nlFailure({ requestId, response, malformed = false, gui }) {
  if (malformed) return "nl-response.json이 올바른 JSON이 아닙니다.";
  if (response === null || response === undefined) return "에이전트가 끝났지만 nl-response.json이 없습니다.";
  if (response.requestId !== requestId) {
    return `nl-response.json이 이번 요청(${requestId})이 아니라 ${JSON.stringify(response.requestId ?? null)}의 응답입니다.`;
  }
  if (typeof response.error === "string" && response.error !== "") return `에이전트가 오류 응답을 썼습니다: ${response.error}`;
  if (!gui || gui.kind === "timeout") return "GUI가 제한 시간 안에 응답을 적용하지 않았습니다.";
  if (gui.kind === "error") return `GUI가 응답을 거부했습니다: ${gui.text}`;
  if (gui.kind === "confirmation") return `GUI가 배경 변경 확인을 기다립니다(자동 승인하지 않음): ${gui.text}`;
  if (gui.kind !== "success") return `GUI 상태를 판정할 수 없습니다: ${gui.kind}`;
  return null;
}

/**
 * 티켓 단계의 실패 이유. 성공이면 null이다.
 * 모든 웨이브가 끝났고(running=false), 배치 오류(runError)가 없고, 대상 티켓이 전부 done이어야 한다.
 * 반복·대기 상한에 닿았으면(`limit`) 다른 조건과 무관하게 실패다.
 */
export function ticketRunFailure({ waves, final, limit }) {
  if (limit) return `상한에 닿아 실행을 끝까지 확인하지 못했습니다: ${limit}`;
  if (!waves || waves.length === 0) return "에이전트에 전달된 웨이브가 없습니다.";
  if (final.running) return "티켓 실행이 아직 끝나지 않았습니다(running=true).";
  if (final.runError) return `티켓 실행 오류: ${final.runError}`;
  if (!final.tickets || final.tickets.length === 0) return "대상 티켓이 없습니다.";
  const unfinished = final.tickets.filter((ticket) => ticket.status !== "done");
  if (unfinished.length > 0) {
    return `완료되지 않은 티켓: ${unfinished.map((ticket) => `${ticket.id}=${ticket.status}${ticket.error ? `(${ticket.error})` : ""}`).join(", ")}`;
  }
  return null;
}

/** 브라우저에서 실행한다. 자연어 편집 알림 줄의 상태를 읽는다(NaturalLanguageBar.tsx의 한 자리 알림). */
export function readNlGuiState() {
  const status = document.querySelector('section[aria-label="자연어 편집"] [role="status"]');
  if (!status) return null;
  const text = status.textContent.trim();
  const buttons = [...status.querySelectorAll("button")].map((button) => button.textContent.trim());
  if (status.querySelector(".text-error")) return { kind: "error", text };
  if (buttons.includes("변경 적용")) return { kind: "confirmation", text };
  if (buttons.includes("되돌리기")) return { kind: "success", text };
  return null;
}
