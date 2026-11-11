import * as fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/**
 * PageId 대소문자 충돌 — **실제 파일 시스템** 회귀 (이슈 #281 리뷰, docs/26 #281 "PageId 대소문자 충돌").
 *
 * 메모리 fixture가 아니라 임시 폴더를 작업공간으로 둔 실제 작업공간 서버(`createWorkspaceMiddleware`)에
 * 생성 자리 결정(`ensureGenerationTarget`)과 HTTP 쓰기를 그대로 보낸다. 대소문자를 가리지 않는 파일
 * 시스템(Windows·macOS 기본)이면 `Login`·`login` 두 생성 자리가 실제로 한 폴더라는 것도 함께 확인한다.
 */

import { GENERATION_MANIFEST_PATH, parseGenerationManifest } from "@/features/editor/export/generationManifest";
import { ensureGenerationTarget, forgetUnsavedGenerationProjects } from "@/features/editor/ui/generationTarget";
import { readWorkspaceTextFileStrict, writeWorkspaceFile } from "@/features/editor/ui/workspaceClient";
import { GENERATED_DIR, WORKSPACE_MISSING_REVISION } from "@/features/workspace/protocol";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";

let root: string;
let server: Server;
const nativeFetch = globalThis.fetch;

beforeEach(async () => {
  root = fs.mkdtempSync(join(tmpdir(), "vsb-page-id-case-"));
  ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => nativeFetch(new URL(input, base), init));
  forgetUnsavedGenerationProjects();
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllGlobals();
  fs.rmSync(root, { recursive: true, force: true });
});

/** 이 임시 폴더의 파일 시스템이 대소문자를 가리지 않는가 — 같은 폴더를 대문자로 열어 본다. */
function caseInsensitiveFs(): boolean {
  const probe = join(root, "case-probe");
  fs.mkdirSync(probe);
  try {
    return fs.existsSync(join(root, "CASE-PROBE"));
  } finally {
    fs.rmdirSync(probe);
  }
}

/** 작업공간 아래 모든 파일(작업공간 루트 기준, `/` 구분). */
function filesUnder(dir: string): string[] {
  const start = join(root, dir);
  if (!fs.existsSync(start)) return [];
  return (fs.readdirSync(start, { recursive: true, withFileTypes: true }) as fs.Dirent[])
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1).replaceAll("\\", "/"));
}

it("대소문자만 다른 PageId는 실제 작업공간에서 생성 자리를 정하지 않아 기록·generated/ 어디에도 쓰지 않는다", async () => {
  const owner = { fileName: "shop.json", documentId: 1, projectPageIds: ["Login", "login", "signup"] };

  for (const pageId of ["Login", "login"]) {
    const located = await ensureGenerationTarget({ ...owner, pageId });
    expect(located.ok).toBe(false);
    if (!located.ok) {
      expect(located.error).toContain("대소문자만 다른 페이지");
      expect(located.retryable).toBe(false);
    }
  }
  expect(fs.existsSync(join(root, GENERATION_MANIFEST_PATH))).toBe(false);
  expect(filesUnder(GENERATED_DIR)).toEqual([]);

  // 충돌이 없는 페이지는 같은 프로젝트에서도 그대로 자리를 받는다
  const signup = await ensureGenerationTarget({ ...owner, pageId: "signup" });
  expect(signup).toMatchObject({ ok: true, target: { outputDir: "shop", root: "shop/signup" } });
  const manifest = parseGenerationManifest(fs.readFileSync(join(root, GENERATION_MANIFEST_PATH), "utf8"));
  expect(Object.values(manifest.projects).map((project) => project.fileName)).toEqual(["shop.json"]);
});

it("거부하지 않으면 무엇이 깨지는가 — 대소문자를 가리지 않는 파일 시스템에서 두 생성 자리는 한 파일이다", async () => {
  const upper = `${GENERATED_DIR}/shop/Login/pages/LoginPage.tsx`;
  const lower = `${GENERATED_DIR}/shop/login/pages/LoginPage.tsx`;
  const written = await writeWorkspaceFile(upper, "export default function LoginPage() { return null; } // Login\n",
    "text/plain; charset=utf-8", WORKSPACE_MISSING_REVISION);
  expect(written.ok).toBe(true);

  const other = await readWorkspaceTextFileStrict(lower);
  expect(other.ok).toBe(true);
  if (caseInsensitiveFs()) {
    // Windows·macOS 기본: `login` 자리를 읽으면 `Login` 페이지의 출력이 나온다 — 수용 기록 키는 서로 다르다
    expect(other.ok && other.text).toContain("// Login");
    expect(filesUnder(GENERATED_DIR)).toHaveLength(1);
  } else {
    // 대소문자를 가리는 파일 시스템(Linux 등)에서는 따로다. 거부 규칙은 플랫폼과 상관없이 같다
    expect(other.ok && other.text).toBeNull();
  }
});
