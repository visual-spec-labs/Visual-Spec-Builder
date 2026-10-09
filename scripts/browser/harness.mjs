// Shared optional runner: isolated workspace, ephemeral port, no external traffic.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

export async function startBrowserWorkspace(workspace) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const server = spawn(process.execPath, [fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url)),
    "--host", "127.0.0.1", "--port", "0"], {
    cwd: repo, env: { ...process.env, VISUAL_SPEC_WORKSPACE: workspace }, stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  async function close() {
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
    const url = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error(`Vite startup timed out: ${output}`)), 30000);
      server.once("error", error => { clearTimeout(timer); reject(error); });
      server.once("exit", code => { clearTimeout(timer); reject(new Error(`Vite exited ${code}: ${output}`)); });
      server.stderr.on("data", chunk => { output += chunk; });
      server.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
    // All callers use this factory so fixture runs cannot reach model endpoints.
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
