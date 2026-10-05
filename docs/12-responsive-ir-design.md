# 반응형 IR 설계 결정 (#181)

상태: **설계·정본·GUI·코드 생성 지침 병합 완료** (#245·#247·#248·#252, 2026-10-05).
아래 리뷰 제안 절은 당시 설계 기록이다. 실제 AI 생성의 전체 흐름은 #261에서 로그인 예제로 검증했고,
반응형 출력은 그 검증에 포함되지 않았다([15](15-workflow-qa.md)).
범위: IR 표현과 변경 절차를 정한다. 에디터 GUI(#247)와 코드 생성 지침(#248·#252)은 후속 PR에서 구현됐다.

## 결정 요약

| 질문 | 결정 |
|---|---|
| 어디에 반응형 데이터를 둘까? | 각 `ScreenSpec`의 선택 필드 `responsive`에 breakpoint 정의와 노드별 희소 오버라이드를 둔다(선택지 c). |
| breakpoint는 숫자일까 이름일까? | 안정적인 문자열 ID와 명시적인 `minWidthPx`를 함께 저장한다. 이름만으로 의미를 추측하지 않는다. |
| Command 단위는 바뀔까? | 바뀌지 않는다. 편집 단위는 계속 한 `ScreenSpec`이다. 반응형 블록의 수정 명령/경로는 구현 이슈에서 정한다. |
| 기존 문서는 어떻게 될까? | `responsive`가 없는 기존 문서는 현재 렌더를 유지하고 마이그레이션하지 않는다. 새 필드를 모르는 구버전 validator는 새 문서를 거부할 수 있다. |
| React/Tailwind 지침은 어디까지 둘까? | IR은 프레임워크 중립으로 둔다. 변환기는 수치 breakpoint를 대상 설정과 대조해 표현하고, `md:`/`lg:` 이름을 IR 계약으로 강제하지 않는다. |

## 표현 방식

`responsive`는 페이지마다 독립적이다. 이 필드가 생략되면 그 화면은 지금처럼 하나의 값만 가진다. 초안 형태는 다음과 같다. 이는 설계 스케치이며 정본 JSON Schema가 아니다.

```jsonc
{
  "name": "Product page",
  "size": { "width": 1440, "height": 900 },
  "root": "root",
  "nodes": {
    "root": { "type": "frame", "name": "Root", "box": { "width": "fill", "height": "fill" }, "layout": { "direction": "column" }, "children": [] },
    "cards": { "type": "frame", "name": "Cards", "box": { "width": "fill", "height": "auto" }, "layout": { "direction": "row", "gap": 24 }, "children": [] }
  },
  "responsive": {
    "breakpoints": {
      "tablet": { "minWidthPx": 768 },
      "desktop": { "minWidthPx": 1024 }
    },
    "overrides": {
      "tablet": {
        "cards": { "layout": { "direction": "column", "gap": 16 } }
      }
    }
  }
}
```

기본 `nodes` 값은 모든 폭의 기반 값이다. breakpoint override는 그 `minWidthPx` 이상에서 적용되며, 더 큰 폭에서는 낮은 breakpoint 값 위에 누적 적용한다. 같은 노드와 속성이 여러 breakpoint에 있으면 가장 큰 적용 breakpoint의 값이 우선한다. 속성 일부만 덮어쓰며, 생략된 속성은 앞선 값에서 상속한다. 따라서 작은 화면 우선의 기본 레이아웃은 기존 필드에 두고 큰 화면용 변경을 breakpoint에 기록한다. `size.width`는 아트보드/초기 미리보기 크기이며 breakpoint 정의를 선택하거나 대체하지 않는다.

"속성 일부만 덮어쓴다"는 객체 칸(`box`, `layout`, `border`, `typography` 등)에 대한 규칙이다. **배열은 원소 단위로 병합하지 않는다.** 0.3부터 `background`는 채우기 겹 배열(`Fill[]`, [13](13-background-fill-design.md#반응형-ir과의-관계))이라, override의 `background`는 그 폭에서 **배경 전체를 갈아 끼운다.** "이 폭에서 배경 없음"은 `[]`로 쓴다(생략은 상속이다). 예: `"cards": { "background": [{ "type": "solid", "color": "#F8FAFC" }] }`.

`minWidthPx`는 양의 CSS px 값이다. breakpoint ID는 문서 안에서 고유하고, 폭도 서로 달라야 한다. ID의 사전식 순서가 아니라 숫자 폭이 적용 순서를 정한다. 유효한 노드 ID, 선언된 breakpoint 참조, 중복/정렬 조건은 일반 JSON Schema로 충분히 보장하기 어려워 validator의 의미 검증 대상이다.

첫 버전의 override는 노드의 표현 속성만 대상으로 한다: `box`, `layout`, `background`, `border`, `typography`, `color`, `opacity`, `blur`, `visible`, `fit` 중 해당 노드 타입에 정의된 필드. `type`, `name`, `content`, `placeholder`, 이미지 `src`, 노드 생성/삭제, `children`/트리 순서는 override하지 않는다. 노드 정체성과 트리는 breakpoint 간 동일하게 유지한다. 이 제한은 화면 배치 변경을 지원하면서 노드 참조와 트리 구조가 폭마다 달라지는 복잡성을 피한다.

## 대안과 근거

- **노드마다 breakpoint를 반복 선언 (a):** 각 노드가 breakpoint 체계를 중복 소유하면 이름/폭이 서로 달라지거나 순서 검증이 흩어진다.
- **viewport별 완전한 ScreenSpec (b):** 같은 노드 트리와 내용을 복제해 화면 간 수정이 어긋날 수 있고, 한 요소를 고칠 때 여러 화면을 동기화해야 한다.
- **Screen별 breakpoint 정의 + 희소 노드 override (c, 채택):** 기반 화면은 한 벌로 유지하고 달라지는 속성만 적는다. 화면 단위 경계는 유지하면서 breakpoint 참조와 폭 정의를 한곳에서 검증할 수 있다.

CSS 미디어 쿼리는 viewport 조건에 따라 스타일을 적용한다. Tailwind의 기본 breakpoint는 mobile-first `min-width`이지만 설정으로 바뀔 수 있다. 그러므로 IR에는 대상 프레임워크의 `md` 같은 토큰 대신 실제 경계값을 둔다. 코드 생성 지침은 대상 Tailwind 설정의 값과 일치할 때만 해당 named variant를 쓰고, 불일치하면 임의 breakpoint 또는 일반 CSS 미디어 쿼리를 선택하도록 한다. 코드 생성기는 이 설계의 구현 범위가 아니다. 참고: [MDN media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries), [Tailwind responsive design](https://tailwindcss.com/docs/responsive-design).

## Screen 및 Command 경계

현재 `applyCommand`의 입력은 한 `ScreenSpec`과 한 Command/Transaction이다. `responsive`를 `ScreenSpec` 안에 두므로 편집 히스토리가 프로젝트 전체나 여러 페이지로 넓어지지 않는다. breakpoint 배열/맵과 희소 노드 맵을 안전하게 부분 갱신하는 명령 이름, 경로 검증, 한 번의 GUI 동작을 한 트랜잭션으로 묶는 세부 방식은 스키마 후속 PR 및 GUI 이슈에서 확정한다. 기존 `setNodeField`가 임의의 중첩 구조를 바로 수정할 수 있다고 가정하지 않는다.

`ProjectSpec`의 각 페이지(Screen)는 breakpoint를 독립적으로 정의한다. 여러 페이지에서 공통 breakpoint 토큰을 공유하는 기능은 현재 요구 범위에 포함하지 않는다.

## 호환성 및 동결 절차

- 기존 `VisualSpec` v0.1 및 `ProjectSpec` v0.2에서 `responsive`가 없으면 기본 동작은 기존과 동일하고 데이터 변환은 필요 없다. (이 문서 이후 #127이 두 타입의 버전을 `"0.3"`으로 올렸다 — 반응형 스키마 PR은 0.3 문서를 기준으로 한다.)
- 새 필드가 들어간 문서를 모르는 구버전 validator는 현재 `additionalProperties: false` 계약에 따라 이를 거부할 수 있다. 작성 도구 버전/문서 버전 호환성은 스키마 PR 본문과 GUI 이슈에서 드러내고 처리한다.
- 이번 결정은 정본 스키마나 생성 타입을 수정하지 않는다. 실제 스키마 추가는 [06의 동결 변경 규칙](06-schema-freeze.md#변경-규칙)에 따라 별도 PR로 올리고, 팀 승인, 기존 JSON 영향 설명, 타입 생성, 예제 및 검증을 포함한다.
- 반응형은 선택 필드로 추가하며 미지정 기본은 기존 단일 레이아웃이어야 한다. 필드가 있는 새 문서에서 폭별 계산이 달라지는 것은 의도한 새 기능이다.

설계 당시 `examples/*.json`의 기존 예제 8개에는 `responsive`가 없다. 이 결정은 스키마를 바꾸지 않으므로 이 문서 작업에서 예제 유효성 계약은 변경하지 않는다. 스키마 PR에서 기존 8개와 신규 반응형 예제를 정본 validator로 검증한다.

## 후속 작업 범위

1. **별도 스키마 이슈/PR(#222 → #245 병합):** 위 스케치의 정본 구조, 노드 타입별 partial override 정의, `minWidthPx`·참조·중복 폭의 의미 검증, 버전 호환성 문구를 확정한다. `types.ts` 생성 결과와 기존 8개 + 반응형 예제 검증을 함께 반영한다.
2. **GUI 이슈(#223 → #247 병합):** 페이지 breakpoint 정의/선택, 캔버스 폭에 따른 breakpoint 해석, 선택 노드의 override 편집, 없는 override의 상속 표시, Undo/Redo 트랜잭션을 구현한다. 반응형 미리보기 폭 변경과 경계값 동작도 명시한다.
3. **코드 생성 이슈(#224 → #248, 리뷰 수정 #252 병합):** 수치 breakpoint를 출력 대상 설정에 맞춰 CSS로 변환한다. Tailwind breakpoint 토큰을 그대로 쓸 수 있는 조건과 사용자 설정 불일치 fallback을 다룬다.

이 문서는 설계 결정을 기록한다. 위 후속 작업은 모두 병합되어 GUI에서 반응형 미리보기와 override 편집을 하고,
`visual-spec-to-react` 스킬 지침으로 반응형 React 코드를 생성할 수 있다. 코드 매핑은 스킬 지시문을 사람이 옮긴
fixture로 검증했으며 실제 AI의 반응형 출력은 아직 검증하지 않았다([16](16-responsive-codegen-qa.md), [07](07-implementation-status.md)).


## #222 정본 구현의 리뷰 제안

스케치의 선택적 표현을 JSON Schema와 validator로 옮긴다. 상세한 partial 객체 규칙,
새 IssueCode, 0.3 선택 확장 호환성 제안은 [06](06-schema-freeze.md#반응형-선택-확장--222-pr-제안)에
기록했다. 0.3 유지 및 새 계약은 별도 스키마 PR의 팀 승인 대상으로, 이 설명이 승인을
대신하지 않는다. 배열 전체 교체·수치 폭 순서·노드 타입별 허용 필드는 위 설계 그대로다.

검증기는 각 폭에서 상속을 계산하여 완전한 노드를 요구한다. 기반에 없던 선택 객체는
필수 칸을 모두 제공해야 하고, 숫자 radius를 객체로 바꿀 때도 네 모서리가 필요하다.
`examples/responsive-cards.json`은 두 breakpoint의 padding/gap 상속과 배경 제거를 보인다.
기존 예제 9개(gradient 예제 포함)는 유지한다. 정본 #245만으로 전체 사용 흐름이
완료되는 것은 아니며, 후속 GUI #247·코드 생성 지침 #248·보정 #252도 이제 병합됐다.

## #223 GUI 구현 PR 제안 (#245 의존)

우측 패널의 **반응형**에서 페이지별 breakpoint ID·최소 폭을 추가하고, 선택하거나 삭제한다.
선택한 breakpoint는 해당 최소 폭을 미리본다. 숫자 미리보기 폭을 바꾸면 경계를 포함해
가장 큰 활성 breakpoint가 편집 기준이 된다. 기본값 선택은 첫 breakpoint보다 작은 폭으로
이동한다. 미리보기 폭은 페이지 크기를 바꾸지 않고 Undo에도 기록하지 않는다.

캔버스와 속성 컨트롤은 `resolveResponsiveScreen(screen, width)`의 합성 결과를 사용한다.
객체는 누적 병합하고 배열은 대체한다. 패널은 변경한 leaf만 선택 breakpoint에 기록하며
이름·내용·src·그림자는 기본값에서 편집한다. `override` 목록의 속성별 **상속** 버튼은 그
경로를 지우고, **이 노드 override 삭제**는 노드 전체 패치를 지운다. **현재 표현값 고정**은
현재 명시된 표현값을 이 폭의 패치로 만든다. 목록 밖의 속성은 기반값 또는 낮은 폭에서
상속된다. 폭이 큰 breakpoint도 해당 속성을 직접 덮어쓰지 않았으면 작은 폭의 편집을
상속하는 것이 의도한 동작이다.

반응형 문서에서는 캔버스 직접 리사이즈 대신 속성 패널과 미리보기 폭 입력을 사용한다.
자식 크기 균등 배치는 현재 기본값 모드에서만 제공한다. 테두리·불투명도·블러의 시각적
제거는 명시적인 0/1 기본값을 override로 기록하며, 상속으로 복귀하는 버튼과 구분한다.

기존 `updateScreen` 전체 블록 경로를 재사용하되, 허용 경로 확장은 별도 Command 계약
리뷰 대상이다([09](09-command-schema-freeze.md)). GUI PR도 최소 1명 승인 없이 병합하지
않는다. 반응형 스키마 #245가 선행이며 코드 생성 #224는 별도 PR이다.
