/**
 * 에이전트 요청 하나가 끝날 때까지 공유 요청 파일 잠금을 쥐고 있는다(이슈 #273).
 *
 * 자연어(`nl/nlAgentClient.ts`)와 티켓(`ticket/ticketAgentClient.ts`) 요청이 같은 순서로
 * 쓴다: 잡기 → 요청 파일 쓰기 → 폴링하며 연장 → 끝나면(응답·취소·timeout·실패) 풀기.
 * 탭을 닫으면 `pagehide`에서 푼다. 그마저 못 하면 서버 쪽 기한이 지나 풀린다.
 */

import type { RequestLockKind } from "@/features/workspace/protocol";
import { REQUEST_LOCK_TTL_MS } from "@/features/workspace/protocol";

import { acquireRequestLock, releaseRequestLock } from "./workspaceClient";

/** 연장 간격. 기한보다 충분히 짧아 백그라운드 탭의 타이머 지연(최대 1초 단위)에도 끊기지 않는다. */
const RENEW_INTERVAL_MS = Math.floor(REQUEST_LOCK_TTL_MS / 6);
const BUSY_RETRY_MS = 300;
const BUSY_RETRIES = 5;

export interface HeldRequestLock {
  /** 연장 간격이 지났으면 연장한다. 잠금을 잃었으면(기한 만료 뒤 다른 탭이 가져감) false. */
  renew: (verify?: boolean) => Promise<boolean>;
  release: () => void;
}

export async function holdRequestLock(
  kind: RequestLockKind,
  owner: string,
  isCancelled: () => boolean = () => false,
): Promise<HeldRequestLock | "busy" | "unavailable"> {
  let acquired = await acquireRequestLock(kind, owner);
  // 같은 탭에서 취소 직후 다시 요청하면 이전 폴링 루프가 다음 회차(최대 1초)에야
  // 잠금을 푼다. 그 사이를 다른 탭의 요청으로 안내하지 않도록 잠깐 다시 시도한다.
  // 재시도 중 사용자가 취소하면 더 기다리지 않는다(PR #296 리뷰).
  for (let retry = 0; acquired === "busy" && retry < BUSY_RETRIES && !isCancelled(); retry++) {
    await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
    acquired = await acquireRequestLock(kind, owner);
  }
  if (acquired !== "acquired") return acquired;

  let renewedAt = Date.now();
  let released = false;
  // 뒤로/앞으로 캐시에 들어가는 것(persisted)은 닫는 게 아니다 — 돌아오면 폴링이 이어지므로
  // 잠금을 쥔 채 둔다. 오래 떠나 있으면 서버 기한이 지나 풀린다.
  const onPageHide = (event: PageTransitionEvent) => { if (!event.persisted) release(true); };
  function release(keepalive = false) {
    if (released) return;
    released = true;
    if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide);
    releaseRequestLock(kind, owner, keepalive);
  }
  if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);

  return {
    async renew(verify = false) {
      if (released) return false;
      if (!verify && Date.now() - renewedAt < RENEW_INTERVAL_MS) return true;
      // 새로 잡기가 아니라 연장이다 — 끊긴 사이 다른 탭이 가져갔다가 풀었어도 알아챈다.
      const renewed = await acquireRequestLock(kind, owner, true);
      if (renewed === "busy") return false;
      // 일시적으로 서버에 닿지 않으면 다음 회차에 다시 시도한다 — 폴링도 같은 서버를 본다.
      if (renewed === "acquired") renewedAt = Date.now();
      return !verify || renewed === "acquired";
    },
    release: () => release(),
  };
}
