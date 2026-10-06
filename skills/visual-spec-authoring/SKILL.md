---
name: visual-spec-authoring
description: Visual Spec JSON 문서를 새로 쓰거나 기존 스펙 파일을 고칠 때 실행한다. "로그인 화면 스펙 만들어줘", "이 JSON에 카드 하나 더 넣어줘", "spec 파일 새로 써줘", "노드 추가해줘", "이 프레임 안에 텍스트 넣어줘", "examples에 있는 거 비슷하게 하나 만들어줘"처럼 Visual Spec 형태의 JSON 자체를 산출물로 요구하는 요청에서 쓴다. 이미 코드까지 만든 화면에 "버튼 색 바꿔줘", "제목 좀 크게" 처럼 후속 피드백이 오는 경우도 대상이다 — 코드가 아니라 원본 스펙 JSON을 고치고 재생성으로 넘긴다. 이미 완성된 스펙을 React 코드로 옮기는 작업이나 검증 실패를 해석하는 작업은 대상이 아니다.
---

# Visual Spec JSON 작성

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

## 뼈대

최소 유효 문서는 이 모양이다. 실물은 `examples/empty-title-screen.json` 이다(사용자 프로젝트에서는 함께 설치된 `../visual-spec/contract/examples/`).

```json
{
  "version": "0.3",
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
        "background": [{ "type": "solid", "color": "#FFFFFF" }],
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

`examples/` 의 화면 문서 8개에서 반복되는 것들이다. 따르면 리뷰가 빨라진다.

- 트리는 평평한 `nodes` 맵 + `children: [{ "node": "id" }]` 참조로만 만든다. 노드 중첩은 없다.
- 루트 프레임은 `box: { "width": "fill", "height": "fill" }` 에 단색 한 겹 배경
  `"background": [{ "type": "solid", "color": "#…" }]` 을 갖는다.
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

`background`(`frame`·`button`·`input`)는 **채우기 겹의 배열**이다 — 문서 버전 `"0.3"`부터.
단색은 `[{ "type": "solid", "color": "#RRGGBB" }]` 처럼 한 겹짜리 배열로 쓴다. 0.2까지의
객체 모양 `{ "color": "#…" }` 은 이제 검증에서 걸린다(앱은 옛 파일을 열 때 자동 변환하지만,
새로 쓰는 문서는 처음부터 배열로 쓴다). 배열 앞이 위 겹이고, 생략과 `[]` 는 둘 다 "배경
없음"이다. 투명도는 겹이 아니라 색의 알파(`#RRGGBBAA`)로 쓴다. 그라디언트는 `"linear"` 겹으로
쓴다 — 아래 "그라디언트 배경". 이미지 배경은 `{ "type": "image", "src": "assets/hero.png", "fit": "cover" }`다.
`fit`은 `cover`·`contain`·`fill` 셋만 허용하며 반복은 없다. ImageNode와 같은 src 계약을
쓰고 사진 위 gradient는 배열 앞에 gradient를 둔다. 기존 겹을 임의로 삭제하지 않는다. 요구가 없으면 단색 한 겹으로 쓴다(`examples/` 의 관용구).

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
필드 정의가 필요하면 정본 스키마를 읽는다 — 사용자 프로젝트는 `../visual-spec/contract/schema/visual-spec.schema.json`,
저장소 안은 `src/features/editor/schema/visual-spec.schema.json`.
찾는 방법은 [../visual-spec-docs/SKILL.md](../visual-spec-docs/SKILL.md) 에 있다.

## 그라디언트 배경

그라디언트·여러 겹 배경을 요구받았을 때만 쓴다. 필드 정의는 정본 스키마의 `Fill`·`SolidFill`·
`LinearFill`·`GradientStop` 이다. 캔버스와 코드 생성([../visual-spec-to-react/SKILL.md](../visual-spec-to-react/SKILL.md))이
아래 의미 그대로 그린다. 실물은 `examples/gradient-hero.json` 이다 — 아래 관용구 셋(히어로
배경 + 오버레이, 버튼, 단색 위 오버레이)과 딱 끊기는 stop(진행 막대)을 한 화면에 담았다.

```json
{ "type": "linear", "angle": 180, "stops": [
    { "color": "#6366F1", "at": 0 },
    { "color": "#8B5CF6", "at": 1 }
] }
```

- **`angle` 은 CSS `linear-gradient` 의 각도다.** `180` = 위→아래, `0` = 아래→위, `90` =
  왼쪽→오른쪽, `135` = 왼쪽 위→오른쪽 아래. `0` 이상 `360` 미만 — `360` 은 `0` 으로 쓴다.
  소수도 된다.
- **`stops` 는 2개 이상, `at` 은 `0`..`1` 비율이다**(퍼센트 아님 — 50%는 `0.5`). `at` 은
  오름차순으로 쓴다. 이웃한 두 stop의 `at` 을 같게 쓰면(예: 둘 다 `0.5`) 그 자리에서 색이
  딱 끊기는 경계가 된다. 역순은 `gradient-stop-order` 로 걸린다.
- **배열 앞이 위 겹이다.** 반투명 겹을 "위에 얹으려면" 배열 앞에 둔다. 불투명한 겹 밑에 깔린
  겹은 보이지 않는다 — 불투명 solid가 배열 앞에 있으면 그 뒤 겹은 전부 가려진다.
- 겹마다 불투명도·표시 여부 칸은 없다. 반투명은 색 알파로, 숨기려면 겹을 지운다.

관용구:

**히어로 배경** — 큰 frame(루트 바로 아래 히어로 영역)에 두 색 대각선 그라디언트 한 겹.

```json
"background": [
  { "type": "linear", "angle": 135, "stops": [
      { "color": "#4F46E5", "at": 0 },
      { "color": "#9333EA", "at": 1 }
  ] }
]
```

**버튼 그라디언트** — 왼쪽→오른쪽(`90`). 글자색은 두 끝 색 모두와 대비되게(보통 흰색) 둔다.
`border` 를 쓰면 `width: 0` 이거나 첫 stop 색과 맞춘다.

```json
"background": [
  { "type": "linear", "angle": 90, "stops": [
      { "color": "#4F46E5", "at": 0 },
      { "color": "#7C3AED", "at": 1 }
  ] }
]
```

**반투명 오버레이 겹** — 단색(또는 그라디언트) 위에 투명→반투명으로 짙어지는 겹을 **앞에**
얹는다. 아래쪽 글자를 읽기 좋게 할 때 쓴다.

```json
"background": [
  { "type": "linear", "angle": 180, "stops": [
      { "color": "#0F172A00", "at": 0 },
      { "color": "#0F172ACC", "at": 1 }
  ] },
  { "type": "solid", "color": "#6366F1" }
]
```

**표현할 수 없는 것** — 근사했다면 사용자에게 알린다.

- `radial`(원형)·`conic` 그라디언트 — 채우기 종류는 `solid`·`linear` 둘뿐이다. 필요하면 linear로
  근사한다.
- 이미지 채우기(배경 사진) — `background` 에 이미지를 넣을 수 없다. 사진은 `image` 노드다.
- **사진 위 반투명 오버레이** — `image` 노드는 `background` 가 없고, 노드를 겹쳐 놓는 배치
  (absolute)도 없다. 사진과 오버레이를 한 자리에 포갤 수 없다. frame 배경의 단색·그라디언트
  위에 얹는 오버레이는 된다(위 관용구).

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
- `background` 를 옛 객체 모양 `{ "color": "#…" }` 로 쓴다 → `schema`(`.../background` 에
  `값의 타입이 "array"이어야 합니다.`). `[{ "type": "solid", "color": "#…" }]` 로 고친다
- linear 겹의 stop을 `at` 역순으로 쓴다 → `gradient-stop-order`. 오름차순으로 정렬한다
- stop의 `at` 을 퍼센트(`50`)로 쓰거나 stop을 1개만 쓰거나 `angle` 에 `360` 을 쓴다 → `schema`
  (`.../background/<i>/...`). `at` 은 `0`..`1`, stop은 2개 이상, `angle` 은 `360` 미만이다

## 다 쓴 뒤

**반드시 검증한다.** 검증 없이 완료라고 말하지 않는다.

검증은 앱이 스펙 파일을 열 때와 **같은 검증기**로 한다.

- **사용자 프로젝트** — 함께 설치된 로컬 계약의 `validate` 명령을 쓴다. 이 설치본의 정확한 명령은
  `../visual-spec/contract/LOCAL.md`에 있다(`node "<CLI 경로>" validate <파일>`). 그 파일이 없거나 경로가
  없으면 추측하지 말고 사용자에게 CLI 경로를 묻는다(`../visual-spec/contract/README.md` "CLI 실행" 절). 유효하면 `✓`, 아니면 이슈마다 `[code] path: message` 한 줄을
  출력하고 exit 1로 끝난다.
- **이 저장소 안** — 같은 함수를 직접 불러도 된다.
  ```ts
  import { validateVisualSpec } from "@/features/editor/schema";
  const { valid, issues } = validateVisualSpec(spec); // issues: { code, path, message }[]
  ```

`valid: false` 면 [../visual-spec-validate/SKILL.md](../visual-spec-validate/SKILL.md) 로 넘어간다.
