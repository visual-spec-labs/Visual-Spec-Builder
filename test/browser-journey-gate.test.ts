import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// Linux 전용 GNU timeout 게이트의 실패/정리 계약. 브라우저 단언을 대체하지 않는다.
it.skipIf(process.platform !== "linux").each([
  ["실패 exit code", "process.exit(37)", 37],
  ["멈춘 실행", "setInterval(() => {}, 1000)", 124],
] as const)("%s는 다음 여정을 실행하지 않고 임시 파일을 정리한다", (_name, code, status) => {
  const directory = mkdtempSync(join(tmpdir(), "vsb-gate-test-"));
  try {
    const bin = join(directory, "bin"), scratch = join(directory, "scratch");
    mkdirSync(bin); mkdirSync(scratch);
    const fakeNode = join(bin, "node");
    writeFileSync(fakeNode, `#!${process.execPath}\nrequire("node:fs").writeFileSync(require("node:path").join(process.env.TMPDIR, "fixture.txt"), "fixture");\n${code}\n`);
    chmodSync(fakeNode, 0o755);
    let failure: { status?: number; stdout?: string } | undefined;
    try {
      execFileSync("bash", [fileURLToPath(new URL("../scripts/browser/run-journeys.sh", import.meta.url))], {
        env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`,
          TMPDIR: scratch, VSB_JOURNEY_TIMEOUT_SECONDS: "1" },
        encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000,
      });
    } catch (error) { failure = error as typeof failure; }
    expect(failure?.status).toBe(status);
    expect(failure?.stdout).toContain("RUN export-journey");
    expect(failure?.stdout).not.toContain("RUN project-dialogs");
    expect(failure?.stdout).not.toContain("PASS all");
    expect(readdirSync(scratch)).toEqual([]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
