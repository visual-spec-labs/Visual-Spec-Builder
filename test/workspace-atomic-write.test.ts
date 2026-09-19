import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 저장이 실패해도 **이미 저장돼 있던 스펙은 잃지 않는다** (PR #145 리뷰, wook3964).
 *
 * `writeFileSync(대상, ...)`은 대상을 먼저 0바이트로 자른다. 디스크가 차거나 I/O
 * 오류가 나면 잘 있던 파일이 빈 파일·반쪽 파일로 남는다 — Save 한 번이 원본을 날린다.
 * `workspaceServer.ts`의 `writeFileAtomic`이 임시 파일 → rename으로 바꾼 이유다.
 *
 * **왜 `node:fs`를 가짜로 바꾸나.** 증명해야 하는 것은 "쓰기 도중 실패했을 때 원본이
 * 그대로인가"인데, 디스크를 실제로 채우거나 프로세스를 중간에 죽이는 것은 테스트로
 * 재현할 수 없다. 그래서 실패 지점만 골라 예외를 던진다 — 나머지 파일 입출력은 전부
 * 진짜다(`importOriginal`을 그대로 펼친다). 이 파일만 모듈을 갈아끼우므로 미들웨어의
 * 다른 동작을 보는 `workspace-middleware.test.ts`는 진짜 `node:fs` 위에서 돈다.
 */
const failure = vi.hoisted(() => ({ atRename: false, atTempWrite: false }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: actual,
    writeFileSync: ((...args: Parameters<typeof actual.writeFileSync>) => {
      // 디스크 부족·I/O 오류가 **진짜로** 일어나는 모양을 흉내 낸다: 대상 파일을
      // 먼저 0바이트로 자른 다음 내용을 채우다가 실패한다. 예외만 던지면 "자르기"가
      // 빠져서, 잘라 놓고 실패하는 원래 결함을 이 테스트가 못 잡는다.
      if (failure.atTempWrite) {
        actual.writeFileSync(args[0], "");
        throw new Error("흉내 낸 쓰기 실패(ENOSPC)");
      }
      return actual.writeFileSync(...args);
    }) as typeof actual.writeFileSync,
    renameSync: ((...args: Parameters<typeof actual.renameSync>) => {
      // 임시 파일은 다 썼는데 갈아 끼우기 직전에 실패 — 원본은 아직 손대지 않은 상태다.
      if (failure.atRename) throw new Error("흉내 낸 rename 실패(EIO)");
      return actual.renameSync(...args);
    }) as typeof actual.renameSync,
  };
});

const { createWorkspaceMiddleware, ensureWorkspaceDirs } = await import(
  "@/features/workspace/workspaceServer"
);

let server: Server;
let baseUrl: string;
let workspaceRoot: string;
let handler: ReturnType<typeof createWorkspaceMiddleware>;

/** 지금 작업공간에 남아 있는 임시 파일들. 실패 후 쓰레기가 남는지 본다. */
function tempLeftovers(dir: string): string[] {
  return readdirSync(join(workspaceRoot, dir)).filter((name) => name.endsWith(".tmp"));
}

beforeAll(async () => {
  server = createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 418;
      res.end("next()");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "visual-spec-atomic-"));
  ensureWorkspaceDirs(workspaceRoot);
  handler = createWorkspaceMiddleware(workspaceRoot);
});

afterEach(() => {
  failure.atRename = false;
  failure.atTempWrite = false;
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe("기존 스펙 덮어쓰기는 원자적이다 (PR #145 리뷰)", () => {
  const original = '{"name":"소중한 원본","pages":{}}';
  const specPath = () => join(workspaceRoot, "specs", "home.json");

  it("rename 직전에 실패하면 원본이 한 글자도 안 바뀐다", async () => {
    writeFileSync(specPath(), original);
    failure.atRename = true;

    const response = await fetch(`${baseUrl}/__vs/file/specs/home.json`, {
      method: "PUT",
      body: '{"name":"덮어쓰다 만 것"}',
    });

    expect(response.status).toBe(500);
    expect(readFileSync(specPath(), "utf8")).toBe(original);
  });

  it("임시 파일에 쓰다 실패해도(디스크 부족) 원본이 그대로다", async () => {
    writeFileSync(specPath(), original);
    failure.atTempWrite = true;

    const response = await fetch(`${baseUrl}/__vs/file/specs/home.json`, {
      method: "PUT",
      body: '{"name":"덮어쓰다 만 것"}',
    });

    expect(response.status).toBe(500);
    expect(readFileSync(specPath(), "utf8")).toBe(original);
  });

  it("실패한 저장은 임시 파일을 남기지 않는다", async () => {
    writeFileSync(specPath(), original);
    failure.atRename = true;

    await fetch(`${baseUrl}/__vs/file/specs/home.json`, { method: "PUT", body: "{}" });

    expect(tempLeftovers("specs")).toEqual([]);
  });

  it("실패를 알린다 — 조용히 200을 주면 사용자가 저장됐다고 믿는다", async () => {
    failure.atRename = true;

    const response = await fetch(`${baseUrl}/__vs/file/specs/new.json`, {
      method: "PUT",
      body: "{}",
    });

    expect(response.status).toBe(500);
    expect(existsSync(join(workspaceRoot, "specs", "new.json"))).toBe(false);
  });

  it("성공하면 내용이 바뀌고 임시 파일도 남지 않는다", async () => {
    writeFileSync(specPath(), original);

    const response = await fetch(`${baseUrl}/__vs/file/specs/home.json`, {
      method: "PUT",
      body: '{"name":"새 내용"}',
    });

    expect(response.status).toBe(200);
    expect(readFileSync(specPath(), "utf8")).toBe('{"name":"새 내용"}');
    expect(tempLeftovers("specs")).toEqual([]);
  });

  it("없던 파일도 그대로 만들어진다 — rename 경로가 새 파일을 막지 않는다", async () => {
    const response = await fetch(`${baseUrl}/__vs/file/specs/처음.json`, {
      method: "PUT",
      body: '{"first":true}',
    });

    expect(response.status).toBe(200);
    expect(readFileSync(join(workspaceRoot, "specs", "처음.json"), "utf8")).toBe(
      '{"first":true}',
    );
  });

  it("이미지 바이너리도 같은 경로로 온전히 저장된다", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

    await fetch(`${baseUrl}/__vs/file/assets/hero.png`, { method: "PUT", body: png });

    const saved = new Uint8Array(readFileSync(join(workspaceRoot, "assets", "hero.png")));
    expect(Array.from(saved)).toEqual(Array.from(png));
    expect(tempLeftovers("assets")).toEqual([]);
  });
});
