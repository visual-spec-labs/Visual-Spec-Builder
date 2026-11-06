# 프로젝트 마무리 기록 (2026-10-10 이후)

기준: develop `49e7f617d8593d89c16df77748e7e7850c575605`, 2026-11-05 문서 점검.
[기존 연대기](README.md)의 통계와 원장 `data/`는 10월 10일 수집 스냅샷으로 보존한다.
이 문서는 그 뒤의 기능·검증 변화를 연결하는 보충 기록이며 전체 PR·이슈 통계를 재수집한 결과가 아니다.
Git의 develop 도달 가능 커밋, 해당 변경과 저장소 QA를 근거로 작성했다. 사용자의 개발 마무리 의사는 공개 릴리스나 모든 이슈 종료와 구분한다.

## 화면 하나에서 관계와 공유 위젯으로

화면 종류와 button action 계약 뒤에 종류/Interaction UI, 프로젝트 전체 참조 검증,
모달 미리보기, 프로젝트 Ticket 0.2와 v4 요청·수용·Export가 연결됐다.
공유 widget을 가리키는 instance가 IR 0.4에 들어왔고, 위젯 배치·추출·분리·재정의와 v5 생성,
NL 읽기 문맥 및 명시적 추출/다른 페이지 배치가 뒤따랐다.
근거: [#382](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/382),
[#410](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/410),
[#416](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/416),
[#420](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/420),
[#423](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/423).
현재 계약은 [프로젝트 GUI](../PROJECT_GENERATION_GUI.md)·[S2](../S2_WIDGET_CONTRACT.md)에 있다.

## 스타일과 실제 모델 근거

프로젝트 색·글자 스타일, 리터럴 사본과 연결, button/input 상태 스타일, 프로젝트 원자 편집이
[#397](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/397)에 반영됐다.
추가 폰트·CSS 변수 출력은 보류로 남았다([27](../27-user-design-system-scope.md)).

실제 모델 검증은 fixture와 따로 남겼다. 10월 17일 Windows PC의 Codex v5 공유 위젯 프로젝트
14티켓·4웨이브 수용과 ZIP 독립 앱 검증은 [15](../15-workflow-qa.md),
Codex 로그인/Claude Code 회원가입의 두 화면 배치 실측은 [#364 기록](../qa/2026-10-17-issue-364/README.md)에 있다.
각 모델 한 실행과 지정 화면의 증거이며, 임의 출력의 정확성을 보장하지 않는다.
10월 19일 자연어 모호한 요청의 실제 모델 사례는 [#443](../qa/2026-10-19-issue-443.md)에 보존했다.

## 마지막 사용성·안정성 정리

이미지 교체·경로 입력, 이름/파일 정책, 다중 탭 충돌, 자연어 취소와 Undo, 페이지 순서,
반응형 편집과 홈 미리보기, 낮은 창의 넘침 안내를 정리했다. 이후 티켓 패널 재열기,
위젯 추출의 Fill/Hug 보존, 첫 출력 전 진행 신호를 통한 제한된 대기 연장,
Export 페이지 전환 시 스크롤·글자 굵기 선택과 사용 가이드·strict 생성 지침을 보완했다.
마지막 변경 근거는 [#485](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/485),
[#486](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/486),
[#487](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/487),
[#489](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/489),
[#490](https://github.com/visual-spec-labs/Visual-Spec-Builder/pull/490)이다.

기준 develop의 CI 7개 job은 성공했다. #472의 **실제 모델 180초 초과 후 자동 수용**과
#490의 **PowerShell 안내에 따른 Windows 외부 CLI 실행**은 확인되지 않았다.
과거 Windows 실제 모델 성공과 현재의 Windows CI를 이 두 검증의 대체 근거로 사용하지 않는다.
현재 한계와 실행 근거는 [07](../07-implementation-status.md)에 모았다.

## develop의 최근 통합 커밋 목록

다음 목록은 기존 원장의 cutoff 이후부터 기준 develop까지 first-parent 이력이다.
날짜는 committer 시각을 KST로 변환했다. PR 통계의 mergedAt 집계와 다른 자료다.

| 날짜(KST) | 커밋 | 제목 |
|---|---|---|
| 2026-10-10 | [130f6b5](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/130f6b565402b8245cc2b7606e8450fba83cf020) | Merge pull request #347 from visual-spec-labs/Yumesa2025/history-auto-sync |
| 2026-10-10 | [258e0be](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/258e0beff7169194a70257facaf250060e8085b1) | Merge pull request #356 from visual-spec-labs/codex/292-corrupt-open-gate |
| 2026-10-10 | [a10c800](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/a10c8003eedf3fcdb31977fa351adf2187f5c120) | Merge pull request #350 from visual-spec-labs/Yumesa2025/280-layout-contract |
| 2026-10-10 | [0733ae1](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/0733ae1e65f837f47cdba5b18310750ed70c7662) | Merge pull request #349 from visual-spec-labs/Yumesa2025/284-agent-request-generation |
| 2026-10-10 | [cb4ac4d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/cb4ac4dadc3e110fff7da5537cc1743b5e6cfaae) | Merge pull request #354 from visual-spec-labs/Yumesa2025/290-user-design-system |
| 2026-10-10 | [2b0099c](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/2b0099c90ac82bacb5738d18239a9ddab913ebb5) | Merge pull request #353 from visual-spec-labs/Yumesa2025/282-manual-change-guard |
| 2026-10-10 | [537b591](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/537b591b858db807b5ae658375ca706bd58e0ae5) | Merge pull request #339 from visual-spec-labs/Yumesa2025/265-s0-screen-relations-design |
| 2026-10-10 | [429be08](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/429be08331045a3caa5dead757b1d93778c7bd65) | Merge pull request #357 from visual-spec-labs/Yumesa2025/281-generation-ownership |
| 2026-10-10 | [d33f9f9](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/d33f9f9d0356274038b7846130669e5b5cd6bcd3) | Merge pull request #361 from visual-spec-labs/Yumesa2025/265-s0-2-mvp-scope |
| 2026-10-10 | [7418f55](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/7418f5507a179a02c8aae69f37b0010fb169b151) | Merge pull request #355 from visual-spec-labs/Yumesa2025/265-s1-kind-action-schema |
| 2026-10-10 | [a15461b](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/a15461b64c06858e6b2dc1c9dacdb3f33c220ae7) | Merge pull request #358 from visual-spec-labs/Yumesa2025/292-real-flow-regression |
| 2026-10-10 | [8af95bb](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/8af95bb77adf23c3cdf25d602c0d960b2dc60c38) | Merge pull request #362 from visual-spec-labs/Yumesa2025/351-unnamed-drafts-order |
| 2026-10-10 | [0de2649](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/0de2649045df6010c76b1d6937229b871e8179f7) | Merge pull request #363 from visual-spec-labs/Yumesa2025/348-menu-korean-labels |
| 2026-10-11 | [44d9705](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/44d9705aef80c7b992b22ad716436e978587e032) | Merge pull request #366 from visual-spec-labs/Yumesa2025/265-s1-2-reference-integrity |
| 2026-10-11 | [e06bb5c](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e06bb5c08316e5a08ecf1bf06b6801ccbf8df517) | Merge pull request #368 from visual-spec-labs/Yumesa2025/359-integration-verify |
| 2026-10-12 | [e65bf7b](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e65bf7b0fa0182c180bc5126e86924231d5756e7) | Merge pull request #371 from visual-spec-labs/codex/367-project-recreated-identity |
| 2026-10-12 | [67cf772](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/67cf772c7adc09850d685340d835d8fbab5e1b3c) | Merge pull request #372 from visual-spec-labs/codex/359-final-integration |
| 2026-10-13 | [ac5746e](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/ac5746e16e24e695f5793ef9cf63cc4ec9816cf7) | Merge pull request #373 from visual-spec-labs/dogui1018/home-empty-overflow-369 |
| 2026-10-13 | [694f2d6](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/694f2d6a3208804a252f0fa4fbe73a2bb6e7bede) | Merge pull request #374 from visual-spec-labs/codex/359-closure-record |
| 2026-10-13 | [b769a9c](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/b769a9c7650f52434ba21dc2a866d544f8152fd0) | Merge pull request #375 from visual-spec-labs/Yumesa2025/370-toolbar-export-korean |
| 2026-10-13 | [2924ba0](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/2924ba04550b781b766eddd24c3ceb0f911c6e70) | Merge pull request #376 from visual-spec-labs/Yumesa2025/352-editor-defaults-docs |
| 2026-10-13 | [80b93df](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/80b93df94c449e4ce6035ce4fe83c2c7afd9d492) | Merge pull request #378 from visual-spec-labs/Yumesa2025/265-d10-d11-decisions |
| 2026-10-13 | [87b1be7](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/87b1be73f1f981d9629b8de91b418e8bf4c1be81) | Merge pull request #379 from visual-spec-labs/Yumesa2025/365-layout-parity-ci |
| 2026-10-13 | [9300f13](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/9300f131b435348346a37a6b03470c5da525ac23) | Merge pull request #380 from visual-spec-labs/Yumesa2025/360-design-system-decisions |
| 2026-10-13 | [126bad5](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/126bad5ed660ac33ded034bad7ce5590846b674d) | Merge pull request #377 from visual-spec-labs/Yumesa2025/352-esc-returns-select |
| 2026-10-15 | [0ac1756](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/0ac17561db868ee740c15d891f5e7d453b803a99) | Merge pull request #381 from visual-spec-labs/Yumesa2025/265-command-v02-contract |
| 2026-10-15 | [99f9394](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/99f9394c38769b4bb35103e95cf52108bddaa61c) | Merge pull request #382 from visual-spec-labs/Yumesa2025/265-command-v02 |
| 2026-10-15 | [ae0bacd](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/ae0bacded9eb726fc9bb9d1694761978104e618a) | Merge pull request #383 from visual-spec-labs/Yumesa2025/265-project-integrity |
| 2026-10-15 | [b8a01c2](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/b8a01c206d1e031f79debf2332c5f777dcd4e8c7) | Merge pull request #384 from visual-spec-labs/Yumesa2025/265-screen-kind-ui |
| 2026-10-16 | [486ec6a](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/486ec6aa98223570157be7056fb9f3ddc632f973) | Merge pull request #386 from visual-spec-labs/Yumesa2025/package-smoke-diagnostics |
| 2026-10-16 | [3252083](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/3252083d4c23c4fa328258fd22861689cf00628f) | Merge pull request #389 from visual-spec-labs/Yumesa2025/265-rejected-edit-feedback |
| 2026-10-16 | [3cd73d1](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/3cd73d17849d1a3a647db5c8646a869d2ffc9e67) | Merge pull request #385 from visual-spec-labs/Yumesa2025/265-interaction-ui |
| 2026-10-16 | [3aed749](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/3aed7492c507629cb45c491668cc76f55227fa34) | Merge pull request #387 from visual-spec-labs/Yumesa2025/265-nl-destinations |
| 2026-10-16 | [83558fd](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/83558fdb1cb182a3fc2edd7d6f25cb33a53ceeb5) | Merge pull request #388 from visual-spec-labs/Yumesa2025/265-remaining-contract-proposal |
| 2026-10-16 | [c707913](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/c7079135876945b34044259a04f9c110c9f69ff0) | Merge pull request #390 from visual-spec-labs/Yumesa2025/265-project-ticket-contract |
| 2026-10-16 | [ba0c5c2](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/ba0c5c2ec8f93b39653a672f38d70c9f4fc9c584) | Merge pull request #391 from visual-spec-labs/Yumesa2025/265-project-ticket-schema |
| 2026-10-16 | [7bdd939](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/7bdd939fe5c3ff3ae274fd9739d42528751dc849) | Merge pull request #392 from visual-spec-labs/Yumesa2025/265-project-ticket-compiler |
| 2026-10-16 | [61fd519](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/61fd5199ea4f8119e7ffaee1e85aabb01e76d0db) | Merge pull request #393 from visual-spec-labs/Yumesa2025/265-canvas-relations |
| 2026-10-16 | [200914f](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/200914f575ba08db39760cb571ad1d2f22eee2f2) | Merge pull request #394 from visual-spec-labs/Yumesa2025/265-project-runtime-cas |
| 2026-10-16 | [e24a2c1](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e24a2c1af05161ec65547a6a796fb6da5d9d73d8) | Merge pull request #395 from visual-spec-labs/Yumesa2025/265-project-input-snapshot |
| 2026-10-16 | [b05adec](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/b05adece4f3f4fc2683adb761e49043ade4a0ca5) | Merge pull request #396 from visual-spec-labs/Yumesa2025/265-modal-focus-scroll |
| 2026-10-16 | [5d85099](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/5d8509912306883ae34c6e4edf0a9dc048d41d37) | Merge pull request #398 from visual-spec-labs/Yumesa2025/265-project-ticket-protocol |
| 2026-10-16 | [119c96f](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/119c96f111cb3c60f6d960aeaa647fe801baa0d2) | Merge pull request #400 from visual-spec-labs/Yumesa2025/265-project-input-storage |
| 2026-10-17 | [ff26fa5](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/ff26fa582a09cc25d660a1eb6ffbbb0ce1e2024e) | Merge pull request #399 from visual-spec-labs/Yumesa2025/265-project-provenance |
| 2026-10-17 | [f6bb571](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/f6bb571a2f2d69cc6eb04db8c79664a858552326) | Merge pull request #402 from visual-spec-labs/Yumesa2025/265-project-runtime-templates |
| 2026-10-17 | [9e18088](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/9e180885de3c4332d848151934593db152a81906) | Merge pull request #401 from visual-spec-labs/Yumesa2025/265-project-asset-modules |
| 2026-10-17 | [39e4e23](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/39e4e2394e2f423e97c99985e2b1bbcc5bf4afd2) | Merge pull request #404 from visual-spec-labs/Yumesa2025/265-project-dispatch |
| 2026-10-17 | [270d391](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/270d3915130f0a3522ea746d16b5f4d0dbe3c6f0) | Merge pull request #403 from visual-spec-labs/Yumesa2025/265-runtime-review |
| 2026-10-17 | [bd13957](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/bd1395797d5669cb0502da42dd38ab243079f5cc) | Merge pull request #405 from visual-spec-labs/Yumesa2025/265-project-sidecar-delete |
| 2026-10-17 | [1ee3c2f](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/1ee3c2ff781930e6b99422d72ea7b1081d6196a3) | Merge pull request #406 from visual-spec-labs/Yumesa2025/265-project-response-retry |
| 2026-10-17 | [d396d4c](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/d396d4c5f314f3490497997dcfc93bea4e22b41d) | Merge pull request #408 from visual-spec-labs/Yumesa2025/265-project-agent-skill |
| 2026-10-17 | [c12a639](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/c12a63907dfc40e0f9de3237a9ec81f95ca934a8) | Merge pull request #407 from visual-spec-labs/Yumesa2025/265-project-acceptance |
| 2026-10-17 | [840712d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/840712dce8b48c8fce9865c7c899135a7c181aa6) | Merge pull request #409 from visual-spec-labs/Yumesa2025/265-project-skill-review |
| 2026-10-17 | [e63d35d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e63d35d726eef266889234724bb2b86d709952e9) | Merge pull request #411 from visual-spec-labs/Yumesa2025/265-retained-output-integrity |
| 2026-10-17 | [3cc7b89](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/3cc7b8969c0a3615520d23e7fcaeb7fce3c2ed4d) | Merge pull request #410 from visual-spec-labs/Yumesa2025/265-project-gui |
| 2026-10-17 | [e5f641b](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e5f641b0f41b31f460cdef3838d1a31e33d35e45) | Merge pull request #412 from visual-spec-labs/Yumesa2025/265-recovery-continuation |
| 2026-10-17 | [45ecfde](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/45ecfde906cc5fccc735207f0b5cc7336e054999) | Merge pull request #413 from visual-spec-labs/Yumesa2025/265-widget-contract |
| 2026-10-17 | [175e259](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/175e259dd7836efe119fc64574c803f07f57f486) | Merge pull request #414 from visual-spec-labs/Yumesa2025/265-recovery-discovery |
| 2026-10-17 | [92109dc](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/92109dc6891e61a19e79eed8ae69edd3597bbbc6) | Merge pull request #415 from visual-spec-labs/Yumesa2025/265-recovery-bookkeeping |
| 2026-10-17 | [8df8102](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/8df81025441b6466e18541d14be38dafd0c86693) | Merge pull request #416 from visual-spec-labs/Yumesa2025/265-s2-schema |
| 2026-10-17 | [d461df9](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/d461df903fc724c104f7ae3ca97249d1bd94c4ed) | Merge pull request #417 from visual-spec-labs/Yumesa2025/265-s2-validation |
| 2026-10-17 | [cc6e145](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/cc6e145d76fcfeae6b4be40d287065f7415acd19) | Merge pull request #418 from visual-spec-labs/Yumesa2025/265-s2-widget-ui |
| 2026-10-17 | [cd7453d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/cd7453da561efa1f11ba3b834b67c16e2dc42907) | Merge pull request #419 from visual-spec-labs/Yumesa2025/265-s2-extract-detach |
| 2026-10-17 | [46f849b](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/46f849b02b937fe359af9a9e8ea854cf78028c2b) | Merge pull request #420 from visual-spec-labs/Yumesa2025/265-s2-generation |
| 2026-10-17 | [3e9000f](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/3e9000f1eaa3a12602859771e83aa112ac5f12c7) | Merge pull request #421 from visual-spec-labs/Yumesa2025/265-s2-nl |
| 2026-10-17 | [f866c5c](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/f866c5c633ac0ab5c7564837a936dbb00b69a2ae) | Merge pull request #422 from visual-spec-labs/Yumesa2025/265-s2-menu |
| 2026-10-17 | [61ad736](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/61ad73696332ef485e32026d0edd2753307fbd37) | Merge pull request #424 from visual-spec-labs/Yumesa2025/265-ticket-import-scope |
| 2026-10-17 | [e953df0](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e953df04a8b7325435bccfb4a07a9ccc7efca6e1) | Merge pull request #423 from visual-spec-labs/Yumesa2025/265-s2-nl-project |
| 2026-10-17 | [8b88405](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/8b8840548be8d24c14777e8680da8f578bbab862) | Merge pull request #425 from visual-spec-labs/docs/265-pc-real-model-acceptance |
| 2026-10-17 | [b7a6642](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/b7a6642a71049d365cd3d09d434fa57f0eb00d90) | Merge pull request #397 from visual-spec-labs/codex/290-atomic-project-edit |
| 2026-10-18 | [0e31d81](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/0e31d81d2b10dd14c61f05430ad20234ac32b2a1) | test: 실제 모델 GUI 배치 실측 증거를 보존한다 (#364) (#426) |
| 2026-10-18 | [8b51528](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/8b51528d1b1c04cef3acf36befb1128b93f61f88) | Merge pull request #430 from visual-spec-labs/codex/427-429-editor-status-qa |
| 2026-10-19 | [74ade67](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/74ade671d2d12227d8b11232a1234ff94c9e2fc8) | Merge pull request #450 from visual-spec-labs/fix/442-agent-notice-overlap |
| 2026-10-20 | [e846e68](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/e846e6896183a1adb328c9f5f96f071f47f046e9) | Merge pull request #449 from visual-spec-labs/codex/435-project-name-file-name-policy |
| 2026-10-20 | [40a3bd1](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/40a3bd1841fc4e5b4836da44d1ca450d9090fb13) | Merge pull request #453 from visual-spec-labs/codex/434-home-new-tab-conflict |
| 2026-10-20 | [5620066](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/56200669f06a711b74245fac3f21bd4b226018a5) | Merge pull request #452 from visual-spec-labs/feat/441-background-confirm-diff |
| 2026-10-21 | [a7197fc](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/a7197fcad01b2977975ca4488a1c9db5182b60b6) | Merge pull request #451 from visual-spec-labs/dogui1018/agent-wait-auto-extend-432 |
| 2026-10-21 | [5452b86](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/5452b869b5895659c898d4993912319544a4fbed) | Merge pull request #455 from visual-spec-labs/feat/440-nl-scope-hint |
| 2026-10-22 | [7b44a8b](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/7b44a8babc800f15f2e93907e2462be4a784b7dd) | Merge pull request #456 from visual-spec-labs/dogui1018/project-style-type-assertion-433 |
| 2026-10-22 | [611b554](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/611b554997dc516cffb4d8b731a0a79fb2e9a398) | Merge pull request #454 from visual-spec-labs/feature/437--replace-image-node |
| 2026-10-22 | [bb91a7d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/bb91a7da80b50882452c648dc8177f261b4a488d) | Merge pull request #457 from visual-spec-labs/docs/443-nl-ambiguous-request |
| 2026-10-22 | [1761d3d](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/1761d3dd457929a6e349c26867ecdbc19a838338) | Merge pull request #458 from visual-spec-labs/dogui1018/example-lineheight-px-445 |
| 2026-10-22 | [7790783](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/7790783aa437b0ab03cd5b248d9177546c2b39de) | Merge pull request #460 from visual-spec-labs/dogui1018/responsive-breakpoint-desktop-impact-438 |
| 2026-10-22 | [49373f9](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/49373f9e553768dc172c9e1fb7be9742605c16e8) | Merge pull request #462 from visual-spec-labs/dogui1018/home-thumbnail-responsive-439 |
| 2026-10-22 | [5609967](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/5609967382e1a47b8c32c27d062d2f3cb4a8f1b9) | Merge pull request #461 from visual-spec-labs/fix/448-nl-cancel-undo |
| 2026-10-23 | [b54c56e](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/b54c56eed66a3e949a2f61c7884862546613be14) | Merge pull request #459 from visual-spec-labs/feature/444--page-order |
| 2026-10-23 | [ede40bd](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/ede40bd8882f33fafa9e343583c5ac7f7db09f10) | Merge pull request #463 from visual-spec-labs/dogui1018/responsive-preview-overflow-446 |
| 2026-10-23 | [a2ee858](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/a2ee85811e4af86ccfdb395c10013d1ecda9332f) | Merge pull request #464 from visual-spec-labs/dogui1018/vite-native-config-warning-448 |
| 2026-10-24 | [bf621da](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/bf621da42cc3875820a4bcf9664ea79cce7744e5) | Merge pull request #465 from visual-spec-labs/codex/447-start-guide-current-ui |
| 2026-10-24 | [f6d3a01](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/f6d3a013839dd8c3c9deeac31e25e52563826b14) | Merge pull request #466 from visual-spec-labs/codex/448-b12-beforeunload-check |
| 2026-10-24 | [18faf28](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/18faf28e053d3535b191a4edc32376470b7b8f58) | Merge pull request #467 from visual-spec-labs/codex/448-a7-image-path-requests |
| 2026-10-26 | [cbb99cc](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/cbb99cc7c5013cc3908ab0401d64a149d535e8d0) | Merge pull request #468 from visual-spec-labs/codex/448-a11-a12-property-panel |
| 2026-10-29 | [4b60ed5](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/4b60ed52d603a4ed32c91b44fa3520145431f9e9) | Merge pull request #470 from visual-spec-labs/codex/canvas-overflow-notice |
| 2026-10-31 | [faeed63](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/faeed6362fff58ba14087aa4397b7a7fd91b69f6) | Merge pull request #485 from visual-spec-labs/codex/fix-473-ticket-panel-reopen |
| 2026-10-31 | [4765fce](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/4765fcecd9161ec588644f829f2e54e91ffe9458) | Merge pull request #486 from visual-spec-labs/codex/fix-474-widget-sizing |
| 2026-10-31 | [ea0a790](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/ea0a7908506d1a6d68fbd6f798e9bcb2bab45a13) | Merge pull request #487 from visual-spec-labs/codex/fix-472-ticket-progress |
| 2026-11-02 | [a31c989](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/a31c989660aa50562aff6e32aa941b580462340b) | Merge pull request #489 from visual-spec-labs/codex/mvp-export-inspector-fixes |
| 2026-11-02 | [49e7f61](https://github.com/visual-spec-labs/Visual-Spec-Builder/commit/49e7f617d8593d89c16df77748e7e7850c575605) | Merge pull request #490 from visual-spec-labs/codex/mvp-guide-generation |
