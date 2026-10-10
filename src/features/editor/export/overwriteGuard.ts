/**
 * 재생성 전 수동 변경 판정 — 순수 함수 (이슈 #282).
 *
 * 앱이 `generated/`의 파일 하나를 새 출력으로 바꾸기 **전에** 묻는 질문은 하나다: "지금 이 자리의
 * 바이트가 이 프로젝트·페이지의 마지막 정상 생성 결과 그대로인가." 그렇다고 확인될 때만 묻지 않고
 * 바꾼다(백업은 언제나 남긴다). 확인이 안 되면 — 사람이 고쳤거나, 기록이 없거나, 다른 프로젝트의
 * 기록이면 — 사용자에게 보존/덮어쓰기를 고르게 한다. 판정 근거는 #284의 수용 기록
 * (`generationManifest.ts`)이고, 이 파일은 그 기록과 실제 바이트를 잇기만 한다.
 *
 * **기준 없는 기존 파일을 생성기 소유로 추정하지 않는다.** 기록이 없거나(직접 실행한 to-react,
 * 구버전 출력, 사람이 만든 파일) 기록의 프로젝트·페이지가 지금과 다르면(이름 변경·복사) 모두
 * 확인 대상이다. 틀리는 쪽을 "한 번 더 묻는다"로 고정한다 — 반대쪽 실수는
 * 사람이 고친 코드를 조용히 잃는 것이라 되돌릴 수 없다. 같은 파일 이름을 재사용한 새 프로젝트는
 * 임시 projectKey로 구분하지 못한다(#281). 경계와 근거는 docs/26 "#282".
 */

import type { PageId } from "@/features/editor/schema";

import { contentHash } from "./contentHash";
import type { ManifestEntry } from "./generationManifest";

/**
 * 파일 하나의 판정.
 *
 * - `new` 파일이 없다 — 새로 만든다
 * - `unchanged` 지금 바이트가 새 출력과 같다 — 쓸 것이 없다(기록만 갱신)
 * - `owned` 이 프로젝트·페이지의 수용 기록과 바이트가 같다 — 마지막 정상 생성 그대로라 백업 후 바꾼다
 * - `modified` 이 프로젝트·페이지의 기록은 있는데 바이트가 다르다 — 수동 변경(또는 규약 밖 writer)
 * - `unowned` 수용 기록이 없다 — 누가 만든 파일인지 모른다
 * - `foreign` 기록이 다른 프로젝트·페이지의 것이거나 프로젝트를 알 수 없다
 */
export type OverwriteOwnership = "new" | "unchanged" | "owned" | "modified" | "unowned" | "foreign";

/** 확인 당시의 파일. `revision`은 바이트의 SHA-256(16진수)으로 서버의 기대 버전과 같은 값이다. */
export interface FileSnapshot {
  bytes: Uint8Array;
  revision: string;
}

/** 지금 생성하는 쪽. `projectKey`는 작업공간 파일 이름이며 저장하지 않은 문서면 null이다. */
export interface OverwriteOwner {
  projectKey: string | null;
  pageId: PageId;
}

export interface OverwriteTarget {
  /** `generated/` 기준 경로. */
  path: string;
  ticketId: string;
  ownership: OverwriteOwnership;
  /** 확인 당시의 현재 파일. 확정 직전 재비교의 기준이다. 없으면 null. */
  current: FileSnapshot | null;
  /** 새 출력(이 요청의 임시 출력에서 읽은 텍스트). */
  next: string;
  /** 이 경로의 수용 기록. 다른 프로젝트의 기록이어도 그대로 둔다 — 되돌리기가 이 값으로 돌아간다. */
  record: ManifestEntry | null;
}

export interface ClassifyOverwriteInput {
  path: string;
  ticketId: string;
  current: FileSnapshot | null;
  next: string;
  record: ManifestEntry | null;
  owner: OverwriteOwner;
}

/** 기록이 지금 생성하는 프로젝트·페이지의 것인가. 어느 한쪽 프로젝트라도 모르면 아니다. */
function recordBelongsTo(record: ManifestEntry, owner: OverwriteOwner): boolean {
  return typeof record.projectKey === "string" && owner.projectKey !== null &&
    record.projectKey === owner.projectKey && record.pageId === owner.pageId;
}

export function classifyOverwrite({ path, ticketId, current, next, record, owner }: ClassifyOverwriteInput): OverwriteTarget {
  const base = { path, ticketId, current, next, record };
  if (current === null) return { ...base, ownership: "new" };
  const currentHash = `sha256:${current.revision}`;
  if (record === null) return { ...base, ownership: "unowned" };
  if (!recordBelongsTo(record, owner)) return { ...base, ownership: "foreign" };
  if (currentHash === contentHash(next) && currentHash === record.contentHash) return { ...base, ownership: "unchanged" };
  return { ...base, ownership: currentHash === record.contentHash ? "owned" : "modified" };
}

/** 사용자가 보존/덮어쓰기를 골라야 하는 판정인가. */
export function needsDecision(target: Pick<OverwriteTarget, "ownership">): boolean {
  return target.ownership === "modified" || target.ownership === "unowned" || target.ownership === "foreign";
}

/** 확인 대상 파일 하나에 대한 사용자 선택. 고르지 않은 파일은 `keep`이다. */
export type OverwriteDecision = "keep" | "overwrite";

/** 이 파일을 실제로 쓰는가. 확인 대상은 명시적으로 `overwrite`를 골랐을 때만 쓴다. */
export function shouldWrite(target: Pick<OverwriteTarget, "ownership" | "path">, decisions: Readonly<Record<string, OverwriteDecision>>): boolean {
  if (target.ownership === "new" || target.ownership === "owned") return true;
  if (target.ownership === "unchanged") return false;
  return decisions[target.path] === "overwrite";
}

/** 확인 화면의 파일 한 줄. 표시용 텍스트만 담는다(바이트·버전은 확정 계획에 남는다). */
export interface OverwriteReviewItem {
  path: string;
  ticketId: string;
  ownership: OverwriteOwnership;
  /** 확인 대상일 때 지금 파일의 텍스트. 아니면 null. */
  currentText: string | null;
  nextText: string;
  /** 마지막 정상 생성의 텍스트 — 수동 변경 diff의 기준. 확인할 수 없으면 null. */
  baselineText: string | null;
}

/** 쓰기 전 확인 화면 — 이번 요청이 건드리는 파일 전부(영향 목록)와 확인 대상의 diff 재료. */
export interface OverwriteReview {
  requestId: string;
  items: OverwriteReviewItem[];
}

/** 한 번의 적용이 바꾼 파일과 그 백업. 되돌리기가 `runId`로 `backups/<runId>/run.json`을 찾는다. */
export interface RegenerationRunSummary {
  runId: string;
  /** 바꾸거나 새로 만든 `generated/` 기준 경로. */
  paths: string[];
  /** 백업 폴더(작업공간 루트 기준). */
  backupRoot: string;
}
