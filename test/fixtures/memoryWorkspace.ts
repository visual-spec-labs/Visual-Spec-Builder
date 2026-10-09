/**
 * 메모리 작업공간 — `ui/workspaceClient.ts`의 테스트 대역 (이슈 #284, #282).
 *
 * 실제 서버(`workspace/workspaceServer.ts`)의 규칙 중 생성 출력 확정이 기대는 것만 흉내 낸다:
 * 파일별 쓰기, `generated/`·`backups/`의 기대 버전 비교(버전 = 바이트의 SHA-256), 백업은 새 파일로만,
 * 기대 버전이 맞을 때만 지우기. 서버 쪽 규칙 자체는 `workspace-middleware.test.ts`가 진짜 서버로 본다.
 *
 * 내용은 쓴 그대로 둔다 — 문자열은 문자열로, 바이트는 바이트로. 테스트가 바이트를 그대로 비교할 수
 * 있게 하려는 것이다(BOM 같은 바이트는 문자열로 풀면 사라진다).
 */

import { sha256Hex } from "@/features/editor/export/contentHash";

export interface MemoryWorkspace {
  files: Map<string, string | Uint8Array>;
  offline: boolean;
  /** 쓰기 직전(서버가 기대 버전을 비교하기 직전) 호출 — 동시 수정 흉내. */
  beforeWrite: ((path: string) => void) | null;
  /** 오류 문구를 돌려주면 그 쓰기를 실패시킨다(디스크 오류 흉내). */
  failWrite: ((path: string) => string | null) | null;
  /** 쓰기·지우기 순서 기록. */
  log: string[];
  beforeRead?: (path: string) => void | Promise<void>;
  afterWrite?: (path: string) => string | null | Promise<string | null>;
}

export function createMemoryWorkspace(): MemoryWorkspace {
  return { files: new Map(), offline: false, beforeWrite: null, failWrite: null, log: [] };
}

export function resetMemoryWorkspace(workspace: MemoryWorkspace): void {
  workspace.files.clear();
  workspace.offline = false;
  workspace.beforeWrite = null;
  workspace.failWrite = null;
  workspace.log.length = 0;
  workspace.beforeRead = undefined;
  workspace.afterWrite = undefined;
}

export function bytesOf(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

/** 저장된 내용을 텍스트로 읽는다(테스트 단언용). BOM도 그대로 남긴다. */
export function textOf(workspace: MemoryWorkspace, path: string): string | undefined {
  const value = workspace.files.get(path);
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : new TextDecoder("utf-8", { ignoreBOM: true }).decode(value);
}

export function revisionOf(workspace: MemoryWorkspace, path: string): string {
  const value = workspace.files.get(path);
  return value === undefined ? "missing" : sha256Hex(bytesOf(value));
}

function tracked(path: string): boolean {
  return path.startsWith("generated/") || path.startsWith("backups/");
}

async function bodyOf(body: unknown): Promise<string | Uint8Array> {
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body.slice(0));
  if (body instanceof Uint8Array) return body.slice();
  throw new Error("메모리 작업공간이 모르는 본문 형식입니다");
}

export function memoryWorkspaceClient(workspace: MemoryWorkspace) {
  function list(dir: string, options: { recursive?: boolean } = {}) {
    if (workspace.offline) return null;
    const prefix = `${dir}/`;
    return [...workspace.files.keys()]
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
      .filter((path) => options.recursive === true || !path.includes("/"));
  }
  return {
    isWorkspaceAvailable: async () => !workspace.offline,
    listWorkspaceFiles: async (dir: string, options?: { recursive?: boolean }) => list(dir, options),
    readWorkspaceTextFile: async (path: string) => (workspace.offline ? null : textOf(workspace, path) ?? null),
    readWorkspaceTextFileStrict: async (path: string) => {
      await workspace.beforeRead?.(path);
      return workspace.offline ? { ok: false } : { ok: true, text: textOf(workspace, path) ?? null };
    },
    readWorkspaceBinaryFile: async () => null,
    readWorkspaceFileSnapshot: async (path: string) => {
      await workspace.beforeRead?.(path);
      if (workspace.offline) return { ok: false };
      const value = workspace.files.get(path);
      if (value === undefined) return { ok: true, snapshot: null };
      const bytes = bytesOf(value).slice();
      return { ok: true, snapshot: { bytes, revision: sha256Hex(bytes) } };
    },
    writeWorkspaceFile: async (path: string, body: unknown, _contentType?: string, expectedRevision?: string) => {
      if (workspace.offline) return { ok: false, error: "fetch failed" };
      workspace.beforeWrite?.(path);
      const failure = workspace.failWrite?.(path) ?? null;
      if (failure !== null) return { ok: false, error: failure, status: 500 };
      if (path.startsWith("backups/") && expectedRevision !== "missing") {
        return { ok: false, error: "백업은 새 파일로만 씁니다.", status: expectedRevision === undefined ? 428 : 409 };
      }
      if (tracked(path) && expectedRevision !== undefined && expectedRevision !== revisionOf(workspace, path)) {
        return { ok: false, error: "확인한 뒤 파일이 바뀌었습니다. 쓰지 않았습니다.", status: 409 };
      }
      const content = await bodyOf(body);
      workspace.files.set(path, content);
      workspace.log.push(`PUT ${path}`);
      const lost = await workspace.afterWrite?.(path);
      if (lost) return { ok: false, error: lost };
      return { ok: true, path, revision: tracked(path) ? sha256Hex(bytesOf(content)) : undefined };
    },
    deleteWorkspaceFile: async (path: string, expectedRevision: string) => {
      if (workspace.offline) return { ok: false, error: "fetch failed" };
      workspace.beforeWrite?.(path);
      if (!path.startsWith("generated/")) return { ok: false, error: "생성 파일만 지울 수 있습니다.", status: 405 };
      if (expectedRevision !== revisionOf(workspace, path)) {
        return { ok: false, error: "확인한 뒤 파일이 바뀌었거나 없어졌습니다.", status: 409 };
      }
      workspace.files.delete(path);
      workspace.log.push(`DELETE ${path}`);
      return { ok: true, path };
    },
  };
}
