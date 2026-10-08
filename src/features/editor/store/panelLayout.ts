/**
 * 좌우 패널(레이어 트리·세부설정) 개별 접기·폭 상태(#287).
 *
 * `theme-storage.ts`·`specStorage.ts`와 같은 패턴이다 — `localStorage` 접근은
 * 항상 try/catch로 감싸고(프라이빗 모드·용량 초과 등으로 언제든 실패할 수
 * 있다), 저장된 값이 깨졌거나 없으면 조용히 기본값으로 돌아간다.
 *
 * `store/`가 DOM 타입 없이 검사된다는 규칙(`tsconfig.node.json` 머리말)은
 * **테스트 파일을 어느 tsconfig 프로젝트에 넣을지**에 대한 규칙이지, 소스
 * 파일 자체가 `localStorage`를 못 쓴다는 뜻이 아니다 — `@types/node`가
 * `localStorage` 전역 타입을 제공해 `tsc -b`는 그대로 통과한다. 테스트에서는
 * `vi.stubGlobal`로 흉내 낸다(`spec-storage.test.ts`와 같은 패턴,
 * `test/panel-layout.test.ts` 참고).
 */

/** 접힌 패널이 남기는 레일 폭 — 펼치기 버튼 하나만 들어간다. */
export const PANEL_RAIL_WIDTH = 32;

/**
 * 펼친 패널의 폭 범위. 480px은 패널이 캔버스보다 넓어지지 않도록 하는
 * 상한이다.
 *
 * 280px은 추정이 아니라 **실제 Chromium 재현으로 고친 값**이다(#287 리뷰
 * 대응). 처음엔 200px로 뒀는데(레이어 트리 행이 줄바꿈 없이 들어가는
 * 선만 어림), 실제로 1024×768에서 속성 패널을 200px까지 줄이고 Button을
 * 고르면 색상 hex·breakpoint ID 같은 텍스트 입력칸이 `clientWidth 20px`까지
 * 눌려 좌우 padding(10px×2)이 그 20px을 통째로 먹어 **입력 텍스트 영역이
 * 0px**이 됐다 — 그 칸들이 고정폭 스와치·불투명도·버튼과 한 줄(flex row)에
 * 있어 줄어드는 폭을 거의 전부 떠안기 때문이다(`ColorField.tsx`의 hex
 * input, `ResponsivePanel.tsx`의 "새 breakpoint ID" input). 내부 컨트롤을
 * 반응형으로 바꾸는 대신(여러 필드 컴포넌트를 건드려야 하고 회귀 범위가
 * 커진다) 최소 폭 자체를 그 실패 지점 위로 올렸다 — 350px(기본 속성 패널
 * 폭)에서는 hex 159px·ID 163px로 정상이었던 것에서 거슬러 올라가, 실패
 * 지점(200px)보다 확실히 위(약 60px 여유)인 280px로 잡았다.
 */
export const MIN_PANEL_WIDTH = 280;
export const MAX_PANEL_WIDTH = 480;

export const DEFAULT_TREE_WIDTH = 300;
export const DEFAULT_PROPS_WIDTH = 350;

/**
 * 드래그로 양쪽 패널을 동시에 MAX_PANEL_WIDTH까지 늘리면, 최소 지원 폭인
 * 1024px 창에서 Canvas가 1024-480-480=64px까지 줄어들 수 있었다(#287 리뷰
 * 대응) — "최소 지원 폭에서도 주요 조작이 된다"는 설계 결정 7번과 바로
 * 어긋난다. 정적 MAX_PANEL_WIDTH 하나로는 이걸 못 막는다 — 1920px 창에서는
 * 480+480이 전혀 문제가 안 되기 때문이다. 그래서 Canvas에 남겨 둘 최소
 * 폭(300px, 실용적으로 선택 가능한 선)을 따로 두고, 실제 창 폭에서 그만큼을
 * 뺀 나머지를 두 패널이 나눠 쓰게 동적으로 자른다(`maxResizableWidth`).
 */
export const MIN_CANVAS_WIDTH = 300;

export interface PanelLayoutState {
  treeCollapsed: boolean;
  treeWidth: number;
  propsCollapsed: boolean;
  propsWidth: number;
}

export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  treeCollapsed: false,
  treeWidth: DEFAULT_TREE_WIDTH,
  propsCollapsed: false,
  propsWidth: DEFAULT_PROPS_WIDTH,
};

/** 드래그 중인 폭을 저장 가능한 범위로 자른다. */
export function clampPanelWidth(width: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));
}

/** 패널이 지금 실제로 차지하는 폭 — 접혀 있으면 레일 폭(#287 리뷰 대응). */
export function effectivePanelWidth(collapsed: boolean, width: number): number {
  return collapsed ? PANEL_RAIL_WIDTH : width;
}

/**
 * 지금 창 폭에서 이 패널이 가질 수 있는 최대 폭(#287 리뷰 대응). 반대쪽
 * 패널이 지금 실제로 차지하는 폭(접혀 있으면 레일 폭)과 Canvas 최소 폭을
 * 뺀 나머지다. 창이 아주 좁아 그 나머지가 MIN_PANEL_WIDTH보다도 작아지면
 * MIN_PANEL_WIDTH를 돌려준다 — 이 함수는 "더 못 늘리게" 막는 상한일
 * 뿐이고, 하한(MIN_PANEL_WIDTH)을 침범하지는 않는다(펼친 패널이 그보다
 * 좁아지면 280px 결정 자체가 다시 깨진다, `clampPanelWidth` 참고). 그런
 * 아주 좁은 창에서는 Canvas가 더 줄어드는 쪽을 받아들인다 — 패널을 접는
 * 것이 그 상황의 실제 해법이다.
 */
export function maxResizableWidth(windowWidth: number, otherPanelEffectiveWidth: number): number {
  return Math.max(MIN_PANEL_WIDTH, windowWidth - otherPanelEffectiveWidth - MIN_CANVAS_WIDTH);
}

/**
 * 접힌 패널을 펼칠 때 저장된 폭을 그대로 복원해도 되는지 판정한다(#287
 * 리뷰 2차 대응). 드래그·키보드 조절(`maxResizableWidth`를 직접 쓰는 쪽)은
 * "지금" 바뀌는 폭만 자르지만, 접힘→펼침은 **과거에 저장된** 폭을 그대로
 * 되돌려 놓는다 — 그 폭은 저장될 당시의 반대쪽 상태 기준으로는 괜찮았던
 * 값이라, 그 뒤 반대쪽을 넓힌 채로 이쪽을 펼치면(또는 반대 순서) 더 이상
 * 안 괜찮을 수 있다. 펼치는 쪽만 이 보정이 필요하다 — 접는 쪽은 항상
 * Canvas를 넓히기만 해서 상한을 어길 길이 없다.
 */
export function widthAfterExpand(
  storedWidth: number,
  windowWidth: number,
  otherPanelEffectiveWidth: number,
): number {
  return Math.min(storedWidth, maxResizableWidth(windowWidth, otherPanelEffectiveWidth));
}

const PANEL_LAYOUT_STORAGE_KEY = "visual-spec:panel-layout";

/**
 * 저장된 문자열을 유효한 레이아웃으로 바꾼다. 모양이 조금이라도 안 맞으면(필드
 * 누락·타입 다름 등) 그 필드만이 아니라 **전체를 기본값으로** 돌린다 — 부분
 * 복구는 "펼친 줄 알았는데 접혀 있었다" 같은 혼란을 만든다. 폭은 항상
 * `clampPanelWidth`를 거친다 — 상수를 나중에 좁히면(예: MAX_PANEL_WIDTH 축소)
 * 그 전에 저장된 값도 새 범위 안으로 들어온다.
 */
export function parsePanelLayout(raw: string | null): PanelLayoutState {
  if (raw === null) return DEFAULT_PANEL_LAYOUT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_PANEL_LAYOUT;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_PANEL_LAYOUT;

  const { treeCollapsed, treeWidth, propsCollapsed, propsWidth } =
    parsed as Record<string, unknown>;
  if (
    typeof treeCollapsed !== "boolean" ||
    typeof treeWidth !== "number" ||
    typeof propsCollapsed !== "boolean" ||
    typeof propsWidth !== "number" ||
    !Number.isFinite(treeWidth) ||
    !Number.isFinite(propsWidth)
  ) {
    return DEFAULT_PANEL_LAYOUT;
  }

  return {
    treeCollapsed,
    treeWidth: clampPanelWidth(treeWidth),
    propsCollapsed,
    propsWidth: clampPanelWidth(propsWidth),
  };
}

export function loadPanelLayout(): PanelLayoutState {
  try {
    return parsePanelLayout(localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY));
  } catch {
    return DEFAULT_PANEL_LAYOUT;
  }
}

export function savePanelLayout(state: PanelLayoutState): void {
  try {
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 프라이빗 모드 등으로 저장 실패해도 편집 자체를 막을 이유는 없다. */
  }
}
