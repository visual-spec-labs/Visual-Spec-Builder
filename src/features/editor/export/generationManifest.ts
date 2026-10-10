/**
 * 생성 출력의 수용 기록과 Export 생성 세대 판정 — 순수 함수 (이슈 #284, #281).
 *
 * `verifyGenerated.ts`는 "파일이 있고 참조가 맞는가"를 본다. 그것만으로는 취소된 요청이
 * 늦게 쓴 파일도 4/4·오류 0으로 통과한다(#284 감사 재현). 이 파일은 그 옆에 다른 질문을
 * 하나 더 둔다 — **이 파일이 GUI가 수용한 요청의 출력 그대로이며, 지금 입력으로 만든
 * 것인가.** 두 답은 섞지 않고 Export 화면에 따로 보인다.
 *
 * 기록은 GUI만 쓴다(`ui/ticketOutputAcceptance.ts`가 확정할 때, `ui/generationTarget.ts`가 프로젝트를
 * 처음 정하거나 이름을 바꿀 때). 형식과 경계는 docs/26-agent-request-generation-contract.md에 있다.
 *
 * protocol 2(#281)는 두 가지를 더했다. 기록마다 **누구의 출력인가**(프로젝트 ID·페이지·컴포넌트 신원)와
 * **무엇으로 만들었나**(입력 범위·지문·규약 버전)를 남기고, 작업공간 파일 이름과 무관한 **프로젝트 ID와
 * 그 출력 폴더**를 `projects`에 둔다. 스키마를 바꾸지 않고 안정 프로젝트 신원을 두는 자리가 여기다.
 */

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import type { Ticket } from "@/features/editor/ticket/types";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

import { contentHash } from "./contentHash";
import {
  generatedTicketPath,
  relativeToRoot,
  ticketComponentKey,
  ticketInputFingerprint,
  type InputScope,
} from "./generationIdentity";
import type { GeneratedFile } from "./verifyGenerated";

/** 기록 형식 버전. 1 = #284(경로·페이지·지문·해시), 2 = #281(프로젝트 레지스트리·안정 신원). */
export const GENERATION_MANIFEST_PROTOCOL = 2;

/** 수용 기록 파일(작업공간 루트 기준). 에이전트는 이 파일을 쓰지 않는다. */
export const GENERATION_MANIFEST_PATH = `${RUNTIME_DIR}/generation-manifest.json`;

/**
 * 프로젝트 하나(#281). 키(`projectId`)는 GUI가 처음 전달할 때 만든 UUID이고 바뀌지 않는다. 작업공간 파일
 * 이름은 바뀔 수 있는 값이라 여기 따로 둔다 — 앱 안 이름 변경(`renameProject`)이 이 값만 바꾼다.
 */
export interface ProjectRecord {
  /** 지금 이 프로젝트의 작업공간 파일 이름. 저장하지 않은 문서로 시작했으면 처음 저장 전까지 null. */
  fileName: string | null;
  /** `generated/` 아래 이 프로젝트의 폴더. 이름을 바꿔도 그대로다. */
  outputDir: string;
  createdAt: string;
}

/** 확정한 출력 파일 하나에 대한 기록. 키는 `generated/` 기준 경로다. */
export interface ManifestEntry {
  requestId: string;
  ticketId: string;
  /** 확정 때의 컴포넌트 이름(= 파일 이름). 이름 변경을 사람에게 보일 때 쓴다. */
  componentName: string;
  /** 출력의 주인 프로젝트(`projects`의 키). null이면 #284·#282 시절 기록이라 주인을 모른다. */
  projectId: string | null;
  pageId: PageId;
  /** 컴포넌트 안정 신원(`generationIdentity.ticketComponentKey`). null이면 #284 시절 기록이다. */
  componentKey: string | null;
  /** 지문이 덮는 입력 범위. #284 시절 기록은 언제나 `page`다. */
  inputScope: InputScope;
  /** 요청에 실은 입력의 지문(`generationIdentity.ticketInputFingerprint`). */
  inputFingerprint: string;
  /** 확정한 바이트의 해시. `contentHash.contentHash`. */
  contentHash: string;
  /** 이 출력을 만든 티켓 요청 규약 버전(생성 버전). #284 시절 기록이면 null. */
  ticketProtocol: number | null;
  /** ISO 시각. 판정에는 쓰지 않고 사람이 읽는 용도다. */
  acceptedAt: string;
}

export interface GenerationManifest {
  protocol: number;
  projects: Record<string, ProjectRecord>;
  entries: Record<string, ManifestEntry>;
}

export function emptyManifest(): GenerationManifest {
  return { protocol: GENERATION_MANIFEST_PROTOCOL, projects: {}, entries: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  return isRecord(value) &&
    (value.fileName === null || typeof value.fileName === "string") &&
    typeof value.outputDir === "string" && value.outputDir !== "" && !value.outputDir.includes("/") &&
    typeof value.createdAt === "string";
}

const optionalString = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * 항목 하나를 지금 형식으로 읽는다. protocol 1 모양(#284 기록, #282 되돌리기 기록의 `previousEntry`)도
 * 받는다 — 그 기록은 주인을 모르는 기록(`projectId: null`)이 되어 "현재"나 "마지막 생성 그대로"가 되지
 * 못한다. 필수 필드가 틀리면 null이다.
 */
function normalizeEntry(value: unknown): ManifestEntry | null {
  if (!isRecord(value) ||
    typeof value.requestId !== "string" || typeof value.ticketId !== "string" ||
    typeof value.pageId !== "string" || typeof value.inputFingerprint !== "string" ||
    typeof value.contentHash !== "string" || typeof value.acceptedAt !== "string") return null;
  return {
    requestId: value.requestId,
    ticketId: value.ticketId,
    componentName: optionalString(value.componentName) ?? value.ticketId,
    projectId: optionalString(value.projectId),
    pageId: value.pageId,
    componentKey: optionalString(value.componentKey),
    inputScope: value.inputScope === "component" ? "component" : "page",
    inputFingerprint: value.inputFingerprint,
    contentHash: value.contentHash,
    ticketProtocol: typeof value.ticketProtocol === "number" ? value.ticketProtocol : null,
    acceptedAt: value.acceptedAt,
  };
}

/**
 * 이 앱이 모르는 더 새 형식의 기록인가. 그런 기록을 빈 기록으로 읽고 다시 쓰면 새 앱이 남긴 신원을
 * 지운다 — 쓰는 쪽(`recordAcceptance`·`ensureGenerationTarget`)은 이 경우 쓰지 않는다.
 */
export function isNewerGenerationManifest(text: string | null): boolean {
  if (text === null) return false;
  try {
    const body: unknown = JSON.parse(text);
    return isRecord(body) && typeof body.protocol === "number" && body.protocol > GENERATION_MANIFEST_PROTOCOL;
  } catch {
    return false;
  }
}

/**
 * 기록 파일 본문을 읽는다. **절대 예외를 던지지 않는다.** 없거나 망가졌거나 모르는 버전이면
 * 빈 기록이다 — 기록이 없으면 판정은 "확인 불가" 쪽으로 기울 뿐 거짓 "현재"가 되지 않는다.
 * 모양이 틀린 항목 하나는 그 항목만 버린다. protocol 1은 2로 올려 읽는다(프로젝트 없음, 주인 모름).
 */
export function parseGenerationManifest(text: string | null): GenerationManifest {
  if (text === null) return emptyManifest();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return emptyManifest();
  }
  if (!isRecord(body) || (body.protocol !== 1 && body.protocol !== GENERATION_MANIFEST_PROTOCOL) ||
    !isRecord(body.entries)) {
    return emptyManifest();
  }
  const projects: Record<string, ProjectRecord> = {};
  if (body.protocol === GENERATION_MANIFEST_PROTOCOL && isRecord(body.projects)) {
    for (const [id, project] of Object.entries(body.projects)) {
      if (isProjectRecord(project)) {
        projects[id] = { fileName: project.fileName, outputDir: project.outputDir, createdAt: project.createdAt };
      }
    }
  }
  const entries: Record<string, ManifestEntry> = {};
  for (const [path, entry] of Object.entries(body.entries)) {
    const normalized = normalizeEntry(entry);
    if (normalized === null) continue;
    // protocol 1 기록의 주인 표시(`projectKey`)는 바뀌는 파일 이름이라 믿지 않는다 — 주인 모름으로 읽는다.
    entries[path] = body.protocol === 1
      ? { ...normalized, projectId: null, componentKey: null, inputScope: "page" }
      : normalized;
  }
  return { protocol: GENERATION_MANIFEST_PROTOCOL, projects, entries };
}

/** 기록에 항목을 덮어 합친 새 기록을 돌려준다. 같은 경로의 이전 기록은 새 확정으로 바뀐다. */
export function withManifestEntries(
  manifest: GenerationManifest,
  entries: Record<string, ManifestEntry>,
): GenerationManifest {
  return { ...manifest, protocol: GENERATION_MANIFEST_PROTOCOL, entries: { ...manifest.entries, ...entries } };
}

/**
 * 경로별로 기록을 바꾸거나(항목) 지운(null) 새 기록을 돌려준다(#282 되돌리기). 되돌린 파일은 이전
 * 기록으로 돌아가고, 이전 기록이 없던 파일(새로 만든 파일을 지운 경우)은 기록에서 빠진다. 이전 기록이
 * protocol 1 모양이면 지금 형식으로 바꿔 넣는다.
 */
export function withManifestUpdates(
  manifest: GenerationManifest,
  updates: Record<string, ManifestEntry | null>,
): GenerationManifest {
  const entries = { ...manifest.entries };
  for (const [path, entry] of Object.entries(updates)) {
    const normalized = entry === null ? null : normalizeEntry(entry);
    if (normalized === null) delete entries[path];
    else entries[path] = normalized;
  }
  return { ...manifest, protocol: GENERATION_MANIFEST_PROTOCOL, entries };
}

/**
 * 작업공간 파일 이름으로 프로젝트를 찾는다. 같은 이름이 둘 이상이면(동시 갱신의 틈) 먼저 만든 쪽이다.
 * 없으면 null — 그 파일은 아직 한 번도 GUI로 전달하지 않았거나 앱 밖에서 이름이 바뀌었다.
 */
export function findProjectByFileName(
  manifest: GenerationManifest,
  fileName: string,
): { projectId: string; project: ProjectRecord } | null {
  const matches = Object.entries(manifest.projects)
    .filter(([, project]) => project.fileName === fileName)
    .sort(([, left], [, right]) => left.createdAt.localeCompare(right.createdAt));
  return matches.length === 0 ? null : { projectId: matches[0][0], project: matches[0][1] };
}

/** 프로젝트를 더하거나 바꾼 새 기록. */
export function withProject(manifest: GenerationManifest, projectId: string, project: ProjectRecord): GenerationManifest {
  return { ...manifest, protocol: GENERATION_MANIFEST_PROTOCOL, projects: { ...manifest.projects, [projectId]: project } };
}

/**
 * 앱 안 이름 변경을 기록한다(#281). `from` 파일의 프로젝트가 `to`라는 이름을 이어받는다 — ID와 출력
 * 폴더는 그대로다. `to`라는 이름을 들고 있던 다른(낡은) 프로젝트 기록은 이름을 비운다 — 같은 이름이
 * 두 프로젝트를 가리키면 어느 쪽 출력인지 가를 수 없다. `from` 기록이 없으면 그대로 돌려준다.
 */
export function withProjectRenamed(manifest: GenerationManifest, from: string, to: string): GenerationManifest {
  const found = findProjectByFileName(manifest, from);
  if (found === null || from === to) return manifest;
  const projects: Record<string, ProjectRecord> = {};
  for (const [id, project] of Object.entries(manifest.projects)) {
    if (id === found.projectId) projects[id] = { ...project, fileName: to };
    else projects[id] = project.fileName === to ? { ...project, fileName: null } : project;
  }
  return { ...manifest, protocol: GENERATION_MANIFEST_PROTOCOL, projects };
}

/**
 * 티켓 하나의 생성 세대 판정(docs/26 "Export 생성 세대 판정", #281로 넓힘).
 *
 * - `current` 이 프로젝트·페이지·컴포넌트의 기록이고 해시·입력 지문이 모두 지금과 맞다
 * - `stale` 이 프로젝트·페이지의 기록·해시는 맞지만 그 뒤 입력이 바뀌었거나, 같은 자리에 있는 것이
 *   다른 컴포넌트(같은 이름의 다른 노드)의 출력이다
 * - `renamed` 이 자리에 파일은 없지만 같은 컴포넌트의 이전 이름 출력이 있다(이름 변경 뒤 아직 재생성 전)
 * - `changed` 기록은 있는데 파일 바이트가 확정 때와 다르다 — 늦은 쓰기·수동 수정·다른 writer
 * - `foreign` 바이트는 기록과 같지만 다른 프로젝트·페이지의 기록이거나 주인을 모르는 기록이다
 * - `unrecorded` 파일은 있지만 GUI가 수용한 기록이 없다
 * - `missing` 파일이 없다
 */
export type TicketFreshness = "current" | "stale" | "renamed" | "changed" | "foreign" | "unrecorded" | "missing";

export type OverallFreshness = "empty" | "current" | "missing" | "partial" | "stale" | "unverifiable";

export interface TicketFreshnessEntry {
  ticketId: string;
  componentName: string;
  /** `generated/` 기준 경로. */
  path: string;
  freshness: TicketFreshness;
  /** 기록이 있으면 그 요청 ID. 사람이 "어느 요청 결과인가"를 볼 수 있게 남긴다. */
  requestId?: string;
  /** `renamed`일 때 같은 컴포넌트의 이전 이름 파일(`generated/` 기준). */
  previousPath?: string;
}

/**
 * 이 페이지 자리에 남아 있지만 지금 티켓의 파일이 아닌, 이 프로젝트·페이지의 이전 출력(#281). 이름을
 * 바꾼 컴포넌트의 옛 파일(`renamed`)이거나 지금은 없는 컴포넌트의 파일(`removed`)이다. 앱은 지우지 않는다 —
 * 사람이 고쳤을 수 있고, 다음 웨이브가 끝나기 전에는 다른 파일이 아직 옛 이름을 import할 수 있다.
 */
export interface SupersededOutput {
  path: string;
  componentName: string;
  reason: "renamed" | "removed";
  /** `renamed`면 지금 이름의 파일 경로. */
  currentPath?: string;
  /** 확정 뒤 바이트가 바뀌었는가(수동 수정 등). */
  changed: boolean;
}

export interface FreshnessReport {
  overall: OverallFreshness;
  tickets: TicketFreshnessEntry[];
  superseded: SupersededOutput[];
}

export interface FreshnessInput {
  tickets: Ticket[];
  /** `generated/` 기준 경로의 파일. 이 페이지 자리 밖의 파일이 섞여 있어도 된다. */
  files: GeneratedFile[];
  manifest: GenerationManifest;
  /** 지금 프로젝트의 ID. 기록에 없는 프로젝트면 null — 어떤 기록도 이 프로젝트의 것으로 보지 않는다. */
  projectId: string | null;
  pageId: PageId;
  page: ScreenSpec;
  /** 이 페이지의 생성 자리(`generated/` 기준, `generationIdentity.pageOutputRoot`). 빈 문자열이면 이전 배치다. */
  root: string;
}

export function classifyOutputFreshness({
  tickets,
  files,
  manifest,
  projectId,
  pageId,
  page,
  root,
}: FreshnessInput): FreshnessReport {
  const contentByPath = new Map(files.map((file) => [file.path, file.content]));
  // 이 프로젝트·페이지가 이 자리에 남긴, 지금 파일이 있는 기록만 이름 변경 추적에 쓴다.
  const ownRecords = Object.entries(manifest.entries).filter(([path, entry]) =>
    projectId !== null && entry.projectId === projectId && entry.pageId === pageId &&
    relativeToRoot(root, path) !== null && contentByPath.has(path));
  const ticketByPath = new Map(tickets.map((ticket) => [generatedTicketPath(root, ticket), ticket]));

  const entries = tickets.map((ticket): TicketFreshnessEntry => {
    const path = generatedTicketPath(root, ticket);
    const key = ticketComponentKey(ticket);
    const base = { ticketId: ticket.id, componentName: ticket.componentName, path };
    const content = contentByPath.get(path);
    const record = manifest.entries[path];
    if (content === undefined) {
      const previous = ownRecords.find(([other, entry]) => other !== path && entry.componentKey === key);
      if (previous !== undefined) {
        return { ...base, freshness: "renamed", previousPath: previous[0], requestId: previous[1].requestId };
      }
      return { ...base, freshness: "missing", requestId: record?.requestId };
    }
    if (record === undefined) return { ...base, freshness: "unrecorded" };
    const withRequest = { ...base, requestId: record.requestId };
    if (contentHash(content) !== record.contentHash) return { ...withRequest, freshness: "changed" };
    if (projectId === null || record.projectId !== projectId || record.pageId !== pageId) {
      return { ...withRequest, freshness: "foreign" };
    }
    if (record.componentKey !== key || record.inputFingerprint !== ticketInputFingerprint(pageId, page, ticket)) {
      return { ...withRequest, freshness: "stale" };
    }
    return { ...withRequest, freshness: "current" };
  });

  const currentPathByKey = new Map([...ticketByPath].map(([path, ticket]) => [ticketComponentKey(ticket), path]));
  const superseded = ownRecords
    .filter(([path]) => !ticketByPath.has(path))
    .map(([path, entry]): SupersededOutput => {
      const currentPath = entry.componentKey === null ? undefined : currentPathByKey.get(entry.componentKey);
      return {
        path,
        componentName: entry.componentName,
        reason: currentPath === undefined ? "removed" : "renamed",
        ...(currentPath === undefined ? {} : { currentPath }),
        changed: contentHash(contentByPath.get(path) ?? "") !== entry.contentHash,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  // 이 자리에 있지만 티켓 파일이 아닌 파일도 ZIP에 함께 담기므로 전체 판정에 넣는다(#282 감사 보강). 이 프로젝트·
  // 페이지의 이전 출력(이름을 바꾼 컴포넌트의 옛 파일 등)은 지금 입력의 결과가 아니라 "오래됨"이다.
  const extras = files
    .filter((file) => !ticketByPath.has(file.path) && relativeToRoot(root, file.path) !== null)
    .map((file): TicketFreshness => {
      const record = manifest.entries[file.path];
      if (record === undefined) return "unrecorded";
      if (contentHash(file.content) !== record.contentHash) return "changed";
      if (projectId === null || record.projectId !== projectId || record.pageId !== pageId) return "foreign";
      return "stale";
    });

  return {
    overall: overallFreshness([...entries.map((entry) => entry.freshness), ...extras]),
    tickets: entries,
    superseded,
  };
}

function overallFreshness(values: TicketFreshness[]): OverallFreshness {
  if (values.length === 0) return "empty";
  if (values.every((value) => value === "current")) return "current";
  if (values.every((value) => value === "missing")) return "missing";
  // 수용하지 않은 바이트나 주인을 모르는 출력이 하나라도 섞이면 "부분"보다 먼저 알린다 — 늦은 쓰기나
  // 다른 프로젝트의 출력이 현재 파일들 사이에 묻히면 #284가 고친 오판정(4/4 성공)과 다를 바 없다.
  if (values.some((value) => value === "changed" || value === "unrecorded" || value === "foreign")) {
    return "unverifiable";
  }
  if (values.some((value) => value === "current")) return "partial";
  return "stale";
}
