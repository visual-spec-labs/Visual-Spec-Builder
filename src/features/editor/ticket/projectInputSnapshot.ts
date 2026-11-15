import type { ProjectSpec } from "@/features/editor/schema";
import { canonicalJson, sha256Hex } from "@/features/editor/export/contentHash";
import { WORKSPACE_DIR_RULES, WORKSPACE_MAX_BODY_BYTES } from "@/features/workspace/protocol";
import { isWorkspaceSegment } from "@/features/workspace/workspaceSegment";
import { validateProjectPlanContext } from "./compileProjectTickets";
import type { ProjectPlan } from "./types";
import { referencedWidgets } from "./widgetReachability";

export const PROJECT_INPUT_PROTOCOL = 1;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MEDIA_EXTENSIONS = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
  "image/avif": "avif", "image/bmp": "bmp", "image/x-icon": "ico", "image/svg+xml": "svg",
} as const;
export type ProjectAssetMediaType = keyof typeof MEDIA_EXTENSIONS;
export interface ProjectAssetMapping {
  sourcePath: string; sha256: string; byteLength: number; mediaType: ProjectAssetMediaType; zipPath: string;
}
export interface ProjectAssetSnapshot extends ProjectAssetMapping { dataBase64: string }
export interface ProjectInputSnapshot {
  protocol: 1; requestId: string; projectId: string; project: ProjectSpec; plan: ProjectPlan; assets: ProjectAssetSnapshot[];
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function validAssetPath(path: string): boolean {
  const segments = path.split("/");
  if (segments[0] !== "assets" || segments.length < 2 || !segments.every(isWorkspaceSegment)) return false;
  const filename = segments.at(-1)!;
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return false;
  const extension = filename.slice(dot).toLowerCase();
  return (WORKSPACE_DIR_RULES.assets as readonly string[]).includes(extension);
}
function sizeError(): Error {
  return Error("프로젝트 입력 snapshot이 32 MiB UTF-8 PUT 한도를 초과합니다. 자산/문서 크기를 줄인 뒤 다시 시도하세요.");
}
function snapshotBytes(content: string): Uint8Array {
  if (content.length > WORKSPACE_MAX_BODY_BYTES) throw sizeError();
  const bytes = new TextEncoder().encode(content);
  if (bytes.byteLength > WORKSPACE_MAX_BODY_BYTES) throw sizeError();
  return bytes;
}
export function projectInputSnapshotPath(requestId: string): string {
  if (!REQUEST_ID.test(requestId)) throw Error("잘못된 프로젝트 요청 ID입니다.");
  return `runtime/project-input-${requestId}.json`;
}

/** Byte-signature classification, not an image decoder or SVG sanitizer. */
export function projectAssetMediaType(bytes: Uint8Array): ProjectAssetMediaType {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && bytes.length >= 16) {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (size >= 16 && size <= bytes.length) {
      for (let at = 8; at + 4 <= size; at += at === 8 ? 8 : 4) {
        if (["avif", "avis"].includes(ascii(at, 4))) return "image/avif";
      }
    }
  }
  if (ascii(0, 2) === "BM") return "image/bmp";
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "image/x-icon";
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/^\s*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|\/?>)/.test(text)) return "image/svg+xml";
  } catch { /* Unknown binary input is rejected below. */ }
  throw Error("지원되는 이미지 바이트 형식을 판별할 수 없습니다.");
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (encodeBase64(bytes) !== value) throw Error("자산 base64가 정규 형식이 아닙니다.");
  return bytes;
}

/** Caller must read through the existing workspace canonical-path/symlink boundary first. */
export function createProjectAssetSnapshot(sourcePath: string, bytes: Uint8Array): ProjectAssetSnapshot {
  if (!validAssetPath(sourcePath)) throw Error("프로젝트 자산은 승인된 assets 상대 경로여야 합니다.");
  // Metadata/project bytes are nonempty, so base64 alone cannot consume the whole cap.
  if (4 * Math.ceil(bytes.length / 3) >= WORKSPACE_MAX_BODY_BYTES) throw sizeError();
  const mediaType = projectAssetMediaType(bytes);
  const sha256 = sha256Hex(bytes);
  return { sourcePath, sha256, byteLength: bytes.length, mediaType,
    zipPath: `assets/${sha256}.${MEDIA_EXTENSIONS[mediaType]}`, dataBase64: encodeBase64(bytes) };
}

/** Include hidden nodes and every responsive background from generated sources. */
export function projectAssetPaths(project: ProjectSpec, pageIds?: readonly string[]): string[] {
  const paths = new Set<string>();
  const add = (source: string) => {
    if (validAssetPath(source)) paths.add(source);
    else if (!/^https?:\/\//i.test(source) && !/^data:/i.test(source)) {
      throw Error(`프로젝트 생성에서 보존할 수 없는 이미지 참조입니다: ${source}`);
    }
  };
  const background = (value: unknown) => {
    if (Array.isArray(value)) for (const fill of value) if (fill.type === "image") add(fill.src);
  };
  const widgets = pageIds ? null : referencedWidgets(project);
  const included = pageIds ?? project.pageOrder.filter(id => project.pages[id].kind !== 'widget' || widgets!.has(id));
  for (const pageId of included) {
    const screen = project.pages[pageId];
    for (const node of Object.values(screen.nodes)) {
      if (node.type === "image") add(node.src);
      if ("background" in node) background(node.background);
    }
    for (const overrides of Object.values(screen.responsive?.overrides ?? {})) {
      for (const override of Object.values(overrides)) if ("background" in override) background(override.background);
    }
  }
  return [...paths].sort();
}

function validateSnapshot(value: unknown): asserts value is ProjectInputSnapshot {
  if (!exactKeys(value, ["protocol", "requestId", "projectId", "project", "plan", "assets"]) || value.protocol !== 1
    || typeof value.requestId !== "string" || !REQUEST_ID.test(value.requestId)
    || !Array.isArray(value.assets)) throw Error("프로젝트 입력 snapshot 형태가 잘못됐습니다.");
  const context = validateProjectPlanContext(value.plan, value.project);
  if (!context.valid) throw Error(context.issues.map(issue => issue.message).join("\n"));
  const project = value.project as ProjectSpec;
  if (value.projectId !== project.projectId) throw Error("snapshot 프로젝트 신원이 다릅니다.");
  const seen = new Set<string>(); const byteByHash = new Map<string, string>();
  let previousSource: string | undefined;
  for (const asset of value.assets) {
    if (!exactKeys(asset, ["sourcePath", "sha256", "byteLength", "mediaType", "zipPath", "dataBase64"])
      || typeof asset.sourcePath !== "string" || typeof asset.dataBase64 !== "string") throw Error("자산 snapshot 형태가 잘못됐습니다.");
    if (seen.has(asset.sourcePath)) throw Error("자산 sourcePath가 중복됩니다.");
    if (previousSource !== undefined && asset.sourcePath < previousSource) throw Error("자산 목록이 sourcePath 순서로 정렬되지 않았습니다.");
    previousSource = asset.sourcePath;
    seen.add(asset.sourcePath);
    const actual = createProjectAssetSnapshot(asset.sourcePath, decodeBase64(asset.dataBase64));
    if (canonicalJson(actual) !== canonicalJson(asset)) throw Error("자산 길이/hash/type/경로가 보유 바이트와 다릅니다.");
    const previous = byteByHash.get(actual.sha256);
    if (previous !== undefined && previous !== actual.dataBase64) throw Error("자산 hash 충돌입니다.");
    byteByHash.set(actual.sha256, actual.dataBase64);
  }
  if (canonicalJson([...seen]) !== canonicalJson(projectAssetPaths(project))) throw Error("프로젝트 자산 mapping에 누락 또는 미참조 자산이 있습니다.");
}

/** Pure preparation; producer must persist content create-only before publishing a project request. */
export function buildProjectInputSnapshot(requestId: string, project: ProjectSpec, plan: ProjectPlan, assets: ProjectAssetSnapshot[]) {
  const path = projectInputSnapshotPath(requestId);
  if (assets.reduce((sum, asset) => sum + asset.dataBase64.length, 0) >= WORKSPACE_MAX_BODY_BYTES) throw sizeError();
  const candidate = { protocol: 1, requestId, projectId: project.projectId, project, plan,
    assets: [...assets].sort((a, b) => a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0) };
  validateSnapshot(candidate);
  const content = canonicalJson(candidate);
  return { path, content, sha256: sha256Hex(snapshotBytes(content)) };
}

/** Never trusts hash alone: revalidates metadata, plan context and every retained asset byte. */
export function parseProjectInputSnapshot(content: string, expectedHash: string, requestId: string):
  { ok: true; snapshot: ProjectInputSnapshot } | { ok: false; error: string } {
  try {
    const bytes = snapshotBytes(content);
    if (!/^[a-f0-9]{64}$/.test(expectedHash) || sha256Hex(bytes) !== expectedHash) throw Error("입력 snapshot hash가 다릅니다.");
    const value: unknown = JSON.parse(content);
    validateSnapshot(value);
    if (value.requestId !== requestId) throw Error("입력 snapshot 요청 ID가 다릅니다.");
    if (canonicalJson(value) !== content) throw Error("입력 snapshot JSON이 정규 형식이 아닙니다.");
    return { ok: true, snapshot: value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "입력 snapshot을 읽지 못했습니다." };
  }
}
