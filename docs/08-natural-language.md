# 08. 자연어 변환 설계

> 작성 기준일: **2026-09-18** / 기준 커밋: `develop` f0fd707 (PR #143 머지 후)
>
> 이 문서는 [02-mvp-scope.md](02-mvp-scope.md)의 구현 단위 여섯 중 하나인 **자연어 변환**(자연어 → Command 변환)의
> 설계안이다. [07-implementation-status.md](07-implementation-status.md) 1절이 이 단위를 **"미착수 — 관련 코드 없음"**
> 으로 적고 있고, 실제로 `src/` 에 이 단위의 코드는 없다.
>
> **이 문서는 구현이 아니다.** 여기서는 결정과 그 근거만 적는다. 코드는 이 문서를 검토한 뒤 별도로 맡긴다.
> 이 브랜치는 `src/`·`test/`·`package.json` 을 건드리지 않았다.
>
> **결정한 것과 안 정한 것을 갈라 적는다.** 본문의 결정은 "결정"이라고 쓴 것만이고, 나머지는 제안이거나
> 열린 물음이다. 팀이 정해야 하는 것은 [8절](#8-사용자가-정해야-하는-것)에 모아 뒀다.

---

## 목차

1. [출발점 — 이미 있는 것](#1-출발점--이미-있는-것)
2. [질문 1 — 실행 주체는 누구인가](#2-질문-1--실행-주체는-누구인가)
3. [질문 2 — 자연어가 도착하는 형태](#3-질문-2--자연어가-도착하는-형태)
4. [질문 3 — 검증과 실패 처리](#4-질문-3--검증과-실패-처리)
5. [질문 4 — Undo 와의 관계](#5-질문-4--undo-와의-관계)
6. [질문 5 — GUI 어디에 붙는가](#6-질문-5--gui-어디에-붙는가)
7. [질문 6 — MVP 범위를 어디서 끊는가](#7-질문-6--mvp-범위를-어디서-끊는가)
8. [사용자가 정해야 하는 것](#8-사용자가-정해야-하는-것)
9. [확인 방법과 확인하지 않은 것](#9-확인-방법과-확인하지-않은-것)

---

## 1. 출발점 — 이미 있는 것

### 1.1 도착 지점(Command Engine)은 이미 있고 안정적이다

`src/features/editor/command/` 에 세 파일이 있다.

| 파일 | 내용 |
|---|---|
| `command/types.ts` | Command 6종 — `createNode`·`updateNode`·`deleteNode`·`moveNode`·`setLayout`·`updateScreen`. 그리고 `Transaction`(`types.ts:80` — `{ commands: Command[] }`) |
| `command/applyCommand.ts` | 순수 적용기 `applyCommand(screen, command)`(`:181`)와 `applyTransaction(screen, commands)`(`:203`). 규칙을 어기면 예외를 던지지 않고 **원본 `screen` 참조를 그대로 돌려준다**(`:169`–`:180` 주석) |
| `command/history.ts` | 범용 undo/redo 스택. `pushHistory`(`:34`)·`replacePresent`(`:49`)·`undo`/`redo`·`canUndo`/`canRedo` |

`store/editorStore.ts` 의 편집 액션은 전부 이 경로를 거친다 — `setNodeField`·`setPageField`·`insertNode`·
`removeNode`·`moveNode` 가 모두 `applied(state, pageId, command)`(`editorStore.ts:234`)를 통과한다
(이슈 #40·#101·#110·#131, [EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) §2). **스토어가 노드를
직접 만들거나 고치는 자리는 없다.**

즉 **"자연어 → Command"의 도착 지점은 이미 있다.** 이 설계가 다루는 것은 그 앞단이다.

`command/types.ts:4`–`:10` 의 주석이 이 타입의 존재 이유를 이미 그렇게 적어 두고 있다 —
*"GUI 이벤트와 자연어 Agent가 공유하는 편집 명령 … 드래그로 옮기든 '버튼을 오른쪽으로 옮겨줘'라고 하든
같은 moveNode Command가 나와야 한다는 게 이 타입의 존재 이유다."*

### 1.2 자연어 경로는 이미 있다 — 다만 스킬 지시문 형태다

**`skills/visual-spec-authoring/SKILL.md` 를 읽고 확인한 사실이다.** 이 스킬은
*"로그인 화면 스펙 만들어줘", "이 JSON에 카드 하나 더 넣어줘", "버튼 색 바꿔줘", "제목 좀 크게"* 같은
요청을 받아 **에이전트가 스펙 JSON 을 직접 쓰거나 고치게** 한다. 즉 02가 말하는 "자연어 화면 생성"과
"자연어 부분 수정" 둘 다 **지금 이미 어떤 형태로든 돌아가고 있다.**

그래서 이 설계는 "없는 걸 새로 만드는" 일이 아니라 **"지시문으로 하던 걸 어디까지 코드로 내릴 것인가"** 다.
지금 스킬 경로와 이 문서가 설계하는 경로의 차이는 넷이다.

| | `visual-spec-authoring`(지금) | 이 문서가 설계하는 경로 |
|---|---|---|
| 산출물 | 스펙 JSON **문서 전문** | **Command 배열** |
| 도착지 | 파일(`examples/*.json`, `.visual-spec/specs/`) | 실행 중인 `editorStore` |
| 검증 | 다 쓴 뒤 `validateVisualSpec` 을 부르라고 **지시문이 시킨다**(SKILL.md "다 쓴 뒤" 절) | 적용 전에 코드가 강제한다(4절) |
| Undo | 없다(파일을 덮어쓴다) | `history` 한 단계(5절) |

스킬이 이미 갖고 있어 **다시 만들 필요가 없는 지식**도 분명하다 — 뼈대, `examples/` 7개가 지키는 관용구
(평평한 `nodes` 맵 + `children[].node` 참조, `layout` 5필드 전부 명시, `typography` 6필드 전부 명시,
`TextNode.height` 는 항상 `"auto"`, 노드 ID 패턴), 노드 타입 5종 제약, 자주 틀리는 지점 8가지
(`examples/invalid/` 대응). 자연어 경로를 코드로 내리더라도 **이 지식의 자리는 여전히 프롬프트/스킬 문서다.**
코드로 내려가는 것은 지식이 아니라 **형식 강제와 실패 처리**다.

> **관찰(이 문서에서 고치지 않음)** — `skills/visual-spec/SKILL.md:25`–`:26` 은
> *"CLI(`npx visual-spec`), Command Engine(자연어 명령), Export, GUI의 화면 생성·편집은 아직 구현되지 않았다.
> 현재 동작하는 것은 스키마와 검증기뿐이다."* 라고 적고 있다. CLI(이슈 #42·#104·#105) · Command Engine(이슈 #73·#40)
> · GUI 편집은 그 뒤 생겼으므로 이 두 줄은 낡았다. 스킬 파일 수정은 이 작업의 범위 밖이라 관찰로만 남긴다.

### 1.3 설계가 이미 문서로 정해 둔 것

[03-user-flow.md](03-user-flow.md)가 자연어 경로의 상당 부분을 이미 결정해 뒀다. 이 문서는 그 위에서 시작한다.

- *"자연어는 코드가 아니라 명령을 만든다"* — `자연어 분석 → 화면 구조 계획 → 캔버스 조작 명령 생성 → IR 변경 → 캔버스에 표시`
- **적용 범위 표시** — 입력창 위에 항상 대상을 보여준다. 기본값은 요소를 선택했으면 선택 요소, 아무것도 선택 안 했으면 현재 화면,
  전체 프로젝트는 사용자가 명시적으로 고를 때만.
- **트랜잭션** — *"AI가 한 요청으로 여러 노드를 수정했다면 그 요청 전체를 하나의 트랜잭션으로 묶는다."*
- **미리보기/승인** — *"MVP에서는 모든 요청을 계획 단계 없이 바로 적용하고 Undo로 대응해도 된다."*

[01-overview.md](01-overview.md) §4 도 같은 것을 원칙으로 못박고 있다 — *"입력 방식만 다르고 결과는 완전히 같다."*

---

## 2. 질문 1 — 실행 주체는 누구인가

### 2.1 세 안

| 안 | 뜻 |
|---|---|
| (a) 앱 직접 호출 | 브라우저에서 도는 에디터가 LLM API 를 직접 부른다 |
| (b) 에이전트 경유 | Claude Code / Codex 같은 **이미 붙어 있는 에이전트**가 스킬을 통해 수행하고, 앱은 결과(Command 배열 JSON)를 받기만 한다 |
| (c) 둘 다 | 어댑터를 두고 둘 다 지원 |

### 2.2 각 안의 대가

**(a) 앱 직접 호출**

- 얻는 것: GUI 안에서 흐름이 끊기지 않는다. 앱이 요청·응답·실패를 전부 제 손으로 다루므로 4절의 검증 파이프라인을
  한 프로세스 안에 둘 수 있다.
- 치르는 것:
  - **API 키를 어디에 두는가.** 이 저장소는 서버가 없는 로컬 Vite 앱이다(`package.json` 의 `"private": true`,
    `bin/visual-spec.mjs` 가 `node_modules/.bin/vite --open` 으로 개발 서버를 띄운다 — 07 2절 CLI 행).
    브라우저에서 키를 다루면 번들이나 `localStorage` 에 남는다. `store/specStorage.ts` 가 이미 `localStorage` 를
    쓰고 있으므로 그 자리에 키까지 얹고 싶은 유혹이 생긴다.
  - **의존성이 는다.** 지금 `dependencies` 는 `ajv`·`lucide-react`·`react`·`react-dom`·`zustand` 다섯뿐이다.
  - **프로바이더 선택·모델·비용·오프라인 동작이 전부 제품 결정으로 올라온다.** 02는 이 중 어느 것도 정하지 않았다.
- **이 안을 전제로 한 결정은 02 어디에도 없다.**

**(b) 에이전트 경유**

- 얻는 것:
  - **02에 선례가 있다.** "MVP 포함 범위" 표의 `코드 생성 | Claude Code 또는 Codex 실행` 행이 그것이다.
    코드 생성은 앱이 LLM 을 부르지 않고 에이전트가 `skills/visual-spec-to-react/SKILL.md` 를 따라 수행한다.
  - **자연어 쪽에도 이미 같은 구조가 돌고 있다** — `skills/visual-spec-authoring/SKILL.md`(1.2절).
    즉 새 구조를 들이는 게 아니라 **이미 두 곳에서 쓰는 구조를 세 번째로 쓰는 것**이다.
  - 키·비용·오프라인·프로바이더 선택을 앱이 전혀 짊어지지 않는다. 사용자가 이미 켜 둔 에이전트를 그대로 쓴다.
  - 의존성이 늘지 않는다.
- 치르는 것:
  - **GUI 안에서 완결되지 않는다.** 04 §3 의 "AI 입력창"이 앱 안에 있으려면 **앱 ↔ 에이전트를 잇는 전달 매체**가
    필요하다. 지금 저장소에 그 매체는 없다 — GUI 의 Open/Save/Import 는 전부 브라우저 파일 다이얼로그와
    다운로드를 쓰고(`ui/openSpecFromFile.ts`·`ui/exportSpecAsJson.ts`·`ui/importImageFromFile.ts`),
    `.visual-spec/` 는 `visual-spec init` 이 폴더만 만들어 둔 상태다(07 2절 `.visual-spec/` 작업공간 행 —
    *"폴더만 만들 뿐 아직 아무도 그 안을 읽거나 쓰지 않는다"*).
  - 응답이 언제 오는지 앱이 모른다 — 진행 상태 표시가 필요하다.

**(c) 둘 다**

- 얻는 것: 사용자가 고를 수 있다.
- 치르는 것: **(a)의 대가를 전부 치르면서 어댑터 계층이 하나 더 는다.** 자연어 변환 단위에 코드가 한 줄도 없는
  지금 시점에 두 경로를 동시에 유지하는 근거가 02에 없다.

### 2.3 **결정 — (b) 에이전트 경유를 추천한다**

근거는 셋이다.

1. **02가 같은 판단을 이미 한 번 내렸다.** "코드 생성 | Claude Code 또는 Codex 실행". 자연어 변환만 다른 구조를
   쓸 이유가 없고, 다르게 가면 이 제품 안에 LLM 을 부르는 방식이 둘이 된다.
2. **자연어 경로가 이미 그 구조로 존재한다**(`skills/visual-spec-authoring`, 1.2절). (b) 는 그 스킬의
   **출력 형식**(문서 전문 → Command 배열)과 **도착지**(파일 → 스토어)를 바꾸는 일이다. (a) 를 택하면 그 스킬과
   앱 안의 호출 경로가 같은 일을 두 벌로 갖게 된다.
3. **(a) 가 끌고 오는 결정들(키 보관·프로바이더·비용·오프라인)이 전부 02에 없다.** 범위 판단의 기준 문서가
   정하지 않은 것을 구현 단위 하나가 먼저 정하게 되는 형태다.

**(b) 를 택하면 딸려오는 것 — 앱 ↔ 에이전트 전달 매체가 선행 조건이 된다.**
이슈 #133(Vite 미들웨어로 `.visual-spec/` 연결)이 같은 시점에 그 자리를 만들고 있다.
**그 작업의 설계 내용은 이 문서를 쓰면서 확인하지 않았다** — 여기서는 "전달 매체가 필요하고, 그것이 별도 작업으로
진행 중이다"까지만 사실로 적는다. 자연어 변환의 1차 구현은 그 매체가 어떤 모양으로 끝나는지를 보고 착수해야 한다.

매체가 정해지기 전에도 **먼저 만들 수 있고, 어느 안을 택하든 그대로 쓰이는 부분**이 있다 — 3·4·5절이 설계하는
**Command 배열 검사기 · dry-run · 트랜잭션 커밋**이다. 이 셋은 "누가 Command 를 만들었는가"를 모른다.
실행 주체 결정이 늦어져도 이 부분은 막히지 않는다.

---

## 3. 질문 2 — 자연어가 도착하는 형태

### 3.1 결정 — **Command 배열을 그대로 받는다. 중간 표현을 새로 두지 않는다**

근거:

- 중간 표현을 두면 그것이 **네 번째 스키마**가 된다. 02의 "스키마 계약"은 IR·Command·Ticket **셋만** v0.1로
  고정한다고 적었고, 그중 IR 하나만 실제로 동결됐다([06-schema-freeze.md](06-schema-freeze.md), 07 2절).
  아직 고정 못 한 것이 둘 남은 상태에서 새 스키마를 하나 더 늘리는 것은 순서가 거꾸로다.
- Command 배열이 곧 도착 형태여야 01 §4·03의 *"입력 방식만 다르고 결과는 완전히 같다"* 가 코드에서도 참이 된다.
  중간 표현을 두면 GUI 경로와 자연어 경로가 **다른 타입을 거쳐** 같은 Command 에 도달하게 되고, 두 경로의
  동치성을 사람이 눈으로 맞춰야 한다 — 07 1절 Ticket Compiler 행이 적어 둔
  *"스킬 지시문과 이 코드가 같은 규칙을 따르는지는 사람이 대조해서 맞춘 것"* 과 똑같은 상태가 하나 더 생긴다.

### 3.2 다만 앞단에 **기본값 채우기 계층**을 둔다 (제안)

Command 스키마는 그대로 두고, LLM 출력을 Command 로 조립하기 **직전**에 부분 노드를 완전한 노드로 채우는
순수 함수를 둔다. 이유는 3.3의 실측이다 — 노드 3개짜리 화면 하나를 만드는 데 LLM 이 적어야 하는 값이 53칸이다.

선례가 이미 있다. `store/createNode.ts` 의 `createNode(kind)` 가 도구 모음이 만들 노드의 기본값
(Frame 은 200×120 · `layout` 5필드 · `background` · `border`, Text 는 `auto`·"텍스트" · `typography` 6필드)을
순수 함수로 갖고 있다. 자연어용 기본값 계층은 **그 함수를 노드 타입 5종으로 넓히고 부분 덮어쓰기를 받게 한 것**이다.

이 계층은 Command 스키마를 바꾸지 않는다 — `CreateNodeCommand.node` 에는 여전히 완전한 `Node` 가 들어간다.

### 3.3 Command 6종만으로 "자연어 화면 생성"이 표현되는가 — 손으로 적어 본 결과

**예제: `examples/login-screen.json`**(노드 4개 — root frame · title text · card frame · hint text).
**출발 상태: File > New 직후**, 즉 `store/blankSpec.ts` 의 `blankSpec` 을 `migrateV01` 로 넓힌 페이지 한 장.

`blankSpec` 의 root 는 `name: "Screen"` · `box: { width: "fill", height: "fill" }` ·
`background: { color: "#FFFFFF" }` 인데 **`login-screen.json` 의 root 와 이 세 가지가 그대로 같다.**
그래서 root 에는 `layout` 하나만 바꾸면 된다. (이건 `blankSpec` 을 그렇게 고른 결과지 규칙이 아니다.)

```jsonc
// 1 — 화면 이름
{ "type": "updateScreen", "path": "name", "value": "Login" },

// 2 — 해상도. setByPath 가 객체 값을 그대로 받으므로 한 Command 로 끝난다
{ "type": "updateScreen", "path": "size", "value": { "width": 390, "height": 844 } },

// 3 — root 레이아웃. setLayout 은 Layout 객체를 통째로 갈아 끼운다
{ "type": "setLayout", "id": "root",
  "layout": { "direction": "column", "gap": 16,
              "padding": { "top": 24, "right": 20, "bottom": 24, "left": 20 },
              "mainAxis": "start", "crossAxis": "stretch" } },

// 4 — title. createNode 는 부모 children 끝에 붙는다
{ "type": "createNode", "parentId": "root", "id": "title",
  "node": { "type": "text", "name": "Title",
            "box": { "width": "fill", "height": "auto" },
            "content": "로그인", "color": "#111111",
            "typography": { "fontFamily": "Pretendard", "fontSize": 24, "fontWeight": 700,
                            "lineHeight": 32, "letterSpacing": -0.5, "textAlign": "left" } } },

// 5 — card. children 은 반드시 빈 배열이어야 한다(아래 (라) 참고)
{ "type": "createNode", "parentId": "root", "id": "card",
  "node": { "type": "frame", "name": "Card", "visible": true,
            "box": { "width": "fill", "height": "auto" },
            "layout": { "direction": "column", "gap": 12,
                        "padding": { "top": 16, "right": 16, "bottom": 16, "left": 16 },
                        "mainAxis": "center", "crossAxis": "stretch" },
            "background": { "color": "#F5F5F5FF" },
            "border": { "width": 1, "color": "#00000020", "radius": 8 },
            "children": [] } },

// 6 — hint. 이 Command 가 card.children 에 { "node": "hint" } 를 밀어 넣는다
{ "type": "createNode", "parentId": "card", "id": "hint",
  "node": { "type": "text", "name": "Hint",
            "box": { "width": "auto", "height": "auto" },
            "content": "계정 정보를 입력하세요", "color": "#666666",
            "typography": { "fontFamily": "Pretendard", "fontSize": 14, "fontWeight": 400,
                            "lineHeight": 20, "letterSpacing": 0, "textAlign": "center" } } }
```

**결론 — 표현된다.** `login-screen.json` 은 Command **6개**로 만들어진다. 쓴 Command 종류는 **3종**
(`updateScreen`·`setLayout`·`createNode`)이고 `updateNode`·`deleteNode`·`moveNode` 는 쓰이지 않았다 —
**빈 화면에서 만드는 생성 경로에는 노드를 고치거나 지우거나 옮길 일이 없기 때문이다.**

이 열을 따라가며 확인한 것들.

**(가) 순서는 위에서 아래, 부모 먼저.** `applyCreateNode`(`applyCommand.ts:84`)는 `parentId` 가 `nodes` 에 있고
frame 일 때만 동작한다(`:87`). 부모를 먼저 만들지 않으면 그 Command 는 아무 일도 하지 않는다.

**(나) 자식 참조는 자식 자신이 만든다.** `applyCreateNode` 가 `parent.children` 끝에 `{ node: command.id }` 를
직접 덧붙인다(`:96`). 그래서 5번의 card 는 `children: []` 로 만들고, 6번이 hint 를 붙인다.
**5번에 `children: [{ "node": "hint" }]` 를 미리 적으면 안 된다** — 그 순간 `hint` 는 `nodes` 에 없어
`validateProjectSpec` 이 `child-missing` 으로 잡는다(`examples/invalid/` 가 실제로 갖고 있는 오류이고,
`skills/visual-spec-authoring/SKILL.md` 의 "자주 틀리는 지점" 첫 줄이기도 하다).

**(다) 형제 순서는 Command 순서가 정한다.** 4번·5번 순서대로 `root.children` 이 `[title, card]` 가 되고,
`login-screen.json` 과 일치한다.

**(라) LLM 이 적어야 하는 리프 값은 손으로 세어 53칸이다.**

| Command | 칸 수 |
|---|---|
| 1 `updateScreen` name | 1 |
| 2 `updateScreen` size | 2 |
| 3 `setLayout` | 8 (`direction`·`gap`·`padding` 4칸·`mainAxis`·`crossAxis`) |
| 4 `createNode` title | 12 |
| 5 `createNode` card | 18 (빈 `children` 배열을 한 칸으로 셈) |
| 6 `createNode` hint | 12 |
| **합** | **53** |

노드 네 개짜리 최소 화면이 이렇다. 02가 대표 화면으로 삼은 **관리자 대시보드**는 이보다 훨씬 크다.
**3.2의 기본값 계층을 두자는 근거가 이 숫자다** — `typography` 6칸, `layout` 5필드,
`padding` 4칸은 거의 매번 같은 값이고, 하나만 빠져도 스키마 검증에서 걸린다
([06-schema-freeze.md](06-schema-freeze.md): *"객체를 통째로 받는 선택 필드는 내부 칸을 모두 필수로 둔다"*).

### 3.4 Command 6종으로 **표현되지 않는 것** 셋

**(1) 삽입 위치를 지정할 수 없다.**
`CreateNodeCommand` 에 `index` 가 없고 `applyCreateNode` 는 **항상 부모 `children` 끝에 붙인다**(`:96`).
빈 화면에서 위→아래로 만들 때는 문제가 안 되지만(3.3이 그랬다), 이미 있는 화면에
*"헤더를 맨 위에 넣어줘"* 는 `createNode` 뒤에 `moveNode` 를 붙여야 표현된다
(`MoveNodeCommand` 에는 `index` 가 있다 — `types.ts:47`–`:54`).
트랜잭션 하나 안이라 사용자에게 중간 상태가 보이지는 않는다. **즉 표현 자체는 가능하고, Command 수만 는다.**

> **제안(결정 아님)** — `CreateNodeCommand` 에 선택 필드 `index?: number` 를 더한다. 없으면 지금처럼 끝에
> 붙이므로 기존 호출부(`editorStore.insertNode` → `ui/importImageFromFile.ts`·`ui/Toolbar.tsx` 경로·
> `ui/LayerTree.tsx` 의 "레이어 추가")는 영향을 받지 않는다. 다만 **Command 스키마 변경**이라
> 02가 말한 "v0.1로 고정"과 06의 변경 절차를 어떻게 적용할지 먼저 정해야 한다 — 8절.

**(2) 페이지 단위 조작이 없다.**
`applyCommand` 는 **화면 한 장(`ScreenSpec`)만 안다** — `applyCommand.ts:169`–`:180` 주석이
*"이 함수 자신은 '페이지가 여러 장'이라는 개념을 아예 모른다"* 라고 명시한다.
그래서 `addPage`·`removePage` 는 Command 로 표현되지 않고 `editorStore` 가 직접 스냅숏을 얹는다
([EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) §2, 이슈 #131).

**결과: *"새 화면을 하나 더 만들어줘"* 는 지금 Command 6종으로 표현할 수 없다.**
02의 "자연어 화면 생성"을 **빈 페이지 위에 내용을 만드는 것**으로 읽으면 표현되고,
**페이지를 새로 만드는 것**으로 읽으면 표현되지 않는다. 이 해석은 정하지 않았다 — 8절.

**(3) Command 자신이 대상 페이지를 모른다.**
어느 페이지에 적용할지는 호출자(스토어) 책임이다 — `applied(state, pageId, command)`(`editorStore.ts:234`).
그래서 *"로그인 화면의 버튼을 크게 해줘"* 처럼 **비활성 페이지**를 가리키는 요청은 Command 열만으로 구분되지 않는다.
1차 구현을 활성 페이지 한 장으로 한정하는 근거가 이것이다(7절).

---

## 4. 질문 3 — 검증과 실패 처리

### 4.1 지금 상태에서 잘못된 Command 가 오면 무슨 일이 일어나는가 — 실패 모드는 **둘**이다

**모드 A — 조용한 no-op ("먹통").**
`applyCommand` 는 규칙 위반 시 예외를 던지지 않고 같은 `screen` 참조를 돌려준다(`:169`–`:180`).
해당하는 자리는 `:87`(부모 없음/프레임 아님) · `:90`(id 중복) · `:107`(노드 없음) · `:115`(root 삭제) ·
`:116`(노드 없음) · `:135`(root 이동) · `:139`(노드/부모 없음, 부모가 프레임 아님) · `:145`(순환) ·
`:160`(frame 아닌 노드에 `setLayout`) 이다.
그리고 `editorStore.applied` 가 `nextPage === page` 면 `null` 을 돌려 스토어도 `history` 도 바뀌지 않는다.
**사용자에게는 "엔터를 눌렀는데 아무 일도 안 일어난다"로 보인다.**

**모드 B — 조용한 오염.** 이쪽이 더 위험하다.
`applyUpdateNode`(`:104`)는 노드가 존재하기만 하면 `setByPath` 를 그대로 부르고,
**`applyUpdateScreen`(`:165`)은 아무 검사도 하지 않는다** — 본문이 `return setByPath(screen, command.path, command.value)`
한 줄이다. 그런데 `setByPath`(`store/path.ts:27`)는 **없는 중간 경로를 만들어내며 항상 새 객체를 돌려준다.**

그래서 이런 Command 는 **no-op 이 아니라 "성공"으로 처리된다.**

```jsonc
{ "type": "updateScreen", "path": "root", "value": "없는id" }          // → root-missing
{ "type": "updateNode", "id": "title", "path": "typografy.fontSize", "value": 24 }  // 오타 → 쓰레기 필드가 생긴다
```

결과 스펙은 `validateProjectSpec` 기준으로 무효인데, `applied` 는 참조가 달라졌으므로 `history` 에 한 단계를 쌓고
캔버스가 그대로 다시 그린다. **지금 편집 경로에는 검증이 없다** — `validateProjectSpec` 을 부르는 곳은
Export/Save(`store/exportSpec.ts`)와 Open(`store/loadSpec.ts`), 그리고 자동저장 복원(`store/specStorage.ts`)뿐이다.

GUI 경로에서는 이 모드가 생기지 않는다 — 패널이 경로 문자열을 코드에 고정해 두기 때문이다
(`ui/properties/useNodeField.ts` 를 거치는 필드 28개). **자연어는 그 경로를 LLM 이 만든다.**

### 4.2 결정 — **관문 셋을 통과해야 스토어에 닿는다. 하나라도 걸리면 트랜잭션 전체를 버린다**

```
Command 배열(JSON)
   │
   ├─ G1  형태 검사      — Command 배열이 Command 스키마에 맞는가
   ├─ G2  dry-run       — 사본에 하나씩 적용하며 no-op 을 짚어낸다  (모드 A)
   ├─ G3  결과 검증      — 결과 ProjectSpec 이 validateProjectSpec 을 통과하는가 (모드 B)
   │
   ▼
스토어 커밋 = history 한 단계 (5절)
```

**G1 — Command 배열의 형태 검사.**
지금 Command 는 **TypeScript 타입일 뿐 런타임에 없다**(`command/types.ts`. 07 2절 "Command 스키마 v0.1" 행:
*"JSON Schema 정본 + 동결 절차를 거친 'v0.1로 고정'은 아직 아니다"*). 자연어 출력은 신뢰할 수 없는 입력이므로
IR 과 같은 방식(JSON Schema 정본 + Ajv)의 런타임 검사기가 필요하다. `ajv` 는 이미 `dependencies` 에 있다.
**이 관문을 만드는 일은 02가 말한 "Command 스키마 v0.1 고정"을 실제로 하는 일과 같은 작업이다.**

**G2 — dry-run.**
`applyTransaction`(`applyCommand.ts:203`)은 순수 함수라 스토어를 건드리지 않고 사본에 먼저 돌릴 수 있다.
다만 `applyTransaction` 을 그냥 부르면 "어느 Command 가 아무 일도 안 했는지"를 알 수 없다 —
**Command 를 하나씩 `applyCommand` 로 접으면서 `next === prev` 인 것을 기록**해야 모드 A 를 Command 단위로 짚어낸다.
그래야 *"3번째 명령이 아무 일도 하지 않았습니다"* 라고 말할 수 있다.

**이유 문자열은 지금 얻을 수 없다.** `applyCommand` 는 `ScreenSpec` 하나만 돌려주고 왜 no-op 인지는 말하지 않는다.
*"parentId 'sidebar' 가 frame 이 아닙니다"* 까지 보여주려면 호출부가 같은 조건을 다시 재거나,
`applyCommand` 옆에 이유를 함께 내는 함수를 따로 두어야 한다. **어느 쪽인지는 정하지 않았다** — 8절.

**G3 — 결과 검증.**
dry-run 결과 페이지를 끼운 `ProjectSpec` 을 `validateProjectSpec`(`schema/validate.ts:333`)에 넣는다.
**모드 B 를 막는 유일한 지점이다.** 무효면 트랜잭션 전체를 버린다 — 부분 적용하지 않는다.
`validateProjectSpec` 은 절대 예외를 던지지 않고 `issues` 배열을 돌려주므로([06-schema-freeze.md](06-schema-freeze.md)),
그 `issues` 를 그대로 실패 메시지의 근거로 쓴다.

**전부-또는-전무인 이유.** Command 열은 서로 의존한다(3.3의 5번·6번). 중간에서 멈추면 부모만 있고 자식이 없는
어중간한 화면이 남고, 사용자는 그걸 `undo` 로 지워야 한다. dry-run 이 순수 함수라 전부-또는-전무가 공짜다.

### 4.3 사용자에게 알리는 자리 — **한 곳으로만 낸다**

[07-implementation-status.md](07-implementation-status.md) 5.3 이 이미 적어 둔 문제가 있다 —
검증 실패를 알리는 방식이 경로마다 다르고(File > Export·Save 는 `console.warn` 만 남기고 조용히 취소,
Save as·Open 은 `window.alert`, 패널 하단 Export JSON 버튼은 인라인 문구), **가장 자주 쓸 File > Save 가
실패를 아예 안 알린다.**

**결정 — 자연어 경로는 이 문제를 반복하지 않는다. 알림은 자연어 입력창에 붙은 인라인 한 자리로만 낸다.**
`window.alert` 도 `console.warn` 도 쓰지 않는다.

- `alert` 를 안 쓰는 이유: 모달이라 03이 요구하는 `[되돌리기]` 버튼을 같은 자리에 놓을 수 없다
  (*"작은 변경 — 바로 적용하고 알림만 띄운다. `ProductGrid의 gap을 24px에서 16px로 변경했습니다. [되돌리기]`"*).
- `console.warn` 만 남기지 않는 이유: 5.3의 File > Save 가 지금 그 상태이고, 그게 5.3이 문제라고 적은 내용이다.

성공했을 때도 같은 자리에 한 줄을 낸다 — *"노드 3개를 추가했습니다. [되돌리기]"*.
이 `[되돌리기]` 는 5절의 `undo` 를 그대로 부른다.

**기존 네 경로를 통일하는 것은 이 작업의 범위가 아니다.** 5.3에 대응하는 이슈는 아직 없다(07 5.3).

---

## 5. 질문 4 — Undo 와의 관계

### 5.1 결정 — **자연어 요청 하나 = Undo 한 단계**

근거는 [03-user-flow.md](03-user-flow.md)가 이미 정해 뒀다 —
*"AI가 한 요청으로 여러 노드를 수정했다면 그 요청 전체를 하나의 트랜잭션으로 묶는다."*
그리고 `command/history.ts:10`–`:13` 과 `command/types.ts:74`–`:79` 의 주석이 같은 것을 코드 쪽에서 적어 뒀다.

사용자 관점에서도 이쪽이 맞다. 3.3의 화면 하나가 Command 6개인데 그게 undo 6단계면, 실수로 만든 화면을
지우려고 Ctrl+Z 를 여섯 번 눌러야 하고 중간 단계마다 반쪽짜리 화면이 캔버스에 뜬다.

### 5.2 **이미 있는 도구로 된다. 새 개념은 필요 없다**

필요한 재료가 전부 있다.

- `applyTransaction(screen, commands)`(`applyCommand.ts:203`) — Command 여러 개를 접어 `ScreenSpec` 하나를 만든다.
- `pushHistory(history, next)`(`history.ts:34`) — 스냅숏 한 단계를 쌓는다. `next === present` 면 안 쌓는다.
- `EditorSnapshot = { spec, activePageId }` 와 `makeSnapshot`(`editorStore.ts:203`) · `withPage`(`:187`) —
  스냅숏 생성자가 한 곳이다.

`history.ts:10`–`:13` 이 방법까지 적어 뒀다 —
*"applyTransaction으로 여러 Command를 먼저 다 적용한 뒤 그 결과 하나만 pushHistory에 넘기면 된다."*

스냅숏 방식이라 **Command 의 역연산을 정의할 필요가 없다**(`history.ts:5`–`:8`). 되돌릴 대상이 Command 열이 아니라
직전 `spec` 이므로, Command 종류가 늘어도 undo 코드는 안 바뀐다.

### 5.3 그래도 **스토어 액션 하나는 새로 필요하다**

지금 스토어의 편집 액션은 전부 `applied(state, pageId, command)`(`editorStore.ts:234`)를 거치는데
이 헬퍼는 **Command 하나 = history 한 단계**다. 그대로 여섯 번 부르면 undo 여섯 번이 된다.

**`continueEdit: true` 로 2번째 이후를 병합하는 방법은 쓰면 안 된다.**
`continueEdit` 은 `pushHistory` 대신 `replacePresent`(`history.ts:49`)를 부르는데, 이건 새 체크포인트를 만들지 않고
**직전 체크포인트를 덮어쓴다.** 트랜잭션의 첫 Command 가 no-op 이면 `applied` 가 `null` 을 돌려 체크포인트가
안 찍히고, 그다음 Command 가 `replacePresent` 로 **직전 *남의* 체크포인트를 덮어쓴다.**
[EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md)가 `useDraftInput` 의 **남은 결함**으로 적어 둔 것과 똑같은 모양이다.
게다가 `continueEdit` 은 설계상 *"그걸 실제로 아는 호출부만"* 판단하도록 만든 장치라, 트랜잭션 경계를 태우는 용도가 아니다.

**그래서 필요한 것은 액션 하나다.** 4절의 세 관문을 통과한 결과 페이지를 받아
`withPage` 로 `spec` 에 끼우고 → `makeSnapshot` 한 번 → `pushHistory` 한 번 하는 액션이다
(이름은 예: `applyTransaction(pageId, commands)`).

딸려오는 것:

- [EDITOR_STORE_CONTRACT.md](EDITOR_STORE_CONTRACT.md) §2 의 "계약의 전부 (16개)" 표가 **17개**가 된다.
  이 문서와 07의 `store/editorStore.ts` 행이 그 숫자를 함께 들고 있으므로 셋을 같이 고쳐야 한다.
- `redo` 도 대칭으로 동작한다 — 되돌린 자연어 요청 하나가 통째로 다시 실행된다. 추가 작업이 없다.
- 되돌린 편집이 다른 페이지에 있으면 캔버스가 그 페이지로 함께 옮겨 간다 — 스냅숏이 `activePageId` 를
  들고 있어서다(이슈 #131). 자연어 경로도 이 동작을 그대로 물려받는다.

### 5.4 열려 있는 것 — 여러 페이지를 건드리는 요청

`EditorSnapshot` 은 `spec` 전체를 들고 있으므로 **여러 페이지를 한 단계로 되돌리는 것 자체는 지금 구조로 된다.**
막는 것은 `applyTransaction` 의 단위(화면 한 장)뿐이다. 1차를 활성 페이지 한 장으로 한정하면(7절) 이 물음이 생기지 않는다.
한정을 풀 때 다시 다룬다.

---

## 6. 질문 5 — GUI 어디에 붙는가

### 6.1 문서가 이미 자리를 정해 뒀다

[04-gui-spec.md](04-gui-spec.md) §3 이 PRD 9장 도식을 그대로 싣고 있다.

```
├──────────┴──────────────────────────┴──────────────────┤
│ AI 입력: 선택한 요소를 어떻게 변경할까요?                  │
├────────────────────────────────────────────────────────┤
│ 변경 내역 / 구현 티켓 / Claude Code 실행 상태             │
└────────────────────────────────────────────────────────┘
```

같은 절이 성격도 못박는다 — *"AI 입력창은 단순 채팅창이 아니라 **현재 선택 상태와 결합된 명령창**이다."*

### 6.2 실제 코드의 레이아웃은 "5영역"이 아니다

`ui/EditorLayout.tsx:49` 를 읽고 확인했다. 셸은 **2행 3열 CSS Grid** 다.

```
grid-rows-[var(--layout-menubar-height)_1fr]
[grid-template-areas:'menu menu menu' 'tree canvas props']
```

`<Toolbar />` 는 그리드 행이 아니다 — **셸 위에 떠 있는 오버레이**다
(`ui/Toolbar.tsx:48` — `absolute bottom-4 left-1/2`. 셸이 `relative` 라 기준이 셸이다).
04 §3 이 "5개 영역"이라고 부르는 것 중 하단 도구 모음은 배치상 별개다.

### 6.3 결정 — **캔버스 아래 전폭 행을 새로 만든다. `EditorLayout.tsx` 를 바꿔야 한다**

- `grid-rows` 에 행 하나를 더하고(높이는 내용에 맞춰 `auto`), `grid-template-areas` 에 `'ai ai ai'` 를 더한다.
- **3열 전폭인 이유**: 03이 요구하는 "적용 대상"(선택 요소 / 현재 화면 / 전체 프로젝트) 표시와
  4.3의 결과·`[되돌리기]` 한 줄이 입력칸과 같은 자리에 들어가야 한다. 좌우 패널 폭 안에는 안 들어간다.
- 좌우 패널을 접을 때(`viewStore.showPanels`)도 이 행은 그대로 남는다 — 폭이 3열 전체라 컬럼 접힘에 영향받지 않는다.

**함께 손봐야 하는 것 — 도구 모음과 겹친다.**
`Toolbar` 의 `absolute bottom-4` 는 셸 기준이므로 새 행 위에 그대로 얹힌다. 도구 모음을 캔버스 영역 기준으로
바꾸거나 `bottom` 값을 새 행 높이만큼 올려야 한다. 그리고 **도구 모음은 캔버스를 맨 아래까지 스크롤하면 숨는다**
(`viewStore.canvasAtBottom` — `ui/Toolbar.tsx` 상단 주석이 아트보드 하단 리사이즈 핸들과 겹치는 문제를 설명한다).
그 숨김 동작이 새 행과 어떻게 맞물릴지는 **정하지 않았다** — 8절.

**버린 대안: 입력창도 오버레이로 띄우기.** `EditorLayout.tsx` 를 안 건드려도 되지만 도구 모음과 같은 바닥을 두고
다투게 되고, 숨김 동작까지 겹친다. 캔버스를 덮으면 편집 중인 화면의 아래쪽이 가려진다 —
04 §3 도식이 입력창을 캔버스 **아래**에 그린 이유가 그것으로 보인다.

### 6.4 1차에서 만들지 않는 자리

- **04 §3 도식의 두 번째 행**(변경 내역 / 구현 티켓 / Claude Code 실행 상태). Ticket Compiler 를 부르는 곳이
  아직 없고(07 1절 — *"이 코드를 실제로 부르는 곳이 없다"*), 실행 상태는 2.3의 (b) 를 택하면 에이전트 쪽에 있다.
  진행 중 표시는 입력창 안의 한 줄로 대신한다.
- **홈 화면의 "자연어로 초안 만들기"**(04 §2 상태 2). 그 상태 자체가 구현돼 있지 않다
  (07 2절 홈 화면 행 — *"상태 2(첫 실행 — 빈 상태와 세 갈래 선택지)는 없다"*).
- **캔버스 우클릭 컨텍스트 메뉴에서 자연어 부르기.** 커스텀 메뉴 UI 가 아직 없다
  (07 표의 `ui/EditorLayout.tsx` 행 — 브라우저 기본 메뉴를 막기만 한다, 이슈 #138).

---

## 7. 질문 6 — MVP 범위를 어디서 끊는가

02의 "MVP 포함 범위" 표는 `생성 | 자연어 화면 생성, 자연어 부분 수정, 직접 캔버스 편집` 셋을 함께 적었다.
셋째는 이미 동작한다(07 1절 localhost GUI · Canvas 행). 남은 둘의 순서를 정한다.

### 7.1 결정 — **자연어 부분 수정을 먼저 한다**

근거 셋.

1. **만들어야 할 Command 가 짧고, 만들 값도 적다.** 부분 수정은 대상 노드가 이미 있으므로 보통
   `updateNode`·`setLayout` 한둘이면 끝난다. 3.3이 실측한 대로 **생성은 노드 4개짜리 최소 화면이 이미 53칸**이다.
   출력이 길수록 4절의 관문에 걸릴 자리가 많아진다.
2. **범위가 저절로 좁혀진다.** 03의 적용 범위 기본값이 *"요소를 선택함 → 선택 요소"* 라
   `editorStore.selectedId` 가 대상을 이미 정해 준다. 생성은 "어디에, 무엇을, 어떤 순서로"가 전부 열려 있다.
3. **01 §4 의 대칭성을 가장 작은 코드로 실증한다.** `updateNode` 는 세부설정 패널이 지금 내고 있는 바로 그
   Command 다(`ui/properties/useNodeField.ts` → `editorStore.setNodeField` → `applied`). 자연어가 같은 Command 를
   내서 같은 화면이 바뀌는 것을 먼저 보이면, 생성은 그 위에 Command 종류를 넓히는 일이 된다.

그다음이 화면 생성이다. 4절의 검증·실패 파이프라인과 5절의 트랜잭션 커밋을 부분 수정으로 먼저 굳히고 나서
생성으로 넓힌다 — **둘 다 같은 파이프라인을 쓰므로 두 번 만들지 않는다.**

### 7.2 1차 구현에서 빼는 것

| 뺀 것 | 왜 |
|---|---|
| **페이지 단위 조작**(새 페이지 · 삭제 · 순서 변경) | Command 가 없다(3.4-(2)). 넣으려면 `applyCommand` 의 단위를 넘어서는 결정이 먼저 필요하다 — 8절 |
| **비활성 페이지 대상 요청** | Command 가 대상 페이지를 들고 있지 않다(3.4-(3)). **활성 페이지 한 장으로 한정한다** |
| **"전체 프로젝트" 적용 범위** | 03이 *"전체 프로젝트 변경은 위험하므로 자연어로 자동 판단하게 두지 않는다"* 고 적었다. 1차는 선택 요소 / 현재 화면 둘만 |
| **큰 변경의 계획 미리보기·승인** | 03이 명시적으로 허용했다 — *"MVP에서는 모든 요청을 계획 단계 없이 바로 적용하고 Undo로 대응해도 된다"* |
| **멀티턴 대화 맥락** | 요청 하나 = 트랜잭션 하나. 앞 요청을 기억하지 않는다. 03의 플로우 C(Conversation-first)는 이 위에 나중에 얹는다 |
| **자동 재시도 · 자가수정 루프** | 실패하면 사용자에게 보여주고 멈춘다(4.3). 재시도 횟수·비용 정책이 2.3의 매체 결정에 딸려 있다 |
| **image 노드 생성** | `src` 에 넣을 값을 만들 수 없다 — 워크스페이스 assets 저장소가 없고(06 "이 계약이 보장하지 않는 것"), Import 는 base64 data URI 로 우회 중이다(`ui/importImageFromFile.ts`) |
| **반응형 · 인터랙션 정의** | 스키마 제외 범위다([06-schema-freeze.md](06-schema-freeze.md), [05-schema.md](05-schema.md)). 03의 "기능(동작) 정의" 절도 *"IR 스키마 v0.1의 제외 범위"* 라고 적었다 |
| **자연어로 Ticket · 코드 생성 실행** | 01 §2 가 분리를 원칙으로 못박았다 — *"기본 동작은 자연어 요청 → 캔버스만 변경이고, 코드 반영은 사용자가 별도로 실행한다"* |

### 7.3 1차 완료 판정

- 노드를 고르고 *"간격을 24로 해줘"*, *"제목을 크게"* 같은 요청이 `updateNode`/`setLayout` 로 바뀌어
  캔버스에 반영된다.
- 잘못된 Command 가 오면 **적용되지 않고** 입력창 옆에 이유가 뜬다(4절). 모드 A·B 둘 다.
- Ctrl+Z 한 번이 그 요청 전체를 되돌린다(5절).
- 적용 대상이 입력창 위에 항상 보인다(03).

---

## 8. 사용자가 정해야 하는 것

**아래는 이 문서가 정하지 않은 것이다. 정한 것처럼 읽으면 안 된다.**

| # | 정해야 하는 것 | 이 문서의 입장 | 딸려오는 것 |
|---|---|---|---|
| 1 | **실행 주체 (a)/(b)/(c)** | **(b) 에이전트 경유를 추천한다**(2.3) | (b) 면 앱 ↔ 에이전트 전달 매체가 선행 조건이다. 이슈 #133 이 그 자리를 만들고 있으나 **그 내용은 확인하지 않았다** |
| 2 | **"자연어 화면 생성"의 해석** | 정하지 않았다 | **빈 페이지 채우기**로 읽으면 지금 Command 6종으로 된다(3.3). **새 페이지 만들기**로 읽으면 페이지 단위 Command 가 필요하고, 그건 `applyCommand` 의 단위(`ScreenSpec`)를 넘어선다(3.4-(2)) |
| 3 | **`CreateNodeCommand.index` 추가 여부** | 제안일 뿐이다(3.4-(1)) | Command 스키마 변경이다. 02의 "Command 스키마 v0.1 고정"과 06의 변경 절차를 어떻게 적용할지 함께 정해야 한다 |
| 4 | **Command 스키마를 JSON Schema 정본으로 고정할지** | G1 검사기를 만들려면 결국 필요하다(4.2) | 02가 이미 "v0.1로 고정한다"고 선언한 셋 중 하나인데 아직 TS 타입뿐이다(07 2절). 이 작업이 그 선언을 실제로 이행하는 일이 된다 |
| 5 | **no-op 이유 문자열을 누가 내는가** | 정하지 않았다(4.2 G2) | `applyCommand` 옆에 이유를 함께 내는 함수를 두는 안 / 호출부가 같은 조건을 다시 재는 안. 전자는 Command Engine 의 공개 표면이 넓어진다 |
| 6 | **자연어 입력창 행 추가에 따른 도구 모음 재배치** | 정하지 않았다(6.3) | `Toolbar` 의 `absolute bottom-4` 와 `canvasAtBottom` 숨김 동작이 새 행과 맞물리는 방식 |
| 7 | **기본값 채우기 계층을 둘지** | 제안이다(3.2) | 두면 LLM 출력이 짧아지고 검증 실패가 준다. 대신 "사용자가 말하지 않은 값을 도구가 고른다"는 동작이 생긴다 — `store/createNode.ts` 가 이미 도구 모음에 대해 하고 있는 일이긴 하다 |

---

## 9. 확인 방법과 확인하지 않은 것

### 9.1 이 문서가 인용한 사실을 재확인하는 방법

```bash
# Command 6종과 no-op 분기
sed -n '18,82p'  src/features/editor/command/types.ts
sed -n '84,205p' src/features/editor/command/applyCommand.ts

# 모드 B 의 근거 — updateScreen 은 아무 검사도 하지 않는다
sed -n '165,167p' src/features/editor/command/applyCommand.ts
sed -n '23,39p'   src/features/editor/store/path.ts

# Undo 재료
sed -n '1,51p'    src/features/editor/command/history.ts
sed -n '195,265p' src/features/editor/store/editorStore.ts

# 레이아웃 — 셸은 2행 3열, 도구 모음은 오버레이
sed -n '35,58p' src/features/editor/ui/EditorLayout.tsx
sed -n '44,50p' src/features/editor/ui/Toolbar.tsx

# 3.3 의 출발 상태와 목표
cat src/features/editor/store/blankSpec.ts
cat examples/login-screen.json

# 이미 있는 자연어 경로
cat skills/visual-spec-authoring/SKILL.md
```

이 문서가 만든 브랜치에서 `pnpm run lint` 가 통과한다(문서만 고쳤다).

### 9.2 확인하지 않은 것

**추측을 사실로 적지 않기 위해 여기에 모은다.**

- **3.3의 Command 열은 손으로 적고 `applyCommand.ts` 를 줄 단위로 따라가며 검증했다. 코드를 실행해
  결과를 `examples/login-screen.json` 과 비교하지는 않았다.** 이 작업은 코드를 쓰지 않는 설계 작업이라
  검증 스크립트를 만들지 않았다. 1차 구현은 이 열을 테스트 케이스로 먼저 고정하는 것으로 시작하면 된다.
- **LLM 이 실제로 이런 Command 열을 낼 수 있는지 시험하지 않았다.** 3.2의 기본값 계층 제안은
  "53칸을 적어야 한다"는 구조적 사실에서 나온 것이지, 실패를 관측해서 나온 것이 아니다.
- **이슈 #133(Vite 미들웨어로 `.visual-spec/` 연결)의 설계 내용을 확인하지 않았다.** 2.3에서
  "전달 매체가 필요하고 별도 작업으로 진행 중이다"까지만 적었다.
- **비용·지연 시간을 재지 않았다.** (a)와 (b)의 비교(2.2)는 구조상의 대가만 다룬다.
- **07 5.3의 네 경로(File > Export·Save·Save as·Open)를 통일하는 방법은 다루지 않았다.**
  4.3은 자연어 경로 자신만 정한다.
- **`skills/` 5종을 어떻게 고쳐야 하는지 정하지 않았다.** 2.3의 (b)를 택하면
  `skills/visual-spec-authoring/SKILL.md` 의 출력 형식과 도착지가 바뀌고
  `skills/visual-spec/SKILL.md` 의 분기표도 줄이 하나 는다.
  스킬 수정은 이 문서의 범위 밖이다.
