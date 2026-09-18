/**
 * `.visual-spec/` 작업공간을 GUI에 열어주는 Vite 개발 서버 미들웨어의 알맹이 (이슈 #133).
 *
 * 경로 판단은 전부 `workspacePath.ts`(순수 함수)가 하고, "이 요청을 받아도 되는가"는
 * `requestOrigin.ts`(순수 함수)가 본다. 이 파일은 **그 두 판정을 받아 파일을 읽고 쓰는
 * 일만** 한다. 나누는 이유는 각 파일 상단에 적었다.
 * Vite 플러그인 껍데기는 `vite.config.ts`에 있다(테마 FOUC 플러그인과 같은 자리).
 *
 * ## 왜 개발 서버 미들웨어인가
 *
 * 브라우저 앱은 로컬 파일을 읽고 쓸 수단이 없다. File System Access API는
 * Safari·Firefox에서 못 쓰고 매번 사용자 제스처와 권한 승인이 필요하다. 반면 GUI는
 * 이미 Vite 개발 서버 위에서만 뜬다(`npx visual-spec` = 이 패키지의 vite 실행). 그
 * 서버에 좁은 라우트를 여는 편이 의존성도 늘지 않고 브라우저도 가리지 않는다.
 *
 * ## 라우트
 *
 * | 메서드 | 경로 | 하는 일 |
 * |---|---|---|
 * | GET | `/__vs/status` | 작업공간이 연결돼 있는지(루트 경로·폴더 목록) |
 * | GET | `/__vs/list/<폴더>` | 폴더 안 파일 이름 목록 |
 * | GET | `/__vs/file/<폴더>/<경로>` | 파일 내용 |
 * | PUT | `/__vs/file/<폴더>/<경로>` | 파일 쓰기(없으면 만들고, 있으면 덮어쓴다) |
 *
 * 이슈 #133이 제안한 `GET|PUT /__vs/spec/:name`·`PUT /__vs/asset/:name` 대신
 * 폴더를 경로의 첫 조각으로 받는 하나의 라우트로 합쳤다. 이유가 셋 있다.
 * (1) 스펙·에셋·생성코드마다 라우트를 따로 두면 **검증 코드가 세 벌**이 되고, 경로
 * 검증은 한 군데만 있어야 뚫리지 않는다. (2) `generated/`는 `pages/`·`components/`
 * 같은 하위 폴더를 쓰므로 `:name` 한 조각으로는 표현이 안 된다. (3) 목록 라우트가
 * 따로 필요하다 — Open이 "`.visual-spec/specs/`에서 고르기"가 되려면 뭐가 있는지
 * 먼저 알아야 하는데 이슈의 엔드포인트 목록에는 그게 없었다.
 */

import {
  createReadStream,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, extname, join, resolve } from "node:path";

import {
  WORKSPACE_ACCESSIBLE_DIRS,
  WORKSPACE_API_PREFIX,
  WORKSPACE_DIR_NAME,
  WORKSPACE_DIR_RULES,
  WORKSPACE_MARKER_HEADER,
  WORKSPACE_STATUS_ROUTE,
} from "./protocol";
import { checkRequestOrigin } from "./requestOrigin";
import {
  isInsideWorkspace,
  matchWorkspaceRoute,
  resolveWorkspaceDir,
  resolveWorkspaceFile,
  type RejectReason,
} from "./workspacePath";

/**
 * `bin/visual-spec.mjs`가 GUI에 작업공간 위치를 알려주는 환경 변수.
 *
 * **왜 환경 변수인가.** `runGui()`는 vite를 `cwd: PACKAGE_ROOT`로 띄운다(에디터
 * 소스가 사용자 프로젝트가 아니라 이 패키지 안에 있어서다). 그래서 사용자가 자기
 * 프로젝트에서 `npx visual-spec`을 실행해도 **vite가 보는 cwd는 이 패키지 루트**이고,
 * 사용자의 `.visual-spec/`은 **사용자의 cwd** 아래에 있다 — 둘이 다르다. vite 프로세스
 * 안에서는 사용자의 원래 cwd를 알 방법이 없으므로 CLI가 명시적으로 실어 보내야 한다.
 * CLI 인자로 넘기려면 vite의 인자 파싱을 건드려야 하고, 설정 파일에 적으면 사용자마다
 * 다른 값이 저장소 파일에 들어간다. 프로세스 경계를 넘기는 데는 환경 변수가 가장 얕다.
 */
export const WORKSPACE_ENV_VAR = "VISUAL_SPEC_WORKSPACE";

/** PUT 본문 상한. 이미지 한 장 기준으로 넉넉하되, 무한정 메모리에 담지는 않는다. */
const MAX_BODY_BYTES = 32 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

const STATUS_BY_REASON: Record<RejectReason, number> = {
  malformed: 400,
  traversal: 403,
  "forbidden-dir": 403,
  "forbidden-extension": 403,
};

/**
 * 작업공간 루트를 정한다.
 *
 * 1. `VISUAL_SPEC_WORKSPACE` — `npx visual-spec`으로 띄운 경우. 사용자의 cwd 기준 경로다
 * 2. 없으면 `<vite root>/.visual-spec` — **저장소를 클론해 `pnpm dev`로 띄운 개발자**가
 *    이 경우다. 그때는 vite의 cwd가 곧 이 저장소 루트라 여기에 만드는 게 맞다
 *    (`.gitignore`에 넣어 커밋에 섞이지 않게 했다)
 */
export function resolveWorkspaceRoot(
  viteRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env[WORKSPACE_ENV_VAR];
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
    return resolve(fromEnv);
  }
  return join(resolve(viteRoot), WORKSPACE_DIR_NAME);
}

/**
 * 화이트리스트 폴더를 미리 만들어 둔다(멱등적).
 *
 * `npx visual-spec init`을 안 거치고 바로 GUI를 띄운 경우에도 Save가 되어야 한다 —
 * "폴더가 없어서 저장이 안 된다"는 실패는 사용자가 고칠 방법을 짐작하기 어렵다.
 * `bin/visual-spec.mjs`의 `initWorkspace`가 만드는 다섯 폴더 중 GUI가 실제로 만지는
 * 셋만 만든다(`preview`·`runtime`은 이 미들웨어가 열지 않는다).
 */
export function ensureWorkspaceDirs(workspaceRoot: string): void {
  for (const dir of WORKSPACE_ACCESSIBLE_DIRS) {
    mkdirSync(join(workspaceRoot, dir), { recursive: true });
  }
}

/**
 * 심볼릭 링크까지 풀어낸 경로가 여전히 작업공간 안인지 본다.
 *
 * 문자열 검증(`resolveWorkspaceFile`)만으로는 못 잡는 구멍이다 —
 * `.visual-spec/specs`가 `/etc`를 가리키는 링크면 `specs/passwd.json`은 모든 문자열
 * 검사를 통과한다. 대상이 아직 없을 수 있으므로(= 새로 쓰는 파일) **존재하는 가장
 * 가까운 조상**까지 realpath로 풀고, 남은 조각은 그 위에 다시 붙여서 판단한다.
 */
export function realPathStaysInside(workspaceRoot: string, target: string): boolean {
  let rootReal: string;
  try {
    rootReal = realpathSync(workspaceRoot);
  } catch {
    // 루트 자체가 아직 없다 — 링크가 끼어들 자리도 없으니 문자열 판단으로 충분하다.
    rootReal = resolve(workspaceRoot);
  }

  const suffix: string[] = [];
  let current = resolve(target);
  for (;;) {
    try {
      const real = join(realpathSync(current), ...suffix);
      return isInsideWorkspace(rootReal, real);
    } catch {
      const parent = dirname(current);
      if (parent === current) return false; // 루트까지 올라갔는데 아무것도 없다
      suffix.unshift(basename(current));
      current = parent;
    }
  }
}

type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(payload));
  res.end(payload);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { ok: false, error: message });
}

/** PUT 본문을 모은다. 상한을 넘으면 즉시 끊는다(413). */
function readBody(req: IncomingMessage, onDone: (body: Buffer | null) => void): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;

  const finish = (body: Buffer | null) => {
    if (settled) return;
    settled = true;
    onDone(body);
  };

  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy();
      finish(null);
      return;
    }
    chunks.push(chunk);
  });
  req.on("error", () => finish(null));
  req.on("end", () => finish(Buffer.concat(chunks)));
}

function handleRead(res: ServerResponse, absolutePath: string): void {
  let stats;
  try {
    stats = statSync(absolutePath);
  } catch {
    sendError(res, 404, "파일이 없습니다.");
    return;
  }
  if (!stats.isFile()) {
    sendError(res, 404, "파일이 아닙니다.");
    return;
  }

  res.statusCode = 200;
  res.setHeader("content-type", CONTENT_TYPES[extname(absolutePath).toLowerCase()] ?? "text/plain; charset=utf-8");
  res.setHeader("content-length", stats.size);
  // SVG는 같은 오리진의 문서로 열릴 수 있다 — 스크립트·외부 요청을 원천 차단한다.
  res.setHeader("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'");
  createReadStream(absolutePath).pipe(res);
}

function handleWrite(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceRoot: string,
  absolutePath: string,
  relativePath: string,
): void {
  readBody(req, (body) => {
    if (body === null) {
      sendError(res, 413, `본문이 너무 큽니다(최대 ${MAX_BODY_BYTES}바이트).`);
      return;
    }
    try {
      mkdirSync(dirname(absolutePath), { recursive: true });
      // 폴더를 만든 뒤 한 번 더 본다 — 방금 만든 경로 중간에 링크가 끼어 있었다면
      // 여기서 걸린다(쓰기 직전이 마지막 관문이다).
      if (!realPathStaysInside(workspaceRoot, absolutePath)) {
        sendError(res, 403, "작업공간 밖으로 나가는 경로입니다.");
        return;
      }
      writeFileSync(absolutePath, body);
    } catch (error) {
      sendError(res, 500, error instanceof Error ? error.message : String(error));
      return;
    }
    sendJson(res, 200, { ok: true, path: relativePath, bytes: body.length });
  });
}

function handleList(res: ServerResponse, absolutePath: string, dir: string): void {
  let entries;
  try {
    entries = readdirSync(absolutePath, { withFileTypes: true });
  } catch {
    // 폴더가 아직 없으면 "빈 폴더"로 답한다 — 호출 측이 없음/빈 상태를 나눠
    // 처리할 이유가 없다(둘 다 "고를 게 없다"로 끝난다).
    sendJson(res, 200, { ok: true, dir, files: [] });
    return;
  }

  const allowed: readonly string[] = WORKSPACE_DIR_RULES[dir as keyof typeof WORKSPACE_DIR_RULES];
  const files = entries
    .filter((entry) => entry.isFile() && allowed.includes(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  sendJson(res, 200, { ok: true, dir, files });
}

/**
 * 작업공간 미들웨어를 만든다. `/__vs/` 아래 요청만 처리하고 나머지는 Vite에 넘긴다.
 *
 * `/__vs/` 아래인데 아는 라우트가 아니면 `next()`가 아니라 404로 끝낸다 — 그냥
 * 흘려보내면 Vite의 SPA 폴백이 `index.html`을 200으로 돌려주고, 클라이언트는 그걸
 * "응답이 왔다"고 오해한다.
 */
export function createWorkspaceMiddleware(workspaceRoot: string): Middleware {
  const root = resolve(workspaceRoot);

  return (req, res, next) => {
    const url = req.url ?? "";
    if (url !== WORKSPACE_API_PREFIX && !url.startsWith(`${WORKSPACE_API_PREFIX}/`)) {
      next();
      return;
    }

    // 이 아래는 전부 우리 응답이다 — 브라우저가 캐시하지 않게 하고, 정말 이
    // 미들웨어가 답했다는 표시를 남긴다(protocol.ts의 헤더 주석 참고).
    res.setHeader(WORKSPACE_MARKER_HEADER, "1");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");

    // 경로를 보기 **전에** 요청 출처부터 본다. Vite도 앞단에서 Host를 검사하지만
    // 그 검사는 설정에 따라 꺼지고, 교차 출처 쓰기를 실제로 막는 것은 서버가 아니라
    // 브라우저의 CORS다 — 근거와 실측 결과는 `requestOrigin.ts` 상단에 적었다.
    const rejected = checkRequestOrigin(req.headers.host, req.headers.origin);
    if (rejected !== null) {
      sendError(res, rejected.status, rejected.message);
      return;
    }

    const method = req.method ?? "GET";
    const path = url.split("?")[0].split("#")[0];

    if (path === WORKSPACE_STATUS_ROUTE) {
      if (method !== "GET" && method !== "HEAD") {
        sendError(res, 405, "GET만 받습니다.");
        return;
      }
      sendJson(res, 200, { ok: true, root, dirs: WORKSPACE_ACCESSIBLE_DIRS });
      return;
    }

    const route = matchWorkspaceRoute(path);

    if (route.kind === "list") {
      if (method !== "GET") {
        sendError(res, 405, "GET만 받습니다.");
        return;
      }
      const resolved = resolveWorkspaceDir(root, route.path);
      if (!resolved.ok) {
        sendError(res, STATUS_BY_REASON[resolved.reason], `거부: ${resolved.reason}`);
        return;
      }
      handleList(res, resolved.absolutePath, resolved.dir);
      return;
    }

    if (route.kind === "file") {
      if (method !== "GET" && method !== "PUT") {
        sendError(res, 405, "GET·PUT만 받습니다.");
        return;
      }
      const resolved = resolveWorkspaceFile(root, route.path);
      if (!resolved.ok) {
        sendError(res, STATUS_BY_REASON[resolved.reason], `거부: ${resolved.reason}`);
        return;
      }
      if (!realPathStaysInside(root, resolved.absolutePath)) {
        sendError(res, 403, "거부: traversal");
        return;
      }

      if (method === "GET") {
        handleRead(res, resolved.absolutePath);
      } else {
        handleWrite(req, res, root, resolved.absolutePath, resolved.relativePath);
      }
      return;
    }

    sendError(res, 404, "알 수 없는 작업공간 라우트입니다.");
  };
}
