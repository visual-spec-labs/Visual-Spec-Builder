import { useMeasureStore } from "@/features/editor/store/measureStore";

import { PropertySection } from "./PropertySection";
import { FieldRow, SizeField, type Size } from "./fields";

interface SizeSectionProps {
  width: Size | undefined;
  height: Size | undefined;
  onWidthChange: (value: Size) => void;
  onHeightChange: (value: Size) => void;
}

/** Frame/Text 공통 Size 섹션 — 너비(W) / 높이(H). */
export function SizeSection({
  width,
  height,
  onWidthChange,
  onHeightChange,
}: SizeSectionProps) {
  // Hug/Fill은 스펙에 숫자가 없어, 캔버스가 올려준 실측 px를 대신 보여준다.
  const measured = useMeasureStore((state) => state.size);

  return (
    <PropertySection title="Size">
      <FieldRow>
        <SizeField
          label="너비 (W)"
          value={width}
          onChange={onWidthChange}
          measured={measured?.width}
        />
        <SizeField
          label="높이 (H)"
          value={height}
          onChange={onHeightChange}
          measured={measured?.height}
        />
      </FieldRow>
    </PropertySection>
  );
}
