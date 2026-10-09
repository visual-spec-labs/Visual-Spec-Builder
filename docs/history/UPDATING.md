# 연대기 갱신 절차

연대기는 자동으로 갱신하지 않는다. 갱신을 요청받을 때 아래 순서로 직접 실행한다. 명령은 모두 저장소 루트에서 실행하고, Node 20.19 이상과 이 저장소를 읽을 수 있는 `gh` 로그인(`gh auth status`)이 필요하다.

## 1. 데이터 수집

```sh
node scripts/history/sync.mjs --verify-git
```

`origin/develop`을 받아 온 뒤, 마지막 수집 시점(`data/events.json`의 `generatedAt`) 이후의 기록을 덧붙인다.

| 자료 | 수집 기준 |
|---|---|
| PR ([`events.json`](./data/events.json)) | `develop`에 병합됐고 병합 커밋이 수집 시점의 `develop`에서 도달 가능한 PR. `label`은 첫 라벨, `issues`는 PR이 닫는 이슈와 제목에 적힌 이슈, `pullRequests`는 제목에 적힌 PR |
| 이슈 ([`issues.json`](./data/issues.json)) | 수집 시점까지 새로 생성된 이슈. 제목은 수집할 때의 표기 |
| 커밋 ([`commits.json`](./data/commits.json)) | 수집 시점의 `develop`에서 도달 가능한 커밋 전체. committer 시각, 병합 커밋 포함 |

- 날짜는 KST로 나눈다. PR의 검토 여부나 병합 방식은 수집하지 않는다.
- 이미 기록된 PR·이슈는 다시 쓰지 않는다. 같은 입력으로 다시 실행해도 결과는 같다.
- 이미 기록된 커밋이 새 `develop` 이력에 없거나 달라졌으면 아무것도 쓰지 않고 멈춘다.
- 새 PR은 진행 중인 마지막 단계(`end`가 `null`)에 들어간다.
- 옵션: `--ref <ref>`로 다른 기준을 쓸 수 있고, `--no-fetch`로 받아 오기를 건너뛴다.

## 2. 본문 손보기

`node scripts/history/sync.mjs`가 고치는 것은 `data/`와 [부록](./appendix.md)뿐이다. [본문](./README.md)은 사람이 데이터를 보고 맞춘다.

- 머리말의 수집 시점과 커밋·PR·이슈 수. `pnpm test`가 데이터와 대조한다.
- "한눈에 보기" 표와 타임라인, 진행 중 단계의 기간·수치·서술.
- "이 기록에 대하여"의 수집 시점과 맨 끝의 마지막 갱신일.

서술은 다음 원칙을 따른다.

- 한국어로 쓰고, 인물은 GitHub 핸들로 부른다(실명은 인물 표에만).
- 무엇을 어떻게 만들었는지(기능·결정·원칙)를 쓴다. 사건마다 근거 PR·이슈 링크를 달고, PR 본문에서 확인하지 못한 내용은 쓰지 않는다.
- "AI로 만들었다"처럼 제작 수단을 내세우는 서술, PR 검토 여부나 병합 방식의 집계는 넣지 않는다. 제품 기능으로서의 에이전트 이야기는 괜찮다.

## 3. 새 단계 열기

단계 경계는 사람이 [`phases.json`](./data/phases.json)에서 정한다.

1. 진행 중인 단계의 `end`에 마지막 날짜(KST)를 넣는다.
2. 그다음 날을 `start`로 하는 단계를 끝에 추가한다. `id`는 `p<order>`, `order`는 이전 단계 + 1, `end`는 `null`이다. `slug`·`title`·`summary`도 채운다. `stats`는 비워 둬도 된다.
3. `node scripts/history/sync.mjs --write`로 사건의 단계와 통계, 부록을 다시 나눈다.
4. 본문에 새 단계 절을 쓰고, "한눈에 보기" 표와 타임라인에 한 줄씩 더한다.

## 4. 검사

```sh
node scripts/history/sync.mjs --check
pnpm test
```

`--check`는 네트워크 없이 데이터끼리의 정합성과 부록·단계 통계가 데이터에서 다시 만든 결과와 같은지 본다. `pnpm test`(`test/chronicle-sync.test.ts`)도 이 검사를 포함하므로 CI에서 함께 돈다.
