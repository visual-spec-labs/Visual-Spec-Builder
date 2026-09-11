import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// bin/visual-spec.mjs는 컴파일 없이 사용자 프로젝트에서 바로 실행되는 진입점이라
// (scripts/generate-types.mjs와 같은 이유 — 이 파일 상단 주석 참고) 정적으로
// import하지 않는다. 대신 실제로 자식 프로세스로 실행해 파일 시스템에 남긴 결과로
// 검증한다 — 이 CLI가 실제로 하는 일(스킬이 쓸 폴더를 만드는 것)과 가장 가깝다.
const CLI_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/visual-spec.mjs");

const WORKSPACE_DIRS = ["specs", "generated", "preview", "assets", "runtime"];

function runCli(args: string[], cwd: string) {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], { cwd, encoding: "utf8" });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status ?? 1 };
  }
}

describe("visual-spec init (#42)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "visual-spec-cli-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("빈 프로젝트에 .visual-spec/ 아래 다섯 폴더를 만든다", () => {
    const result = runCli(["init"], projectDir);

    expect(result.exitCode).toBe(0);
    for (const dir of WORKSPACE_DIRS) {
      expect(existsSync(join(projectDir, ".visual-spec", dir))).toBe(true);
    }
  });

  it("이미 있는 워크스페이스에 다시 실행해도 안전하다(멱등) — 기존 파일을 안 지운다", () => {
    runCli(["init"], projectDir);
    const marker = join(projectDir, ".visual-spec", "specs", "keep-me.json");
    writeFileSync(marker, "{}");

    const result = runCli(["init"], projectDir);

    expect(result.exitCode).toBe(0);
    expect(existsSync(marker)).toBe(true);
  });

  it("`.visual-spec`이 폴더가 아니라 파일이면 에러로 끝난다 — 조용히 덮어쓰지 않는다", () => {
    writeFileSync(join(projectDir, ".visual-spec"), "이미 파일임");

    const result = runCli(["init"], projectDir);

    expect(result.exitCode).not.toBe(0);
  });

  it("`help`은 사용법을 보여주고 성공으로 끝난다 — 인자 없는 경우는 GUI를 띄운다(이슈 #105, test/cli-gui.test.ts 참고)", () => {
    const result = runCli(["help"], projectDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("init");
  });

  it("모르는 명령을 주면 실패로 끝난다", () => {
    const result = runCli(["nope"], projectDir);

    expect(result.exitCode).not.toBe(0);
  });

  it("깊이 중첩된 프로젝트 경로에서도 동작한다 — mkdirSync가 부모까지 만든다", () => {
    const nested = join(projectDir, "a", "b", "c");
    mkdirSync(nested, { recursive: true });

    const result = runCli(["init"], nested);

    expect(result.exitCode).toBe(0);
    for (const dir of WORKSPACE_DIRS) {
      expect(existsSync(join(nested, ".visual-spec", dir))).toBe(true);
    }
  });
});
