import { spawn } from "node:child_process";
import { expect, it } from "vitest";
import { waitForViteUrl } from "../scripts/browser/vite-ready.mjs";

function emit(chunks: string[], exitCode = 0) {
  return spawn(process.execPath, ["-e", `
    const chunks = ${JSON.stringify(chunks)};
    function next() {
      if (!chunks.length) { process.exitCode = ${exitCode}; return; }
      process.stdout.write(chunks.shift());
      setTimeout(next, 5);
    }
    next();
  `], { stdio: ["ignore", "pipe", "pipe"] });
}

it.each([
  ["일반 출력", ["Local: http://127.0.0.1:56725/"]],
  ["Windows 색 출력", ["Local: http://127.0.0.1:\u001b[1m56725\u001b[22m/"]],
  ["분할된 URL과 ANSI 코드", ["Local: http://127.", "0.0.1:\u001b[", "1m56725\u001b[22", "m/"]],
])("%s에서 제어문자 없는 Vite URL을 반환한다", async (_name, chunks) => {
  const server = emit(chunks as string[]);
  try {
    expect(await waitForViteUrl(server)).toBe("http://127.0.0.1:56725/");
    expect(server.stdout.listenerCount("data")).toBe(0);
  } finally { server.kill(); }
});

it("준비 전 종료는 출력과 종료 코드를 보존한다", async () => {
  await expect(waitForViteUrl(emit(["configuration failed"], 7)))
    .rejects.toThrow("Vite exited 7: configuration failed");
});

it("URL이 없으면 제한 시간 뒤 실패하고 리스너를 정리한다", async () => {
  const server = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await expect(waitForViteUrl(server, 100)).rejects.toThrow("Vite startup timed out");
    expect(server.stdout.listenerCount("data")).toBe(0);
  } finally { server.kill(); }
});
