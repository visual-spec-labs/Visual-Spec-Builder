---
name: visual-spec-nl-response
description: Visual Spec Builder GUI가 `.visual-spec/runtime/nl-request.json`을 써 뒀을 때 실행한다 — 그 파일이 있다는 것 자체가 트리거다. "GUI에서 보낸 요청 처리해줘", "nl-request 봐줘", "자연어 편집창에 뭐 입력했어" 처럼 GUI의 자연어 입력창(NaturalLanguageBar)이 보낸 요청에 응답해야 할 때, 또는 사용자가 Visual Spec GUI를 띄워 두고 "화면 만들어줘"/"이 버튼 색 바꿔줘" 같은 요청을 GUI 안에서 이미 입력한 상황에서 쓴다. **GUI 밖에서** 스펙 JSON 파일 자체를 쓰거나 고쳐 달라는 요청(`examples/*.json`, `.visual-spec/specs/*.json`을 직접 겨냥)은 [visual-spec-authoring](../visual-spec-authoring/SKILL.md) 대상이지 이 스킬 대상이 아니다 — 산출물이 파일 전체인지 Command 배열인지로 가른다.
---

# 자연어 요청에 Command로 응답하기

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

## 이 스킬과 `visual-spec-authoring`의 차이

둘 다 "자연어 → Visual Spec"이지만 산출물과 도착지가 다르다.

| | `visual-spec-authoring` | 이 스킬 |
|---|---|---|
| 산출물 | 스펙 JSON **문서 전체** | **Command 배열**(부분) |
| 도착지 | 파일(`examples/*.json`, `.visual-spec/specs/`) | `.visual-spec/runtime/nl-response.json` |
| 트리거 | 파일을 콕 집어 "이 JSON 고쳐줘" | GUI가 `nl-request.json`을 써 둔 상태 |
| Undo | 없음(파일을 덮어씀) | GUI의 Undo 스택에 한 단계로 들어감 |

노드 타입 5종 제약, `examples/`가 지키는 관용구, `examples/invalid/`가 보여주는 자주 틀리는
지점 같은 **Visual Spec 자체의 지식은 여기서 다시 적지 않는다** —
[visual-spec-authoring](../visual-spec-authoring/SKILL.md)이 이미 갖고 있고, 이 스킬이 만드는
Command의 `node`/`layout`/`value` 필드도 결국 그 지식을 그대로 따라야 한다. 모르면 그 스킬을
먼저 읽는다.

## 핸드셰이크

```
GUI (NaturalLanguageBar)                     너(에이전트)
 │ PUT .visual-spec/runtime/nl-request.json ──▶ (읽는다)
 │                                              Command 배열을 만든다
 │ GET nl-response.json 폴링 ◀────────────────  PUT .visual-spec/runtime/nl-response.json
 │  (최대 3분, 1초 간격)
 ▼
G1(Command 스키마) → G2·G3(dry-run·결과 검증, 전부-또는-전무) → 스토어 커밋, Undo 한 단계
```

**너는 G1–G3를 통과시킬 책임이 없다** — GUI가 응답을 받으면 세 관문을 전부 코드로 돌린다.
잘못된 Command를 보내도 앱이 깨지지 않고, 이유가 붙어 사용자에게 인라인으로 뜨며, 다음
요청 때 다시 시도할 수 있다. 그래도 관문을 통과하는 Command를 만드는 게 목표다 — 아래
"자주 틀리는 지점"을 지키면 대개 통과한다.

## 요청 읽기 — `nl-request.json`

정본 타입은 `src/features/editor/nl/nlProtocol.ts`의 `NlRequest`다. 저장소 소스에 접근할
수 없으면(설치된 스킬만 있는 대상 프로젝트) 아래 표가 그 계약이다.

| 필드 | 뜻 |
|---|---|
| `protocol` | 형식 버전. 지금은 `1`. 응답에도 **그대로** 돌려줘야 한다 |
| `id` | 이 요청의 식별자. 응답에는 이 값을 `requestId`라는 **다른 이름**으로 돌려준다(아래 참고) |
| `instruction` | 사용자가 입력창에 적은 자연어 원문 |
| `scope` | 적용 대상. `{ kind: "node" \| "screen", nodeId: string \| null, label: string }` — `kind`가 `"node"`면 `nodeId`가 그 노드, `"screen"`이면 `nodeId`는 `null`이고 화면 전체가 대상이다 |
| `pageId` | 대상 페이지 id (참고용 — Command 자체에는 페이지 개념이 없다) |
| `page` | 대상 페이지의 **현재 스펙 전체**(`ScreenSpec` — `name`·`size`·`root`·`nodes`). 노드 id와 현재 값은 전부 여기서 읽는다. **추측하지 않는다** |
| `responsePath` | 응답을 써야 할 경로. 지금은 항상 `.visual-spec/runtime/nl-response.json`이지만, 문서 대신 이 값을 신뢰한다 |

`scope.kind === "node"`면 요청은 그 노드(와 필요하면 그 자손)만 겨냥한다. `page.nodes`에서
`scope.nodeId`를 찾아 지금 값을 확인하고 시작한다. `"screen"`이면 화면 전체가 대상이고,
빈 화면(`page.nodes`에 `root` 하나뿐)이면 "화면을 만들어줘" 같은 생성 요청이다.

## 응답 만들기 — Command 배열

Command 6종(`createNode`·`updateNode`·`deleteNode`·`moveNode`·`setLayout`·`updateScreen`)의
정확한 필드는 [09-command-schema-freeze.md](../../docs/09-command-schema-freeze.md)와
`src/features/editor/command/types.ts`가 정본이다. 요약:

| Command | 필드 | 언제 쓰나 |
|---|---|---|
| `createNode` | `parentId`·`id`·`node`(완전한 Node)·`index?`(선택, 이슈 #193 — 생략하면 끝에 붙음) | 새 노드 추가. **부모가 먼저 만들어져 있어야 한다** — Command 순서가 부모→자식이어야 한다 |
| `updateNode` | `id`·`path`(점 표기, 예: `"layout.gap"`)·`value` | 기존 노드의 필드 하나를 바꾼다 |
| `deleteNode` | `id` | 노드(와 자손)를 지운다. `root`는 지울 수 없다 |
| `moveNode` | `id`·`newParentId`·`index` | 노드를 다른 부모나 다른 위치로 옮긴다 |
| `setLayout` | `id`·`layout`(완전한 Layout 객체) | frame의 레이아웃을 통째로 갈아 끼운다. frame 아닌 노드에는 no-op |
| `updateScreen` | `path`·`value` | 페이지 자신의 필드(`name`·`size`)를 바꾼다. 노드를 가리키지 않는다 |

새 노드마다 고유한 `id`를 만든다(패턴 `^[A-Za-z0-9_-]+$`) — `page.nodes`에 이미 있는 키와
겹치면 안 된다. `parentId`로 쓸 노드는 **frame이어야 한다**(text·image·button·input은 자식을
못 받는다).

### `createNode`는 자식 배열을 스스로 채우지 않는다

`createNode`를 적용하면 GUI가 **부모의 `children` 끝에 `{ "node": 새id }`를 자동으로 덧붙인다.**
`node.children`에 미리 자식 참조를 적어 넣으면 안 된다 — 그 시점에 자식이 아직
`nodes`에 없어 검증에서 `child-missing`으로 잡힌다. `frame`을 만들 땐 항상
`"children": []`로 시작하고, 자식은 그 뒤에 오는 `createNode` Command가 채운다(부모 →
자식 순서).

## 새 노드의 기본값 — 복사해서 쓰는 표

이 표는 앱 내부의 `store/createNode.ts`가 도구 모음·기본값 채우기 계층에 쓰는 값과
같다(이슈 #182). **다만 응답 JSON 자체는 이 함수를 거치지 않는다** — 네가 쓰는
`nl-response.json`의 `node`는 스키마가 요구하는 **완전한 Node**여야 하고, 앱이 나중에
필드를 채워 주지 않는다. 이 표는 "무엇을 생략해도 되는가"가 아니라 **"매번 새로 디자인하지
않도록 그대로 복사해 쓸 기본값"**이다. 요청이 구체적인 스타일을 말하면(색·크기 등) 그 값으로
바꾼다.

**frame**
```json
{ "type": "frame", "name": "Frame",
  "box": { "width": 200, "height": 120 },
  "layout": { "direction": "column", "gap": 8,
              "padding": { "top": 16, "right": 16, "bottom": 16, "left": 16 },
              "mainAxis": "start", "crossAxis": "start" },
  "background": { "color": "#FFFFFF" },
  "border": { "width": 1, "color": "#E5E7EB", "radius": 8 },
  "children": [] }
```

**text**
```json
{ "type": "text", "name": "Text",
  "box": { "width": "auto", "height": "auto" },
  "content": "텍스트", "color": "#111111",
  "typography": { "fontFamily": "Pretendard", "fontSize": 16, "fontWeight": 400,
                   "lineHeight": 24, "letterSpacing": 0, "textAlign": "left" } }
```

**button**
```json
{ "type": "button", "name": "Button",
  "box": { "width": 120, "height": 40 },
  "content": "버튼", "color": "#FFFFFF",
  "typography": { "fontFamily": "Pretendard", "fontSize": 14, "fontWeight": 600,
                   "lineHeight": 20, "letterSpacing": 0, "textAlign": "center" },
  "background": { "color": "#4F46E5" },
  "border": { "width": 0, "color": "#4F46E5", "radius": 8 } }
```

**input**
```json
{ "type": "input", "name": "Input",
  "box": { "width": 200, "height": 44 },
  "placeholder": "입력하세요", "color": "#111827",
  "typography": { "fontFamily": "Pretendard", "fontSize": 14, "fontWeight": 400,
                   "lineHeight": 20, "letterSpacing": 0, "textAlign": "left" },
  "background": { "color": "#F9FAFB" },
  "border": { "width": 1, "color": "#D1D5DB", "radius": 8 } }
```

**image** — `src`는 실제 워크스페이스 asset이 있을 때만 그 상대 경로를 쓴다. 없으면
1×1 투명 PNG data URI로 자리만 잡는다(사용자가 나중에 Import로 교체한다).
```json
{ "type": "image", "name": "Image",
  "box": { "width": 200, "height": 150 },
  "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "fit": "cover" }
```

## 응답 쓰기

`responsePath`(보통 `.visual-spec/runtime/nl-response.json`)에 **덮어쓰기**로 쓴다. 파일
이름을 요청마다 바꾸지 않는다 — GUI는 `requestId`로 자기 요청의 답인지만 확인한다.

**성공**
```json
{ "protocol": 1, "requestId": "<요청의 id 값>", "commands": [ /* Command 배열 */ ] }
```

**못 하겠을 때** — 표현할 수 없는 요구(예: `onClick` 동작, `component` 타입, 새 페이지
생성)이거나 요청이 모호하면 `commands` 대신 `error`를 쓴다. `commands: []`는 쓰지 않는다 —
Transaction은 Command가 최소 1개 필요하다(스키마가 거부한다).
```json
{ "protocol": 1, "requestId": "<요청의 id 값>", "error": "버튼 클릭 동작은 표현할 수 없습니다 — v0.1은 표시용 텍스트만 지원합니다" }
```

`requestId`는 **요청의 `id` 필드 값을 그대로** 넣는다(필드 이름이 바뀌는 걸 놓치기 쉽다 —
요청은 `id`, 응답은 `requestId`). `protocol`이 다르거나 `requestId`가 안 맞으면 GUI가 응답을
무시하고 계속 기다린다(낡은 응답을 이번 요청의 답으로 오인하지 않기 위해서다) — 답을 냈는데
GUI가 계속 "기다리는 중"이면 이 둘부터 확인한다.

## 자주 틀리는 지점

`visual-spec-authoring`의 "자주 틀리는 지점"(child-missing·orphan-node·cycle 등)이 여기도
그대로 적용된다. 이 경로에서만 추가로 나는 실수:

- **부모보다 먼저 자식을 만든다.** `createNode`는 부모가 `page.nodes`(또는 이 응답의 앞선
  `createNode`)에 이미 있어야 한다 — 순서가 위→아래(부모→자식)여야 한다
- **`children`을 미리 채운다.** 위 "`createNode`는 자식 배열을 스스로 채우지 않는다" 참고
- **`scope.kind === "node"`인데 다른 노드를 고친다.** 사용자가 요소를 선택한 채 요청했다는
  뜻이다 — `scope.nodeId`가 가리키는 노드(또는 그 안쪽)만 건드린다
- **`page`를 안 읽고 값을 추측한다.** 지금 `layout.gap`이 얼마인지, 어떤 자식이 있는지는
  전부 요청에 실려 온 `page`에서 읽는다 — 기억이나 예시로 채우지 않는다
- **`updateScreen`으로 노드를 고치려 한다.** `updateScreen`은 페이지 자신의 필드(`name`·
  `size`)만 바꾼다. 노드는 `updateNode`다
- **삽입 위치가 필요한데 `index`나 `moveNode`를 안 쓴다.** `createNode`는 `index`를
  생략하면 끝에 붙는다. "맨 위에 넣어줘"처럼 위치가 중요하면 `createNode`의 `index`를
  쓰거나, `createNode` 뒤에 `moveNode`를 붙인다

## 다 쓴 뒤

파일에 쓰는 것으로 끝이다 — 검증은 GUI가 G1–G3로 한다. 실패하면 사용자가 다시 요청하거나
너에게 이유를 들고 돌아온다(입력창 옆 인라인 메시지에 뜬다). 스스로
`validateVisualSpec`/`validateProjectSpec`을 불러 미리 확인해도 좋지만(특히 노드가 많은 생성
요청), 필수는 아니다.

## 예제 — 짧은 부분 수정

요청: *"제목을 좀 더 크게 해줘"*, `scope: { kind: "node", nodeId: "title", ... }`,
`page.nodes.title.typography.fontSize`가 지금 24.

```json
{ "protocol": 1, "requestId": "req-abc",
  "commands": [
    { "type": "updateNode", "id": "title", "path": "typography.fontSize", "value": 32 }
  ] }
```

## 예제 — 빈 화면 생성

요청: *"로그인 화면 만들어줘"*, `scope: { kind: "screen", nodeId: null, ... }`,
`page.nodes`에 `root`(빈 frame) 하나뿐. `docs/08-natural-language.md` 3.3이 이 예제를 손으로
짚어 본 것과 같다 — Command 6개, 3종(`updateScreen`·`setLayout`·`createNode`)만으로 충분하다.

```json
{ "protocol": 1, "requestId": "req-xyz",
  "commands": [
    { "type": "updateScreen", "path": "name", "value": "Login" },
    { "type": "updateScreen", "path": "size", "value": { "width": 390, "height": 844 } },
    { "type": "setLayout", "id": "root",
      "layout": { "direction": "column", "gap": 16,
                  "padding": { "top": 24, "right": 20, "bottom": 24, "left": 20 },
                  "mainAxis": "start", "crossAxis": "stretch" } },
    { "type": "createNode", "parentId": "root", "id": "title",
      "node": { "type": "text", "name": "Title",
                "box": { "width": "fill", "height": "auto" },
                "content": "로그인", "color": "#111111",
                "typography": { "fontFamily": "Pretendard", "fontSize": 24, "fontWeight": 700,
                                "lineHeight": 32, "letterSpacing": -0.5, "textAlign": "left" } } },
    { "type": "createNode", "parentId": "root", "id": "card",
      "node": { "type": "frame", "name": "Card",
                "box": { "width": "fill", "height": "auto" },
                "layout": { "direction": "column", "gap": 12,
                            "padding": { "top": 16, "right": 16, "bottom": 16, "left": 16 },
                            "mainAxis": "center", "crossAxis": "stretch" },
                "background": { "color": "#F5F5F5FF" },
                "border": { "width": 1, "color": "#00000020", "radius": 8 },
                "children": [] } },
    { "type": "createNode", "parentId": "card", "id": "hint",
      "node": { "type": "text", "name": "Hint",
                "box": { "width": "auto", "height": "auto" },
                "content": "계정 정보를 입력하세요", "color": "#666666",
                "typography": { "fontFamily": "Pretendard", "fontSize": 14, "fontWeight": 400,
                                "lineHeight": 20, "letterSpacing": 0, "textAlign": "center" } } }
  ] }
```

## 표현할 수 없는 것

[visual-spec-authoring](../visual-spec-authoring/SKILL.md)의 v0.1 제약(노드 타입 5종,
`onClick`/`value`/`onChange` 없음)에 더해 이 경로만의 제약이다(`docs/08-natural-language.md`
7.2):

- 새 **페이지** 생성 — `applyCommand`는 페이지 한 장(`ScreenSpec`) 단위만 안다
- 비활성 페이지 대상 요청·"전체 프로젝트" 범위 — 대상은 항상 `pageId`가 가리키는 활성
  페이지 하나뿐이다
- 계획 미리보기·승인 — 받은 Command는 바로 적용된다(Undo로 대응)
- 멀티턴 대화 맥락 — 요청마다 `page`가 그 시점의 전체 스펙을 새로 실어 오므로, 이전 요청을
  "기억"할 필요도 방법도 없다

표현할 수 없는 요구가 오면 `error`로 답하고 왜 안 되는지 짧게 적는다 — 근사해서 조용히
다른 걸 만들지 않는다.
