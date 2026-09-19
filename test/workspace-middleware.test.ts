import { createServer, request, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resolveImageSrc } from "@/features/editor/ui/properties/imageSrc";
import { WORKSPACE_MARKER_HEADER, workspaceFileUrl } from "@/features/workspace/protocol";
import {
  createWorkspaceMiddleware,
  ensureWorkspaceDirs,
  resolveWorkspaceRoot,
  WORKSPACE_ENV_VAR,
} from "@/features/workspace/workspaceServer";

/**
 * 작업공간 미들웨어 통합 테스트 (이슈 #133).
 *
 * 가짜 req/res를 만들어 넣는 대신 **진짜 http 서버에 물려 fetch로 두드린다** —
 * 이 미들웨어가 실제로 붙는 자리가 Vite의 connect 스택이라, 스트림·헤더·본문 처리까지
 * 같이 도는 상태로 확인해야 "실제로 동작한다"고 말할 수 있다. Vite 자체를 띄우지
 * 않는 이유는 그러면 확인하는 대상이 이 미들웨어가 아니라 Vite 기동이 되기 때문이다.
 *
 * 그 반대편 — **Vite 스택 안 어느 자리에 등록되는가** — 는 `workspace-vite-stack.test.ts`가
 * 진짜 개발 서버를 띄워 확인한다. 아래 "요청 출처" 절이 여기 있는 이유도 그 짝이다:
 * Vite의 앞단 방어를 **떼어낸 상태**에서 미들웨어 혼자 막는지를 봐야 하기 때문이다.
 */

let server: Server;
let baseUrl: string;
let port: number;
let workspaceRoot: string;

/**
 * 경로를 **가공 없이 그대로** 보낸다.
 *
 * 탈출 시도 케이스에 `fetch`를 쓸 수 없어서 만들었다 — WHATWG URL 파서는 `..`는 물론
 * `%2e%2e`까지 상위 폴더 세그먼트로 보고 **보내기 전에 정규화해 버린다.** 그러면
 * 서버가 받는 건 공격 경로가 아니라 이미 지워진 경로라서, 통과하든 막히든 미들웨어를
 * 검증한 게 아니게 된다. 진짜 공격자는 파서를 거치지 않고 소켓에 그대로 쓴다.
 */
function rawRequest(
  method: string,
  path: string,
  body?: string,
  headers?: Record<string, string>,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (text += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** 매 테스트마다 새 임시 작업공간을 가리키도록 미들웨어를 갈아끼운다. */
let handler: ReturnType<typeof createWorkspaceMiddleware>;

beforeAll(async () => {
  server = createServer((req, res) => {
    handler(req, res, () => {
      // 작업공간 라우트가 아니면 Vite가 받는다 — 여기서는 그 자리를 표시만 한다.
      res.statusCode = 418;
      res.end("next()");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "visual-spec-ws-"));
  ensureWorkspaceDirs(workspaceRoot);
  handler = createWorkspaceMiddleware(workspaceRoot);
});

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe("resolveWorkspaceRoot — 워크스페이스 루트 전달", () => {
  it("환경 변수가 있으면 그걸 쓴다 — npx visual-spec 이 사용자 cwd 기준으로 실어 보낸다", () => {
    const root = resolveWorkspaceRoot("/package/root", {
      [WORKSPACE_ENV_VAR]: join(tmpdir(), "user-project", ".visual-spec"),
    });

    expect(root).toBe(join(tmpdir(), "user-project", ".visual-spec"));
  });

  it("없으면 vite root 아래로 폴백한다 — 저장소를 클론해 pnpm dev 로 띄운 개발자", () => {
    const root = resolveWorkspaceRoot(join(tmpdir(), "repo"), {});

    expect(root).toBe(join(tmpdir(), "repo", ".visual-spec"));
  });

  it("빈 문자열은 없는 것으로 본다", () => {
    const root = resolveWorkspaceRoot(join(tmpdir(), "repo"), { [WORKSPACE_ENV_VAR]: "  " });

    expect(root).toBe(join(tmpdir(), "repo", ".visual-spec"));
  });
});

describe("ensureWorkspaceDirs", () => {
  it("화이트리스트 세 폴더를 만든다 — init 없이 GUI만 띄워도 Save가 되어야 한다", () => {
    for (const dir of ["specs", "assets", "generated"]) {
      expect(existsSync(join(workspaceRoot, dir))).toBe(true);
    }
  });
});

describe("GET /__vs/status", () => {
  it("작업공간 루트와 열린 폴더를 알려준다", async () => {
    const response = await fetch(`${baseUrl}/__vs/status`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, dirs: ["specs", "assets", "generated"] });
  });

  it("우리 응답임을 표시하는 헤더가 붙는다 — 정적 서버의 SPA 폴백과 구분한다", async () => {
    const response = await fetch(`${baseUrl}/__vs/status`);

    expect(response.headers.get(WORKSPACE_MARKER_HEADER)).toBe("1");
  });
});

describe("작업공간 라우트가 아닌 요청", () => {
  it("__vs 밖은 다음 미들웨어(Vite)로 넘긴다", async () => {
    const response = await fetch(`${baseUrl}/src/main.tsx`);

    expect(response.status).toBe(418);
  });

  it("__vs 아래지만 모르는 라우트는 넘기지 않고 404로 끝낸다 — SPA 폴백에 먹히면 안 된다", async () => {
    const response = await fetch(`${baseUrl}/__vs/nope`);

    expect(response.status).toBe(404);
    expect(response.headers.get(WORKSPACE_MARKER_HEADER)).toBe("1");
  });
});

describe("PUT·GET /__vs/file — 실제로 읽고 쓴다", () => {
  it("PUT 한 스펙이 .visual-spec/specs/ 에 파일로 남는다", async () => {
    const response = await fetch(`${baseUrl}/__vs/file/specs/home.json`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: '{"version":"0.2"}',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, path: "specs/home.json" });
    expect(readFileSync(join(workspaceRoot, "specs", "home.json"), "utf8")).toBe(
      '{"version":"0.2"}',
    );
  });

  it("쓴 것을 그대로 다시 읽는다 — Save → Open 왕복", async () => {
    await fetch(`${baseUrl}/__vs/file/specs/round-trip.json`, {
      method: "PUT",
      body: '{"name":"왕복"}',
    });
    const response = await fetch(`${baseUrl}/__vs/file/specs/round-trip.json`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.text()).toBe('{"name":"왕복"}');
  });

  it("이미지를 바이너리 그대로 주고받는다", async () => {
    // PNG 시그니처 — 텍스트로 변환되면 깨지는 바이트열이다.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
    await fetch(`${baseUrl}/__vs/file/assets/hero.png`, { method: "PUT", body: png });

    const response = await fetch(`${baseUrl}/__vs/file/assets/hero.png`);
    const received = new Uint8Array(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Array.from(received)).toEqual(Array.from(png));
  });

  it("generated 아래 하위 폴더까지 만들면서 쓴다 — 코드 생성이 쓸 경로를 열어둔다", async () => {
    const response = await fetch(`${baseUrl}/__vs/file/generated/pages/Home.tsx`, {
      method: "PUT",
      body: "export const Home = () => null;\n",
    });

    expect(response.status).toBe(200);
    expect(readFileSync(join(workspaceRoot, "generated", "pages", "Home.tsx"), "utf8")).toContain(
      "export const Home",
    );
  });

  it("없는 파일은 404다", async () => {
    const response = await fetch(`${baseUrl}/__vs/file/specs/없는파일.json`);

    expect(response.status).toBe(404);
  });

  it("GET·PUT 이 아닌 메서드는 405다", async () => {
    const response = await fetch(`${baseUrl}/__vs/file/specs/home.json`, { method: "DELETE" });

    expect(response.status).toBe(405);
  });
});

describe("GET /__vs/list", () => {
  it("폴더 안 파일을 이름순으로 준다 — Open 목록이 이걸 쓴다", async () => {
    writeFileSync(join(workspaceRoot, "specs", "b.json"), "{}");
    writeFileSync(join(workspaceRoot, "specs", "a.json"), "{}");

    const response = await fetch(`${baseUrl}/__vs/list/specs`);

    expect(await response.json()).toEqual({ ok: true, dir: "specs", files: ["a.json", "b.json"] });
  });

  it("허용 확장자가 아닌 파일과 하위 폴더는 목록에서 뺀다", async () => {
    writeFileSync(join(workspaceRoot, "specs", "keep.json"), "{}");
    writeFileSync(join(workspaceRoot, "specs", "notes.txt"), "x");
    mkdirSync(join(workspaceRoot, "specs", "sub"));

    const response = await fetch(`${baseUrl}/__vs/list/specs`);

    expect(await response.json()).toMatchObject({ files: ["keep.json"] });
  });

  it("화이트리스트 밖 폴더는 목록도 거부한다", async () => {
    const response = await fetch(`${baseUrl}/__vs/list/runtime`);

    expect(response.status).toBe(403);
  });
});

/**
 * Import 저장 → 캔버스 렌더까지 **같은 URL 규칙**으로 오가는지 본다
 * (PR #145 리뷰, wook3964).
 *
 * 저장은 `workspaceFileUrl`(클라이언트), 렌더는 `resolveImageSrc`(캔버스·홈 미리보기)가
 * URL을 만든다. 렌더 쪽만 상대 경로를 그대로 이어 붙이던 동안 `hero#1.png`는 `#`부터가
 * 조각이라 서버에 `hero`까지만 닿았고(확장자가 없어 403), `%`가 든 이름은 디코딩
 * 오류로 거부됐다 — **Import는 성공했는데 그 이미지만 화면에서 사라졌다.**
 * 그래서 이 테스트는 문자열 비교가 아니라 진짜 서버에 두 URL을 차례로 물린다.
 */
describe("특수문자가 든 이미지 이름 — Import 저장부터 렌더까지", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

  // `?`·`:`·`*` 같은 글자는 인코딩과 별개로 미들웨어가 정책으로 거부한다
  // (`workspacePath.ts`의 FORBIDDEN_IN_SEGMENT — Windows가 싫어하는 이름들이다).
  // Import도 그 글자들은 `-`로 바꿔 저장하므로(`assetName.ts`) 여기 목록에 없다.
  for (const name of ["hero#1.png", "100%.png", "hero (1).png", "표지 사진.png", "a+b.png"]) {
    it(`${name}`, async () => {
      const relativePath = `assets/${name}`;

      // (1) Import가 보내는 저장 요청.
      const saved = await fetch(`${baseUrl}${workspaceFileUrl(relativePath)}`, {
        method: "PUT",
        body: png,
      });

      expect(saved.status).toBe(200);
      expect(existsSync(join(workspaceRoot, "assets", name))).toBe(true);

      // (2) 캔버스가 스펙의 src로 거는 요청. 저장된 그 파일이 와야 한다.
      const rendered = await fetch(`${baseUrl}${resolveImageSrc(relativePath)}`);

      expect(rendered.status).toBe(200);
      expect(rendered.headers.get("content-type")).toBe("image/png");
      expect(Array.from(new Uint8Array(await rendered.arrayBuffer()))).toEqual(Array.from(png));
    });
  }

  it("목록에도 그 이름 그대로 올라온다 — Open·중복 이름 판정이 이걸 쓴다", async () => {
    await fetch(`${baseUrl}${workspaceFileUrl("assets/hero#1.png")}`, {
      method: "PUT",
      body: png,
    });

    const response = await fetch(`${baseUrl}/__vs/list/assets`);

    expect(await response.json()).toMatchObject({ files: ["hero#1.png"] });
  });
});

describe("화이트리스트 밖 경로는 거부한다 — 읽기도 쓰기도", () => {
  const forbidden: Array<[string, string, number]> = [
    ["상위 폴더로 나가기", "/__vs/file/specs/../../escaped.json", 400],
    ["인코딩된 ..", "/__vs/file/%2e%2e/%2e%2e/escaped.json", 400],
    ["인코딩된 구분자로 숨긴 ..", "/__vs/file/specs/..%2f..%2fescaped.json", 400],
    ["역슬래시(Windows 구분자)", "/__vs/file/specs/..%5c..%5cescaped.json", 400],
    ["절대 경로", "/__vs/file//etc/passwd.json", 403],
    ["Windows 드라이브 문자", "/__vs/file/C:/Windows/win.ini", 400],
    ["NUL 바이트", "/__vs/file/specs/home.json%00.png", 400],
    ["화이트리스트 밖 폴더", "/__vs/file/runtime/state.json", 403],
    ["specs 에 .json 아닌 확장자", "/__vs/file/specs/shell.js", 403],
    ["assets 에 이미지 아닌 확장자", "/__vs/file/assets/evil.html", 403],
  ];

  for (const [label, path, status] of forbidden) {
    it(`GET ${label}`, async () => {
      expect((await rawRequest("GET", path)).status).toBe(status);
    });

    it(`PUT ${label}`, async () => {
      expect((await rawRequest("PUT", path, "{}")).status).toBe(status);
      // 거부된 요청이 작업공간 밖에 파일을 남기지 않았는지 함께 본다.
      expect(existsSync(join(workspaceRoot, "..", "escaped.json"))).toBe(false);
    });
  }
});

describe("요청 출처를 미들웨어가 스스로 본다 — Vite 앞단에 기대지 않는다", () => {
  /**
   * 이 미들웨어는 Vite의 `cors`·`hostValidation` **뒤**에 등록된다. 그 두 겹이 실제로
   * 앞에서 막아 주는 것은 `workspace-vite-stack.test.ts`가 확인한다. 여기서는 그 두 겹을
   * **떼어낸 상태**(맨 http 서버)에서 미들웨어 혼자 같은 요청을 막는지를 본다 —
   * 등록 위치가 바뀌거나 `server.https`·`allowedHosts: true`로 Vite의 검사가 꺼져도
   * 방어가 남아 있어야 한다는 뜻이다.
   */

  it("위조 Host로 온 PUT은 파일을 쓰지 못한다 — DNS rebinding 차단", async () => {
    const response = await rawRequest("PUT", "/__vs/file/specs/forged.json", "{}", {
      host: "evil.example",
    });

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "specs", "forged.json"))).toBe(false);
  });

  it("위조 Host로 온 GET은 작업공간 내용을 내보내지 않는다", async () => {
    writeFileSync(join(workspaceRoot, "specs", "secret.json"), '{"secret":1}');

    const response = await rawRequest("GET", "/__vs/file/specs/secret.json", undefined, {
      host: "evil.example",
    });

    expect(response.status).toBe(403);
    expect(response.text).not.toContain("secret");
  });

  it("LAN 주소로 온 요청도 거부한다 — 작업공간 API는 루프백 전용이다", async () => {
    const response = await rawRequest("GET", "/__vs/status", undefined, {
      host: "192.168.0.7:5173",
    });

    expect(response.status).toBe(403);
  });

  it("*.localhost 도 거부한다 — Vite보다 엄격하게 본다", async () => {
    const response = await rawRequest("GET", "/__vs/status", undefined, {
      host: `evil.localhost:${port}`,
    });

    expect(response.status).toBe(403);
  });

  it("루프백 이름과 주소는 받는다", async () => {
    for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]) {
      const response = await rawRequest("GET", "/__vs/status", undefined, { host });

      expect(response.status, host).toBe(200);
    }
  });

  it("교차 출처 PUT은 브라우저가 아니라 서버가 막는다 — 실제로 파일이 남지 않는다", async () => {
    const response = await rawRequest("PUT", "/__vs/file/specs/csrf.json", '{"evil":1}', {
      host: `localhost:${port}`,
      origin: "http://evil.example",
    });

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "specs", "csrf.json"))).toBe(false);
  });

  it("교차 출처 GET도 막는다 — 읽기 역시 작업공간 내용을 내보낸다", async () => {
    writeFileSync(join(workspaceRoot, "specs", "leak.json"), '{"secret":1}');

    const response = await rawRequest("GET", "/__vs/file/specs/leak.json", undefined, {
      host: `localhost:${port}`,
      origin: "http://evil.example",
    });

    expect(response.status).toBe(403);
    expect(response.text).not.toContain("secret");
  });

  it("같은 출처에서 온 Origin은 통과한다 — GUI의 Save가 이 모양이다", async () => {
    const response = await rawRequest("PUT", "/__vs/file/specs/same-origin.json", "{}", {
      host: `localhost:${port}`,
      origin: `http://localhost:${port}`,
    });

    expect(response.status).toBe(200);
    expect(existsSync(join(workspaceRoot, "specs", "same-origin.json"))).toBe(true);
  });

  it("포트만 다른 출처는 다른 출처다 — 같은 컴퓨터의 다른 개발 서버", async () => {
    const response = await rawRequest("PUT", "/__vs/file/specs/other-port.json", "{}", {
      host: `localhost:${port}`,
      origin: "http://localhost:3000",
    });

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "specs", "other-port.json"))).toBe(false);
  });

  it("Origin: null(샌드박스 iframe·file://)은 거부한다", async () => {
    const response = await rawRequest("PUT", "/__vs/file/specs/sandboxed.json", "{}", {
      host: `localhost:${port}`,
      origin: "null",
    });

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "specs", "sandboxed.json"))).toBe(false);
  });

  it("Origin이 없으면 통과시킨다 — 같은 출처 GET과 브라우저 아닌 클라이언트가 여기 해당한다", async () => {
    const response = await rawRequest("GET", "/__vs/status", undefined, {
      host: `localhost:${port}`,
    });

    expect(response.status).toBe(200);
  });

  it("Host 헤더가 깨져 있으면 400이다", async () => {
    const response = await rawRequest("GET", "/__vs/status", undefined, { host: "localhost:not-a-port" });

    expect(response.status).toBe(400);
  });

  it("작업공간 라우트가 아니면 출처를 보지 않고 그대로 넘긴다 — Vite 몫이다", async () => {
    const response = await rawRequest("GET", "/src/main.tsx", undefined, { host: "evil.example" });

    expect(response.status).toBe(418);
  });
});

describe("심볼릭 링크로 나가는 경로도 막는다", () => {
  it("specs 안의 링크가 밖을 가리켜도 그 너머로는 못 쓴다", async (context) => {
    const outside = mkdtempSync(join(tmpdir(), "visual-spec-outside-"));
    try {
      // Windows에서 심볼릭 링크 생성은 권한이 필요하다 — 폴더는 junction 으로 되지만
      // 그것도 막히면 이 케이스는 건너뛴다(플랫폼 제약이지 코드의 실패가 아니다).
      symlinkSync(outside, join(workspaceRoot, "specs", "link"), "junction");
    } catch {
      rmSync(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    const response = await rawRequest("PUT", "/__vs/file/specs/link/escaped.json", "{}");

    expect(response.status).toBe(403);
    expect(existsSync(join(outside, "escaped.json"))).toBe(false);
    rmSync(join(workspaceRoot, "specs", "link"), { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  /**
   * 목록 라우트에도 같은 검사가 있어야 한다 (PR #145 리뷰, wook3964).
   *
   * 파일 GET/PUT만 `realPathStaysInside`를 거치고 목록은 안 거치던 때, `specs` 폴더
   * 자체를 바깥 폴더 링크로 바꾸면 `GET /__vs/list/specs`가 작업공간 밖 `*.json`
   * **파일 이름을 그대로 돌려줬다.** 내용이 안 나갔으니 괜찮은 게 아니다 — 파일
   * 이름만으로도 사용자가 뭘 갖고 있는지가 새 나간다.
   */
  it("specs 자체가 밖을 가리키는 링크면 목록을 내보내지 않는다", async (context) => {
    const outside = mkdtempSync(join(tmpdir(), "visual-spec-outside-"));
    writeFileSync(join(outside, "salary-2026.json"), "{}");
    rmSync(join(workspaceRoot, "specs"), { recursive: true, force: true });
    try {
      symlinkSync(outside, join(workspaceRoot, "specs"), "junction");
    } catch {
      rmSync(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    const response = await fetch(`${baseUrl}/__vs/list/specs`);
    const text = await response.text();

    expect(response.status).toBe(403);
    expect(text).not.toContain("salary-2026");
    rmSync(join(workspaceRoot, "specs"), { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("폴더 안의 링크가 밖을 가리켜도 그 너머 파일은 목록에 못 담는다", async (context) => {
    // 위 케이스가 폴더 자체를 바꾼 것이라면, 이쪽은 `assets`는 그대로 두고 그 안에
    // 링크를 둔 모양이다. 링크는 파일이 아니라 목록에서 이미 빠지지만, 그렇다고
    // `assets` 자신에 대한 containment 검사를 건너뛰어도 되는 것은 아니다.
    const outside = mkdtempSync(join(tmpdir(), "visual-spec-outside-"));
    writeFileSync(join(outside, "private.png"), "x");
    try {
      symlinkSync(outside, join(workspaceRoot, "assets", "link"), "junction");
    } catch {
      rmSync(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    const response = await fetch(`${baseUrl}/__vs/list/assets`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ files: [] });
    rmSync(join(workspaceRoot, "assets", "link"), { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
});
