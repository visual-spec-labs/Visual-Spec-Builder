# 배경 채우기(그라디언트·다중 채우기) 설계 결정 (#127)

상태: **설계와 후속 1~5단계 구현 완료(2026-10-04)** — 1 스키마 전환(#212) · 2 렌더(#213) · 3 패널(#214) · 4 스킬·NL(#215) · 5 예제(`Yumesa2025/127-background-fill-examples`)  
범위: `Background`의 표현, 기존 문서 마이그레이션, 영향 범위, 후속 구현 순서를 정한다. 이 문서 자체는 정본 스키마와 코드를 바꾸지 않았다 — 아래 "후속 작업 범위"의 별도 PR에서 바꾼다. 1~4단계에서 이 문서와 다르게 정하거나 더 정한 것은 "캔버스 번역"·"Command와 패널" 절과 "후속 작업 범위"에 반영했다.

## 결정 요약

| 질문 | 결정 |
|---|---|
| 어떤 모양으로 넓힐까? | **A안.** `background`를 채우기 겹의 배열 `Fill[]`로 바꾼다. 유니온(B안)과 "그라디언트만 먼저"(C안)는 택하지 않는다. 기존 JSON은 깨지고 열 때 자동 변환한다. |
| 첫 채우기 종류는? | `solid`·`linear`에서 시작. #235로 `image`를 추가한다. `radial`은 뺀다 — 나중에 `oneOf` 갈래로 더해도 기존 문서가 깨지지 않는 추가 변경이다. |
| 겹 순서는? | **배열 앞이 위다.** CSS `background-image`·`box-shadow`와 같다. 패널도 배열 순서 그대로 위에서 아래로 보인다(Figma 패널과 같은 방향). |
| 각도와 stop은? | 각도는 CSS `linear-gradient`의 각도 그대로(0 = 위쪽, 시계 방향, 180 = 아래쪽), `[0, 360)`. stop 위치 `at`은 0..1, 2개 이상, 오름차순(같은 값 허용). 정렬은 validator가 본다. |
| 겹마다 불투명도·표시 여부를 둘까? | 두지 않는다. 투명도는 `Color`의 알파(`#RRGGBBAA`)로 쓴다. 표시 토글은 나중에 선택 필드로 더해도 안 깨진다. |
| 캔버스에서 어떻게 그릴까? | **맨 아래 겹이 solid면 그 색은 `background-color`**, 나머지 겹은 `background-image` 쉼표 목록 하나로 그린다. 목록 안의 solid 겹은 `linear-gradient(c, c)`로 바꾼다. (처음엔 `background-color`를 쓰지 않기로 했으나 1단계에서 실측 후 바꿨다 — "캔버스 번역" 참고.) |
| 버전과 마이그레이션은? | 문서 버전을 `0.3`으로 올린다 — `VisualSpec`(단일 화면)과 `ProjectSpec` 둘 다. 0.1·0.2 문서는 열 때 자동 변환하고, 저장은 항상 0.3이다. 0.3을 모르는 구버전은 새 문서를 거부한다. |
| Command는 바뀔까? | 바뀌지 않는다. 인덱스 경로(`background.0.color`)도 새 Command도 만들지 않는다. `updateNode { path: "background", value: Fill[] }`로 배열을 통째로 교체한다. Command 스키마([09](09-command-schema-freeze.md))는 그대로다. |
| 패널은 어디까지? | 겹 목록(추가·삭제·위/아래 이동)과 겹 편집(solid 색 / linear 각도·stop / #235 image src·fit). 드래그 정렬·캔버스 그라디언트 핸들·겹 숨김은 뺀다. |

## 표현 방식

필드 이름은 `background`, `$def` 이름은 `Background` 그대로 두고 **모양만** 객체에서 배열로 바꾼다. 초안 형태는 다음과 같다. 이는 설계 스케치이며 정본 JSON Schema가 아니다.

```jsonc
// 설계 스케치 — 정본 아님. 정본은 스키마 PR에서 확정한다.
"Background": {
  "type": "array",
  "description": "채우기 겹 목록. 앞이 위. 생략과 빈 배열은 둘 다 '채우기 없음'",
  "items": { "$ref": "#/$defs/Fill" }
},
"Fill": { "oneOf": [{ "$ref": "#/$defs/SolidFill" }, { "$ref": "#/$defs/LinearFill" }] },
"SolidFill": {
  "type": "object", "additionalProperties": false,
  "required": ["type", "color"],
  "properties": { "type": { "const": "solid" }, "color": { "$ref": "#/$defs/Color" } }
},
"LinearFill": {
  "type": "object", "additionalProperties": false,
  "required": ["type", "angle", "stops"],
  "properties": {
    "type": { "const": "linear" },
    "angle": { "type": "number", "minimum": 0, "exclusiveMaximum": 360 },
    "stops": { "type": "array", "minItems": 2, "items": { "$ref": "#/$defs/GradientStop" } }
  }
},
"GradientStop": {
  "type": "object", "additionalProperties": false,
  "required": ["color", "at"],
  "properties": {
    "color": { "$ref": "#/$defs/Color" },
    "at": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

노드에서는 이렇게 쓴다. 보라 단색 위에, 위에서 아래로 짙어지는 반투명 남색을 얹었다.

```jsonc
"background": [
  { "type": "linear", "angle": 180, "stops": [
      { "color": "#0F172A00", "at": 0 },
      { "color": "#0F172ACC", "at": 1 }
  ] },
  { "type": "solid", "color": "#6366F1" }
]
```

이슈 본문의 다중 채우기 예시 `[{ solid #FFFFFF }, { linear … }]`는 이 규칙으로 읽으면 불투명한 흰색이 그라디언트를 덮는다. "흰 바탕 위에 그라디언트"를 뜻했다면 순서가 반대여야 한다.

- **빈 배열을 허용한다.** 두 가지가 `[]`를 필요로 한다. `updateNode`의 `value`는 JSON 값이라 필드를 지울 수 없다 — 마지막 겹을 지우면 `[]`가 된다. [반응형 override](12-responsive-ir-design.md)는 생략이 "상속"이라 "이 폭에서는 배경 없음"을 `[]`로만 말할 수 있다. 생략과 `[]`는 같은 뜻(그리지 않음)이고, 이는 지금 `background`가 없는 노드의 렌더와 같다 — [06의 선택 필드 조건](06-schema-freeze.md#변경-규칙)을 만족한다.
- **필드 이름을 `fills`로 바꾸지 않는다.** 반응형 override 대상 목록, 티켓 구조 키, `nodeSections`의 섹션 id, NL 어휘("배경"), 코드 생성 매핑이 전부 `background`라는 이름에 걸려 있다. 이름까지 바꾸면 깨지는 범위만 넓어지고 얻는 정보가 없다.
- **`{ fills: Fill[] }`처럼 객체로 한 번 감싸지 않는다.** 배열 옆에 둘 칸이 지금 없다. 겹 단위의 확장(표시 여부 등)은 `Fill` 쪽에 붙는다. 감싸면 경로가 한 단계 길어지고, 통째 교체가 필요하다는 점은 똑같다.

## 대안과 근거

| 기준 | A. `Fill[]`로 교체 (채택) | B. `{ color } \| { fills }` 유니온 | C. 그라디언트만 `{ color } \| { gradient }` |
|---|---|---|---|
| 기존 JSON | 깨진다. 무손실 기계 변환 한 번 | 안 깨진다 | 안 깨진다 |
| 읽는 쪽 | 한 갈래 | 영구히 두 갈래 | 두 갈래, 다중 채우기 때 다시 바뀐다 |
| 부분 병합 3곳(아래) | 배열이라 이미 통째 교체 | 객체끼리 병합돼 `{ color, fills }`가 생긴다 | B와 같다 |
| NL이 낼 경로 | `background` 하나, 형태 하나 | 같은 단색을 두 형태로 쓸 수 있다 | B와 같다 |
| 반응형 override | 통째 교체로 자연스럽다 | 부분 상속 규칙과 충돌 | B와 같다 |

결정을 가른 것은 **코드베이스에 이미 있는 부분 병합 세 곳**이다. 셋 다 "객체는 칸 단위로 병합하고, 배열은 통째로 교체한다"는 같은 규칙을 따른다.

1. `command/editablePath.ts` + `store/path.ts`의 `setByPath` — `updateNode`의 점 표기 경로 쓰기.
2. `store/createNode.ts`의 `deepMerge` — NL `createNode`의 기본값 채우기(배열과 `Atomic` 타입만 통째 교체).
3. [12의 반응형 override](12-responsive-ir-design.md#표현-방식) — "속성 일부만 덮어쓰며, 생략된 속성은 앞선 값에서 상속한다".

B안의 두 갈래는 둘 다 객체라 세 곳 모두에서 칸 단위로 섞인다. 구체적으로,

- **GUI.** 배경이 `{ fills: [...] }`인 노드에서 "배경색" 칸이 `setNodeField(id, "background.color", c)`를 부르면, `editablePath`의 `oneOf` 판정은 지금 값이 객체라 `{ color }` 갈래로 통과시키고 `setByPath`는 `{ fills, color }`를 만든다. `setNodeField`는 IR 검증을 거치지 않으므로(검증은 NL의 G3만 한다) 무효 문서가 Undo 히스토리에 성공 단계로 쌓인다 — `editablePath.ts` 머리말이 막으려던 "조용한 오염" 그 자체다.
- **createNode.** 기본값 `{ color: "#FFFFFF" }` 위에 override `{ fills: [...] }`가 병합돼 `{ color, fills }`가 된다.
- **반응형.** 기반 값 `{ fills }` 위에 breakpoint override `{ color }`가 상속 병합돼 같은 일이 생긴다.

B안을 택하면 세 곳마다 "`Background`는 통째 교체"라는 예외를 따로 심어야 한다. A안은 배열이라 예외 없이 세 곳의 기존 규칙에 그대로 들어간다.

B안의 장점인 "기존 JSON이 안 깨진다"는 비용을 없애는 것이 아니라 미루는 것이다. 읽는 곳(렌더 6곳, 코드 생성 스킬, 티켓 구조 키)이 두 갈래를 영구히 지고, 티켓 구조 키는 같은 모양의 `{ color: "#FFF" }`와 `{ fills: [solid #FFF] }`를 다른 구조로 본다. A안의 깨짐은 `{ color: c }` → `[{ type: "solid", color: c }]` 한 가지 무손실 변환이고 열 때 자동으로 한 번 치른다.

C안은 B안의 병합 문제를 그대로 가지면서, 다중 채우기를 넣을 때 두 번째 깨짐(또는 세 번째 갈래)과 목록 UI를 다시 만든다. 마이그레이션을 한 번에 끝내는 편이 싸다.

## 표현 규칙

- **겹 순서는 배열 앞이 위다.** CSS `background-image`가 먼저 적은 것을 위에 그리고, 이 저장소의 `canvasLayout.strokeAndShadowStyle`도 `box-shadow`를 같은 순서로 합성한다. 그래서 캔버스 번역과 코드 생성이 순서를 뒤집지 않는다. 코드 생성은 LLM이 스킬을 읽고 수행하므로 "뒤집기" 단계 하나가 곧 실수할 자리다. Figma 패널도 위가 위라 패널은 배열 순서 그대로 그린다. "그림 그리는 순서(뒤가 위)"가 더 직관적인 면은 있지만, 겹을 붙이는 전용 Command가 없고 NL이 배열을 통째로 쓰므로 맨 앞에 넣든 맨 뒤에 넣든 비용이 같다.
- **각도는 CSS `linear-gradient`의 `<angle>`과 같다.** `0` = 아래에서 위로(`to top`), `90` = 왼쪽에서 오른쪽, `180` = 위에서 아래(CSS 기본값). 범위는 `[0, 360)`이다 — 한 방향에 한 표기만 두려고 음수와 360 이상을 막는다. 소수는 허용한다. 그라디언트 선의 길이도 CSS 규칙(모서리가 끝 색에 닿는 길이)을 따른다. 직사각형에서 대각 각도를 쓰면 Figma의 핸들 기반 그라디언트와 모양이 다를 수 있지만, 출력이 캔버스든 생성 코드든 CSS이므로 IR은 CSS 의미를 택한다. Figma 가져오기 변환은 범위 밖이다.
- **stop 위치 `at`은 0..1이다.** CSS로 옮길 때 `at × 100`%다. stop은 2개 이상이고, `at`은 오름차순이어야 하며 같은 값은 허용한다(딱 끊기는 경계). 정렬을 렌더에서 고쳐 주지 않고 무효로 두는 이유는 CSS가 앞보다 작은 stop을 정렬하지 않고 앞 값으로 끌어올리기 때문이다 — 순서가 틀린 JSON의 뜻이 번역기마다 달라진다. 패널은 커밋할 때 안정 정렬해서 쓴다(아래 "Command와 패널").
- **겹마다 불투명도를 두지 않는다.** solid의 `color`와 stop의 `color`가 이미 알파를 가진다. CSS 배경 겹에는 겹 단위 불투명도가 없어 어차피 색마다 곱해야 하고, 같은 결과를 두 방법으로 쓸 수 있게 될 뿐이다.
- **겹마다 표시 여부를 두지 않는다.** 첫 범위에서는 지우는 것이 유일한 숨김이다. `visible?: boolean`(생략 = `true` = 지금 렌더)은 나중에 더해도 기존 문서가 깨지지 않으므로 필요해질 때 넣는다.
- **초기 #127에서는 `radial`·`image`를 뺐다(#235는 아래 절에서 image를 추가).** radial은 중심·모양·크기 칸이 더 필요하고, CSS 기본(`farthest-corner` 타원)과 Figma 핸들의 의미가 달라 따로 정해야 하며, 패널에서 쓸 만하려면 2차원 핸들 편집이 필요하다. image는 두 번째 에셋 참조 지점을 만든다 — 지금은 `ImageNode.src` 하나만 있고 `ui/properties/imageSrc.ts`의 경로 해석, File ▸ Import, 내보내기 묶음의 `usedAssets`, 코드 생성 스킬의 이미지 경로 규칙이 전부 그 한 곳을 전제한다. 둘 다 `Fill`의 `oneOf`에 갈래를 더하는 추가 변경이라 기존 문서를 깨지 않고 나중에 넣을 수 있다. **대신 이슈가 대표 용례로 든 "사진 위 반투명 그라디언트"는 첫 범위에서 표현할 수 없다** — 이미지 채우기도, 겹쳐 놓는 배치(absolute)도 없기 때문이다.

JSON Schema로 안 되는 의미 검증은 **stop의 `at` 오름차순** 하나다. 배열 원소끼리 비교하는 문법이 없다. `validateVisualSpec`·`validateProjectSpec`이 새 `IssueCode` `gradient-stop-order`(8종 → 9종, 1단계)로 잡는다. 나머지(`type` 상수, 각도·위치 범위, stop 2개 이상)는 스키마가 막는다.

## 캔버스 번역

```
// 1단계(스키마 전환)에서 canvasLayout.backgroundStyle로 확정. linear 갈래는 2단계에서 더했다.
맨 아래 겹(배열 끝)이 solid → backgroundColor: c
나머지 겹(위 → 아래)       → backgroundImage 목록, ", "로 잇는다(앞 = 위)
  solid  → linear-gradient(#C, #C)
  linear → linear-gradient(<angle>deg, #C1 <at1×100>%, #C2 <at2×100>%, …)
이미지 겹이 있으면          → backgroundOrigin: "border-box"
생략·[]                    → 아무 속성도 내지 않는다
```

- **맨 아래 solid는 `background-color`로 낸다(1단계에서 바꾼 결정).** 처음에는 "`background-color`는 언제나 맨 아래 한 겹뿐이라 목록 중간의 solid는 어차피 이미지로 그려야 하니, 맨 아래 solid만 따로 빼는 분기를 두지 않고 규칙을 하나로 둔다 — `linear-gradient(c, c)`는 단색과 똑같이 그려진다"고 적었다. **마지막 전제가 픽셀 단위로는 틀렸다.** Chromium(Skia)은 색이 하나뿐인 그라디언트도 디더링한다.
  - 300×200 `div` 단독 비교: `background: #F7F8FA`는 전 픽셀이 (247,248,250)인데, `linear-gradient(#F7F8FA, #F7F8FA)`는 약 3% 픽셀이 (246,247,249)·(246,247,250)으로 채널당 1 낮다. `transform: scale` 유무와 `linear-gradient(c 0 0)` 표기와 무관했다.
  - 앱 비교: develop(9a748fc)과 1단계 브랜치의 dev 서버를 따로 띄우고, 같은 0.1 `dashboard-cards.json`을 연 에디터 화면을 1600×1000으로 찍어 PNG를 픽셀 단위로 비교했다. 모든 겹을 그라디언트로 그리면 **16268픽셀이 최대 채널차 2**(대부분 1)로 달랐고 홈 카드 미리보기도 759픽셀(최대 3)이 달랐다. 육안으로는 구별되지 않는다.
  - 1단계의 불변조건은 "기존 문서는 렌더 그대로"라 맨 아래 solid를 `background-color`로 바꿨다. 바꾼 뒤에는 0.1 예제 다섯(dashboard-cards·card-effects·form-grid·login-screen·header-content)과 0.2 `two-page-project`의 에디터 화면, 홈 목록, 노드 선택 상태까지 **다른 픽셀이 0**이었다.
  - 가장 흔한 단색 한 겹에서 아래 코드 생성 매핑(`bg-[#..]`, 곧 `background-color`)과 그리는 방식이 같아지는 것도 이 쪽의 이점이다. 비용은 분기 하나다. 맨 아래가 아닌 solid는 여전히 `linear-gradient(c, c)`로 그리고, 그 경우의 ±1 디더링은 받아들인다.
- **`background-origin: border-box`를 이미지 겹이 있을 때 함께 낸다(1단계에서 이미 반영).** 배경 이미지는 기본적으로 padding 상자 기준으로 놓이고 테두리 밑으로는 반복돼 들어간다. `inside` 테두리(CSS `border`)가 반투명하거나 둥글면 이음매가 보인다. `background-color`는 기본 `background-clip: border-box`로 테두리 밑까지 한 장으로 칠해지므로, 이미지 겹도 `border-box` 기준이어야 겹끼리 같은 상자에 걸리고 그라디언트도 Figma 채우기처럼 상자 전체에 걸린다. 처음엔 2단계(렌더 PR)에 두었지만 solid 겹을 이미지로 그리는 경우가 1단계에 이미 있어 함께 넣었다.
- **`background` 축약 속성을 쓰던 자리를 풀어 쓴 속성으로 바꿨다.** `nodeStyles.ts`·`homePreview.ts`는 0.2까지 `background: node.background?.color`를 썼다. 축약과 `backgroundImage` 같은 개별 속성을 한 스타일 객체에서 섞으면 React가 다시 그릴 때 충돌한다.
- **번역 함수는 `canvasLayout.ts`의 `backgroundStyle`이다.** `strokeAndShadowStyle` 옆, 노드 타입을 모르는 순수 함수로 두고 `test/canvas-layout.test.ts`에서 직접 검사한다. `nodeStyles.ts`(frame·button·input)와 `homePreview.ts`(같은 셋)의 여섯 곳이 이 함수 하나를 부른다. 1단계에서는 `linear` 겹을 건너뛰었고, 2단계에서 갈래를 더해 두 호출부는 손대지 않고 함께 바뀌었다.
- **수 표기는 소수 넷째 자리에서 반올림한다(2단계).** `at × 100`은 부동소수 오차가 붙는다(0.1 × 100 = 10.000000000000002, 0.29 × 100 = 28.999999999999996). 정수로 반올림한 뒤 10⁴로 나누면 JS의 최단 표기가 그 십진수를 그대로 내므로 `10%`·`12.5%`·`33.3333%`처럼 나온다. 각도에도 같은 규칙을 쓴다(패널이 계산해 쓰게 될 때를 대비). 넷째 자리면 1만 px 상자에서도 0.01px라 보이는 차이가 없다. 4단계의 코드 생성이 같은 표기를 써서 캔버스와 글자까지 같고(아래), 3단계 패널의 stop 위치 %도 같은 자리에서 반올림한다.

코드 생성(`skills/visual-spec-to-react`)의 매핑은 4단계에서 이 저장소의 Tailwind v4.3.3으로 실측해 확정했다.

- **solid 한 겹뿐이면 `bg-[#RRGGBB(AA)]`** — 0.2까지와 같은 출력이다. 마이그레이션된 기존 스펙을 다시 생성해도 코드가 바뀌지 않는다. 캔버스도 이 경우 `background-color` 하나라 그리는 방식까지 같다.
- **그 밖에는 위 캔버스 번역과 같은 규칙을 클래스로 쓴다.** 맨 아래 solid는 `bg-[c]`, 나머지 겹은 캔버스 `backgroundImage` 문자열의 공백을 `_`로 바꾼 `bg-[image:…]` **한 클래스**(겹 순서 그대로 쉼표로 잇는다 — `background-image`는 속성 하나라 클래스를 나누면 나중 것이 앞을 덮는다)에 `bg-origin-border`를 함께 붙인다. 수는 `cssNumber`와 같은 넷째 자리 반올림이라 Tailwind가 만드는 `background-image`가 캔버스와 글자까지 같다. `style` 속성은 쓰지 않는다 — 1단계가 표기 확인 전까지 임시로 시켰던 `style={{ backgroundColor, backgroundImage, backgroundOrigin }}`는 4단계에서 걷었다. 예를 들어 위 "표현 방식"의 예(보라 단색 위 반투명 남색 오버레이)는 `bg-[#6366F1] bg-[image:linear-gradient(180deg,_#0F172A00_0%,_#0F172ACC_100%)] bg-origin-border`다.
- **`image:` 타입 힌트는 빼면 안 된다.** 힌트 없이 `bg-[linear-gradient(…),_linear-gradient(…)]`처럼 겹 사이에 `,_`가 있으면 Tailwind 4.3.3이 값을 색으로 추론해 `background-color: linear-gradient(…), linear-gradient(…)`라는 무효 CSS를 낸다 — 빌드 오류 없이 배경이 조용히 사라진다. 힌트 없는 한 겹은 `background-image`로 맞게 나오지만, 겹 수에 따라 표기가 갈리지 않게 늘 힌트를 붙인다. 힌트가 있으면 한 겹이든 여러 겹이든 `background-image`다.

## 마이그레이션과 버전

**버전.** `VisualSpec`은 `0.1` → `0.3`, `ProjectSpec`은 `0.2` → `0.3`으로 올린다. 두 최상위 타입이 같은 `ScreenSpec` `$def`를 쓰므로 둘 다 바뀐다. 이 시점부터 버전 문자열은 **IR 세대**를 뜻하고, 화면 문서와 프로젝트 문서는 버전이 아니라 키(`screen` / `pages`)로 가른다.

- `VisualSpec`을 `0.1`로 두지 않는 이유 — 같은 `0.1`이 서로 호환되지 않는 두 모양을 가리키게 된다. `skills/visual-spec-authoring`은 (이 문서를 쓸 당시) `"version": "0.1"` 단일 화면 문서를 썼으므로, 옛 문서와 새 문서를 버전으로 구별할 수 없다.
- `VisualSpec`을 `0.2`로 올리지 않는 이유 — `ProjectSpec`의 `0.2`와 겹친다. `store/loadSpec.ts`가 `version === "0.2"`로 프로젝트 문서를 가른다.

**변환.** `{ color: c }`인 `background`를 `[{ type: "solid", color: c }]`로 바꾸고 버전을 `0.3`으로 바꾼다. 버리는 정보가 없고 렌더 결과도 같다. 변환 함수는 `schema/migrate.ts`의 `migrateV01` 옆에 둔다. 이름은 이슈의 `migrateV02` 대신 0.1·0.2를 다 받는다는 뜻으로 `migrateToV03`로 정했고(1단계), 공개 표면이 하나 늘어 [06의 공개 표면 목록](06-schema-freeze.md#정본과-공개-표면)도 갱신했다.

- 입력은 `unknown`이다. 스키마가 바뀐 뒤에는 옛 모양의 생성 타입이 없다. 그래서 **변환 → 새 validator로 검증** 순서로 쓴다. 변환은 "문자열 `color` 하나만 가진 객체"인 `background`만 건드리고, 그 밖의 이상한 값은 그대로 둬서 검증이 보고하게 한다.
- `migrateV01`(화면 문서 → 페이지 1개 프로젝트)은 그대로 둔다. 공개 API라 이름을 유지하고, 입출력이 0.3이 된다는 주석만 고친다. `toVisualSpec`은 0.3 화면 문서를 낸다.

**적용 지점.** 바깥에서 들어온 문서를 검증하는 입구 둘에 모두 건다.

- `store/loadSpec.ts`의 `parseSpecJson` — Open(`ui/openSpecFromFile.ts`)과 홈 화면의 작업공간 목록(`ui/HomeScreen.tsx`)이 이 함수를 거친다. `isProjectDocument`의 `version === "0.2"` 판정도 키 기준으로 바꾼다.
- `store/specStorage.ts`의 `readStoredDocument` — **반드시 필요하다.** 이 함수는 `validateProjectSpec`을 못 통과한 저장본을 조용히 버리는 것이 현재 정책이라, 변환을 빠뜨리면 갱신 직후 첫 실행에서 자동 저장된 작업이 사라진다.
- 안쪽 경로(`editorStore`, `transactionGate`의 G3, `exportSpec`)는 이미 변환된 문서만 보므로 바꾸지 않는다.

**저장 형식.** 저장은 항상 0.3이다(Export, 작업공간 저장, 자동 저장). 열기는 파일을 다시 쓰지 않는다 — 처음 저장할 때 0.3으로 바뀐다. 따로 묻지 않는다.

**구버전과의 호환.** 0.3을 모르는 구버전 validator는 새 문서를 거부한다(`version` 상수와 `Background` 타입이 다르다). 앞으로의 호환은 보장하지 않는다 — [12](12-responsive-ir-design.md#호환성-및-동결-절차)와 같은 입장이다. 실제로 걸리는 경우는 둘이다. 팀원 중 갱신 전 빌드를 쓰는 사람은 갱신 후 저장된 파일을 못 연다. `npx visual-spec skills`로 사용자 프로젝트에 복사해 둔 옛 스킬은 0.1 문서를 쓰는데(이건 새 앱이 열 때 변환한다), 옛 코드 생성 스킬이 0.3 문서를 읽으면 `background`를 잘못 읽는다 — 갱신 후 스킬을 다시 복사해야 한다.

## Command와 패널

**인덱스 경로를 열지 않는다.** `background.0.color` 같은 경로는 지금 구조에서 두 군데가 막는다.

- `editablePath.ts`의 `canWrite`는 `properties`가 없는 스키마 노드(배열 `children` 등)에서 멈춘다 — 인덱스 경로는 거부된다.
- 열어 준다 해도 `setByPath`는 배열을 "내려갈 수 있는 값"으로 보지 않고 `{}`를 새로 만든다 — 배열이 `{ "0": … }` 객체로 바뀐다.

두 함수와 [09](09-command-schema-freeze.md)의 경로 의미를 함께 바꿔야 하는 일이라, 겹 하나 고치는 편의에 비해 크다.

**새 Command를 만들지 않는다.** `updateNode { path: "background", value: [...] }`는 지금 규칙 그대로 통과한다 — frame·button·input이 `background`를 선언하고, 노드 바로 아래 칸을 통째로 쓰는 경로라 필수 필드 검사에 걸리지 않는다. `value`는 형태 관문(G1)에서 제한하지 않고, NL 경로에서는 G3(`validateProjectSpec`)가 `Fill` 모양과 stop 정렬을 검사한다. 그래서 Command 스키마도 [09](09-command-schema-freeze.md)도 바뀌지 않는다. 0.2까지 패널과 테스트가 쓰던 `background.color` 경로는 스키마가 배열이 되면서 `editablePath`가 거부한다 — 조용히 섞이지 않고 깨끗하게 실패한다. 1단계에서 패널과 테스트를 `background` 통째 쓰기로 바꿨고, "필수가 `color` 하나라 새로 만들어도 완전하다"의 예로 `background.color`를 들던 `editablePath.ts` 머리말도 고쳤다.

**NL이 낼 경로는 하나다.** LLM은 요청에 담긴 화면 문맥에서 현재 `background`를 읽고 배열 전체를 쓴다. 배경을 없애려면 `[]`를 쓴다. 한 가지 경로, 한 가지 형태라 스킬이 가르칠 것도 하나다.

**패널의 최소 범위.** `BackgroundSection.tsx`(frame·button·input 공유)를 겹 목록으로 넓혔다(3단계) — 그 파일 주석이 "#78 2단계가 이 칸 하나를 채우기 목록으로 넓힐 자리"라고 적어 두었던 자리다. linear 겹의 칸은 `LinearFillFields.tsx`, 겹·stop 목록이 함께 쓰는 버튼 모양은 `fillButtons.ts`다.

- 목록은 배열 순서대로(위 = 맨 위 겹) 보인다. 겹마다 종류 선택(solid / linear)·위/아래 이동·삭제가 있고, 목록의 "채우기 추가"는 solid `#D9D9D9` 한 겹을 **맨 위**에 넣는다(흰 카드 위에서도 보이는 옅은 회색).
- 종류 전환은 지금 색에서 출발해 화면이 갑자기 달라지지 않게 한다. **solid → linear**는 각도 180°(위→아래), stop은 그 색(`at` 0) → 같은 색의 알파 00(`at` 1)이다. `transparent`(투명한 검정)가 아니라 같은 색의 투명이라 알파를 미리 곱하지 않고 섞는 번역기에서도 중간이 탁해지지 않는다. **linear → solid**는 첫 stop의 색이다(나머지 stop과 각도는 Undo로 되돌린다).
- solid는 색 칸 하나. linear는 각도 숫자 칸과 stop 목록(색 + 위치), stop 추가/삭제(2개 미만으로는 못 줄인다). 각도 칸은 `[0, 360)` 밖, 곧 360을 받지 않는다 — `NumberField`의 `maxExclusive`가 빨간 테두리로 막고 커밋하지 않는다. stop 추가는 가장 넓은 빈 구간의 가운데에 그 구간 시작 stop의 색으로 넣는다.
- stop 위치는 **%로 보이고** `at = % / 100`으로 저장한다. `at`은 %로 넷째 자리(소수 여섯째 자리)에서 반올림한다 — 캔버스의 `cssNumber`와 같은 자리라 패널에 보이는 수와 캔버스가 그리는 수가 같다.
- stop은 위치를 커밋할 때마다 **안정 정렬**한다. 같은 위치의 stop은 원래 순서를 지킨다(같은 `at` 두 개는 딱 끊기는 경계라 순서가 곧 뜻이다). 정렬로 stop이 자리를 옮겨도 React key가 그 stop을 따라가(`stopIndexAfterPosition`) 타이핑 중의 **포커스와 burst(undo 묶음)가 유지된다.**
- 쓰기는 `borderPatch`·`shadowPatch`처럼 **순수 함수가 완전한 배열을 만들고** `setNodeField(id, "background", next)` 한 번으로 커밋한다. 함수는 `backgroundPatch.ts`의 `addFill`·`removeFill`·`moveFill`·`changeFillType`·`setSolidColor`·`setLinearAngle`·`setStopColor`·`setStopPosition`·`addStop`·`removeStop`이다. 설계 때 가칭 `fillsPatch`로 부른 자리인데 이름은 바꾸지 않았다 — 필드·섹션 이름이 `background`/`BackgroundSection`이고 `editablePath.ts` 머리말이 이 파일을 가리킨다. 색·숫자 입력의 타이핑 묶음은 다른 칸과 같은 `useDraftInput`(`continueEdit`) 경로를 쓰고, 바뀐 게 없으면(할 수 없는 조작 포함) 받은 배열을 같은 참조로 돌려줘 값이 그대로면 커밋하지 않는 #209의 가드가 배열에서도 통한다.
- 빼는 것: 드래그 정렬, 캔버스 위 그라디언트 핸들, stop 슬라이더 막대, 겹 숨김.

## 반응형 IR(#181)과의 관계

[12](12-responsive-ir-design.md)의 override 대상에 `background`가 있다. 배열은 원소 단위로 병합하지 않으므로 **override의 `background`는 그 폭에서 배경 전체를 갈아 끼운다.** "이 폭에서 배경 없음"은 `[]`다. 12의 "속성 일부만 덮어쓴다"는 객체 칸(`box`, `layout`, `border` 등)에 대한 규칙이고 `background`와 충돌하지 않는다 — B안이었다면 바로 이 상속 규칙과 부딪혔다. 두 스키마 PR 중 나중에 머지되는 쪽이 이 통째 교체를 스키마 `description`과 12에 적는다. — #127 1단계가 정본 `Background`의 `description`(“배열이라 부분 병합하지 않고 통째로 교체한다”)과 [12의 override 절](12-responsive-ir-design.md#표현-방식)에 적었다. 반응형 스키마 PR은 override 대상의 `background`가 `Fill[]`임을 그대로 따르면 된다.

## 영향 범위

`develop` a8c101c 기준 `grep -rn background`(src·test·skills·examples·docs) 실측이다. 행 번호는 그 시점 값이다.

| 영역 | 위치 | 바뀌는 것 |
|---|---|---|
| 정본 스키마 | `schema/visual-spec.schema.json` 9·44행(`version` 상수), 238~246행(`Background`) | 배열 + `Fill` 정의, 버전 0.3 |
| 생성 타입·검증 | `schema/types.ts`(생성), `schema/validate.ts`(`IssueCode`), `schema/migrate.ts`, `schema/index.ts` | `generate:types` 재생성, stop 정렬 검사, 변환 함수 공개 |
| 렌더 | `ui/nodeStyles.ts` 77·135·168행, `ui/homePreview.ts` 76·133·159행 | `.color` 6곳 → 번역 함수 호출 |
| 렌더 공용 | `ui/canvasLayout.ts`(`strokeAndShadowStyle` 옆) | 번역 함수 신설 |
| 편집 | `ui/properties/BackgroundSection.tsx` 15행(`useNodeField("background.color")`) | 겹 목록 편집. `nodeSections.ts`의 섹션 id `"background"`는 그대로 |
| 생성 기본값 | `store/blankSpec.ts` 8(`version`)·28행, `store/seedSpec.ts` 9(`version`)·26·81·126행, `store/createNode.ts` 75·131·152행 | 단색 한 겹 배열로. `createNode`의 `deepMerge`는 배열을 통째 교체하므로 수정 없음(206행 주석만) |
| 열기·저장 | `store/loadSpec.ts` 9~15·33~35행, `store/specStorage.ts` 60행, `ui/HomeScreen.tsx` 78행, `ui/openSpecFromFile.ts` 20행 | 변환 후 검증, 문서 종류 판정을 키 기준으로 |
| Command | `command/editablePath.ts` 32~44행(주석), `command/command.schema.json` | 주석의 예만 바뀐다. 스키마·판정 로직 그대로 |
| NL 관문 | `command/transactionGate.ts` 100행(G3) | 코드 그대로 — 새 스키마로 검사된다 |
| 티켓 | `ticket/compileTickets.ts` 82·94·105행(`structuralKey`) | 코드 그대로. 배열을 `JSON.stringify`하므로 겹 순서가 다르면 다른 구조로 묶인다(보이는 결과가 다르므로 맞다). `ticket.schema.json`은 `NodeId`만 참조해 [11](11-ticket-schema-freeze.md)은 영향 없음 |
| 코드 생성 스킬 | `skills/visual-spec-to-react/SKILL.md` 142행 | 위 "캔버스 번역"의 매핑 |
| 작성 스킬 | `skills/visual-spec-authoring/SKILL.md` 16(`version`)·33·61행 | 뼈대와 관용구 |
| NL 스킬 | `skills/visual-spec-nl-response/SKILL.md` 106·127·138·237행 | `createNode` 예시, 배열 통째 쓰기·순서 규칙 |
| 검증 스킬 | `skills/visual-spec-validate/SKILL.md` | `Fill`의 `oneOf`가 갈래별 잡음을 더 낸다 — 노드 `oneOf`와 같은 해석법(`.../type` 상수 메시지로 탈락 갈래 찾기)을 적는다 |
| 문서 | [04](04-gui-spec.md) 281행, [05](05-schema.md) 61행, [06](06-schema-freeze.md)(보장 표의 color 행, 스타일 확장 절, 공개 표면), [08](08-natural-language.md) 198·209·240행, [EDITOR_STORE_CONTRACT](EDITOR_STORE_CONTRACT.md) 156·209행, [12](12-responsive-ir-design.md)(override 통째 교체) | 모양·경로 예시 갱신 |
| 예제 | `examples/` 8파일 `background` 22곳 — card-effects 4, dashboard-cards 3, empty-title-screen 1, form-grid 4, header-content 2, image-hero 1, login-screen 2, two-page-project 5. `examples/invalid/` 8파일은 0곳 | 변환 함수로 일괄 변환, 버전 0.3 |
| 테스트 — `background` 직접 | `apply-command`(229~253·283행), `compile-tickets`(193), `editor-store`(170), `nl-protocol`(37), `nl-scope`(29·43), `nl-screen-generation`(77), `public-api`(44·76), `ticket-protocol`(36) | 픽스처 모양, `background.color` 경로 케이스 → `background` 통째 교체 케이스 |
| 테스트 — 영향 없음 | `node-sections`(섹션 id만), `home-preview`(이미지 노드의 `backgroundImage`만), `apply-command` 668행(복제본과 원본의 `background` 비교 — 모양과 무관) | — |
| 테스트 — 버전 문자열 | `"0.2"`·`"0.1"` 리터럴: `editor-store`, `project-spec`, `public-api`, `schema`, `spec-storage`, `workspace-middleware`, `workspace-vite-stack` | 0.3으로. `schema.test.ts`는 `examples/`를 순회하므로 예제 변환과 함께 간다 |

## 호환성 및 동결 절차

[06의 변경 규칙](06-schema-freeze.md#변경-규칙) 다섯을 이렇게 적용한다.

1. **별도 PR.** 스키마 전환 PR은 스키마 전환과 **그것 때문에 깨지는 곳의 기계적 수정**만 담는다. 그라디언트 렌더, 목록 패널, 스킬의 새 가르침은 뒤 PR이다. 다만 A안은 타입이 바뀌므로 "스키마 파일만" 고친 PR은 규칙 5(`typecheck` 통과)를 지킬 수 없다 — 읽고 쓰는 곳 전부가 같은 PR에 들어간다. 그 PR의 불변조건은 **"기존 문서는 렌더도 편집도 그대로"** 다.
2. **승인.** 이 문서가 먼저 합의 대상이다(아래 쟁점). 스키마 PR은 최소 1명 승인 뒤 머지한다.
3. **깨짐 명시.** PR 본문에 적는다 — 기존 JSON이 깨진다(0.1·0.2 → 0.3), 앱은 열 때 자동 변환한다, 0.3 문서는 구버전 앱·옛 스킬 사본이 못 읽는다.
4. **`generate:types`.** `Background`가 배열 타입이 되고 `Fill` 계열 타입이 생긴다. `types.ts`를 함께 커밋한다.
5. **예제·테스트.** 예제 8개는 손으로 고치지 않고 변환 함수로 바꾼다. 옛 0.1·0.2 픽스처를 변환하면 유효하고 렌더 스타일이 같다는 테스트를 더한다. `typecheck`·`lint`·`test`·`build`가 통과해야 한다.

Command 스키마([09](09-command-schema-freeze.md))와 Ticket 스키마([11](11-ticket-schema-freeze.md))는 바뀌지 않으므로 그 두 문서의 변경 절차는 타지 않는다.

## 팀 합의가 필요한 쟁점

1. **기존 JSON을 깨는 A안 자체.** 근거는 위 "대안과 근거"다.
2. **겹 순서(앞 = 위).** 이슈 본문의 다중 채우기 예시는 반대 순서로 읽어야 말이 된다.
3. **버전 `0.3` 통일.** `VisualSpec`까지 `0.1` → `0.3`으로 올리고, 화면/프로젝트 구분을 버전에서 키로 옮긴다.
4. **`image` 채우기 제외.** 이슈의 대표 용례(사진 위 오버레이)가 첫 범위에서 안 된다. 필수라면 image 채우기가 다음 추가 변경 1순위다.
5. **구버전과의 공존.** 팀원 빌드와 사용자 프로젝트의 스킬 사본을 함께 갱신해야 한다.

## 후속 작업 범위

이슈 단위로 쪼갠다. 화살표는 머지 순서 의존이다.

```
1 스키마 전환 ─→ 2 렌더 ─┬─→ 3 패널
                        ├─→ 4 스킬·NL
                        └─→ 5 예제
```

1. **스키마 전환 PR** (의존: 이 문서 합의) — **완료(PR #212, 브랜치 `Yumesa2025/127-background-fill-schema`).** 이 문서와 다르게 정한 것은 둘이다 — 맨 아래 solid를 `background-color`로 그린다, `background-origin`을 이미지 겹이 있을 때 이미 낸다(둘 다 위 "캔버스 번역"). 패널 순수 함수는 `ui/properties/backgroundPatch.ts`(`solidBackgroundView`·`solidBackgroundPatch`)였고 3단계가 같은 파일을 겹 목록 함수로 넓혔다(가칭 `fillsPatch`는 쓰지 않았다). 원래 범위: 스키마·생성 타입·stop 정렬 검사·버전 0.3, 변환 함수와 두 입구(`loadSpec`·`specStorage`) 연결, 생성 기본값 3파일, 예제 8개·테스트 변환. 읽고 쓰는 곳은 **단색 한 겹과 같은 동작**까지만 맞춘다 — 번역 함수는 solid 갈래만 그리고(linear 겹은 2 전까지 그려지지 않는다), `BackgroundSection`은 "겹이 없거나 solid 한 겹이면 그 색을 편집, 아니면 편집 불가 안내"로 둔다. 스킬 셋(authoring·nl-response·to-react)과 문서(04·05·06·08·EDITOR_STORE_CONTRACT)의 **모양 예시**도 이 PR에서 단색 배열로 바꾼다 — 안 바꾸면 LLM이 옛 모양을 내고 G3가 바로 거부한다. 2 전의 틈에는 linear를 만들 수 있는 도구(패널·NL 가르침)가 없으므로 손으로 쓴 문서만 영향을 받는다.
2. **렌더 PR** (의존: 1) — **완료(PR #213, 브랜치 `Yumesa2025/127-background-fill-render`).** 번역 함수에 linear 갈래와 `test/canvas-layout.test.ts` 케이스(`background-origin`은 1에서 이미 들어갔다). 캔버스와 홈 미리보기가 함께 바뀌었다 — `nodeStyles.ts`·`homePreview.ts`는 손대지 않았다. 이 문서와 더한 것은 수 표기 규칙 하나다(위 "캔버스 번역"). 스킬(authoring)과 [05](05-schema.md)·[06](06-schema-freeze.md)에 남아 있던 "캔버스가 아직 linear 겹을 그리지 않는다"는 서술도 같은 브랜치의 뒤 커밋에서 사실대로 고쳤다(그라디언트 작성을 가르치는 것은 4단계 몫이라 사실 서술만 바꿨다).
3. **패널 PR** (의존: 1, 머지는 2 뒤 — 편집 결과가 보여야 검증된다) — **완료(PR #214, 브랜치 `Yumesa2025/127-background-fill-panel`).** `backgroundPatch.ts`의 겹·stop 순수 함수와 `test/background-patch.test.ts`, `BackgroundSection` 목록 UI와 `LinearFillFields.tsx`·`fillButtons.ts`, `NumberField`의 `maxExclusive`. 이 문서보다 더 정한 것은 종류 전환·추가의 기본값, 위치 % 표시와 반올림, stop 안정 정렬과 포커스·burst 유지, 각도 칸의 360 거부다(위 "Command와 패널"). 3·4단계가 함께 진행돼 이 문서와 [07](07-implementation-status.md)의 상태 갱신은 충돌을 피하려고 5단계로 미뤘다.
4. **스킬·NL PR** (의존: 2 — 캔버스 번역과 코드 생성 매핑이 같아야 한다) — **완료(PR #215, 브랜치 `Yumesa2025/127-background-fill-skills`).** to-react 매핑 행과 Tailwind 표기 확인, authoring의 그라디언트 규칙, nl-response의 "배열 통째 쓰기·앞 = 위" 규칙, validate의 `Fill` 잡음 해석, [08](08-natural-language.md) 갱신. to-react 표기는 Tailwind v4.3.3 실측으로 `bg-[c]` + `bg-[image:…]` + `bg-origin-border`로 확정했다(위 "캔버스 번역"의 코드 생성 매핑).
5. **예제 PR** (의존: 2, 4가 있으면 스킬이 바로 가리킨다) — **완료(브랜치 `Yumesa2025/127-background-fill-examples`).** `examples/gradient-hero.json` — 히어로 linear(112.5°) 위 반투명 오버레이 linear(180°), 버튼 linear(90°), 반투명 오버레이 + 맨 아래 solid 카드, 딱 끊기는 stop(같은 `at` 0.62 두 개)의 진행 막대. [06](06-schema-freeze.md)의 검증된 예제 표에 한 줄, authoring·to-react 스킬이 이 예제를 가리킨다. 3·4단계가 미룬 이 문서와 [07](07-implementation-status.md)의 상태 갱신도 이 PR에서 했다.

반응형(#181) 스키마 PR과는 순서 의존이 없다. 나중에 머지되는 쪽이 위 "반응형 IR과의 관계"를 반영한다. `radial`·`image` 채우기, 겹 표시 토글은 일정에 넣지 않는다 — 셋 다 기존 문서를 깨지 않는 추가 변경이라 필요해질 때 따로 연다.

이 문서는 설계 결정을 기록한다. 위 1부터 정본 `Background`는 `Fill[]`이고 문서 버전은 0.3이다. 2부터 캔버스와 홈 미리보기가 `linear` 겹과 여러 겹을 그린다. 3부터 패널이 solid·linear 여러 겹을 편집하고, 4부터 스킬이 그라디언트 작성·NL 편집·코드 생성을 가르친다. 5의 예제가 그 모두를 한 화면에 담는다.


## #235 이미지 배경

`image` 갈래는 `src`와 `fit`을 필수로 갖는다. cover/contain/fill만 지원하고 반복은 없다.
세부설정 Background의 종류에서 이미지를 고르고 파일 가져오기 또는 assets 경로를 입력한다.
새 image 겹은 투명 1px로 시작하며 파일을 선택하기 전에는 기존 아래 겹을 가리지 않는다.
File Import와 같은 저장소·파일명 UUID 격리(병렬 Import도 기존 자산 보존)·data URI 폴백을 쓰고, 가져오는 동안 문서/선택이
바뀌면 기존 배열을 덮지 않는다. 저장 실패 시 data URI로 보존한다. 편집은 background 전체
배열을 Command로 교체해 Undo 한 단계이며 텍스트 경로 편집은 기존 burst를 따른다.

배경은 DOM을 추가하지 않는다. 기존 frame/button/input nodeStyles 및 홈 미리보기에서
공통 backgroundStyle을 사용한다. 이미지 URL 해석은 ImageNode의 imageSrc 도우미를 재사용한다.
맨 아래 solid 분리·앞이 위 순서·origin border-box는 유지한다. image가 있는 목록만
size/position/repeat longhand를 추가하고 gradient에는 auto, 이미지에는 cover/contain/100% 100%를
같은 인덱스로 대응한다. image를 제거하면 React가 longhand를 지워 기존 solid/linear로 돌아간다.

JSON Export는 스키마 검증 후 image 겹을 보존한다. 코드 Export는 to-react 스킬 매핑의
정적 fixture로 사진+gradient 및 assets 포함을 검사한다. 실제 AI 생성은 별도 검증 대상이다.
스키마 변경 PR은 독립 Draft로 팀 리뷰가 필요하고 기능 PR은 그 PR에 의존한다.
