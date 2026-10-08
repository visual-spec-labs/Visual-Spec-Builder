#!/usr/bin/env python3
"""Render/check the chronicle from frozen inputs; never fetch or advance the cutoff.

Requires Python 3.9+ and IANA timezone data (system database or the optional
tzdata package, commonly needed on Windows: python -m pip install tzdata).
Files are UTF-8; generated output always uses LF.

python scripts/history.py --write       # update phase statistics and appendix
python scripts/history.py --verify-git  # check output and the frozen Git universe
"""
import argparse
from collections import Counter
from datetime import datetime
import json
from pathlib import Path
import re
import subprocess
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[1]
HISTORY = ROOT / 'docs/history'
DATA = HISTORY / 'data'
try:
    KST = ZoneInfo('Asia/Seoul')
except ZoneInfoNotFoundError as error:
    raise SystemExit('Asia/Seoul timezone data is required. Install system IANA data or run: python -m pip install tzdata') from error
REPO_URL = 'https://github.com/visual-spec-labs/Visual-Spec-Builder'


def load(name):
    return json.loads((DATA / f'{name}.json').read_text(encoding='utf-8'))


def date(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(KST).date().isoformat()


def unique(rows, key):
    values = [row[key] for row in rows]
    assert len(values) == len(set(values)), f'duplicate {key}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--verify-git', action='store_true')
    args = parser.parse_args()
    phases_doc, events_doc, commits_doc, issues_doc = [load(n) for n in ('phases', 'events', 'commits', 'issues')]
    phases, events, commits, issues = phases_doc['phases'], events_doc['events'], commits_doc['commits'], issues_doc['issues']
    cutoff = events_doc['generatedAt']
    assert cutoff == phases_doc['generatedAt'] == commits_doc['cutoff'] == issues_doc['cutoff']
    unique(phases, 'id')
    unique(events, 'number')
    unique(commits, 'sha')
    unique(issues, 'number')
    unique(load('pivots')['pivots'], 'id')
    unique(load('people')['people'], 'handle')
    prs, issue_ids = {e['number'] for e in events}, {i['number'] for i in issues}
    assert not prs & issue_ids
    assert all(i['type'] == 'issue' and i['url'] == f"{REPO_URL}/issues/{i['number']}" for i in issues)
    assert all(e['type'] == 'pr_merged' for e in events)
    for e in events:
        assert set(e['issues']) <= issue_ids, f"PR {e['number']}: non-issue reference"
        assert set(e.get('pullRequests', [])) <= prs, f"PR {e['number']}: unknown PR reference"
    for row in events + issues:
        assert set(map(int, re.findall(r'#(\d+)', row['title']))) <= prs | issue_ids
    # The entire reachable graph is frozen, not just a timestamp-filtered log.
    by_sha = {c['sha']: c for c in commits}
    reachable, pending = set(), [commits_doc['snapshotCommit']]
    while pending:
        sha = pending.pop()
        if sha not in reachable:
            reachable.add(sha)
            pending.extend(by_sha[sha]['parents'])
    assert reachable == set(by_sha)
    assert commits_doc['dateField'] == 'committer' and commits_doc['includeMergeCommits'] is True
    if args.verify_git:
        log = subprocess.check_output(['git', 'log', commits_doc['snapshotCommit'], '--format=%H%x09%cI%x09%P'], cwd=ROOT, text=True, encoding='utf-8')
        actual = {}
        for line in log.splitlines():
            sha, committed_at, parents = line.split('\t')
            actual[sha] = {'sha': sha, 'committedAt': committed_at, 'parents': parents.split()}
        assert actual == by_sha, 'frozen commit source differs from Git'

    def phase_of(timestamp):
        assert datetime.fromisoformat(timestamp.replace('Z', '+00:00')) <= datetime.fromisoformat(cutoff.replace('Z', '+00:00'))
        day = date(timestamp)
        matches = [p['id'] for p in phases if p['start'] <= day <= (p['end'] or date(cutoff))]
        assert len(matches) == 1, (timestamp, matches)
        return matches[0]

    commit_counts = Counter(phase_of(c['committedAt']) for c in commits)
    issue_counts = Counter(phase_of(i['createdAt']) for i in issues)
    for e in events:
        assert e['phase'] == phase_of(e['mergedAt']) and e['date'] == date(e['mergedAt'])
    for p in phases:
        es = [e for e in events if e['phase'] == p['id']]
        p['stats'] = {'phase': p['id'], 'mergedPRs': len(es), 'approved': sum(e['review'] == 'approved' for e in es), 'commits': commit_counts[p['id']], 'issuesOpened': issue_counts[p['id']], 'prAuthors': dict(Counter(e['author'] for e in es))}

    def link(number):
        kind = 'pull' if number in prs else 'issues'
        assert number in prs | issue_ids
        return f'[#{number}]({REPO_URL}/{kind}/{number})'

    def title(text):
        text = text.replace('|', r'\|').replace('\n', ' ')
        return re.sub(r'#(\d+)', lambda m: link(int(m[1])), text)

    def period(p):
        return f"{p['start'][5:]} ~ {p['end'][5:] if p['end'] else date(cutoff)[5:] + ' 수집 시점'}"

    lines = ['# 부록 — 단계별 상세 기록', '', '> 동결된 [`data/`](./data/)에서 생성한 PR·이슈 목록과 집계다. 날짜·출처 기준은 [본문](./README.md#이-기록에-대하여)을 따른다.', '> 재생성: `python scripts/history.py --write` · 검증: `python scripts/history.py --verify-git` (저장소 루트에서 실행).', '', '## 단계 요약', '', '| 단계 | 기간 | 병합 PR | 리뷰 승인 | 커밋 | 새 이슈 |', '|---|---|---:|---:|---:|---:|']
    for p in phases:
        s = p['stats']
        lines.append(f"| [{p['order']}. {p['title']}](#{p['order']}-{p['slug']}) | {period(p)} | {s['mergedPRs']} | {s['approved']} | {s['commits']} | {s['issuesOpened']} |")
    def approval_ratio(selected):
        return f"{sum(e['review'] == 'approved' for e in selected)}/{len(selected)}"

    period2 = [e for e in events if e['phase'] == 'p2']
    period67 = [e for e in events if e['phase'] in ('p6', 'p7')]
    period8 = [e for e in events if e['phase'] == 'p8']
    boundary = by_sha['906126dd4c322e325cfab76bb9d8cee171172e32']
    assert date(boundary['committedAt']) == '2026-10-05'
    lines += ['', f"리뷰 승인은 수집 당시 `review: approved`인 PR 수다. 전체 {approval_ratio(events)}, 8월 21~31일 {approval_ratio(period2)}, 10월 4~5일 {approval_ratio(period67)}, 10월 6일~수집 시점 {approval_ratio(period8)}이다.", '', '커밋은 병합 커밋을 포함한 고유 SHA 수이며, **committer 시각을 KST로 변환**해 나눈다. 예를 들어 [906126d](' + REPO_URL + '/commit/906126dd4c322e325cfab76bb9d8cee171172e32)는 UTC 10월 4일이지만 KST 10월 5일에 속한다. ' + f'동결된 Git 이력의 합계는 {len(commits)}개다.', '', '이슈는 생성일로 배치하고 PR과 구분했다. 제목은 이번 원자료 조회 시점의 표기다.']
    review = {'approved': '승인', 'none': '—', 'changes_requested': '변경 요청'}
    for p in phases:
        s = p['stats']
        lines += ['', f'<a id="{p["order"]}-{p["slug"]}"></a>', '', f'## {p["order"]}. {p["title"]}', '', f'{period(p)} · {p["summary"]}', '', f'- 병합 PR {s["mergedPRs"]}건 (리뷰 승인 {s["approved"]}건) · 커밋 {s["commits"]}개 · 새 이슈 {s["issuesOpened"]}건', '- PR 작성: ' + ' · '.join(f'{a} {n}' for a, n in sorted(s['prAuthors'].items(), key=lambda x: -x[1])), '', '### 병합 PR', '', '| 병합일 | PR | 내용 | 작성 | 리뷰 |', '|---|---|---|---|---|']
        for e in events:
            if e['phase'] == p['id']:
                lines.append(f"| {e['date'][5:]} | {link(e['number'])} | {title(e['title'])} | {e['author']} | {review[e['review']]} |")
        lines += ['', '### 새 이슈', '']
        subset = sorted((i for i in issues if phase_of(i['createdAt']) == p['id']), key=lambda i: (i['createdAt'], i['number']))
        if not subset:
            lines.append('이 기간에 등록된 이슈는 없다.')
        else:
            lines += ['| 등록일 | 이슈 | 내용 | 작성 |', '|---|---|---|---|']
            for i in subset:
                lines.append(f"| {date(i['createdAt'])[5:]} | {link(i['number'])} | {title(i['title'])} | {i['author']} |")
    outputs = {DATA / 'phases.json': json.dumps(phases_doc, ensure_ascii=False, indent=2) + '\n', HISTORY / 'appendix.md': '\n'.join(lines) + '\n'}
    for path, content in outputs.items():
        if args.write:
            with path.open('w', encoding='utf-8', newline='\n') as output:
                output.write(content)
        else:
            assert path.read_text(encoding='utf-8') == content, f'{path.relative_to(ROOT)} is stale; run --write'
    print(f'OK: {len(commits)} commits, {len(events)} PRs, {len(issues)} issues; phase commits: ' + ', '.join(str(commit_counts[p['id']]) for p in phases))


if __name__ == '__main__':
    main()
