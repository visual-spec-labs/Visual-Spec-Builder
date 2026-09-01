# visual-spec-authoring — 설명

`skills/visual-spec-authoring/SKILL.md`는 에이전트가 실행 시 참조하는 지시문이다.
사람이 이 스킬이 뭘 하는지 파악하려면 이 문서를 본다.

## 이 스킬이 하는 일

Visual Spec JSON 문서를 새로 쓰거나 기존 스펙 파일을 고친다. 산출물은 JSON 그 자체다 —
React 코드가 아니다.

최소 유효 문서의 뼈대, `examples/` 5개가 공통으로 지키는 관용구(평평한 `nodes` 맵과
`children` 참조로만 트리를 만든다, `layout` 5개 필드를 생략 없이 다 적는다, TextNode의
`height`는 예외 없이 `"auto"`다 등), `examples/invalid/` 8개에서 실제로 반복되는 실수 목록을
담고 있다.

### v0.1 제약 — 노드 타입은 셋뿐이다

이 스킬을 쓸 때 가장 먼저 알아야 할 제약이다. **v0.1이 지원하는 노드 타입은 `frame`,
`text`, `image` 셋뿐이다.** `button`, `input`, `component` 같은 타입은 여전히 없다.

`image`(`ImageNode`)는 `background`·`border`·`children`이 없는 leaf 노드다. 필수 필드는
`type`, `name`, `box`, `src`(assets 상대 경로/assetId), `fit`(`cover`/`contain`/`fill`).
실물 예제는 `examples/image-hero.json`.

그래서 "버튼 넣어줘" 같은 요청이 오면 에이전트는 타입을 지어내지 않고 프레임과 텍스트로
근사한다. 그리고 **근사했다는 사실을 사용자에게 알린다.** 조용히 넘어가면 사용자는 버튼
노드가 실제로 생긴 줄 안다. 근사가 마음에 들지 않으면 그 자리에서 다시 논의하면 된다.

### 다 쓰면 반드시 검증한다

작성이 끝났다고 완료가 아니다. 이 스킬은 `validateVisualSpec`을 돌리기 전에는 완료라고
말하지 않는다. 스펙은 눈으로 봐서 맞아 보여도 참조가 어긋나 있는 경우가 흔하다 —
`children`에 적은 ID의 노드를 안 만들었다거나, 지운 노드의 참조만 남았다거나.

검증이 실패하면 흐름은 [visual-spec-validate](./visual-spec-validate.md)로 넘어간다.
`issues`를 읽는 규칙이 따로 필요할 만큼 까다로워서 스킬이 분리돼 있다.

### 이미 코드로 만든 화면에 피드백이 왔을 때

`visual-spec-to-react`로 코드까지 만든 화면에 "버튼 색 바꿔줘" 같은 후속 피드백이 오면
**코드가 아니라 이 스펙 JSON을 고친다.** 코드를 직접 손대면 다음 재생성 때 그 수정이
사라지고, JSON이 source of truth라는 전제가 깨진다. JSON을 고치고 검증한 뒤
[visual-spec-to-react](./visual-spec-to-react.md)로 넘겨 재생성한다.

## 언제 실행되는가

`skills/visual-spec-authoring/SKILL.md`의 `description`에 적힌 조건과 매칭될 때 자동으로
붙거나, 사용자가 직접 이름을 불러 실행한다.

- "로그인 화면 스펙 만들어줘"
- "이 JSON에 카드 하나 더 넣어줘", "노드 추가해줘"
- "이 프레임 안에 텍스트 넣어줘"
- "examples에 있는 거 비슷하게 하나 만들어줘"
- 이미 코드로 만든 화면에 "버튼 색 바꿔줘", "제목 좀 크게" 같은 후속 피드백이 왔을 때

이미 완성된 스펙을 React 코드로 옮기는 작업은 대상이 아니다. "이 JSON 화면으로 만들어줘"는
[visual-spec-to-react](./visual-spec-to-react.md) 쪽이다.

## 어떻게 쓰는가

1. 만들거나 고칠 화면을 말한다. 기존 파일을 고치는 거면 경로를 준다.
2. 뼈대와 `examples/`의 관용구를 따라 JSON이 나온다.
3. 표현할 수 없는 요구가 있었으면 어떻게 근사했는지 함께 알려준다.
4. `validateVisualSpec`으로 검증한다. `valid: true`가 나와야 끝이다.
5. 실패하면 [visual-spec-validate](./visual-spec-validate.md)로 이어진다.

## 이 스킬이 하지 않는 것

- React/TSX 코드 생성 → [visual-spec-to-react](./visual-spec-to-react.md)가 맡는다
- 검증 실패 해석 → [visual-spec-validate](./visual-spec-validate.md)가 맡는다
- v0.1에 없는 노드 타입 지어내기 (근사하고 알린다)
- 스키마 정의 암기. 필드 판단이 필요하면 정본을 읽는다 →
  [visual-spec-docs](./visual-spec-docs.md)가 찾는 법을 준다

뼈대 JSON, 관용구 목록, 자주 틀리는 지점은 `skills/visual-spec-authoring/SKILL.md` 본문을 본다.
어느 스킬로 가야 할지 모르겠으면 [visual-spec](./visual-spec.md) 허브로 돌아간다.
