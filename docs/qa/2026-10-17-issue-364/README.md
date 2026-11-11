# #364 실제 모델 GUI 배치 실측 (2026-10-17)

기준 소스는 `develop`의 `b7a6642a71049d365cd3d09d434fa57f0eb00d90`이다. Windows, Node 24.12.0, pnpm 10.33.0, Playwright 1.62.0, Chromium 151.0.7922.34, DPR 1에서 실행했다. 저장소의 `real-model-journey.mjs`가 GUI 요청을 실제 CLI에 전달하고 생성 티켓을 완료한 뒤 Export ZIP을 받았다. `layout-parity.mjs --spec --generated-dir --case`가 ZIP에서 추출한 TSX와 GUI를 같은 브라우저에서 비교했다. fixture 결과가 아니다.

| 실제 실행 | CLI·모델 | 화면·viewport | GUI / 생성 root | 비교 노드 | 최대 좌표 차이 | Export ZIP SHA-256 |
| --- | --- | --- | --- | ---: | ---: | --- |
| Codex | codex-cli 0.160.0, 설정 기본 모델 `gpt-6-sol` (`--model` 생략) | 로그인, 390×844 | 390×844 / 390×844 | 12 | 0 CSS px | `cfae9e4361d6dd2729c5ff9f868f27719c4e20e57b8b6b945dffc6a8bbb3d19e` |
| Claude Code | 2.1.288, `claude-opus-5-5` (CLI 응답 확인) | 회원가입, 390×844 | 390×1262 / 390×1262 | 30 | 0 CSS px | `a10ad682226796ae0bc2c9f2caeebe337fe2dd85b1cb8afcec7a1f707d46fa7e` |

회원가입 화면은 입력 영역 8개와 하단 안내·버튼을 포함한다. 콘텐츠 높이 1262px가 스펙 화면 높이 844px를 넘으며 GUI와 생성물의 문서 scrollHeight도 1262px다. 기존 실제 출력 실측에 없던 화면이다.

두 유효 측정 모두 Pretendard CSS SHA-256 `a9d3417e168d008424337e8ee2df7b54ff082a57ed61e28421db681437cd67a2`, font load 실패 0이었다. 각 `parity.json`의 `environment.fontSha256`에 실제 사용한 CSS와 woff/woff2의 URL별 SHA-256이 기록돼 있다. Codex의 첫 측정에서 fixture용 `--font-lock`을 사용했을 때 추가 글리프용 폰트가 잠금 목록에 없어 `INVALID`가 나왔으며, `parity-font-lock-invalid.json`에 보존했다. 잠금 옵션 없이 재측정한 유효 결과가 `parity.json`이다. 첫 측정의 좌표 0px는 유효한 합격 증거로 세지 않는다.

각 모델 디렉터리에 저장 스펙(`spec.json`), 원본 Export(`export.zip`), 추출한 `pages/`·`components/` TSX, 브라우저 측정(`parity.json`), 요청 ID·CLI 버전·소요 시간·종료 코드의 실행 요약(`provenance.json`)을 보존했다. 공개 증거에서 작업 PC 경로와 원본 CLI 로그는 제외했다. 스펙 SHA-256은 Codex `59b60dc213d06d5ce4180ee612542ebfb140cdc24007f8b56524612d9a4c0a68`, Claude `53edd9270570229f0678f47f4f5b53bbf232ffbdfd426938a7a7814a924c2d66`이다. 각 Export는 누락 파일·검증 오류 0건으로 완료했다.

범위는 각 모델 한 실행과 이 두 화면이다. 결과는 다른 모델 버전, 다른 프롬프트, 다른 화면의 배치 일치를 보장하지 않는다. Codex 모델 이름은 실행 인자가 아니라 실행 당시 로컬 CLI 설정에서 확인했으므로 CLI 이벤트 자체의 모델 증명은 아니다. 불일치는 발견되지 않아 원인 이슈는 열지 않았다.

회귀 확인: `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` 통과. `pnpm test --maxWorkers=1 --silent`는 170개 파일·2752개 테스트 통과, 7개 파일·12개 테스트는 설정상 건너뜀. 보존한 두 Export의 TSX를 Vite 클라이언트 타입과 함께 별도 `tsc --noEmit`으로 검사해 통과했다. 잠금 폰트 fixture 브라우저 검사는 정상 기대 21건 전부 통과, 의도된 실패 1건 검출. 실제 모델 결과의 유효 판정은 위 두 `parity.json`이며 fixture 통과와 구분한다.
