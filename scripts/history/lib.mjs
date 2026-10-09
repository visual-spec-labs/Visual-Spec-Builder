// 제작 연대기(docs/history) 데이터를 검사하고 부록·단계 통계를 생성한다.
// 네트워크와 Git을 쓰지 않는 순수 로직만 둔다 — 수집은 collect.mjs, 실행은 sync.mjs가 맡는다.

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export const REPO = "visual-spec-labs/Visual-Spec-Builder";
export const REPO_URL = `https://github.com/${REPO}`;
// 시기 구분 예시로 부록에 싣는 커밋 — UTC로는 10-04, KST로는 10-05다.
const BOUNDARY_SHA = "906126dd4c322e325cfab76bb9d8cee171172e32";

export function historyPaths(root) {
  const history = join(root, "docs", "history");
  const data = join(history, "data");
  return {
    history,
    data,
    appendix: join(history, "appendix.md"),
    file: (name) => join(data, `${name}.json`),
  };
}

// Windows 한국어 로캘(cp949)에서도 깨지지 않게 항상 UTF-8로 읽는다.
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadHistory(root) {
  const paths = historyPaths(root);
  const load = (name) => readJson(paths.file(name));
  return {
    phases: load("phases"),
    events: load("events"),
    commits: load("commits"),
    issues: load("issues"),
    pivots: load("pivots"),
    people: load("people"),
  };
}

export function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// commits.json은 커밋 하나를 한 줄로 둬서 diff를 짧게 유지한다.
export function formatCommitsJson(doc) {
  const { commits, ...head } = doc;
  const headText = JSON.stringify(head, null, 2).slice(0, -2);
  const rows = commits.map((commit) => `    ${JSON.stringify(commit)}`).join(",\n");
  return `${headText},\n  "commits": [\n${rows}\n  ]\n}\n`;
}

// 출력은 항상 LF·UTF-8이다(.gitattributes도 eol=lf).
export function writeText(path, content) {
  writeFileSync(path, content, { encoding: "utf8" });
}

// Asia/Seoul은 1988년 이후 서머타임이 없어 +9시간 고정으로 계산한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDate(timestamp) {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) throw new Error(`시각을 읽을 수 없습니다: ${timestamp}`);
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    assert(!seen.has(row[key]), `${label}: ${key} ${row[key]}가 중복됩니다.`);
    seen.add(row[key]);
  }
}

// 날짜가 속한 단계 하나를 찾는다. end가 비어 있는 단계는 진행 중이라 끝이 열려 있다.
export function phaseOf(phases, timestamp) {
  const day = kstDate(timestamp);
  const matches = phases.filter((p) => p.start <= day && (p.end === null || day <= p.end));
  assert(matches.length === 1, `${timestamp}(${day})가 단계 ${matches.length}개에 걸립니다. phases.json의 start/end를 확인하세요.`);
  return matches[0].id;
}

function validatePhases(phases) {
  assertUnique(phases, "id", "phases");
  phases.forEach((phase, index) => {
    assert(phase.order === index, `단계 ${phase.id}의 order는 ${index}여야 합니다.`);
    assert(phase.end === null ? index === phases.length - 1 : phase.start <= phase.end,
      `단계 ${phase.id}: end가 비어 있는(진행 중) 단계는 마지막 하나뿐이고, start <= end여야 합니다.`);
    if (index > 0) {
      assert(phases[index - 1].end !== null && phases[index - 1].end < phase.start,
        `단계 ${phase.id}는 이전 단계가 끝난 뒤에 시작해야 합니다.`);
    }
  });
}

// 데이터끼리의 정합성을 검사한다. 생성물(통계·부록)은 checkOutputs가 따로 본다.
export function validateHistory(data) {
  const phases = data.phases.phases;
  const events = data.events.events;
  const commits = data.commits.commits;
  const issues = data.issues.issues;
  const cutoff = data.events.generatedAt;
  assert(cutoff === data.phases.generatedAt && cutoff === data.commits.cutoff && cutoff === data.issues.cutoff,
    "events.generatedAt, phases.generatedAt, commits.cutoff, issues.cutoff가 같아야 합니다.");
  validatePhases(phases);
  assertUnique(events, "number", "events");
  assertUnique(commits, "sha", "commits");
  assertUnique(issues, "number", "issues");
  assertUnique(data.pivots.pivots, "id", "pivots");
  assertUnique(data.people.people, "handle", "people");

  const prNumbers = new Set(events.map((e) => e.number));
  const issueNumbers = new Set(issues.map((i) => i.number));
  for (const issue of issues) {
    assert(!prNumbers.has(issue.number), `#${issue.number}가 PR과 이슈 양쪽에 있습니다.`);
    assert(issue.type === "issue" && issue.url === `${REPO_URL}/issues/${issue.number}`, `이슈 #${issue.number}의 type/url이 잘못됐습니다.`);
    assert(Date.parse(issue.createdAt) <= Date.parse(cutoff), `이슈 #${issue.number}가 cutoff 뒤에 생성됐습니다.`);
  }
  for (const event of events) {
    assert(event.type === "pr_merged", `PR #${event.number}: type은 pr_merged여야 합니다.`);
    assert(!("review" in event), `PR #${event.number}: 리뷰 필드는 기록하지 않습니다.`);
    assert(Date.parse(event.mergedAt) <= Date.parse(cutoff), `PR #${event.number}가 cutoff 뒤에 병합됐습니다.`);
    assert(event.date === kstDate(event.mergedAt), `PR #${event.number}: date는 mergedAt의 KST 날짜여야 합니다.`);
    assert(event.issues.every((n, i) => issueNumbers.has(n) && (i === 0 || event.issues[i - 1] < n)),
      `PR #${event.number}: issues는 이슈 번호만 오름차순으로 담습니다.`);
    assert((event.pullRequests ?? []).every((n) => prNumbers.has(n)), `PR #${event.number}: pullRequests에 모르는 PR이 있습니다.`);
  }
  for (let i = 1; i < events.length; i += 1) {
    const [a, b] = [events[i - 1], events[i]];
    assert(a.mergedAt < b.mergedAt || (a.mergedAt === b.mergedAt && a.number < b.number), "events는 mergedAt, number 순이어야 합니다.");
  }
  for (let i = 1; i < issues.length; i += 1) {
    assert(issues[i - 1].number < issues[i].number, "issues는 번호 순이어야 합니다.");
  }
  for (let i = 1; i < commits.length; i += 1) {
    assert(commits[i - 1].sha < commits[i].sha, "commits는 sha 순이어야 합니다.");
  }

  // 시각만 거른 목록이 아니라 snapshotCommit에서 도달 가능한 그래프 전체를 담는다.
  assert(data.commits.dateField === "committer" && data.commits.includeMergeCommits === true,
    "커밋은 committer 날짜·병합 커밋 포함 기준이어야 합니다.");
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const reachable = new Set();
  const pending = [data.commits.snapshotCommit];
  while (pending.length > 0) {
    const sha = pending.pop();
    if (reachable.has(sha)) continue;
    const commit = bySha.get(sha);
    assert(commit, `커밋 ${sha}가 commits.json에 없습니다.`);
    reachable.add(sha);
    pending.push(...commit.parents);
  }
  assert(reachable.size === bySha.size, "commits.json에 snapshotCommit에서 도달할 수 없는 커밋이 있습니다.");
}

// 단계 통계를 다시 계산한다. 사건의 phase도 날짜 기준으로 다시 맞춘다 —
// 사람이 phases.json에서 단계 경계를 옮기면 --write 한 번으로 따라간다.
function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export function computeStats(data) {
  const phases = data.phases.phases;
  const events = data.events.events.map((event) => ({ ...event, phase: phaseOf(phases, event.mergedAt) }));
  const commitCounts = countBy(data.commits.commits.map((c) => phaseOf(phases, c.committedAt)));
  const issueCounts = countBy(data.issues.issues.map((i) => phaseOf(phases, i.createdAt)));
  const nextPhases = phases.map((phase) => {
    const own = events.filter((e) => e.phase === phase.id);
    return {
      ...phase,
      stats: {
        phase: phase.id,
        mergedPRs: own.length,
        commits: commitCounts[phase.id] ?? 0,
        issuesOpened: issueCounts[phase.id] ?? 0,
        prAuthors: countBy(own.map((e) => e.author)),
      },
    };
  });
  return {
    ...data,
    phases: { ...data.phases, phases: nextPhases },
    events: { ...data.events, events },
  };
}

export function renderAppendix(data) {
  const phases = data.phases.phases;
  const events = data.events.events;
  const commits = data.commits.commits;
  const issues = data.issues.issues;
  const cutoffDay = kstDate(data.events.generatedAt);
  const prNumbers = new Set(events.map((e) => e.number));

  // 모르는 번호(병합되지 않은 PR 등)는 GitHub가 PR로도 넘겨 주는 issues 경로로 잇는다.
  const link = (number) => `[#${number}](${REPO_URL}/${prNumbers.has(number) ? "pull" : "issues"}/${number})`;
  const title = (text) => text.replaceAll("|", "\\|").replaceAll("\n", " ").replace(/#(\d+)/g, (_, n) => link(Number(n)));
  const period = (p) => `${p.start.slice(5)} ~ ${p.end ? p.end.slice(5) : `${cutoffDay.slice(5)} 수집 시점`}`;

  const boundary = commits.find((c) => c.sha === BOUNDARY_SHA);
  assert(boundary && kstDate(boundary.committedAt) === "2026-10-05", "시기 구분 예시 커밋을 찾을 수 없습니다.");
  const snapshot = data.commits.snapshotCommit;

  const lines = [
    "# 부록 — 단계별 상세 기록",
    "",
    "> [`data/`](./data/)에 모은 develop 기록에서 생성한 PR·이슈 목록과 집계다. 날짜·출처 기준은 [본문](./README.md#이-기록에-대하여)을 따른다.",
    "> 갱신: `node scripts/history/sync.mjs` · 검사: `node scripts/history/sync.mjs --check` (저장소 루트에서 실행, [갱신 절차](./UPDATING.md)).",
    "",
    "## 단계 요약",
    "",
    "| 단계 | 기간 | 병합 PR | 커밋 | 새 이슈 |",
    "|---|---|---:|---:|---:|",
  ];
  for (const p of phases) {
    const s = p.stats;
    lines.push(`| [${p.order}. ${p.title}](#${p.order}-${p.slug}) | ${period(p)} | ${s.mergedPRs} | ${s.commits} | ${s.issuesOpened} |`);
  }
  lines.push(
    "",
    `커밋은 병합 커밋을 포함한 고유 SHA 수이며, **committer 시각을 KST로 변환**해 나눈다. 예를 들어 [906126d](${REPO_URL}/commit/${BOUNDARY_SHA})는 UTC 10월 4일이지만 KST 10월 5일에 속한다. 수집 시점의 develop([${snapshot.slice(0, 7)}](${REPO_URL}/commit/${snapshot}))에서 도달 가능한 커밋은 모두 ${commits.length}개다.`,
    "",
    "이슈는 생성일로 배치하고 PR과 구분했다. 제목은 각 항목을 수집한 시점의 표기다.",
  );
  for (const p of phases) {
    const s = p.stats;
    const authors = Object.entries(s.prAuthors).sort((a, b) => b[1] - a[1]);
    lines.push(
      "",
      `<a id="${p.order}-${p.slug}"></a>`,
      "",
      `## ${p.order}. ${p.title}`,
      "",
      `${period(p)} · ${p.summary}`,
      "",
      `- 병합 PR ${s.mergedPRs}건 · 커밋 ${s.commits}개 · 새 이슈 ${s.issuesOpened}건`,
      `- PR 작성: ${authors.map(([author, n]) => `${author} ${n}`).join(" · ")}`,
      "",
      "### 병합 PR",
      "",
      "| 병합일 | PR | 내용 | 작성 |",
      "|---|---|---|---|",
    );
    for (const e of events.filter((event) => event.phase === p.id)) {
      lines.push(`| ${e.date.slice(5)} | ${link(e.number)} | ${title(e.title)} | ${e.author} |`);
    }
    lines.push("", "### 새 이슈", "");
    const own = issues
      .filter((i) => phaseOf(phases, i.createdAt) === p.id)
      .sort((a, b) => (a.createdAt === b.createdAt ? a.number - b.number : a.createdAt < b.createdAt ? -1 : 1));
    if (own.length === 0) {
      lines.push("이 기간에 등록된 이슈는 없다.");
    } else {
      lines.push("| 등록일 | 이슈 | 내용 | 작성 |", "|---|---|---|---|");
      for (const i of own) {
        lines.push(`| ${kstDate(i.createdAt).slice(5)} | ${link(i.number)} | ${title(i.title)} | ${i.author} |`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

// 데이터에서 다시 만든 파일 내용. 키는 저장소 기준 상대 경로가 아니라 절대 경로다.
export function renderOutputs(root, data) {
  const paths = historyPaths(root);
  const next = computeStats(data);
  return {
    data: next,
    files: new Map([
      [paths.file("events"), formatJson(next.events)],
      [paths.file("phases"), formatJson(next.phases)],
      [paths.appendix, renderAppendix(next)],
    ]),
  };
}

// 생성물이 데이터와 어긋난 파일 목록을 돌려준다(네트워크·Git 없음).
export function staleOutputs(root, data) {
  const { files } = renderOutputs(root, data);
  const stale = [];
  for (const [path, content] of files) {
    if (readFileSync(path, "utf8") !== content) stale.push(relative(root, path).replaceAll("\\", "/"));
  }
  return stale;
}

export function summary(data) {
  const counts = data.phases.phases.map((p) => p.stats.commits).join(", ");
  return `${data.commits.commits.length} commits, ${data.events.events.length} PRs, ${data.issues.issues.length} issues; phase commits: ${counts}`;
}

// Git 버전에 따라 같은 UTC 시각도 Z 또는 +00:00으로 나온다.
// 표기 대신 유효한 시각과 순서를 보존한 부모 목록을 비교한다.
export function sameCommit(a, b) {
  return Boolean(a && b && a.sha === b.sha &&
    Date.parse(a.committedAt) === Date.parse(b.committedAt) &&
    a.parents.length === b.parents.length && a.parents.every((sha, i) => sha === b.parents[i]));
}

// 새로 수집한 기록을 기존 데이터에 덧붙인다. 이미 있는 번호·커밋은 건드리지 않는다.
// snapshot: { snapshotCommit, cutoff, commits[], pullRequests[], issues[] } — collect.mjs 참고.
export function applySnapshot(data, snapshot) {
  const oldCutoff = data.events.generatedAt;
  assert(Date.parse(snapshot.cutoff) >= Date.parse(oldCutoff), `새 cutoff(${snapshot.cutoff})가 이전 cutoff(${oldCutoff})보다 앞섭니다.`);

  // 기존 커밋은 그대로 남아 있어야 한다(develop 이력 재작성 감지).
  const nextCommits = new Map(snapshot.commits.map((c) => [c.sha, c]));
  for (const commit of data.commits.commits) {
    const fresh = nextCommits.get(commit.sha);
    assert(sameCommit(fresh, commit),
      `기존 커밋 ${commit.sha}가 새 develop 이력에 없거나 달라졌습니다.`);
  }
  const oldCommits = new Map(data.commits.commits.map((c) => [c.sha, c]));
  const commits = [...nextCommits.values()]
    // 동등한 시각 표기 때문에 기존 원장 전체가 다시 쓰이지 않게 한다.
    .map((c) => oldCommits.get(c.sha) ?? c)
    .map(({ sha, committedAt, parents }) => ({ sha, committedAt, parents }))
    .sort((a, b) => (a.sha < b.sha ? -1 : 1));

  const knownIssues = new Set(data.issues.issues.map((i) => i.number));
  const addedIssues = snapshot.issues
    .filter((i) => !knownIssues.has(i.number) && Date.parse(i.createdAt) <= Date.parse(snapshot.cutoff))
    .map((i) => ({
      number: i.number,
      title: i.title,
      createdAt: i.createdAt,
      author: i.author,
      type: "issue",
      url: `${REPO_URL}/issues/${i.number}`,
    }));
  const issues = [...data.issues.issues, ...addedIssues].sort((a, b) => a.number - b.number);
  const issueNumbers = new Set(issues.map((i) => i.number));

  // develop 이력에 실제로 들어온(병합 커밋이 도달 가능한) PR만 사건으로 삼는다.
  const knownPRs = new Set(data.events.events.map((e) => e.number));
  const newPRs = snapshot.pullRequests.filter((pr) =>
    !knownPRs.has(pr.number) && nextCommits.has(pr.mergeCommit) && Date.parse(pr.mergedAt) <= Date.parse(snapshot.cutoff));
  const prNumbers = new Set([...knownPRs, ...newPRs.map((pr) => pr.number)]);
  const lastPhase = data.phases.phases.at(-1);
  const addedEvents = newPRs.map((pr) => {
    const titleRefs = [...pr.title.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    const linked = [...new Set([...pr.closingIssues, ...titleRefs])].filter((n) => issueNumbers.has(n)).sort((a, b) => a - b);
    const pullRequests = [...new Set(titleRefs)].filter((n) => prNumbers.has(n) && n !== pr.number);
    return {
      type: "pr_merged",
      number: pr.number,
      title: pr.title,
      author: pr.author,
      mergedAt: pr.mergedAt,
      date: kstDate(pr.mergedAt),
      // 새 사건은 진행 중인 마지막 단계에 둔다. 경계를 바꾸면 computeStats가 다시 맞춘다.
      phase: lastPhase.id,
      label: pr.label,
      size: pr.size,
      issues: linked,
      ...(pullRequests.length > 0 ? { pullRequests } : {}),
    };
  });
  const events = [...data.events.events, ...addedEvents]
    .sort((a, b) => (a.mergedAt === b.mergedAt ? a.number - b.number : a.mergedAt < b.mergedAt ? -1 : 1));

  const cutoff = snapshot.cutoff;
  return {
    data: {
      ...data,
      events: { ...data.events, generatedAt: cutoff, events },
      phases: { ...data.phases, generatedAt: cutoff },
      commits: { ...data.commits, snapshotCommit: snapshot.snapshotCommit, cutoff, commits },
      issues: { ...data.issues, cutoff, lastSyncedAt: cutoff, issues },
    },
    added: {
      events: addedEvents.map((e) => e.number),
      issues: addedIssues.map((i) => i.number),
      commits: commits.length - data.commits.commits.length,
    },
  };
}

export function writeHistory(root, data) {
  const paths = historyPaths(root);
  const { data: next, files } = renderOutputs(root, data);
  writeText(paths.file("commits"), formatCommitsJson(next.commits));
  writeText(paths.file("issues"), formatJson(next.issues));
  for (const [path, content] of files) writeText(path, content);
  return next;
}
