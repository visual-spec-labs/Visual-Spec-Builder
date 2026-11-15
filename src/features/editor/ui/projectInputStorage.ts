import type { ProjectSpec } from "@/features/editor/schema";
import type { ProjectPlan } from "@/features/editor/ticket/types";
import { buildProjectInputSnapshot, createProjectAssetSnapshot, projectAssetPaths } from "@/features/editor/ticket/projectInputSnapshot";
import { buildProjectTicketRequest } from "@/features/editor/ticket/projectTicketProtocol";
import { validateProjectPlanContext } from "@/features/editor/ticket/compileProjectTickets";
import { WORKSPACE_MISSING_REVISION } from "@/features/workspace/protocol";
import { readWorkspaceFileSnapshot, writeWorkspaceFile } from "./workspaceClient";

/** Prepare immutable input before dispatch. Does not publish ticket-request or change editor state. */
export async function prepareStoredProjectRequest(args: {
  requestId: string; project: ProjectSpec; plan: ProjectPlan; projectRoot: string; ticketIds: string[];
  isCurrent: () => boolean; signal?: AbortSignal;
}) {
  // Capture before awaiting I/O, so later editor mutations cannot alter this request.
  const project = structuredClone(args.project); const plan = structuredClone(args.plan);
  const { requestId, projectRoot } = args;
  const ticketIds = [...args.ticketIds];
  const assertCurrent = () => {
    if (args.signal?.aborted || !args.isCurrent()) throw Error("프로젝트 입력 준비가 취소되거나 문서 세대가 바뀌었습니다.");
  };
  assertCurrent();
  const validated = validateProjectPlanContext(plan, project);
  if (!validated.valid) throw Error(validated.issues.map(issue => issue.message).join("\n"));
  const assets = [];
  for (const path of projectAssetPaths(project)) {
    assertCurrent();
    const read = await readWorkspaceFileSnapshot(path, args.signal);
    assertCurrent();
    if (!read.ok || read.snapshot === null) throw Error(`프로젝트 자산을 읽지 못했습니다: ${path}`);
    assets.push(createProjectAssetSnapshot(path, read.snapshot.bytes));
  }
  const snapshot = buildProjectInputSnapshot(requestId, project, plan, assets);
  // Reject invalid waves/ownership paths before creating even the immutable input file.
  const request = buildProjectTicketRequest({ requestId, projectRoot,
    snapshotContent: snapshot.content, snapshotSha256: snapshot.sha256, ticketIds });
  assertCurrent();
  const written = await writeWorkspaceFile(snapshot.path, snapshot.content, "application/json; charset=utf-8", WORKSPACE_MISSING_REVISION, undefined, args.signal);
  assertCurrent();
  // A CAS collision is reusable only after exact readback. Other errors stay errors,
  // including ambiguous transport failures; a retry must use a new request ID.
  if (!written.ok && written.status !== 409) throw Error(`프로젝트 입력 저장에 실패했습니다: ${written.error}`);
  const confirmed = await readWorkspaceFileSnapshot(snapshot.path, args.signal);
  assertCurrent();
  if (!confirmed.ok || confirmed.snapshot === null || confirmed.snapshot.revision !== snapshot.sha256
    || new TextDecoder("utf-8", { fatal: true }).decode(confirmed.snapshot.bytes) !== snapshot.content) {
    throw Error("프로젝트 입력 저장 바이트가 일치하지 않습니다. 새 요청으로 다시 시도하세요.");
  }
  return { request, snapshot };
}
