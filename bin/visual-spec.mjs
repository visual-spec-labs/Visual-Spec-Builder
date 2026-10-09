#!/usr/bin/env node
// visual-spec CLI 진입점 — 이슈 #42(init), #104(skills), #105(GUI 실행).
//
// 지금은 `init`·`skills`·`validate`(#278) 명령과, 인자 없이 실행했을 때의 GUI 실행이 있다.
// `docs/02-mvp-scope.md`가 정의한 배송 경로(npx visual-spec init → .visual-spec/
// 작업공간 → 스킬이 그 안에 씀)의 조각들이다.
//
// **GUI는 이제 .visual-spec/ 작업공간에 연결돼 있다**(이슈 #133) — Open/Save는 사용자
// cwd의 `.visual-spec/specs/`를, Import는 `.visual-spec/assets/`를 쓴다. 연결 고리는
// 아래 runGui가 vite에 실어 보내는 `VISUAL_SPEC_WORKSPACE` 환경 변수 하나다.
//
// 이 파일은 scripts/generate-types.mjs와 같은 이유로 컴파일 없는 순수 Node 스크립트다.
// 이 패키지는 레지스트리에 공개하지 않지만, `pnpm pack` tarball에는 에디터 소스와
// Vite 런타임 의존성이 포함된다. GUI는 **설치된 패키지 자체**의 Vite 서버를 띄우므로
// 사용자 프로젝트가 아닌 PACKAGE_ROOT를 cwd로 쓴다 — 아래 runGui 참고.

import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync, constants as fsConstants, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

/** 표시 전용. 파일 접근 경로와 POSIX 파일명의 역슬래시는 그대로 둔다. */
export function displayPath(path) {
  return path.split(sep).join("/");
}

/** 이 파일 자신의 위치 기준 — 대상 프로젝트(cwd)가 아니라 이 패키지 자신의 skills/를 읽는다. */
const DEFAULT_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 테스트 전용 탈출구다 — vite가 없는 가짜 패키지 루트를 넣어 "설치 안 된 경우" 에러
// 경로를 실제 CLI 실행으로 검증하려고 만들었다. 이 환경 변수는 문서화된 사용자 인터페이스가
// 아니다(README/사용법 어디에도 없다) — 정식 옵션으로 오해하지 않도록 여기 남긴다.
const PACKAGE_ROOT = process.env.VISUAL_SPEC_TEST_PACKAGE_ROOT ?? DEFAULT_PACKAGE_ROOT;
const SKILLS_SRC_DIR = join(PACKAGE_ROOT, "skills");

/**
 * 에이전트별 프로젝트 스킬 위치(#278). Claude Code는 `.claude/skills/`, Codex는
 * `.agents/skills/`에서 프로젝트 스킬을 찾는다. 사용자가 어느 쪽을 쓸지 알 수 없으므로
 * `visual-spec skills`는 기본으로 둘 다 설치한다. 그 밖의 에이전트에는 설치된 SKILL.md 경로를
 * 대화에서 직접 알려 준다.
 */
const SKILL_TARGETS = { claude: ".claude/skills", codex: ".agents/skills" };

/**
 * 설치한 패키지 버전의 정본 사본(#278). 스킬은 GitHub develop 원문이나 이 저장소의
 * `src/` 경로를 읽지 않고, 함께 설치되는 이 사본을 읽는다 — 네트워크 없이, 설치본과 같은
 * 버전으로. `visual-spec` 스킬 폴더 아래 `contract/`에 설치되어 다른 스킬 파일과 똑같이
 * 갱신·구버전 경고·정리 대상이 된다. 왼쪽은 skills 기준 설치 경로, 오른쪽은 패키지 안 원본.
 */
const CONTRACT_DIR = "visual-spec/contract";
const CONTRACT_FILES = [
  ["schema/visual-spec.schema.json", "src/features/editor/schema/visual-spec.schema.json"],
  ["schema/command.schema.json", "src/features/editor/command/command.schema.json"],
  ["schema/ticket.schema.json", "src/features/editor/ticket/ticket.schema.json"],
  ["docs/05-schema.md", "docs/05-schema.md"],
  ["docs/08-natural-language.md", "docs/08-natural-language.md"],
  ["docs/09-command-schema-freeze.md", "docs/09-command-schema-freeze.md"],
  ["docs/11-ticket-schema-freeze.md", "docs/11-ticket-schema-freeze.md"],
  ["docs/16-responsive-codegen-qa.md", "docs/16-responsive-codegen-qa.md"],
];
const CONTRACT_EXAMPLES_DIR = "examples";
/**
 * 이 기기의 CLI 경로를 적는 파일. 경로는 기기·설치 위치마다 다르므로 관리 대상(내용 비교·
 * 구버전 경고·정리)에서 뺀다 — 넣으면 스킬 폴더를 커밋한 프로젝트를 다른 사람이 열거나
 * 클론을 옮길 때마다 "내용 다름"이 뜬다(PR 리뷰, #278). `skills`를 실행할 때마다 다시 쓴다.
 */
const CONTRACT_LOCAL_FILE = join(CONTRACT_DIR, "LOCAL.md");

// .visual-spec/ 아래 스킬·GUI가 쓸 것으로 이슈 #42가 못박은 네 폴더.
// skills/visual-spec-to-react/SKILL.md가 쓰는 generated/pages, generated/components 같은
// 더 깊은 하위 폴더는 여기서 만들지 않는다 — 코드 생성 스킬이 파일을 쓸 때 알아서 만든다.
// preview(React Preview용 자리)는 MVP에서 빠졌다(02-mvp-scope.md·open-questions.md,
// 2026-08-15) — workspaceServer.ensureWorkspaceDirs도 애초에 안 만든다. 이슈 #189 전까지
// CLI만 계속 만들고 있었다.
const WORKSPACE_DIRS = ["specs", "generated", "assets", "runtime"];

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

/** 이 패키지의 이름·버전. 로컬 계약 README에 적는다. */
function packageInfo() {
  try {
    const { name, version } = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"));
    return { name: String(name), version: String(version) };
  } catch {
    return { name: "visual-spec", version: "unknown" };
  }
}

/** 설치되는 로컬 계약 안내문. 어느 기기에서 설치해도 같은 내용이어야 한다 — 기기별 경로는 LOCAL.md. */
function contractReadme() {
  const { name, version } = packageInfo();
  return [
    "# Visual Spec 로컬 계약",
    "",
    `이 폴더는 \`visual-spec skills\`가 설치한 **${name}@${version}** 의 정본 사본이다.`,
    "GitHub develop 원문이 아니라 이 사본을 읽는다 — 네트워크 없이, 설치본과 같은 버전이다.",
    "직접 고치지 않는다. 패키지를 갱신한 뒤 `visual-spec skills`를 다시 실행하면 함께 갱신된다.",
    "",
    "- `schema/visual-spec.schema.json` — Visual Spec IR(스펙 파일)의 정본 스키마",
    "- `schema/command.schema.json` — 자연어 응답의 Command 배열 스키마",
    "- `schema/ticket.schema.json` — 구현 티켓 스키마",
    "- `docs/` — 스키마 설명(05)·자연어(08)·Command 계약(09)·Ticket 계약(11)·반응형 코드 생성(16) 문서 사본.",
    "  문서 안의 다른 저장소 경로 링크는 이 사본에 없다.",
    "- `examples/` — 예제 스펙. `examples/invalid/`는 일부러 틀린 예다.",
    "- `LOCAL.md` — **이 기기에서** 쓰는 CLI 실행 명령. `skills`를 실행한 기기 기준이라 기기마다 다르다.",
    "",
    "## CLI 실행",
    "",
    "`LOCAL.md`에 이 기기의 정확한 명령이 있다. 없거나 그 경로가 없으면 추측하지 말고 사용자에게",
    "`visual-spec skills`를 실행한 명령(도구 저장소의 `bin/visual-spec.mjs` 경로)을 묻는다.",
    "",
    "- 스펙 검증: `visual-spec validate <스펙 파일>...` — 앱이 파일을 열 때와 같은 검증(0.3으로 변환 →",
    "  스키마·구조 검사). 유효하면 `✓`, 아니면 이슈마다 `[code] path: message`를 출력하고 exit 1.",
    "- GUI 실행: `visual-spec`(인자 없음, `visual-spec gui`라는 명령은 없다). 끝나지 않는 개발 서버라",
    "  백그라운드로 띄우고 출력의 `http://localhost:…` 주소를 사용자에게 알려 준다. `.visual-spec/`이",
    "  없으면 먼저 `visual-spec init`을 실행한다.",
    "",
  ].join("\n");
}

/** 이 기기의 CLI 실행 명령(LOCAL.md). 관리 대상이 아니다 — CONTRACT_LOCAL_FILE 주석. */
function contractLocal() {
  const cli = join(PACKAGE_ROOT, "bin", "visual-spec.mjs");
  return [
    "# 이 기기의 Visual Spec CLI",
    "",
    "`visual-spec skills`를 실행한 기기 기준이다. 다른 기기에서는 그 기기에서 `skills`를 다시 실행한다.",
    "",
    "```bash",
    `node "${cli}" validate <스펙 파일>...`,
    `node "${cli}" init`,
    `node "${cli}"`,
    "```",
    "",
    "마지막 줄은 GUI 실행이다(끝나지 않는 개발 서버 — 백그라운드로 띄운다).",
    "",
  ].join("\n");
}

/**
 * 스킬 하나가 설치할 파일 목록. `path`는 skills 기준 상대 경로다. `visual-spec` 스킬에는
 * 로컬 계약(`contract/`)이 함께 실린다(#278).
 *
 * @param {string} name
 * @returns {{ path: string, read: () => Buffer }[]}
 */
function skillSources(name) {
  const sources = listFilesRecursive(join(SKILLS_SRC_DIR, name)).map((source) => ({
    path: relative(SKILLS_SRC_DIR, source),
    read: () => readFileSync(source),
  }));
  if (name !== CONTRACT_DIR.split("/")[0]) return sources;
  for (const [path, source] of CONTRACT_FILES) {
    sources.push({ path: join(CONTRACT_DIR, path), read: () => readFileSync(join(PACKAGE_ROOT, source)) });
  }
  const examplesDir = join(PACKAGE_ROOT, CONTRACT_EXAMPLES_DIR);
  for (const source of listFilesRecursive(examplesDir)) {
    sources.push({ path: join(CONTRACT_DIR, "examples", relative(examplesDir, source)), read: () => readFileSync(source) });
  }
  sources.push({ path: join(CONTRACT_DIR, "README.md"), read: () => Buffer.from(contractReadme()) });
  return sources;
}

/**
 * 이 패키지의 skills/ 아래 폴더 전부를 cwd 기준 `target`(기본 `.claude/skills`)으로 복사한다.
 * 개수를 여기 적지 않는다 — `readdirSync`로 폴더를 그대로 훑으므로 스킬이 늘어도
 * 이 함수는 안 바뀌는데, 개수를 주석에 박아 두면 그 숫자만 매번 낡는다(2026-09-28,
 * 이슈 #194로 5종에서 6종이 되며 실제로 낡아 있었다).
 *
 * init과 달리 **덮어쓴다** — 스킬은 사용자가 손으로 고치는 파일이 아니라 이 도구가
 * 배포하는 콘텐츠라, "다시 설치"는 "최신으로 맞춘다"는 뜻이어야 한다. 다만 내용이
 * 똑같으면 쓰지 않는다(불필요한 mtime 변경·git diff 방지) — 파일 단위로 비교해서
 * 실제로 바뀐 스킬만 "갱신함"으로 보고한다.
 *
 * @param {string} cwd
 * @param {string} [target] cwd 기준 스킬 폴더(`SKILL_TARGETS`)
 * @returns {{ targetRoot: string, installed: string[], updated: string[], unchanged: string[] }}
 */
export function installSkills(cwd, target = SKILL_TARGETS.claude) {
  return applySkillInstall(planSkillInstall(cwd, target));
}

/**
 * 한 위치의 설치 계획을 만들고 **쓰기 전에** 전부 검사한다. 위치가 여럿이면 모든 위치의
 * 계획을 먼저 만든 뒤에 쓴다 — 두 번째 위치가 막혀 첫 위치만 반쯤 바뀐 채 끝나지 않게
 * 한다(PR 리뷰, #278).
 *
 * @param {string} cwd
 * @param {string} target
 */
export function planSkillInstall(cwd, target) {
  const targetRoot = join(cwd, target);

  // init의 .visual-spec 검사와 같은 이유 — .claude나 .claude/skills 자리에 파일이
  // 있으면 그 아래를 stat할 때 나는 ENOTDIR이 raw로 새 나가기 전에 먼저 막는다.
  const segments = target.split(/[\\/]/).filter(Boolean);
  for (let index = 1; index <= segments.length; index += 1) {
    const path = join(cwd, ...segments.slice(0, index));
    if (existsAsNonDir(path)) {
      throw new Error(
        `${displayPath(path)}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
      );
    }
  }

  const skillNames = readdirSync(SKILLS_SRC_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  // 쓰기 전에 관리 대상 전체를 검사한다. 링크 경계를 따라 복사·삭제하지 않는다.
  const plans = skillNames.map((name) => {
    const destDir = join(targetRoot, name);
    if (existsAsNonDir(destDir)) {
      throw new Error(
        `${displayPath(destDir)}가 이미 존재하지만 폴더가 아닙니다 — 지우거나 옮긴 뒤 다시 실행해주세요.`,
      );
    }
    const sources = skillSources(name);
    const local = name === CONTRACT_DIR.split("/")[0]
      ? [{ path: CONTRACT_LOCAL_FILE, read: () => Buffer.from(contractLocal()) }]
      : [];
    const installed = listInstalledSkillFiles(cwd, name, target);
    if (installed.unchecked.length) throw new Error(`스킬 경로를 확인해주세요: ${installed.unchecked.join(", ")}. 링크·파일/폴더 종류·읽기 권한을 확인하고 충돌 경로를 옮긴 뒤 다시 실행해주세요.`);
    for (const source of [...sources, ...local]) {
      const path = join(target, source.path);
      const status = inspectSkillPath(cwd, path);
      if (status !== "ok" && status !== "missing") throw new Error(`스킬 경로를 확인해주세요: ${displayPath(path)} (${status}). 링크·파일/폴더 종류·읽기 권한을 확인하고 충돌 경로를 옮긴 뒤 다시 실행해주세요.`);
    }
    const expected = new Set([...sources, ...local].map((source) => source.path));
    const obsolete = installed.files.filter((path) => !expected.has(path));
    return { name, sources, local, obsolete, destExisted: existsAsDir(destDir) };
  });

  // 쓰기 권한도 쓰기 전에 본다(PR #298 리뷰) — 폴더·파일 종류만 보면 권한 0555인 두 번째
  // 위치에서 쓰다가 실패해 첫 위치만 바뀐 채 끝난다.
  const unwritable = new Set();
  const checkWritable = (path) => {
    let probe = path;
    while (!existsAsDir(probe) && !existsAsFile(probe)) {
      const parent = dirname(probe);
      if (parent === probe) return;
      probe = parent;
    }
    try { accessSync(probe, fsConstants.W_OK); } catch { unwritable.add(displayPath(relative(cwd, probe) || ".")); }
  };
  for (const { sources, local, obsolete } of plans) {
    for (const source of [...sources, ...local]) {
      // 이미 같은 내용이면 쓰지 않으므로 권한도 필요 없다 — 읽기 전용 최신 사본은 통과한다.
      const dest = join(targetRoot, source.path);
      if (existsAsFile(dest) && readFileSync(dest).equals(source.read())) continue;
      checkWritable(dest);
    }
    for (const path of obsolete) checkWritable(dirname(join(targetRoot, path)));
  }
  if (unwritable.size) {
    throw new Error(`쓰기 권한이 없어 아무것도 설치하지 않았습니다: ${[...unwritable].join(", ")}. 권한을 확인한 뒤 다시 실행해주세요.`);
  }

  return { cwd, target, targetRoot, plans };
}

/**
 * 설치 중 바꾼 것을 되돌린다. 위치가 여럿일 때 뒤 위치에서 실패해도(검사 뒤에 생긴 권한
 * 변화·디스크 가득 참 등) 앞 위치를 원래대로 돌려 반쪽 설치를 남기지 않는다(PR #298 리뷰).
 *
 * @param {{ files: { path: string, previous: Buffer | null }[], dirs: string[] }} journal
 * @returns {string[]} 되돌리지 못한 경로. 비어 있어야 "모두 되돌렸다"고 말할 수 있다.
 */
export function rollbackSkillInstall(journal) {
  const failed = [];
  for (const { path, previous } of journal.files.reverse()) {
    try {
      if (previous === null) rmSync(path, { force: true });
      else writeFileSync(path, previous);
    } catch { failed.push(path); }
  }
  for (const dir of journal.dirs.reverse()) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { failed.push(dir); }
  }
  return failed;
}

/**
 * 검사를 마친 계획대로 쓴다.
 *
 * @param {ReturnType<typeof planSkillInstall>} plan
 * @returns {{ targetRoot: string, installed: string[], updated: string[], unchanged: string[] }}
 */
export function applySkillInstall({ cwd, target, targetRoot, plans }, journal = { files: [], dirs: [] }) {
  const installed = [];
  const updated = [];
  const unchanged = [];

  const writeIfChanged = (source) => {
    const destFile = join(targetRoot, source.path);
    const content = source.read();
    const exists = existsAsFile(destFile);
    if (exists && readFileSync(destFile).equals(content)) return false;
    // 이번 실행이 새로 만든 첫 폴더만 기록한다 — 되돌릴 때 그 아래는 전부 이번에 만든 것이다.
    const created = mkdirSync(dirname(destFile), { recursive: true });
    if (created) journal.dirs.push(created);
    journal.files.push({ path: destFile, previous: exists ? readFileSync(destFile) : null });
    writeFileSync(destFile, content);
    return true;
  };

  for (const { name, sources, local, obsolete, destExisted } of plans) {
    let changed = false;
    for (const source of sources) changed = writeIfChanged(source) || changed;
    // 기기별 파일은 쓰되 "갱신함"으로 세지 않는다 — 내용은 기기마다 다른 것이 정상이다.
    for (const source of local) writeIfChanged(source);

    // 명시적 갱신에 한해 현재 관리 스킬 안의 더 이상 배포하지 않는 파일을 정리한다.
    // 다른 스킬 디렉터리는 소유 여부를 알 수 없으므로 건드리지 않는다.
    for (const path of obsolete) {
      const relativePath = join(target, path);
      const status = inspectSkillPath(cwd, relativePath);
      if (status === "missing") continue;
      if (status !== "ok") throw new Error(`스킬 경로를 확인해주세요: ${displayPath(relativePath)} (${status})`);
      journal.files.push({ path: join(targetRoot, path), previous: readFileSync(join(targetRoot, path)) });
      unlinkSync(join(targetRoot, path));
      changed = true;
    }

    if (!destExisted) installed.push(name);
    else if (changed) updated.push(name);
    else unchanged.push(name);
  }

  return { targetRoot, installed, updated, unchanged };
}

/** 경고용 읽기만 수행한다. 링크·잘못된 경로를 따라 읽거나 수정하지 않는다. */
function inspectSkillPath(root, relativePath, directory = false) {
  const parts = relativePath.split(/[\\/]/);
  let path = root;
  for (let index = 0; index < parts.length; index += 1) {
    path = join(path, parts[index]);
    let stats;
    try {
      stats = lstatSync(path);
    } catch (error) {
      return error?.code === "ENOENT" ? "missing" : "unreadable";
    }
    if (stats.isSymbolicLink()) return "symlink";
    const wantsDirectory = index < parts.length - 1 || directory;
    if (wantsDirectory ? !stats.isDirectory() : !stats.isFile()) return "unreadable";
  }
  return "ok";
}

/** 현재 패키지가 관리하는 스킬 디렉터리만 양방향 비교한다. 반환 경로는 skills/ 기준. */
function listInstalledSkillFiles(cwd, name, target) {
  const files = [];
  const unchecked = [];
  function visit(path) {
    const relativePath = join(target, path);
    const status = inspectSkillPath(cwd, relativePath, true);
    if (status === "missing") return;
    if (status !== "ok") { unchecked.push(`${displayPath(relativePath)} (${status})`); return; }
    try {
      for (const entry of readdirSync(join(cwd, relativePath), { withFileTypes: true })) {
        const child = join(path, entry.name);
        if (entry.isDirectory()) visit(child);
        else if (entry.isFile()) files.push(child);
        else unchecked.push(`${displayPath(join(target, child))} (${entry.isSymbolicLink() ? "symlink" : "unreadable"})`);
      }
    } catch {
      unchecked.push(`${displayPath(relativePath)} (unreadable)`);
    }
  }
  visit(name);
  return { files, unchecked };
}

/**
 * 현재 패키지와 설치 사본의 실제 바이트를 비교한다(#229).
 * 차이를 구버전이라고 단정하지 않는다 — 사용자 편집도 차이를 만든다.
 * 미설치 프로젝트에는 경고하지 않으며, GUI 시작은 어떤 사본도 갱신하지 않는다.
 */
function warnAboutInstalledSkills(cwd) {
  for (const target of Object.values(SKILL_TARGETS)) warnAboutInstalledSkillsAt(cwd, target);
}

function warnAboutInstalledSkillsAt(cwd, target) {
  const rootStatus = inspectSkillPath(cwd, target, true);
  if (rootStatus === "missing") return;
  if (rootStatus !== "ok") {
    console.warn(`스킬 사본을 확인할 수 없습니다: ${target} (${rootStatus}). 링크·경로·읽기 권한을 확인해주세요. GUI는 계속 실행합니다.`);
    return;
  }
  try {
    const names = readdirSync(SKILLS_SRC_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    // 다른 도구의 스킬만 있는 새 프로젝트는 이 패키지 설치가 누락됐다고 오판하지 않는다.
    if (!names.some((name) => inspectSkillPath(cwd, `${target}/${name}`, true) !== "missing")) return;
    const changed = [];
    const missing = [];
    const unchecked = [];
    const obsolete = [];
    for (const name of names) {
      const sources = skillSources(name);
      const expected = new Set(sources.map((source) => source.path));
      const installed = listInstalledSkillFiles(cwd, name, target);
      unchecked.push(...installed.unchecked);
      obsolete.push(...installed.files
        .filter((path) => !expected.has(path) && path !== CONTRACT_LOCAL_FILE)
        .map((path) => join(target, path)));
      for (const source of sources) {
        const path = `${target}/${source.path}`;
        const status = inspectSkillPath(cwd, path);
        if (status === "missing") { missing.push(path); continue; }
        if (status !== "ok") { unchecked.push(`${displayPath(path)} (${status})`); continue; }
        try {
          if (!readFileSync(join(cwd, path)).equals(source.read())) changed.push(path);
        } catch {
          unchecked.push(`${displayPath(path)} (unreadable)`);
        }
      }
    }
    if (changed.length || missing.length || obsolete.length) {
      console.warn("스킬 사본이 현재 패키지와 다르거나 일부 파일이 없습니다. 버전은 추정하지 않습니다.");
      for (const path of changed) console.warn(`  내용 다름: ${displayPath(path)}`);
      for (const path of missing) console.warn(`  없음: ${displayPath(path)}`);
      for (const path of obsolete) console.warn(`  패키지에 없는 파일: ${displayPath(path)}`);
      console.warn("갱신하려면 `visual-spec skills`를 명시적으로 실행하세요. 해당 명령은 로컬 수정도 덮어쓰고 관리 스킬 안의 패키지에 없는 파일을 제거합니다. GUI 시작은 사본을 변경하지 않습니다.");
    }
    if (unchecked.length) {
      console.warn("스킬 사본 일부를 확인할 수 없습니다. 링크·경로·읽기 권한을 확인한 뒤 갱신 여부를 판단해주세요:");
      for (const path of unchecked) console.warn(`  ${path}`);
    }
  } catch {
    console.warn("스킬 사본 확인에 실패했습니다. 패키지 skills 폴더와 읽기 권한을 확인해주세요. GUI는 계속 실행합니다.");
  }
}

/**
 * 이 패키지 자신의 Vite 서버 **JS 진입점** 경로. 없으면 설치가 덜 된 패키지로 보고
 * spawn의 raw ENOENT 대신 설치 안내를 던진다.
 *
 * `node_modules/.bin/vite`가 아니라 `node_modules/vite/bin/vite.js`를 가리키는 이유는
 * 아래 runGui의 spawn 주석에 적었다 — 이슈 #115.
 *
 * @returns {string}
 */
function resolveViteEntry() {
  const viteEntry = join(PACKAGE_ROOT, "node_modules", "vite", "bin", "vite.js");

  let resolvedEntry = viteEntry;
  if (!existsAsFile(resolvedEntry)) {
    try {
      // pnpm의 isolated/hoisted 레이아웃에서는 의존성 링크가 패키지 바로 아래가
      // 아닐 수 있다. CLI 실행기가 제공하는 NODE_PATH를 포함해 Node 해석 규칙을 따른다.
      const viteModule = createRequire(join(PACKAGE_ROOT, "package.json")).resolve("vite");
      const viteRoot = resolve(dirname(viteModule), "..", "..");
      resolvedEntry = join(viteRoot, "bin", "vite.js");
    } catch {
      // 아래의 기존 설치 안내로 통일한다.
    }
  }

  if (!existsAsFile(resolvedEntry)) {
    throw new Error(
      `${viteEntry}를 찾을 수 없습니다 — 이 패키지 디렉터리에서 먼저 \`pnpm install\`을 실행해주세요.\n` +
        "GUI는 사용자 프로젝트가 아니라 설치된 visual-spec 패키지의 서버에서 실행됩니다.",
    );
  }

  return resolvedEntry;
}

function printUsage() {
  console.log(
    [
      "사용법: visual-spec [command]",
      "",
      "인자 없이 실행하면 편집기 GUI를 띄운다.",
      "",
      "명령:",
      "  init      현재 폴더에 .visual-spec/ 작업공간을 만든다",
      "  skills    스킬과 로컬 계약을 설치·갱신한다",
      "            기본: .claude/skills/(Claude Code)와 .agents/skills/(Codex) 둘 다",
      "            --agent claude|codex|all  한 에이전트 위치에만 설치",
      "  validate  스펙 파일을 앱과 같은 검증기로 검사한다: validate <파일>...",
      "  help      이 사용법을 보여준다",
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

/**
 * `skills` 인자에서 설치 위치를 고른다(#278). 기본은 Claude Code·Codex 두 곳이다 —
 * 사용자가 어느 에이전트를 쓸지 이 CLI는 알 수 없다. 쓰지 않는 쪽 폴더는 읽히지 않을
 * 뿐이다.
 *
 * @param {string[]} args
 * @returns {string[]} cwd 기준 스킬 폴더들
 */
export function resolveSkillTargets(args) {
  let agent = "all";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[index + 1];
    const name = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (name !== "--agent") throw new Error(`알 수 없는 skills 옵션입니다: ${arg}`);
    if (value === undefined || value === "") throw new Error(`${name}에 값이 필요합니다.`);
    if (!arg.includes("=")) index += 1;
    if (value !== "all" && !Object.hasOwn(SKILL_TARGETS, value)) {
      throw new Error(`--agent는 ${[...Object.keys(SKILL_TARGETS), "all"].join("|")} 중 하나입니다: ${value}`);
    }
    agent = value;
  }
  return agent === "all" ? Object.values(SKILL_TARGETS) : [SKILL_TARGETS[agent]];
}

function runSkills(args) {
  const targets = resolveSkillTargets(args);
  // 모든 위치를 검사한 뒤에만 쓴다 — 한 위치라도 막히면 아무것도 쓰지 않는다.
  const plans = targets.map((target) => planSkillInstall(process.cwd(), target));
  const journal = { files: [], dirs: [] };
  const results = [];
  try {
    for (const plan of plans) results.push({ target: plan.target, ...applySkillInstall(plan, journal) });
  } catch (error) {
    const failed = rollbackSkillInstall(journal);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(failed.length === 0
      ? `설치 중 실패해 이번 실행의 변경을 모두 되돌렸습니다: ${reason}`
      : `설치 중 실패했고 일부를 되돌리지 못했습니다(${failed.map((path) => displayPath(relative(process.cwd(), path))).join(", ")}). 이 경로를 확인한 뒤 다시 실행해주세요: ${reason}`);
  }
  for (const { target, targetRoot, installed, updated, unchanged } of results) {

    console.log(`${target}/ 설치 대상: ${displayPath(targetRoot)}`);
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
  console.log(`로컬 계약(스키마·문서·예제·검증 안내): ${targets.map((target) => `${target}/${CONTRACT_DIR}/`).join(", ")}`);
}

/**
 * 스펙 파일을 앱이 열 때와 같은 순서로 검사한다(#278): JSON 파싱 → 0.3으로 변환 →
 * 프로젝트(`pages`)면 `validateProjectSpec`, 아니면 `validateVisualSpec`.
 * `store/loadSpec.ts`의 `parseSpecJson`과 같은 판정이다. 하나라도 실패하면 exit 1.
 *
 * @param {string[]} files
 */
async function runValidate(files) {
  if (files.length === 0) throw new Error("검사할 스펙 파일을 지정하세요: visual-spec validate <파일>...");
  const { migrateToV03, validateProjectSpec, validateVisualSpec } = await import("./lib/schema.mjs");
  let failed = 0;
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(resolve(file), "utf8"));
    } catch (error) {
      failed += 1;
      const reason = error instanceof SyntaxError ? "JSON 파싱 실패" : "읽을 수 없음";
      console.log(`✗ ${file} — ${reason}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const migrated = migrateToV03(parsed);
    const isProject = typeof migrated === "object" && migrated !== null && "pages" in migrated;
    const { valid, issues } = isProject ? validateProjectSpec(migrated) : validateVisualSpec(migrated);
    if (valid) {
      console.log(`✓ ${file} — 유효함`);
      continue;
    }
    failed += 1;
    console.log(`✗ ${file} — 이슈 ${issues.length}건`);
    for (const issue of issues) console.log(`  [${issue.code}] ${issue.path || "/"}: ${issue.message}`);
  }
  if (failed) process.exitCode = 1;
}

/**
 * GUI 개발 서버에 넘길 `NODE_ENV`(이슈 #314).
 *
 * 사용자는 GUI를 이 개발 서버로 쓴다. 그대로 두면 React가 **개발 모드**로 돌아, 노드 1000개
 * 문서에서 편집 한 번에 JS 작업이 약 175ms 걸린다(production이면 약 24ms — 실측은
 * docs/22-performance-baseline.md). 개발 모드의 경고·성능 트랙 기록은 이 저장소를 고치는
 * 사람에게만 쓸모 있다. 그래서 CLI로 띄울 때는 `production`을 넘겨 Vite가 React production
 * 빌드를 쓰게 한다. 작업공간 미들웨어는 그대로 개발 서버의 것이다.
 *
 * 그 대가로 개발 모드에서만 있던 것이 사라진다: React Fast Refresh(소스가 바뀌면 상태 보존
 * 갱신 대신 페이지 전체를 새로 고친다), StrictMode의 effect 이중 실행, 자세한 React 오류 문구
 * (production은 `Minified React error #…`). 셋 다 이 저장소를 고치는 사람에게 필요한 것이라
 * `pnpm dev`나 `VISUAL_SPEC_REACT_DEV=1`에서 그대로 쓸 수 있다.
 *
 * 저장소에서 `pnpm dev`로 띄우는 개발자는 이 함수를 거치지 않으므로 개발 모드 그대로다.
 * CLI로 띄우면서 개발 모드가 필요하면(React 경고를 보며 디버깅) `VISUAL_SPEC_REACT_DEV=1`.
 */
export function guiNodeEnv(env) {
  return env.VISUAL_SPEC_REACT_DEV === "1" ? "development" : "production";
}

/**
 * 이 패키지 자신의 Vite 개발 서버를 띄운다 — `--open`으로 기본 브라우저를 연다.
 * `stdio: "inherit"`이라 Ctrl+C가 그대로 전달되고, 서버가 찍는 로그(로컬 URL 등)도
 * 그대로 이 터미널에 보인다. `pnpm dev`와 같은 개발 서버지만 React는 production 빌드로
 * 돈다(위 `guiNodeEnv`, #314). 사용자 프로젝트 어디서 실행하든 이 패키지 자신의 개발
 * 서버가 뜬다.
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
  warnAboutInstalledSkills(process.cwd());
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
  // **작업공간 위치를 환경 변수로 실어 보낸다**(이슈 #133).
  //
  // 바로 위에서 보듯 vite는 `cwd: PACKAGE_ROOT`로 뜬다 — 에디터 소스가 사용자
  // 프로젝트가 아니라 이 패키지 안에 있어서다. 그래서 사용자가 자기 프로젝트에서
  // `npx visual-spec`을 실행해도 **vite가 보는 cwd는 이 패키지 루트**이고, 사용자의
  // `.visual-spec/`은 **사용자의 cwd** 아래에 있다. vite 프로세스 안에서는 사용자의
  // 원래 cwd를 알아낼 방법이 없으므로 여기서 명시적으로 넘겨야 한다.
  //
  // 환경 변수를 고른 이유: CLI 인자로 넘기려면 vite의 인자 파싱을 건드려야 하고,
  // 설정 파일에 적으면 사용자마다 다른 절대 경로가 이 저장소 파일에 들어간다.
  // 프로세스 경계 하나를 넘기는 데는 환경 변수가 가장 얕은 방법이다.
  //
  // 이 변수가 없을 때의 폴백(= 저장소를 클론해 `pnpm dev`로 직접 띄운 개발자)은
  // `<vite root>/.visual-spec`이다 — src/features/workspace/workspaceServer.ts의
  // resolveWorkspaceRoot 참고. 이름도 그쪽 WORKSPACE_ENV_VAR와 같아야 한다.
  const workspaceDir = join(process.cwd(), ".visual-spec");

  const child = spawn(process.execPath, [viteEntry, "--open"], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    env: { ...process.env, VISUAL_SPEC_WORKSPACE: workspaceDir, NODE_ENV: guiNodeEnv(process.env) },
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

async function main() {
  const [command, ...rest] = process.argv.slice(2);

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
      runSkills(rest);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === "validate") {
    try {
      await runValidate(rest);
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

// 직접 실행했을 때만 명령을 처리한다 — 테스트가 함수를 import해도 GUI가 뜨지 않게 한다.
// npx·pnpm은 bin을 링크로 부르므로 실제 경로끼리 비교한다.
const invokedDirectly = (() => {
  try { return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) await main();
