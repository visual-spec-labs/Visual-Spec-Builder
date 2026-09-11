#!/usr/bin/env node
// visual-spec CLI 진입점 — 이슈 #42(init), #104(skills), #105(GUI 실행).
//
// 지금은 `init`·`skills` 두 명령과, 인자 없이 실행했을 때의 GUI 실행이 있다.
// `docs/02-mvp-scope.md`가 정의한 배송 경로(npx visual-spec init → .visual-spec/
// 작업공간 → 스킬이 그 안에 씀)의 조각들이다.
//
// **GUI는 아직 .visual-spec/ 작업공간에 연결돼 있지 않다** — 지금 뜨는 화면은 브라우저
// 파일 다이얼로그·다운로드로 여닫는 그 편집기 그대로다(이슈 #105 본문이 "이 작업의 일부인지
// 별도인지 정해야 한다"고 남긴 질문에 대한 답 — 별도로 남겼다. GUI를 실행 가능하게 만드는
// 것과, 그 GUI가 작업공간을 읽고 쓰게 만드는 것은 서로 다른 크기의 작업이다).
//
// 이 파일은 scripts/generate-types.mjs와 같은 이유로 컴파일 없는 순수 Node 스크립트다:
// `npx visual-spec`은 사용자 프로젝트에서 빌드 없이 바로 실행돼야 한다. 다만 `init`·
// `skills`와 달리 GUI 실행 자체는 **이 패키지 자신의** Vite 개발 서버를 띄우는 것이라
// (에디터 소스가 사용자 프로젝트가 아니라 이 저장소 안에 있다), `PACKAGE_ROOT`를 cwd로
// 쓴다 — 아래 runGui 참고.

import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

/** 이 파일 자신의 위치 기준 — 대상 프로젝트(cwd)가 아니라 이 패키지 자신의 skills/를 읽는다. */
const DEFAULT_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 테스트 전용 탈출구다 — vite가 없는 가짜 패키지 루트를 넣어 "설치 안 된 경우" 에러
// 경로를 실제 CLI 실행으로 검증하려고 만들었다. 이 환경 변수는 문서화된 사용자 인터페이스가
// 아니다(README/사용법 어디에도 없다) — 정식 옵션으로 오해하지 않도록 여기 남긴다.
const PACKAGE_ROOT = process.env.VISUAL_SPEC_TEST_PACKAGE_ROOT ?? DEFAULT_PACKAGE_ROOT;
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

/**
 * 이 패키지 자신의 Vite 개발 서버 **JS 진입점** 경로. 없으면(=이 저장소에서 아직
 * `pnpm install`을 안 한 상태) 에러를 던진다 — spawn이 raw ENOENT를 던지기 전에
 * 여기서 먼저 걸러서 친절한 메시지로 바꾼다(init·installSkills의 ENOTDIR 선점 검사와
 * 같은 패턴).
 *
 * `node_modules/.bin/vite`가 아니라 `node_modules/vite/bin/vite.js`를 가리키는 이유는
 * 아래 runGui의 spawn 주석에 적었다 — 이슈 #115.
 *
 * @returns {string}
 */
function resolveViteEntry() {
  const viteEntry = join(PACKAGE_ROOT, "node_modules", "vite", "bin", "vite.js");

  if (!existsAsFile(viteEntry)) {
    throw new Error(
      `${viteEntry}를 찾을 수 없습니다 — 이 저장소에서 먼저 \`pnpm install\`을 실행해주세요.\n` +
        "(GUI는 지금 사용자 프로젝트가 아니라 이 패키지 자신의 개발 서버로 뜬다 — 이슈 #105 참고)",
    );
  }

  return viteEntry;
}

function printUsage() {
  console.log(
    [
      "사용법: visual-spec [command]",
      "",
      "인자 없이 실행하면 편집기 GUI를 띄운다.",
      "",
      "명령:",
      "  init    현재 폴더에 .visual-spec/ 작업공간을 만든다",
      "  skills  스킬 5종을 .claude/skills/에 설치·갱신한다",
      "  help    이 사용법을 보여준다",
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

/**
 * 이 패키지 자신의 Vite 개발 서버를 띄운다 — `--open`으로 기본 브라우저를 연다.
 * `stdio: "inherit"`이라 Ctrl+C가 그대로 전달되고, 서버가 찍는 로그(로컬 URL 등)도
 * 그대로 이 터미널에 보인다. `pnpm dev`와 동작은 같고, 사용자 프로젝트 어디서
 * 실행하든 이 패키지 자신의 개발 서버가 뜬다는 점만 다르다.
 *
 * **이 프로세스(부모)가 신호를 받으면 자식(vite)에도 그대로 전달한다.** 실제 터미널의
 * Ctrl+C는 foreground process group 전체에 SIGINT가 가서 원래도 문제없지만, 다른
 * 프로세스가 이 CLI의 PID만 콕 집어 SIGTERM을 보내는 경우(컨테이너 종료, 프로세스
 * 매니저, 테스트의 `child.kill()` 등)엔 전달이 자동으로 안 돼서 vite가 부모 없이
 * 계속 떠 있게 된다 — 직접 테스트하다 잡은 문제라 신호 전달을 명시적으로 넣었다.
 *
 * **일정 시간 안에 안 죽으면 강제 종료(SIGKILL)로 올린다.** vite의 graceful shutdown이
 * (의존성 재최적화 도중이거나 다른 이유로) 예상보다 오래 걸리거나 응답하지 않는 경우를
 * 직접 테스트하다 만났다 — 이 부모가 자식이 끝나기만 무한정 기다리면, 부모 자신도 안
 * 끝나고 vite도 고아로 남는다. 3초는 임의로 정한 값이다 — 정상 종료는 훨씬 빨리 끝난다.
 */
function runGui() {
  const viteEntry = resolveViteEntry();
  // **`node_modules/.bin/`의 런처가 아니라 vite의 JS 진입점을 지금 도는 node로 직접 돌린다.**
  // Windows에서 `.bin/`에 깔리는 건 확장자가 `.cmd`인 배치 런처인데, Node는
  // CVE-2024-27980 완화(18.20.2 / 20.12.2 이후) 이래 `.cmd`·`.bat`를 `shell: true` 없이
  // spawn하는 걸 거부한다 — 그대로 넘기면 `spawn EINVAL`로 죽는다(이슈 #115). CI가
  // ubuntu라 확장자 없는 런처를 골라 리눅스에서는 안 걸렸고, 그래서 체크는 초록인데
  // Windows 사용자만 깨졌다.
  //
  // `shell: true`로 막는 방법도 있지만, 그러면 인자가 셸을 한 번 거치고 플랫폼 분기도
  // 남는다. JS 진입점을 `process.execPath`(= 이 CLI를 돌리고 있는 바로 그 node)로 직접
  // 실행하면 분기 자체가 사라져서 이 종류의 버그가 다시 생길 자리가 없다 — 셸을 안 거치니
  // 주입 위험도 없다.
  const child = spawn(process.execPath, [viteEntry, "--open"], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    child.kill(signal);
    const forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => clearTimeout(forceKillTimer));
  };
  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", (code, signal) => {
    // process.on("SIGTERM"/"SIGINT", ...)을 등록하면 Node의 기본 동작(그 신호를
    // 받으면 바로 종료)이 사라진다 — 그래서 자식이 끝난 뒤 process.exit()를 직접
    // 불러야 이 프로세스도 실제로 죽는다. 처음엔 exitCode만 설정했는데, 신호를
    // 전달만 하고 자신은 안 죽어서 자식(vite)이 고아 프로세스로 남는 걸 테스트로
    // 직접 잡았다 — 정상 종료(Ctrl+C 등)는 대개 code가 아니라 signal로 온다.
    process.exit(code ?? (signal !== null ? 0 : 1));
  });
}

function main() {
  const [command] = process.argv.slice(2);

  if (command === undefined) {
    try {
      runGui();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
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
