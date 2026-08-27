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
import { SizeSection } from "./SizeSection";
import { useNodeField } from "./useNodeField";
import {
  ColorField,
  FieldLabel,
  FieldRow,
  NumberField,
  SegmentedControl,
  SegmentOption,
  type Size,
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

/** Frame 노드용 속성 섹션들. */
export function FrameProperties() {
  const [direction, setDirection] = useNodeField<Direction>("layout.direction");
  const [gap, setGap] = useNodeField<number>("layout.gap");
  const [mainAxis, setMainAxis] = useNodeField<MainAxis>("layout.mainAxis");
  const [crossAxis, setCrossAxis] = useNodeField<CrossAxis>("layout.crossAxis");

  const [padTop, setPadTop] = useNodeField<number>("layout.padding.top");
  const [padRight, setPadRight] = useNodeField<number>("layout.padding.right");
  const [padBottom, setPadBottom] = useNodeField<number>("layout.padding.bottom");
  const [padLeft, setPadLeft] = useNodeField<number>("layout.padding.left");

  const [width, setWidth] = useNodeField<Size>("box.width");
  const [height, setHeight] = useNodeField<Size>("box.height");

  const [bgColor, setBgColor] = useNodeField<string>("background.color");

  const [borderWidth, setBorderWidth] = useNodeField<number>("border.width");
  const [borderColor, setBorderColor] = useNodeField<string>("border.color");
  const [borderRadius, setBorderRadius] = useNodeField<number>("border.radius");

  const dir: Direction = direction ?? "column";

  return (
    <>
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

      <SizeSection
        width={width}
        height={height}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
      />

      <PropertySection title="Background">
        <ColorField label="배경색" value={bgColor} onChange={setBgColor} />
      </PropertySection>

      <PropertySection title="Border">
        <FieldRow>
          <NumberField label="두께" value={borderWidth} onChange={setBorderWidth} min={0} unit="px" />
          <NumberField label="모서리 반경" value={borderRadius} onChange={setBorderRadius} min={0} unit="px" />
        </FieldRow>
        <ColorField label="테두리색" value={borderColor} onChange={setBorderColor} />
      </PropertySection>
    </>
  );
}
