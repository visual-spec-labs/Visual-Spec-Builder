// 선택적 공용 실행기: 격리한 작업공간·임의 포트·외부 요청 차단.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { waitForViteUrl } from "./vite-ready.mjs";

export async function startBrowserWorkspace(workspace) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const server = spawn(process.execPath, [fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url)),
    "--host", "127.0.0.1", "--port", "0"], {
    cwd: repo, env: { ...process.env, VISUAL_SPEC_WORKSPACE: workspace }, stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  let closing;
  const onTerminate = () => { void close().finally(() => process.exit(143)); };
  const onInterrupt = () => { void close().finally(() => process.exit(130)); };
  process.once("SIGTERM", onTerminate);
  process.once("SIGINT", onInterrupt);
  function close() {
    closing ??= closeResources();
    return closing;
  }
  async function closeResources() {
    process.off("SIGTERM", onTerminate);
    process.off("SIGINT", onInterrupt);
    try { await browser?.close(); } finally {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = once(server, "exit");
        server.kill();
        const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
        try { await exited; } finally { clearTimeout(timer); }
      }
    }
  }
  try {
    const url = await waitForViteUrl(server);
    // 준비 이후에도 파이프를 비워 Vite의 후속 로그가 서버를 막지 않게 한다.
    server.stdout.resume();
    server.stderr.resume();
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
    // 모든 호출자가 이 팩토리를 사용해 모델 endpoint 등 외부 요청을 차단한다.
    const newContext = async options => {
      const context = await browser.newContext({ ...options, serviceWorkers: "block" });
      await context.route("**/*", route => {
        const request = new URL(route.request().url());
        return request.origin === new URL(url).origin ? route.continue() : route.abort();
      });
      return context;
    };
    return { newContext, url, close };
  } catch (error) {
    await close();
    throw error;
  }
}
