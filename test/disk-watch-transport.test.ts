import { afterEach, expect, it, vi } from "vitest";

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["unavailable", "status timeout", "body timeout"])("real client retries after %s", async (failure) => {
  vi.resetModules();
  vi.useFakeTimers();
  const { startDiskWatch, DISK_READ_TIMEOUT_MS } = await import("@/features/editor/ui/diskWatch");
  const { useEditorStore } = await import("@/features/editor/store/editorStore");
  const { useDocumentStore } = await import("@/features/editor/store/documentStore");
  const { useNavigationStore } = await import("@/features/editor/store/navigationStore");
  const { useAgentEditStore } = await import("@/features/editor/store/agentEditStore");
  const { WORKSPACE_MARKER_HEADER, WORKSPACE_REVISION_HEADER } = await import("@/features/workspace/protocol");
  const headers = { [WORKSPACE_MARKER_HEADER]: "1", [WORKSPACE_REVISION_HEADER]: "rev-2" };
  const spec = structuredClone(useEditorStore.getState().spec);
  spec.name = "Recovered transport";
  let failed = false;
  let signal: AbortSignal | undefined;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const status = url.endsWith("/status");
    if (!failed && (status || failure === "body timeout")) {
      if (failure === "unavailable") { failed = true; return new Response(null, { status: 503 }); }
      if (failure === "status timeout") {
        failed = true; signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }
      if (!status) {
        failed = true; signal = init?.signal ?? undefined;
        return { ok: true, headers: new Headers(headers), text: () => new Promise<string>(() => {}) } as Response;
      }
    }
    return new Response(status ? JSON.stringify({ ok: true }) : JSON.stringify(spec), { headers });
  });
  vi.stubGlobal("fetch", fetchMock);
  useDocumentStore.getState().setFileName("same.json", "rev-1");
  useNavigationStore.getState().openEditor();
  stop = startDiskWatch();
  await vi.advanceTimersByTimeAsync(3000);
  if (failure !== "unavailable") {
    await vi.advanceTimersByTimeAsync(DISK_READ_TIMEOUT_MS);
    expect(signal?.aborted).toBe(true);
  }
  await vi.advanceTimersByTimeAsync(3000);
  expect(useAgentEditStore.getState().diskNotice).toMatchObject({ kind: "diskChanged", revision: "rev-2" });
  expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
});
