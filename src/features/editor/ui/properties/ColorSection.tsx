import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import { ColorField } from "./fields";

/**
 * 글자색. `typography`와 늘 함께 오지만 스키마에서는 노드의 최상위 필드
 * (`color`)라 경로가 달라 섹션을 나눴다.
 *
 * text · button · input이 공유한다(#92).
 */
export function ColorSection() {
  const [color, setColor] = useNodeField<string>("color");

  return (
    <PropertySection title="Color">
      <ColorField label="글자색" value={color} onChange={setColor} />
    </PropertySection>
  );
}
