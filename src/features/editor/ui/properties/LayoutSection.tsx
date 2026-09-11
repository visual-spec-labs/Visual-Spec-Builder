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

import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import {
  FieldLabel,
  FieldRow,
  NumberField,
  SegmentedControl,
  SegmentOption,
} from "./fields";

type Direction = "row" | "column";
type MainAxis = "start" | "center" | "end" | "space-between";
type CrossAxis = "start" | "center" | "end" | "stretch";

const ICON = 16;

const DIRECTION_OPTIONS = [
  { value: "column", content: "세로", title: "세로 (column)" },
  { value: "row", content: "가로", title: "가로 (row)" },
] as const;

// 주축/교차축은 레이아웃 방향에 따라 물리적 방향이 바뀌므로 아이콘도 방향별로 고른다.
const MAIN_AXIS_OPTIONS: Record<Direction, readonly SegmentOption<MainAxis>[]> = {
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

const CROSS_AXIS_OPTIONS: Record<Direction, readonly SegmentOption<CrossAxis>[]> = {
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
 * grid(`layout.direction: "grid"`)는 여기서 고를 수 없다. 스키마엔 있지만 칸을
 * 주려면 `layout.columns`도 함께 다뤄야 해서 별도 작업으로 남긴다.
 */
export function LayoutSection() {
  const [direction, setDirection] = useNodeField<Direction>("layout.direction");
  const [gap, setGap] = useNodeField<number>("layout.gap");
  const [mainAxis, setMainAxis] = useNodeField<MainAxis>("layout.mainAxis");
  const [crossAxis, setCrossAxis] = useNodeField<CrossAxis>("layout.crossAxis");

  const [padTop, setPadTop] = useNodeField<number>("layout.padding.top");
  const [padRight, setPadRight] = useNodeField<number>("layout.padding.right");
  const [padBottom, setPadBottom] = useNodeField<number>("layout.padding.bottom");
  const [padLeft, setPadLeft] = useNodeField<number>("layout.padding.left");

  const dir: Direction = direction ?? "column";

  return (
    <PropertySection title="Layout">
      <SegmentedControl
        label="방향"
        value={direction}
        options={DIRECTION_OPTIONS}
        onChange={setDirection}
      />
      <NumberField label="간격 (Gap)" value={gap} onChange={setGap} min={0} unit="px" />
      <div className="flex flex-col gap-1">
        <FieldLabel>패딩</FieldLabel>
        <FieldRow>
          <NumberField label="위" value={padTop} onChange={setPadTop} min={0} unit="px" />
          <NumberField label="오른쪽" value={padRight} onChange={setPadRight} min={0} unit="px" />
          <NumberField label="아래" value={padBottom} onChange={setPadBottom} min={0} unit="px" />
          <NumberField label="왼쪽" value={padLeft} onChange={setPadLeft} min={0} unit="px" />
        </FieldRow>
      </div>
      <SegmentedControl
        label="주축 정렬"
        value={mainAxis}
        options={MAIN_AXIS_OPTIONS[dir]}
        onChange={setMainAxis}
      />
      <SegmentedControl
        label="교차축 정렬"
        value={crossAxis}
        options={CROSS_AXIS_OPTIONS[dir]}
        onChange={setCrossAxis}
      />
    </PropertySection>
  );
}
