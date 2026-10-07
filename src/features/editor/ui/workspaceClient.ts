/**
 * 브라우저에서 `.visual-spec/` 작업공간을 읽고 쓰는 얇은 클라이언트 (이슈 #133).
 *
 * 상대편은 Vite 개발 서버 미들웨어다(`src/features/workspace/workspaceServer.ts` —
 * 라우트 목록과 설계 근거가 거기 있다). 경로·메서드 문자열은 양쪽이 같은 상수를
 * 쓴다(`workspace/protocol.ts`).
 *
 * ## 실패하면 조용히 "없다"고 답한다
 *
 * 작업공간이 **항상 있는 게 아니다.** `vite build` 결과물이나 정적 호스팅에는 파일을
 * 읽고 쓸 서버가 없다. 그래서 이 모듈의 모든 함수는 예외를 던지는 대신 `null`을
 * 돌려주고, 호출 측(Open/Save/Import)이 예전 브라우저 방식(파일 다이얼로그·다운로드·
 * data URI)으로 되돌아간다. 기능이 사라지는 게 아니라 경로가 하나 줄어드는 것이다.
 */

import {
  WORKSPACE_REVISION_HEADER,
  WORKSPACE_EXPECTED_REVISION_HEADER,
  WORKSPACE_LIST_RECURSIVE_PARAM,
  WORKSPACE_LIST_METADATA_PARAM,
  type WorkspaceFileEntry,
  WORKSPACE_LIST_ROUTE,
  WORKSPACE_MARKER_HEADER,
  WORKSPACE_STATUS_ROUTE,
  workspaceFileUrl,
  type WorkspaceDir,
  WORKSPACE_REQUEST_LOCK_ROUTE,
  WORKSPACE_REQUEST_OWNER_HEADER,
  WORKSPACE_REQUEST_LOCK_RENEW_PARAM,
  type RequestLockKind,
} from "@/features/workspace/protocol";

/**
 * 정말 우리 미들웨어가 답했는지 본다.
 *
 * 상태 코드만 보면 안 된다 — SPA 폴백이 걸린 정적 서버는 모르는 경로에도 200과
 * `index.html`을 준다. 미들웨어만 붙이는 표시 헤더로 가른다.
 */
function isWorkspaceResponse(response: Response): boolean {
  return response.headers.get(WORKSPACE_MARKER_HEADER) === "1";
}

/**
 * `/__vs/status` 응답. `isWorkspaceAvailable`·`getWorkspaceRoot` 둘이 같은
 * 캐시 하나를 쓴다(#283 리뷰 대응) — 따로 캐시 변수 두 개를 두면 한쪽만 갱신
 * 하는 수정이 들어왔을 때 서로 어긋날 수 있다. `ok`인 결과만 캐시한다 —
 * 개발 서버가 잠깐 안 떠 있어서 실패한 경우까지 기억해 버리면 새로고침
 * 전에는 영영 폴백만 쓰게 된다.
 */
let cachedStatus: { ok: true; root: string | null } | undefined;

/** `/__vs/status`를 한 번 묻는다. 실패해도 예외를 던지지 않는다. */
async function fetchWorkspaceStatus(signal?: AbortSignal): Promise<{ ok: boolean; root: string | null }> {
  if (cachedStatus !== undefined) return cachedStatus;

  try {
    const response = await fetch(WORKSPACE_STATUS_ROUTE, { method: "GET", signal });
    if (!response.ok || !isWorkspaceResponse(response)) return { ok: false, root: null };
    const body: unknown = await response.json();
    const root =
      typeof body === "object" && body !== null && typeof (body as { root?: unknown }).root === "string"
        ? (body as { root: string }).root
        : null;
    cachedStatus = { ok: true, root };
    return cachedStatus;
  } catch {
    return { ok: false, root: null };
  }
}

/** 작업공간이 연결돼 있는지 한 번 물어보고 결과를 기억한다. */
export async function isWorkspaceAvailable(signal?: AbortSignal): Promise<boolean> {
  return (await fetchWorkspaceStatus(signal)).ok;
}

/** 작업공간의 절대 경로. 작업공간이 없거나 서버가 안 돌려줬으면 `null`(#283). */
export async function getWorkspaceRoot(): Promise<string | null> {
  return (await fetchWorkspaceStatus()).root;
}

/**
 * 폴더 안 파일 이름 목록. 작업공간이 없으면 null.
 *
 * `recursive`를 주면 하위 폴더까지 훑고 이름 대신 폴더 기준 상대 경로를 준다
 * (`pages/Home.tsx`, 이슈 #157). `generated/`처럼 하위 폴더를 쓰는 곳에만 쓴다 —
 * 기본값이 한 단계인 이유는 `protocol.ts`의 상수 주석에 적었다.
 */
export async function listWorkspaceFiles(
  dir: WorkspaceDir,
  options: { recursive?: boolean; signal?: AbortSignal } = {},
): Promise<string[] | null> {
  if (!(await isWorkspaceAvailable())) return null;

  const query = options.recursive === true ? `?${WORKSPACE_LIST_RECURSIVE_PARAM}=1` : "";
  try {
    const response = await fetch(`${WORKSPACE_LIST_ROUTE}${dir}${query}`, { signal: options.signal });
    if (!response.ok || !isWorkspaceResponse(response)) return null;
    const body: unknown = await response.json();
    const files = (body as { files?: unknown }).files;
    return Array.isArray(files) ? files.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return null;
  }
}

/** 홈 전용 메타데이터 목록. 기존 Open/Export 목록 계약은 바꾸지 않는다. */
export async function listWorkspaceFileEntries(dir: WorkspaceDir): Promise<WorkspaceFileEntry[] | null> {
  if (!(await isWorkspaceAvailable())) return null;
  try {
    const response = await fetch(`${WORKSPACE_LIST_ROUTE}${dir}?${WORKSPACE_LIST_METADATA_PARAM}=1`);
    if (!response.ok || !isWorkspaceResponse(response)) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return null;
    const entries = (body as { entries?: unknown }).entries;
    if (!Array.isArray(entries)) return null;
    return entries.filter((entry): entry is WorkspaceFileEntry =>
      typeof entry === "object" && entry !== null &&
      typeof entry.name === "string" && typeof entry.mtimeMs === "number" &&
      Number.isFinite(entry.mtimeMs),
    );
  } catch {
    return null;
  }
}

/** 텍스트 파일 내용. 없거나 읽을 수 없으면 null. */
export async function readWorkspaceTextFile(relativePath: string, signal?: AbortSignal): Promise<string | null> {
  if (!(await isWorkspaceAvailable())) return null;

  try {
    const response = await fetch(workspaceFileUrl(relativePath), { signal });
    if (!response.ok || !isWorkspaceResponse(response)) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * `readWorkspaceTextFile`과 같지만 **없음과 읽기 실패를 구분한다**. 없으면 `{ ok: true, text: null }`,
 * 네트워크·HTTP 오류면 `{ ok: false }`. 실패를 없음으로 읽으면 판단이 틀어지는 곳(에이전트 편집
 * 연결 복원, #279)에서 쓴다.
 */
export async function readWorkspaceTextFileStrict(
  relativePath: string, signal?: AbortSignal,
): Promise<{ ok: true; text: string | null } | { ok: false }> {
  if (!(await isWorkspaceAvailable())) return { ok: false };
  try {
    const response = await fetch(workspaceFileUrl(relativePath), { signal });
    if (!isWorkspaceResponse(response)) return { ok: false };
    if (response.status === 404) return { ok: true, text: null };
    if (!response.ok) return { ok: false };
    return { ok: true, text: await response.text() };
  } catch {
    return { ok: false };
  }
}

/**
 * 바이너리 파일 내용. 없거나 읽을 수 없으면 null (이슈 #157).
 *
 * Export가 `assets/`의 이미지를 ZIP에 그대로 담을 때 쓴다 — `readWorkspaceTextFile`로
 * 읽으면 UTF-8로 해석되며 바이트가 망가진다.
 */
export async function readWorkspaceBinaryFile(
  relativePath: string,
): Promise<Uint8Array | null> {
  if (!(await isWorkspaceAvailable())) return null;

  try {
    const response = await fetch(workspaceFileUrl(relativePath));
    if (!response.ok || !isWorkspaceResponse(response)) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** The token belongs to these exact bytes, not a later Save-time read. */
export async function readWorkspaceSpecSnapshot(relativePath: string): Promise<{ text: string; revision: string } | null> {
  if (!(await isWorkspaceAvailable())) return null;
  try {
    const response = await fetch(workspaceFileUrl(relativePath));
    const revision = response.headers.get(WORKSPACE_REVISION_HEADER);
    if (!response.ok || !isWorkspaceResponse(response) || !revision) return null;
    return { text: await response.text(), revision };
  } catch { return null; }
}

export type WriteResult = { ok: true; path: string; revision?: string } | { ok: false; error: string; status?: number };

/**
 * 파일을 쓴다. 성공하면 서버가 확정한 상대 경로를 돌려준다.
 *
 * 실패 사유를 문자열로 함께 준다 — 호출 측이 alert로 그대로 보여준다. "저장이
 * 안 됐다"만 알려주고 왜인지 안 알려주면 사용자가 할 수 있는 게 없다.
 */
export async function writeWorkspaceFile(
  relativePath: string,
  body: BodyInit,
  contentType: string,
  expectedRevision?: string,
  /** 잠금으로 보호되는 요청 파일(#273)에 쓸 때 잠금 주인. */
  requestOwner?: string,
  /** 취소(시간 제한) 신호. 응답 없는 요청이 호출 측을 무기한 붙잡지 않게 한다(#279). */
  signal?: AbortSignal,
): Promise<WriteResult> {
  if (!(await isWorkspaceAvailable())) {
    return { ok: false, error: "작업공간에 연결돼 있지 않습니다." };
  }

  try {
    const response = await fetch(workspaceFileUrl(relativePath), {
      method: "PUT",
      headers: { "content-type": contentType,
        ...(expectedRevision === undefined ? {} : { [WORKSPACE_EXPECTED_REVISION_HEADER]: expectedRevision }),
        ...(requestOwner === undefined ? {} : { [WORKSPACE_REQUEST_OWNER_HEADER]: requestOwner }) },
      body,
      signal,
    });
    if (!isWorkspaceResponse(response)) {
      return { ok: false, error: "작업공간 응답이 아닙니다." };
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (payload as { error?: unknown } | null)?.error;
      return { ok: false, error: typeof message === "string" ? message : `HTTP ${response.status}`, status: response.status };
    }
    const path = (payload as { path?: unknown } | null)?.path;
    return { ok: true, path: typeof path === "string" ? path : relativePath,
      revision: response.headers.get(WORKSPACE_REVISION_HEADER) ?? undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export type RequestLockOutcome = "acquired" | "busy" | "unavailable";

/**
 * 요청 파일 잠금을 잡는다. `renew`면 쥐고 있던 잠금을 연장한다(#273). 다른 탭의
 * 요청이 아직 기다리는 중이거나, 연장하려는데 그 사이 다른 탭이 가져갔으면 `busy`다.
 * 작업공간 미들웨어가 아니면 `unavailable`이다.
 */
export async function acquireRequestLock(
  kind: RequestLockKind,
  owner: string,
  renew = false,
  signal?: AbortSignal,
): Promise<RequestLockOutcome> {
  try {
    const query = renew ? `?${WORKSPACE_REQUEST_LOCK_RENEW_PARAM}=1` : "";
    const response = await fetch(`${WORKSPACE_REQUEST_LOCK_ROUTE}${kind}${query}`, {
      method: "POST",
      headers: { [WORKSPACE_REQUEST_OWNER_HEADER]: owner },
      signal,
    });
    if (!isWorkspaceResponse(response)) return "unavailable";
    if (response.status === 409) return "busy";
    return response.ok ? "acquired" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/**
 * 잠금을 푼다. 실패해도 기한이 지나면 풀리므로 결과를 돌려주지 않는다. `keepalive`는
 * 탭을 닫는 중(pagehide)에도 요청이 끝까지 가게 한다.
 */
/** 해제 요청이 끝나면 풀리는 Promise를 돌려준다(실패해도 풀린다). */
export function releaseRequestLock(kind: RequestLockKind, owner: string, keepalive = false): Promise<void> {
  return fetch(`${WORKSPACE_REQUEST_LOCK_ROUTE}${kind}`, {
    method: "DELETE",
    headers: { [WORKSPACE_REQUEST_OWNER_HEADER]: owner },
    keepalive,
  }).then(() => undefined, () => undefined);
}

