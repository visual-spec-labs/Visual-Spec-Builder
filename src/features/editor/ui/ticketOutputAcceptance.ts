/**
 * 티켓 웨이브 응답의 출력 파일을 수용·확정한다 — 임시 출력(staging) → `generated/` (이슈 #284).
 *
 * 에이전트는 요청마다 다른 `staging/<requestId>/…`에 쓴다(`ticketProtocol.ts` 규약 v2). 이 파일은
 * **앱이 `generated/`를 바꾸는 유일한 자리**다. 호출부(`ui/ticketRunner.ts`)는 현재 요청·현재 티켓
 * 세대·미취소를 확인한 뒤에만 여기를 부른다. 그래서 취소·만료·재컴파일된 요청이 늦게 쓴 파일은
 * 그 요청의 임시 폴더에 남고 `generated/`에 닿지 않는다(docs/26 "확정 조건").
 *
 * 쓰기 전 수동 변경 보호(#282)는 여기 없다 — 지금 확정은 v1 스킬이 그랬듯 같은 경로를 덮어쓴다.
 * #282가 "덮어쓰기 전 기록 해시와 현재 파일 비교 → 사용자 선택"을 끼울 자리가 이 함수다.
 */

import { contentHash, inputFingerprint } from "@/features/editor/export/contentHash";
import {
  GENERATION_MANIFEST_PATH,
  parseGenerationManifest,
  withManifestEntries,
  type ManifestEntry,
} from "@/features/editor/export/generationManifest";
import type { PageId, ScreenSpec } from "@/features/editor/schema";
import { ticketOutputPath, type TicketResultItem } from "@/features/editor/ticket/ticketProtocol";
import { ticketFilePath } from "@/features/editor/export/generatedPaths";
import type { Ticket } from "@/features/editor/ticket/types";
import { GENERATED_DIR } from "@/features/workspace/protocol";

import { readWorkspaceTextFileStrict, writeWorkspaceFile } from "./workspaceClient";

export interface TicketOutputAcceptanceInput {
  requestId: string;
  /** 요청에 실었던 입력 — 수용 기록의 입력 지문이 된다. 지금 편집 중인 페이지가 아니다. */
  pageId: PageId;
  page: ScreenSpec;
  /** 이 웨이브 전체와 결과 ID 집합이 정확히 같아야 한다. */
  waveTickets: Ticket[];
  results: TicketResultItem[];
  /** 기록 시각. 테스트가 고정한다. */
  now?: () => Date;
  isCurrent: () => boolean;
  renew: () => Promise<boolean>;
}

export interface TicketOutputAcceptance {
  /** 수용 결과를 반영한 결과 목록. `done`이어도 출력이 없거나 확정에 실패하면 `failed`로 바뀐다. */
  results: TicketResultItem[];
  /** 파일은 확정했지만 수용 기록을 남기지 못했을 때의 안내. Export는 이 파일들을 "확인 불가"로 본다. */
  manifestError: string | null;
}

function failed(ticketId: string, message: string): TicketResultItem {
  return { ticketId, status: "failed", message };
}

export async function acceptTicketOutputs({
  requestId,
  pageId,
  page,
  waveTickets,
  results,
  now = () => new Date(),
  isCurrent,
  renew,
}: TicketOutputAcceptanceInput): Promise<TicketOutputAcceptance> {
  const byId = new Map(waveTickets.map((ticket) => [ticket.id, ticket]));
  // Validate the whole wave before any I/O: no contradictory, foreign or omitted status.
  const ids = new Set(results.map((result) => result.ticketId));
  if (ids.size !== results.length || ids.size !== byId.size || [...ids].some((id) => !byId.has(id))) {
    return { results: waveTickets.map((ticket) => failed(ticket.id, "응답 티켓이 중복되거나 요청 목록과 다릅니다. 다시 전달하세요.")), manifestError: null };
  }
  const fingerprint = inputFingerprint(pageId, page);
  const accepted: TicketResultItem[] = [];
  const entries: Record<string, ManifestEntry> = {};

  for (const result of results) {
    const ticket = byId.get(result.ticketId);
    if (ticket === undefined || result.status !== "done") {
      accepted.push(result);
      continue;
    }

    if (!isCurrent()) { accepted.push(failed(ticket.id, "취소되거나 다시 생성된 요청입니다.")); continue; }
    const filePath = ticketFilePath(ticket);
    const staged = await readWorkspaceTextFileStrict(ticketOutputPath(requestId, filePath));
    // 에이전트의 "done"만으로는 완료로 치지 않는다 — 이 요청의 임시 출력이 실제로 있어야 한다.
    // 응답보다 파일이 늦게 오는 부분 도착이 여기서 걸린다.
    if (!staged.ok) {
      accepted.push(failed(ticket.id, `임시 출력 ${filePath}을(를) 읽지 못해 확정하지 않았습니다. 다시 전달하세요.`));
      continue;
    }
    if (staged.text === null || staged.text.trim() === "") {
      accepted.push(failed(ticket.id, `완료 응답이지만 이 요청의 임시 출력 ${filePath}이(가) 없거나 비어 있어 확정하지 않았습니다.`));
      continue;
    }

    if (!isCurrent() || !await renew() || !isCurrent()) {
      accepted.push(failed(ticket.id, "요청이 취소되거나 잠금을 잃어 확정하지 않았습니다."));
      continue;
    }
    const written = await writeWorkspaceFile(
      `${GENERATED_DIR}/${filePath}`,
      staged.text,
      "text/plain; charset=utf-8",
      undefined,
      requestId,
    );
    if (!written.ok) {
      accepted.push(failed(ticket.id, `${filePath} 확정에 실패했습니다 — ${written.error}`));
      continue;
    }

    entries[filePath] = {
      requestId,
      ticketId: ticket.id,
      pageId,
      inputFingerprint: fingerprint,
      contentHash: contentHash(staged.text),
      acceptedAt: now().toISOString(),
    };
    accepted.push(result);
  }

  if (Object.keys(entries).length === 0) return { results: accepted, manifestError: null };
  return { results: accepted, manifestError: await recordAcceptance(entries, requestId) };
}

/**
 * 수용 기록에 확정한 항목을 합친다. 읽기에 실패하면 쓰지 않는다 — 없는 줄 알고 빈 기록으로
 * 덮으면 다른 파일들의 기록까지 지운다. 실패해도 판정은 "확인 불가"로 기울 뿐 거짓 "현재"가
 * 되지 않는다(docs/26 "수용 기록 형식").
 */
async function recordAcceptance(entries: Record<string, ManifestEntry>, requestId: string): Promise<string | null> {
  const current = await readWorkspaceTextFileStrict(GENERATION_MANIFEST_PATH);
  if (!current.ok) {
    return "생성 기록을 읽지 못해 이번 확정을 기록하지 않았습니다. Export에서 이 파일들은 확인 불가로 보입니다.";
  }
  const next = withManifestEntries(parseGenerationManifest(current.text), entries);
  const written = await writeWorkspaceFile(
    GENERATION_MANIFEST_PATH,
    JSON.stringify(next, null, 2),
    "application/json",
    undefined,
    requestId,
  );
  return written.ok
    ? null
    : `생성 기록을 저장하지 못했습니다 — ${written.error}. Export에서 이 파일들은 확인 불가로 보입니다.`;
}
