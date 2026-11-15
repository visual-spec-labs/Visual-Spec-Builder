# 문서 안내와 마무리 점검 목록

기준: 2026-11-05 · develop `49e7f61` (#490). 현재 기능, 과거 의사결정, 실행 증거를 구분한다.
처음 사용하면 [14](14-getting-started.md), 구현 범위·검증 한계는 [07](07-implementation-status.md),
스키마는 [05](05-schema.md), 프로젝트 실행은 [GUI 계약](PROJECT_GENERATION_GUI.md)부터 읽는다.

## 읽는 기준

- 현재 안내는 기준 코드와 맞춘다. 사용자의 개발 완료를 공개 릴리스·전체 검증으로 바꾸지 않는다.
- 계약의 현재 요약을 먼저 읽는다. 제목에 예정/제안이 남은 날짜별 절은 도입 경위이며 이전 버전 소비자와의 경계를 설명한다.
- QA는 그 문서의 날짜·커밋·환경·fixture/실제 모델 구분에 한정한 증거다. 과거 실패나 미검증은 당시 기록으로 보존하며 최신 성공을 소급해서 쓰지 않는다.
- 연대기 기존 원장의 수집 범위와 새 보충 기록은 구분한다. 역사적 PR·설계·fixture의 버전을 일괄 치환하지 않는다.
- 배포 스킬은 `skills/`가 원본이다. 사람용 설명은 `docs/skills/`, 설치 사본은 `visual-spec skills`로 갱신한다.

## 점검 범위

Git 추적 Markdown 전체를 목록화하고 버전·지원 범위·설치·출력·검증 주장을 정본과 대조했다.
아래 목록의 “보존”은 내용을 최신 테스트 결과로 다시 판정했다는 뜻이 아니다.
JSON 원장·스키마·예제, QA 이미지·ZIP·TSX와 프로그램 코드는 근거로 읽고 변경하지 않았다.

## 현재 안내

| 문서 | 처리 |
|---|---|
| [AGENTS.md](../AGENTS.md) | 보존·분류 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 현재 설명 보정 |
| [README.md](../README.md) | 현재 설명 보정 |
| [docs/01-overview.md](01-overview.md) | 현재 설명 보정 |
| [docs/02-mvp-scope.md](02-mvp-scope.md) | 현재 설명 보정 |
| [docs/03-user-flow.md](03-user-flow.md) | 현재 설명 보정 |
| [docs/04-gui-spec.md](04-gui-spec.md) | 현재 설명 보정 |
| [docs/05-schema.md](05-schema.md) | 현재 설명 보정 |
| [docs/07-implementation-status.md](07-implementation-status.md) | 현재 설명 보정 |
| [docs/10-shortcuts.md](10-shortcuts.md) | 보존·분류 |
| [docs/14-getting-started.md](14-getting-started.md) | 현재 설명 보정 |
| [docs/README.md](README.md) | 추가 |
| [docs/open-questions.md](open-questions.md) | 현재 설명 보정 |

## 현재 계약 + 도입 이력

| 문서 | 처리 |
|---|---|
| [docs/06-schema-freeze.md](06-schema-freeze.md) | 현재 설명 보정 |
| [docs/09-command-schema-freeze.md](09-command-schema-freeze.md) | 현재 설명 보정 |
| [docs/11-ticket-schema-freeze.md](11-ticket-schema-freeze.md) | 현재 설명 보정 |
| [docs/25-layout-parity-contract.md](25-layout-parity-contract.md) | 현재 설명 보정 |
| [docs/26-agent-request-generation-contract.md](26-agent-request-generation-contract.md) | 현재 설명 보정 |
| [docs/DESIGN-TOKEN-RULES.md](DESIGN-TOKEN-RULES.md) | 보존·분류 |
| [docs/EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) | 현재 설명 보정 |
| [docs/PROJECT_GENERATION_GUI.md](PROJECT_GENERATION_GUI.md) | 현재 설명 보정 |
| [docs/PROJECT_OUTPUT_ACCEPTANCE.md](PROJECT_OUTPUT_ACCEPTANCE.md) | 현재 설명 보정 |
| [docs/S2_WIDGET_CONTRACT.md](S2_WIDGET_CONTRACT.md) | 보존·분류 |

## 설계·결정 기록

| 문서 | 처리 |
|---|---|
| [.claude/skills/pr/SKILL.md](../.claude/skills/pr/SKILL.md) | 보존·분류 |
| [docs/08-natural-language.md](08-natural-language.md) | 현재 설명 보정 |
| [docs/12-responsive-ir-design.md](12-responsive-ir-design.md) | 현재 설명 보정 |
| [docs/13-background-fill-design.md](13-background-fill-design.md) | 보존·분류 |
| [docs/20-manual-agent-handoff-ui.md](20-manual-agent-handoff-ui.md) | 보존·분류 |
| [docs/21-app-scope-a11y-design.md](21-app-scope-a11y-design.md) | 현재 설명 보정 |
| [docs/21-home-screen-nl-draft.md](21-home-screen-nl-draft.md) | 보존·분류 |
| [docs/22-panel-collapse-resize.md](22-panel-collapse-resize.md) | 보존·분류 |
| [docs/23-project-dialogs-corrupt-files.md](23-project-dialogs-corrupt-files.md) | 보존·분류 |
| [docs/24-screen-relations-design.md](24-screen-relations-design.md) | 현재 설명 보정 |
| [docs/27-user-design-system-scope.md](27-user-design-system-scope.md) | 현재 설명 보정 |
| [docs/references.md](references.md) | 보존·분류 |
| [docs/superpowers/specs/2026-07-30-visual-spec-schema-v0.1-design.md](superpowers/specs/2026-07-30-visual-spec-schema-v0.1-design.md) | 보존·분류 |
| [docs/superpowers/specs/2026-08-11-visual-spec-to-react-codegen-design.md](superpowers/specs/2026-08-11-visual-spec-to-react-codegen-design.md) | 보존·분류 |
| [docs/superpowers/specs/2026-08-15-docs-restructure-and-home-screen-design.md](superpowers/specs/2026-08-15-docs-restructure-and-home-screen-design.md) | 보존·분류 |
| [docs/superpowers/specs/2026-10-11-generation-project-identity.md](superpowers/specs/2026-10-11-generation-project-identity.md) | 보존·분류 |
| [docs/superpowers/specs/2026-10-15-screen-relations-open-contracts.md](superpowers/specs/2026-10-15-screen-relations-open-contracts.md) | 보존·분류 |

## QA·실험 기록

| 문서 | 처리 |
|---|---|
| [docs/15-workflow-qa.md](15-workflow-qa.md) | 보존·분류 |
| [docs/16-responsive-codegen-qa.md](16-responsive-codegen-qa.md) | 보존·분류 |
| [docs/17-codegen-layout-qa.md](17-codegen-layout-qa.md) | 보존·분류 |
| [docs/18-export-asset-bundler-qa.md](18-export-asset-bundler-qa.md) | 보존·분류 |
| [docs/18-toolbar-inert-qa.md](18-toolbar-inert-qa.md) | 보존·분류 |
| [docs/19-active-guidance-contrast-qa.md](19-active-guidance-contrast-qa.md) | 보존·분류 |
| [docs/19-grid-codegen-qa.md](19-grid-codegen-qa.md) | 보존·분류 |
| [docs/20-screen-layout-contract-qa.md](20-screen-layout-contract-qa.md) | 보존·분류 |
| [docs/22-performance-baseline.md](22-performance-baseline.md) | 보존·분류 |
| [docs/265-acceptance-status.md](265-acceptance-status.md) | 현재 설명 보정 |
| [docs/28-real-flow-regression.md](28-real-flow-regression.md) | 보존·분류 |
| [docs/qa/2026-10-10-integration-359.md](qa/2026-10-10-integration-359.md) | 보존·분류 |
| [docs/qa/2026-10-10-real-model-output/landing/README.md](qa/2026-10-10-real-model-output/landing/README.md) | 보존·분류 |
| [docs/qa/2026-10-10-real-model-output/login/README.md](qa/2026-10-10-real-model-output/login/README.md) | 보존·분류 |
| [docs/qa/2026-10-17-issue-364/README.md](qa/2026-10-17-issue-364/README.md) | 보존·분류 |
| [docs/qa/2026-10-19-issue-443.md](qa/2026-10-19-issue-443.md) | 보존·분류 |
| [docs/qa/disk-watch-review-309.md](qa/disk-watch-review-309.md) | 보존·분류 |
| [docs/qa/editing-context.md](qa/editing-context.md) | 보존·분류 |
| [docs/qa/export-asset-integrity.md](qa/export-asset-integrity.md) | 보존·분류 |
| [docs/qa/package-tarball-runtime.md](qa/package-tarball-runtime.md) | 보존·분류 |
| [docs/qa/project-file-rename-qa.md](qa/project-file-rename-qa.md) | 보존·분류 |
| [docs/qa/property-guidance.md](qa/property-guidance.md) | 보존·분류 |
| [docs/qa/save-status.md](qa/save-status.md) | 보존·분류 |
| [docs/qa/tab-save-conflicts.md](qa/tab-save-conflicts.md) | 보존·분류 |
| [docs/qa/unnamed-draft-recovery.md](qa/unnamed-draft-recovery.md) | 보존·분류 |
| [docs/qa/user-journey-regression.md](qa/user-journey-regression.md) | 보존·분류 |

## 연대기·이전 현황

| 문서 | 처리 |
|---|---|
| [docs/history/README.md](history/README.md) | 현재 설명 보정 |
| [docs/history/UPDATING.md](history/UPDATING.md) | 현재 설명 보정 |
| [docs/history/appendix.md](history/appendix.md) | 보존·분류 |
| [docs/history/completion.md](history/completion.md) | 추가 |

## 배포 스킬·사람용 설명

| 문서 | 처리 |
|---|---|
| [docs/skills/visual-spec-authoring.md](skills/visual-spec-authoring.md) | 현재 설명 보정 |
| [docs/skills/visual-spec-docs.md](skills/visual-spec-docs.md) | 보존·분류 |
| [docs/skills/visual-spec-nl-response.md](skills/visual-spec-nl-response.md) | 현재 설명 보정 |
| [docs/skills/visual-spec-ticket-response.md](skills/visual-spec-ticket-response.md) | 현재 설명 보정 |
| [docs/skills/visual-spec-to-react.md](skills/visual-spec-to-react.md) | 현재 설명 보정 |
| [docs/skills/visual-spec-validate.md](skills/visual-spec-validate.md) | 현재 설명 보정 |
| [docs/skills/visual-spec.md](skills/visual-spec.md) | 현재 설명 보정 |
| [skills/visual-spec-authoring/SKILL.md](../skills/visual-spec-authoring/SKILL.md) | 현재 설명 보정 |
| [skills/visual-spec-docs/SKILL.md](../skills/visual-spec-docs/SKILL.md) | 보존·분류 |
| [skills/visual-spec-nl-response/SKILL.md](../skills/visual-spec-nl-response/SKILL.md) | 현재 설명 보정 |
| [skills/visual-spec-ticket-response/PROJECT_V4.md](../skills/visual-spec-ticket-response/PROJECT_V4.md) | 보존·분류 |
| [skills/visual-spec-ticket-response/PROJECT_V5.md](../skills/visual-spec-ticket-response/PROJECT_V5.md) | 보존·분류 |
| [skills/visual-spec-ticket-response/SKILL.md](../skills/visual-spec-ticket-response/SKILL.md) | 보존·분류 |
| [skills/visual-spec-to-react/SKILL.md](../skills/visual-spec-to-react/SKILL.md) | 보존·분류 |
| [skills/visual-spec-validate/SKILL.md](../skills/visual-spec-validate/SKILL.md) | 현재 설명 보정 |
| [skills/visual-spec/SKILL.md](../skills/visual-spec/SKILL.md) | 보존·분류 |

## 저장소 템플릿·호환 fixture

| 문서 | 처리 |
|---|---|
| [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) | 보존·분류 |
| [test/fixtures/command-v01/README.md](../test/fixtures/command-v01/README.md) | 보존·분류 |
| [test/fixtures/installed-skill-v2/visual-spec-ticket-response.SKILL.md](../test/fixtures/installed-skill-v2/visual-spec-ticket-response.SKILL.md) | 보존·분류 |

## 정본 대조와 검증

IR/Command/Ticket 스키마, NL·agent-edit·ticket 전송 상수, 프로젝트 compiler/runner/수락·Export,
상태 렌더·스타일 편집, CI workflow와 기존 QA를 대조했다. 현재 버전 표는 [07](07-implementation-status.md)에 모았다.
문서·스킬 변경의 로컬 검사와 새 PR 커밋의 CI 결과는 해당 PR에 기록한다.
전체 테스트의 선택적 브라우저 생략은 브라우저 성공으로 계산하지 않으며, 이번 정리에서 실제 모델을 새로 실행하지 않는다.
