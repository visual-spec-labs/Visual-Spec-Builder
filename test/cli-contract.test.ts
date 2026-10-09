import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 스킬 발견 위치와 설치 버전의 로컬 계약(#278). test/cli-skills.test.ts와 같은 이유로
 * CLI를 자식 프로세스로 실제 실행해 파일 시스템 결과로 검증한다.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(REPO_ROOT, "bin/visual-spec.mjs");
const CONTRACT = "visual-spec/contract";
const CONTRACT_FILES: [string, string][] = [
  ["schema/visual-spec.schema.json", "src/features/editor/schema/visual-spec.schema.json"],
  ["schema/command.schema.json", "src/features/editor/command/command.schema.json"],
  ["schema/ticket.schema.json", "src/features/editor/ticket/ticket.schema.json"],
  ["docs/05-schema.md", "docs/05-schema.md"],
  ["docs/08-natural-language.md", "docs/08-natural-language.md"],
  ["docs/09-command-schema-freeze.md", "docs/09-command-schema-freeze.md"],
  ["docs/11-ticket-schema-freeze.md", "docs/11-ticket-schema-freeze.md"],
  ["docs/16-responsive-codegen-qa.md", "docs/16-responsive-codegen-qa.md"],
];

function runCli(args: string[], cwd: string) {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status ?? 1 };
  }
}

function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(dir, join(prefix, entry.name)) : [join(prefix, entry.name)]);
}

let projectDir: string;
beforeEach(() => { projectDir = mkdtempSync(join(tmpdir(), "visual-spec-cli-contract-")); });
afterEach(() => { rmSync(projectDir, { recursive: true, force: true }); });

describe("visual-spec skills — 에이전트별 위치 (#278)", () => {
  it("기본은 Claude Code(.claude/skills)와 Codex(.agents/skills) 둘 다에 같은 내용을 설치한다", () => {
    expect(runCli(["skills"], projectDir).exitCode).toBe(0);
    const claude = listFiles(join(projectDir, ".claude/skills")).sort();
    const codex = listFiles(join(projectDir, ".agents/skills")).sort();
    expect(codex).toEqual(claude);
    for (const file of claude) {
      expect(readFileSync(join(projectDir, ".agents/skills", file))).toEqual(readFileSync(join(projectDir, ".claude/skills", file)));
    }
  });

  it("--agent로 한 위치에만 설치한다", () => {
    expect(runCli(["skills", "--agent", "codex"], projectDir).exitCode).toBe(0);
    expect(existsSync(join(projectDir, ".agents/skills/visual-spec/SKILL.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);

    expect(runCli(["skills", "--agent=claude"], projectDir).exitCode).toBe(0);
    expect(existsSync(join(projectDir, ".claude/skills/visual-spec/SKILL.md"))).toBe(true);

  });

  it("모르는 옵션·에이전트는 아무것도 쓰지 않고 거절한다 — --dir는 지원하지 않는다", () => {
    for (const args of [["--agent", "cursor"], ["--force"], ["--dir", "tools/skills"], ["--agent"]]) {
      const result = runCli(["skills", ...args], projectDir);
      expect(result.exitCode, args.join(" ")).toBe(1);
    }
    expect(readdirSync(projectDir)).toEqual([]);
  });
});

describe("설치 원자성·기기별 파일 (#278 PR 리뷰)", () => {
  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("뒤 위치가 쓰기 금지(0555)여도 앞 위치에 쓰지 않는다 (PR #298 리뷰)", () => {
    mkdirSync(join(projectDir, ".agents/skills"), { recursive: true });
    chmodSync(join(projectDir, ".agents/skills"), 0o555);
    try {
      const result = runCli(["skills"], projectDir);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("쓰기 권한");
      expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    } finally {
      chmodSync(join(projectDir, ".agents/skills"), 0o755);
    }
  });

  it("이미 최신인 읽기 전용 사본은 쓸 게 없으므로 권한 검사에 걸리지 않는다 (PR #298 셀프 리뷰)", () => {
    if (process.getuid?.() === 0) return;
    expect(runCli(["skills"], projectDir).exitCode).toBe(0);
    const skill = join(projectDir, ".claude/skills/visual-spec/SKILL.md");
    chmodSync(skill, 0o444);
    try {
      const rerun = runCli(["skills"], projectDir);
      expect(rerun.exitCode).toBe(0);
      expect(rerun.stdout).toContain("전부 최신 상태");
    } finally {
      chmodSync(skill, 0o644);
    }
  });

  it("한 위치라도 막히면 어느 위치에도 쓰지 않는다", () => {
    writeFileSync(join(projectDir, ".agents"), "not a directory");
    const result = runCli(["skills"], projectDir);
    expect(result.exitCode).toBe(1);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
  });

  it("LOCAL.md(기기별 CLI 경로)는 다른 기기에서 와도 갱신·경고 대상이 아니고 다시 쓰기만 한다", () => {
    runCli(["skills"], projectDir);
    for (const target of [".claude/skills", ".agents/skills"]) {
      writeFileSync(join(projectDir, target, CONTRACT, "LOCAL.md"), "다른 기기에서 커밋된 경로");
    }
    const rerun = runCli(["skills"], projectDir);
    expect(rerun.exitCode).toBe(0);
    expect(rerun.stdout).not.toContain("갱신함");
    expect(readFileSync(join(projectDir, ".claude/skills", CONTRACT, "LOCAL.md"), "utf8")).toContain(CLI_PATH);
  });
});

describe("로컬 계약 (#278)", () => {
  it("설치 버전의 스키마·문서·예제 사본과 검증 안내를 visual-spec/contract에 둔다", () => {
    expect(runCli(["skills"], projectDir).exitCode).toBe(0);
    for (const target of [".claude/skills", ".agents/skills"]) {
      const contract = join(projectDir, target, CONTRACT);
      for (const [path, source] of CONTRACT_FILES) {
        expect(readFileSync(join(contract, path), "utf8"), path).toBe(readFileSync(join(REPO_ROOT, source), "utf8"));
      }
      for (const example of listFiles(join(REPO_ROOT, "examples"))) {
        expect(readFileSync(join(contract, "examples", example), "utf8")).toBe(readFileSync(join(REPO_ROOT, "examples", example), "utf8"));
      }
      const readme = readFileSync(join(contract, "README.md"), "utf8");
      const { name, version } = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
      expect(readme).toContain(`${name}@${version}`);
      // README는 기기에 무관하다 — 이 기기의 CLI 경로는 LOCAL.md에만 있다(PR 리뷰).
      expect(readme).not.toContain(REPO_ROOT);
      expect(readFileSync(join(contract, "LOCAL.md"), "utf8")).toContain(`node "${CLI_PATH}" validate`);
    }
  });

  it("설치된 스킬의 상대 링크와 로컬 계약 경로가 모두 실제 파일로 이어진다", () => {
    expect(runCli(["skills"], projectDir).exitCode).toBe(0);
    const root = join(projectDir, ".agents/skills");
    for (const file of listFiles(root).filter((path) => path.endsWith("SKILL.md"))) {
      const text = readFileSync(join(root, file), "utf8");
      const skillDir = dirname(join(root, file));
      const links = [...text.matchAll(/\]\((\.\.?\/[^)#\s]+)\)/g)].map((match) => match[1]);
      const contractPaths = [...text.matchAll(/`(\.\.\/visual-spec\/contract\/[^`<\s]+)`/g)].map((match) => match[1]);
      for (const path of [...links, ...contractPaths]) {
        expect(existsSync(resolve(skillDir, path)), `${file} → ${path}`).toBe(true);
      }
    }
  });

  it("스킬은 GitHub 원문을 정본으로 쓰지 않는다 — 로컬 계약에 없는 문서의 선택적 경로로만 남는다", () => {
    for (const name of readdirSync(join(REPO_ROOT, "skills"))) {
      const text = readFileSync(join(REPO_ROOT, "skills", name, "SKILL.md"), "utf8");
      const remote = text.match(/raw\.githubusercontent\.com[^\s`)]*/g) ?? [];
      if (name === "visual-spec-docs") {
        expect(remote).toEqual(["raw.githubusercontent.com/visual-spec-labs/Visual-Spec-Builder/develop/docs/<파일>"]);
        expect(text).toContain("설치한 패키지보다 새 버전일 수 있다");
      } else {
        expect(remote, name).toEqual([]);
      }
    }
  });
});

describe("visual-spec validate (#278)", () => {
  it("유효한 스펙은 통과하고, 틀린 스펙은 이슈를 줄마다 보여 주며 exit 1로 끝난다", () => {
    const ok = runCli(["validate", join(REPO_ROOT, "examples/login-screen.json"), join(REPO_ROOT, "examples/two-page-project.json")], projectDir);
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout.match(/✓/g)).toHaveLength(2);

    const bad = runCli(["validate", join(REPO_ROOT, "examples/invalid/cycle.json")], projectDir);
    expect(bad.exitCode).toBe(1);
    expect(bad.stdout).toContain("✗");
    expect(bad.stdout).toContain("[cycle]");
  });

  it("앱이 여는 것처럼 옛 버전(0.1 화면 문서)도 변환해 검사한다", () => {
    const legacy = join(projectDir, "legacy.json");
    const spec = JSON.parse(readFileSync(join(REPO_ROOT, "examples/login-screen.json"), "utf8"));
    writeFileSync(legacy, JSON.stringify({ ...spec, version: "0.1" }));
    expect(runCli(["validate", legacy], projectDir).exitCode).toBe(0);
  });

  it("JSON이 아니거나 없는 파일, 인자 없음은 실패로 알린다", () => {
    writeFileSync(join(projectDir, "broken.json"), "{ not json");
    const broken = runCli(["validate", "broken.json", "missing.json"], projectDir);
    expect(broken.exitCode).toBe(1);
    expect(broken.stdout).toContain("JSON 파싱 실패");
    expect(broken.stdout).toContain("읽을 수 없음");
    expect(runCli(["validate"], projectDir).exitCode).toBe(1);
  });
});
