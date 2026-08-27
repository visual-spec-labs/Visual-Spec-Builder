import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";

import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import {
  ColorField,
  NumberField,
  SegmentedControl,
  SelectField,
  SizeField,
  TextField,
} from "./fields";

type TextAlign = "left" | "center" | "right";
type Size = number | "auto" | "fill";

const FONT_FAMILY_OPTIONS = [
  { value: "Pretendard", label: "Pretendard" },
  { value: "Manrope", label: "Manrope" },
  { value: "Inter", label: "Inter" },
  { value: "system-ui", label: "System UI" },
] as const;

const FONT_WEIGHT_OPTIONS = [
  { value: "400", label: "Regular (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semibold (600)" },
  { value: "700", label: "Bold (700)" },
] as const;

const ALIGN_OPTIONS = [
  { value: "left", content: <AlignLeft size={16} />, title: "왼쪽" },
  { value: "center", content: <AlignCenter size={16} />, title: "가운데" },
  { value: "right", content: <AlignRight size={16} />, title: "오른쪽" },
] as const;

/** Text 노드용 속성 섹션들. */
export function TextProperties() {
  const [content, setContent] = useNodeField<string>("content");

  const [width, setWidth] = useNodeField<Size>("box.width");
  const [height, setHeight] = useNodeField<Size>("box.height");

  const [fontFamily, setFontFamily] = useNodeField<string>("typography.fontFamily");
  const [fontSize, setFontSize] = useNodeField<number>("typography.fontSize");
  const [fontWeight, setFontWeight] = useNodeField<number>("typography.fontWeight");
  const [lineHeight, setLineHeight] = useNodeField<number>("typography.lineHeight");
  const [letterSpacing, setLetterSpacing] = useNodeField<number>("typography.letterSpacing");
  const [textAlign, setTextAlign] = useNodeField<TextAlign>("typography.textAlign");

  const [color, setColor] = useNodeField<string>("color");

  return (
    <>
      <PropertySection title="Content">
        <TextField label="텍스트" value={content} onChange={setContent} multiline />
      </PropertySection>

      <PropertySection title="Size">
        <div className="grid grid-cols-2 gap-2">
          <SizeField label="너비 (W)" value={width} onChange={setWidth} />
          <SizeField label="높이 (H)" value={height} onChange={setHeight} />
        </div>
      </PropertySection>

      <PropertySection title="Font">
        <SelectField
          label="종류"
          value={fontFamily}
          options={FONT_FAMILY_OPTIONS}
          onChange={setFontFamily}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="크기" value={fontSize} onChange={setFontSize} min={1} unit="px" />
          <SelectField
            label="굵기"
            value={fontWeight === undefined ? undefined : String(fontWeight)}
            options={FONT_WEIGHT_OPTIONS}
            onChange={(value) => setFontWeight(Number(value))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="행간"
            value={lineHeight}
            onChange={setLineHeight}
            min={0}
            unit="px"
          />
          <NumberField
            label="자간"
            value={letterSpacing}
            onChange={setLetterSpacing}
            step={0.1}
            unit="px"
          />
        </div>
        <SegmentedControl
          label="정렬"
          value={textAlign}
          options={ALIGN_OPTIONS}
          onChange={setTextAlign}
        />
      </PropertySection>

      <PropertySection title="Color">
        <ColorField label="글자색" value={color} onChange={setColor} />
      </PropertySection>
    </>
  );
}
