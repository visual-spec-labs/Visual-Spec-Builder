import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  AgentRunError, agentArgv, agentSpawnPlan, nlFailure, resolveWindowsCommand, runAgentProcess, summarizeAgentOutput,
  ticketRunFailure,
} from "../scripts/browser/real-model-agent.mjs";

// scripts/browser/real-model-journey.mjs의 에이전트 실행·판정 규칙(PR #358 리뷰). 실제 모델을 부르지 않는다.
// 가짜 CLI는 받은 argv·stdin을 그대로 출력한다. Windows .cmd 분기는 Windows CI·로컬에서, POSIX 실행은 Linux CI에서 실측한다.
const directory = mkdtempSync(join(tmpdir(), "vsb-real-model-agent-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const spaced = join(directory, "dir with space");
mkdirSync(spaced);
const recorder = join(spaced, "record.mjs");
writeFileSync(recorder, `let input = ""; process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const mode = process.env.FAKE_AGENT_MODE ?? "record";
  if (mode === "exit1") { process.stderr.write("인증 실패: 로그인하세요"); process.exit(1); }
  if (mode === "signal") { process.kill(process.pid, "SIGTERM"); setInterval(() => {}, 1000); return; }
  if (mode === "slow") { setTimeout(() => process.stdout.write("{}"), 300); return; }
  process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), input }));
});
`, "utf8");

// 셸 메타문자·따옴표·공백·한글·%·!·끝 역슬래시를 원문 그대로 받아야 한다.
const tricky = ["-p", "--allowedTools", "Bash(node:*)", "--model", "model with space & | > <", join(spaced, "out dir"),
  'say "hi"', String.raw`a\"b`, "x^y", "%PATH%", "!x!", "$HOME `id` $(id)", "a;b,c=d", "로그인 화면", "trail\\", ""];
const instruction = '지시문 "그대로" & | > $HOME %PATH% 끝\n둘째 줄';
const run = (plan: ReturnType<typeof agentSpawnPlan>, mode = "record", extra: { tickMs?: number; onTick?: () => void } = {}) =>
  runAgentProcess(plan, { cwd: directory, env: { ...process.env, FAKE_AGENT_MODE: mode }, input: instruction, step: "nl-test", ...extra });

describe("에이전트 인자", () => {
  it("Claude 기본 인자는 Bash(node:*)를 한 인자로 담고 지시문은 인자에 넣지 않는다", () => {
    const argv = agentArgv("claude", { model: "claude-opus-5-5" });
    expect(argv).toContain("Bash(node:*)");
    expect(argv.slice(-2)).toEqual(["--model", "claude-opus-5-5"]);
    expect(agentArgv("codex", { ws: "/w s" })).toEqual(expect.arrayContaining(["-C", "/w s", "-"]));
    expect(() => agentArgv("bash", {})).toThrow("claude 또는 codex");
  });
});

describe("실행 계획(셸 없음)", () => {
  it("POSIX는 실행 파일과 argv를 그대로 넘기고 shell을 쓰지 않는다", () => {
    for (const platform of ["linux", "darwin"] as const) {
      const plan = agentSpawnPlan("/opt/my tools/claude", tricky, { platform, env: { PATH: "/usr/bin" } });
      expect(plan).toEqual({ file: "/opt/my tools/claude", args: tricky, options: { shell: false } });
    }
  });

  it("Windows는 PATH×PATHEXT로 찾고 .cmd만 cmd.exe /d /s /c 분기로 보낸다(셸 옵션은 끈다)", () => {
    const bin = join(directory, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "fake-agent"), "#!/bin/sh\n");
    writeFileSync(join(bin, "fake-agent.cmd"), "@echo off\r\n");
    writeFileSync(join(bin, "tool.exe"), "");
    const env = { PATH: bin, PATHEXT: ".com;.exe;.bat;.cmd", ComSpec: "C:\\Windows\\system32\\cmd.exe" };
    // npm 전역 설치처럼 확장자 없는 sh 스크립트가 함께 있어도 .cmd를 고른다.
    expect(resolveWindowsCommand("fake-agent", env)).toBe(join(bin, "fake-agent.cmd"));
    const cmd = agentSpawnPlan("fake-agent", ["Bash(node:*)"], { platform: "win32", env });
    expect(cmd.file).toBe(env.ComSpec);
    expect(cmd.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
    expect(cmd.options).toEqual({ shell: false, windowsVerbatimArguments: true });
    expect(agentSpawnPlan("tool", ["a b"], { platform: "win32", env }))
      .toEqual({ file: join(bin, "tool.exe"), args: ["a b"], options: { shell: false } });
  });
});

describe("인자·stdin 원문 보존(가짜 실행기)", () => {
  it("실행 파일을 직접 실행하면 argv·stdin이 그대로 간다(Windows .exe / POSIX 분기)", async () => {
    const result = await run(agentSpawnPlan(process.execPath, [recorder, ...tricky]));
    expect(JSON.parse(result.stdout)).toEqual({ argv: tricky, input: instruction });
  });

  it.runIf(process.platform === "win32")("Windows: 공백 경로의 npm식 .cmd 실행기(%*)도 argv·stdin을 그대로 넘긴다", async () => {
    const shim = join(spaced, "fake agent.cmd");
    writeFileSync(shim, `@ECHO off\r\n"${process.execPath}" "%~dp0record.mjs" %*\r\n`, "utf8");
    const result = await run(agentSpawnPlan(shim, tricky));
    expect(JSON.parse(result.stdout)).toEqual({ argv: tricky, input: instruction });
    // 확장자 없는 이름도 PATH에서 .cmd로 찾아 같은 분기로 실행한다.
    const byName = await run(agentSpawnPlan("fake agent", tricky, { env: { ...process.env, PATH: spaced } }));
    expect(JSON.parse(byName.stdout)).toEqual({ argv: tricky, input: instruction });
  });

  it.runIf(process.platform !== "win32")("POSIX: 공백 경로의 실행 스크립트가 셸 해석 없이 argv·stdin을 받는다", async () => {
    const script = join(spaced, "fake agent");
    copyFileSync(recorder, `${script}.mjs`);
    writeFileSync(script, `#!${process.execPath}\nimport(${JSON.stringify(`${script}.mjs`)});\n`, "utf8");
    chmodSync(script, 0o755);
    const result = await run(agentSpawnPlan(script, tricky));
    expect(JSON.parse(result.stdout)).toEqual({ argv: tricky, input: instruction });
  });
});

describe("실패 전파", () => {
  const plan = agentSpawnPlan(process.execPath, [recorder]);

  it("0이 아닌 종료 코드는 단계·종료 코드·stderr와 함께 실패한다", async () => {
    const error = await run(plan, "exit1").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AgentRunError);
    expect((error as AgentRunError).message).toContain("nl-test: 에이전트가 종료 코드 1로 끝났습니다.");
    expect((error as AgentRunError).details).toMatchObject({ step: "nl-test", stage: "exit", exitCode: 1, signal: null });
    expect((error as AgentRunError).details.stderrTail).toContain("인증 실패");
  });

  it("시작하지 못한 실행 파일은 spawn 단계 실패다", async () => {
    const error = await run(agentSpawnPlan(join(directory, "없는 에이전트"), [], { env: { PATH: directory } }))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AgentRunError);
    expect((error as AgentRunError).details.stage).toBe("spawn");
  });

  it("signal로 끝나면 실패다(POSIX는 signal 이름, Windows는 0이 아닌 종료 코드)", async () => {
    const error = await run(plan, "signal").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AgentRunError);
    if (process.platform === "win32") expect((error as AgentRunError).details.exitCode).not.toBe(0);
    else expect((error as AgentRunError).details).toMatchObject({ stage: "exit", signal: "SIGTERM" });
  });

  it("실행 중에는 대기 연장 콜백을 부르고 정상 종료하면 출력을 돌려준다", async () => {
    let ticks = 0;
    const result = await run(plan, "slow", { tickMs: 50, onTick: () => { ticks += 1; } });
    expect(result).toMatchObject({ exitCode: 0, signal: null, stdout: "{}" });
    expect(ticks).toBeGreaterThan(0);
  });

  it("Claude 결과가 is_error거나 JSON이 아니면 exit 0이어도 실패다", () => {
    expect(summarizeAgentOutput("claude", '{"is_error":false,"num_turns":2,"result":"ok"}').failure).toBeNull();
    expect(summarizeAgentOutput("claude", '{"is_error":true,"result":"rate limited"}').failure).toContain("rate limited");
    expect(summarizeAgentOutput("claude", "not json").failure).toContain("JSON");
  });
});

describe("자연어 단계 판정", () => {
  const ok = { protocol: 1, requestId: "nl-2", commands: [] };
  const success = { kind: "success", text: "변경 1건 되돌리기" } as const;
  it.each([
    ["exit 0이지만 응답 없음", { requestId: "nl-2", response: null, gui: null }, "nl-response.json이 없습니다"],
    ["깨진 응답", { requestId: "nl-2", response: null, malformed: true, gui: null }, "올바른 JSON이 아닙니다"],
    ["이전 요청의 응답", { requestId: "nl-2", response: { ...ok, requestId: "nl-1" }, gui: null }, "\"nl-1\"의 응답"],
    ["오류 응답", { requestId: "nl-2", response: { ...ok, error: "모델이 거절" }, gui: null }, "오류 응답을 썼습니다: 모델이 거절"],
    ["GUI 오류", { requestId: "nl-2", response: ok, gui: { kind: "error", text: "노드가 없습니다" } }, "거부했습니다: 노드가 없습니다"],
    ["GUI 적용 timeout", { requestId: "nl-2", response: ok, gui: { kind: "timeout" } }, "제한 시간"],
    ["배경 변경 확인 대기", { requestId: "nl-2", response: ok, gui: { kind: "confirmation", text: "적용할까요?" } }, "확인을 기다립니다"],
  ] as const)("%s는 실패다", (_name, input, message) => {
    expect(nlFailure(input as Parameters<typeof nlFailure>[0])).toContain(message);
  });

  it("이번 requestId의 응답을 GUI가 적용했으면 성공이다", () => {
    expect(nlFailure({ requestId: "nl-2", response: ok, gui: success })).toBeNull();
  });
});

describe("티켓 단계 판정", () => {
  const done = { running: false, runError: null, tickets: [{ id: "Title", status: "done" }, { id: "Login", status: "done" }] };
  it.each([
    ["대기 상한", { waves: [{}], final: done, limit: "웨이브 2 요청을 30초 안에 받지 못했습니다" }, "상한에 닿아"],
    ["웨이브 없음", { waves: [], final: { ...done, runError: "작업공간 연결 끊김" }, limit: null }, "웨이브가 없습니다"],
    ["실행 중", { waves: [{}], final: { ...done, running: true }, limit: null }, "running=true"],
    ["배치 오류", { waves: [{}], final: { ...done, runError: "응답 시간 초과" }, limit: null }, "응답 시간 초과"],
    ["미완료 티켓", { waves: [{}], final: { ...done, tickets: [{ id: "Title", status: "done" },
      { id: "Login", status: "failed", error: "빌드 실패" }] }, limit: null }, "Login=failed(빌드 실패)"],
    ["대기 중 티켓", { waves: [{}], final: { ...done, tickets: [{ id: "Login", status: "pending" }] }, limit: null }, "Login=pending"],
  ] as const)("%s는 실패다", (_name, input, message) => {
    expect(ticketRunFailure(input as Parameters<typeof ticketRunFailure>[0])).toContain(message);
  });

  it("모든 웨이브가 끝나고 대상 티켓이 전부 done이면 성공이다", () => {
    expect(ticketRunFailure({ waves: [{}, {}], final: done, limit: null })).toBeNull();
  });
});
