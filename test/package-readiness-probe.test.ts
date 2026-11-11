import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { probeSmokeStatus, smokeFailure } from "./helpers/smokeDiagnostics";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function serve(handler: (response: ServerResponse, attempt: number) => void) {
  let attempts = 0;
  const server = createServer((_request, response) => handler(response, ++attempts));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing test address");
  return { url: `http://127.0.0.1:${address.port}/__vs/status`, attempts: () => attempts };
}

describe("real HTTP readiness body failures", () => {
  it("retains partial non-OK evidence and permits the next readiness attempt", async () => {
    const server = await serve((res, attempt) => {
      if (attempt > 1) { res.end('{"ok":true}'); return; }
      res.writeHead(503, { "content-type": "text/plain" }); res.write("booting-prefix");
      setTimeout(() => res.destroy(), 20);
    });
    const failed = await probeSmokeStatus(server.url, 5000);
    expect(failed.ready).toBe(false);
    expect(failed.diagnostic).toContain("HTTP 503");
    expect(failed.diagnostic).toContain("text/plain");
    expect(failed.diagnostic).toContain("booting-prefix");
    expect(failed.diagnostic).toContain("body read failed");
    expect(smokeFailure(failed.diagnostic, "child evidence", "versions").message).toContain("booting-prefix");
    const next = await probeSmokeStatus(server.url, 5000);
    expect(next.ready && JSON.parse(next.body).ok).toBe(true);
    expect(server.attempts()).toBe(2);
  });
  it("bounds a stalled non-OK body by the remaining readiness deadline", async () => {
    const server = await serve(res => { res.writeHead(503); res.write("still booting"); });
    const start = performance.now();
    const result = await probeSmokeStatus(server.url, 100, 5000);
    expect(result.ready).toBe(false);
    expect(result.diagnostic).toContain("still booting");
    expect(result.diagnostic).toContain("body read failed");
    expect(performance.now() - start).toBeLessThan(2000);
  });
  it("stops oversized non-OK streams and marks truncation without waiting for EOF", async () => {
    const server = await serve(res => { res.writeHead(503); res.write("x".repeat(10000)); });
    const result = await probeSmokeStatus(server.url, 5000);
    expect(result.ready).toBe(false);
    expect(result.diagnostic).toContain("body truncated at 8192 bytes");
    expect(result.diagnostic).toContain("x".repeat(8192));
    expect(result.diagnostic).not.toContain("x".repeat(8193));
  });
  it.each(["truncated", "stalled"])("fails after OK headers with a %s body instead of retrying", async mode => {
    const server = await serve(res => {
      res.writeHead(200); res.write('{"ok":');
      if (mode === "truncated") setTimeout(() => res.destroy(), 20);
    });
    await expect(probeSmokeStatus(server.url, 5000, 150)).rejects.toThrow(/HTTP 200[\s\S]*body read failed/);
    expect(server.attempts()).toBe(1);
  });
  it("preserves successful invalid JSON for fatal caller validation", async () => {
    const server = await serve(res => res.end("invalid-json"));
    const result = await probeSmokeStatus(server.url, 5000);
    expect(result.ready).toBe(true);
    if (result.ready) expect(() => JSON.parse(result.body)).toThrow();
    expect(server.attempts()).toBe(1);
  });
  it("bounds unavailable headers and reports the probe timeout as retryable", async () => {
    const server = await serve(() => {});
    const result = await probeSmokeStatus(server.url, 100);
    expect(result.ready).toBe(false);
    expect(result.diagnostic).toContain("status probe timed out");
  });
});
