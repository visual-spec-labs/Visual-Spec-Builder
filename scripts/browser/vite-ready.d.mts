import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
export function waitForViteUrl(server: ChildProcessByStdio<null, Readable, Readable>, timeoutMs?: number): Promise<string>;
