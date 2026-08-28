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
  return (
    <PropertySection title="Size">
      <FieldRow>
        <SizeField label="너비 (W)" value={width} onChange={onWidthChange} />
        <SizeField label="높이 (H)" value={height} onChange={onHeightChange} />
      </FieldRow>
    </PropertySection>
  );
}
