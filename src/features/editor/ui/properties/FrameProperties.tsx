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

import type { Border } from "@/features/editor/schema";

import { mergeBorder } from "./borderPatch";
import { EffectsSection } from "./EffectsSection";
import { PropertySection } from "./PropertySection";
import {
  isPerCorner,
  mergeCornerRadius,
  toPerCorner,
  toUniform,
  type CornerRadius,
} from "./radiusPatch";
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

// 스키마상 선택 필드지만 칸은 항상 셋 중 하나를 고른 상태로 둔다 —
// 값이 없을 때의 동작이 곧 inside라, 빈 상태를 따로 보여줄 이유가 없다.
const STROKE_ALIGN_OPTIONS = [
  { value: "inside", content: "안쪽", title: "안쪽 (inside)" },
  { value: "center", content: "가운데", title: "가운데 (center)" },
  { value: "outside", content: "바깥", title: "바깥 (outside)" },
] as const;

const RADIUS_MODE_OPTIONS = [
  { value: "uniform", content: "전체", title: "네 모서리를 같은 값으로" },
  { value: "corner", content: "개별", title: "모서리마다 따로" },
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

  const [border, setBorder] = useNodeField<Border>("border");

  const dir: Direction = direction ?? "column";
  // 불리언만으로는 아래 JSX에서 border?.radius가 좁혀지지 않는다 — 좁힌 값을 들고 간다.
  const radius = border?.radius;
  const corners = isPerCorner(radius) ? radius : undefined;

  function updateBorder(patch: Partial<Border>) {
    setBorder(mergeBorder(border, patch));
  }

  function updateCornerRadius(patch: Partial<CornerRadius>) {
    updateBorder({ radius: mergeCornerRadius(radius, patch) });
  }

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
          <NumberField
            label="두께"
            value={border?.width}
            onChange={(width) => updateBorder({ width })}
            min={0}
            unit="px"
          />
          {corners === undefined && (
            <NumberField
              label="모서리 반경"
              value={toUniform(radius)}
              onChange={(radius) => updateBorder({ radius })}
              min={0}
              unit="px"
            />
          )}
        </FieldRow>
        <SegmentedControl
          label="모서리"
          value={corners === undefined ? "uniform" : "corner"}
          options={RADIUS_MODE_OPTIONS}
          // 전환 순간에 모양이 바뀌지 않도록 지금 값을 그대로 옮긴다.
          onChange={(mode) =>
            updateBorder({
              radius:
                mode === "corner"
                  ? toPerCorner(radius)
                  : toUniform(radius),
            })
          }
        />
        {corners !== undefined && (
          <FieldRow>
            <NumberField
              label="좌상"
              value={corners.topLeft}
              onChange={(topLeft) => updateCornerRadius({ topLeft })}
              min={0}
              unit="px"
            />
            <NumberField
              label="우상"
              value={corners.topRight}
              onChange={(topRight) => updateCornerRadius({ topRight })}
              min={0}
              unit="px"
            />
            <NumberField
              label="우하"
              value={corners.bottomRight}
              onChange={(bottomRight) => updateCornerRadius({ bottomRight })}
              min={0}
              unit="px"
            />
            <NumberField
              label="좌하"
              value={corners.bottomLeft}
              onChange={(bottomLeft) => updateCornerRadius({ bottomLeft })}
              min={0}
              unit="px"
            />
          </FieldRow>
        )}
        <ColorField
          label="테두리색"
          value={border?.color}
          onChange={(color) => updateBorder({ color })}
        />
        <SegmentedControl
          label="정렬"
          value={border?.align ?? "inside"}
          options={STROKE_ALIGN_OPTIONS}
          onChange={(align) => updateBorder({ align })}
        />
      </PropertySection>

      <EffectsSection withShadow />
    </>
  );
}
