/**
 * 선택 표시(오버레이)가 그릴 사각형 계산.
 *
 * 선택 표시를 노드 엘리먼트에 인라인 outline으로 얹으면 그 노드의 opacity·blur를
 * 선택 표시까지 함께 받는다 — 반투명 노드를 고르면 주황 테두리도 흐려지고, 부모에
 * 불투명도를 주면 그 안 모든 자손의 선택 표시가 흐려진다. 편집기 UI가 문서 스타일을
 * 따라가면 안 되므로 문서 트리 바깥 레이어에 따로 그린다. 참고: #90
 *
 * DOM을 읽는 쪽(Canvas)과 계산을 나눠 이 파일만 테스트한다 — jsdom이 없어 컴포넌트
 * 렌더 테스트는 만들 수 없다.
 */

/**
 * 이 계산이 쓰는 네 값.
 *
 * `DOMRect`를 참조하지 않고 구조로만 정의한다 — 이 파일은 테스트(tsconfig.node,
 * `lib`에 DOM이 없다)에서도 컴파일되기 때문이다. getBoundingClientRect가 주는
 * DOMRect는 이 네 값을 갖고 있어 그대로 넘길 수 있다.
 */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 뷰포트 기준 사각형 둘을 받아 origin 기준 상대 좌표로 바꾼다.
 *
 * 둘 다 같은 순간의 뷰포트 좌표라 스크롤 오프셋이 서로 상쇄된다 — 캔버스를 스크롤해도
 * 결과가 변하지 않으므로 스크롤 이벤트를 따로 들을 필요가 없다.
 *
 * 대상은 transform: scale 안에 있어 이미 확대된 값이다. 오버레이를 확대되지 않은
 * 바깥 상자에 두면 이 값을 그대로 쓸 수 있고, 테두리 두께도 배율 보정 없이 어느
 * 확대율에서나 같은 굵기로 보인다.
 */
export function relativeRect(target: Rect, origin: Rect): Rect {
  return {
    left: round2(target.left - origin.left),
    top: round2(target.top - origin.top),
    width: round2(target.width),
    height: round2(target.height),
  };
}

/**
 * 두 사각형이 같은가.
 *
 * 측정은 렌더·DOM 변경마다 일어나므로, 값이 그대로면 상태를 바꾸지 않아 불필요한
 * 리렌더를 막는다. 이 비교가 없으면 측정 → setState → 렌더 → 측정이 끝나지 않는다.
 */
export function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

/**
 * 노드 id로 DOM을 찾을 선택자.
 *
 * id는 generateNodeId가 만들면 안전하지만 가져온(Import) 스펙은 무엇이든 담을 수
 * 있다. 따옴표·역슬래시가 들어오면 속성 선택자가 깨지므로 감싼다.
 */
export function nodeSelector(id: string): string {
  const escaped = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[data-node-id="${escaped}"]`;
}

/** 소수 2자리에서 끊는다 — 서브픽셀 값이 미세하게 흔들려도 상태가 요동치지 않게. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
