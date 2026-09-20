import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";

import type { FrameNode } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";

import {
  canEqualizeChildren,
  equalizeChildrenPatches,
  gridColumnsValue,
  layoutWithDirection,
  MAX_GRID_COLUMNS,
  showsCrossAxis,
  showsMainAxis,
} from "./layoutPatch";
import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import {
  FieldLabel,
  FieldRow,
  NumberField,
  SegmentedControl,
  SegmentOption,
} from "./fields";

type Layout = FrameNode["layout"];
type Direction = Layout["direction"];
/** 주축/교차축 아이콘은 방향별로 다르다. 그리드는 정렬 자체를 안 쓰므로 빠진다. */
type FlexDirection = "row" | "column";
type MainAxis = "start" | "center" | "end" | "space-between";
type CrossAxis = "start" | "center" | "end" | "stretch";

const ICON = 16;

const DIRECTION_OPTIONS: readonly SegmentOption<Direction>[] = [
  { value: "column", content: "세로", title: "세로 (column)" },
  { value: "row", content: "가로", title: "가로 (row)" },
  { value: "grid", content: "그리드", title: "그리드 (grid) — 열 N개 균등 배치" },
];

// 주축/교차축은 레이아웃 방향에 따라 물리적 방향이 바뀌므로 아이콘도 방향별로 고른다.
const MAIN_AXIS_OPTIONS: Record<FlexDirection, readonly SegmentOption<MainAxis>[]> = {
  row: [
    { value: "start", title: "왼쪽", content: <AlignHorizontalJustifyStart size={ICON} /> },
    { value: "center", title: "가운데", content: <AlignHorizontalJustifyCenter size={ICON} /> },
    { value: "end", title: "오른쪽", content: <AlignHorizontalJustifyEnd size={ICON} /> },
    { value: "space-between", title: "양끝", content: <AlignHorizontalSpaceBetween size={ICON} /> },
  ],
  column: [
    { value: "start", title: "위", content: <AlignVerticalJustifyStart size={ICON} /> },
    { value: "center", title: "가운데", content: <AlignVerticalJustifyCenter size={ICON} /> },
    { value: "end", title: "아래", content: <AlignVerticalJustifyEnd size={ICON} /> },
    { value: "space-between", title: "양끝", content: <AlignVerticalSpaceBetween size={ICON} /> },
  ],
};

const CROSS_AXIS_OPTIONS: Record<FlexDirection, readonly SegmentOption<CrossAxis>[]> = {
  row: [
    { value: "start", title: "위", content: <AlignStartHorizontal size={ICON} /> },
    { value: "center", title: "가운데", content: <AlignCenterHorizontal size={ICON} /> },
    { value: "end", title: "아래", content: <AlignEndHorizontal size={ICON} /> },
    { value: "stretch", title: "채움", content: <StretchVertical size={ICON} /> },
  ],
  column: [
    { value: "start", title: "왼쪽", content: <AlignStartVertical size={ICON} /> },
    { value: "center", title: "가운데", content: <AlignCenterVertical size={ICON} /> },
    { value: "end", title: "오른쪽", content: <AlignEndVertical size={ICON} /> },
    { value: "stretch", title: "채움", content: <StretchHorizontal size={ICON} /> },
  ],
};

/**
 * 레이아웃 — 방향 · 간격 · 패딩 · 주축/교차축 정렬.
 *
 * `layout`을 갖는 노드는 frame뿐이라 지금은 frame 전용이다. 그래도 섹션으로
 * 떼어 둔 이유는 나머지와 같다 — PropertiesPanel이 표 하나로 조립하게 하려면
 * 모든 섹션이 같은 모양이어야 한다(#92).
 *
 * 그리드(`direction: "grid"`)는 열 N개짜리 균등 자동 배치가 전부다 — 특정 자식을
 * 특정 셀이나 여러 칸에 놓는 기능은 없다. 정렬 중에서는 **주축만** 무의미하고
 * (트랙이 `1fr` 이라 `justify-content` 가 밀 여백이 없다) **교차축은 동작한다**
 * (`align-items` 가 행 트랙 안에서 아이템을 늘릴지 붙일지 정한다). 그래서 주축
 * 칸만 감춘다 — 자세한 근거는 `layoutPatch` 의 `showsMainAxis`/`showsCrossAxis`.
 */
export function LayoutSection() {
  // 방향을 바꿀 때 columns도 함께 손대야 해서 layout 전체를 읽고 쓴다 — 두 필드를
  // 따로 쓰면 Undo가 두 단계로 쌓여 한 동작을 되돌리는 데 Ctrl+Z를 두 번 눌러야 한다.
  const [layout, setLayout] = useNodeField<Layout>("layout");
  const [gap, setGap] = useNodeField<number>("layout.gap");
  const [columns, setColumns] = useNodeField<number>("layout.columns");
  const [mainAxis, setMainAxis] = useNodeField<MainAxis>("layout.mainAxis");
  const [crossAxis, setCrossAxis] = useNodeField<CrossAxis>("layout.crossAxis");

  const [padTop, setPadTop] = useNodeField<number>("layout.padding.top");
  const [padRight, setPadRight] = useNodeField<number>("layout.padding.right");
  const [padBottom, setPadBottom] = useNodeField<number>("layout.padding.bottom");
  const [padLeft, setPadLeft] = useNodeField<number>("layout.padding.left");

  const selectedId = useEditorStore((state) => state.selectedId);
  const node = useEditorStore((state) =>
    selectedId === null
      ? undefined
      : state.spec.pages[state.activePageId].nodes[selectedId],
  );
  const setNodeFields = useEditorStore((state) => state.setNodeFields);
  const frameNode = node !== undefined && node.type === "frame" ? node : undefined;
  const children = frameNode?.children ?? [];

  const direction = layout?.direction;
  const dir: FlexDirection = direction === "row" ? "row" : "column";

  // 부모 자신의 주축 크기 — canEqualizeChildren이 Hug(auto)를 걸러내는 데 쓴다.
  const parentMainAxisSize =
    frameNode === undefined
      ? undefined
      : direction === "row"
        ? frameNode.box.width
        : frameNode.box.height;
  const canEqualize =
    direction !== undefined &&
    parentMainAxisSize !== undefined &&
    canEqualizeChildren(direction, parentMainAxisSize, children.length);

  function changeDirection(next: Direction) {
    if (layout === undefined) return;
    setLayout(layoutWithDirection(layout, next));
  }

  function equalizeChildren() {
    if (selectedId === null || direction === undefined || parentMainAxisSize === undefined) {
      return;
    }
    setNodeFields(
      equalizeChildrenPatches(
        direction,
        parentMainAxisSize,
        selectedId,
        children.map((child) => child.node),
      ),
    );
  }

  return (
    <PropertySection title="Layout">
      <SegmentedControl
        label="방향"
        value={direction}
        options={DIRECTION_OPTIONS}
        onChange={changeDirection}
      />
      <NumberField label="간격 (Gap)" value={gap} onChange={setGap} min={0} unit="px" />
      {direction === "grid" && (
        <NumberField
          label="열 개수"
          // 스키마상 columns는 선택 필드다. 비어 있으면 1열로 그려지므로 칸을
          // 비워 두지 않고 실제로 그려지는 수를 보여 준다.
          value={layout === undefined ? columns : gridColumnsValue(layout)}
          onChange={setColumns}
          min={1}
          max={MAX_GRID_COLUMNS}
          step={1}
          integer
        />
      )}
      <div className="flex flex-col gap-1">
        <FieldLabel>패딩</FieldLabel>
        <FieldRow>
          <NumberField label="위" value={padTop} onChange={setPadTop} min={0} unit="px" />
          <NumberField label="오른쪽" value={padRight} onChange={setPadRight} min={0} unit="px" />
          <NumberField label="아래" value={padBottom} onChange={setPadBottom} min={0} unit="px" />
          <NumberField label="왼쪽" value={padLeft} onChange={setPadLeft} min={0} unit="px" />
        </FieldRow>
      </div>
      {/*
        그리드에서는 주축 정렬만 감춘다. 트랙이 `1fr` 이라 컨테이너를 꽉 채워
        justify-content 가 밀 여백이 없기 때문이다. **교차축은 그리드에서도
        동작하므로 감추지 않는다** — align-items 가 행 트랙 안에서 아이템을
        늘릴지 붙일지 정한다(layoutPatch 주석 참고).
      */}
      {showsMainAxis(direction ?? "column") && (
        <SegmentedControl
          label="주축 정렬"
          value={mainAxis}
          options={MAIN_AXIS_OPTIONS[dir]}
          onChange={setMainAxis}
        />
      )}
      {showsCrossAxis() && (
        <SegmentedControl
          label="교차축 정렬"
          value={crossAxis}
          options={CROSS_AXIS_OPTIONS[dir]}
          onChange={setCrossAxis}
        />
      )}
      {direction !== undefined && direction !== "grid" && (
        <button
          type="button"
          onClick={equalizeChildren}
          disabled={!canEqualize}
          title={
            parentMainAxisSize === "auto"
              ? "부모 크기가 Hug라 채울 공간이 없다. 너비/높이를 Fixed나 Fill로 바꾼 뒤 눌러라."
              : "모든 자식의 크기를 같게 맞춘다 (주축 → Fill, 교차축 → 채움)"
          }
          className="w-full rounded-control border border-line bg-surface py-1.5 text-xs font-medium text-content hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          자식 크기 균등
        </button>
      )}
    </PropertySection>
  );
}
