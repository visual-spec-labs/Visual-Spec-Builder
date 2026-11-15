# Export 이미지 자산 정합성 QA (#274)

## 동작

검사 보고서는 코드에서 참조한 전체 `requiredAssets`와 작업공간에서 존재를 확인한
`usedAssets`를 구분한다. ZIP을 만들 때는 참조된 모든 자산을 다시 읽고, 읽기 실패가
하나라도 있으면 기본 전체 Export를 중단한다. 이로써 검사 뒤 삭제된 파일, 404 응답,
네트워크 예외를 성공한 다운로드로 오인하지 않는다.

Export 패널은 실패한 파일 이름을 보여주고 전체 ZIP 재시도를 제공한다. 사용자가 명시적으로
부분 ZIP을 선택하면 읽힌 자산만 넣고 실제 ZIP 내용 기준으로 보고서를 다시 계산한다. 누락된
자산은 README의 오류로 남으며, Export 패널은 이미지가 표시되지 않는 불완전한 결과임을
알린다.

## 회귀 검증

`test/export-generated-code.test.ts`는 다음을 검사한다.

- 검사 시 존재했던 자산의 GET이 실패하면 ZIP을 만들지 않는다.
- 검사 당시 이미 누락된 참조 자산도 전체 Export를 막는다.
- 네트워크 예외를 성공으로 처리하지 않는다.
- 재시도에서 실제 자산 바이트를 다시 읽고 전체 ZIP을 만든다.
- 부분 Export에는 읽은 자산만 들어가며 README에 누락 오류가 기록된다.

실행한 검증:

- Export/검증기 회귀 테스트: 47개 통과 (Export 테스트 6개 포함)
- `pnpm run typecheck`: 통과
- `pnpm run lint`: 통과
- `pnpm run build`: 통과
- `pnpm run generate:types` 후 생성 타입 diff 없음

전체 테스트는 `1565 passed / 17 failed / 2 skipped` (99개 파일 중 91개 통과, 6개 실패,
2개 브라우저 테스트 건너뜀)이었다. 실패는
`contract-bundle.test.ts`, `cli-skills-rollback.test.ts`, `cli-contract.test.ts`,
`cli-skills-warning.test.ts`, `ticket-response-skill.test.ts`,
`workspace-middleware.test.ts`에 분포했다. 특히 현재 Windows 실행 환경에서 symlink 생성이
`EPERM`으로 거부되고 일부 CLI 기대 경로의 구분자가 달랐다. 실패한 전체 테스트는 이 변경에서
수정하지 않았다.

실제 외부 AI 생성 결과를 검사하거나 앱 UI에서 수동 다운로드를 조작한 검증은 포함하지 않는다.
