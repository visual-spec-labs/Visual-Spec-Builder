#!/usr/bin/env node
// visual-spec CLI 진입점 — 이슈 #42(init), #104(skills).
//
// 지금은 `init`·`skills` 두 명령이 있다. `docs/02-mvp-scope.md`가 정의한 배송 경로
// (npx visual-spec init → .visual-spec/ 작업공간 → 스킬이 그 안에 씀)의 첫 조각이고,
// 인자 없는 `visual-spec`(GUI 실행)은 이슈 #42 본문이 스스로 "한 번에 다 만들 필요는
// 없다"며 나중으로 미룬 항목(이슈 #105로 분리)이라 여기 없다 — 있는 척하지 않는다.
//
// 이 파일은 scripts/generate-types.mjs와 같은 이유로 컴파일 없는 순수 Node 스크립트다:
// `npx visual-spec`은 사용자 프로젝트에서 빌드 없이 바로 실행돼야 한다.

import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

/** 이 파일 자신의 위치 기준 — 대상 프로젝트(cwd)가 아니라 이 패키지 자신의 skills/를 읽는다. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_SRC_DIR = join(PACKAGE_ROOT, "skills");

// .visual-spec/ 아래 스킬·GUI가 쓸 것으로 이슈 #42가 못박은 다섯 폴더.
// skills/visual-spec-to-react/SKILL.md가 쓰는 generated/pages, generated/components 같은
// 더 깊은 하위 폴더는 여기서 만들지 않는다 — 코드 생성 스킬이 파일을 쓸 때 알아서 만든다.
const WORKSPACE_DIRS = ["specs", "generated", "preview", "assets", "runtime"];

/**
 * cwd 아래 .visual-spec/ 워크스페이스를 만든다(멱등적).
 * 이미 있는 폴더는 그대로 두고, 없는 것만 만든다.
 *
 * @param {string} cwd
 * @returns {{ workspaceDir: string, created: string[], existing: string[] }}
 */
export function initWorkspace(cwd) {
  const workspaceDir = join(cwd, ".visual-spec");
  // 하위 폴더를 하나씩 보기 전에 .visual-spec 자신부터 본다 — 이게 파일이면
  // 그 아래 어떤 경로를 stat해도(예: .visual-spec/specs) "부모가 폴더가 아니다"라는
  // 별개의 에러(ENOTDIR)가 나서, existsAsDir/existsAsNonDir 둘 다 "없다"로 오판하고
  // mkdirSync가 그 raw ENOTDIR을 그대로 던지게 된다. 여기서 먼저 걸러야 그 경로로 안 샌다.
  if (existsAsNonDir(workspaceDir)) {
    throw new Error(
      `${workspaceDir}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
    );
  }

  const created = [];
  const existing = [];

  for (const dir of WORKSPACE_DIRS) {
    const path = join(workspaceDir, dir);
    if (existsAsDir(path)) {
      existing.push(dir);
      continue;
    }
    if (existsAsNonDir(path)) {
      throw new Error(
        `${path}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
      );
    }
    mkdirSync(path, { recursive: true });
    created.push(dir);
  }

  return { workspaceDir, created, existing };
}

function existsAsDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function existsAsNonDir(path) {
  try {
    return !statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function existsAsFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** dir 아래(하위 폴더 포함) 모든 파일의 절대 경로. 지금 각 스킬 폴더는 SKILL.md 한 장씩뿐이지만, 나중에 스킬에 자산 파일이 늘어도 그대로 동작하도록 재귀로 짰다. */
function listFilesRecursive(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
  return result;
}

/**
 * 이 패키지의 skills/ 5종을 cwd/.claude/skills/로 복사한다.
 *
 * init과 달리 **덮어쓴다** — 스킬은 사용자가 손으로 고치는 파일이 아니라 이 도구가
 * 배포하는 콘텐츠라, "다시 설치"는 "최신으로 맞춘다"는 뜻이어야 한다. 다만 내용이
 * 똑같으면 쓰지 않는다(불필요한 mtime 변경·git diff 방지) — 파일 단위로 비교해서
 * 실제로 바뀐 스킬만 "갱신함"으로 보고한다.
 *
 * @param {string} cwd
 * @returns {{ targetRoot: string, installed: string[], updated: string[], unchanged: string[] }}
 */
export function installSkills(cwd) {
  const claudeDir = join(cwd, ".claude");
  const targetRoot = join(claudeDir, "skills");

  // init의 .visual-spec 검사와 같은 이유 — .claude나 .claude/skills 자리에 파일이
  // 있으면 그 아래를 stat할 때 나는 ENOTDIR이 raw로 새 나가기 전에 먼저 막는다.
  if (existsAsNonDir(claudeDir)) {
    throw new Error(
      `${claudeDir}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
    );
  }
  if (existsAsNonDir(targetRoot)) {
    throw new Error(
      `${targetRoot}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
    );
  }

  const skillNames = readdirSync(SKILLS_SRC_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const installed = [];
  const updated = [];
  const unchanged = [];

  for (const name of skillNames) {
    const srcDir = join(SKILLS_SRC_DIR, name);
    const destDir = join(targetRoot, name);

    if (existsAsNonDir(destDir)) {
      throw new Error(
        `${destDir}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
      );
    }

    const destExisted = existsAsDir(destDir);
    let changed = false;

    for (const srcFile of listFilesRecursive(srcDir)) {
      const destFile = join(destDir, relative(srcDir, srcFile));
      const content = readFileSync(srcFile);

      if (existsAsFile(destFile) && readFileSync(destFile).equals(content)) {
        continue;
      }
      mkdirSync(dirname(destFile), { recursive: true });
      writeFileSync(destFile, content);
      changed = true;
    }

    if (!destExisted) installed.push(name);
    else if (changed) updated.push(name);
    else unchanged.push(name);
  }

  return { targetRoot, installed, updated, unchanged };
}

function printUsage() {
  console.log(
    [
      "사용법: visual-spec <command>",
      "",
      "명령:",
      "  init    현재 폴더에 .visual-spec/ 작업공간을 만든다",
      "  skills  스킬 5종을 .claude/skills/에 설치·갱신한다",
    ].join("\n"),
  );
}

function runInit() {
  const { workspaceDir, created, existing } = initWorkspace(process.cwd());

  console.log(`.visual-spec/ 작업공간: ${workspaceDir}`);
  for (const dir of created) {
    console.log(`  만듦     ${dir}/`);
  }
  for (const dir of existing) {
    console.log(`  이미 있음 ${dir}/`);
  }
  if (created.length === 0) {
    console.log("이미 다 있어서 새로 만든 건 없습니다.");
  }
}

function runSkills() {
  const { targetRoot, installed, updated, unchanged } = installSkills(process.cwd());

  console.log(`.claude/skills/ 설치 대상: ${targetRoot}`);
  for (const name of installed) {
    console.log(`  설치함    ${name}/`);
  }
  for (const name of updated) {
    console.log(`  갱신함    ${name}/`);
  }
  for (const name of unchanged) {
    console.log(`  최신 상태 ${name}/`);
  }
  if (installed.length === 0 && updated.length === 0) {
    console.log("전부 최신 상태라 바뀐 게 없습니다.");
  }
}

function main() {
  const [command] = process.argv.slice(2);

  if (command === undefined) {
    printUsage();
    return;
  }

  if (command === "init") {
    try {
      runInit();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === "skills") {
    try {
      runSkills();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  console.error(`알 수 없는 명령입니다: ${command}`);
  printUsage();
  process.exitCode = 1;
}

main();
