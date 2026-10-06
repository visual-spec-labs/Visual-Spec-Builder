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
  readFileSync,
  openSync,
  closeSync,
  mkdirSync,
  lstatSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { withWorkspaceMutation } from "./workspaceMutation";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname, extname, join, resolve } from "node:path";

import {
  WORKSPACE_REVISION_HEADER,
  WORKSPACE_EXPECTED_REVISION_HEADER,
  WORKSPACE_MISSING_REVISION,
  WORKSPACE_ACCESSIBLE_DIRS,
  WORKSPACE_API_PREFIX,
  WORKSPACE_DIR_NAME,
  WORKSPACE_DIR_RULES,
  WORKSPACE_LIST_RECURSIVE_PARAM,
  WORKSPACE_LIST_METADATA_PARAM,
  type WorkspaceFileEntry,
  WORKSPACE_MARKER_HEADER,
  WORKSPACE_STATUS_ROUTE,
  WORKSPACE_RENAME_ROUTE,
  WORKSPACE_REQUEST_LOCK_ROUTE,
  WORKSPACE_REQUEST_OWNER_HEADER,
  REQUEST_LOCK_FILES,
  isRequestLockKind,
} from "./protocol";
import { migrateToV03 } from "../editor/schema/migrate";
import { validateProjectSpec, validateVisualSpec } from "../editor/schema/validate";
import { projectFileName } from "./projectName";
import { checkRequestOrigin } from "./requestOrigin";
import { acquireRequestLock, holdsRequestLock, releaseRequestLock } from "./requestLock";
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
 * 넷만 만든다(`preview`는 이 미들웨어가 열지 않는다). `runtime`은 #155에서
 * 자연어 요청/응답 교환소로 열렸다.
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

/** 임시 파일 이름을 겹치지 않게 하는 카운터. 이 프로세스 안에서만 의미가 있다. */
let tempFileCounter = 0;

/**
 * 파일을 **갈아 끼운다** — 기존 파일을 열어 자르지 않는다 (PR #145 리뷰, wook3964).
 *
 * `writeFileSync(대상, ...)`는 대상 파일을 먼저 0바이트로 만든 뒤 내용을 채운다.
 * 그 사이에 디스크가 차거나 I/O 오류가 나거나 프로세스가 죽으면 **이미 잘 저장돼
 * 있던 스펙이 빈 파일·반쪽 파일로 남는다.** Save 한 번이 원본을 날리는 셈이다.
 *
 * 그래서 같은 디렉터리의 임시 파일에 먼저 **끝까지** 쓰고, 성공했을 때만 rename으로
 * 이름을 옮긴다. 쓰다가 실패하면 대상 파일은 손도 대지 않은 상태 그대로다.
 * 같은 디렉터리여야 하는 이유는 둘이다 — 파일 시스템이 다르면 rename이 복사+삭제로
 * 풀려 원자성이 사라지고(EXDEV), 대상 폴더는 이미 `resolveWorkspaceFile`·
 * `realPathStaysInside`를 통과한 자리라 임시 파일도 작업공간 밖으로 나가지 않는다.
 *
 * 이름 앞에 `.`을 붙이고 끝에 `.tmp`를 달아 둔다 — 목록 라우트는 폴더별 허용 확장자만
 * 내보내므로(`handleList`) 쓰는 도중의 임시 파일이 Open 목록에 튀어나오지 않는다.
 *
 * `fsync`까지는 하지 않는다. 그러면 OS 단위 crash·정전까지 견디지만, 여기서 막으려는
 * 것은 "쓰다가 실패했을 때 원본을 잃는 것"이고 그건 rename만으로 해결된다. 개발 서버
 * 저장 경로마다 fsync를 걸면 저장이 눈에 띄게 느려진다.
 */
function writeFileAtomic(absolutePath: string, body: Buffer): void {
  tempFileCounter += 1;
  const tempPath = join(
    dirname(absolutePath),
    `.${basename(absolutePath)}.${process.pid}-${tempFileCounter}.tmp`,
  );

  try {
    writeFileSync(tempPath, body);
    renameSync(tempPath, absolutePath);
  } catch (error) {
    // 실패한 임시 파일은 치운다. 이것마저 실패하면(이미 없다 등) 더 할 일이 없다 —
    // 원래의 실패 사유를 덮어쓰지 않고 그대로 올려보내는 쪽이 중요하다.
    try {
      unlinkSync(tempPath);
    } catch {
      /* 치울 게 없으면 그만이다. */
    }
    throw error;
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

/** No-overwrite publication followed by source removal. All failure paths retain a complete copy. */
function handleRename(req: IncomingMessage, res: ServerResponse, root: string): void {
  readBody(req, (body) => {
    if (body === null) { sendError(res, 413, "본문이 너무 큽니다."); return; }
    let input: { fileName?: unknown; name?: unknown; expectedText?: unknown };
    try { input = JSON.parse(body.toString()) as typeof input; }
    catch { sendError(res, 400, "잘못된 요청입니다."); return; }
    if (!input || typeof input.fileName !== "string" || /[\\/]/.test(input.fileName) ||
      typeof input.name !== "string" || typeof input.expectedText !== "string") {
      sendError(res, 400, "잘못된 이름 변경 요청입니다."); return;
    }
    try { encodeURIComponent(input.fileName); } catch { sendError(res, 400, "잘못된 파일명 인코딩입니다."); return; }
    const fileName = projectFileName(input.name);
    if (fileName === null) { sendError(res, 400, "파일명으로 사용할 수 없는 이름입니다."); return; }
    const from = resolveWorkspaceFile(root, `specs/${encodeURIComponent(input.fileName)}`);
    const to = resolveWorkspaceFile(root, `specs/${encodeURIComponent(fileName)}`);
    if (!from.ok || !to.ok || !realPathStaysInside(root, from.absolutePath) ||
      !realPathStaysInside(root, to.absolutePath)) {
      sendError(res, 403, "안전하지 않은 저장 경로입니다."); return;
    }
    void withWorkspaceMutation([from.absolutePath, to.absolutePath], () => {
      try {
        if (!lstatSync(from.absolutePath).isFile()) { sendError(res, 400, "일반 파일만 변경할 수 있습니다."); return; }
        const original = readFileSync(from.absolutePath, "utf8");
        if (original !== input.expectedText) { sendError(res, 409, "다른 곳에서 파일이 변경되었습니다. 목록을 새로 불러온 뒤 다시 시도하세요."); return; }
        const spec: unknown = JSON.parse(original);
        const migrated = migrateToV03(spec);
        const isProject = typeof spec === "object" && spec !== null && "pages" in spec;
        const validation = isProject ? validateProjectSpec(migrated) : validateVisualSpec(migrated);
        if (!validation.valid || typeof spec !== "object" || spec === null) {
          sendError(res, 400, "유효한 프로젝트 파일이 아닙니다."); return;
        }
        // Preserve the source document version and all fields. A legacy single-screen
        // document derives its project display name from screen.name.
        const renamed = JSON.stringify(isProject ? { ...spec, name: input.name } :
          { ...spec, screen: { ...(spec as { screen: object }).screen, name: input.name } }, null, 2);
        if (from.absolutePath === to.absolutePath) {
          writeFileAtomic(from.absolutePath, Buffer.from(renamed));
        } else {
          // Case-insensitive collision policy also protects projects moved between OSes.
          if (readdirSync(dirname(to.absolutePath)).some((entry) => entry.toLowerCase() === fileName.toLowerCase())) {
            sendError(res, 409, "같은 이름의 파일이 있습니다. 다른 이름을 입력하세요."); return;
          }
          // wx is the final collision guard: a file arriving after the listing is never overwritten.
          let created = false;
          try {
            const fd = openSync(to.absolutePath, "wx");
            created = true;
            try { writeFileSync(fd, renamed); } finally { closeSync(fd); }
            unlinkSync(from.absolutePath);
          } catch (error) {
            if (created) {
              try { unlinkSync(to.absolutePath); } catch { /* Keep original plus recovery copy. */ }
            }
            throw error;
          }
        }
        res.setHeader(WORKSPACE_REVISION_HEADER, workspaceRevision(Buffer.from(renamed)));
        sendJson(res, 200, { ok: true, path: to.relativePath });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        sendError(res, code === "EEXIST" ? 409 : 500,
          code === "EEXIST" ? "같은 이름의 파일이 있습니다." : `이름 변경에 실패했습니다. 원본 파일을 확인하세요: ${error instanceof Error ? error.message : String(error)}`);
      }
    }).catch(() => sendError(res, 500, "이름 변경 잠금을 확인할 수 없습니다."));
  });
}

export function workspaceRevision(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

function handleRead(res: ServerResponse, absolutePath: string, isSpec: boolean): void {
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
  if (isSpec) {
    // Hash and send the same snapshot; streaming a later file could mismatch its token.
    try {
      const body = readFileSync(absolutePath);
      res.setHeader(WORKSPACE_REVISION_HEADER, workspaceRevision(body));
      res.setHeader("content-length", body.length);
      res.end(body);
    } catch { sendError(res, 404, "파일을 읽지 못했습니다."); }
  } else createReadStream(absolutePath).pipe(res);
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
    void withWorkspaceMutation([absolutePath], () => {
    try {
      mkdirSync(dirname(absolutePath), { recursive: true });
      // 폴더를 만든 뒤 한 번 더 본다 — 방금 만든 경로 중간에 링크가 끼어 있었다면
      // 여기서 걸린다(쓰기 직전이 마지막 관문이다).
      if (!realPathStaysInside(workspaceRoot, absolutePath)) {
        sendError(res, 403, "작업공간 밖으로 나가는 경로입니다.");
        return;
      }
      if (relativePath.startsWith("specs/")) {
        const expected = req.headers[WORKSPACE_EXPECTED_REVISION_HEADER];
        if (typeof expected !== "string" || !/^(missing|[a-f0-9]{64})$/.test(expected)) {
          sendError(res, 428, "파일을 다시 열어 저장 기준을 확인하세요. 현재 초안은 별도로 보존하세요.");
          return;
        }
        // Case-only aliases must not create a second project on case-sensitive hosts.
        const aliases = readdirSync(dirname(absolutePath)).filter((name) =>
          name.toLowerCase() === basename(absolutePath).toLowerCase());
        if (aliases.some((name) => name !== basename(absolutePath))) {
          sendError(res, 409, "대소문자가 다른 같은 파일명이 이미 있습니다."); return;
        }
        let actual = WORKSPACE_MISSING_REVISION;
        try { actual = workspaceRevision(readFileSync(absolutePath)); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        if (expected !== actual) {
          sendError(res, 409, "다른 화면에서 파일을 변경하거나 이동했습니다. 초안을 별도로 보존한 뒤 최신 파일을 다시 여세요.");
          return;
        }
      }
      writeFileAtomic(absolutePath, body);
      if (relativePath.startsWith("specs/")) res.setHeader(WORKSPACE_REVISION_HEADER, workspaceRevision(body));
    } catch (error) {
      sendError(res, 500, error instanceof Error ? error.message : String(error));
      return;
    }
    sendJson(res, 200, { ok: true, path: relativePath, bytes: body.length });
    }).catch((error: unknown) => sendError(res, 500, String(error)));
  });
}

/**
 * 재귀 목록의 한계 (이슈 #157).
 *
 * `generated/`는 스킬이 정한 `pages/`·`components/` 두 단계면 충분하지만, 사용자가
 * 손으로 넣은 폴더가 얼마나 깊을지는 모른다. 응답 하나가 무한정 커지지 않게 깊이와
 * 개수에 상한을 둔다 — 넘치면 조용히 자른다. 목록은 Export가 "무엇이 있나"를 보는
 * 수단이지 파일 시스템 탐색기가 아니다.
 */
const MAX_LIST_DEPTH = 8;
const MAX_LIST_ENTRIES = 2000;

/**
 * 폴더를 훑어 허용 확장자 파일의 **상대 경로**를 모은다(`pages/Home.tsx`).
 *
 * **심볼릭 링크는 따라가지 않는다.** `withFileTypes`가 주는 `Dirent`는 링크에 대해
 * `isFile()`·`isDirectory()`가 둘 다 false라(`isSymbolicLink()`만 true) 링크는 파일이든
 * 폴더든 애초에 걸러진다 — 재귀 고리가 생길 자리도, 링크로 작업공간 밖 이름을
 * 흘릴 자리도 없다. 그럼에도 내려가기 전에 `realPathStaysInside`를 한 번 더 부른다:
 * 이 판단이 `Dirent`의 성질에 기대고 있다는 사실이 나중에 잊히더라도 마지막 관문은
 * 남아야 한다(PR #145 리뷰에서 목록 라우트가 링크 경계를 안 보던 것이 실제 취약점이었다).
 */
function collectFilesRecursively(
  workspaceRoot: string,
  absoluteDir: string,
  allowed: readonly string[],
  prefix: string,
  depth: number,
  out: string[],
): void {
  if (depth > MAX_LIST_DEPTH || out.length >= MAX_LIST_ENTRIES) return;

  let entries;
  try {
    entries = readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (out.length >= MAX_LIST_ENTRIES) return;

    if (entry.isFile()) {
      if (allowed.includes(extname(entry.name).toLowerCase())) {
        out.push(`${prefix}${entry.name}`);
      }
      continue;
    }
    if (!entry.isDirectory()) continue;

    const child = join(absoluteDir, entry.name);
    if (!realPathStaysInside(workspaceRoot, child)) continue;
    collectFilesRecursively(
      workspaceRoot,
      child,
      allowed,
      `${prefix}${entry.name}/`,
      depth + 1,
      out,
    );
  }
}

/**
 * 폴더 목록. `recursive`면 하위 폴더까지 훑고 이름 대신 **폴더 기준 상대 경로**를 준다.
 *
 * 구분자는 플랫폼과 무관하게 항상 `/`다 — 응답을 받는 쪽이 그대로 URL 경로에
 * 이어 붙인다(`workspaceFileUrl`).
 */
function handleList(
  res: ServerResponse,
  workspaceRoot: string,
  absolutePath: string,
  dir: string,
  recursive: boolean,
  metadata: boolean,
): void {
  const allowed: readonly string[] = WORKSPACE_DIR_RULES[dir as keyof typeof WORKSPACE_DIR_RULES];

  function reply(files: string[]): void {
    if (!metadata) {
      sendJson(res, 200, { ok: true, dir, files });
      return;
    }
    const entries: WorkspaceFileEntry[] = [];
    for (const name of files) {
      const path = join(absolutePath, name);
      try {
        // 목록 수집 뒤 삭제/교체될 수 있다. 링크를 따라가지 않고 경계를 다시 검사한다.
        if (!realPathStaysInside(workspaceRoot, path)) continue;
        const stats = lstatSync(path);
        if (stats.isFile() && Number.isFinite(stats.mtimeMs)) {
          entries.push({ name, mtimeMs: stats.mtimeMs });
        }
      } catch {
        // 목록을 읽은 뒤 사라지거나 읽을 수 없어진 파일은 메타데이터에서 뺀다.
      }
    }
    sendJson(res, 200, { ok: true, dir, files, entries });
  }

  if (recursive) {
    const files: string[] = [];
    // 폴더가 없으면 collectFilesRecursively가 조용히 빈 배열로 끝난다 — 아래
    // 비재귀 경로가 readdir 실패를 "빈 폴더"로 답하는 것과 같은 규칙이다.
    collectFilesRecursively(workspaceRoot, absolutePath, allowed, "", 0, files);
    files.sort((a, b) => a.localeCompare(b));
    reply(files);
    return;
  }

  let entries;
  try {
    entries = readdirSync(absolutePath, { withFileTypes: true });
  } catch {
    // 폴더가 아직 없으면 "빈 폴더"로 답한다 — 호출 측이 없음/빈 상태를 나눠
    // 처리할 이유가 없다(둘 다 "고를 게 없다"로 끝난다).
    reply([]);
    return;
  }

  const files = entries
    .filter((entry) => entry.isFile() && allowed.includes(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  reply(files);
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

    if (path === WORKSPACE_RENAME_ROUTE) {
      if (method !== "POST") { sendError(res, 405, "POST만 받습니다."); return; }
      handleRename(req, res, root);
      return;
    }

    if (path.startsWith(WORKSPACE_REQUEST_LOCK_ROUTE)) {
      const kind = path.slice(WORKSPACE_REQUEST_LOCK_ROUTE.length);
      const owner = req.headers[WORKSPACE_REQUEST_OWNER_HEADER];
      if (!isRequestLockKind(kind)) { sendError(res, 404, "알 수 없는 요청 종류입니다."); return; }
      if (typeof owner !== "string" || owner === "" || owner.length > 200) {
        sendError(res, 400, "요청 주인 헤더가 필요합니다."); return;
      }
      if (method !== "POST" && method !== "DELETE") { sendError(res, 405, "POST·DELETE만 받습니다."); return; }
      // 잠금 기록·문지기·요청 정리는 runtime/ 아래에 쓰고 지운다 — 파일 라우트와 같은
      // 링크 검사를 건다. runtime 이 바깥 폴더를 가리키는 링크면 거기에 쓰지 않는다.
      if (!realPathStaysInside(root, join(root, REQUEST_LOCK_FILES[kind]))) {
        sendError(res, 403, "거부: traversal"); return;
      }
      try {
        if (method === "DELETE") { releaseRequestLock(root, kind, owner); sendJson(res, 200, { ok: true }); return; }
        const lock = acquireRequestLock(root, kind, owner);
        if (lock.ok) sendJson(res, 200, { ok: true, expiresAt: lock.expiresAt });
        else sendJson(res, 409, { ok: false, error: "다른 탭에서 보낸 요청이 아직 응답을 기다리고 있습니다.", expiresAt: lock.expiresAt });
      } catch (error) {
        // 다른 서버 프로세스가 같은 순간 잠금을 갱신 중이었다 — 잠금 상태를 모르므로 거절도
        // 허락도 아닌 일시 장애로 답한다. 클라이언트는 다음 회차에 다시 시도한다.
        sendError(res, 503, error instanceof Error ? error.message : String(error));
      }
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
      // 파일 GET/PUT과 **같은** 링크 검사를 목록에도 건다 (PR #145 리뷰, wook3964).
      // 빠져 있던 동안 `.visual-spec/specs`를 바깥 폴더 심볼릭 링크로 바꿔 두면
      // `GET /__vs/list/specs`가 작업공간 밖 `*.json` 파일 이름을 그대로 내보냈다.
      // 이름만 나가는 것도 유출이다 — 경로 문자열 검증(`resolveWorkspaceDir`)은
      // 링크를 못 보므로 여기서 realpath로 한 번 더 본다.
      if (!realPathStaysInside(root, resolved.absolutePath)) {
        sendError(res, 403, "거부: traversal");
        return;
      }
      // 질의 문자열은 여기서만 본다 — 경로 판정(`matchWorkspaceRoute`)은 이미
      // `?` 뒤를 떼어냈다. `recursive=1`만 재귀로 치고 나머지 값은 무시한다.
      const query = new URLSearchParams(url.split("#")[0].split("?")[1] ?? "");
      handleList(
        res,
        root,
        resolved.absolutePath,
        resolved.dir,
        query.get(WORKSPACE_LIST_RECURSIVE_PARAM) === "1",
        query.get(WORKSPACE_LIST_METADATA_PARAM) === "1",
      );
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
        handleRead(res, resolved.absolutePath, resolved.relativePath.startsWith("specs/"));
      } else {
        // 공유 요청 파일은 잠금 주인만 덮어쓴다(#273) — 기다리는 다른 탭의 요청을 지우지 않는다.
        const lockKind = (Object.keys(REQUEST_LOCK_FILES) as (keyof typeof REQUEST_LOCK_FILES)[])
          .find((kind) => REQUEST_LOCK_FILES[kind] === resolved.relativePath.toLowerCase());
        const owner = req.headers[WORKSPACE_REQUEST_OWNER_HEADER];
        if (lockKind !== undefined && !holdsRequestLock(root, lockKind, typeof owner === "string" ? owner : undefined)) {
          sendError(res, 409, "다른 탭에서 보낸 요청이 아직 응답을 기다리고 있거나, 이 요청의 잠금이 만료됐습니다.");
          return;
        }
        handleWrite(req, res, root, resolved.absolutePath, resolved.relativePath);
      }
      return;
    }

    sendError(res, 404, "알 수 없는 작업공간 라우트입니다.");
  };
}
