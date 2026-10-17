# #265 수용 조건 현황

이 표는 코드 병합과 fixture 검증을 실제 AI 실행과 구분한다. #265는 모든 필수 조건이 검증되기 전까지 열어 둔다.

| 조건 | 상태 | 근거 |
|---|---|---|
| 화면 종류, 관계, 프로젝트 전체 검증과 명시 복구 | 구현·fixture 검증 | #409–#415; 재열기 복구와 수동 파일 변경 경합 회귀 |
| IR 0.4 instance, 참조·순환·override 검증 | 구현·fixture 검증 | #416–#417; `test/instance-schema-v04.test.ts`, `test/instance-validation.test.ts` |
| 공유 widget GUI, 추출·detach, Undo·저장·재열기 | 구현·fixture 검증 | #418–#419; `scripts/browser/widget-instance.mjs`, `scripts/browser/widget-extract-detach.mjs` |
| 삽입 메뉴와 캔버스 컨텍스트 위젯 동작 | 구현·fixture 검증 | #422; `test/insert-control.test.ts`, `test/node-context-menu-entries.test.ts`, `scripts/browser/widget-menu.mjs`; 원본 이동·분리 포함 |
| 공유 widget 프로젝트 티켓, v5 응답, 코드·ZIP | 구현·fixture 검증 | #420, #424; `examples/shared-widget-project.json`은 두 화면이 한 위젯을 참조한다. `test/project-widget-generation.test.ts`, `test/project-widget-runtime-build.test.ts`; ticket별 import는 같은 source와 명시된 widgetRoot 의존성만 허용한다(`test/project-module-import-scope.test.ts`, 수용·ZIP 회귀). 실제 모델 산출물 검증과 별개 |
| 자연어 현재 화면의 widget 편집과 프로젝트 검증 | 구현·fixture 검증 | #421; 읽기 전용 widget 원본 문맥, 활성 화면 Command와 프로젝트 G3: `test/nl-destinations.test.ts`, `scripts/browser/nl-widgets.mjs` |
| S2-8 한 요청에서 위젯 추출 후 다른 화면에 배치 | 구현·fixture 검증 | #423; 선택 frame과 대상 page를 명시하는 단일 `projectCommand`; `test/nl-protocol.test.ts`, `test/widget-project-command.test.ts`, `scripts/browser/nl-widgets.mjs`의 두 번째 요청에서 원자 적용·Undo 확인. 실제 모델 응답은 미검증. |
| 실제 AI 생성·수용·ZIP·독립 앱·브라우저 | 검증 완료 (2026-10-17, PC) | 아래 실제 모델 실행 기록. `examples/shared-widget-project.json`에서 프로젝트 v5 티켓 14개를 Codex CLI가 생성했고 GUI가 네 웨이브 모두 수용했다. 프로젝트 ZIP을 독립 앱에서 타입 검사·빌드하고 PC Chromium에서 이동·모달·공유 위젯을 확인했다. 별도 fixture에서 GUI로 여섯 관계를 설정한 뒤 Save→브라우저 세션 종료→재열기도 통과했다. |

테스트 개수·CI·해당 PR 링크는 각 PR 설명의 실행 기록을 따른다. 실제 모델 실행의 요청 ID, ZIP 해시와 브라우저 결과는 [docs/15](15-workflow-qa.md#2026-10-17-265-pc-실제-모델-수용)에 기록한다. 이전 환경의 실패 기록은 당시의 사실로 유지한다.
