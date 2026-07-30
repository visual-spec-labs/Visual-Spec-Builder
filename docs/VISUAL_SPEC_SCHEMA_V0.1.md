# Visual Spec Schema v0.1

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
