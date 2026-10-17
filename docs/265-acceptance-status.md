# #265 수용 조건 현황

이 표는 코드 병합과 fixture 검증을 실제 AI 실행과 구분한다. #265는 모든 필수 조건이 검증되기 전까지 열어 둔다.

| 조건 | 상태 | 근거 |
|---|---|---|
| 화면 종류, 관계, 프로젝트 전체 검증과 명시 복구 | 구현·fixture 검증 | #409–#415; 재열기 복구와 수동 파일 변경 경합 회귀 |
| IR 0.4 instance, 참조·순환·override 검증 | 구현·fixture 검증 | #416–#417; `test/instance-schema-v04.test.ts`, `test/instance-validation.test.ts` |
| 공유 widget GUI, 추출·detach, Undo·저장·재열기 | 구현·fixture 검증 | #418–#419; `scripts/browser/widget-instance.mjs`, `scripts/browser/widget-extract-detach.mjs` |
| 공유 widget 프로젝트 티켓, v5 응답, 코드·ZIP | 구현·fixture 검증 | `test/project-widget-generation.test.ts`, `test/project-widget-runtime-build.test.ts`; 실제 모델 산출물 검증과 별개 |
| 자연어 Command의 widget 편집과 전체 프로젝트 수용 | 진행 중 | GUI G3는 프로젝트 전체를 검증한다. widget 요청·스킬의 범위별 회귀 확인 필요 |
| 실제 AI 생성·수용·ZIP·독립 앱·브라우저 | 미검증 | 이전 환경의 최소 MODEL_READY 호출이 HTTP CONNECT 403으로 거부됨. fixture 및 합성 코드는 실제 모델 결과가 아님 |

테스트 개수·CI·해당 PR 링크는 각 PR 설명의 실행 기록을 따른다. 환경의 모델 연결이 허용될 때 실제 AI 항목을 별도로 실행하고 성공 근거를 기록한다.
