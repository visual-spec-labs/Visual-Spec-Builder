import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

// @ts-expect-error — 컴파일 없는 순수 Node 스크립트라 타입 선언이 없다.
import { rollbackSkillInstall } from "../bin/visual-spec.mjs";

/**
 * 쓰기 전 검사를 통과했지만 쓰는 도중 실패했을 때(검사 뒤 권한 변화·디스크 가득 참 등)
 * 이번 실행이 바꾼 것을 원래대로 돌린다(#278, PR #298 리뷰).
 */
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "visual-spec-rollback-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

it("덮어쓴 파일은 이전 내용으로, 새로 만든 파일·폴더는 지우고, 지운 파일은 되살린다", () => {
  mkdirSync(join(root, ".claude/skills/visual-spec"), { recursive: true });
  const overwritten = join(root, ".claude/skills/visual-spec/SKILL.md");
  writeFileSync(overwritten, "새 내용");
  const removed = join(root, ".claude/skills/visual-spec/old.md");
  const createdDir = join(root, ".agents");
  mkdirSync(join(createdDir, "skills/visual-spec"), { recursive: true });
  const created = join(createdDir, "skills/visual-spec/SKILL.md");
  writeFileSync(created, "새 파일");

  const failed = rollbackSkillInstall({
    files: [
      { path: overwritten, previous: Buffer.from("이전 내용") },
      { path: removed, previous: Buffer.from("지웠던 파일") },
      { path: created, previous: null },
    ],
    dirs: [createdDir],
  });

  expect(readFileSync(overwritten, "utf8")).toBe("이전 내용");
  expect(readFileSync(removed, "utf8")).toBe("지웠던 파일");
  expect(existsSync(createdDir)).toBe(false);
  expect(failed).toEqual([]);
});

it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("되돌리지 못한 경로를 돌려준다 — 모두 되돌렸다고 말하지 않게 한다", () => {
  const locked = join(root, "locked");
  mkdirSync(locked);
  const stray = join(locked, "new.md");
  writeFileSync(stray, "이번 실행이 만든 파일");
  chmodSync(locked, 0o555);
  try {
    expect(rollbackSkillInstall({ files: [{ path: stray, previous: null }], dirs: [] })).toEqual([stray]);
  } finally {
    chmodSync(locked, 0o755);
  }
});
