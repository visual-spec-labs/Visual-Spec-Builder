# 05. Visual Spec Schema v0.1

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

## MVP 지원 범위

- Screen
- FrameNode
- TextNode
- 부모-자식 참조
- Layout
- Box
- Background
- Border
- Typography

## MVP 제외 범위

- ImageNode
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
