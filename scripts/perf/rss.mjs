import { execFileSync } from "node:child_process";

const unavailable = (reason) => ({ valueMB: null, status: "unavailable", reason });

/** Chrome 프로세스 트리 RSS 합. 실패·잘못된 ps 결과를 실제 0MB와 구분한다. */
export function collectChromeRss(rootPid, readProcessTable = () => execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
})) {
  let output;
  try { output = readProcessTable(); } catch { return unavailable("ps_failed"); }
  const processes = new Map();
  for (const line of output.trim().split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 3 || fields.some((field) => !/^\d+$/.test(field))) return unavailable("invalid_process_table");
    const [pid, ppid, rssKB] = fields.map(Number);
    if (![pid, ppid, rssKB].every(Number.isSafeInteger) || processes.has(pid)) return unavailable("invalid_process_table");
    processes.set(pid, { ppid, rssKB });
  }
  if (!processes.has(rootPid)) return unavailable("root_missing");
  const children = new Map();
  for (const [pid, { ppid }] of processes) children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  let totalKB = 0;
  const visited = new Set();
  const stack = [rootPid];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (visited.has(pid)) return unavailable("invalid_process_tree");
    visited.add(pid);
    totalKB += processes.get(pid).rssKB;
    if (!Number.isSafeInteger(totalKB)) return unavailable("invalid_total");
    stack.push(...(children.get(pid) ?? []));
  }
  return { valueMB: Math.round(totalKB / 1024), status: "ok", reason: null };
}

/** 유효한 샘플만 집계한다. 짝수 개의 중앙값은 기존 측정 도구처럼 위쪽 중앙값이다. */
export function summarizeRss(samples) {
  const values = samples.filter((sample) => sample?.status === "ok"
    && typeof sample.valueMB === "number" && Number.isFinite(sample.valueMB) && sample.valueMB >= 0)
    .map((sample) => sample.valueMB).sort((a, b) => a - b);
  const valid = values.length, total = samples.length;
  return {
    median: valid > 0 ? values[Math.floor(valid / 2)] : null,
    max: valid > 0 ? values[valid - 1] : null,
    valid, total,
    status: valid === 0 ? "unavailable" : valid === total ? "ok" : "partial",
  };
}

/** JSON과 같은 요약 객체로 표시한다. null을 문자열 보간 전에 0으로 바꾸지 않는다. */
export function formatRss(summary) {
  const value = summary.median === null ? "N/A" : `${summary.median}MB`;
  return `${value} (${summary.status}, ${summary.valid}/${summary.total} valid)`;
}
