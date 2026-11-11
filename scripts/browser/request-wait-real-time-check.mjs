// 실제 브라우저 실행의 최종 상태 회귀. 전체 실행과 진단용 생략 실행을 모두 확인한다.
// 180초 대기가 있으므로 run-journeys.sh(각 120초)에 넣지 않고 CI에서 별도 300초 상한을 둔다.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

async function run(mode) {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./request-wait-real-time.mjs", import.meta.url))], {
    env: { ...process.env, VSB_REAL_TIMEOUT: mode }, stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.on("data", chunk => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on("data", chunk => process.stderr.write(chunk));
  const status = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  assert.deepEqual(status, { code: 0, signal: null }, `VSB_REAL_TIMEOUT=${mode} failed`);
  return stdout.trim().split(/\r?\n/);
}

const partial = await run("0");
assert.match(partial.at(-1), /^PARTIAL request wait real-time journey; skipped timeout, late output rejection and retry;/);
assert.ok(partial.some(line => line.startsWith("SKIP real 180s timeout, late output rejection and retry")));
assert.ok(!partial.some(line => line.startsWith("PASS request wait real-time journey") || line.startsWith("PASS real elapsed: timeout")));
const complete = await run("1");
assert.equal(complete.at(-1), "PASS request wait real-time journey; all stages completed; page errors 0");
assert.ok(complete.some(line => /^PASS real elapsed: timeout after \d+ms, ticket pending, late staged output\/response not accepted, retry accepted$/.test(line)));
assert.ok(!complete.some(line => /^(SKIP|PARTIAL) /.test(line)));
console.log("PASS real-time reporting regression: partial is distinct; full timeout, late output rejection and retry completed");
