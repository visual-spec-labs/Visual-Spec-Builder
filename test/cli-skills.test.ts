import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// test/cli-init.test.ts와 같은 이유로 bin/visual-spec.mjs를 정적 import하지 않고
// 자식 프로세스로 실제 실행해 파일 시스템 결과로 검증한다.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(REPO_ROOT, "bin/visual-spec.mjs");
const SKILL_NAMES = [
  "visual-spec",
  "visual-spec-authoring",
  "visual-spec-docs",
  "visual-spec-to-react",
  "visual-spec-validate",
];

function runCli(args: string[], cwd: string) {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], { cwd, encoding: "utf8" });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status ?? 1 };
  }
}

describe("visual-spec skills (#104)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "visual-spec-cli-skills-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("스킬 5종을 .claude/skills/ 아래 설치한다 — 이 저장소의 skills/와 내용이 같다", () => {
    const result = runCli(["skills"], projectDir);

    expect(result.exitCode).toBe(0);
    for (const name of SKILL_NAMES) {
      const dest = join(projectDir, ".claude", "skills", name, "SKILL.md");
      const src = join(REPO_ROOT, "skills", name, "SKILL.md");
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, "utf8")).toBe(readFileSync(src, "utf8"));
    }
  });

  it("이미 최신 상태면 다시 실행해도 '최신 상태'로 보고한다(내용 비교로 불필요한 쓰기를 피한다)", () => {
    runCli(["skills"], projectDir);

    const result = runCli(["skills"], projectDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("전부 최신 상태라 바뀐 게 없습니다");
    for (const name of SKILL_NAMES) {
      expect(result.stdout).toContain(`최신 상태 ${name}/`);
    }
  });

  it("로컬에서 내용이 바뀐 스킬만 갱신하고 나머지는 그대로 둔다", () => {
    runCli(["skills"], projectDir);
    const editedPath = join(projectDir, ".claude", "skills", "visual-spec", "SKILL.md");
    writeFileSync(editedPath, "로컬에서 손댄 내용");

    const result = runCli(["skills"], projectDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("갱신함    visual-spec/");
    // 원본과 다시 같아졌다 — "최신으로 맞춘다"는 게 이 명령의 정의다.
    const src = join(REPO_ROOT, "skills", "visual-spec", "SKILL.md");
    expect(readFileSync(editedPath, "utf8")).toBe(readFileSync(src, "utf8"));
  });

  it("`.claude`가 폴더가 아니라 파일이면 에러로 끝난다", () => {
    writeFileSync(join(projectDir, ".claude"), "이미 파일임");

    const result = runCli(["skills"], projectDir);

    expect(result.exitCode).not.toBe(0);
  });

  it("`.claude/skills`가 폴더가 아니라 파일이면 에러로 끝난다", () => {
    mkdirSync(join(projectDir, ".claude"));
    writeFileSync(join(projectDir, ".claude", "skills"), "이미 파일임");

    const result = runCli(["skills"], projectDir);

    expect(result.exitCode).not.toBe(0);
  });

  it("개별 스킬 폴더 자리에 파일이 있으면 그 스킬만 에러로 끝난다", () => {
    mkdirSync(join(projectDir, ".claude", "skills"), { recursive: true });
    writeFileSync(join(projectDir, ".claude", "skills", "visual-spec"), "이미 파일임");

    const result = runCli(["skills"], projectDir);

    expect(result.exitCode).not.toBe(0);
  });

  it("사용법에 skills 명령이 나온다 — 인자 없는 경우는 GUI를 띄운다(이슈 #105, test/cli-gui.test.ts 참고)", () => {
    const result = runCli(["help"], projectDir);

    expect(result.stdout).toContain("skills");
  });
});
