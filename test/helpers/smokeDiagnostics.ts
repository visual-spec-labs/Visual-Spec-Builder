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
