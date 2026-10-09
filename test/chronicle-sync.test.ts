import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

// 제작 연대기(docs/history) 생성기 scripts/history/sync.mjs 회귀 검사.
// 네트워크·Git 없이 커밋된 데이터와 snapshot 파일(--input)만 쓴다.

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCRIPT = join(REPO_ROOT, "scripts", "history", "sync.mjs");
const DATA_FILES = ["commits", "events", "issues", "people", "phases", "pivots"];
let scratch: string | undefined;

type Commit = { sha: string; committedAt: string; parents: string[] };
type Event = { number: number; mergedAt: string; date: string; phase: string; issues: number[]; pullRequests?: number[] } & Record<string, unknown>;
type Phase = { id: string; order: number; slug: string; title: string; start: string; end: string | null; summary: string; stats: Record<string, unknown> };

function sync(args: string[], root = REPO_ROOT) {
  return spawnSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8" });
}

function readJson<T>(root: string, name: string): T {
  return JSON.parse(readFileSync(join(root, "docs", "history", "data", `${name}.json`), "utf8")) as T;
}

function writeJson(root: string, name: string, value: unknown) {
  writeFileSync(join(root, "docs", "history", "data", `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copyHistory() {
  scratch = mkdtempSync(join(tmpdir(), "vsb-chronicle-"));
  cpSync(join(REPO_ROOT, "docs", "history"), join(scratch, "docs", "history"), { recursive: true });
  return scratch;
}

// 기존 develop 끝에 병합 커밋 하나와 PR·이슈를 더한 수집 결과를 흉내 낸다.
function snapshotFor(root: string) {
  const commitsDoc = readJson<{ snapshotCommit: string; cutoff: string; commits: Commit[] }>(root, "commits");
  const events = readJson<{ events: Event[] }>(root, "events").events;
  const issues = readJson<{ issues: { number: number }[] }>(root, "issues").issues;
  const nextIssue = Math.max(...issues.map((i) => i.number), ...events.map((e) => e.number)) + 1;
  const knownIssue = issues.at(-1)!.number;
  const knownPR = events.at(-1)!.number;
  const featureSha = "f".repeat(39) + "1";
  const mergeSha = "f".repeat(39) + "2";
  return {
    nextIssue,
    knownIssue,
    knownPR,
    snapshot: {
      snapshotCommit: mergeSha,
      cutoff: "2030-01-02T00:00:00.000Z",
      commits: [
        ...commitsDoc.commits,
        { sha: featureSha, committedAt: "2030-01-01T23:00:00+09:00", parents: [commitsDoc.snapshotCommit] },
        { sha: mergeSha, committedAt: "2030-01-01T15:30:00Z", parents: [commitsDoc.snapshotCommit, featureSha] },
      ],
      pullRequests: [
        // UTC 15:30은 KST로 다음 날이다.
        {
          number: nextIssue + 1,
          title: `feat: 새 기능 | 표 구분자 (#${nextIssue}, #${knownPR})`,
          author: "GAMMJ",
          mergedAt: "2030-01-01T15:30:00Z",
          mergeCommit: mergeSha,
          label: "feat",
          size: { additions: 3, deletions: 1, files: 2 },
          closingIssues: [knownIssue],
        },
        // 병합 커밋이 develop 이력에 없으면 사건이 아니다.
        {
          number: nextIssue + 2,
          title: "fix: 다른 브랜치",
          author: "wook3964",
          mergedAt: "2030-01-01T10:00:00Z",
          mergeCommit: "e".repeat(40),
          label: "fix",
          size: { additions: 1, deletions: 0, files: 1 },
          closingIssues: [],
        },
      ],
      issues: [
        { number: nextIssue, title: "feat: 새 이슈", createdAt: "2030-01-01T01:00:00Z", author: "dogui1018" },
        // cutoff 뒤에 생긴 이슈는 다음 수집으로 미룬다.
        { number: nextIssue + 3, title: "fix: 늦은 이슈", createdAt: "2030-01-03T00:00:00Z", author: "dogui1018" },
      ],
    },
  };
}

function writeSnapshot(root: string, snapshot: unknown) {
  const path = join(root, "snapshot.json");
  writeFileSync(path, JSON.stringify(snapshot), "utf8");
  return path;
}

function historyBytes(root: string) {
  const dir = join(root, "docs", "history");
  const files = ["README.md", "appendix.md", ...DATA_FILES.map((n) => `data/${n}.json`)];
  return new Map(files.map((f) => [f, readFileSync(join(dir, f))]));
}

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

describe("커밋된 연대기", () => {
  it("--check가 데이터와 생성물(부록·단계 통계)의 일치를 확인한다", () => {
    const result = sync(["--check"]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^OK: \d+ commits, \d+ PRs, \d+ issues/);
  });

  it("리뷰 승인 집계를 데이터와 문서 어디에도 남기지 않는다", () => {
    const dir = join(REPO_ROOT, "docs", "history");
    const texts = [
      ...readdirSync(join(dir, "data")).map((f) => readFileSync(join(dir, "data", f), "utf8")),
      readFileSync(join(dir, "README.md"), "utf8"),
      readFileSync(join(dir, "appendix.md"), "utf8"),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/approv|"review"|승인/i);
    }
  });

  it("본문 머리말의 수치가 데이터와 같다", () => {
    const readme = readFileSync(join(REPO_ROOT, "docs", "history", "README.md"), "utf8");
    const commits = readJson<{ commits: unknown[] }>(REPO_ROOT, "commits").commits.length;
    const prs = readJson<{ events: unknown[] }>(REPO_ROOT, "events").events.length;
    const issues = readJson<{ issues: unknown[] }>(REPO_ROOT, "issues").issues.length;
    expect(readme).toContain(`커밋 ${commits}개, 병합된 PR ${prs}건, 이슈 ${issues}건`);
  });
});

describe("증분 sync", () => {
  it("새 병합 PR·이슈·커밋을 진행 중 단계에 덧붙이고 다시 실행해도 그대로다", () => {
    const root = copyHistory();
    const { snapshot, nextIssue, knownIssue, knownPR } = snapshotFor(root);
    const input = writeSnapshot(root, snapshot);
    const before = readJson<{ commits: Commit[] }>(root, "commits").commits.length;

    const first = sync(["--input", input], root);
    expect(first.stderr).toBe("");
    expect(first.status).toBe(0);
    expect(first.stdout).toContain(`추가: PR 1건 (#${nextIssue + 1}), 이슈 1건, 커밋 2개`);

    const events = readJson<{ generatedAt: string; events: Event[] }>(root, "events");
    const added = events.events.at(-1)!;
    expect(events.generatedAt).toBe(snapshot.cutoff);
    expect(added).toEqual({
      type: "pr_merged",
      number: nextIssue + 1,
      title: `feat: 새 기능 | 표 구분자 (#${nextIssue}, #${knownPR})`,
      author: "GAMMJ",
      mergedAt: "2030-01-01T15:30:00Z",
      date: "2030-01-02",
      phase: readJson<{ phases: Phase[] }>(root, "phases").phases.at(-1)!.id,
      label: "feat",
      size: { additions: 3, deletions: 1, files: 2 },
      issues: [knownIssue, nextIssue].sort((a, b) => a - b),
      pullRequests: [knownPR],
    });
    const issues = readJson<{ cutoff: string; issues: { number: number }[] }>(root, "issues");
    expect(issues.cutoff).toBe(snapshot.cutoff);
    expect(issues.issues.map((i) => i.number)).toContain(nextIssue);
    expect(issues.issues.map((i) => i.number)).not.toContain(nextIssue + 3);
    const commits = readJson<{ snapshotCommit: string; commits: Commit[] }>(root, "commits");
    expect(commits.snapshotCommit).toBe(snapshot.snapshotCommit);
    expect(commits.commits).toHaveLength(before + 2);

    const appendix = readFileSync(join(root, "docs", "history", "appendix.md"), "utf8");
    expect(appendix).toContain(`| 01-02 | [#${nextIssue + 1}](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/${nextIssue + 1}) | feat: 새 기능 \\| 표 구분자`);
    expect(appendix).toContain("01-02 수집 시점");

    // 생성물은 UTF-8·LF이고, 같은 입력을 다시 넣어도 바뀌지 않는다.
    const synced = historyBytes(root);
    for (const raw of synced.values()) expect(raw.includes(13)).toBe(false);
    const second = sync(["--input", input], root);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("추가: PR 0건, 이슈 0건, 커밋 0개");
    expect(historyBytes(root)).toEqual(synced);
    expect(sync(["--check"], root).status).toBe(0);
  });

  it("기존 커밋이 develop 이력에서 사라지면 아무것도 쓰지 않고 멈춘다", () => {
    const root = copyHistory();
    const { snapshot } = snapshotFor(root);
    snapshot.commits.shift();
    const before = historyBytes(root);

    const result = sync(["--input", writeSnapshot(root, snapshot)], root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("새 develop 이력에 없거나 달라졌습니다");
    expect(historyBytes(root)).toEqual(before);
  });

  it("phases.json에 새 단계를 열면 --check가 실패하고 --write가 사건과 통계를 다시 나눈다", () => {
    const root = copyHistory();
    const { snapshot, nextIssue } = snapshotFor(root);
    expect(sync(["--input", writeSnapshot(root, snapshot)], root).status).toBe(0);

    const phasesDoc = readJson<{ phases: Phase[] }>(root, "phases");
    const open = phasesDoc.phases.at(-1)!;
    open.end = "2030-01-01";
    phasesDoc.phases.push({
      id: `p${open.order + 1}`,
      order: open.order + 1,
      slug: "next",
      title: "다음 단계",
      start: "2030-01-02",
      end: null,
      summary: "새 단계 요약.",
      stats: {},
    });
    writeJson(root, "phases", phasesDoc);

    const stale = sync(["--check"], root);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("--write");

    const write = sync(["--write"], root);
    expect(write.stderr).toBe("");
    expect(write.status).toBe(0);
    const events = readJson<{ events: Event[] }>(root, "events").events;
    expect(events.find((e) => e.number === nextIssue + 1)!.phase).toBe(`p${open.order + 1}`);
    const stats = readJson<{ phases: Phase[] }>(root, "phases").phases.at(-1)!.stats;
    expect(stats).toEqual({ phase: `p${open.order + 1}`, mergedPRs: 1, commits: 1, issuesOpened: 0, prAuthors: { GAMMJ: 1 } });
    expect(sync(["--check"], root).status).toBe(0);
  });

  it("진행 중 단계가 마지막이 아니면 단계 정의 오류로 멈춘다", () => {
    const root = copyHistory();
    const phasesDoc = readJson<{ phases: Phase[] }>(root, "phases");
    phasesDoc.phases[0].end = null;
    writeJson(root, "phases", phasesDoc);

    const result = sync(["--check"], root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("진행 중");
  });
});
