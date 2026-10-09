interface LocalClaim { released: boolean; finished: Promise<unknown> }
const localClaims = new Map<string, LocalClaim>();

/** An exclusive lifetime lock, separate from the short compare/write lock. No timeout stealing. */
export function claimDraft(key: string) {
  let status: "pending" | "owned" | "busy" | "unavailable" | "released" = "pending";
  let release = () => { local.released = true; };
  const previous = localClaims.get(key);
  const local: LocalClaim = { released: false, finished: Promise.resolve() };
  const ready = new Promise<boolean>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.locks) { status = "unavailable"; resolve(false); return; }
    local.finished = (async () => {
      // StrictMode/HMR cleanup releases asynchronously. Wait for our own old
      // callback before testing availability, never for another tab's owner.
      if (previous?.released) await previous.finished;
      if (local.released) { status = "released"; resolve(false); return; }
      await navigator.locks.request(`${key}:owner`, { ifAvailable: true }, async lock => {
        if (!lock || local.released) { status = local.released ? "released" : "busy"; resolve(false); return; }
        status = "owned";
        await new Promise<void>(done => { release = done; resolve(true); });
      });
    })().catch(() => { status = "unavailable"; resolve(false); });
  });
  localClaims.set(key, local);
  void local.finished.finally(() => { if (localClaims.get(key) === local) localClaims.delete(key); });
  return { ready, get status() { return status; }, release: async () => { status = "released"; local.released = true; release(); await local.finished; } };
}
