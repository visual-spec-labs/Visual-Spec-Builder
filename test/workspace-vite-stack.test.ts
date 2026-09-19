import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

import { WORKSPACE_MARKER_HEADER } from "@/features/workspace/protocol";
import { WORKSPACE_ENV_VAR } from "@/features/workspace/workspaceServer";
import { workspaceFilesPlugin } from "../vite.config";

/**
 * **진짜 Vite 개발 서버 위에서** 작업공간 미들웨어의 등록 위치를 못박는 테스트 (이슈 #133).
 *
 * `workspace-middleware.test.ts`는 미들웨어만 맨 http 서버에 물려 본다 — 확인 대상이
 * 미들웨어 자신이기 때문이다. 여기서 확인하는 것은 그 반대다: **Vite 스택 안 어느 자리에
 * 들어가는가**. 그 자리가 보안 성질을 바꾸므로(아래 두 방향) 실물로 고정해 둔다.
 *
 * - **너무 뒤면** SPA 폴백이 먼저 걸려 `/__vs/...`가 `index.html` 200으로 덮인다
 *   (기능이 조용히 죽는다)
 * - **너무 앞이면** Vite의 `cors`·`hostValidation`(CVE-2025-24010 대응)을 건너뛴다
 *
 * Vite 8의 `_createServer` 등록 순서는
 * `rejectInvalidRequest → cors → hostValidation → [configureServer 훅] → transform → … → SPA 폴백`
 * 이라 우리는 두 조건을 모두 만족하는 자리에 들어간다. 다만 그 사실에 **기대지는**
 * 않는다 — 미들웨어가 스스로도 Host·Origin을 보고, 그쪽은 위 파일이 확인한다.
 */

let server: ViteDevServer;
let port: number;
let viteRoot: string;
let workspaceRoot: string;
let previousEnv: string | undefined;

function raw(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; text: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (text += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, text, headers: res.headers }),
      );
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

beforeAll(async () => {
  viteRoot = mkdtempSync(join(tmpdir(), "visual-spec-vite-"));
  workspaceRoot = mkdtempSync(join(tmpdir(), "visual-spec-vite-ws-"));
  writeFileSync(join(viteRoot, "index.html"), "<!doctype html><title>stack</title>\n");

  // 저장소의 `.visual-spec/`을 건드리지 않도록 임시 폴더를 가리키게 한다.
  previousEnv = process.env[WORKSPACE_ENV_VAR];
  process.env[WORKSPACE_ENV_VAR] = workspaceRoot;

  server = await createServer({
    configFile: false,
    root: viteRoot,
    logLevel: "silent",
    // 플러그인은 vite.config.ts에서 그대로 가져온다 — 등록 위치를 바꾸면 여기가 깨져야 한다.
    plugins: [workspaceFilesPlugin()],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  port = (server.httpServer?.address() as AddressInfo).port;
}, 60_000);

afterAll(async () => {
  await server?.close();
  if (previousEnv === undefined) delete process.env[WORKSPACE_ENV_VAR];
  else process.env[WORKSPACE_ENV_VAR] = previousEnv;
  rmSync(viteRoot, { recursive: true, force: true });
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe("Vite 스택 안에서의 등록 위치", () => {
  it("/__vs/status 가 SPA 폴백이 아니라 우리 응답으로 온다 — 충분히 앞이다", async () => {
    const response = await raw("GET", "/__vs/status", { host: `localhost:${port}` });

    expect(response.status).toBe(200);
    expect(response.headers[WORKSPACE_MARKER_HEADER]).toBe("1");
  });

  it("__vs 아래 모르는 라우트도 index.html로 덮이지 않는다", async () => {
    const response = await raw("GET", "/__vs/nope", { host: `localhost:${port}` });

    expect(response.status).toBe(404);
    expect(response.headers[WORKSPACE_MARKER_HEADER]).toBe("1");
  });

  it("__vs 밖은 그대로 Vite가 받는다 — 우리가 가로채지 않는다", async () => {
    const response = await raw("GET", "/", { host: `localhost:${port}` });

    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>stack</title>");
    expect(response.headers[WORKSPACE_MARKER_HEADER]).toBeUndefined();
  });

  it("위조 Host는 실제 스택에서 막히고 파일도 남지 않는다", async () => {
    const response = await raw(
      "PUT",
      "/__vs/file/specs/forged.json",
      { host: "evil.example", "content-type": "application/json" },
      "{}",
    );

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "specs", "forged.json"))).toBe(false);
  });

  it("교차 출처 PUT은 실제 스택에서도 파일을 쓰지 못한다", async () => {
    const response = await raw(
      "PUT",
      "/__vs/file/specs/csrf.json",
      {
        host: `localhost:${port}`,
        origin: "http://evil.example",
        "content-type": "application/json",
      },
      '{"evil":1}',
    );

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "specs", "csrf.json"))).toBe(false);
  });

  it("preflight 응답에 교차 출처용 Access-Control-Allow-Origin이 붙지 않는다", async () => {
    // Vite의 기본 CORS(루프백 출처만 허용)를 못박는다. `server.cors: true` 같은 설정이
    // 들어오면 여기가 깨진다 — 그때는 브라우저가 교차 출처 PUT을 보내게 된다.
    const response = await raw("OPTIONS", "/__vs/file/specs/x.json", {
      host: `localhost:${port}`,
      origin: "http://evil.example",
      "access-control-request-method": "PUT",
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("같은 출처에서 온 Save는 그대로 동작한다 — 방어가 GUI를 막지 않는다", async () => {
    const response = await raw(
      "PUT",
      "/__vs/file/specs/home.json",
      {
        host: `localhost:${port}`,
        origin: `http://localhost:${port}`,
        "content-type": "application/json",
      },
      '{"version":"0.2"}',
    );

    expect(response.status).toBe(200);
    expect(existsSync(join(workspaceRoot, "specs", "home.json"))).toBe(true);
  });
});
