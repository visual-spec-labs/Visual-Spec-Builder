import * as fs from "node:fs";
import { createServer, request, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blankSpec } from "@/features/editor/store/blankSpec";
import { migrateV01 } from "@/features/editor/schema";
import { resolveImageSrc } from "@/features/editor/ui/properties/imageSrc";
import { WORKSPACE_MARKER_HEADER, workspaceFileUrl } from "@/features/workspace/protocol";
import {
  createWorkspaceMiddleware,
  ensureWorkspaceDirs,
  resolveWorkspaceRoot,
  WORKSPACE_ENV_VAR,
} from "@/features/workspace/workspaceServer";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, lstatSync: vi.fn(actual.lstatSync), openSync: vi.fn(actual.openSync), writeFileSync: vi.fn(actual.writeFileSync), unlinkSync: vi.fn(actual.unlinkSync) };
});

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
    const req = request({ host: "127.0.0.1", port, method, path, headers: { "x-visual-spec-expected-revision": "missing", ...headers } }, (res) => {
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
  it("화이트리스트 네 폴더를 만든다 — init 없이 GUI만 띄워도 Save가 되어야 한다", () => {
    for (const dir of ["specs", "assets", "generated", "runtime"]) {
      expect(existsSync(join(workspaceRoot, dir))).toBe(true);
    }
  });

  it("preview 는 열지 않으므로 만들지도 않는다", () => {
    expect(existsSync(join(workspaceRoot, "preview"))).toBe(false);
  });
});

describe("GET /__vs/status", () => {
  it("작업공간 루트와 열린 폴더를 알려준다", async () => {
    const response = await fetch(`${baseUrl}/__vs/status`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      dirs: ["specs", "assets", "generated", "runtime"],
    });
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
      headers: { "content-type": "application/json", "x-visual-spec-expected-revision": "missing" },
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
      headers: { "x-visual-spec-expected-revision": "missing" },
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
    await fetch(`${baseUrl}/__vs/file/assets/hero.png`, { method: "PUT", headers: { "x-visual-spec-expected-revision": "missing" }, body: png });

    const response = await fetch(`${baseUrl}/__vs/file/assets/hero.png`);
    const received = new Uint8Array(await response.arrayBuffer());

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Array.from(received)).toEqual(Array.from(png));
  });

  it("generated 아래 하위 폴더까지 만들면서 쓴다 — 코드 생성이 쓸 경로를 열어둔다", async () => {
    const response = await fetch(`${baseUrl}/__vs/file/generated/pages/Home.tsx`, {
      method: "PUT",
      headers: { "x-visual-spec-expected-revision": "missing" },
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
    const response = await fetch(`${baseUrl}/__vs/list/preview`);

    expect(response.status).toBe(403);
  });
});

/**
 * `?recursive=1` — `generated/`를 위해 열었다 (이슈 #157).
 *
 * 코드 생성 스킬은 `generated/pages/`·`generated/components/`에 쓴다. 한 단계
 * 목록으로는 **항상 빈 배열**이라 Export가 내보낼 것을 찾지 못한다. 기본값은
 * 그대로 한 단계다 — Open 목록(`specs/`)이 갑자기 하위 경로를 받기 시작하면
 * 그 값을 파일명으로 쓰는 쪽이 조용히 어긋난다.
 */
describe("GET /__vs/list?recursive=1", () => {
  it("하위 폴더의 파일을 폴더 기준 상대 경로로 준다", async () => {
    mkdirSync(join(workspaceRoot, "generated", "pages"), { recursive: true });
    mkdirSync(join(workspaceRoot, "generated", "components"), { recursive: true });
    writeFileSync(join(workspaceRoot, "generated", "pages", "Home.tsx"), "x");
    writeFileSync(join(workspaceRoot, "generated", "components", "Card.tsx"), "x");
    writeFileSync(join(workspaceRoot, "generated", "README.md"), "x");

    const response = await fetch(`${baseUrl}/__vs/list/generated?recursive=1`);

    expect(await response.json()).toEqual({
      ok: true,
      dir: "generated",
      // localeCompare는 대소문자를 가리지 않는다 — components < pages < README 순이다.
      files: ["components/Card.tsx", "pages/Home.tsx", "README.md"],
    });
  });

  it("recursive 없이는 지금까지와 같이 한 단계만 본다", async () => {
    mkdirSync(join(workspaceRoot, "generated", "pages"), { recursive: true });
    writeFileSync(join(workspaceRoot, "generated", "pages", "Home.tsx"), "x");

    const response = await fetch(`${baseUrl}/__vs/list/generated`);

    expect(await response.json()).toMatchObject({ files: [] });
  });

  it("재귀 목록에서도 허용 확장자만 나간다", async () => {
    mkdirSync(join(workspaceRoot, "generated", "pages"), { recursive: true });
    writeFileSync(join(workspaceRoot, "generated", "pages", "Home.tsx"), "x");
    writeFileSync(join(workspaceRoot, "generated", "pages", "notes.txt"), "x");

    const response = await fetch(`${baseUrl}/__vs/list/generated?recursive=1`);

    expect(await response.json()).toMatchObject({ files: ["pages/Home.tsx"] });
  });

  it("폴더가 아예 없으면 빈 목록이다 — 아직 아무것도 생성하지 않은 정상 상태다", async () => {
    rmSync(join(workspaceRoot, "generated"), { recursive: true, force: true });

    const response = await fetch(`${baseUrl}/__vs/list/generated?recursive=1`);

    expect(await response.json()).toEqual({ ok: true, dir: "generated", files: [] });
  });

  /**
   * 목록 라우트가 symlink 경계를 안 보던 것은 PR #145 리뷰에서 잡힌 **실제
   * 취약점**이다. 재귀는 하위 폴더마다 같은 물음이 다시 생기므로 여기서 못박는다 —
   * 작업공간 밖을 가리키는 하위 폴더 링크는 따라가지 않는다(이름조차 나가지 않는다).
   */
  it("작업공간 밖을 가리키는 하위 폴더 링크는 따라가지 않는다", async () => {
    const outside = mkdtempSync(join(tmpdir(), "vs-outside-"));
    writeFileSync(join(outside, "secret.tsx"), "x");

    mkdirSync(join(workspaceRoot, "generated"), { recursive: true });
    try {
      symlinkSync(outside, join(workspaceRoot, "generated", "linked"), "dir");
    } catch {
      return; // Windows에서 권한이 없으면 링크를 못 만든다 — 그땐 확인할 것도 없다
    }

    const response = await fetch(`${baseUrl}/__vs/list/generated?recursive=1`);

    expect(await response.json()).toMatchObject({ files: [] });
    rmSync(outside, { recursive: true, force: true });
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
      headers: { "x-visual-spec-expected-revision": "missing" },
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
    ["화이트리스트 밖 폴더", "/__vs/file/preview/state.json", 403],
    ["specs 에 .json 아닌 확장자", "/__vs/file/specs/shell.js", 403],
    ["assets 에 이미지 아닌 확장자", "/__vs/file/assets/evil.html", 403],
    // #155가 runtime 을 열었다 — 연 것은 `.json` 하나뿐이다.
    ["runtime 에 .json 아닌 확장자", "/__vs/file/runtime/evil.js", 403],
    ["runtime 으로 상위 폴더 탈출", "/__vs/file/runtime/..%2f..%2fescaped.json", 400],
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

/**
 * `runtime/` — 자연어 요청/응답 교환소 (이슈 #155).
 *
 * #133이 좁혀 둔 화이트리스트를 폴더 하나만큼 넓혔다. 넓힌 쪽이 **기존 방어를
 * 비켜가지 않는지**가 이 블록의 전부다. 새로 판단하는 코드는 없다 —
 * `protocol.ts`의 표에 `runtime: [".json"]` 한 줄이 늘었을 뿐이고,
 * `resolveWorkspaceFile`·`realPathStaysInside`·`checkRequestOrigin`은
 * 폴더를 가리지 않는다. 그 "가리지 않음"을 여기서 실제 요청으로 확인한다.
 */
describe("runtime/ — 자연어 요청/응답 교환소(#155)", () => {
  it("GUI가 요청을 쓰고 에이전트가 쓴 응답을 다시 읽는다 — 한 바퀴", async () => {
    // #273: 공유 요청 파일은 잠금 주인만 쓴다.
    const lock = await fetch(`${baseUrl}/__vs/request-lock/nl`, {
      method: "POST",
      headers: { "x-visual-spec-request-owner": "req-1" },
    });
    expect(lock.status).toBe(200);
    const written = await fetch(`${baseUrl}/__vs/file/runtime/nl-request.json`, {
      method: "PUT",
      headers: { "x-visual-spec-expected-revision": "missing", "x-visual-spec-request-owner": "req-1" },
      body: JSON.stringify({ protocol: 1, id: "req-1", instruction: "간격을 24로 해줘" }),
    });

    expect(written.status).toBe(200);

    // 에이전트 역할 — 파일 시스템으로 직접 답을 쓴다(앱은 LLM을 부르지 않는다).
    writeFileSync(
      join(workspaceRoot, "runtime", "nl-response.json"),
      JSON.stringify({ protocol: 1, requestId: "req-1", commands: [] }),
    );

    const read = await fetch(`${baseUrl}/__vs/file/runtime/nl-response.json`);

    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ requestId: "req-1" });
  });

  it("교차 출처 PUT은 runtime 에도 못 쓴다 — Command를 심을 수 있는 자리다", async () => {
    // 여기에 파일을 쓸 수 있으면 남의 페이지가 GUI에 적용될 Command 배열을
    // 심는 셈이 된다. specs 와 **같은** 방어가 서야 하는 이유다.
    const response = await rawRequest(
      "PUT",
      "/__vs/file/runtime/nl-response.json",
      '{"protocol":1,"requestId":"req-1","commands":[]}',
      { host: `localhost:${port}`, origin: "http://evil.example" },
    );

    expect(response.status).toBe(403);
    expect(existsSync(join(workspaceRoot, "runtime", "nl-response.json"))).toBe(false);
  });

  it("위조 Host로 온 GET은 runtime 내용을 내보내지 않는다", async () => {
    writeFileSync(join(workspaceRoot, "runtime", "nl-request.json"), '{"secret":1}');

    const response = await rawRequest("GET", "/__vs/file/runtime/nl-request.json", undefined, {
      host: "evil.example",
    });

    expect(response.status).toBe(403);
    expect(response.text).not.toContain("secret");
  });

  it("runtime 안의 링크가 밖을 가리켜도 그 너머로는 못 쓴다", async (context) => {
    const outside = mkdtempSync(join(tmpdir(), "visual-spec-outside-"));
    try {
      symlinkSync(outside, join(workspaceRoot, "runtime", "link"), "junction");
    } catch {
      rmSync(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    const response = await rawRequest("PUT", "/__vs/file/runtime/link/escaped.json", "{}");

    expect(response.status).toBe(403);
    expect(existsSync(join(outside, "escaped.json"))).toBe(false);
    rmSync(join(workspaceRoot, "runtime", "link"), { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("목록에는 .json 만 올라온다 — 열린 확장자가 하나뿐임을 서버가 그대로 지킨다", async () => {
    writeFileSync(join(workspaceRoot, "runtime", "nl-request.json"), "{}");
    writeFileSync(join(workspaceRoot, "runtime", "notes.txt"), "x");

    const response = await fetch(`${baseUrl}/__vs/list/runtime`);

    expect(await response.json()).toMatchObject({ files: ["nl-request.json"] });
  });
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


describe("목록 메타데이터 opt-in (#227 일부)", () => {
  it("기본 목록을 유지하고 요청할 때만 mtime=0도 반환한다", async () => {
    for (const [name, time] of [["a-old.json", 0], ["z-new.json", 1000]] as const) {
      const path = join(workspaceRoot, "specs", name);
      writeFileSync(path, "{}");
      utimesSync(path, time, time);
    }
    expect(await (await fetch(`${baseUrl}/__vs/list/specs`)).json()).toEqual({
      ok: true, dir: "specs", files: ["a-old.json", "z-new.json"],
    });
    expect(await (await fetch(`${baseUrl}/__vs/list/specs?metadata=1`)).json()).toEqual({
      ok: true, dir: "specs", files: ["a-old.json", "z-new.json"],
      entries: [{ name: "a-old.json", mtimeMs: 0 }, { name: "z-new.json", mtimeMs: 1000000 }],
    });
  });

  it("메타데이터도 허용 확장자만 내보내며 외부 링크는 따라가지 않는다", async () => {
    const external = mkdtempSync(join(tmpdir(), "vsb-meta-outside-"));
    try {
      writeFileSync(join(external, "secret.json"), "{}");
      symlinkSync(join(external, "secret.json"), join(workspaceRoot, "specs", "link.json"));
      writeFileSync(join(workspaceRoot, "specs", "notes.txt"), "x");
      expect(await (await fetch(`${baseUrl}/__vs/list/specs?metadata=1`)).json()).toMatchObject({files: [], entries: []});
      rmSync(join(workspaceRoot, "specs"), { recursive: true });
      symlinkSync(external, join(workspaceRoot, "specs"));
      expect((await fetch(`${baseUrl}/__vs/list/specs?metadata=1`)).status).toBe(403);
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("목록 수집 후 삭제된 파일은 메타데이터에서 빼고 요청은 성공한다", async () => {
    const path = join(workspaceRoot, "specs", "gone.json");
    writeFileSync(path, "{}");
    const original = fs.lstatSync;
    const spy = vi.spyOn(fs, "lstatSync").mockImplementation((...args: Parameters<typeof fs.lstatSync>) => {
      if (args[0] === path) rmSync(path, { force: true });
      return original(...args);
    });
    try {
      const response = await fetch(`${baseUrl}/__vs/list/specs?metadata=1`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ files: ["gone.json"], entries: [] });
    } finally {
      spy.mockRestore();
    }
  });

  it("재귀 opt-in과 함께 동작하고 사라진 폴더는 빈 목록이다", async () => {
    mkdirSync(join(workspaceRoot, "generated", "pages"));
    const path = join(workspaceRoot, "generated", "pages", "Home.tsx");
    writeFileSync(path, "export default null;");
    utimesSync(path, 10, 10);
    expect(await (await fetch(`${baseUrl}/__vs/list/generated?recursive=1&metadata=1`)).json()).toMatchObject({
      files: ["pages/Home.tsx"], entries: [{name: "pages/Home.tsx", mtimeMs: 10000}],
    });
    rmSync(join(workspaceRoot, "specs"), { recursive: true });
    expect(await (await fetch(`${baseUrl}/__vs/list/specs?metadata=1`)).json()).toMatchObject({ files: [], entries: [] });
  });
});


describe("project rename (#227)", () => {
  const oldText = JSON.stringify({ ...migrateV01(blankSpec), name: "Old" });
  function rename(name = "New", fileName = "old.json", expectedText = oldText) {
    return fetch(`${baseUrl}/__vs/rename`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, name, expectedText }) });
  }
  beforeEach(() => writeFileSync(join(workspaceRoot, "specs/old.json"), oldText));
  afterEach(() => vi.mocked(fs.writeFileSync).mockRestore());
  afterEach(() => vi.mocked(fs.unlinkSync).mockRestore());
  afterEach(() => vi.mocked(fs.openSync).mockRestore());

  it("changes name and filename while preserving all other fields", async () => {
    expect((await rename()).status).toBe(200);
    expect(existsSync(join(workspaceRoot, "specs/old.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(workspaceRoot, "specs/New.json"), "utf8"))).toEqual({ ...JSON.parse(oldText), name: "New" });
  });
  it("preserves legacy screen shape/version while changing its display name", async () => {
    const legacy = JSON.stringify(blankSpec);
    writeFileSync(join(workspaceRoot, "specs/old.json"), legacy);
    expect((await rename("New", "old.json", legacy)).status).toBe(200);
    expect(JSON.parse(readFileSync(join(workspaceRoot, "specs/New.json"), "utf8"))).toEqual({ ...blankSpec, screen: { ...blankSpec.screen, name: "New" } });
  });
  it("rejects arbitrary JSON objects without changing their contents", async () => {
    const invalid = JSON.stringify({ name: "Old" });
    writeFileSync(join(workspaceRoot, "specs/old.json"), invalid);
    expect((await rename("New", "old.json", invalid)).status).toBe(400);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(invalid);
  });
  it("rejects existing and case-insensitive destination names without changing either file", async () => {
    writeFileSync(join(workspaceRoot, "specs/new.json"), "other project");
    expect((await rename()).status).toBe(409);
    expect(readFileSync(join(workspaceRoot, "specs/new.json"), "utf8")).toBe("other project");
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
  });
  it("rejects stale requests and leaves newer contents in place", async () => {
    writeFileSync(join(workspaceRoot, "specs/old.json"), "newer");
    expect((await rename()).status).toBe(409);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe("newer");
    expect(existsSync(join(workspaceRoot, "specs/New.json"))).toBe(false);
  });
  it.each(["../escape", "a/b", "a\\b", "CON", "trailing.", "", " padded ", "a?b", "\ud800", "한".repeat(84)])("rejects unsafe name %s", async (name) => {
    expect((await rename(name)).status).toBe(400);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
  });
  it("rejects malformed source unicode without crashing or modifying files", async () => {
    expect((await rename("New", "\ud800.json")).status).toBe(400);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
  });
  it("rejects symlink source and destination without modifying their targets", async () => {
    symlinkSync(join(workspaceRoot, "specs/old.json"), join(workspaceRoot, "specs/link.json"));
    expect((await rename("New", "link.json")).status).toBe(400);
    symlinkSync(join(workspaceRoot, "specs/old.json"), join(workspaceRoot, "specs/New.json"));
    expect((await rename()).status).toBe(409);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
  });
  it("keeps source and removes partial destination when writing fails", async () => {
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => { throw new Error("disk full"); });
    expect((await rename()).status).toBe(500);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
    expect(existsSync(join(workspaceRoot, "specs/New.json"))).toBe(false);
  });
  it("never overwrites a destination created after the collision listing", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    vi.mocked(fs.openSync).mockImplementationOnce((path, flags, mode) => {
      actual.writeFileSync(path, "arrived concurrently");
      return actual.openSync(path, flags, mode);
    });
    expect((await rename()).status).toBe(409);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
    expect(readFileSync(join(workspaceRoot, "specs/New.json"), "utf8")).toBe("arrived concurrently");
  });
  it("preserves original on same-filename write failure", async () => {
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => { throw new Error("disk full"); });
    expect((await rename("old")).status).toBe(500);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
  });
  it("rolls back destination if source unlink fails", async () => {
    vi.mocked(fs.unlinkSync).mockImplementationOnce(() => { throw new Error("permission denied"); });
    expect((await rename()).status).toBe(500);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
    expect(existsSync(join(workspaceRoot, "specs/New.json"))).toBe(false);
  });
  it("retains two complete copies if rollback unlink also fails", async () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error("permission denied"); });
    expect((await rename()).status).toBe(500);
    expect(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).toBe(oldText);
    expect(JSON.parse(readFileSync(join(workspaceRoot, "specs/New.json"), "utf8")).pages).toEqual(JSON.parse(oldText).pages);
  });
  it("updates display name in place when filename already matches", async () => {
    expect((await rename("old")).status).toBe(200);
    expect(JSON.parse(readFileSync(join(workspaceRoot, "specs/old.json"), "utf8")).name).toBe("old");
  });
});

let lateRequests: (() => void)[] | undefined;
describe("runtime/ 요청 파일 잠금(#273)", () => {
  const lock = (method: string, kind: string, owner?: string) =>
    fetch(`${baseUrl}/__vs/request-lock/${kind}`, {
      method,
      headers: owner === undefined ? {} : { "x-visual-spec-request-owner": owner },
    });
  const putRequest = (file: string, owner?: string) =>
    fetch(`${baseUrl}/__vs/file/runtime/${file}`, {
      method: "PUT",
      headers: { "x-visual-spec-expected-revision": "missing", ...(owner === undefined ? {} : { "x-visual-spec-request-owner": owner }) },
      body: JSON.stringify({ protocol: 1, id: owner ?? "none" }),
    });

  it("두 번째 탭은 잠금도 요청 파일 쓰기도 거절되고, 첫 탭의 요청이 그대로 남는다", async () => {
    expect((await lock("POST", "nl", "tab-a")).status).toBe(200);
    expect((await putRequest("nl-request.json", "tab-a")).status).toBe(200);

    const busy = await lock("POST", "nl", "tab-b");
    expect(busy.status).toBe(409);
    expect((await putRequest("nl-request.json", "tab-b")).status).toBe(409);
    expect((await putRequest("nl-request.json")).status).toBe(409);

    expect(JSON.parse(readFileSync(join(workspaceRoot, "runtime", "nl-request.json"), "utf8")).id).toBe("tab-a");
  });

  it("풀면 다음 탭이 잡는다. 남의 잠금은 풀지 못한다", async () => {
    await lock("POST", "ticket", "tab-a");
    await lock("DELETE", "ticket", "tab-b");
    expect((await lock("POST", "ticket", "tab-b")).status).toBe(409);
    await lock("DELETE", "ticket", "tab-a");
    expect((await lock("POST", "ticket", "tab-b")).status).toBe(200);
    expect((await putRequest("ticket-request.json", "tab-b")).status).toBe(200);
  });

  it("자연어와 티켓 잠금은 서로 독립이다", async () => {
    await lock("POST", "nl", "tab-a");
    expect((await lock("POST", "ticket", "tab-b")).status).toBe(200);
  });

  it("대소문자만 다른 경로로 잠금을 비켜가지 못한다", async () => {
    await lock("POST", "nl", "tab-a");
    expect((await putRequest("NL-Request.json", "tab-b")).status).toBe(409);
  });

  it("잠금 파일은 목록·파일 라우트로 보이지 않는다", async () => {
    await lock("POST", "nl", "tab-a");
    const listed = await (await fetch(`${baseUrl}/__vs/list/runtime`)).json();
    expect(JSON.stringify(listed)).not.toContain("lock");
    expect((await fetch(`${baseUrl}/__vs/file/runtime/.nl-request.lock`)).status).toBeGreaterThanOrEqual(400);
  });

  it("주인 헤더가 없거나 모르는 종류면 거절하고, 교차 출처는 잠금도 못 잡는다", async () => {
    expect((await lock("POST", "nl")).status).toBe(400);
    expect((await lock("POST", "spec", "tab-a")).status).toBe(404);
    const crossOrigin = await rawRequest("POST", "/__vs/request-lock/nl", undefined, {
      host: `localhost:${port}`, origin: "http://evil.example", "x-visual-spec-request-owner": "evil",
    });
    expect(crossOrigin.status).toBeGreaterThanOrEqual(400);
    expect((await lock("POST", "nl", "tab-a")).status).toBe(200);
  });

  it("잠금을 풀면 자기 요청 파일을 지우고, 다른 탭이 새로 쓴 요청은 남긴다", async () => {
    await lock("POST", "nl", "tab-a");
    await putRequest("nl-request.json", "tab-a");
    await lock("DELETE", "nl", "tab-a");
    expect(existsSync(join(workspaceRoot, "runtime", "nl-request.json"))).toBe(false);

    await lock("POST", "nl", "tab-b");
    await putRequest("nl-request.json", "tab-b");
    await lock("DELETE", "nl", "tab-a"); // 이미 끝난 탭 A의 늦은 해제
    expect(JSON.parse(readFileSync(join(workspaceRoot, "runtime", "nl-request.json"), "utf8")).id).toBe("tab-b");
  });

  it("runtime 이 바깥 폴더를 가리키는 링크면 잠금 기록을 그 너머에 쓰지 않는다", async (context) => {
    const outside = mkdtempSync(join(tmpdir(), "visual-spec-outside-"));
    rmSync(join(workspaceRoot, "runtime"), { recursive: true, force: true });
    try {
      symlinkSync(outside, join(workspaceRoot, "runtime"), "junction");
    } catch {
      rmSync(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    expect((await lock("POST", "nl", "tab-a")).status).toBe(403);
    expect((await lock("DELETE", "nl", "tab-a")).status).toBe(403);
    expect(fs.readdirSync(outside)).toEqual([]);
    rmSync(join(workspaceRoot, "runtime"), { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("renew=1은 새로 잡지 않는다 — 다른 탭이 가져갔다 풀어 비어 있어도 거절한다 (PR #296 리뷰)", async () => {
    const renew = (owner: string) => fetch(`${baseUrl}/__vs/request-lock/nl?renew=1`, {
      method: "POST", headers: { "x-visual-spec-request-owner": owner },
    });
    expect((await renew("tab-a")).status).toBe(409); // 잡은 적이 없다
    await lock("POST", "nl", "tab-a");
    expect((await renew("tab-a")).status).toBe(200);
    await lock("DELETE", "nl", "tab-a");
    await lock("POST", "nl", "tab-b");
    await lock("DELETE", "nl", "tab-b");
    expect((await renew("tab-a")).status).toBe(409);
  });

  it("본문이 늦게 도착하는 사이 잠금이 넘어가면 늦은 PUT은 거절되고 새 주인의 요청이 남는다 (PR #296 리뷰)", async () => {
    for (const kind of ["nl", "ticket"] as const) {
      const file = `${kind}-request.json`;
      expect((await lock("POST", kind, "tab-a")).status).toBe(200);

      // A의 PUT — 헤더와 본문 일부만 보내고 멈춘다.
      const late = new Promise<{ status: number; text: string }>((resolve, reject) => {
        const req = request({ host: "127.0.0.1", port, method: "PUT", path: `/__vs/file/runtime/${file}`,
          headers: { "x-visual-spec-expected-revision": "missing", "x-visual-spec-request-owner": "tab-a", "content-type": "application/json" } }, (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => (text += chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
        });
        req.on("error", reject);
        req.write('{"protocol":1,');
        (lateRequests ??= []).push(() => req.end('"id":"tab-a"}'));
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 그 사이 A가 잠금을 풀고(탭 닫기 등) B가 잡아 자기 요청을 쓴다.
      await lock("DELETE", kind, "tab-a");
      expect((await lock("POST", kind, "tab-b")).status).toBe(200);
      expect((await putRequest(file, "tab-b")).status).toBe(200);

      // A의 남은 본문이 도착한다.
      lateRequests!.shift()!();
      const result = await late;
      expect(result.status, kind).toBe(409);
      expect(JSON.parse(readFileSync(join(workspaceRoot, "runtime", file), "utf8")).id, kind).toBe("tab-b");
      await lock("DELETE", kind, "tab-b");
    }
  });

  it("gui 잠금(#279): 연결된 탭만 gui-state.json을 쓰고, 풀면 그 탭의 상태 파일이 정리된다", async () => {
    expect((await lock("POST", "gui", "tab-a")).status).toBe(200);
    expect((await lock("POST", "gui", "tab-b")).status).toBe(409);
    const write = (owner: string) => fetch(`${baseUrl}/__vs/file/runtime/gui-state.json`, {
      method: "PUT",
      headers: { "x-visual-spec-expected-revision": "missing", "x-visual-spec-request-owner": owner },
      body: JSON.stringify({ protocol: 1, id: owner }),
    });
    expect((await write("tab-b")).status).toBe(409);
    expect((await write("tab-a")).status).toBe(200);
    await lock("DELETE", "gui", "tab-a");
    expect(existsSync(join(workspaceRoot, "runtime", "gui-state.json"))).toBe(false);
    expect((await lock("POST", "gui", "tab-b")).status).toBe(200);
  });
});

