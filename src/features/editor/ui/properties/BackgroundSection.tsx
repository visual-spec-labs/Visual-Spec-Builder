import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import { ColorField } from "./fields";

/**
 * 배경 — 지금은 단색 하나다(스키마 `Background`가 `color` 한 칸뿐).
 *
 * `background`를 갖는 frame · button · input이 공유한다. 예전에는
 * FrameProperties 안에만 있어 button·input은 편집할 수 없었다(#92).
 *
 * #78 2단계(다중 채우기·그라디언트)가 이 칸 하나를 채우기 목록으로 넓힐 자리다.
 * 섹션이 공유가 된 지금은 여기 한 곳만 고치면 세 타입에 다 반영된다.
 */
export function BackgroundSection() {
  const [color, setColor] = useNodeField<string>("background.color");

  return (
    <PropertySection title="Background">
      <ColorField label="배경색" value={color} onChange={setColor} />
    </PropertySection>
  );
}
