import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Windows 장치 이름 — **실제 파일 시스템** 회귀 (이슈 #281 리뷰, docs/26 #281 "Windows 장치 이름").
 *
 * `generation-page-id-case.test.ts`와 같이 임시 폴더를 작업공간으로 둔 실제 작업공간 서버에 생성 자리 결정
 * (`ensureGenerationTarget`)과 HTTP 쓰기를 그대로 보낸다. Windows에서는 거부하지 않았을 때 무엇이 깨지는지 —
 * 서버(Node)는 장치 이름의 폴더·파일을 만들어 버리지만 일반 Win32 경로로는 보이지 않는다 — 도 실제로 확인한다.
 */

import { isWindowsDeviceName, projectOutputDirName } from "@/features/editor/export/generationIdentity";
import { ensureGenerationTarget, forgetUnsavedGenerationProjects } from "@/features/editor/ui/generationTarget";
import { writeWorkspaceFile } from "@/features/editor/ui/workspaceClient";
import { GENERATED_DIR, WORKSPACE_MISSING_REVISION } from "@/features/workspace/protocol";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";
import { GENERATION_MANIFEST_PATH } from "@/features/editor/export/generationManifest";

let root: string;
let server: Server;
const nativeFetch = globalThis.fetch;

beforeEach(async () => {
  root = fs.mkdtempSync(join(tmpdir(), "vsb-device-name-"));
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

/** 작업공간 아래 모든 파일(작업공간 루트 기준, `/` 구분). */
function filesUnder(dir: string): string[] {
  const start = join(root, dir);
  if (!fs.existsSync(start)) return [];
  return (fs.readdirSync(start, { recursive: true, withFileTypes: true }) as fs.Dirent[])
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1).replaceAll("\\", "/"));
}

describe("장치 이름 판정 — 순수 함수", () => {
  it("대소문자·확장자·끝의 점과 공백·위 첨자 숫자 변형을 장치 이름으로 보고, 비슷한 보통 이름은 통과시킨다", () => {
    for (const name of ["con", "CON", "Con", "prn", "AUX", "nul", "NUL.txt", "Con.tsx", "com1", "COM9", "com0", "Lpt1", "LPT9.json",
      "com¹", "lpt³", "con.", "nul ", "aux.x.y"]) {
      expect(isWindowsDeviceName(name), name).toBe(true);
    }
    for (const name of ["console", "connect", "com10", "lpt", "aux1", "nullable", "Header", "page1", "icon"]) {
      expect(isWindowsDeviceName(name), name).toBe(false);
    }
  });

  it("프로젝트 폴더 후보는 장치 이름이면 -project를 붙인다(대소문자 무관). 파일 이름의 점은 '-'가 되므로 확장자 변형은 장치가 아니다", () => {
    expect(projectOutputDirName("CON.json")).toBe("con-project");
    expect(projectOutputDirName("Com1.json")).toBe("com1-project");
    expect(projectOutputDirName("lpt¹.json")).toBe("lpt¹-project");
    expect(projectOutputDirName("con.backup.json")).toBe("con-backup");
    expect(projectOutputDirName("console.json")).toBe("console");
  });
});

it("장치 이름 PageId(대소문자 변형)는 실제 작업공간에서 생성 자리를 정하지 않아 기록·generated/ 어디에도 쓰지 않는다", async () => {
  const pageIds = ["con", "CON", "Nul", "aux", "PRN", "com1", "COM9", "lpt1", "LPT9"];
  for (const pageId of pageIds) {
    const located = await ensureGenerationTarget({ fileName: "shop.json", documentId: 1, pageId, projectPageIds: [pageId, "home"] });
    expect(located.ok, pageId).toBe(false);
    if (!located.ok) {
      expect(located.error).toContain(`페이지 ID "${pageId}"는 Windows 장치 이름`);
      expect(located.retryable).toBe(false);
    }
  }
  expect(fs.existsSync(join(root, GENERATION_MANIFEST_PATH))).toBe(false);
  expect(filesUnder(GENERATED_DIR)).toEqual([]);

  // 장치 이름이 아닌 페이지는 같은 프로젝트에서도 그대로 자리를 받는다
  expect(await ensureGenerationTarget({ fileName: "shop.json", documentId: 1, pageId: "home", projectPageIds: ["con", "home"] }))
    .toMatchObject({ ok: true, target: { root: "shop/home" } });
});

it("티켓 이름이 장치 이름이면(파일 Con.tsx·NUL.tsx — 확장자 변형) 전달 전에 거부하고 이유에 파일 이름을 밝힌다", async () => {
  const located = await ensureGenerationTarget({
    fileName: "shop.json", documentId: 1, pageId: "home", projectPageIds: ["home"], componentNames: ["Header", "Con", "NUL", "Card"],
  });
  expect(located.ok).toBe(false);
  if (!located.ok) {
    expect(located.error).toContain('"Con", "NUL"');
    expect(located.error).toContain("Con.tsx, NUL.tsx");
    expect(located.retryable).toBe(false);
  }
  expect(fs.existsSync(join(root, GENERATION_MANIFEST_PATH))).toBe(false);
});

it.runIf(process.platform === "win32")("거부하지 않으면 무엇이 깨지는가(Windows 실파일) — 서버는 con 폴더·Con.tsx를 만들지만 일반 Win32 경로로는 보이지 않는다", async () => {
  const device = `${GENERATED_DIR}/shop/con/pages/Home.tsx`;
  const deviceFile = `${GENERATED_DIR}/shop/home/pages/Con.tsx`;
  const normal = `${GENERATED_DIR}/shop/home/pages/Home.tsx`;
  for (const path of [device, deviceFile, normal]) {
    const written = await writeWorkspaceFile(path, "export default function Home() { return null; }\n",
      "text/plain; charset=utf-8", WORKSPACE_MISSING_REVISION);
    expect(written.ok, path).toBe(true); // Node는 `\\?\` 경로로 써 버린다
  }
  /** PowerShell(일반 Win32 경로 해석)에서 그 경로가 보이는가. 탐색기·git·편집기가 쓰는 해석과 같다. */
  const visibleToWin32 = (relative: string) => execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command",
    `Test-Path -LiteralPath '${join(root, relative).replaceAll("'", "''")}'`], { encoding: "utf8" }).trim() === "True";
  expect(visibleToWin32(normal)).toBe(true);
  expect(visibleToWin32(`${GENERATED_DIR}/shop/con`)).toBe(false);
  expect(visibleToWin32(deviceFile)).toBe(false);
});
