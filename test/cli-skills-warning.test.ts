import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI = resolve("bin/visual-spec.mjs");
let root: string;
let project: string;
let pkg: string;
const relativeSkill = ".claude/skills/visual-spec/SKILL.md";
function run(args: string[] = []) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: project, encoding: "utf8",
    env: { ...process.env, VISUAL_SPEC_TEST_PACKAGE_ROOT: pkg },
  });
}
function write(path: string, text: string) {
  mkdirSync(join(path, ".."), {recursive: true});
  writeFileSync(path, text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vsb-skill-warning-"));
  project = join(root, "project"); pkg = join(root, "package");
  mkdirSync(project);
  write(join(pkg, "node_modules/vite/bin/vite.js"), 'console.log("GUI_STARTED");');
  write(join(pkg, "skills/visual-spec/SKILL.md"), "current package contents");
});
afterEach(() => rmSync(root, {recursive: true, force: true}));

describe("GUI 시작 시 스킬 사본 경고 (#229)", () => {
  it("미설치·다른 도구만 설치된 프로젝트에는 경고하거나 파일을 만들지 않는다", () => {
    expect(run().stderr).toBe("");
    expect(existsSync(join(project, ".claude"))).toBe(false);
    write(join(project, ".claude/skills/other/SKILL.md"), "other");
    expect(run().stderr).toBe("");
  });
  it("동일한 사본은 조용히 시작하며 내용과 mtime을 보존한다", () => {
    expect(run(["skills"]).status).toBe(0);
    const path = join(project, relativeSkill); const before = statSync(path).mtimeMs;
    const result = run();
    expect(result.status).toBe(0); expect(result.stdout).toContain("GUI_STARTED");
    expect(result.stderr).toBe(""); expect(statSync(path).mtimeMs).toBe(before);
  });
  it("내용 차이는 경고만 하고 명시적인 skills 실행에서만 즉시 갱신한다", () => {
    run(["skills"]);
    const path = join(project, relativeSkill); writeFileSync(path, "local edits");
    const before = statSync(path).mtimeMs; const result = run();
    expect(result.status).toBe(0); expect(result.stdout).toContain("GUI_STARTED");
    expect(result.stderr).toContain("내용 다름:");
    expect(result.stderr).toContain("visual-spec skills");
    expect(result.stderr).toContain("버전은 추정하지 않습니다");
    expect(readFileSync(path, "utf8")).toBe("local edits");
    expect(statSync(path).mtimeMs).toBe(before);
    const updated = run(["skills"]);
    expect(updated.status).toBe(0); expect(updated.stdout).toContain("갱신함");
    expect(readFileSync(path, "utf8")).toBe("current package contents");
    expect(run().stderr).toBe("");
  });
  it("부분 설치의 파일 누락과 패키지에 추가된 스킬을 감지한다", () => {
    run(["skills"]);
    rmSync(join(project, relativeSkill));
    write(join(pkg, "skills/new-skill/SKILL.md"), "new");
    const result = run();
    expect(result.stderr).toContain(`없음: ${relativeSkill}`);
    expect(result.stderr).toContain("없음: .claude/skills/new-skill/SKILL.md");
    expect(existsSync(join(project, relativeSkill))).toBe(false);
  });
  it.each([".claude", ".claude/skills", ".claude/skills/visual-spec", relativeSkill])(
    "%s 링크는 따라 읽거나 바꾸지 않으며 GUI는 계속 시작한다", path => {
      const external = join(root, "external");
      write(external, "private contents");
      const target = join(project, path); mkdirSync(join(target, ".."), {recursive: true});
      symlinkSync(external, target);
      const result = run();
      expect(result.status).toBe(0); expect(result.stdout).toContain("GUI_STARTED");
      expect(result.stderr).toContain("symlink");
      expect(result.stderr).not.toContain("private contents");
      expect(readFileSync(external, "utf8")).toBe("private contents");
    },
  );
  it("파일 자리에 디렉터리가 있으면 구버전 대신 비교 불가로 알린다", () => {
    mkdirSync(join(project, relativeSkill), {recursive: true});
    const result = run();
    expect(result.status).toBe(0); expect(result.stderr).toContain("unreadable");
    expect(result.stderr).not.toContain("내용 다름:");
  });
  it.skipIf(process.getuid?.() === 0)("읽기 권한이 없으면 비교 불가를 알리고 변경하지 않는다", () => {
    run(["skills"]); const path = join(project, relativeSkill); chmodSync(path, 0);
    try {
      const result = run(); expect(result.status).toBe(0); expect(result.stderr).toContain("unreadable");
    } finally { chmodSync(path, 0o600); }
    expect(readFileSync(path, "utf8")).toBe("current package contents");
  });
});
