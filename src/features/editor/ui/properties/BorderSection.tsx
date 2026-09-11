import { useState } from "react";

import type { Border } from "@/features/editor/schema";

import { isBlankBorder, mergeBorder } from "./borderPatch";
import { PropertySection } from "./PropertySection";
import {
  isPerCorner,
  mergeCornerRadius,
  toPerCorner,
  toUniform,
  type CornerRadius,
} from "./radiusPatch";
import { useNodeField } from "./useNodeField";
import { ColorField, FieldRow, NumberField, SegmentedControl } from "./fields";

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

/**
 * 테두리 — 두께 · 모서리 반경 · 색 · 정렬.
 *
 * `Border`를 갖는 frame · button · input이 공유한다. 예전에는 FrameProperties
 * 안에만 있어서 button·input은 스키마에 필드가 있는데도 편집할 수 없었다(#92).
 */
export function BorderSection() {
  const [border, setBorder] = useNodeField<Border | undefined>("border");

  // 모서리 모드를 스펙에서 파생하지 않고 따로 든다.
  //
  // 아무것도 그리지 않는 border를 지우게 되면서(isBlankBorder, #89) 파생이 성립하지
  // 않는다 — 테두리 없는 노드에서 "개별"을 눌러도 남는 값이 없어 모드가 곧바로
  // "전체"로 되돌아오고, 값을 넣을 네 칸이 뜨질 않는다. 화면 상태로 기억해야 한다.
  //
  // 다른 노드를 고르면 초기화돼야 하는데, PropertiesPanel이 selectedId를 key로
  // 걸어 섹션 전체를 다시 마운트한다.
  const [perCornerMode, setPerCornerMode] = useState(false);

  const radius = border?.radius;
  // 스펙에 모서리별 값이 있으면 모드와 무관하게 개별이다. 모드는 "아직 값이 없지만
  // 개별로 넣겠다"는 의사만 담는다.
  const showCorners = isPerCorner(radius) || perCornerMode;
  const corners: CornerRadius | undefined = showCorners
    ? toPerCorner(radius)
    : undefined;

  function updateBorder(patch: Partial<Border>) {
    const next = mergeBorder(border, patch);
    // 아무것도 그리지 않는 객체는 스펙에 남기지 않는다 — 효과 필드가 항등값에서
    // 필드를 지우는 것과 같은 기준이다.
    setBorder(isBlankBorder(next) ? undefined : next);
  }

  function updateCornerRadius(patch: Partial<CornerRadius>) {
    updateBorder({ radius: mergeCornerRadius(radius, patch) });
  }

  return (
    <PropertySection title="Border">
      <FieldRow>
        <NumberField
          label="두께"
          value={border?.width}
          onChange={(width) => updateBorder({ width })}
          min={0}
          unit="px"
        />
        {!showCorners && (
          <NumberField
            label="모서리 반경"
            // toUniform은 모드 전환용이다 — 여기서 쓰면 테두리가 없는 노드에도 0이
            // 찍혀 옆 "두께" 칸(빈칸)과 기준이 어긋난다. 값이 없으면 비워 둔다.
            value={typeof radius === "number" ? radius : undefined}
            onChange={(radius) => updateBorder({ radius })}
            min={0}
            unit="px"
          />
        )}
      </FieldRow>
      <SegmentedControl
        label="모서리"
        value={showCorners ? "corner" : "uniform"}
        options={RADIUS_MODE_OPTIONS}
        // 전환 순간에 모양이 바뀌지 않도록 지금 값을 그대로 옮긴다.
        onChange={(mode) => {
          setPerCornerMode(mode === "corner");
          updateBorder({
            radius: mode === "corner" ? toPerCorner(radius) : toUniform(radius),
          });
        }}
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
  );
}
