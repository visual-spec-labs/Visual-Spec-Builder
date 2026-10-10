import * as fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Export의 프로젝트 신원 — **실제 작업공간 서버 + 실제 HTTP 클라이언트** 회귀 (이슈 #281 리뷰).
 *
 * 임시 폴더를 작업공간으로 둔 `createWorkspaceMiddleware`에 `ui/workspaceClient.ts`가 그대로 HTTP를 보낸다.
 * 생성 기록 읽기만 `fetch` 앞에서 가로채 HTTP 500·네트워크 오류를 흉내 낸다 — 404는 서버가 실제로 돌려준다.
 *
 * 1. 기록 없음(404)과 읽기 실패(500·네트워크)를 가른다 — 실패면 "검사 불가"로 멈추고 파일을 고르지 않는다.
 * 2. A를 Export한 뒤 다른 이름으로 B로 저장하면 결과를 지우고, 재검사 전 다운로드에서 A의 바이트가 나오지 않는다.
 */

import { GENERATION_MANIFEST_PATH } from "@/features/editor/export/generationManifest";
import type { ProjectSpec } from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { isExportTargetCurrent, useExportStore, type ExportTarget } from "@/features/editor/store/exportStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { downloadGeneratedBundle, scanGeneratedCode } from "@/features/editor/ui/exportGeneratedCode";
import { ensureGenerationTarget, forgetUnsavedGenerationProjects, recordProjectRename } from "@/features/editor/ui/generationTarget";
import { holdRequestLock } from "@/features/editor/ui/agentRequestLock";
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from "@/features/workspace/workspaceServer";

let root: string;
let server: Server;
const nativeFetch = globalThis.fetch;
/** 이 경로(작업공간 기준)의 요청을 가로챈다. 응답을 돌려주거나 던지면 서버에 보내지 않는다. */
let intercept: ((path: string) => Response | null) | null = null;

beforeEach(async () => {
  root = fs.mkdtempSync(join(tmpdir(), "vsb-export-identity-"));
  ensureWorkspaceDirs(root);
  const middleware = createWorkspaceMiddleware(root);
  server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  intercept = null;
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    const url = new URL(input, base);
    const intercepted = intercept?.(decodeURIComponent(url.pathname));
    return intercepted ? Promise.resolve(intercepted) : nativeFetch(url, init);
  });
  forgetUnsavedGenerationProjects();
});

afterEach(async () => {
  server.closeIdleConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

/** 작업공간에 파일을 둔다(작업공간 기준 경로). */
function put(path: string, content: string | Uint8Array): void {
  fs.mkdirSync(join(root, path, ".."), { recursive: true });
  fs.writeFileSync(join(root, path), content);
}

/** 이 프로젝트 파일 이름의 생성 자리를 실제 기록으로 정하고 그 자리에 출력을 둔다. */
async function generate(fileName: string, mark: string): Promise<string> {
  const located = await ensureGenerationTarget({ fileName, documentId: 1, pageId: "page1", projectPageIds: ["page1"] });
  if (!located.ok) throw new Error(located.error);
  put(`generated/${located.target.root}/pages/Home.tsx`, `export default function Home() { return null; } // ${mark}\n`);
  return located.target.root;
}

function scanAs(fileName: string) {
  return scanGeneratedCode(seedSpec.screen, "page1", { fileName, documentId: 1 });
}

/** 생성 기록 읽기를 실패시킨다 — HTTP 500(작업공간 서버의 응답 모양) 또는 네트워크 오류. */
function failManifestRead(kind: "http500" | "network"): void {
  intercept = (path) => {
    if (!path.endsWith(GENERATION_MANIFEST_PATH)) return null;
    if (kind === "network") throw new TypeError("fetch failed");
    return new Response("서버 오류", { status: 500, headers: { "x-visual-spec-workspace": "1" } });
  };
}

describe("기록 없음(404)과 읽기 실패(500·네트워크)를 가른다", () => {
  it("기록이 없으면(서버의 실제 404) 파일 이름 후보 폴더를 '기록 없음'으로 보이고 ZIP 대상 파일을 고른다", async () => {
    put("generated/shop/page1/pages/Home.tsx", "export default function Home() { return null; } // direct\n");
    const scan = await scanAs("shop.json");
    expect(scan).toMatchObject({ kind: "ready", location: { layout: "project", root: "shop/page1", projectId: null } });
    if (scan.kind === "ready") expect(scan.files.map((file) => file.path)).toEqual(["pages/Home.tsx"]);
  });

  it.each(["http500", "network"] as const)("기록 읽기가 %s로 실패하면 검사 불가로 멈추고, 이름 변경·같은 slug 상황에서 남의 폴더를 고르지 않는다", async (kind) => {
    // 같은 slug: "my shop"과 "my-shop"은 둘 다 후보가 "my-shop"이라 두 번째가 "my-shop-2"를 받았다
    expect(await generate("my shop.json", "space")).toBe("my-shop/page1");
    expect(await generate("my-shop.json", "dash")).toBe("my-shop-2/page1");
    const before = await scanAs("my-shop.json");
    expect(before.kind === "ready" && before.files.every((file) => file.content.includes("// dash"))).toBe(true);

    failManifestRead(kind);
    for (const fileName of ["my shop.json", "my-shop.json"]) {
      const scan = await scanAs(fileName);
      expect(scan.kind).toBe("unavailable");
      if (scan.kind === "unavailable") expect(scan.message).toContain("읽지 못해");
    }
  });

  it("가로채기 없이 실제 서버가 읽기 오류를 돌려줘도(기록 자리가 디렉터리) 검사 불가로 멈춘다", async () => {
    fs.mkdirSync(join(root, GENERATION_MANIFEST_PATH), { recursive: true });
    const scan = await scanAs("shop.json");
    expect(scan.kind).toBe("unavailable");
  });
});

describe("Save As 뒤 Export 결과와 다운로드", () => {
  let created: Blob[];

  beforeEach(() => {
    created = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { created.push(blob as Blob); return "blob:test"; });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("document", { createElement: () => ({ click: () => {} }) });
    const project: ProjectSpec = { version: "0.3", name: "Shop", pages: { page1: structuredClone(seedSpec.screen) }, pageOrder: ["page1"] };
    useEditorStore.getState().loadSpec(project);
    useDocumentStore.getState().clearFileName();
    useDocumentStore.getState().setFileName("shop.json", null);
    useExportStore.getState().close();
  });

  function currentTarget(): ExportTarget {
    const { documentId, activePageId, spec } = useEditorStore.getState();
    return { documentId, pageId: activePageId, page: spec.pages[activePageId], projectName: spec.name, fileName: useDocumentStore.getState().fileName };
  }

  async function zipText(blob: Blob): Promise<string> {
    return new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
  }

  it("A Export → 다른 이름으로 B 저장 → 재검사 전 다운로드: 결과를 지우고, A의 바이트를 내려받지 않는다", async () => {
    await generate("shop.json", "A-bytes");
    await useExportStore.getState().open(currentTarget());
    const { target, files, report } = useExportStore.getState();
    expect(useExportStore.getState().status).toBe("ready");
    expect(files.some((file) => file.content.includes("A-bytes"))).toBe(true);

    // 대조: 바뀐 것이 없으면 내려받는다(ZIP은 압축 없음이라 바이트가 그대로 보인다)
    const control = await downloadGeneratedBundle("Shop", files, report!, compileTickets(target!.page), false, () => isExportTargetCurrent(target!));
    expect(control.kind).toBe("downloaded");
    expect(await zipText(created[0])).toContain("A-bytes");
    created.length = 0;

    useDocumentStore.getState().setFileName("shop-copy.json", null); // 다른 이름으로 저장
    expect(useExportStore.getState()).toMatchObject({ status: "idle", files: [], target: null });

    // 화면에 남아 있던 버튼·이미 시작한 클릭이 옛 결과로 내려받으려 해도 막는다
    const stale = await downloadGeneratedBundle("Shop", files, report!, compileTickets(target!.page), false, () => isExportTargetCurrent(target!));
    expect(stale).toEqual({ kind: "stale" });
    expect(created).toEqual([]);

    // 다시 검사하면 B(기록 없음, 후보 shop-copy)의 자리를 본다 — A의 파일은 없다
    await useExportStore.getState().rescan(currentTarget());
    expect(useExportStore.getState().status).toBe("ready");
    expect(useExportStore.getState().files).toEqual([]);
    expect(useExportStore.getState().location).toMatchObject({ root: "shop-copy/page1" });
  });

  it("다운로드 중(자산을 읽는 사이) 다른 이름으로 저장하면 ZIP을 내려받기 직전에 멈춘다", async () => {
    const outputRoot = await generate("shop.json", "A-bytes");
    put(`generated/${outputRoot}/pages/Home.tsx`, 'import hero from "../assets/hero.png";\nexport default function Home() { return <img src={hero} />; } // A-bytes\n');
    put("assets/hero.png", new Uint8Array([137, 80, 78, 71]));
    await useExportStore.getState().open(currentTarget());
    const { target, files, report } = useExportStore.getState();
    expect(report?.requiredAssets).toEqual(["hero.png"]);

    intercept = (path) => {
      if (path.endsWith("assets/hero.png")) useDocumentStore.getState().setFileName("shop-copy.json", null);
      return null;
    };
    const result = await downloadGeneratedBundle("Shop", files, report!, compileTickets(target!.page), false, () => isExportTargetCurrent(target!));
    expect(result).toEqual({ kind: "stale" });
    expect(created).toEqual([]);
  });

  it("앱 안 이름 변경(같은 프로젝트)도 파일 이름이 바뀌므로 결과를 지우고 다시 검사하게 한다", async () => {
    await generate("shop.json", "A-bytes");
    await useExportStore.getState().open(currentTarget());
    const identity = useDocumentStore.getState().projectIdentity;
    useDocumentStore.getState().adoptRenamedFileName("store.json", null);
    expect(useDocumentStore.getState().projectIdentity).toBe(identity);
    expect(useExportStore.getState().status).toBe("idle");
  });
});

/** 실제 ZIP 바이트를 잡는다. DOM 다운로드 동작만 대체하고 묶음 생성·HTTP 읽기는 그대로 쓴다. */
async function scanZip(fileName: string): Promise<string> {
  const scan = await scanAs(fileName);
  expect(scan.kind).toBe("ready");
  if (scan.kind !== "ready") throw new Error("not ready");
  let blob: Blob | undefined;
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => { blob = value as Blob; return "blob:audit"; });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("document", { createElement: () => ({ click: () => {} }) });
  const result = await downloadGeneratedBundle("audit", scan.files, scan.report, compileTickets(seedSpec.screen));
  expect(result.kind).toBe("downloaded");
  expect(blob).toBeDefined();
  return blob!.text();
}

describe("유효 JSON의 registry 구조 손상은 빈 기록이 아니다", () => {
  it.each([
    ["entries 누락", "entries", undefined], ["entries null", "entries", null],
    ["entries 배열", "entries", []], ["entries 문자열", "entries", "bad"],
    ["entries 항목 손상", "entries", { broken: {} }],
    ["projects 누락", "projects", undefined], ["projects null", "projects", null],
    ["projects 배열", "projects", []], ["projects 문자열", "projects", "bad"],
    ["projects 항목 손상", "projects", { broken: { fileName: "my-shop.json" } }],
  ])("%s: 다른 프로젝트 파일을 선택하지 않고 생성 기록도 덮지 않는다", async (_label, key, value) => {
    // 손상 판정의 입력을 직접 준비한다. 실제 등록은 위 HTTP/브라우저 회귀가 검증한다.
    // Windows CI에서 반복 등록의 원자적 rename이 EPERM으로 실패하면 손상 단언에 도달하지 못한다.
    put(GENERATION_MANIFEST_PATH, JSON.stringify({ protocol: 2, entries: {}, projects: {
      space: { fileName: "my shop.json", outputDir: "my-shop", createdAt: "2026-10-10T00:00:00Z" },
      dash: { fileName: "my-shop.json", outputDir: "my-shop-2", createdAt: "2026-10-10T00:00:00Z" },
    } }));
    put("generated/my-shop/page1/pages/Home.tsx", "export default function Home(){return null} // FOREIGN_SPACE");
    put("generated/my-shop-2/page1/pages/Home.tsx", "export default function Home(){return null} // OWN_DASH");
    const before = await scanZip("my-shop.json");
    expect(before).toContain("OWN_DASH");
    expect(before).not.toContain("FOREIGN_SPACE");
    const original = JSON.parse(fs.readFileSync(join(root, GENERATION_MANIFEST_PATH), "utf8"));
    const damaged = JSON.stringify({ ...original, [key as string]: value });
    put(GENERATION_MANIFEST_PATH, damaged);
    expect(await scanAs("my-shop.json")).toMatchObject({ kind: "unavailable" });
    expect(await ensureGenerationTarget({ fileName: "my-shop.json", documentId: 1, pageId: "page1", projectPageIds: ["page1"] }))
      .toMatchObject({ ok: false });
    expect(fs.readFileSync(join(root, GENERATION_MANIFEST_PATH), "utf8")).toBe(damaged);
  });

  it.each([null, { protocol: 1, entries: {} }, { protocol: 2, projects: {}, entries: {} }])(
    "확정 404·정상 구형/현재 기록의 미등록 direct 출력은 ZIP에 유지한다: %j", async (manifest) => {
      if (manifest !== null) put(GENERATION_MANIFEST_PATH, JSON.stringify(manifest));
      put("generated/direct/page1/pages/Home.tsx", "export default function Home(){return null} // DIRECT");
      expect(await scanZip("direct.json")).toContain("DIRECT");
    },
  );

  it("유효 registry가 이미 소유한 slug는 미등록 문서의 fallback으로 쓰지 않는다", async () => {
    await generate("my shop.json", "FOREIGN_SPACE");
    expect(await scanZip("my-shop.json")).not.toContain("FOREIGN_SPACE");
  });
});

describe("잠금 중 앱 내부 rename은 낡은 destination보다 출발 신원을 우선한다", () => {
  it.each(["다음 전달", "연속 rename 후 전달", "잠금 해제 후 연속 rename"])("%s: Export·ZIP·다음 위치는 A, B 출력은 보존", async (mode) => {
    await generate("a.json", "A_KNOWN");
    await generate("b.json", "B_STALE");
    await generate("c.json", "C_STALE");
    const original = JSON.parse(fs.readFileSync(join(root, GENERATION_MANIFEST_PATH), "utf8"));
    const aId = Object.keys(original.projects).find((id) => original.projects[id].fileName === "a.json")!;
    const lock = await holdRequestLock("ticket", "audit-rename");
    if (typeof lock === "string") throw new Error(lock);
    try {
      expect(await recordProjectRename("a.json", "b.json")).toContain("이름 변경은 완료");
      expect(await scanZip("b.json")).toContain("A_KNOWN");
      expect(await scanZip("b.json")).not.toContain("B_STALE");
      if (mode === "연속 rename 후 전달") expect(await recordProjectRename("b.json", "c.json")).toContain("이름 변경은 완료");
    } finally { lock.release(); }
    if (mode === "잠금 해제 후 연속 rename") expect(await recordProjectRename("b.json", "c.json")).toBeNull();
    const fileName = mode === "다음 전달" ? "b.json" : "c.json";
    expect(await scanZip(fileName)).toContain("A_KNOWN");
    expect(await scanZip(fileName)).not.toMatch(/B_STALE|C_STALE/);
    const located = await ensureGenerationTarget({ fileName, documentId: 1, pageId: "page1", projectPageIds: ["page1"] });
    expect(located).toMatchObject({ ok: true, target: { projectId: aId, root: "a/page1" } });
    const after = JSON.parse(fs.readFileSync(join(root, GENERATION_MANIFEST_PATH), "utf8"));
    expect(after.projects[aId].fileName).toBe(fileName);
    expect(Object.entries(after.projects).filter(([, record]) => (record as { fileName: string }).fileName === fileName)).toHaveLength(1);
    expect(fs.readFileSync(join(root, "generated/b/page1/pages/Home.tsx"), "utf8")).toContain("B_STALE");
    expect(fs.readFileSync(join(root, "generated/c/page1/pages/Home.tsx"), "utf8")).toContain("C_STALE");
  }, 15000);
});


describe("미기록 rename의 이름 재방문", () => {
  it.each([
    ["중간 이름 재방문", ["b.json", "c.json", "b.json"]],
    ["원래 이름 복귀 후 다시 이동", ["b.json", "c.json", "a.json", "b.json"]],
    ["원래 이름 복귀", ["b.json", "c.json", "a.json"]],
  ] as const)("%s: 원래 A의 ZIP·신원을 유지하고 실패한 복구를 재시도한다", async (_label, names) => {
    put(GENERATION_MANIFEST_PATH, JSON.stringify({ protocol: 2, entries: {}, projects: {
      original: { fileName: "a.json", outputDir: "a", createdAt: "2026-10-10T00:00:00Z" },
      staleB: { fileName: "b.json", outputDir: "b", createdAt: "2026-10-10T00:00:00Z" },
      staleC: { fileName: "c.json", outputDir: "c", createdAt: "2026-10-10T00:00:00Z" },
    } }));
    for (const name of ["a", "b", "c"]) put(`generated/${name}/page1/pages/Home.tsx`, `export default function Home(){return null} // OWNER_${name}`);
    const lock = await holdRequestLock("ticket", "audit-revisit");
    if (typeof lock === "string") throw new Error(lock);
    const last = names[names.length - 1];
    const owner = { fileName: last, documentId: 1, pageId: "page1", projectPageIds: ["page1"] };
    try {
      let from = "a.json";
      for (const to of names) {
        expect(await recordProjectRename(from, to)).toContain("이름 변경은 완료");
        expect(await scanZip(to)).toContain("OWNER_a");
        expect(await scanZip(to)).not.toMatch(/OWNER_b|OWNER_c/);
        from = to;
      }
      // 전달 복구도 잠금이 해제되기 전에는 실패하며 원래 신원을 잊지 않는다.
      expect(await ensureGenerationTarget(owner)).toMatchObject({ ok: false });
      expect(await scanZip(last)).toContain("OWNER_a");
    } finally { lock.release(); }
    expect(await ensureGenerationTarget(owner)).toMatchObject({ ok: true, target: { projectId: "original", root: "a/page1" } });
    expect(await ensureGenerationTarget(owner)).toMatchObject({ ok: true, target: { projectId: "original", root: "a/page1" } });
    const manifest = JSON.parse(fs.readFileSync(join(root, GENERATION_MANIFEST_PATH), "utf8"));
    expect(manifest.projects.original.fileName).toBe(last);
    // 이미 떠난 중간 이름 C를 가진 별도 문서는 A로 이어지면 안 된다.
    expect(await scanZip("c.json")).toContain("OWNER_c");
    expect(await scanZip("c.json")).not.toContain("OWNER_a");
    for (const name of ["b", "c"]) expect(fs.readFileSync(join(root, `generated/${name}/page1/pages/Home.tsx`), "utf8")).toContain(`OWNER_${name}`);
  }, 20000);
});
