/**
 * 생성 출력의 수용 기록과 Export 생성 세대 판정 — 순수 함수 (이슈 #284).
 *
 * `verifyGenerated.ts`는 "파일이 있고 참조가 맞는가"를 본다. 그것만으로는 취소된 요청이
 * 늦게 쓴 파일도 4/4·오류 0으로 통과한다(#284 감사 재현). 이 파일은 그 옆에 다른 질문을
 * 하나 더 둔다 — **이 파일이 GUI가 수용한 요청의 출력 그대로이며, 지금 입력으로 만든
 * 것인가.** 두 답은 섞지 않고 Export 화면에 따로 보인다.
 *
 * 기록은 GUI만 쓴다(`ui/ticketOutputAcceptance.ts`가 확정할 때). 형식과 경계는
 * docs/26-agent-request-generation-contract.md에 있다.
 */

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import type { Ticket } from "@/features/editor/ticket/types";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

import { contentHash, inputFingerprint } from "./contentHash";
import { ticketFilePath } from "./generatedPaths";
import type { GeneratedFile } from "./verifyGenerated";

/** 기록 형식 버전. #281이 안정 신원 필드를 더할 때 올린다. */
export const GENERATION_MANIFEST_PROTOCOL = 1;

/** 수용 기록 파일(작업공간 루트 기준). 에이전트는 이 파일을 쓰지 않는다. */
export const GENERATION_MANIFEST_PATH = `${RUNTIME_DIR}/generation-manifest.json`;

/** 확정한 출력 파일 하나에 대한 기록. 키는 `generated/` 기준 경로다. */
export interface ManifestEntry {
  requestId: string;
  ticketId: string;
  pageId: PageId;
  /** 요청에 실은 입력(페이지)의 지문. `contentHash.inputFingerprint`. */
  inputFingerprint: string;
  /** 확정한 바이트의 해시. `contentHash.contentHash`. */
  contentHash: string;
  /** ISO 시각. 판정에는 쓰지 않고 사람이 읽는 용도다. */
  acceptedAt: string;
}

export interface GenerationManifest {
  protocol: number;
  entries: Record<string, ManifestEntry>;
}

export function emptyManifest(): GenerationManifest {
  return { protocol: GENERATION_MANIFEST_PROTOCOL, entries: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isManifestEntry(value: unknown): value is ManifestEntry {
  return isRecord(value) &&
    typeof value.requestId === "string" && typeof value.ticketId === "string" &&
    typeof value.pageId === "string" && typeof value.inputFingerprint === "string" &&
    typeof value.contentHash === "string" && typeof value.acceptedAt === "string";
}

/**
 * 기록 파일 본문을 읽는다. **절대 예외를 던지지 않는다.** 없거나 망가졌거나 다른 버전이면
 * 빈 기록이다 — 기록이 없으면 판정은 "확인 불가" 쪽으로 기울 뿐 거짓 "현재"가 되지 않는다.
 * 모양이 틀린 항목 하나는 그 항목만 버린다.
 */
export function parseGenerationManifest(text: string | null): GenerationManifest {
  if (text === null) return emptyManifest();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return emptyManifest();
  }
  if (!isRecord(body) || body.protocol !== GENERATION_MANIFEST_PROTOCOL || !isRecord(body.entries)) {
    return emptyManifest();
  }
  const entries: Record<string, ManifestEntry> = {};
  for (const [path, entry] of Object.entries(body.entries)) {
    if (isManifestEntry(entry)) entries[path] = entry;
  }
  return { protocol: GENERATION_MANIFEST_PROTOCOL, entries };
}

/** 기록에 항목을 덮어 합친 새 기록을 돌려준다. 같은 경로의 이전 기록은 새 확정으로 바뀐다. */
export function withManifestEntries(
  manifest: GenerationManifest,
  entries: Record<string, ManifestEntry>,
): GenerationManifest {
  return { protocol: GENERATION_MANIFEST_PROTOCOL, entries: { ...manifest.entries, ...entries } };
}

/**
 * 티켓 하나의 생성 세대 판정(docs/26 "Export 생성 세대 판정").
 *
 * - `current` 기록·해시·입력 지문이 모두 지금과 맞다
 * - `stale` 기록·해시는 맞지만 그 뒤 입력(페이지)이 바뀌었다
 * - `changed` 기록은 있는데 파일 바이트가 확정 때와 다르다 — 늦은 쓰기·수동 수정·다른 writer를
 *   여기서는 가르지 않는다(가르는 일은 #282)
 * - `unrecorded` 파일은 있지만 GUI가 수용한 기록이 없다
 * - `missing` 파일이 없다
 */
export type TicketFreshness = "current" | "stale" | "changed" | "unrecorded" | "missing";

export type OverallFreshness = "empty" | "current" | "missing" | "partial" | "stale" | "unverifiable";

export interface TicketFreshnessEntry {
  ticketId: string;
  componentName: string;
  path: string;
  freshness: TicketFreshness;
  /** 기록이 있으면 그 요청 ID. 사람이 "어느 요청 결과인가"를 볼 수 있게 남긴다. */
  requestId?: string;
}

export interface FreshnessReport {
  overall: OverallFreshness;
  tickets: TicketFreshnessEntry[];
}

export interface FreshnessInput {
  tickets: Ticket[];
  files: GeneratedFile[];
  manifest: GenerationManifest;
  pageId: PageId;
  page: ScreenSpec;
}

export function classifyOutputFreshness({ tickets, files, manifest, pageId, page }: FreshnessInput): FreshnessReport {
  const contentByPath = new Map(files.map((file) => [file.path, file.content]));
  const currentInput = inputFingerprint(pageId, page);

  const entries = tickets.map((ticket): TicketFreshnessEntry => {
    const path = ticketFilePath(ticket);
    const base = { ticketId: ticket.id, componentName: ticket.componentName, path };
    const content = contentByPath.get(path);
    const record = manifest.entries[path];
    if (content === undefined) return { ...base, freshness: "missing", requestId: record?.requestId };
    if (record === undefined) return { ...base, freshness: "unrecorded" };
    const withRequest = { ...base, requestId: record.requestId };
    if (contentHash(content) !== record.contentHash) return { ...withRequest, freshness: "changed" };
    if (record.pageId !== pageId || record.inputFingerprint !== currentInput) {
      return { ...withRequest, freshness: "stale" };
    }
    return { ...withRequest, freshness: "current" };
  });

  return { overall: overallFreshness(entries.map((entry) => entry.freshness)), tickets: entries };
}

function overallFreshness(values: TicketFreshness[]): OverallFreshness {
  if (values.length === 0) return "empty";
  if (values.every((value) => value === "current")) return "current";
  if (values.every((value) => value === "missing")) return "missing";
  // 수용하지 않은 바이트가 하나라도 섞이면 "부분"보다 먼저 알린다 — 늦은 쓰기가 다른
  // 현재 파일들 사이에 묻히면 #284가 고친 오판정(4/4 성공)과 다를 바 없다.
  if (values.some((value) => value === "changed" || value === "unrecorded")) return "unverifiable";
  if (values.some((value) => value === "current")) return "partial";
  return "stale";
}
