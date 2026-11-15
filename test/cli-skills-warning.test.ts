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
const CONTRACT_SOURCES = [
  "src/features/editor/schema/visual-spec.schema.json",
  "src/features/editor/command/command.schema.json",
  "src/features/editor/ticket/ticket.schema.json",
  "docs/05-schema.md",
  "docs/08-natural-language.md",
  "docs/09-command-schema-freeze.md",
  "docs/11-ticket-schema-freeze.md",
  "docs/16-responsive-codegen-qa.md",
  "examples/sample.json",
];
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
  // 실제 패키지처럼 로컬 계약 원본(#278)도 둔다 — visual-spec 스킬과 함께 contract/로 설치된다.
  for (const source of CONTRACT_SOURCES) write(join(pkg, source), `contract ${source}`);
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
  it("LF·CRLF·바이너리 사본은 원본 바이트를 보존하고 줄바꿈 차이도 명시 갱신한다", () => {
    const source = join(pkg, "skills/visual-spec/SKILL.md");
    writeFileSync(source, "first\nsecond\n");
    const binary = Buffer.from([0, 13, 10, 255, 128]);
    writeFileSync(join(pkg, "skills/visual-spec/image.png"), binary);
    expect(run(["skills"]).status).toBe(0);
    const target = join(project, relativeSkill);
    expect(readFileSync(target)).toEqual(readFileSync(source));
    expect(readFileSync(join(project, ".claude/skills/visual-spec/image.png"))).toEqual(binary);
    writeFileSync(target, "first\r\nsecond\r\n");
    expect(run().stderr).toContain(`내용 다름: ${relativeSkill}`);
    expect(readFileSync(target, "utf8")).toBe("first\r\nsecond\r\n");
    expect(run(["skills"]).status).toBe(0);
    expect(readFileSync(target)).toEqual(readFileSync(source));
    expect(run().stderr).toBe("");
  });
  it("Codex 위치(.agents/skills) 사본의 차이도 같은 방식으로 경고만 한다 (#278)", () => {
    expect(run(["skills"]).status).toBe(0);
    const path = join(project, ".agents/skills/visual-spec/SKILL.md"); writeFileSync(path, "local edits");
    const result = run();
    expect(result.status).toBe(0); expect(result.stdout).toContain("GUI_STARTED");
    expect(result.stderr).toContain("내용 다름: .agents/skills/visual-spec/SKILL.md");
    expect(result.stderr).not.toContain(".claude/skills/visual-spec/SKILL.md");
    expect(readFileSync(path, "utf8")).toBe("local edits");
  });
  it("기기별 LOCAL.md 내용 차이는 경고하지 않는다 (#278 PR 리뷰)", () => {
    expect(run(["skills"]).status).toBe(0);
    for (const target of [".claude/skills", ".agents/skills"]) {
      writeFileSync(join(project, target, "visual-spec/contract/LOCAL.md"), "다른 기기의 CLI 경로");
    }
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
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
  it("삭제·이름 변경된 중첩 파일도 경고하고 명시 갱신 후에는 경고가 사라진다", () => {
    const oldSource = join(pkg, "skills/visual-spec/references/old.md");
    write(oldSource, "old reference"); run(["skills"]);
    rmSync(oldSource);
    write(join(pkg, "skills/visual-spec/references/new.md"), "new reference");
    write(join(project, ".claude/skills/unrelated/SKILL.md"), "user skill");
    const oldTarget = join(project, ".claude/skills/visual-spec/references/old.md");
    const warning = run();
    expect(warning.status).toBe(0);
    expect(warning.stderr).toContain("패키지에 없는 파일:");
    expect(warning.stderr).toContain("패키지에 없는 파일: .claude/skills/visual-spec/references/old.md");
    expect(warning.stderr).toContain("없음: .claude/skills/visual-spec/references/new.md");
    expect(readFileSync(oldTarget, "utf8")).toBe("old reference");
    const update = run(["skills"]);
    expect(update.status).toBe(0); expect(update.stdout).toContain("갱신함");
    expect(existsSync(oldTarget)).toBe(false);
    expect(readFileSync(join(project, ".claude/skills/visual-spec/references/new.md"), "utf8")).toBe("new reference");
    expect(readFileSync(join(project, ".claude/skills/unrelated/SKILL.md"), "utf8")).toBe("user skill");
    expect(run().stderr).toBe("");
    expect(run(["skills"]).stdout).toContain("전부 최신 상태");
  });
  it("삭제만 있어도 갱신함으로 보고하고 관리 스킬 밖의 사본은 보존한다", () => {
    write(join(pkg, "skills/visual-spec/obsolete.md"), "old"); run(["skills"]);
    rmSync(join(pkg, "skills/visual-spec/obsolete.md"));
    write(join(project, ".claude/skills/removed-or-user-skill/SKILL.md"), "unknown ownership");
    expect(run().stderr).toContain("obsolete.md");
    expect(run(["skills"]).stdout).toContain("갱신함");
    expect(existsSync(join(project, ".claude/skills/visual-spec/obsolete.md"))).toBe(false);
    expect(readFileSync(join(project, ".claude/skills/removed-or-user-skill/SKILL.md"), "utf8")).toBe("unknown ownership");
    expect(run().stderr).toBe("");
  });
  it.each(["obsolete.md", "references"])("배포에서 빠진 %s 링크는 갱신 시에도 따라가거나 삭제하지 않는다", name => {
    run(["skills"]);
    const external = join(root, "external"); write(external, "external content");
    const target = join(project, ".claude/skills/visual-spec", name); symlinkSync(external, target);
    writeFileSync(join(project, relativeSkill), "local version");
    expect(run().stderr).toContain("symlink");
    const update = run(["skills"]);
    expect(update.status).not.toBe(0); expect(update.stderr).toContain("symlink");
    expect(readFileSync(external, "utf8")).toBe("external content");
    expect(readFileSync(join(project, relativeSkill), "utf8")).toBe("local version");
  });
  it.each(["file-to-directory", "directory-to-file"])("%s 경로 종류 충돌은 자동 삭제 없이 명확히 거부한다", change => {
    const source = join(pkg, "skills/visual-spec/shape");
    if (change === "file-to-directory") write(source, "old file");
    else write(join(source, "old.md"), "old nested file");
    run(["skills"]);
    rmSync(source, {recursive: true});
    if (change === "file-to-directory") write(join(source, "new.md"), "new nested file");
    else write(source, "new file");
    const result = run(["skills"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("파일/폴더 종류");
    expect(result.stderr).toContain("충돌 경로를 옮긴 뒤");
    const retained = join(project, ".claude/skills/visual-spec/shape", change === "file-to-directory" ? "" : "old.md");
    expect(readFileSync(retained, "utf8")).toBe(change === "file-to-directory" ? "old file" : "old nested file");
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
  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("읽기 권한이 없으면 비교 불가를 알리고 변경하지 않는다", () => {
    run(["skills"]); const path = join(project, relativeSkill); chmodSync(path, 0);
    try {
      const result = run(); expect(result.status).toBe(0); expect(result.stderr).toContain("unreadable");
    } finally { chmodSync(path, 0o600); }
    expect(readFileSync(path, "utf8")).toBe("current package contents");
  });
});
