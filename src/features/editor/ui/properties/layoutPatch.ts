import type { FrameNode, NodeId, Size } from "@/features/editor/schema";
import type { NodeFieldPatch } from "@/features/editor/store/editorStore";

type Layout = FrameNode["layout"];
type Direction = Layout["direction"];

/**
 * 격자로 바꿀 때 채워 줄 기본 열 개수.
 *
 * 1이면 세로(column)와 눈에 보이는 결과가 같다 — 사용자가 격자를 골랐는데
 * 아무 일도 안 일어난 것처럼 보인다. 2가 "격자로 바뀌었다"를 알리는 가장 작은 값이다.
 */
export const DEFAULT_GRID_COLUMNS = 2;

/**
 * 열 개수 상한. **스키마가 아니라 입력칸의 제약이다**(정본에는 `minimum: 1` 만 있다).
 *
 * 입력칸이 유효한 값을 칠 때마다 커밋하므로, 상한이 없으면 `10000` 을 치는 도중
 * `1 → 10 → 100 → 1000 → 10000` 이 차례로 스펙에 들어간다. 그때마다 캔버스가
 * `grid-template-columns: repeat(1000, 1fr)` 을 그리는데, 트랙 수에 비례해 레이아웃
 * 비용이 늘어 **오타 하나로 화면이 멎는다.** gap·fontSize 같은 다른 무제한 칸은
 * 값이 커져도 이런 비용이 없어서 그냥 두었다.
 *
 * 50 은 디자인 그리드로 의미 있는 범위를 넉넉히 덮는다.
 */
export const MAX_GRID_COLUMNS = 50;

/**
 * 방향을 바꾼 새 layout.
 *
 * 필드를 하나씩 쓰지 않고 layout 전체를 한 번에 바꾸는 이유는 **Undo 때문**이다.
 * `direction`과 `columns`를 따로 쓰면 히스토리에 두 단계가 쌓여, 격자를 골랐다가
 * 되돌릴 때 Ctrl+Z를 두 번 눌러야 한다. 사용자가 한 동작은 하나다.
 *
 * 격자를 벗어날 때 `columns`를 지운다 — row/column에서는 뜻이 없는 값이라,
 * 남겨 두면 export된 JSON을 읽는 쪽(생성기·리뷰어)이 의미 있는 지정으로 오해한다.
 * 효과 없는 값을 지우는 것은 `effectPatch`와 같은 규칙이다.
 */
export function layoutWithDirection(layout: Layout, direction: Direction): Layout {
  if (direction !== "grid") {
    const { columns: _columns, ...rest } = layout;
    return { ...rest, direction };
  }

  return {
    ...layout,
    direction,
    columns: layout.columns ?? DEFAULT_GRID_COLUMNS,
  };
}

/**
 * 칸에 보여 줄 열 개수. 스키마상 `columns`는 선택 필드고 없으면 1열로 본다.
 *
 * 값이 비어 있어도 칸을 비워 두지 않는다 — 스펙에 없는 것과 "1열"은 그리는
 * 결과가 같으므로, 실제로 그려지는 수를 보여 주는 편이 덜 헷갈린다.
 */
export function gridColumnsValue(layout: Layout): number {
  return layout.columns ?? 1;
}

/**
 * 주축 정렬 칸을 보여 줄 것인가.
 *
 * 그리드에서는 감춘다. `justify-content`는 트랙을 다 깔고 **남은 여백**이 있을 때
 * 트랙 뭉치를 미는 속성인데, 이 구현의 트랙은 `repeat(n, 1fr)`이라 언제나
 * 컨테이너를 꽉 채운다 — 밀 여백이 없어 값이 무엇이든 결과가 같다. 아무 일도
 * 하지 않는 컨트롤을 띄워 두면 사용자가 눌러 보고 "고장 났다"고 판단한다.
 */
export function showsMainAxis(direction: Direction): boolean {
  return direction !== "grid";
}

/**
 * 교차축 정렬 칸을 보여 줄 것인가. **그리드에서도 보여 준다.**
 *
 * 한때 주축과 함께 감췄는데 틀렸다. `align-items`는 grid 컨테이너에서도 그대로
 * 동작한다 — 아이템이 자기 행 트랙을 채울지(`stretch`) 위·가운데·아래에 붙을지를
 * 정한다. `frameStyle`이 `display: grid` 뒤에 `alignItems`를 조건 없이 얹으므로
 * 실제로 화면이 달라진다.
 *
 * 감춰 두면 `crossAxis: "start"` 인 프레임을 그리드로 바꿨을 때 자식이 늘어나지
 * 않는데 **되돌릴 컨트롤이 없다.** 효과가 있는 설정을 숨기는 쪽이 효과 없는
 * 컨트롤을 띄우는 쪽보다 나쁘다.
 */
export function showsCrossAxis(): boolean {
  return true;
}

/**
 * "자식 크기 균등" 버튼을 활성화할지(#150).
 *
 * 부모 자신의 주축 크기가 Hug(auto)면 안 된다. 자식을 fill(flex-grow, flex-basis 0)로
 * 만들어도 Hug인 부모는 채울 공간을 만들어 주지 않는다 — flex-basis가 0이라 부모의
 * 콘텐츠 크기 계산에도 안 잡혀, 부모가 거의 0까지 쪼그라들고 자식도 따라 0이 된다.
 * 시드 문서의 Card(direction: column, height: auto)에 적용해 보면 Label/Value가
 * 실제로 이렇게 무너진다. Figma의 "Fill container"도 부모가 Hug인 축에서는 그 옵션
 * 자체를 비활성화한다 — 같은 이유다.
 *
 * 교차축(stretch)은 부모가 Hug여도 안전하다. 정렬 후 크기를 나누는 flex-grow와 달리
 * align-items:stretch는 부모의 hug 크기(가장 큰 자식의 콘텐츠 기준)를 먼저 정하고
 * 나머지를 그 크기로 늘리는 것이라 collapse가 없다 — 그래서 이 함수는 주축만 본다.
 */
export function canEqualizeChildren(
  direction: Direction,
  parentMainAxisSize: Size,
  childCount: number,
): boolean {
  return direction !== "grid" && parentMainAxisSize !== "auto" && childCount >= 2;
}

/**
 * 자식 전부의 주축 크기를 fill로, 부모 교차축을 stretch로 맞추는 patch 묶음(#150).
 *
 * 지금은 자식 각각의 너비(또는 세로 레이아웃이면 높이)를 fill로, 부모의
 * 교차축 정렬을 stretch로 — 3번 나눠 눌러야 자식들 크기가 같아진다. 이 둘을
 * `setNodeFields`(#149) 한 번에 실어 보내면 history도 한 단계만 쌓인다.
 *
 * 그리드거나 부모의 주축이 Hug면 대상이 아니다 — 그리드는 트랙이 이미
 * `repeat(n, 1fr)`이라 너비가 자동으로 균등하고, Hug는 `canEqualizeChildren`이
 * 설명하는 이유로 적용하면 오히려 레이아웃이 무너진다. 호출부가 버튼을 숨기거나
 * 비활성화하더라도, 이 함수가 직접 no-op을 보장해야 재사용 시점에 실수로 깨지지 않는다.
 */
export function equalizeChildrenPatches(
  direction: Direction,
  parentMainAxisSize: Size,
  parentId: NodeId,
  childIds: readonly NodeId[],
): NodeFieldPatch[] {
  if (direction === "grid" || parentMainAxisSize === "auto") return [];

  const mainAxisField = direction === "row" ? "box.width" : "box.height";
  return [
    ...childIds.map((id) => ({ id, path: mainAxisField, value: "fill" as const })),
    { id: parentId, path: "layout.crossAxis", value: "stretch" as const },
  ];
}
