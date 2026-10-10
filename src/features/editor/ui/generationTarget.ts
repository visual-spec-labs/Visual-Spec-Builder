/**
 * 생성 출력의 주인 프로젝트와 페이지 생성 자리를 정한다 — 작업공간 부수효과 (이슈 #281).
 *
 * 스키마에는 프로젝트 ID가 없다(`ProjectSpec`은 name·pages·pageOrder뿐이고 `additionalProperties: false`).
 * 스키마를 바꾸지 않고 안정 신원을 두려고, GUI가 **처음 전달할 때** 프로젝트 ID(UUID)와 출력 폴더를 만들어
 * 수용 기록(`runtime/generation-manifest.json`의 `projects`)에 남긴다. 이후 같은 작업공간 파일은 같은 ID·
 * 같은 폴더를 쓴다.
 *
 * | 일 | 결과 |
 * |---|---|
 * | 앱 안 이름 변경(`renameProject`) | `recordProjectRename`이 기록의 파일 이름만 바꾼다 — 같은 ID·같은 폴더. 기록하지 못하면(잠금 사용 중·기록 오류) 이 탭이 "기록 대기"로 들고 있다가 다음 전달·Export에서 이어받고, 다음 전달 때 다시 기록한다 |
 * | 다른 이름으로 저장(복사) | 새 파일 이름이라 기록이 없다 — 처음 전달할 때 새 ID·새 폴더 |
 * | 앱 밖에서 이름 변경·복사 | 앱이 알 수 없다 — 새 프로젝트로 본다. 옛 폴더의 파일은 건드리지 않는다 |
 * | 저장하지 않은 문서 | 이 탭의 문서(`editorStore.documentId`)에 세션 동안 프로젝트를 정해 두고, 처음 저장한 뒤 전달하면 그 파일 이름을 이어받는다 |
 *
 * 틀리는 쪽은 언제나 "새 프로젝트"다 — 새 폴더에 새로 만들 뿐 남의 출력을 덮지 않는다. 반대 방향(남의
 * 출력을 내 것으로 보는 것)은 낡은 기록이 같은 파일 이름을 들고 있을 때만 생기고, 그때도 #282의 바이트
 * 비교와 백업을 거친다(docs/26 "#281 남은 한계").
 */

import {
  findProjectByFileName,
  GENERATION_MANIFEST_PATH,
  isNewerGenerationManifest,
  parseGenerationManifest,
  withProject,
  withProjectRenamed,
  type GenerationManifest,
} from "@/features/editor/export/generationManifest";
import {
  chooseOutputDir,
  isWindowsDeviceName,
  pageIdCaseConflicts,
  pageOutputRoot,
  projectOutputDirName,
} from "@/features/editor/export/generationIdentity";
import type { PageId } from "@/features/editor/schema";

import { holdRequestLock } from "./agentRequestLock";
import { readWorkspaceTextFileStrict, writeWorkspaceFile } from "./workspaceClient";

/** 생성하는 쪽의 신원. 파일 이름은 바뀔 수 있고, 문서 ID는 이 탭에서만 뜻이 있다. */
export interface GenerationOwnerInput {
  /** `documentStore.fileName`. 저장하지 않은 문서면 null. */
  fileName: string | null;
  /** `editorStore.documentId`. 저장하지 않은 문서의 세션 프로젝트를 찾는 데만 쓴다. */
  documentId: number;
  pageId: PageId;
  /** 이 프로젝트의 모든 PageId. 대소문자만 다른 PageId가 있는지 보는 데만 쓴다. */
  projectPageIds: readonly PageId[];
  /** 이 페이지 티켓 계획의 컴포넌트 이름들(파일 이름 `<이름>.tsx`). Windows 장치 이름인지 보는 데만 쓴다. */
  componentNames?: readonly string[];
}

/** 정해진 생성 자리. */
export interface GenerationTarget {
  projectId: string;
  outputDir: string;
  /** 이 페이지의 생성 자리(`generated/` 기준). */
  root: string;
}

/**
 * 저장하지 않은 문서에 이 탭이 정해 준 프로젝트(문서 ID → 프로젝트 ID). 새로고침하면 잊는다 — 그때 남은
 * 폴더(`unsaved…`)는 주인 없는 출력이 되고, 다음 전달은 새 폴더에 만든다.
 */
const unsavedProjects = new Map<number, string>();

/**
 * 기록하지 못한 앱 안 이름 변경(새 파일 이름 → 옛 파일 이름). 이름 변경은 이미 끝났는데 기록이 옛 이름을
 * 들고 있으면, 다음 전달이 새 프로젝트(새 폴더)로 시작해 이 프로젝트의 출력과 이어지지 않는다. 그래서 이
 * 탭이 들고 있다가 기록을 찾을 때 옛 이름으로 이어받고(`findGenerationProject`), 다음 전달 때 잠금 안에서
 * 다시 기록한다(`ensureGenerationTarget`). 새로고침하면 잊는다 — 그 전에 전달하지 않았다면 다음 전달은 새
 * 프로젝트로 시작한다(남의 출력을 덮는 쪽으로는 틀리지 않는다, docs/26 "#281 남은 한계").
 */
const pendingRenames = new Map<string, string>();

/** 새 이름에서 기록 대기 중인 이름 변경을 거슬러 가장 처음 이름까지 따라간다(A→B→C 연속 변경). */
function renamedFrom(fileName: string): string | null {
  const seen = new Set([fileName]);
  let current = pendingRenames.get(fileName);
  if (current === undefined) return null;
  while (!seen.has(current)) {
    seen.add(current);
    const earlier = pendingRenames.get(current);
    if (earlier === undefined) break;
    current = earlier;
  }
  return current;
}

/** 기록한 이름 변경을 대기 목록에서 지운다(그 이름에 이르는 앞 단계까지). */
function forgetPendingRename(fileName: string): void {
  let current: string | undefined = fileName;
  while (current !== undefined && pendingRenames.has(current)) {
    const earlier: string | undefined = pendingRenames.get(current);
    pendingRenames.delete(current);
    current = earlier;
  }
}

function createProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 기록에서 이 문서의 프로젝트를 찾는다(읽기만). 파일 이름이 기록에 있으면 그 프로젝트, 없으면 이 탭에서
 * 저장하지 않은 채 전달했던 세션 프로젝트(아직 파일 이름이 없을 때만). 둘 다 아니면 null이다.
 */
export function findGenerationProject(
  manifest: GenerationManifest,
  { fileName, documentId }: Pick<GenerationOwnerInput, "fileName" | "documentId">,
): { projectId: string; outputDir: string; adoptFileName: boolean; renameFrom?: string } | null {
  if (fileName !== null) {
    const found = findProjectByFileName(manifest, fileName);
    if (found !== null) return { projectId: found.projectId, outputDir: found.project.outputDir, adoptFileName: false };
    // 이 탭에서 이름을 바꿨는데 기록하지 못했다 — 옛 이름의 기록이 이 프로젝트다.
    const from = renamedFrom(fileName);
    const renamed = from === null ? null : findProjectByFileName(manifest, from);
    if (from !== null && renamed !== null) {
      return { projectId: renamed.projectId, outputDir: renamed.project.outputDir, adoptFileName: false, renameFrom: from };
    }
  }
  const sessionId = unsavedProjects.get(documentId);
  const session = sessionId === undefined ? undefined : manifest.projects[sessionId];
  if (sessionId === undefined || session === undefined || session.fileName !== null) return null;
  return { projectId: sessionId, outputDir: session.outputDir, adoptFileName: fileName !== null };
}

/**
 * 아직 기록에 없는 프로젝트의 출력 폴더 **후보**(Export가 직접 실행한 to-react 출력을 찾을 때). 다른
 * 프로젝트가 이미 그 폴더를 쓰면 null이다 — 남의 출력을 이 프로젝트의 것으로 보여 주지 않는다.
 */
export function unregisteredOutputDir(manifest: GenerationManifest, fileName: string | null): string | null {
  if (fileName === null) return null;
  const candidate = projectOutputDirName(fileName);
  return Object.values(manifest.projects).some((project) => project.outputDir === candidate) ? null : candidate;
}

/** `retryable: false`면 다시 눌러도 같은 이유로 실패한다(사용자가 프로젝트를 고쳐야 한다). */
export type GenerationTargetResult =
  | { ok: true; target: GenerationTarget }
  | { ok: false; error: string; retryable?: boolean };

type ManifestRead = { ok: true; manifest: GenerationManifest } | { ok: false; error: string };

async function readManifest(): Promise<ManifestRead> {
  const text = await readWorkspaceTextFileStrict(GENERATION_MANIFEST_PATH);
  if (!text.ok) return { ok: false, error: "생성 기록을 읽지 못해 출력 위치를 정하지 못했습니다. 작업공간 연결을 확인하세요." };
  if (isNewerGenerationManifest(text.text)) {
    return { ok: false, error: "생성 기록이 이 앱보다 새 형식입니다. 앱을 업데이트한 뒤 다시 전달하세요." };
  }
  return { ok: true, manifest: parseGenerationManifest(text.text) };
}

/**
 * 기록을 고쳐 쓴다 — 티켓 요청 잠금을 잠깐 잡고, 잠금 안에서 **다시 읽은** 기록에 고칠 것을 합쳐 그 주인으로
 * 쓴다. 다른 탭이 확정 중(잠금을 쥔 채 기록을 갱신하는 중)이면 기다리지 않고 멈춘다 — 그 탭의 기록을 읽고-
 * 합치고-쓰기 사이에 덮지 않기 위해서다(#284·#282의 manifest 쓰기 소유권과 같은 규칙).
 */
async function updateManifestLocked<T>(
  change: (manifest: GenerationManifest) => { next: GenerationManifest | null; result: T },
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const owner = `generation-target-${createProjectId()}`;
  const lock = await holdRequestLock("ticket", owner);
  if (lock === "busy") {
    return { ok: false, error: "다른 탭(창)의 티켓 요청이 진행 중이라 생성 기록을 바꾸지 못했습니다. 그 요청이 끝난 뒤 다시 시도하세요." };
  }
  if (lock === "unavailable") return { ok: false, error: "작업공간에 연결돼 있지 않아 생성 기록을 바꾸지 못했습니다." };
  try {
    const read = await readManifest();
    if (!read.ok) return read;
    const { next, result } = change(read.manifest);
    if (next === null) return { ok: true, result };
    const written = await writeWorkspaceFile(
      GENERATION_MANIFEST_PATH, JSON.stringify(next, null, 2), "application/json", undefined, owner,
    );
    return written.ok ? { ok: true, result } : { ok: false, error: `생성 기록을 저장하지 못했습니다 — ${written.error}.` };
  } finally {
    lock.release();
  }
}

function targetOf(projectId: string, outputDir: string, pageId: PageId): GenerationTarget {
  return { projectId, outputDir, root: pageOutputRoot(outputDir, pageId) };
}

/**
 * 티켓을 전달하기 전에 이 문서·페이지의 생성 자리를 정한다. 처음이면 프로젝트를 만들어 기록하고, 저장하지
 * 않은 채 정해 둔 세션 프로젝트가 있으면 지금 파일 이름을 이어받게 한다. 기록을 읽거나 쓰지 못하면 자리를
 * 정하지 않는다 — 주인을 기록하지 못한 채 만든 출력은 다음 판정에서 누구의 것인지 가를 수 없다.
 * 이미 기록된 프로젝트면 읽기만 하고 잠금을 잡지 않는다.
 *
 * 대소문자만 다른 PageId가 프로젝트에 있으면 기록을 읽기 전에 거부한다 — 그 두 페이지의 생성 자리는
 * 대소문자를 가리지 않는 파일 시스템에서 같은 폴더라, 자리를 나눈다는 약속을 지킬 수 없다.
 */
export async function ensureGenerationTarget(
  owner: GenerationOwnerInput,
  { now = () => new Date(), createId = createProjectId }: { now?: () => Date; createId?: () => string } = {},
): Promise<GenerationTargetResult> {
  const deviceNameIssue = windowsDeviceNameIssue(owner);
  if (deviceNameIssue !== null) return { ok: false, retryable: false, error: deviceNameIssue };
  const conflicts = pageIdCaseConflicts(owner.pageId, owner.projectPageIds);
  if (conflicts.length > 0) {
    return {
      ok: false,
      retryable: false,
      error: `페이지 ID "${owner.pageId}"와 대소문자만 다른 페이지(${conflicts.map((id) => `"${id}"`).join(", ")})가 ` +
        "있어 전달하지 않았습니다. Windows·macOS 기본 파일 시스템에서는 두 페이지의 생성 폴더가 같아져 서로의 " +
        "출력을 덮습니다. 프로젝트 JSON에서 한쪽 페이지 ID를 바꾼 뒤 다시 전달하세요.",
    };
  }
  const read = await readManifest();
  if (!read.ok) return read;
  const known = findGenerationProject(read.manifest, owner);
  if (known !== null && !known.adoptFileName && known.renameFrom === undefined) {
    return { ok: true, target: targetOf(known.projectId, known.outputDir, owner.pageId) };
  }

  const updated = await updateManifestLocked((manifest) => {
    // 잠금 안에서 다시 판정한다 — 그 사이 다른 탭이 같은 파일 이름을 기록했을 수 있다.
    const found = findGenerationProject(manifest, owner);
    if (found !== null) {
      // 기록하지 못했던 이름 변경을 지금 기록한다 — 같은 ID·같은 폴더가 새 이름을 이어받는다.
      if (found.renameFrom !== undefined && owner.fileName !== null) {
        return {
          next: withProjectRenamed(manifest, found.renameFrom, owner.fileName),
          result: { target: targetOf(found.projectId, found.outputDir, owner.pageId), created: false },
        };
      }
      if (!found.adoptFileName || owner.fileName === null) {
        return { next: null, result: { target: targetOf(found.projectId, found.outputDir, owner.pageId), created: false } };
      }
      const project = manifest.projects[found.projectId];
      return {
        next: withProject(manifest, found.projectId, { ...project, fileName: owner.fileName }),
        result: { target: targetOf(found.projectId, found.outputDir, owner.pageId), created: false },
      };
    }
    const projectId = createId();
    const used = new Set(Object.values(manifest.projects).map((project) => project.outputDir));
    const outputDir = chooseOutputDir(owner.fileName === null ? "unsaved" : projectOutputDirName(owner.fileName), used);
    return {
      next: withProject(manifest, projectId, { fileName: owner.fileName, outputDir, createdAt: now().toISOString() }),
      result: { target: targetOf(projectId, outputDir, owner.pageId), created: true },
    };
  });
  if (!updated.ok) return { ok: false, error: `출력 위치를 정하지 못했습니다 — ${updated.error}` };
  const { target, created } = updated.result;
  if (owner.fileName === null && created) unsavedProjects.set(owner.documentId, target.projectId);
  if (owner.fileName !== null) {
    unsavedProjects.delete(owner.documentId);
    forgetPendingRename(owner.fileName);
  }
  return { ok: true, target };
}

const WINDOWS_DEVICE_HINT = "Windows 장치 이름(CON·PRN·AUX·NUL·COM0~9·LPT0~9 — 대소문자·확장자와 상관없음)";

/**
 * 생성 자리의 폴더(PageId)나 파일(`<컴포넌트 이름>.tsx`)이 Windows 장치 이름이면 이유 문구, 아니면 null.
 * 그런 폴더·파일은 Windows에서 일반 프로그램이 열거나 지우지 못한다(`isWindowsDeviceName`). 대소문자 충돌과
 * 같이 **전달 전에 거부**한다 — 이름을 몰래 바꾸면 스킬·Export·수용 기록의 경로 규칙이 갈라진다. 프로젝트
 * 폴더는 파일 이름에서 만들 때 이미 피한다(`projectOutputDirName`).
 */
function windowsDeviceNameIssue(owner: GenerationOwnerInput): string | null {
  if (isWindowsDeviceName(owner.pageId)) {
    return `페이지 ID "${owner.pageId}"는 ${WINDOWS_DEVICE_HINT}이라 생성 폴더를 만들 수 없어 전달하지 않았습니다. ` +
      "Windows에서는 이 이름의 폴더를 탐색기·git·편집기가 열거나 지우지 못합니다. 프로젝트 JSON에서 페이지 ID를 바꾼 뒤 다시 전달하세요.";
  }
  const names = [...new Set((owner.componentNames ?? []).filter(isWindowsDeviceName))].sort();
  if (names.length === 0) return null;
  return `티켓 이름 ${names.map((name) => `"${name}"`).join(", ")}은 ${WINDOWS_DEVICE_HINT}이라 생성 파일` +
    `(${names.map((name) => `${name}.tsx`).join(", ")})을 만들 수 없어 전달하지 않았습니다. ` +
    "해당 화면·레이어 이름을 바꾼 뒤 티켓을 다시 생성해 전달하세요.";
}

/** 이름 변경을 기록하지 못했을 때 사용자가 알아야 할 복구 경로. 이름 변경 자체는 이미 끝났다. */
const RENAME_RECORD_RECOVERY =
  "이름 변경은 완료됐습니다. 이 탭에서 이 프로젝트의 구현 티켓을 다음에 전달할 때 기록을 다시 시도해 같은 생성 폴더를 " +
  "이어받습니다. 그 전에 새로고침하거나 다른 탭에서 전달하면 새 프로젝트(새 생성 폴더)로 시작하고, 이전 생성 파일은 옛 폴더에 그대로 남습니다.";

/**
 * 앱 안 이름 변경을 기록에 옮긴다 — 같은 프로젝트 ID·같은 출력 폴더가 새 이름을 이어받는다. 기록에 없는
 * 프로젝트(한 번도 전달하지 않음)면 할 일이 없다(null). 기록하지 못하면(다른 탭·이 탭의 티켓 요청이 잠금을
 * 쥐고 있음, 기록을 읽거나 쓰지 못함, 새 형식 기록) 이유와 복구 경로를 담은 안내를 돌려주고, 이 탭에 "기록
 * 대기"로 남겨 다음 전달 때 다시 기록한다(`pendingRenames`). 남의 출력을 덮는 쪽으로는 틀리지 않는다.
 */
export async function recordProjectRename(from: string, to: string): Promise<string | null> {
  // 이름 변경은 이미 끝난 뒤라 여기서 무엇이 실패해도(예외 포함) 그 결과를 뒤집지 않는다.
  let reason: string;
  try {
    const read = await readManifest();
    if (!read.ok) reason = read.error;
    else {
      // 앞서 기록하지 못한 변경(A→B)이 있으면 처음 이름(A)의 기록을 이번 이름(C)으로 옮긴다.
      const origin = findProjectByFileName(read.manifest, from) !== null ? from : renamedFrom(from);
      if (origin === null || findProjectByFileName(read.manifest, origin) === null) return null;
      const updated = await updateManifestLocked((manifest) => {
        const next = withProjectRenamed(manifest, origin, to);
        return { next: next === manifest ? null : next, result: null };
      });
      if (updated.ok) {
        forgetPendingRename(from);
        return null;
      }
      reason = updated.error;
    }
  } catch {
    reason = "생성 기록을 읽거나 쓰는 중 오류가 났습니다.";
  }
  pendingRenames.set(to, from);
  return `이름 변경을 생성 기록에 남기지 못했습니다 — ${reason} ${RENAME_RECORD_RECOVERY}`;
}

/** 테스트 전용: 세션 프로젝트를 잊는다(새로고침 흉내). */
export function forgetUnsavedGenerationProjects(): void {
  unsavedProjects.clear();
  pendingRenames.clear();
}
