import { resolve } from "node:path";

const tails = new Map<string, Promise<void>>();
/** Shared by Save and rename, independent of browser origin. Lock order prevents deadlocks. */
export async function withWorkspaceMutation<T>(paths: string[], action: () => T): Promise<T> {
  const keys = [...new Set(paths.map((path) => resolve(path).toLowerCase()))].sort();
  const previous = keys.map((key) => tails.get(key) ?? Promise.resolve());
  let release!: () => void;
  const gate = new Promise<void>((done) => { release = done; });
  const tail = Promise.all(previous).then(() => gate);
  for (const key of keys) tails.set(key, tail);
  await Promise.all(previous);
  try { return action(); }
  finally {
    release();
    for (const key of keys) if (tails.get(key) === tail) tails.delete(key);
  }
}
