#!/usr/bin/env node
// 제작 연대기 데이터를 develop 최신까지 갱신한다. 절차는 docs/history/UPDATING.md 참고.
//
// node scripts/history/sync.mjs            # git fetch + gh로 수집 → data 추가 → 통계·부록 재생성
// node scripts/history/sync.mjs --write    # 수집 없이 통계·부록만 재생성(phases.json 경계를 고친 뒤)
// node scripts/history/sync.mjs --check    # 네트워크 없이 데이터·생성물 일치 검사
//
// 옵션: --ref <git ref>(기본 origin/develop), --no-fetch, --verify-git(커밋 목록을 로컬 Git과 대조),
//       --root <dir>(저장소 루트, 테스트용), --input <json>(수집 대신 snapshot 파일, 테스트용)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { collectSnapshot, verifyGitCommits } from "./collect.mjs";
import { applySnapshot, loadHistory, staleOutputs, summary, validateHistory, writeHistory } from "./lib.mjs";

const { values: options } = parseArgs({
  options: {
    check: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
    "verify-git": { type: "boolean", default: false },
    fetch: { type: "boolean", default: true },
    ref: { type: "string", default: "origin/develop" },
    root: { type: "string" },
    input: { type: "string" },
  },
  allowNegative: true,
});

const root = resolve(options.root ?? fileURLToPath(new URL("../..", import.meta.url)));

function main() {
  let data = loadHistory(root);
  if (options.check) {
    validateHistory(data);
    const stale = staleOutputs(root, data);
    if (stale.length > 0) {
      throw new Error(`생성물이 데이터와 다릅니다: ${stale.join(", ")} — node scripts/history/sync.mjs --write로 다시 만드세요.`);
    }
    if (options["verify-git"]) verifyGitCommits(root, data.commits);
    console.log(`OK: ${summary(data)}`);
    return;
  }

  if (!options.write) {
    const snapshot = options.input
      ? JSON.parse(readFileSync(resolve(options.input), "utf8"))
      : collectSnapshot(root, { ref: options.ref, fetch: options.fetch, since: data.events.generatedAt });
    const result = applySnapshot(data, snapshot);
    data = result.data;
    const { events, issues, commits } = result.added;
    console.log(`추가: PR ${events.length}건${events.length ? ` (#${events.join(", #")})` : ""}, 이슈 ${issues.length}건, 커밋 ${commits}개`);
  }
  validateHistory(data);
  const written = writeHistory(root, data);
  if (options["verify-git"]) verifyGitCommits(root, written.commits);
  console.log(`OK: ${summary(written)}`);
}

try {
  main();
} catch (error) {
  console.error(`history: ${error.message}`);
  process.exit(1);
}
