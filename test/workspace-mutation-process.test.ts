import { fork, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withWorkspaceMutation } from "@/features/workspace/workspaceMutation";

let root: string;
let fixtures: string;
const children: ChildProcess[] = [];
const lockName = ".workspace-mutation.lock";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vsb-mutation-process-"));
  mkdirSync(join(root, "specs"));
  fixtures = mkdtempSync(join(tmpdir(), "vsb-mutation-runner-"));
  // Type erasure only: execute the actual helper in independent Node processes,
  // including supported Node 20 where native TypeScript imports are unavailable.
  const source = readFileSync(join(repo, "src/features/workspace/workspaceMutation.ts"), "utf8");
  writeFileSync(join(fixtures, "mutation.mjs"), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
  writeFileSync(join(fixtures, "worker.mjs"), `
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { withWorkspaceMutation } from './mutation.mjs';
const [root, id, pathList, mode] = process.argv.slice(2);
const paths = JSON.parse(pathList);
process.on('message', async message => {
  if (message !== 'start') return;
  process.send({ kind: 'attempting' });
  try {
    const result = await withWorkspaceMutation(paths, () => {
      if (mode === 'crash') { process.send({ kind: 'entered' }); process.exit(23); }
      const current = readFileSync(paths[0], 'utf8');
      if (current !== 'original') return { accepted: false, current };
      process.send({ kind: 'entered' });
      const deadline = Date.now() + 10000;
      while (!existsSync(join(root, 'release-' + id))) {
        if (Date.now() > deadline) throw new Error('test release timeout');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
      if (mode === 'throw') throw new Error('test callback error');
      const temporary = join(root, '.test-write-' + process.pid);
      writeFileSync(temporary, 'writer-' + id);
      renameSync(temporary, paths[0]);
      return { accepted: true, current };
    }, root);
    process.send({ kind: 'result', ...result });
  } catch(error) { process.send({kind: 'error', message: error.message}); }
  process.disconnect();
});
process.send({ kind: 'ready' });
`);
});

afterEach(async () => {
  await Promise.all(children.splice(0).map(async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>(done => child.once("exit", () => done()));
    child.kill("SIGKILL");
    await exited;
  }));
  rmSync(root, { recursive: true, force: true });
  rmSync(fixtures, { recursive: true, force: true });
});

type Message = { kind: string; accepted?: boolean; current?: string; message?: string };
function worker(id: string, paths: string[], mode = "save") {
  const child = fork(join(fixtures, "worker.mjs"), [root, id, JSON.stringify(paths), mode], {
    stdio: ["ignore", "ignore", "pipe", "ipc"], execArgv: [],
  });
  children.push(child);
  const messages: Message[] = [];
  let stderr = "";
  child.stderr?.on("data", chunk => { stderr += chunk.toString(); });
  child.on("message", message => messages.push(message as Message));
  return {
    child, messages,
    async wait(kind: string): Promise<Message> {
      const deadline = Date.now() + 10000;
      while (!messages.some(message => message.kind === kind)) {
        if (child.exitCode !== null || child.signalCode !== null || Date.now() > deadline) {
          throw new Error(`Worker ${id} did not send ${kind}: ${JSON.stringify(messages)} ${stderr}`);
        }
        await delay(5);
      }
      return messages.find(message => message.kind === kind)!;
    },
    release() { writeFileSync(join(root, `release-${id}`), ""); },
  };
}

function expectNoLock() { expect(existsSync(join(root, lockName))).toBe(false); }

describe("workspace mutations across server processes", () => {
  it("serializes compare-and-write: exactly one process accepts the loaded revision", async () => {
    const path = join(root, "specs", "same.json");
    writeFileSync(path, "original");
    const first = worker("first", [path]);
    const second = worker("second", [path]);
    await Promise.all([first.wait("ready"), second.wait("ready")]);
    first.child.send("start"); await first.wait("entered");
    second.child.send("start"); await second.wait("attempting");
    await delay(100);
    expect(second.messages.some(message => message.kind === "entered" || message.kind === "result")).toBe(false);
    first.release();
    expect(await first.wait("result")).toMatchObject({ accepted: true, current: "original" });
    expect(await second.wait("result")).toMatchObject({ accepted: false, current: "writer-first" });
    expect(readFileSync(path, "utf8")).toBe("writer-first");
    expectNoLock();
  });

  it("opposite path ordering for rename cannot deadlock or leak a lock", async () => {
    const a = join(root, "specs", "a.json"), b = join(root, "specs", "b.json");
    writeFileSync(a, "original"); writeFileSync(b, "original");
    const first = worker("first", [a, b]), second = worker("second", [b, a]);
    await Promise.all([first.wait("ready"), second.wait("ready")]);
    first.child.send("start"); await first.wait("entered");
    second.child.send("start"); await second.wait("attempting");
    first.release(); await first.wait("result");
    await second.wait("entered"); second.release(); await second.wait("result");
    expectNoLock();
  });

  it("cleans the disk lock when a different process's callback throws", async () => {
    const path = join(root, "specs", "a.json"); writeFileSync(path, "original");
    const failed = worker("failed", [path], "throw"); await failed.wait("ready");
    failed.child.send("start"); await failed.wait("entered"); failed.release();
    expect(await failed.wait("error")).toMatchObject({ message: "test callback error" });
    expectNoLock();
    await expect(withWorkspaceMutation([path], () => "next writer", root)).resolves.toBe("next writer");
    expectNoLock();
  });

  it("fails closed on an orphaned crash lock, even when its age is stale", async () => {
    const path = join(root, "specs", "a.json"); writeFileSync(path, "original");
    const crashed = worker("crashed", [path], "crash"); await crashed.wait("ready");
    const exited = new Promise<number | null>(done => crashed.child.once("exit", code => done(code)));
    crashed.child.send("start"); expect(await exited).toBe(23);
    const lock = join(root, lockName), old = new Date(0);
    utimesSync(lock, old, old);
    let entered = false;
    await expect(withWorkspaceMutation([path], () => { entered = true; }, root)).rejects.toThrow("모든 서버를 종료");
    expect(entered).toBe(false);
    expect(lstatSync(lock).isDirectory()).toBe(true);
    expect(readFileSync(path, "utf8")).toBe("original");
  });

  it("does not steal an old but still-live process lock on timeout", async () => {
    const path = join(root, "specs", "a.json"); writeFileSync(path, "original");
    const holder = worker("holder", [path]); await holder.wait("ready");
    holder.child.send("start"); await holder.wait("entered");
    const lock = join(root, lockName), old = new Date(0); utimesSync(lock, old, old);
    await expect(withWorkspaceMutation([path], () => { throw new Error("must not enter"); }, root)).rejects.toThrow("저장 잠금을 기다리다");
    expect(lstatSync(lock).isDirectory()).toBe(true);
    holder.release(); await holder.wait("result"); expectNoLock();
  });

  it("rejects a non-directory lock without removing it or running the callback", async () => {
    const lock = join(root, lockName); writeFileSync(lock, "do not remove");
    await expect(withWorkspaceMutation([join(root, "specs", "a.json")], () => "unsafe", root)).rejects.toThrow("안전하지 않은");
    expect(readFileSync(lock, "utf8")).toBe("do not remove");
  });

  // Windows junctions do not require Unix symlink privileges.
  it("rejects a lock symlink/junction without touching its target", async () => {
    const outside = join(fixtures, "outside"); mkdirSync(outside);
    writeFileSync(join(outside, "sentinel"), "safe");
    symlinkSync(outside, join(root, lockName), "junction");
    await expect(withWorkspaceMutation([join(root, "specs", "a.json")], () => "unsafe", root)).rejects.toThrow("안전하지 않은");
    expect(readFileSync(join(outside, "sentinel"), "utf8")).toBe("safe");
  });

  it("uses one lock for a canonical root and its alias", async () => {
    const alias = join(fixtures, "alias"); symlinkSync(root, alias, "junction");
    const path = join(root, "specs", "a.json"); writeFileSync(path, "original");
    const holder = worker("holder", [path]); await holder.wait("ready");
    holder.child.send("start"); await holder.wait("entered");
    let entered = false;
    const waiting = withWorkspaceMutation([join(alias, "specs", "a.json")], () => { entered = true; }, alias);
    await delay(100); expect(entered).toBe(false);
    holder.release(); await holder.wait("result"); await waiting;
    expect(entered).toBe(true); expectNoLock();
  });

  it("rejects out-of-workspace paths before creating a lock", async () => {
    await expect(withWorkspaceMutation([join(fixtures, "outside.json")], () => "unsafe", root)).rejects.toThrow("작업공간 밖");
    expectNoLock();
    expect(readdirSync(root)).toEqual(["specs"]);
  });
});
