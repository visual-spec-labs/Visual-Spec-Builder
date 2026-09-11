import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// test/cli-init.test.ts와 같은 이유로 bin/visual-spec.mjs를 정적 import하지 않는다.
const CLI_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/visual-spec.mjs");

function runCli(args: string[], cwd: string, env?: Record<string, string>) {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status ?? 1 };
  }
}

describe("visual-spec (인자 없음 — GUI 실행, #105)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "visual-spec-cli-gui-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("`help`/`--help`/`-h`는 인자 없이 실행하면 GUI가 뜬다고 안내한다", () => {
    for (const flag of ["help", "--help", "-h"]) {
      const result = runCli([flag], projectDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("GUI");
    }
  });

  it("이 패키지의 Vite 개발 서버 바이너리가 없으면 에러로 끝난다 — raw ENOENT가 아니라 안내 메시지로", () => {
    // vite가 없는 가짜 패키지 루트를 넣어 "설치 안 된 경우"를 강제한다 — 이 프로세스
    // 환경 변수는 이 CLI의 공개 인터페이스가 아니다(bin/visual-spec.mjs 상단 주석 참고).
    const fakeRoot = mkdtempSync(join(tmpdir(), "visual-spec-fake-root-"));
    try {
      const result = runCli([], projectDir, { VISUAL_SPEC_TEST_PACKAGE_ROOT: fakeRoot });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("pnpm install");
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  // vitest 자체의 기본 테스트 타임아웃(5초)보다 넉넉하게 잡는다 — 셋째 인자로
  // 안 주면 내부 Promise가 끝나기 전에 vitest가 먼저 테스트를 죽인다. CI에서
  // 실제로 5초 타임아웃에 걸리는 걸 보고 여유를 뒀다(느려서가 아니라 아래
  // NO_COLOR 버그 때문이었다 — 그래도 CI 변동성 여유는 남겨둔다).
  const GUI_START_TIMEOUT_MS = 20000;

  it(
    "실제로 이 패키지의 Vite 개발 서버를 띄운다 — cwd와 무관하게 이 저장소의 에디터가 뜬다",
    async () => {
      // GUI는 사용자 프로젝트가 아니라 이 패키지 자신의 소스를 서빙하므로, cwd는
      // projectDir(빈 임시 폴더)로 둬도 정상적으로 이 저장소의 vite.config.ts를 쓴다 —
      // 이 격리 자체가 검증 대상이다.
      //
      // NO_COLOR: GitHub Actions에서는 vite가 ANSI 색상 코드를 찍는다(로컬 터미널
      // 밖 파이프인데도) — "VITE"와 " v8.2.1" 사이에 이스케이프 시퀀스가 끼어들어
      // 아래 정규식이 매치를 놓쳤다. 로컬에서는 재현이 안 돼서 실제 CI 실패 로그를
      // 보고서야 잡았다 — 색을 아예 꺼서 출력을 결정적으로 만든다.
      const child = spawn("node", [CLI_PATH], {
        cwd: projectDir,
        env: { ...process.env, NO_COLOR: "1" },
      });
      let output = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      try {
        await new Promise<void>((resolvePromise, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`${GUI_START_TIMEOUT_MS}ms 안에 뜨지 않음 — 지금까지 출력:\n${output}`));
          }, GUI_START_TIMEOUT_MS);
          const poll = setInterval(() => {
            // 아래 단언과 **같은** 패턴을 기다린다. 배너("VITE v8...")가 먼저 찍히고
            // "Local: http://..." 줄은 조금 뒤에 오기 때문에, 배너만 보고 빠져나가면
            // 단언이 아직 안 온 줄을 보고 실패한다 — #115 수정 전에는 서버가 아예 안
            // 떠서 이 경합이 드러나지 않았다.
            if (/Local:\s*http/.test(output)) {
              clearTimeout(timer);
              clearInterval(poll);
              resolvePromise();
            }
          }, 50);
          child.on("error", (err) => {
            clearTimeout(timer);
            clearInterval(poll);
            reject(err);
          });
        });

        expect(output).toMatch(/Local:\s*http/);
      } finally {
        // kill()만 하고 빠져나가면 afterEach의 rmSync가 CLI 프로세스보다 먼저 돈다.
        // 이 CLI는 cwd가 projectDir이고, Windows는 어떤 프로세스의 cwd인 폴더를 지우지
        // 못한다(EPERM) — kill()은 종료를 예약만 할 뿐 기다려주지 않아서 경합이 난다.
        // 실제로 죽는 걸 보고 나가야 정리가 안전하다. (#115 수정 전에는 CLI가 spawn
        // EINVAL로 진작 죽어 있어서 이 경합이 드러나지 않았다.)
        child.kill();
        await new Promise<void>((resolveExit) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolveExit();
            return;
          }
          child.once("exit", () => resolveExit());
        });
      }
    },
    GUI_START_TIMEOUT_MS + 5000,
  );
});
