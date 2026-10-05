# 05. Visual Spec Schema — v0.3 (화면 문서 / 프로젝트 문서)

> 출처: ClickUp 팀 문서 `json 초안`
> 정본은 [`src/features/editor/schema/visual-spec.schema.json`](../src/features/editor/schema/visual-spec.schema.json)이다.
> 타입과 검증기는 개별 파일이 아니라 디렉터리 index [`src/features/editor/schema/`](../src/features/editor/schema/)를 거쳐 가져온다.
> 예시는 [`examples/`](../examples/)에 있다.
> 변경 규칙과 공개 표면의 전문은 [`06-schema-freeze.md`](06-schema-freeze.md)에 있다.

## 목적

GUI에서 사용자가 생성하거나 수정한 화면 데이터를
JSON 형식으로 저장하기 위한 최소 스키마를 정의한다.

이번 버전은 스키마의 완성본이 아니라
Canvas Renderer, Layer Tree, Inspector가 공통으로 사용할
첫 번째 MVP 계약이다.

## 버전 상태 — 두 최상위 타입이 같은 0.3을 쓴다

정본 스키마 파일 하나에 최상위 타입이 둘 들어 있다. 한쪽이 다른 쪽을 대체한 것이 아니다.

| | `VisualSpec` | `ProjectSpec` |
|---|---|---|
| 뜻 | 파일 1개 = 화면 1개 | 파일 1개 = 페이지 여러 개 |
| `version` | `"0.3"` | `"0.3"` |
| 가르는 키 | `screen` | `pages` |
| 정본에서의 위치 | **스키마 루트** | `$defs.ProjectSpec` |

**버전 문자열은 IR 세대를 뜻한다(#127).** 0.2까지는 `VisualSpec`이 `"0.1"`, `ProjectSpec`이
`"0.2"`였고 버전으로 둘을 갈랐다. 배경이 채우기 겹 배열로 바뀌면서(아래 Background) 둘 다
`"0.3"`이 됐고, 화면 문서와 프로젝트 문서는 이제 키(`screen` / `pages`)로 가른다. 0.1·0.2 파일은
앱이 열 때 `migrateToV03`로 자동 변환한다(검증 전에). 저장은 항상 0.3이다 — 자세한 것은
[06의 v0.3 절](06-schema-freeze.md#v03--배경-채우기-겹-배열-2026-10-04-추가-127).

`ProjectSpec`이 루트가 아니라 `$defs` 항목인 이유는 06의 v0.2 절 참고.

**런타임은 프로젝트 문서를 쓴다.** `editorStore`가 들고 있는 상태는 `ProjectSpec`이고,
화면 문서를 열면 `migrateV01`이 페이지 1개짜리 `ProjectSpec`으로 넓힌다(이름은 v0.1 시절
그대로다). 반대 방향은 `toVisualSpec`이다.
아래 "MVP 지원 범위"는 두 갈래 모두를 합친 정본 `$defs` 기준으로 적는다.

## MVP 지원 범위

- Screen (`ScreenSpec` — `name` / `size` / `root` / `nodes`)
  - **`size`는 문서 크기가 아니라 화면(창) 크기다.** 정본 스키마의 설명도 "Screen 크기"라고 적고 있다.
    `width`는 문서 폭 그대로지만, **`height`는 첫 화면 높이이자 최소 높이**다 — 내용이 그보다 길면
    문서가 세로로 자라고 캔버스는 스크롤된다(2026-09-11·이슈 #86).
    **root 노드의 `box`는 여기에 영향을 주지 않는다.** 페이지 크기를 정하는 것은 `size` 하나이고,
    캔버스는 root 의 `box` 를 보지 않는다(근거는 [`06-schema-freeze.md`](06-schema-freeze.md)의
    `fill` 절). 그래서 root 를 Fixed 나 Hug 로 바꿔도 페이지 네모가 작아지거나 뚫리지 않는다.
    1440×900은 1440px 폭의 문서를 900px 창에서 본다는 뜻이지, 900px에서 잘린다는 뜻이 아니다.
    스키마는 바뀌지 않았다 — 캔버스가 `height`를 문서 높이로 잠가 두던 것을 이 문구에 맞춘 것이다.
- FrameNode
- TextNode
- ImageNode (`src` + `fit`: `cover` | `contain` | `fill`)
  - `src`는 비어 있지 않은 문자열이다. assets 기준 상대 경로, `assetId`, 기존 문서와 폴백의 base64 data URI를 허용한다.
    JSON Schema는 문자열 형태만 검사한다. Import가 쓰는 경로와 폴백은
    [06-schema-freeze.md](06-schema-freeze.md)의 assets 절을 따른다.
- ButtonNode (`content` — 표시용 라벨)
- InputNode (`placeholder` — 표시용 텍스트)
- 부모-자식 참조
- Layout (`direction`: `row` | `column` | `grid`; `columns`는 선택 정수이며 1 이상, 생략 시 grid는 1열)
- Box (`width` / `height` — 0 이상 숫자(px) | `"auto"` | `"fill"`)
- Background — 채우기 겹 배열(`Fill[]`, 0.3부터). 배열 앞이 위 겹이고, 생략과 `[]`는 둘 다 배경 없음
  - 겹 종류는 `solid`(`color`)와 `linear`(`angle` — CSS `linear-gradient` 각도, `[0, 360)` / `stops` — `{ color, at }` 2개 이상, `at`은 0..1 오름차순)
  - #235 이미지 겹은 `image`(`src`, `fit`: cover/contain/fill)다. 중앙 정렬·반복 없음
  - 단색은 `[{ "type": "solid", "color": "#FFFFFF" }]` 한 겹이다. 0.2까지의 `{ "color": … }`는 무효다
  - 겹마다 불투명도는 없다 — 색의 알파(`#RRGGBBAA`)로 쓴다
  - 캔버스와 홈 미리보기는 `linear`·`image` 겹과 여러 겹을 그리고, 패널은 겹 목록(추가·삭제·위/아래 이동·종류 전환, solid 색, linear 각도·stop, image 파일·src·fit)을 편집한다(설계는 [13](13-background-fill-design.md))
- Border (`width` / `color` / `radius` / `align`)
  - `radius`는 숫자 하나 또는 모서리별 객체(`topLeft` `topRight` `bottomRight` `bottomLeft`)
  - `align`은 `inside` | `center` | `outside`, 생략 시 `inside`
- Typography
- 효과
  - Shadow — `frame`만
  - Opacity — `frame` · `text` · `image`, 생략 시 `1`
  - Blur — `frame` · `text` · `image`, 생략 시 `0` (레이어 블러)
- 멀티 페이지 (`ProjectSpec` / `PageId` — `pages` 맵 + `pageOrder` 배열)

## MVP 제외 범위

- InstanceNode
- ComponentSpec
- TokenSet
- props
- bindings
- events
- variants
- states
- slots
- 반응형 GUI·코드 생성 — IR 선택 필드는 아래 #222 PR 제안 절을 참조한다.
- Tailwind 클래스 변환
- React 코드 생성

`button`과 `input`이 지원 범위에 들어왔지만 상호작용은 여전히 제외다.
두 노드의 `content` / `placeholder`는 표시용 텍스트일 뿐이고
`onClick` / `value` / `onChange`는 정의하지 않는다.

## 확정 규칙

### 노드 ID

- `nodes` 객체의 key를 노드 ID로 사용한다.
- 노드 내부에 `id`를 중복 저장하지 않는다.
- `root`는 `nodes`에 존재하는 key를 참조한다.
- `children[].node`는 `nodes`에 존재하는 key를 참조한다.
- 노드 ID는 한 Screen 안에서 고유하다.

### Children

```ts
interface ChildReference {
  node: string;
}
```

### 페이지 ID

- `pages` 객체의 key를 페이지 ID로 사용한다.
- 페이지 내부에 ID를 중복 저장하지 않는다. 노드 ID와 같은 관용구다.
- `pageOrder`는 `pages`의 key와 정확히 일치해야 한다.
  JSON Schema로는 표현할 수 없어 `validateProjectSpec`이 `page-order-mismatch`로 따로 잡는다.


## 반응형 선택 필드 (#222 PR 제안)

현재 상태: 아래 제안은 #245로 병합됐다.

`ScreenSpec.responsive`에 페이지별 `breakpoints`(ID → `{minWidthPx}`)와
`overrides`(breakpoint ID → node ID → 표현 속성의 부분값)를 둔다. 생략하면 기존 단일
레이아웃이다. 각 객체의 필수 기반값은 `nodes`에 있고, 폭 오름차순으로 객체를 병합하며
배열은 통째로 바꾼다. 문서 버전 0.3 유지의 호환성 제안과 타입별 제약은
[동결 계약의 확장 절](06-schema-freeze.md#반응형-선택-확장--222-pr-제안)을 참조한다.
GUI(#247)와 반응형 코드 생성 지침(#248·#252)도 후속 PR로 병합됐다.


### #235 이미지 배경 지원 (스키마 PR #254 선행)

frame/button/input의 background 배열에 image 겹을 지원한다: `{ type: "image", src, fit }`.
fit은 cover/contain/fill, 중앙 정렬, 반복 없음이다. ImageNode의 경로 해석과 파일 Import를
재사용한다. 파일명에는 UUID를 붙여 병렬 가져오기가 기존 assets를 덮지 않게 한다.
GUI는 파일 가져오기·경로·fit 및 기존 겹 추가/삭제/정렬·Undo를 제공한다. 사진 위 linear는
배열 앞에 linear, 뒤에 image로 표현한다. JSON Export는 배열을 보존하고 코드 Export는
생성 코드의 quoted URL assets 참조를 검증·포함한다. 상세 매핑은 배포 원본
`skills/visual-spec-to-react/SKILL.md`의 이미지 배경 절을 따른다.

현재 상태: 스키마 #254·기능 #257과 반응형 codegen 리뷰 수정 #252가 모두 병합됐다. 같은 스킬
문서의 이미지 배경·반응형 매핑은 통합 검사에서 함께 확인했다([07](07-implementation-status.md)).
fixture/브라우저 검증은 실제 AI 성공 검증이 아니다.
