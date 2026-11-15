import { describe, expect, it } from "vitest";
import { readSmokeResponse, smokeFailure } from "./helpers/smokeDiagnostics";

describe("fresh-consumer smoke failure evidence", () => {
  it("reports failed HTTP status/body together with child output and actual dependency versions", async () => {
    const response = new Response("Vite failed to transform source", { status: 500, statusText: "Internal Server Error", headers: { "content-type": "text/plain" } });
    let failure: unknown;
    try { await readSmokeResponse(response, "http://127.0.0.1:1234/"); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    const error = smokeFailure(failure, "child: missing import", '{"vite":{"version":"8.2.1"}}');
    expect(error.message).toContain("HTTP 500 Internal Server Error: http://127.0.0.1:1234/");
    expect(error.message).toContain("Vite failed to transform source");
    expect(error.message).toContain("child: missing import");
    expect(error.message).toContain('"version":"8.2.1"');
    expect(error.cause).toBe(failure);
  });
  it("preserves successful bodies for the existing content assertions", async () => {
    expect(await readSmokeResponse(new Response("createRoot"), "http://localhost/src/main.tsx")).toBe("createRoot");
  });
  it("bounds large diagnostics while retaining the latest child output", async () => {
    await expect(readSmokeResponse(new Response("x".repeat(9000), { status: 503 }), "http://localhost/")).rejects.toThrow("body truncated at 8192 characters");
    const error = smokeFailure("failure", "old-prefix" + "x".repeat(32768) + "latest", "versions");
    expect(error.message).not.toContain("old-prefix");
    expect(error.message).toContain("latest");
  });
});
