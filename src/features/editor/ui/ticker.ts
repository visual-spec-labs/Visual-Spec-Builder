/**
 * 주기 작업 타이머. 사용자는 보통 터미널(에이전트)을 앞에 두고 브라우저를 뒤에 둔다 — Chrome은
 * 5분 넘게 가려진 탭의 setInterval을 1분에 한 번으로 묶어(intensive throttling) 하트비트·폴링·
 * 잠금 연장이 모두 늦어진다(#279 리뷰). 전용 Worker의 타이머는 그 제약을 받지 않으므로 Worker가
 * 박자를 보내고 실제 일은 메인 스레드가 한다. Worker를 못 쓰는 환경(테스트 등)은 setInterval로.
 */
export function startTicker(intervalMs: number, tick: () => void): () => void {
  if (typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function") {
    try {
      const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${intervalMs});`], { type: "text/javascript" }));
      const worker = new Worker(url);
      worker.onmessage = tick;
      return () => { worker.terminate(); URL.revokeObjectURL(url); };
    } catch { /* 아래 setInterval로 */ }
  }
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}
