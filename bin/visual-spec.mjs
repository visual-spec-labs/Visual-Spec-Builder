#!/usr/bin/env node
// visual-spec CLI 진입점 — 이슈 #42.
//
// 지금은 `init` 한 명령만 있다. `docs/02-mvp-scope.md`가 정의한 배송 경로
// (npx visual-spec init → .visual-spec/ 작업공간 → 스킬이 그 안에 씀)의 첫 조각이고,
// `skills`(스킬 설치)·인자 없는 `visual-spec`(GUI 실행)은 이슈 #42 본문이 스스로
// "한 번에 다 만들 필요는 없다"며 나중으로 미룬 항목이라 여기 없다 — 있는 척하지 않는다.
//
// 이 파일은 scripts/generate-types.mjs와 같은 이유로 컴파일 없는 순수 Node 스크립트다:
// `npx visual-spec`은 사용자 프로젝트에서 빌드 없이 바로 실행돼야 한다.

import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

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

function printUsage() {
  console.log(
    [
      "사용법: visual-spec <command>",
      "",
      "명령:",
      "  init    현재 폴더에 .visual-spec/ 작업공간을 만든다",
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

  console.error(`알 수 없는 명령입니다: ${command}`);
  printUsage();
  process.exitCode = 1;
}

main();
