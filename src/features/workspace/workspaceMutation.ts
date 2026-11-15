import { lstatSync, mkdirSync, realpathSync, rmdirSync, type Stats } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const LOCK_DIRECTORY = ".workspace-mutation.lock";
const LOCK_WAIT_MS = 2_000;
const LOCK_POLL_MS = 10;

function sameDirectory(path: string, expected: Stats): boolean {
  try {
    const current = lstatSync(path);
    return current.isDirectory() && !current.isSymbolicLink() &&
      current.dev === expected.dev && current.ino === expected.ino;
  } catch { return false; }
}

/**
 * Save, rename and delete share one on-disk mutex per workspace, including across
 * server processes. One lock covers every path of a rename, so opposite-direction
 * renames cannot deadlock. The directory is outside the API's accessible folders.
 *
 * Never reclaim by age or PID: a paused writer can still resume, and PIDs can be
 * reused. After a crash the lock deliberately fails closed. Stop ALL servers for
 * this workspace before removing its orphaned `.workspace-mutation.lock` directory.
 * This coordinates cooperating GUI servers, not arbitrary external file writers.
 * Callbacks must revalidate target path/revision after this asynchronous wait.
 */
export async function withWorkspaceMutation<T>(
  paths: string[],
  action: () => T | Promise<T>,
  workspaceRoot: string,
): Promise<T> {
  const requestedRoot = resolve(workspaceRoot);
  for (const path of paths) {
    const inside = relative(requestedRoot, resolve(path));
    if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      throw new Error("작업공간 밖의 변경 경로는 잠글 수 없습니다.");
    }
  }
  // Canonicalize the root so aliases (for example /tmp on macOS) share the lock.
  // Do not create missing roots or follow a symlink at the lock path itself.
  const root = realpathSync(requestedRoot);
  const rootIdentity = lstatSync(root);
  if (!rootIdentity.isDirectory()) throw new Error("작업공간 폴더를 확인할 수 없습니다.");
  const lockPath = join(root, LOCK_DIRECTORY);
  const deadline = performance.now() + LOCK_WAIT_MS;
  let lockIdentity: Stats;
  for (;;) {
    if (!sameDirectory(root, rootIdentity) || realpathSync(requestedRoot) !== root) {
      throw new Error("저장을 기다리는 동안 작업공간 경로가 변경됐습니다.");
    }
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      lockIdentity = lstatSync(lockPath);
      if (!lockIdentity.isDirectory() || lockIdentity.isSymbolicLink()) {
        throw new Error("안전하지 않은 작업공간 저장 잠금입니다.");
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // A symlink or regular file is not a contending writer. Do not touch it.
      let current: Stats;
      try { current = lstatSync(lockPath); }
      catch (missing) {
        if ((missing as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw missing;
      }
      if (!current.isDirectory() || current.isSymbolicLink()) {
        throw new Error("안전하지 않은 작업공간 저장 잠금입니다.");
      }
      if (performance.now() >= deadline) {
        throw new Error("다른 서버의 저장 잠금을 기다리다 중단했습니다. 초안을 보존한 뒤 다시 시도하세요. " +
          "서버가 비정상 종료됐다면 이 작업공간의 모든 서버를 종료한 뒤 .workspace-mutation.lock 폴더를 제거하세요.");
      }
      await delay(LOCK_POLL_MS);
    }
  }
  try {
    if (!sameDirectory(root, rootIdentity) || !sameDirectory(lockPath, lockIdentity) || realpathSync(requestedRoot) !== root) {
      throw new Error("저장 전에 작업공간 또는 저장 잠금이 변경됐습니다.");
    }
    return await action();
  } finally {
    // Never delete a replacement lock or follow a symlink during cleanup. A
    // cleanup failure leaves a fail-closed lock; do not send a second HTTP response
    // after a successful callback has already replied to the browser.
    if (sameDirectory(root, rootIdentity) && sameDirectory(lockPath, lockIdentity)) {
      try { rmdirSync(lockPath); }
      catch { console.warn("작업공간 저장 잠금을 정리하지 못했습니다. 모든 서버를 종료한 뒤 .workspace-mutation.lock 폴더를 확인하세요."); }
    }
  }
}
