---
name: visual-spec-authoring
description: Visual Spec JSON 문서를 새로 쓰거나 기존 스펙 파일을 고칠 때 실행한다. "로그인 화면 스펙 만들어줘", "이 JSON에 카드 하나 더 넣어줘", "spec 파일 새로 써줘", "노드 추가해줘", "이 프레임 안에 텍스트 넣어줘", "examples에 있는 거 비슷하게 하나 만들어줘"처럼 Visual Spec 형태의 JSON 자체를 산출물로 요구하는 요청에서 쓴다. 이미 코드까지 만든 화면에 "버튼 색 바꿔줘", "제목 좀 크게" 처럼 후속 피드백이 오는 경우도 대상이다 — 코드가 아니라 원본 스펙 JSON을 고치고 재생성으로 넘긴다. 이미 완성된 스펙을 React 코드로 옮기는 작업이나 검증 실패를 해석하는 작업은 대상이 아니다.
---

# Visual Spec JSON 작성

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

## 뼈대

최소 유효 문서는 이 모양이다. 실물은 `examples/empty-title-screen.json` 이다.

```json
{
  "version": "0.1",
  "screen": {
    "name": "EmptyTitle",
    "size": { "width": 1440, "height": 900 },
    "root": "root",
    "nodes": {
      "root": {
        "type": "frame",
        "name": "Screen",
        "box": { "width": "fill", "height": "fill" },
        "layout": {
          "direction": "column",
          "gap": 0,
          "padding": { "top": 48, "right": 48, "bottom": 48, "left": 48 },
          "mainAxis": "center",
          "crossAxis": "center"
        },
        "background": { "color": "#FFFFFF" },
        "children": [{ "node": "title" }]
      },
      "title": {
        "type": "text",
        "name": "Title",
        "box": { "width": "auto", "height": "auto" },
        "content": "제목만 있는 빈 화면",
        "color": "#111111",
        "typography": {
          "fontFamily": "Pretendard",
          "fontSize": 32,
          "fontWeight": 700,
          "lineHeight": 40,
          "letterSpacing": -0.8,
          "textAlign": "center"
        }
      }
    }
  }
}
```

## 기존 예제가 지키는 관용구

`examples/` 7개에서 반복되는 것들이다. 따르면 리뷰가 빨라진다.

- 트리는 평평한 `nodes` 맵 + `children: [{ "node": "id" }]` 참조로만 만든다. 노드 중첩은 없다.
- 루트 프레임은 `box: { "width": "fill", "height": "fill" }` 에 `background.color` 를 갖는다.
- `layout` 은 항상 5개 필드를 다 적는다. `gap: 0`, `padding` 사방 0도 생략하지 않고 명시한다.
- TextNode 의 `height` 는 예외 없이 `"auto"` 다. `width` 만 `"auto"`/`"fill"`/숫자로 고른다.
- `typography` 6개 필드도 전부 채운다. `fontFamily` 는 `"Pretendard"` 로 통일돼 있다.
- 노드 ID 는 `^[A-Za-z0-9_-]+$` 만 허용된다. 점·공백·한글을 넣지 않는다.
- 숨김 노드는 지우지 말고 `"visible": false` 로 둔다 (`examples/header-content.json`).

## 제약

v0.1 의 노드 타입은 **`frame`, `text`, `image`, `button`, `input` 다섯뿐이다.** `component`
같은 타입은 여전히 없다 — 지어내지 않는다. 표현할 수 없는 요구가 오면 프레임과 텍스트로
근사하고, 근사했다는 사실을 사용자에게 알린다.

`ImageNode`는 `background`·`border`·`children`을 갖지 않는다(leaf 노드, `text`와 같은
성격). 필수 필드는 `type`(`"image"`), `name`, `box`, `src`(워크스페이스 assets를 가리키는
상대 경로 또는 assetId), `fit`(`"cover"`/`"contain"`/`"fill"`, CSS `object-fit`에 대응).
실물은 `examples/image-hero.json`이다.

`ButtonNode`/`InputNode`도 leaf 노드다. 둘 다 `text`처럼 `typography`·`color`가 필수고,
`background`·`border`는 선택이다. `ButtonNode`는 `content`(버튼 라벨, 빈 문자열 불가),
`InputNode`는 `placeholder`(빈 문자열 허용)가 각각 필수 텍스트 필드다. **둘 다 표시용
텍스트만 있다** — `onClick`·`value`·`onChange` 같은 이벤트·바인딩은 스키마에 없다("버튼
누르면 로그인" 같은 동작 요구는 표현할 수 없다고 알린다). 실물은 `examples/form-grid.json`이다.

`layout.direction`은 `"row"`/`"column"`/`"grid"` 셋이다. `"grid"`일 때만 `layout.columns`
(선택 필드, 열 개수)를 쓸 수 있다 — row/column에는 넣지 않는다. Grid는 균등 N열 자동
배치일 뿐 특정 자식을 특정 셀에 지정하는 기능은 없다(`mainAxis`/`crossAxis`도 무시된다).


스타일 효과는 전부 **선택 필드**다. 없으면 그리지 않는다 — 요구에 없으면 넣지 않는다.

| 필드 | 어디에 | 없을 때 |
|---|---|---|
| `shadow` | `frame`만 | 그림자 없음 |
| `opacity` | `frame`·`text`·`image` | `1`(불투명) |
| `blur` | `frame`·`text`·`image` | `0` |
| `border.align` | `Border` (`frame`·`button`·`input`) | `"inside"` |

`shadow`는 `x`·`y`·`blur`·`spread`·`color` **다섯 칸을 모두** 적는다. 한 칸이라도 빠지면
검증에서 걸린다. `border.radius`는 숫자 하나(네 모서리 같음) 또는
`{topLeft, topRight, bottomRight, bottomLeft}` 네 칸 전부다 — 섞어 쓰거나 일부만 적지 않는다.

`shadow`를 `text`에 넣지 않는다. 글자 모양을 따라가는 그림자는 성격이 달라 스키마에 없다.
`button`·`input`에는 `shadow`·`opacity`·`blur`가 아직 없다(`border.align`·`radius`는 있다).
실물은 `examples/card-effects.json`이다.
필드 정의가 필요하면 정본 `src/features/editor/schema/visual-spec.schema.json` 을 읽는다.
찾는 방법은 [../visual-spec-docs/SKILL.md](../visual-spec-docs/SKILL.md) 에 있다.

## 이미 코드로 만든 화면에 피드백이 왔을 때

`visual-spec-to-react` 로 코드까지 만든 화면에 "버튼 색 바꿔줘", "제목 좀 크게" 같은 후속
피드백이 오면 **코드가 아니라 이 스펙 JSON을 고친다.** 코드를 직접 손대면 다음에
재생성할 때 그 수정이 사라지고, JSON과 코드가 서서히 어긋나기 시작한다 — JSON이
source of truth라는 전제가 깨진다.

1. 피드백이 가리키는 원본 스펙 파일을 찾는다. 대화에서 바로 안 나오면 사용자에게 묻는다.
2. 위 뼈대·관용구·제약을 그대로 따라 그 파일의 JSON을 고친다.
3. 검증한다 (아래 "다 쓴 뒤").
4. [../visual-spec-to-react/SKILL.md](../visual-spec-to-react/SKILL.md) 로 넘겨 재생성한다.
   코드는 여기서 직접 쓰지 않는다.

## 자주 틀리는 지점

`examples/invalid/` 8개가 실제로 나오는 실수 목록이다.

- `children` 에 적은 ID 를 `nodes` 에 안 만든다 → `child-missing`
- 노드를 만들어놓고 어느 `children` 에도 안 넣는다 → `orphan-node`
- 노드를 복사하면서 참조만 늘려 두 부모가 같은 자식을 가리킨다 → `multiple-parents`
- 자식이 조상을 다시 참조한다 → `cycle`
- `screen.root` 를 실제 키와 다르게 적는다 → `root-missing`
- 루트를 `text` 로 만든다 → `root-not-frame`
- TextNode 에 `content` 를 빠뜨린다 → `text-without-content`
- 없는 `type` 을 쓴다 → `unsupported-node-type`

## 다 쓴 뒤

**반드시 검증한다.** 검증 없이 완료라고 말하지 않는다.

```ts
import { validateVisualSpec } from "@/features/editor/schema";
```

`valid: false` 면 [../visual-spec-validate/SKILL.md](../visual-spec-validate/SKILL.md) 로 넘어간다.
