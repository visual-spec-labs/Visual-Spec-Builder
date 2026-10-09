interface LocalClaim { released: boolean; finished: Promise<unknown> }
const localClaims = new Map<string, LocalClaim>();

/** An exclusive lifetime lock, separate from the short compare/write lock. No timeout stealing. */
export function claimDraft(key: string) {
  let release = () => { local.released = true; };
  const previous = localClaims.get(key);
  const local: LocalClaim = { released: false, finished: Promise.resolve() };
  const ready = new Promise<boolean>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.locks) { resolve(false); return; }
    local.finished = (async () => {
      // StrictMode/HMR cleanup releases asynchronously. Wait for our own old
      // callback before testing availability, never for another tab's owner.
      if (previous?.released) await previous.finished;
      if (local.released) { resolve(false); return; }
      await navigator.locks.request(`${key}:owner`, { ifAvailable: true }, async lock => {
        if (!lock || local.released) { resolve(false); return; }
        await new Promise<void>(done => { release = done; resolve(true); });
      });
    })().catch(() => resolve(false));
  });
  localClaims.set(key, local);
  void local.finished.finally(() => { if (localClaims.get(key) === local) localClaims.delete(key); });
  return { ready, release: async () => { local.released = true; release(); await local.finished; } };
}
