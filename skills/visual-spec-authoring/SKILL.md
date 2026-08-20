---
name: visual-spec-authoring
description: Visual Spec JSON 문서를 새로 쓰거나 기존 스펙 파일을 고칠 때 실행한다. "로그인 화면 스펙 만들어줘", "이 JSON에 카드 하나 더 넣어줘", "spec 파일 새로 써줘", "노드 추가해줘", "이 프레임 안에 텍스트 넣어줘", "examples에 있는 거 비슷하게 하나 만들어줘"처럼 Visual Spec 형태의 JSON 자체를 산출물로 요구하는 요청에서 쓴다. 이미 완성된 스펙을 React 코드로 옮기는 작업이나 검증 실패를 해석하는 작업은 대상이 아니다.
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

`examples/` 4개에서 반복되는 것들이다. 따르면 리뷰가 빨라진다.

- 트리는 평평한 `nodes` 맵 + `children: [{ "node": "id" }]` 참조로만 만든다. 노드 중첩은 없다.
- 루트 프레임은 `box: { "width": "fill", "height": "fill" }` 에 `background.color` 를 갖는다.
- `layout` 은 항상 5개 필드를 다 적는다. `gap: 0`, `padding` 사방 0도 생략하지 않고 명시한다.
- TextNode 의 `height` 는 예외 없이 `"auto"` 다. `width` 만 `"auto"`/`"fill"`/숫자로 고른다.
- `typography` 6개 필드도 전부 채운다. `fontFamily` 는 `"Pretendard"` 로 통일돼 있다.
- 노드 ID 는 `^[A-Za-z0-9_-]+$` 만 허용된다. 점·공백·한글을 넣지 않는다.
- 숨김 노드는 지우지 말고 `"visible": false` 로 둔다 (`examples/header-content.json`).

## 제약

v0.1 의 노드 타입은 **`frame` 과 `text` 둘뿐이다.** `image`, `button`, `input`, `component`
같은 타입을 지어내지 않는다. 표현할 수 없는 요구가 오면 프레임과 텍스트로 근사하고,
근사했다는 사실을 사용자에게 알린다.

필드 정의가 필요하면 정본 `src/features/editor/schema/visual-spec.schema.json` 을 읽는다.
찾는 방법은 [../visual-spec-docs/SKILL.md](../visual-spec-docs/SKILL.md) 에 있다.

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
