# Export 제공 범위와 입력·접근성 최소 지원 범위 (#285)

상태: **합의 제안(2026-10-07)** — 이 문서의 PR이 팀 승인으로 머지되면 결정으로 확정한다.
범위: Export가 무엇을 주는지(컴포넌트 묶음 / 실행 앱), 입력 타입·label·alt·hover/focus/disabled를 어디까지
지원할지, 인증·백엔드·폼 바인딩을 넣을지를 정한다. **이 문서는 정본 스키마와 코드 생성 규칙을 바꾸지
않는다.** 채택한 IR 확장은 아래 "후속 작업"의 별도 스키마 PR에서 바꾼다(06의 변경 규칙). 같은 PR에서
UI·문서의 제공 범위 문구만 맞췄다(맨 아래 "이번 PR에서 바꾼 것").

## 결정 요약

| 질문 | 결정 |
|---|---|
| Export는 무엇을 주나? | **화면 단위 React 컴포넌트 묶음**이다. 실행 앱이 아니다. 앱 셸(`index.html`·`main.tsx`)·라우터 설정·폼 상태·데이터 불러오기·인증·백엔드·배포 설정은 넣지 않는다. 사용자가 기존 React + Tailwind 앱에 넣어 쓴다. |
| 이미지 대체 텍스트(alt)는? | **채택(후속 스키마 PR).** `ImageNode.alt?: string`. 없으면 지금처럼 `alt=""`(장식용)로 만든다. |
| 입력 타입은? | **채택(후속 스키마 PR).** `InputNode.inputType?: "text" \| "email" \| "password" \| "number" \| "tel" \| "url" \| "search"`, 없으면 `text`. `<input type>`에만 반영하고 검증·마스킹 로직은 만들지 않는다. |
| 입력 label은? | **채택(후속 스키마 PR) — 접근 가능한 이름만.** `InputNode.label?: string` → `aria-label`. 화면에 보이는 라벨 텍스트 노드와 `<label htmlFor>`로 잇는 것은 노드 간 참조가 필요해 뺀다. |
| hover / focus / pressed 스타일은? | **제외.** IR의 `states`가 MVP 제외 범위다. 대신 코드 생성은 **브라우저 기본 focus 표시를 지우지 않는다**(`outline-none` 등을 넣지 않는다) — 키보드 사용자가 위치를 잃지 않게 하는 최소선이다. |
| disabled는? | **제외(상태 스타일과 함께 후속).** 정적 `disabled` 속성만 두면 캔버스와 코드의 모습이 같아질 근거가 없다. 상태 스타일을 설계할 때 같이 정한다. |
| 버튼 종류(`submit`)는? | **제외.** 코드 생성은 지금처럼 `type="button"`이다. 제출은 폼 동작이라 아래 폼 바인딩과 같이 다룬다. |
| 인증·백엔드는? | **넣지 않는다.** 로그인 화면은 그릴 수 있지만 로그인 기능은 만들지 않는다. 이 도구의 범위가 아니라 사용자 앱의 책임이다 — 후속 계획도 두지 않는다. |
| 폼 상태·바인딩(`value`/`onChange`/제출)은? | **이번 MVP에 넣지 않는다.** #265(화면 종류·연결·재사용 부품)가 이벤트 표현(`action`)을 정한 뒤, 그 위에 폼 바인딩을 얹을지 별도 epic으로 판단한다. |

## 현재 상태와 근거

| 대상 | 지금 | 근거 |
|---|---|---|
| Export 결과 | `pages/`·`components/`·`assets/`·`package.json`·`README.md` ZIP. README가 "이 폴더 자체는 앱이 아니라 컴포넌트 묶음"이라고 적는다 | `export/bundle.ts` `buildReadme` |
| Export 화면·범위 문서 | (#285 이전) 컴포넌트 묶음이라는 말이 없었다. 02는 "출력: 기능 폴더 Export"라고만 적었다 — 이번 PR에서 맞췄다(맨 아래 "이번 PR에서 바꾼 것") | `ui/ExportPanel.tsx`, [02](02-mvp-scope.md) |
| `ImageNode` | `src`·`fit`만 있다. alt 필드가 없다 | 정본 스키마 `$defs.ImageNode` |
| `InputNode` | `placeholder`(표시용 텍스트)뿐. 입력 타입·label·value가 없다 | 정본 스키마 `$defs.InputNode`, [05](05-schema.md) |
| `ButtonNode` | `content`(표시용 라벨)뿐. 클릭 동작이 없다 | 같은 곳 |
| 상태·이벤트 | `props`·`bindings`·`events`·`states`가 IR 제외 범위다 | [05](05-schema.md) MVP 제외 범위, [03](03-user-flow.md) |
| 코드 생성 근사 | 이미지는 `alt=""`(장식용), 버튼은 `type="button"`, 입력은 타입 없는 `<input placeholder>`. 이름이 "비밀번호"여도 `type="password"`나 인증 로직을 넣지 않는다 | `skills/visual-spec-to-react/SKILL.md` |

모두 "지금 IR이 표현하지 못하니 가장 보수적으로 근사한다"는 같은 방침이다. 문제는 그 사실이 Export 화면과 범위 문서에 없어서, 사용자가 받은 ZIP을 "바로 실행되는 앱"이나 "입력이 동작하는 폼"으로 기대할 수 있다는 점이다(제품 점검 F08).

## 1. Export 제공 범위

**제공한다**

- 페이지 하나당 페이지 컴포넌트(`pages/`)와 그 페이지에서 나눈 컴포넌트(`components/`)
- 화면이 쓰는 이미지(`assets/`) — 정적 import로 참조한다(#270)
- 필요한 패키지 **목록**(`package.json`) — 버전은 통합하는 앱이 정한다
- 실행·통합 방법과 검증 결과(`README.md`)

**제공하지 않는다**

| 항목 | 이유 / 대신 |
|---|---|
| 앱 셸(`index.html`·`main.tsx`·빌드 설정) | 사용자가 가진 앱에 넣는 것이 02의 전제다(기존 프로젝트 자동 병합 제외) |
| 라우터 설정·화면 이동 | 화면 간 연결은 IR에 없다. #265가 `navigate` 등을 IR에 넣은 뒤에도 라우터 셋업까지 줄지는 #265에서 정한다 |
| 폼 상태·입력 검증·제출 | `value`/`onChange`/제출이 IR 제외 범위다 |
| 데이터 불러오기·API 호출 | 데이터 바인딩이 IR 제외 범위다. 표·카드의 값은 스펙에 적힌 정적 텍스트다 |
| 인증·세션·백엔드 | 이 도구의 범위가 아니다 |
| 배포 설정 | 통합하는 앱의 몫이다 |
| hover·focus·disabled 상태 스타일 | IR의 `states`가 제외 범위다(아래 2절) |

이 범위를 **Export 화면 하단 문구, ZIP의 README, 02, 14**에서 같은 목록으로 쓴다(이번 PR) — 앱 셸·라우터 설정·폼 동작·데이터 불러오기·인증·백엔드·상태 스타일·배포 설정.

## 2. 입력·접근성 최소 지원 범위

원칙: **사용자가 정적 마크업만으로 의미를 줄 수 있고, 캔버스 모습을 바꾸지 않는 것만 IR에 넣는다.** 상태(hover/focus/disabled)처럼 모습이 바뀌거나 동작이 필요한 것은 상태·이벤트 설계와 함께 다룬다.

| 항목 | 결정 | 코드 생성 | 캔버스 | 비고 |
|---|---|---|---|---|
| 이미지 alt | 채택 — `ImageNode.alt?: string` | 있으면 `alt="…"`, 없으면 지금처럼 `alt=""`(장식용으로 근사 — 사용자가 대화에서 알려 주면 그 문구) | 변화 없음 | 빈 문자열을 일부러 저장하면 "장식용"이라는 명시로 본다 |
| 입력 타입 | 채택 — `InputNode.inputType?` (`text` 기본, `email`·`password`·`number`·`tel`·`url`·`search`) | `<input type="…">`. 검증·마스킹·키보드 처리 코드를 만들지 않는다 | 변화 없음 — placeholder를 그대로 보여 준다(`password`도 placeholder는 평문) | `checkbox`·`radio`·`file`·`date` 등은 모습이 다른 별도 컨트롤이라 넣지 않는다 |
| 입력 label | 채택 — `InputNode.label?: string`(접근 가능한 이름) | `aria-label="…"` | 변화 없음 | 보이는 라벨 노드와 `<label htmlFor>`로 잇기는 노드 참조가 필요해 제외 |
| 버튼 이름 | 이미 있음 | `content`가 버튼 텍스트(접근 가능한 이름) | — | 아이콘만 있는 버튼은 노드 타입이 없어 해당 없음 |
| focus 표시 | 상태 스타일은 제외 | **기본 focus 표시를 지우지 않는다** | — | 코드 생성 규칙. 지금 스킬도 지우지 않는다 — 규칙으로 명시만 한다(후속 3) |
| hover / pressed | 제외 | 만들지 않는다 | — | `states` 설계 때 |
| disabled | 제외 | 만들지 않는다 | — | `states` 설계 때 정적 속성과 모습을 같이 정한다 |

**버전.** 세 필드는 모두 선택 필드라 기존 0.3 문서가 그대로 유효하다. 반응형(#245)·이미지 배경(#254)과 같이 **0.3을 유지하는 선택 확장**으로 제안한다. 반응형 override 대상에는 넣지 않는다(의미 속성이지 표현 속성이 아니다).

**Command.** 바뀌지 않는다. `updateNode`가 쓸 수 있는 경로는 정본 IR 스키마가 선언한 속성에서 자동으로 정해진다(`command/editablePath.ts` — 손으로 적은 허용 목록이 없다). 세 필드를 IR에 더하면 `updateNode { path: "alt" | "inputType" | "label" }`이 그대로 허용되고, Command 스키마([09](09-command-schema-freeze.md))는 v0.1 그대로다. 후속 스키마 PR에서 이 경로들의 테스트를 함께 더한다.

## 3. 인증·백엔드·폼 바인딩

- **인증·백엔드: 포함하지 않는다. 후속 계획도 없다.** 로그인·회원가입 화면의 모양은 만들 수 있지만, 로그인 요청·세션·권한은 사용자 앱이 구현한다. 코드 생성은 이름(예: "비밀번호")만 보고 인증 로직을 추측해 넣지 않는다(지금 스킬 규칙 유지).
- **폼 바인딩·제출: 이번 MVP에 넣지 않는다.** 순서는 #265의 이벤트 표현(`action`)이 먼저다. 그 뒤 `value`/`onChange`/제출을 IR에 넣을지(예: 입력 노드의 `name`, 폼 프레임의 `submit` action)를 **별도 epic**으로 판단한다. 그 전까지 에이전트에 "누르면 로그인되게"를 요청하면 정적 마크업만 만들고 스펙이 표현하지 못한다고 알린다(지금 스킬 규칙 유지).

## #265와의 경계

| | #265 | #285(이 문서) |
|---|---|---|
| 다루는 것 | 화면 종류(page/modal/widget)·화면 간 연결(`action`)·재사용 부품(instance) | Export 제공 범위, 입력·이미지의 의미 속성(alt·inputType·label), 인증·폼 포함 여부 |
| 겹치는 것 | 버튼의 동작(`action`) | 없음 — 버튼 동작은 #265에 맡기고 여기서는 `type="button"` 유지만 적는다 |
| 순서 | 폼 바인딩은 #265의 `action` 설계 뒤 | — |

같은 epic을 새로 만들지 않는다. 상태(`states`) 설계가 필요해지면 #265와 별개의 이슈로 연다.

## 후속 작업

각 항목은 별도 PR이다. 이 문서가 승인된 뒤 이슈로 연다.

1. **스키마 PR** — `ImageNode.alt`, `InputNode.inputType`, `InputNode.label` 선택 필드(0.3 유지). 06·05 갱신, `pnpm run generate:types`, 예제(`examples/form-grid.json` 등)·검증 테스트, 세 경로의 `updateNode` 허용 테스트.
2. **GUI** — 속성 패널에 Image alt, Input 타입·label 입력. Undo 한 단계.
3. **코드 생성 스킬** — `skills/visual-spec-to-react/SKILL.md`에 세 필드 매핑과 "기본 focus 표시를 지우지 않는다" 규칙을 적고, 자연어 응답 스킬이 세 필드를 쓸 수 있게 안내한다.
4. **상태 스타일(hover/focus/disabled)** — 필요해지면 설계 이슈로 연다. 이번 범위의 완료 조건이 아니다.

## 이번 PR에서 바꾼 것

- 이 문서와 [README](../README.md) 목차.
- [02](02-mvp-scope.md) — "결과물 원칙"에 Export 제공 범위, "MVP 제외 범위"에 앱 셸·폼·데이터·인증·상태 스타일을 더했다(정정 이력 포함).
- [14](14-getting-started.md) — Export 절에 제공 범위 한 줄.
- Export 화면 하단 문구(`ui/ExportPanel.tsx`)와 ZIP README(`export/bundle.ts` `buildReadme`)의 "실행 방법" — 같은 제공 범위를 적는다.
