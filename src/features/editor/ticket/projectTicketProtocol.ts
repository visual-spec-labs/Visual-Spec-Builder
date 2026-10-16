import type { ProjectSpec } from "@/features/editor/schema";
import { canonicalJson } from "@/features/editor/export/contentHash";
import { generatedTicketPath, isWindowsDeviceName } from "@/features/editor/export/generationIdentity";
import { WORKSPACE_MAX_BODY_BYTES } from "@/features/workspace/protocol";
import { isWorkspaceSegment } from "@/features/workspace/workspaceSegment";
import type { ProjectPlan } from "./types";
import { parseProjectInputSnapshot, projectInputSnapshotPath, type ProjectAssetMapping } from "./projectInputSnapshot";
import { TICKET_RESPONSE_PATH, type TicketRequestItem, type TicketResultItem } from "./ticketProtocol";

/** Additive project transport; TICKET_PROTOCOL_VERSION remains 3. */
export const PROJECT_TICKET_PROTOCOL_VERSION = 4;
export interface ProjectTicketRequestItem extends TicketRequestItem { sourcePageId: string }
export interface ProjectTicketRequest {
  protocol: 4; id: string; project: ProjectSpec; projectRoot: string; plan: ProjectPlan;
  tickets: ProjectTicketRequestItem[]; responsePath: string; outputRoot: string;
  assets: ProjectAssetMapping[]; inputSnapshotPath: string; inputSnapshotSha256: string;
}
export type ProjectProtocolErrorCode = "version-mismatch" | "malformed" | "duplicate-ticket" | "missing-ticket"
  | "unexpected-ticket" | "invalid-source" | "invalid-dependency" | "invalid-output-path" | "stale-input";
class ProjectProtocolError extends Error {
  constructor(public readonly code: ProjectProtocolErrorCode, message: string) { super(message); }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function segment(value: string): boolean {
  return isWorkspaceSegment(value) && !isWindowsDeviceName(value);
}

export function isProjectTicketRequestId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) && segment(value);
}

/** Shared path inventory validation for current requests and historical provenance plans. */
export function assertProjectOutputPaths(plan: ProjectPlan, projectRoot: string): void {
  if (!segment(projectRoot)) throw new ProjectProtocolError("invalid-output-path", "프로젝트 생성 폴더가 정규 경로가 아닙니다.");
  const paths = new Set<string>();
  for (const ticket of plan.tickets) {
    if (!segment(ticket.sourcePageId) || !segment(`${ticket.componentName}.tsx`)) {
      throw new ProjectProtocolError("invalid-output-path", "Windows에서도 유효한 페이지/컴포넌트 경로가 필요합니다.");
    }
    const path = generatedTicketPath(`${projectRoot}/${ticket.sourcePageId}`, ticket).toLowerCase();
    if (paths.has(path)) throw new ProjectProtocolError("invalid-output-path", "대소문자만 다른 생성 경로가 충돌합니다.");
    paths.add(path);
  }
  // Even if ticket filenames differ, case-only page IDs share a directory on Windows.
  const pageIds = [...new Set(plan.tickets.map(ticket => ticket.sourcePageId))];
  if (new Set(pageIds.map(id => id.toLowerCase())).size !== pageIds.length) {
    throw new ProjectProtocolError("invalid-output-path", "대소문자만 다른 PageId 생성 자리가 충돌합니다.");
  }
}

/** Dispatch this compact serialization; pretty-printing requires a fresh byte-budget check. */
export function serializeProjectTicketRequest(request: ProjectTicketRequest): string {
  const text = JSON.stringify(request);
  if (text.length > WORKSPACE_MAX_BODY_BYTES || new TextEncoder().encode(text).byteLength > WORKSPACE_MAX_BODY_BYTES) {
    throw new ProjectProtocolError("malformed", "프로젝트 요청이 32 MiB UTF-8 PUT 한도를 초과합니다.");
  }
  return text;
}

/** Caller supplies the manifest-owned projectRoot; this pure function does not assign ownership. */
export function buildProjectTicketRequest(args: {
  requestId: string; projectRoot: string; snapshotContent: string; snapshotSha256: string; ticketIds: string[];
}): ProjectTicketRequest {
  const { requestId, projectRoot, snapshotContent, snapshotSha256, ticketIds } = args;
  if (!isProjectTicketRequestId(requestId)) throw new ProjectProtocolError("invalid-output-path", "요청 ID가 Windows에서도 유효한 staging 폴더여야 합니다.");
  const parsed = parseProjectInputSnapshot(snapshotContent, snapshotSha256, requestId);
  if (!parsed.ok) throw new ProjectProtocolError("stale-input", parsed.error);
  if (!segment(projectRoot)) throw new ProjectProtocolError("invalid-output-path", "프로젝트 생성 폴더가 정규 경로가 아닙니다.");
  const { project, plan, assets } = parsed.snapshot;
  if (!ticketIds.length) throw new ProjectProtocolError("missing-ticket", "빈 프로젝트 wave는 전달하지 않습니다.");
  if (new Set(ticketIds).size !== ticketIds.length) throw new ProjectProtocolError("duplicate-ticket", "wave 티켓 ID가 중복됩니다.");
  assertProjectOutputPaths(plan, projectRoot);
  const byId = new Map(plan.tickets.map(ticket => [ticket.id, ticket]));
  const outputRoot = `staging/${requestId}`;
  const tickets = ticketIds.map(id => {
    const ticket = byId.get(id);
    if (!ticket) throw new ProjectProtocolError("unexpected-ticket", "계획에 없는 티켓/GUI 산출물은 wave에 넣을 수 없습니다.");
    if (ticket.dependsOn.some(dep => byId.get(dep)?.status !== "done")) {
      throw new ProjectProtocolError("invalid-dependency", "아직 수용되지 않은 선행 티켓이 있습니다.");
    }
    const filePath = generatedTicketPath(`${projectRoot}/${ticket.sourcePageId}`, ticket);
    return { id, sourcePageId: ticket.sourcePageId, componentName: ticket.componentName, kind: ticket.kind,
      instances: [...ticket.instances], filePath, outputPath: `${outputRoot}/${filePath}` };
  });
  const request: ProjectTicketRequest = { protocol: PROJECT_TICKET_PROTOCOL_VERSION, id: requestId, project, projectRoot, plan, tickets,
    responsePath: TICKET_RESPONSE_PATH, outputRoot,
    assets: assets.map(({ dataBase64: _data, ...mapping }) => mapping),
    inputSnapshotPath: projectInputSnapshotPath(requestId), inputSnapshotSha256: snapshotSha256 };
  serializeProjectTicketRequest(request);
  return request;
}

export type ProjectRequestValidation = { valid: true; request: ProjectTicketRequest }
  | { valid: false; code: ProjectProtocolErrorCode; message: string };

/** Checks complete request equality against verified immutable bytes and the expected ownership root. */
export function validateProjectTicketRequest(input: unknown, snapshotContent: string, expectedProjectRoot: string): ProjectRequestValidation {
  try {
    if (!record(input)) throw new ProjectProtocolError("malformed", "프로젝트 요청이 객체가 아닙니다.");
    if (input.protocol !== PROJECT_TICKET_PROTOCOL_VERSION) throw new ProjectProtocolError("version-mismatch", "프로젝트 요청은 protocol 4가 필요합니다. visual-spec skills로 스킬을 갱신하세요.");
    if (typeof input.id !== "string" || typeof input.inputSnapshotSha256 !== "string" || !Array.isArray(input.tickets)
      || input.tickets.some(ticket => !record(ticket) || typeof ticket.id !== "string")) {
      throw new ProjectProtocolError("malformed", "프로젝트 요청의 필수 필드가 잘못됐습니다.");
    }
    JSON.stringify(input, (_key, value: unknown) => {
      if (["undefined", "function", "symbol", "bigint"].includes(typeof value)
        || (typeof value === "number" && !Number.isFinite(value))) throw new ProjectProtocolError("malformed", "요청에는 JSON 값만 허용합니다.");
      return value;
    });
    if (input.projectRoot !== expectedProjectRoot) throw new ProjectProtocolError("invalid-output-path", "프로젝트 소유 생성 폴더와 다릅니다.");
    const expected = buildProjectTicketRequest({ requestId: input.id, projectRoot: expectedProjectRoot,
      snapshotContent, snapshotSha256: input.inputSnapshotSha256, ticketIds: input.tickets.map(ticket => ticket.id as string) });
    if (input.tickets.some((ticket, index) => ticket.sourcePageId !== expected.tickets[index].sourcePageId)) {
      throw new ProjectProtocolError("invalid-source", "wave의 sourcePageId가 정본 티켓과 다릅니다.");
    }
    if (input.outputRoot !== expected.outputRoot || input.responsePath !== expected.responsePath || input.inputSnapshotPath !== expected.inputSnapshotPath
      || input.tickets.some((ticket, index) => ticket.filePath !== expected.tickets[index].filePath || ticket.outputPath !== expected.tickets[index].outputPath)) {
      throw new ProjectProtocolError("invalid-output-path", "wave/request 경로가 정본 경로와 다릅니다.");
    }
    if (canonicalJson(input) !== canonicalJson(expected)) throw new ProjectProtocolError("malformed", "요청 필드가 검증한 snapshot/계획/wave와 정확히 일치하지 않습니다.");
    return { valid: true, request: expected };
  } catch (error) {
    return { valid: false, code: error instanceof ProjectProtocolError ? error.code : "malformed",
      message: error instanceof Error ? error.message : "프로젝트 요청을 검증하지 못했습니다." };
  }
}

export type ProjectTicketResponse = { kind: "stale" } | { kind: "results"; results: TicketResultItem[] }
  | { kind: "malformed"; code: ProjectProtocolErrorCode; message: string };

/** Stale request IDs take precedence; current responses require the exact wave ID set. */
export function parseProjectTicketResponse(text: string, request: Pick<ProjectTicketRequest, "id" | "tickets">): ProjectTicketResponse {
  try {
    const body: unknown = JSON.parse(text);
    if (!record(body)) throw new ProjectProtocolError("malformed", "응답이 객체가 아닙니다.");
    if (body.requestId !== request.id) return { kind: "stale" };
    if (body.protocol !== PROJECT_TICKET_PROTOCOL_VERSION) throw new ProjectProtocolError("version-mismatch",
      typeof body.protocol === "number" && body.protocol > PROJECT_TICKET_PROTOCOL_VERSION
        ? "에이전트가 더 새로운 프로젝트 규약으로 응답했습니다. GUI를 업데이트한 뒤 다시 전달하세요."
        : "프로젝트 응답은 protocol 4가 필요합니다. visual-spec skills로 스킬을 갱신하세요.");
    if (Object.keys(body).sort().join(",") !== "protocol,requestId,results" || !Array.isArray(body.results)) {
      throw new ProjectProtocolError("malformed", "응답의 필수/추가 필드가 규약과 다릅니다.");
    }
    const seen = new Set<string>();
    const expected = new Set(request.tickets.map(ticket => ticket.id));
    if (!expected.size || expected.size !== request.tickets.length) throw new ProjectProtocolError("malformed", "기대 wave가 비었거나 중복됩니다.");
    for (const item of body.results) {
      if (!record(item) || typeof item.ticketId !== "string" || (item.status !== "done" && item.status !== "failed")
        || Object.keys(item).some(key => !["ticketId", "status", "message"].includes(key))
        || (Object.hasOwn(item, "message") && typeof item.message !== "string")
        || (item.status === "failed" && (typeof item.message !== "string" || !item.message.trim()))) {
        throw new ProjectProtocolError("malformed", "결과 항목이 규약과 다르거나 실패 사유가 없습니다.");
      }
      if (seen.has(item.ticketId)) throw new ProjectProtocolError("duplicate-ticket", "응답 티켓 ID가 중복됩니다.");
      if (!expected.has(item.ticketId)) throw new ProjectProtocolError("unexpected-ticket", "요청하지 않은 티켓/GUI 산출물 결과입니다.");
      seen.add(item.ticketId);
    }
    if (seen.size !== expected.size) throw new ProjectProtocolError("missing-ticket", "wave 결과가 누락됐습니다.");
    return { kind: "results", results: body.results as TicketResultItem[] };
  } catch (error) {
    return { kind: "malformed", code: error instanceof ProjectProtocolError ? error.code : "malformed",
      message: error instanceof Error ? error.message : "프로젝트 응답을 읽지 못했습니다." };
  }
}
