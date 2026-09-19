/**
 * 작업공간 파일 경로 해석·검증 (이슈 #133).
 *
 * **React도 fs도 모르는 순수 함수만 둔다.** 이 저장소의 vitest environment가 `node`라
 * 순수 함수여야 테스트가 되고(`vitest.config.ts`), 무엇보다 이 검증이 미들웨어의
 * 유일한 방어선이라 파일 입출력과 섞어두면 단위 테스트로 증명할 수가 없다.
 * 실제 읽기·쓰기는 `workspaceServer.ts`가 이 함수들의 결과만 받아서 한다.
 *
 * ## 위협 모델
 *
 * 미들웨어는 브라우저가 보낸 URL을 파일 경로로 바꾼다. 개발용 로컬 서버라도
 * (1) 브라우저에서 연 아무 페이지나 `localhost:5173`으로 요청을 보낼 수 있고
 * (2) 그 요청이 곧 사용자 홈 디렉터리의 임의 파일 읽기/쓰기가 되면 안 된다.
 * 그래서 "작업공간 밖으로 한 발짝도 못 나간다"를 **문자열 단계에서** 못박는다:
 *
 * - `..`·`.` 세그먼트, 절대 경로, Windows 드라이브 문자(`C:`), UNC(`\\server`)
 * - URL 인코딩으로 숨긴 것들(`%2e%2e`, `%2f`, `%5c`) — 아래 "디코딩 순서" 참고
 * - NUL·제어문자(경로 잘림 공격), 빈 세그먼트
 * - 화이트리스트 밖 폴더·확장자
 * - 심볼릭 링크는 문자열로는 못 잡는다 → 호출 측이 realpath를 구해
 *   `isInsideWorkspace`로 한 번 더 확인한다(`workspaceServer.ts`)
 *
 * ## 디코딩 순서
 *
 * **자르고 나서 디코딩한다.** 반대로 하면 `a%2f..%2fb`가 디코딩 후 `a/../b`가 되어
 * 세그먼트 검사를 통과한 뒤 경로 결합 단계에서 되살아난다. 먼저 `/`로 자르고 각
 * 세그먼트를 디코딩한 다음, 디코딩 결과에 구분자나 `..`가 다시 나타나면 거부한다.
 */

import { extname, isAbsolute, join, relative, resolve } from "node:path";

import {
  WORKSPACE_DIR_RULES,
  WORKSPACE_FILE_ROUTE,
  WORKSPACE_LIST_ROUTE,
  isWorkspaceDir,
  type WorkspaceDir,
} from "./protocol";

/** 거부 사유. 미들웨어가 HTTP 상태 코드로 옮긴다. */
export type RejectReason =
  | "malformed" // 디코딩 실패·빈 경로·제어문자 등 요청 자체가 잘못됐다
  | "traversal" // 작업공간 밖으로 나가려는 시도
  | "forbidden-dir" // 화이트리스트 밖 폴더
  | "forbidden-extension"; // 폴더에 허용되지 않은 확장자

export type ResolvedFile = {
  ok: true;
  dir: WorkspaceDir;
  /** 작업공간 루트 기준 상대 경로. 항상 `/` 구분자 — 응답 JSON에 그대로 싣는다. */
  relativePath: string;
  /** 실제 파일 시스템 절대 경로(플랫폼 구분자). */
  absolutePath: string;
};

export type Rejected = { ok: false; reason: RejectReason };

export type ResolveResult = ResolvedFile | Rejected;

/** 세그먼트 하나에 들어올 수 없는 것들 — 디코딩 **후에** 본다. */
const FORBIDDEN_IN_SEGMENT = /[/\\:*?"<>|\u0000-\u001f\u007f]/;

/**
 * target이 workspaceRoot 안(또는 그 자신)인지 본다.
 *
 * `startsWith` 문자열 비교 대신 `path.relative`를 쓴다 — Windows에서 대소문자를
 * 무시해야 하고(`C:\Work`와 `c:\work`는 같은 폴더다), `/ws`와 `/ws-evil`처럼
 * 접두사만 같은 다른 폴더를 통과시키면 안 되기 때문이다. `relative`는 플랫폼별로
 * 이 두 가지를 이미 맞게 처리한다.
 */
export function isInsideWorkspace(workspaceRoot: string, target: string): boolean {
  const rel = relative(resolve(workspaceRoot), resolve(target));
  if (rel === "") return true; // 루트 자신
  return !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * URL 경로 한 조각을 디코딩하고 검사한다. 통과하지 못하면 null.
 *
 * `decodeURIComponent`는 `%zz` 같은 깨진 입력에 예외를 던진다 — 그걸 그대로 흘리면
 * 미들웨어가 500으로 죽으므로 여기서 잡아 null로 바꾼다.
 */
function decodeSegment(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (decoded === "" || decoded === "." || decoded === "..") return null;
  if (FORBIDDEN_IN_SEGMENT.test(decoded)) return null;
  // Windows는 이름 끝의 점·공백을 조용히 떼어낸다 — `foo.json.`이 `foo.json`이 되는
  // 식으로 확장자 검사를 우회할 수 있어 아예 받지 않는다.
  if (decoded !== decoded.trimEnd() || decoded.endsWith(".")) return null;
  return decoded;
}

/**
 * `<폴더>/<...하위 경로>` 형태의 URL 경로를 디코딩된 세그먼트 배열로 바꾼다.
 * 앞뒤 `/`는 무시하고, 중간의 빈 세그먼트(`a//b`)는 거부한다.
 */
function splitSegments(requestPath: string): string[] | null {
  const trimmed = requestPath.replace(/^\/+/, "");
  if (trimmed === "" || trimmed.endsWith("/")) return null;

  const segments: string[] = [];
  for (const raw of trimmed.split("/")) {
    const decoded = decodeSegment(raw);
    if (decoded === null) return null;
    segments.push(decoded);
  }
  return segments;
}

/**
 * 파일 라우트 뒤에 붙은 경로(`specs/home.json`, `generated/pages/Home.tsx`)를
 * 작업공간 안의 실제 경로로 해석한다.
 *
 * 읽기와 쓰기에 같은 규칙을 쓴다 — 읽기만 느슨하게 열어두면 `runtime/`이나
 * `preview/`에 놓인 값이 브라우저로 새 나가고, 그 구분을 기억해야 하는 자리가
 * 하나 더 생긴다. 지금 GUI가 필요로 하는 건 화이트리스트 세 폴더뿐이다.
 */
export function resolveWorkspaceFile(
  workspaceRoot: string,
  requestPath: string,
): ResolveResult {
  const segments = splitSegments(requestPath);
  if (segments === null) return { ok: false, reason: "malformed" };

  const [dir, ...rest] = segments;
  if (!isWorkspaceDir(dir)) return { ok: false, reason: "forbidden-dir" };
  if (rest.length === 0) return { ok: false, reason: "malformed" };

  const fileName = rest[rest.length - 1];
  const extension = extname(fileName).toLowerCase();
  const allowed: readonly string[] = WORKSPACE_DIR_RULES[dir];
  if (!allowed.includes(extension)) {
    return { ok: false, reason: "forbidden-extension" };
  }

  const relativePath = `${dir}/${rest.join("/")}`;
  const absolutePath = join(resolve(workspaceRoot), dir, ...rest);
  // 세그먼트 검사를 통과했으면 여기서 밖으로 나갈 수 없다. 그래도 한 번 더 본다 —
  // 위쪽 규칙 중 하나가 나중에 느슨해져도 이 마지막 관문은 남는다.
  if (!isInsideWorkspace(workspaceRoot, absolutePath)) {
    return { ok: false, reason: "traversal" };
  }

  return { ok: true, dir, relativePath, absolutePath };
}

export type ResolvedDir =
  | { ok: true; dir: WorkspaceDir; absolutePath: string }
  | Rejected;

/** 목록 라우트 뒤에 붙은 폴더 이름(`specs`)을 해석한다. 하위 폴더는 받지 않는다. */
export function resolveWorkspaceDir(
  workspaceRoot: string,
  requestPath: string,
): ResolvedDir {
  const segments = splitSegments(requestPath);
  if (segments === null) return { ok: false, reason: "malformed" };
  if (segments.length !== 1) return { ok: false, reason: "malformed" };

  const [dir] = segments;
  if (!isWorkspaceDir(dir)) return { ok: false, reason: "forbidden-dir" };

  const absolutePath = join(resolve(workspaceRoot), dir);
  if (!isInsideWorkspace(workspaceRoot, absolutePath)) {
    return { ok: false, reason: "traversal" };
  }
  return { ok: true, dir, absolutePath };
}

export type WorkspaceRoute =
  | { kind: "file"; path: string }
  | { kind: "list"; path: string }
  | { kind: "none" };

/**
 * 요청 URL이 작업공간 API의 어느 라우트인지 가른다(쿼리스트링·해시는 떼어낸다).
 *
 * 접두사만 같고 라우트가 아닌 `/__vs/...`는 `kind: "none"`이 아니라 호출 측에서
 * 404로 끝낸다 — 접두사 아래를 통째로 우리 것으로 보고 Vite에 넘기지 않는다.
 */
export function matchWorkspaceRoute(url: string): WorkspaceRoute {
  const path = url.split("?")[0].split("#")[0];
  if (path.startsWith(WORKSPACE_FILE_ROUTE)) {
    return { kind: "file", path: path.slice(WORKSPACE_FILE_ROUTE.length) };
  }
  if (path.startsWith(WORKSPACE_LIST_ROUTE)) {
    return { kind: "list", path: path.slice(WORKSPACE_LIST_ROUTE.length) };
  }
  return { kind: "none" };
}
