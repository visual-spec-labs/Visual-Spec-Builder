// 마지막 cutoff 이후의 develop 기록을 Git과 gh CLI(GitHub GraphQL)로 모은다.
// 결과는 lib.mjs의 applySnapshot이 받는 snapshot 형태다.

import { execFileSync } from "node:child_process";

import { REPO, sameCommit } from "./lib.mjs";

const [OWNER, NAME] = REPO.split("/");
const MAX_BUFFER = 64 * 1024 * 1024;

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER });
}

// git log --format=%cI는 committer 시각을 원래 시간대 그대로 준다(UTC 표기는 Git 버전에 따라 Z 또는 +00:00).
export function readGitCommits(root, snapshotCommit) {
  const log = run("git", ["log", snapshotCommit, "--format=%H%x09%cI%x09%P"], root);
  return log.split("\n").filter(Boolean).map((line) => {
    const [sha, committedAt, parents] = line.split("\t");
    return { sha, committedAt, parents: parents ? parents.split(" ") : [] };
  });
}

// --verify-git과 테스트가 같은 실제 Git 대조 경로를 쓴다.
export function verifyGitCommits(root, commitsDoc) {
  const actual = readGitCommits(root, commitsDoc.snapshotCommit);
  const expected = new Map(commitsDoc.commits.map((c) => [c.sha, c]));
  if (actual.length !== expected.size || !actual.every((c) => sameCommit(expected.get(c.sha), c))) {
    throw new Error("commits.json이 snapshotCommit의 Git 이력과 다릅니다.");
  }
}

const SEARCH = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title mergedAt additions deletions changedFiles
        author { login }
        labels(first: 1) { nodes { name } }
        mergeCommit { oid }
        closingIssuesReferences(first: 50) { nodes { number repository { nameWithOwner } } }
      }
      ... on Issue { number title createdAt author { login } }
    }
  }
}`;

function search(root, q) {
  const nodes = [];
  let after = null;
  do {
    const args = ["api", "graphql", "-f", `query=${SEARCH}`, "-f", `q=${q}`];
    if (after) args.push("-f", `after=${after}`);
    const page = JSON.parse(run("gh", args, root)).data.search;
    nodes.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return nodes;
}

// 탈퇴한 계정은 GitHub 표기대로 ghost로 남긴다.
const login = (author) => author?.login ?? "ghost";

export function collectSnapshot(root, { ref, fetch, since }) {
  if (fetch) run("git", ["fetch", "--quiet", "origin", "develop"], root);
  const snapshotCommit = run("git", ["rev-parse", ref], root).trim();
  // cutoff는 develop을 받아 온 뒤에 잡는다 — 도달 가능한 병합은 모두 cutoff 이전이다.
  const cutoff = new Date().toISOString();
  const commits = readGitCommits(root, snapshotCommit);

  // fetch와 cutoff 사이에 병합된 PR이 빠져도 다음 실행에서 잡히도록 하루 앞에서부터 찾는다.
  const sinceDay = new Date(Date.parse(since) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const pullRequests = search(root, `repo:${REPO} is:pr is:merged base:develop merged:>=${sinceDay}`)
    .filter((pr) => pr.mergeCommit)
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: login(pr.author),
      mergedAt: pr.mergedAt,
      mergeCommit: pr.mergeCommit.oid,
      label: pr.labels.nodes[0]?.name ?? null,
      size: { additions: pr.additions, deletions: pr.deletions, files: pr.changedFiles },
      closingIssues: pr.closingIssuesReferences.nodes
        .filter((node) => node.repository.nameWithOwner === `${OWNER}/${NAME}`)
        .map((node) => node.number),
    }));
  const issues = search(root, `repo:${REPO} is:issue created:>=${sinceDay}`).map((issue) => ({
    number: issue.number,
    title: issue.title,
    createdAt: issue.createdAt,
    author: login(issue.author),
  }));
  return { snapshotCommit, cutoff, commits, pullRequests, issues };
}
