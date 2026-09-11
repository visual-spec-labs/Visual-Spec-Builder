import { useMeasureStore } from "@/features/editor/store/measureStore";

import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import { FieldRow, SizeField, type Size } from "./fields";

/**
 * 너비(W) / 높이(H). 모든 노드 타입이 `box`를 갖고 있어 다섯 타입 전부가 쓴다.
 *
 * 값을 props로 받지 않고 직접 읽는다 — 다른 섹션과 모양을 맞춰야 PropertiesPanel이
 * 표 하나로 조립할 수 있다(#92).
 */
export function SizeSection() {
  const [width, setWidth] = useNodeField<Size>("box.width");
  const [height, setHeight] = useNodeField<Size>("box.height");

  // Hug/Fill은 스펙에 숫자가 없어, 캔버스가 올려준 실측 px를 대신 보여준다.
  const measured = useMeasureStore((state) => state.size);

  return (
    <PropertySection title="Size">
      <FieldRow>
        <SizeField
          label="너비 (W)"
          value={width}
          onChange={setWidth}
          measured={measured?.width}
        />
        <SizeField
          label="높이 (H)"
          value={height}
          onChange={setHeight}
          measured={measured?.height}
        />
      </FieldRow>
    </PropertySection>
  );
}
