/**
 * 티켓 웨이브 응답의 출력 파일을 수용·확정한다 — 임시 출력(staging) → `generated/` (이슈 #284, #282).
 *
 * 에이전트는 요청마다 다른 `staging/<requestId>/…`에 쓴다(`ticketProtocol.ts` 규약 v2). 이 파일은
 * **앱이 `generated/`를 바꾸는 유일한 자리**다. 호출부(`ui/ticketRunner.ts`)는 현재 요청·현재 티켓
 * 세대·미취소를 확인한 뒤에만 여기를 부른다. 그래서 취소·만료·재컴파일된 요청이 늦게 쓴 파일은
 * 그 요청의 임시 폴더에 남고 `generated/`에 닿지 않는다(docs/26 "확정 조건").
 *
 * ## 쓰기 전 수동 변경 보호(#282)
 *
 * 확정은 두 단계다. `planTicketOutputs`가 바꿀 파일마다 지금 바이트를 읽어 판정하고
 * (`export/overwriteGuard.ts`), 사람이 고쳤거나 누구 것인지 모르는 파일이 있으면 호출부가 사용자에게
 * 보존/덮어쓰기를 묻는다. `commitTicketOutputs`는 그 선택으로 아래 순서를 지킨다.
 *
 * 1. **백업** — 바꿀 기존 파일의 바이트를 `backups/<runId>/files/<경로>`에 새 파일로 쓰고, 되돌리기
 *    기록(`run.json`)을 남긴다. 하나라도 실패하면 아무것도 쓰지 않는다.
 * 2. **재비교** — 확인 당시 버전과 지금 버전을 모두 다시 본다. 하나라도 다르면 아무것도 쓰지 않는다.
 * 3. **쓰기** — 파일마다 기대 버전을 실어 쓴다(서버가 마지막으로 비교한다). 중간에 실패하면 이미 쓴
 *    파일을 같은 방식(기대 버전 = 방금 쓴 바이트)으로 되돌린다 — 그 사이 누가 고쳤으면 되돌리지 않는다.
 * 4. **기록** — 모두 썼을 때만 수용 기록을 갱신한다.
 *
 * 서버의 파일별 원자 쓰기와 기대 버전 비교는 **여러 파일 트랜잭션이 아니다.** 위 순서는 그 위에
 * 쌓은 보상(되돌리기)이고, 외부 에이전트처럼 HTTP를 거치지 않는 writer는 막지 못한다 — 서버 비교와
 * 디스크 rename 사이의 아주 짧은 틈도 남는다. 보호 범위는 docs/26 "#282 보호 범위"에 적었다.
 */

import { contentHash, inputFingerprint, sha256Hex } from "@/features/editor/export/contentHash";
import {
  GENERATION_MANIFEST_PATH,
  parseGenerationManifest,
  withManifestUpdates,
  type ManifestEntry,
} from "@/features/editor/export/generationManifest";
import {
  classifyOverwrite,
  needsDecision,
  shouldWrite,
  type OverwriteDecision,
  type OverwriteOwner,
  type OverwriteReview,
  type OverwriteTarget,
  type RegenerationRunSummary,
} from "@/features/editor/export/overwriteGuard";
import type { PageId, ScreenSpec } from "@/features/editor/schema";
import { ticketOutputPath, type TicketResultItem } from "@/features/editor/ticket/ticketProtocol";
import { ticketFilePath } from "@/features/editor/export/generatedPaths";
import type { Ticket } from "@/features/editor/ticket/types";
import { BACKUP_DIR, GENERATED_DIR, WORKSPACE_MISSING_REVISION } from "@/features/workspace/protocol";

import {
  deleteWorkspaceFile,
  readWorkspaceFileSnapshot,
  readWorkspaceTextFileStrict,
  writeWorkspaceFile,
} from "./workspaceClient";

const TEXT_TYPE = "text/plain; charset=utf-8";

export interface TicketOutputAcceptanceInput {
  requestId: string;
  /** 요청에 실었던 입력 — 수용 기록의 입력 지문이 된다. 지금 편집 중인 페이지가 아니다. */
  pageId: PageId;
  page: ScreenSpec;
  /** 요청 때 열려 있던 프로젝트의 작업공간 파일 이름(#282). 저장하지 않은 문서면 null. */
  projectKey: string | null;
  /** 이 웨이브에 실었던 티켓들. 결과에 다른 id가 섞여 있으면 무시한다. */
  waveTickets: Ticket[];
  results: TicketResultItem[];
}

/** 쓰기 전 판정까지 마친 확정 계획. 아직 `generated/`는 그대로다. */
export interface TicketOutputPlan {
  requestId: string;
  pageId: PageId;
  fingerprint: string;
  owner: OverwriteOwner;
  /** 응답 순서 그대로의 결과. 출력이 없거나 읽지 못한 `done`은 이미 `failed`로 바뀌어 있다. */
  results: TicketResultItem[];
  /** 확정 후보(이 요청의 임시 출력이 있는 `done` 티켓). */
  targets: OverwriteTarget[];
  /** 영향 파일 목록과 diff 재료. 사용자 확인 화면이 그대로 쓴다. */
  review: OverwriteReview;
}

export interface TicketOutputAcceptance {
  /** 수용 결과를 반영한 결과 목록. `done`이어도 출력이 없거나 확정·보존·중단되면 `failed`로 바뀐다. */
  results: TicketResultItem[];
  /** 파일은 확정했지만 수용 기록을 남기지 못했을 때의 안내. Export는 이 파일들을 "확인 불가"로 본다. */
  manifestError: string | null;
  /** 바꾼 파일이 있으면 그 실행. 없거나 중단했으면 null. */
  run: RegenerationRunSummary | null;
}

function failed(ticketId: string, message: string): TicketResultItem {
  return { ticketId, status: "failed", message };
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function createRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 마지막 정상 생성의 텍스트를 찾는다 — 수동 변경 diff의 기준. 수용 기록이 가리키는 요청의 임시
 * 출력이 아직 있고 그 해시가 기록과 같을 때만 쓴다(임시 출력은 지우지 않으므로 대개 남아 있다).
 * 확인할 수 없으면 null이고, 화면은 "현재 → 새 출력" diff만 보인다.
 */
async function readBaseline(path: string, record: ManifestEntry | null): Promise<string | null> {
  if (record === null) return null;
  const staged = await readWorkspaceTextFileStrict(ticketOutputPath(record.requestId, path));
  if (!staged.ok || staged.text === null || contentHash(staged.text) !== record.contentHash) return null;
  return staged.text;
}

export async function planTicketOutputs({
  requestId,
  pageId,
  page,
  projectKey,
  waveTickets,
  results,
}: TicketOutputAcceptanceInput): Promise<TicketOutputPlan> {
  const byId = new Map(waveTickets.map((ticket) => [ticket.id, ticket]));
  const owner: OverwriteOwner = { projectKey, pageId };
  const manifestText = await readWorkspaceTextFileStrict(GENERATION_MANIFEST_PATH);
  // 기록을 읽지 못하면 기록이 없는 것으로 판정한다 — 기존 파일은 모두 확인 대상이 된다(덮어쓰는 쪽으로 기울지 않는다).
  const manifest = parseGenerationManifest(manifestText.ok ? manifestText.text : null);
  const planned: TicketResultItem[] = [];
  const targets: OverwriteTarget[] = [];
  const review: OverwriteReview = { requestId, items: [] };

  for (const result of results) {
    const ticket = byId.get(result.ticketId);
    if (ticket === undefined || result.status !== "done") {
      planned.push(result);
      continue;
    }

    const filePath = ticketFilePath(ticket);
    const staged = await readWorkspaceTextFileStrict(ticketOutputPath(requestId, filePath));
    // 에이전트의 "done"만으로는 완료로 치지 않는다 — 이 요청의 임시 출력이 실제로 있어야 한다.
    // 응답보다 파일이 늦게 오는 부분 도착이 여기서 걸린다.
    if (!staged.ok) {
      planned.push(failed(ticket.id, `임시 출력 ${filePath}을(를) 읽지 못해 확정하지 않았습니다. 다시 전달하세요.`));
      continue;
    }
    if (staged.text === null || staged.text.trim() === "") {
      planned.push(failed(ticket.id, `완료 응답이지만 이 요청의 임시 출력 ${filePath}이(가) 없거나 비어 있어 확정하지 않았습니다.`));
      continue;
    }
    // 지금 파일을 읽지 못하면 "없음"으로 치지 않는다 — 없는 줄 알고 쓰면 사람이 고친 파일을 덮는다.
    const current = await readWorkspaceFileSnapshot(`${GENERATED_DIR}/${filePath}`);
    if (!current.ok) {
      planned.push(failed(ticket.id, `지금 ${filePath}을(를) 확인하지 못해 확정하지 않았습니다. 작업공간 연결을 확인하세요.`));
      continue;
    }

    const record = manifest.entries[filePath] ?? null;
    const target = classifyOverwrite({ path: filePath, ticketId: ticket.id, current: current.snapshot, next: staged.text, record, owner });
    targets.push(target);
    planned.push(result);
    const decide = needsDecision(target);
    review.items.push({
      path: filePath,
      ticketId: ticket.id,
      ownership: target.ownership,
      currentText: decide && target.current !== null ? decodeText(target.current.bytes) : null,
      nextText: staged.text,
      baselineText: decide ? await readBaseline(filePath, record) : null,
    });
  }

  return { requestId, pageId, fingerprint: inputFingerprint(pageId, page), owner, results: planned, targets, review };
}

/** 사용자 확인이 필요한 파일이 있는가. */
export function planNeedsReview(plan: TicketOutputPlan): boolean {
  return plan.targets.some(needsDecision);
}

/** `backups/<runId>/run.json` — 되돌리기 기록. GUI만 쓰고 읽는다. */
interface RunRecordFile {
  path: string;
  ticketId: string;
  /** 바꾸기 전 바이트의 버전. 새로 만든 파일이면 null. */
  previousRevision: string | null;
  /** 바꾸기 전 바이트의 백업(작업공간 루트 기준). 새로 만든 파일이면 null. */
  backupPath: string | null;
  /** 이번에 쓴 바이트의 버전. 되돌리기는 지금 파일이 이 버전일 때만 손댄다. */
  writtenRevision: string;
  /** 바꾸기 전 수용 기록. 되돌리면 이 값으로 돌아간다(없었으면 지운다). */
  previousEntry: ManifestEntry | null;
}

interface RunRecord {
  protocol: 1;
  runId: string;
  requestId: string;
  createdAt: string;
  files: RunRecordFile[];
}

const runRoot = (runId: string) => `${BACKUP_DIR}/${runId}`;
const runRecordPath = (runId: string) => `${runRoot(runId)}/run.json`;

function textRevision(text: string): string {
  return sha256Hex(new TextEncoder().encode(text));
}

/** 이미 쓴 파일을 쓰기 전으로 되돌린다. 지금 바이트가 이번에 쓴 그대로일 때만(서버 비교) 손댄다. */
async function revertFile(file: RunRecordFile, previous: Uint8Array | null): Promise<"restored" | "conflict" | "failed"> {
  const target = `${GENERATED_DIR}/${file.path}`;
  const outcome = previous === null
    ? await deleteWorkspaceFile(target, file.writtenRevision)
    : await writeWorkspaceFile(target, bytesBody(previous), TEXT_TYPE, file.writtenRevision);
  if (outcome.ok) return "restored";
  return outcome.status === 409 ? "conflict" : "failed";
}

/** `fetch` 본문으로 넘길 바이트. 타입 정의가 공유 버퍼 뷰를 받지 않아 새 버퍼로 복사한다. */
function bytesBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/**
 * 계획을 사용자 선택대로 확정한다. 확인 대상 파일은 `decisions[path] === "overwrite"`일 때만 쓰고,
 * 나머지는 보존한다(그 티켓은 `failed` — 새 출력은 임시 폴더에 남는다).
 */
export async function commitTicketOutputs(
  plan: TicketOutputPlan,
  decisions: Readonly<Record<string, OverwriteDecision>> = {},
  { now = () => new Date(), runId = createRunId() }: { now?: () => Date; runId?: string } = {},
): Promise<TicketOutputAcceptance> {
  const byTicket = new Map(plan.targets.map((target) => [target.ticketId, target]));
  const writes = plan.targets.filter((target) => shouldWrite(target, decisions));
  const abort = (message: string): TicketOutputAcceptance => ({
    results: plan.results.map((result) => (byTicket.has(result.ticketId) ? failed(result.ticketId, message) : result)),
    manifestError: null,
    run: null,
  });

  // 1. 백업과 되돌리기 기록. 백업은 새 파일로만 쓰고(기대 버전 missing), 서버가 돌려준 버전이 원본
  //    바이트의 버전과 같아야 성공이다 — 반쪽 백업을 믿고 덮어쓰지 않는다.
  const files: RunRecordFile[] = [];
  for (const target of writes) {
    const backupPath = target.current === null ? null : `${runRoot(runId)}/files/${target.path}`;
    if (target.current !== null && backupPath !== null) {
      const backup = await writeWorkspaceFile(backupPath, bytesBody(target.current.bytes), TEXT_TYPE, WORKSPACE_MISSING_REVISION);
      if (!backup.ok || (backup.revision !== undefined && backup.revision !== target.current.revision)) {
        return abort(`${target.path}의 백업에 실패해 아무 파일도 바꾸지 않았습니다${backup.ok ? "" : ` — ${backup.error}`}.`);
      }
    }
    files.push({
      path: target.path,
      ticketId: target.ticketId,
      previousRevision: target.current?.revision ?? null,
      backupPath,
      writtenRevision: textRevision(target.next),
      previousEntry: target.record,
    });
  }
  if (files.length > 0) {
    const record: RunRecord = { protocol: 1, runId, requestId: plan.requestId, createdAt: now().toISOString(), files };
    const saved = await writeWorkspaceFile(runRecordPath(runId), JSON.stringify(record, null, 2), "application/json", WORKSPACE_MISSING_REVISION);
    if (!saved.ok) return abort(`되돌리기 기록을 남기지 못해 아무 파일도 바꾸지 않았습니다 — ${saved.error}.`);
  }

  // 2. 확정 직전 재비교. 사용자가 확인한 뒤 누가 파일을 고쳤으면 하나도 쓰지 않는다.
  for (const target of writes) {
    const again = await readWorkspaceFileSnapshot(`${GENERATED_DIR}/${target.path}`);
    const expected = target.current?.revision ?? WORKSPACE_MISSING_REVISION;
    const actual = again.ok ? (again.snapshot?.revision ?? WORKSPACE_MISSING_REVISION) : null;
    if (actual !== expected) {
      return abort(actual === null
        ? `${target.path}을(를) 다시 확인하지 못해 아무 파일도 바꾸지 않았습니다.`
        : `확인한 뒤 ${target.path}이(가) 바뀌어 아무 파일도 바꾸지 않았습니다. 다시 전달해 새로 확인하세요.`);
    }
  }

  // 3. 쓰기. 파일마다 확인 당시 버전을 기대 버전으로 싣는다.
  const written: RunRecordFile[] = [];
  for (const [index, target] of writes.entries()) {
    const outcome = await writeWorkspaceFile(
      `${GENERATED_DIR}/${target.path}`,
      target.next,
      TEXT_TYPE,
      target.current?.revision ?? WORKSPACE_MISSING_REVISION,
    );
    if (!outcome.ok) {
      const leftovers = await rollback(written, writes);
      const reason = outcome.status === 409 ? "확인한 뒤 파일이 바뀌었습니다" : outcome.error;
      return abort(`${target.path} 쓰기에 실패해(${reason}) 이번 적용을 되돌렸습니다.${leftovers}`);
    }
    written.push(files[index]);
  }

  // 4. 수용 기록. 쓴 파일과, 이미 새 출력과 같던 파일만 이 요청의 결과로 기록한다.
  const acceptedAt = now().toISOString();
  const entries: Record<string, ManifestEntry> = {};
  for (const target of plan.targets) {
    if (!shouldWrite(target, decisions) && target.ownership !== "unchanged") continue;
    entries[target.path] = {
      requestId: plan.requestId,
      ticketId: target.ticketId,
      pageId: plan.pageId,
      inputFingerprint: plan.fingerprint,
      contentHash: contentHash(target.next),
      acceptedAt,
      projectKey: plan.owner.projectKey,
    };
  }
  const results = plan.results.map((result) => {
    const target = byTicket.get(result.ticketId);
    if (target === undefined || entries[target.path] !== undefined) return result;
    return failed(result.ticketId, `기존 ${target.path}을(를) 보존해 바꾸지 않았습니다. 새 출력은 ${ticketOutputPath(plan.requestId, target.path)}에 남아 있습니다.`);
  });
  const manifestError = Object.keys(entries).length === 0 ? null : await recordAcceptance(entries);
  return {
    results,
    manifestError,
    run: files.length === 0 ? null : { runId, paths: files.map((file) => file.path), backupRoot: runRoot(runId) },
  };
}

/** 중간 실패 보상. 되돌리지 못한 파일이 있으면 안내 문구를 돌려준다. */
async function rollback(written: RunRecordFile[], writes: OverwriteTarget[]): Promise<string> {
  const byPath = new Map(writes.map((target) => [target.path, target]));
  const left: string[] = [];
  for (const file of [...written].reverse()) {
    const previous = byPath.get(file.path)?.current?.bytes ?? null;
    if ((await revertFile(file, previous)) !== "restored") left.push(file.path);
  }
  return left.length === 0 ? "" : ` 되돌리지 못한 파일: ${left.join(", ")} — 그 사이 바뀌었거나 쓰지 못했습니다. 원본은 백업에 있습니다.`;
}

/**
 * 수용 기록에 확정한 항목을 합친다. 읽기에 실패하면 쓰지 않는다 — 없는 줄 알고 빈 기록으로
 * 덮으면 다른 파일들의 기록까지 지운다. 실패해도 판정은 "확인 불가"로 기울 뿐 거짓 "현재"가
 * 되지 않는다(docs/26 "수용 기록 형식").
 */
async function recordAcceptance(updates: Record<string, ManifestEntry | null>): Promise<string | null> {
  const current = await readWorkspaceTextFileStrict(GENERATION_MANIFEST_PATH);
  if (!current.ok) {
    return "생성 기록을 읽지 못해 이번 변경을 기록하지 않았습니다. Export에서 이 파일들은 확인 불가로 보입니다.";
  }
  const next = withManifestUpdates(parseGenerationManifest(current.text), updates);
  const written = await writeWorkspaceFile(
    GENERATION_MANIFEST_PATH,
    JSON.stringify(next, null, 2),
    "application/json",
  );
  return written.ok
    ? null
    : `생성 기록을 저장하지 못했습니다 — ${written.error}. Export에서 이 파일들은 확인 불가로 보입니다.`;
}

export interface RestoreReport {
  /** 되돌린 경로. */
  restored: string[];
  /** 적용 뒤 다시 바뀌어(더 새로운 수정) 손대지 않은 경로. */
  conflicts: string[];
  /** 백업을 읽지 못했거나 쓰지 못한 경로. */
  failed: string[];
  /** 실행 기록을 찾지 못했거나 기록을 갱신하지 못했을 때의 안내. */
  error: string | null;
}

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<RunRecord>;
  return record.protocol === 1 && typeof record.runId === "string" && Array.isArray(record.files) &&
    record.files.every((file) => typeof file === "object" && file !== null && typeof file.path === "string" &&
      typeof file.writtenRevision === "string" &&
      (file.backupPath === null || typeof file.backupPath === "string") &&
      (file.previousRevision === null || typeof file.previousRevision === "string"));
}

/**
 * 한 번의 적용을 되돌린다. 파일마다 **지금 바이트가 그 적용이 쓴 그대로일 때만** 백업으로 돌려놓고
 * (새로 만든 파일은 지운다), 서버도 같은 기대 버전으로 마지막 비교를 한다. 적용 뒤 누가 고친 파일은
 * 더 새로운 수정이므로 건드리지 않고 `conflicts`로 알린다. 되돌린 파일의 수용 기록은 이전 값으로 간다.
 */
export async function restoreRegenerationRun(runId: string): Promise<RestoreReport> {
  const report: RestoreReport = { restored: [], conflicts: [], failed: [], error: null };
  const text = await readWorkspaceTextFileStrict(runRecordPath(runId));
  let record: unknown = null;
  try { record = text.ok && text.text !== null ? JSON.parse(text.text) : null; } catch { record = null; }
  if (!isRunRecord(record)) return { ...report, error: "되돌리기 기록을 찾지 못했습니다. 백업 폴더를 직접 확인하세요." };

  const updates: Record<string, ManifestEntry | null> = {};
  for (const file of [...record.files].reverse()) {
    const present = await readWorkspaceFileSnapshot(`${GENERATED_DIR}/${file.path}`);
    if (!present.ok) { report.failed.push(file.path); continue; }
    if ((present.snapshot?.revision ?? WORKSPACE_MISSING_REVISION) !== file.writtenRevision) {
      report.conflicts.push(file.path);
      continue;
    }
    let previous: Uint8Array | null = null;
    if (file.backupPath !== null) {
      const backup = await readWorkspaceFileSnapshot(file.backupPath);
      // 백업이 기록한 원본 버전과 다르면 믿지 않는다 — 망가진 백업으로 덮으면 되돌리기가 아니다.
      if (!backup.ok || backup.snapshot === null || backup.snapshot.revision !== file.previousRevision) {
        report.failed.push(file.path);
        continue;
      }
      previous = backup.snapshot.bytes;
    }
    const outcome = await revertFile(file, previous);
    if (outcome === "restored") {
      report.restored.push(file.path);
      updates[file.path] = file.previousEntry;
    } else if (outcome === "conflict") {
      report.conflicts.push(file.path);
    } else {
      report.failed.push(file.path);
    }
  }
  if (Object.keys(updates).length > 0) report.error = await recordAcceptance(updates);
  return report;
}
