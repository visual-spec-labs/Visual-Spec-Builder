---
name: visual-spec-validate
description: Visual Spec 을 검증하거나, 검증이 실패해 issues 를 해석하고 고쳐야 할 때 실행한다. "검증 실패했는데 뭐가 문제야", "valid 가 false 로 나와", "필수 필드 "content"가 없습니다", "필수 필드 "src"가 없습니다", "허용되지 않는 필드 "typography"가 있습니다", "정의된 대안 스키마 중 어느 것과도 일치하지 않습니다", "값이 "image"이어야 합니다", "루트에서 도달할 수 없습니다", "가 nodes에 없습니다", "두 곳 이상에서 참조되었습니다", "이 스펙 왜 안 되지", "VisualSpecValidationError 떴어"처럼 validateVisualSpec 의 실패 결과나 code/path/message 를 들고 오는 요청에서 쓴다. 아직 실패하지 않았어도 "스펙 검증해줘", "이 JSON 맞게 쓴 건지 확인해줘", "스펙 다 썼는데 이제 어떻게 해", "이슈가 12개 나왔는데 다 고쳐야 해"처럼 검증을 돌려달라거나 결과를 판단해달라는 요청, 스펙을 저장·변환하려다 검증에서 막혔을 때도 대상이다. 특히 한 노드에서 schema 이슈가 여러 개 쏟아져 어느 message 를 믿어야 할지 안 보일 때 쓴다.
---

# 검증 실패 해석과 수정

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

```ts
import { validateVisualSpec } from "@/features/editor/schema";
const { valid, issues } = validateVisualSpec(spec); // issues: { code, path, message }[]
```

## 먼저 알아야 할 것 — issues 만 봐서는 모르는 규칙

- **`code: "schema"` 의 `message` 는 어느 필드인지 말해주지만, 대부분은 탈락한 갈래의
  추측이다.** 노드 스키마가 `frame`·`text`·`image`·`button`·`input` 다섯을 `oneOf` 로 묶고
  있어 검증기가 **다섯 갈래**를 각각 대본 뒤 실패 이유를 전부 낸다. 갈래마다
  `필수 필드 …가 없습니다.` `허용되지 않는 필드 …가 있습니다.` 가 따로 나오므로, 노드
  하나가 틀려도 이슈는 열 개를 넘기 일쑤다. 갈래별 잡음 개수는 노드가 그 타입과 얼마나
  비슷한 모양이냐에 달려 있다 — `color`·`typography`는 `text`·`button`·`input` 셋 다
  허용해서 그 사이에서는 "허용되지 않는 필드" 잡음이 안 생긴다. 균등하게 나온다고
  가정하지 않는다.
- **탈락한 갈래는 `.../type` 의 `값이 "X"이어야 합니다.` 로 찾는다. 살아남은 갈래는 그 메시지가
  없는 갈래다.** 이것이 잡음을 걷어내는 유일한 신호다. 같은 노드 `path` 에
  `값이 "frame"이어야 합니다.` 가 있으면 그 노드는 `frame` 갈래에서 탈락한 것이므로 그 갈래가 낸
  이슈는 전부 잡음이다. **살아남은 갈래가 낸 이슈만 믿는다.**
  `text-without-content.json` 은 이슈 **16개**를 내는데 `.../type` 이슈가 `"frame"`(5번째),
  `"image"`(11번째), `"button"`(13번째), `"input"`(15번째) 넷뿐이다 — `"text"` 가 없으니
  `text` 갈래가 살아남았고, 진짜는 그 갈래가 낸 **6번째** `필수 필드 "content"가 없습니다.`
  하나다. 나머지 15개는 `frame` 갈래 5개(1~5번째), `image` 갈래 5개(7~11번째), `button`
  갈래 2개(12~13번째), `input` 갈래 2개(14~15번째), 맨 끝 `oneOf` 요약 1개(16번째)다.
  `button`·`input` 갈래가 2개뿐인 건 이 노드가 이미 `typography`·`color`를 갖고 있어
  "허용되지 않는 필드" 잡음이 안 생기고 필수 필드 누락(`content`/`placeholder`)과
  타입 불일치만 남기 때문이다.
- **`.../type` 에 다섯 값(`"frame"`·`"text"`·`"image"`·`"button"`·`"input"`)이 전부
  나오면 갈래가 전멸한 것이다.** 그때는 개별 필드가 아니라 `type` 자체가 틀렸고, 그 다섯
  메시지에 적힌 값이 v0.1 의 허용값 전부다. `unsupported-node-type.json`(`type: "shape"`)이
  이 모양으로 19개를 낸다.
- **맨 끝의 `정의된 대안 스키마 중 어느 것과도 일치하지 않습니다.` 는 원인이 아니라 요약이다.**
  `oneOf` 가 실패했다는 사실만 말한다. 같은 `path` 의 다른 이슈로 되돌아가서 읽는다.
- **`schema` 이슈 개수는 심각도가 아니다.** 노드 하나가 틀리면 `oneOf` 분기마다 이슈가
  생겨 15~19개가 쏟아질 수 있다. 실수는 보통 하나다. `path` 를 중복 제거하고 그 노드만 본다.
- **스키마 검증에 실패하면 구조 검사는 아예 돌지 않는다.** `schema` 이슈가 있으면 그것만
  고치고 다시 돌린다. 남은 문제는 그다음에 보인다.
- **`root-missing` 이면 `orphan-node` 검사를 건너뛴다.** 출발점이 없으면 모든 노드가 도달
  불가가 되어 진짜 원인이 잡음에 묻히기 때문이다. `cycle` 이 있을 때도 마찬가지다.
  고아 노드가 없다고 보고된 게 아니라 **아직 안 본 것**이다. 루트/순환을 고치고 재검증한다.
- **`multiple-parents` 의 `path` 는 두 번째 참조 위치다.** 첫 번째 참조는 이슈에 안 나온다.
  해당 ID 를 전체 검색해 어느 쪽을 남길지 정한다.

## 실패 분류와 수정 (`examples/invalid/` 와 1:1)

| code | 어떤 실수인가 | 어떻게 고치나 |
|---|---|---|
| `child-missing` | `children` 에 ID 를 적고 노드 정의를 안 만들었다. 오타이거나 만들다 말았다 | `nodes` 에 그 ID 를 추가하거나, 참조를 지운다 |
| `orphan-node` | 노드는 만들었는데 어느 `children` 에도 안 넣었다. 삭제하다 참조만 지운 경우가 많다 | 부모의 `children` 에 `{ "node": "id" }` 를 넣거나, 노드를 지운다 |
| `multiple-parents` | 노드를 복사하면서 정의는 안 늘리고 참조만 늘렸다 | 사본 노드를 새 ID 로 만들어 한쪽을 그쪽으로 바꾼다 |
| `cycle` | 자식이 조상을 다시 참조한다. 이동 작업에서 부모/자식을 뒤집으면 생긴다 | `path` 가 가리키는 참조를 끊는다 |
| `root-missing` | `screen.root` 값이 `nodes` 의 키와 다르다 | 둘 중 하나를 상대에 맞춘다 |
| `root-not-frame` | 루트를 `text` 로 만들었다. 텍스트 한 줄짜리 화면에서 자주 나온다 | 루트 프레임을 만들고 그 텍스트를 자식으로 넣는다 |
| `schema` at `.../<node>` (`text-without-content`) | TextNode 에 `content` 가 없다. **필수 필드 누락은 전부 이 모양으로 나온다.** 이슈 16개 중 6번째 `필수 필드 "content"가 없습니다.` 만 진짜고 나머지는 `frame`·`image`·`button`·`input` 갈래의 잡음이다 | 정본 스키마의 `required` 와 그 노드를 대조해, `message` 가 지목한 빠진 필드를 채운다 |
| `schema` at `.../<node>/type` (`unsupported-node-type`) | `shape` 처럼 v0.1 에 없는 `type` 을 썼다. `값이 "frame"`·`"text"`·`"image"`·`"button"`·`"input"` 다섯 이슈가 **함께** 나오는 것이 신호다 | 그 다섯 메시지의 값이 허용값 전부다 — v0.1 은 `frame`, `text`, `image`, `button`, `input` 다섯뿐이다. 다섯 중 가장 가까운 것으로 근사한다 |

## 절차

1. `code: "schema"` 가 하나라도 있으면 그것부터. `path` 를 중복 제거해 대상 노드를 좁힌다.
2. 그 노드의 실제 `type` 값을 확인하고, `.../type` 의 `값이 "X"이어야 합니다.` 로 탈락한
   갈래를 지운다. **다섯 갈래(`frame`·`text`·`image`·`button`·`input`) 중 그 메시지가 나오지
   않은 하나가 살아남은 갈래다.** 남은 이슈의 `message` 가 가리키는 필드가 고칠 대상이다.
   다섯 개가 전부 나왔으면 갈래가 전멸한 것이니 `type` 부터 고친다.
3. 그 노드를 정본 `src/features/editor/schema/visual-spec.schema.json` 의 `required` 및
   `additionalProperties: false` 와 눈으로 대조한다. 정의를 외워서 판단하지 않는다.
4. 고칠 때마다 다시 검증한다. 가려져 있던 이슈가 새로 나타나는 것이 정상이다.
5. `valid: true` 가 될 때까지 반복한다. 이슈가 줄었다는 것만으로 완료라고 말하지 않는다.

수정 중 스펙을 새로 써야 하면 [../visual-spec-authoring/SKILL.md](../visual-spec-authoring/SKILL.md) 를,
스키마 원문을 찾아야 하면 [../visual-spec-docs/SKILL.md](../visual-spec-docs/SKILL.md) 를 연다.
