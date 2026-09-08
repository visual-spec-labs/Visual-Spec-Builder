# 05. Visual Spec Schema — 파일 v0.1 / 런타임 v0.2

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

## 버전 상태 — v0.1과 v0.2가 나란히 있다

정본 스키마 파일 하나에 최상위 타입이 둘 들어 있다. 한쪽이 다른 쪽을 대체한 것이 아니다.

| | `VisualSpec` | `ProjectSpec` |
|---|---|---|
| 뜻 | 파일 1개 = 화면 1개 | 파일 1개 = 페이지 여러 개 |
| `version` | `"0.1"` | `"0.2"` |
| 정본에서의 위치 | **스키마 루트** | `$defs.ProjectSpec` |

**정본 스키마의 루트는 아직 v0.1이다.** 최상위 `required`는 `["version", "screen"]`이고
`version`은 `const: "0.1"`이다. v0.2인 `ProjectSpec`은 루트가 아니라 `$defs` 항목으로만 있다.
루트를 v0.1로 유지하기 위해 일부러 그렇게 둔 것이다(이유는 06의 v0.2 절 참고).

**런타임은 이미 v0.2를 쓴다.** `editorStore`가 들고 있는 상태는 `ProjectSpec`이고,
v0.1 문서를 열면 `migrateV01`이 페이지 1개짜리 `ProjectSpec`으로 올린다.
반대 방향은 `toVisualSpec`이다.

즉 **파일 포맷의 정본은 v0.1, 편집 중 메모리 모델은 v0.2**다.
아래 "MVP 지원 범위"는 두 갈래 모두를 합친 정본 `$defs` 기준으로 적는다.

## MVP 지원 범위

- Screen (`ScreenSpec` — `name` / `size` / `root` / `nodes`)
- FrameNode
- TextNode
- ImageNode (`src` + `fit`: `cover` | `contain` | `fill`)
- ButtonNode (`content` — 표시용 라벨)
- InputNode (`placeholder` — 표시용 텍스트)
- 부모-자식 참조
- Layout (`direction`: `row` | `column` | `grid`, grid일 때 `columns`)
- Box (`width` / `height` — `number` | `"auto"` | `"fill"`)
- Background (단색 한 겹)
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
- 반응형
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
