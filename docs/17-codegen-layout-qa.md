# 코드 생성 레이아웃 QA (#269)

검증일: 2026-10-06. 기준: 업데이트된 `develop` 7f6de2e, 이슈 작업 브랜치.

## 수동 매핑 DOM 실측

`test/fixtures/codegen-layout-269-dom.html`은 스킬의 매핑을 직접 옮긴 정적 HTML이다. Chrome headless의
`--dump-dom file:///.../test/fixtures/codegen-layout-269-dom.html`로 페이지 스크립트가 수집한 `getComputedStyle`, `getBoundingClientRect`, scroll/client
크기를 읽었다. 측정 결과는 마크업의 `body[data-qa]`에 JSON으로 기록된다. 이는 AI가 생성한 출력이 아니라
**수동 매핑 fixture**이며, Canvas `boxStyle` 소스의 Fixed/Hug/Fill 계산과 비교했다.

| 사례 | 실측 (px) | 판정 |
|---|---|---|
| 300px row 안의 Fixed 240px 두 개, `flex: 0 0 240px` | 자식 폭 240, 240; scrollWidth 480 | Canvas와 같이 줄지 않으며 콘텐츠가 오른쪽으로 넘친다 |
| 같은 row, width 240px만 지정한 이전 기본 매핑 | 자식 폭 150, 150; scrollWidth 300 | shrink 기본값 1로 두 Fixed가 줄어드는 차이를 재현 |
| 300px row 안의 Fill 두 개, `flex: 1 1 0; min-width: 0` | 자식 폭 150, 150; basis 0px, grow/shrink 1 | 남은 주축 공간을 균등 분배 |
| Hug `flex: 0 0 auto` 두 개 | 자식 폭 각각 86.28; basis auto, grow/shrink 0 | 콘텐츠의 intrinsic 폭을 유지. 부모의 기본 교차축 stretch로 높이는 120 |
| 300×120 column 안의 Fill 두 개 | 자식 크기 각각 300×60; min-height 0 | 세로 주축 공간을 균등 분배 |
| 2열 grid 안의 두 셀 | 셀 크기 각각 150×120 | flex grow/shrink/basis 없이 grid track으로 채움 |
| 폭 120px Text, 자동 줄바꿈 + 명시적 개행 + 연속 공백 | `white-space: pre-wrap`, 높이 80px(4줄), client/scrollHeight 80 | 일반 공백에서 자동 줄바꿈하고 개행·연속 공백을 보존 |
| 폭 80px Text, `supercalifragilisticexpialidocious` | `overflow-wrap: normal`, clientWidth 80, scrollWidth 227 | Canvas 기본처럼 긴 단어를 강제로 쪼개지 않아 수평으로 넘침 |

Row/column/grid에서 DOM 크기와 computed flex 값이 각각 Canvas `boxStyle`의 주축/교차축 및 grid
분기와 맞았다. 컨테이너는 overflow를 지정하지 않아 넘친 Fixed와 긴 단어가 잘리지 않았다.
이 검증은 Chromium DOM의 레이아웃 수치이며 픽셀 이미지 비교는 아니다. 글꼴은 시스템 Arial이다.

## 기존 Codex 출력 관찰과 구분

이슈 제보자는 이전 실제 Codex 출력의 `<p>`에서 `white-space: normal`을 관찰했다고 기록했다.
두 줄 텍스트가 한 줄로 합쳐진 재현은 기존 실제 출력 관찰이고, 이 변경에서는 외부 AI를 실행해 재검증하지
않았다. 위의 `pre-wrap`, 공백 보존, 긴 단어 넘침 측정은 스킬 지시를 옮긴 수동 HTML fixture 결과다.
따라서 실제 AI의 새 출력 성공으로 간주하지 않는다.

클래스 문자열 검사는 완료 기준으로 사용하지 않았다. `getComputedStyle`과 요소의 실측 폭·높이 및
scroll/client 크기를 확인했다.
