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
  WORKSPACE_FILE_ROUTE,
  WORKSPACE_LIST_ROUTE,
  WORKSPACE_MARKER_HEADER,
  WORKSPACE_STATUS_ROUTE,
  type WorkspaceDir,
} from "@/features/workspace/protocol";

/** 작업공간 루트 기준 상대 경로(`specs/home.json`)를 요청 URL로 바꾼다. */
export function workspaceFileUrl(relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .filter((segment) => segment !== "")
    .map(encodeURIComponent)
    .join("/");
  return `${WORKSPACE_FILE_ROUTE}${encoded}`;
}

/**
 * 정말 우리 미들웨어가 답했는지 본다.
 *
 * 상태 코드만 보면 안 된다 — SPA 폴백이 걸린 정적 서버는 모르는 경로에도 200과
 * `index.html`을 준다. 미들웨어만 붙이는 표시 헤더로 가른다.
 */
function isWorkspaceResponse(response: Response): boolean {
  return response.headers.get(WORKSPACE_MARKER_HEADER) === "1";
}

let available: boolean | undefined;

/**
 * 작업공간이 연결돼 있는지 한 번 물어보고 결과를 기억한다.
 *
 * `true`만 캐시한다 — 개발 서버가 잠깐 안 떠 있어서 실패한 경우까지 기억해 버리면
 * 새로고침 전에는 영영 폴백만 쓰게 된다.
 */
export async function isWorkspaceAvailable(): Promise<boolean> {
  if (available === true) return true;

  try {
    const response = await fetch(WORKSPACE_STATUS_ROUTE, { method: "GET" });
    available = response.ok && isWorkspaceResponse(response);
  } catch {
    available = false;
  }
  return available;
}

/** 폴더 안 파일 이름 목록. 작업공간이 없으면 null. */
export async function listWorkspaceFiles(dir: WorkspaceDir): Promise<string[] | null> {
  if (!(await isWorkspaceAvailable())) return null;

  try {
    const response = await fetch(`${WORKSPACE_LIST_ROUTE}${dir}`);
    if (!response.ok || !isWorkspaceResponse(response)) return null;
    const body: unknown = await response.json();
    const files = (body as { files?: unknown }).files;
    return Array.isArray(files) ? files.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return null;
  }
}

/** 텍스트 파일 내용. 없거나 읽을 수 없으면 null. */
export async function readWorkspaceTextFile(relativePath: string): Promise<string | null> {
  if (!(await isWorkspaceAvailable())) return null;

  try {
    const response = await fetch(workspaceFileUrl(relativePath));
    if (!response.ok || !isWorkspaceResponse(response)) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export type WriteResult = { ok: true; path: string } | { ok: false; error: string };

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
): Promise<WriteResult> {
  if (!(await isWorkspaceAvailable())) {
    return { ok: false, error: "작업공간에 연결돼 있지 않습니다." };
  }

  try {
    const response = await fetch(workspaceFileUrl(relativePath), {
      method: "PUT",
      headers: { "content-type": contentType },
      body,
    });
    if (!isWorkspaceResponse(response)) {
      return { ok: false, error: "작업공간 응답이 아닙니다." };
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (payload as { error?: unknown } | null)?.error;
      return { ok: false, error: typeof message === "string" ? message : `HTTP ${response.status}` };
    }
    const path = (payload as { path?: unknown } | null)?.path;
    return { ok: true, path: typeof path === "string" ? path : relativePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
