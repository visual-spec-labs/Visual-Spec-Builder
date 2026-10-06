import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { REQUEST_LOCK_TTL_MS } from "@/features/workspace/protocol";
import { acquireRequestLock, holdsRequestLock, releaseRequestLock } from "@/features/workspace/requestLock";

/** 요청 파일 잠금의 임대 규칙(#273) — 기한·연장·해제. */
let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "visual-spec-lock-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

it("기한 안의 남의 잠금은 못 잡고, 기한이 지나면 가져간다", () => {
  const now = 1_000_000;
  expect(acquireRequestLock(root, "nl", "a", now).ok).toBe(true);
  expect(acquireRequestLock(root, "nl", "b", now + REQUEST_LOCK_TTL_MS - 1).ok).toBe(false);
  expect(acquireRequestLock(root, "nl", "b", now + REQUEST_LOCK_TTL_MS).ok).toBe(true);
  expect(holdsRequestLock(root, "nl", "a", now + REQUEST_LOCK_TTL_MS)).toBe(false);
  expect(holdsRequestLock(root, "nl", "b", now + REQUEST_LOCK_TTL_MS)).toBe(true);
});

it("주인이 다시 잡으면 기한이 연장된다", () => {
  const now = 1_000_000;
  acquireRequestLock(root, "ticket", "a", now);
  acquireRequestLock(root, "ticket", "a", now + REQUEST_LOCK_TTL_MS - 1);
  expect(acquireRequestLock(root, "ticket", "b", now + REQUEST_LOCK_TTL_MS + 1).ok).toBe(false);
});

it("만료 뒤 다른 탭이 가져간 잠금은 이전 주인이 풀지 못한다", () => {
  const now = 1_000_000;
  acquireRequestLock(root, "nl", "a", now);
  acquireRequestLock(root, "nl", "b", now + REQUEST_LOCK_TTL_MS);
  releaseRequestLock(root, "nl", "a");
  expect(holdsRequestLock(root, "nl", "b", now + REQUEST_LOCK_TTL_MS)).toBe(true);
  releaseRequestLock(root, "nl", "b");
  expect(acquireRequestLock(root, "nl", "c", now + REQUEST_LOCK_TTL_MS).ok).toBe(true);
});

it("다른 프로세스가 갱신 중(문지기가 있음)이면 판단하지 않고 실패한다", async () => {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(root, "runtime"), { recursive: true });
  mkdirSync(join(root, "runtime", ".nl-request.lock.mutex"));
  expect(() => acquireRequestLock(root, "nl", "a")).toThrow();
  expect(holdsRequestLock(root, "nl", "a")).toBe(false);
});

it("갱신 중 죽은 프로세스가 남긴 오래된 문지기는 치우고 진행한다", async () => {
  const { mkdirSync, utimesSync } = await import("node:fs");
  const mutex = join(root, "runtime", ".nl-request.lock.mutex");
  mkdirSync(mutex, { recursive: true });
  const old = new Date(Date.now() - 60_000);
  utimesSync(mutex, old, old);
  expect(acquireRequestLock(root, "nl", "a").ok).toBe(true);
});
