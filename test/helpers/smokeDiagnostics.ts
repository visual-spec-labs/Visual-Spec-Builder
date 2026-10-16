/** Read once and retain HTTP evidence before temporary consumer files are removed. */
export async function readSmokeResponse(response: Response, url: string): Promise<string> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}\ncontent-type: ${response.headers.get("content-type")}\nbody:\n${body.slice(0, 8192)}${body.length > 8192 ? "\n[body truncated at 8192 characters]" : ""}`);
  }
  return body;
}

export function smokeFailure(error: unknown, childOutput: string, dependencyVersions: string): Error {
  return new Error(`${error instanceof Error ? error.message : String(error)}\n\nGUI child output (last 32768 characters):\n${childOutput.slice(-32768)}\n\nInstalled consumer dependencies:\n${dependencyVersions}`, { cause: error });
}

/** A failed readiness probe is retryable; a received OK response is not. */
export async function probeSmokeStatus(url: string, remainingMs: number, attemptMs = 1000): Promise<
  { ready: true; body: string; diagnostic: string } | { ready: false; diagnostic: string }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("status probe timed out")), Math.max(1, Math.min(attemptMs, remainingMs)));
  try {
    let response: Response;
    try { response = await fetch(url, { signal: controller.signal }); }
    catch (error) { return { ready: false, diagnostic: `${url}: ${error instanceof Error ? error.message : String(error)}` }; }
    const header = `HTTP ${response.status} ${response.statusText}: ${url}\ncontent-type: ${response.headers.get("content-type")}`;
    if (response.ok) {
      // No retry after OK headers: truncated/slow bodies, JSON and assertions are failures.
      try { return { ready: true, body: await response.text(), diagnostic: header }; }
      catch (error) { throw new Error(`${header}\n[body read failed: ${error instanceof Error ? error.message : String(error)}]`, { cause: error }); }
    }
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let body = "", bytes = 0, note = "";
    try {
      while (reader) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const available = 8192 - bytes;
        body += decoder.decode(chunk.value.subarray(0, available), { stream: true });
        bytes += Math.min(chunk.value.length, available);
        if (chunk.value.length > available) { note = "\n[body truncated at 8192 bytes]"; break; }
      }
    } catch (error) {
      note = `\n[body read failed: ${error instanceof Error ? error.message : String(error)}]`;
    } finally {
      body += decoder.decode();
      // A stalled peer must not delay the next readiness attempt while cancellation settles.
      if (reader) void reader.cancel().catch(() => {});
    }
    return { ready: false, diagnostic: `${header}\nbody:\n${body}${note}` };
  } finally { clearTimeout(timer); }
}
