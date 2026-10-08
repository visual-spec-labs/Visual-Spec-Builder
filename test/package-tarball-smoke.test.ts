import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PNPM_CLI = process.env.npm_execpath;
const SMOKE_TIMEOUT_MS = 120_000;
let scratch: string | undefined;

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_PATH;
  return env;
}

function runPnpm(cwd: string, args: string[], timeout = 60_000): string {
  if (PNPM_CLI === undefined) {
    throw new Error("패키지 smoke는 pnpm test에서 실행해야 합니다(npm_execpath 없음).");
  }
  return execFileSync(process.execPath, [PNPM_CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: cleanEnv(),
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForGui(child: ReturnType<typeof spawn>, workspacePath: string): Promise<string> {
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`GUI 프로세스가 ${child.exitCode}로 끝남:\n${output}`);
    const match = output.match(/Local:\s+(https?:\/\/\S+)/);
    if (match !== null) {
      const baseUrl = match[1].replace(/\/$/, "");
      const statusResponse = await fetch(`${baseUrl}/__vs/status`).catch(() => undefined);
      if (statusResponse?.ok) {
        const status = await statusResponse.json() as { ok: boolean; root: string; dirs: string[] };
        expect(status.ok).toBe(true);
        expect(status.root).toBe(workspacePath);
        expect(status.dirs).toContain("specs");
        const appResponse = await fetch(`${baseUrl}/`);
        expect(appResponse.ok).toBe(true);
        expect(await appResponse.text()).toContain("/src/main.tsx");
        const sourceResponse = await fetch(`${baseUrl}/src/main.tsx`);
        expect(sourceResponse.ok).toBe(true);
        expect(await sourceResponse.text()).toContain("createRoot");
        const faviconResponse = await fetch(`${baseUrl}/favicon.svg`);
        expect(faviconResponse.ok).toBe(true);
        expect(faviconResponse.headers.get("content-type")).toContain("image/svg+xml");
        return baseUrl;
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  throw new Error(`GUI 서버 시작 대기 시간 초과:\n${output}`);
}

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

it("실제 tarball을 새 production 소비 폴더에 설치해 CLI 리소스와 GUI 런타임을 연다", async () => {
  scratch = mkdtempSync(join(tmpdir(), "visual-spec-tarball-smoke-"));
  const packDir = join(scratch, "pack output");
  const consumerDir = join(scratch, "새 소비 프로젝트");
  const env = cleanEnv();
  env.NODE_ENV = "production";

  // pack 실행은 checkout 안에서 하되, 설치 소비 폴더는 저장소 바깥에 둔다.
  runPnpm(REPO_ROOT, ["pack", "--pack-destination", packDir]);
  const tarball = join(packDir, readdirSync(packDir).find((name) => name.endsWith(".tgz"))!);
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, "package.json"), JSON.stringify({ name: "smoke-consumer", private: true }));
  runPnpm(consumerDir, ["add", "--prod", "--prefer-offline", tarball], 90_000);

  const packageRoot = join(consumerDir, "node_modules", "visual-spec");
  const packageCli = join(packageRoot, "bin", "visual-spec.mjs");
  const example = join(packageRoot, "examples", "login-screen.json");
  expect(existsSync(packageCli)).toBe(true);
  expect(existsSync(join(packageRoot, "src", "main.tsx"))).toBe(true);
  expect(existsSync(join(packageRoot, "vite.config.ts"))).toBe(true);
  expect(existsSync(example)).toBe(true);
  expect(existsSync(join(packageRoot, "public", "favicon.svg"))).toBe(true);

  const cliEnv = { ...env, NODE_PATH: "" };
  const init = runPnpm(consumerDir, ["exec", "visual-spec", "init"], 15_000);
  expect(init).toContain(".visual-spec");
  const skills = runPnpm(consumerDir, ["exec", "visual-spec", "skills"], 15_000);
  expect(skills).toContain("visual-spec-to-react");
  expect(existsSync(join(consumerDir, ".claude", "skills", "visual-spec-to-react", "SKILL.md"))).toBe(true);
  expect(existsSync(join(consumerDir, ".claude", "skills", "visual-spec", "contract", "examples", "login-screen.json"))).toBe(true);
  const validation = runPnpm(consumerDir, ["exec", "visual-spec", "validate", example], 15_000);
  expect(validation).toContain("유효함");

  const child = spawn(process.execPath, [packageCli], {
    cwd: consumerDir,
    env: { ...cliEnv, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForGui(child, join(consumerDir, ".visual-spec"));
  } finally {
    child.kill();
    await new Promise<void>((resolveExit) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolveExit();
      const timer = setTimeout(() => resolveExit(), 5_000);
      child.once("exit", () => { clearTimeout(timer); resolveExit(); });
    });
  }
}, SMOKE_TIMEOUT_MS);
