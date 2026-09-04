import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";

import { EffectsSection } from "./EffectsSection";
import { PropertySection } from "./PropertySection";
import { SizeSection } from "./SizeSection";
import { useNodeField } from "./useNodeField";
import {
  ColorField,
  FieldRow,
  NumberField,
  SegmentedControl,
  SelectField,
  TextField,
  type Size,
} from "./fields";

type TextAlign = "left" | "center" | "right";

/**
 * 실제로 로드된 폰트만 노출한다. src/styles/fonts.css가 Pretendard만 불러오므로
 * Manrope·Inter를 골라도 폰트 파일이 없어 기본 폰트로 조용히 떨어졌다.
 * 폰트를 늘리려면 fonts.css에 @font-face를 먼저 추가한다.
 */
const FONT_FAMILY_OPTIONS = [
  { value: "Pretendard", label: "Pretendard" },
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

      <SizeSection
        width={width}
        height={height}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
      />

      <PropertySection title="Font">
        <SelectField
          label="종류"
          value={fontFamily}
          options={FONT_FAMILY_OPTIONS}
          onChange={setFontFamily}
        />
        <FieldRow>
          <NumberField label="크기" value={fontSize} onChange={setFontSize} min={1} unit="px" />
          <SelectField
            label="굵기"
            value={fontWeight === undefined ? undefined : String(fontWeight)}
            options={FONT_WEIGHT_OPTIONS}
            onChange={(value) => setFontWeight(Number(value))}
          />
        </FieldRow>
        <FieldRow>
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
        </FieldRow>
        <SegmentedControl
          label="정렬"
          value={textAlign}
          options={ALIGN_OPTIONS}
          onChange={setTextAlign}
        />
      </PropertySection>

      <EffectsSection />

      <PropertySection title="Color">
        <ColorField label="글자색" value={color} onChange={setColor} />
      </PropertySection>
    </>
  );
}
