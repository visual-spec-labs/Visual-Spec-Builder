/**
 * 에이전트 요청 파일 잠금 (이슈 #273).
 *
 * `runtime/nl-request.json`·`runtime/ticket-request.json`은 작업공간마다 한 자리라,
 * 두 탭이 연달아 요청하면 뒤 요청이 앞 요청을 덮어 앞 탭은 오지 않을 응답을
 * 기다린다. 경로를 요청마다 나누면 스킬·문서의 교환 계약이 모두 바뀌므로 경로는
 * 그대로 두고, 한 번에 한 요청만 그 자리를 쓰게 한다.
 *
 * 잠금은 메모리가 아니라 **작업공간 디스크**에 둔다 — `localhost`와 `127.0.0.1`처럼
 * origin이 다른 탭(브라우저 쪽 잠금이 공유되지 않는다)도, 같은 작업공간을 띄운 두
 * 서버 프로세스도 같은 파일을 본다. 두 프로세스의 판단이 겹치지 않도록 갱신은
 * 디렉터리 문지기(`withLockMutex`) 안에서 하고, 기록은 이름 바꾸기로 한 번에 바꾼다.
 * 파일명이 `.json`이 아니므로 파일·목록 라우트로는 보이지도 쓰이지도 않는다
 * (`WORKSPACE_DIR_RULES`).
 *
 * 잠금은 기한이 있는 임대다. 요청한 탭이 폴링하며 연장하고, 응답·취소·timeout·탭
 * 닫기에서 푼다. 탭이 연장 없이 사라지면(강제 종료 등) 기한이 지나 다른 탭이 가져간다.
 */

import { mkdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REQUEST_LOCK_FILES, REQUEST_LOCK_TTL_MS, RUNTIME_DIR, type RequestLockKind } from "./protocol";

interface LockRecord {
  owner: string;
  expiresAt: number;
}

function lockPath(workspaceRoot: string, kind: RequestLockKind): string {
  return join(workspaceRoot, RUNTIME_DIR, `.${kind}-request.lock`);
}

/**
 * 읽고-판단하고-쓰는 구간을 프로세스 사이에서도 한 번에 하나만 지나게 한다. 한 프로세스
 * 안에서는 이 구간이 동기라 끼어들 틈이 없지만, 같은 작업공간을 띄운 두 서버는 서로를
 * 모른다. `mkdir`은 이미 있으면 실패하는 원자적 연산이라 그걸 문지기로 쓴다.
 */
const MUTEX_WAIT_MS = 200;
const MUTEX_STALE_MS = 5_000;
function withLockMutex<T>(workspaceRoot: string, kind: RequestLockKind, body: () => T): T {
  const mutex = `${lockPath(workspaceRoot, kind)}.mutex`;
  mkdirSync(join(workspaceRoot, RUNTIME_DIR), { recursive: true });
  const deadline = Date.now() + MUTEX_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(mutex);
      break;
    } catch {
      // 구간 안에서 죽은 프로세스가 남긴 문지기는 치운다. 정상 구간은 몇 ms도 안 걸린다.
      try {
        if (Date.now() - statSync(mutex).mtimeMs > MUTEX_STALE_MS) rmdirSync(mutex);
      } catch { /* 그 사이 풀렸다 */ }
      if (Date.now() >= deadline) throw new Error("요청 잠금을 확인하지 못했습니다. 잠시 뒤 다시 시도하세요.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
  try {
    return body();
  } finally {
    try { rmdirSync(mutex); } catch { /* 이미 치워졌다 */ }
  }
}

/** 읽는 쪽이 반쯤 쓴 파일을 보지 않도록 임시 파일에 쓰고 이름을 바꾼다(같은 폴더라 원자적이다). */
function writeLock(workspaceRoot: string, kind: RequestLockKind, record: LockRecord): void {
  const target = lockPath(workspaceRoot, kind);
  const temp = `${target}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(record));
  renameSync(temp, target);
}

function readLock(workspaceRoot: string, kind: RequestLockKind): LockRecord | null {
  try {
    const value: unknown = JSON.parse(readFileSync(lockPath(workspaceRoot, kind), "utf8"));
    const record = value as Partial<LockRecord> | null;
    return typeof record?.owner === "string" && typeof record.expiresAt === "number"
      ? { owner: record.owner, expiresAt: record.expiresAt }
      : null;
  } catch {
    return null;
  }
}

export type LockResult = { ok: true; expiresAt: number } | { ok: false; expiresAt: number };

/** 비었거나 기한이 지났거나 이미 내 것이면 잡는다(연장 포함). 남의 살아 있는 잠금이면 거절한다. */
export function acquireRequestLock(
  workspaceRoot: string,
  kind: RequestLockKind,
  owner: string,
  now = Date.now(),
): LockResult {
  return withLockMutex(workspaceRoot, kind, () => {
    const current = readLock(workspaceRoot, kind);
    if (current !== null && current.owner !== owner && current.expiresAt > now) {
      return { ok: false, expiresAt: current.expiresAt };
    }
    const expiresAt = now + REQUEST_LOCK_TTL_MS;
    writeLock(workspaceRoot, kind, { owner, expiresAt });
    return { ok: true, expiresAt };
  });
}

/**
 * 내 잠금일 때만 푼다. 이미 기한이 지나 다른 탭이 가져간 잠금은 건드리지 않는다.
 *
 * 끝난 요청(응답·취소·timeout·탭 닫기)의 요청 파일도 함께 지운다 — 남겨 두면 에이전트가
 * 나중에 "현재 요청"으로 읽고 처리한다. 티켓이면 이미 취소된 요청으로 코드 파일을 쓴다.
 * 요청 id가 잠금 주인과 같은 파일만 지우므로, 다른 탭이 이미 새로 쓴 요청은 남는다.
 */
export function releaseRequestLock(workspaceRoot: string, kind: RequestLockKind, owner: string): void {
  withLockMutex(workspaceRoot, kind, () => {
    if (readLock(workspaceRoot, kind)?.owner !== owner) return;
    const requestPath = join(workspaceRoot, REQUEST_LOCK_FILES[kind]);
    try {
      const request = JSON.parse(readFileSync(requestPath, "utf8")) as { id?: unknown } | null;
      if (request?.id === owner) unlinkSync(requestPath);
    } catch {
      /* 요청 파일이 없거나 읽을 수 없으면 지울 것도 없다. */
    }
    try {
      unlinkSync(lockPath(workspaceRoot, kind));
    } catch {
      /* 이미 없으면 목적을 이룬 것이다. */
    }
  });
}

/** 요청 파일 쓰기는 기한 안의 잠금 주인만 할 수 있다. */
export function holdsRequestLock(
  workspaceRoot: string,
  kind: RequestLockKind,
  owner: string | undefined,
  now = Date.now(),
): boolean {
  const current = readLock(workspaceRoot, kind);
  return owner !== undefined && current !== null && current.owner === owner && current.expiresAt > now;
}
