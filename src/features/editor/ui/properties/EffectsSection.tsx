import type { Shadow } from "@/features/editor/schema";

import {
  blurFromInput,
  opacityFromPercent,
  percentFromOpacity,
} from "./effectPatch";
import { PropertySection } from "./PropertySection";
import { mergeShadow, SHADOW_DEFAULT } from "./shadowPatch";
import { useNodeField } from "./useNodeField";
import { ColorField, FieldRow, NumberField, ToggleField } from "./fields";

/**
 * 투명도·블러·그림자. 노드 타입에 상관없이 같은 필드라 한 컴포넌트로 둔다.
 *
 * 그림자는 frame에만 있다(`withShadow`). 글자 모양을 따라가는 그림자는
 * box-shadow가 아니라 filter: drop-shadow라 성격이 달라 text에 두지 않았다.
 *
 * 스키마상 전부 선택 필드다. 값이 없으면 불투명도는 100%, 블러는 0으로 보여준다 —
 * 빈 칸을 두면 "안 정해짐"과 "0"을 구분할 수 없어 오히려 헷갈린다.
 *
 * 반대로 항등값(불투명도 100%, 블러 0)으로 되돌리면 필드를 지운다. 그림자 토글과
 * 같은 이유다 — 아무 효과도 없는 값이 스펙에 남으면 export된 JSON에 따라다니고,
 * 그걸 읽는 쪽이 의미 있는 지정으로 오해한다.
 */
export function EffectsSection({ withShadow = false }: { withShadow?: boolean }) {
  const [opacity, setOpacity] = useNodeField<number | undefined>("opacity");
  const [blur, setBlur] = useNodeField<number | undefined>("blur");
  const [shadow, setShadow] = useNodeField<Shadow | undefined>("shadow");

  // 스키마는 0..1이지만 칸에는 %로 보여준다 — 0.35보다 35%가 읽기 쉽다.
  const opacityPercent = percentFromOpacity(opacity);

  function updateShadow(patch: Partial<Shadow>) {
    setShadow(mergeShadow(shadow, patch));
  }

  return (
    <PropertySection title="Effects">
      <FieldRow>
        {/*
          "투명도"가 아니라 "불투명도"다. 100%가 불투명(그대로 보임), 0%가 완전
          투명이라 이름과 방향이 맞아야 한다 — CSS opacity·Figma와 같은 방향이다.
        */}
        <NumberField
          label="불투명도"
          value={opacityPercent}
          onChange={(percent) => setOpacity(opacityFromPercent(percent))}
          min={0}
          max={100}
          unit="%"
        />
        <NumberField
          label="블러"
          value={blur ?? 0}
          onChange={(value) => setBlur(blurFromInput(value))}
          min={0}
          unit="px"
        />
      </FieldRow>

      {withShadow && (
        <>
          <ToggleField
            label="그림자"
            value={shadow !== undefined}
            // 끌 때는 필드를 지운다. 값이 남아 있으면 export된 JSON에 안 쓰는
            // 그림자가 따라다닌다.
            onChange={(on) => setShadow(on ? SHADOW_DEFAULT : undefined)}
          />
          {shadow !== undefined && (
            <>
              <FieldRow>
                <NumberField
                  label="X"
                  value={shadow.x}
                  onChange={(x) => updateShadow({ x })}
                  unit="px"
                />
                <NumberField
                  label="Y"
                  value={shadow.y}
                  onChange={(y) => updateShadow({ y })}
                  unit="px"
                />
                <NumberField
                  label="번짐"
                  value={shadow.blur}
                  onChange={(value) => updateShadow({ blur: value })}
                  min={0}
                  unit="px"
                />
                <NumberField
                  label="확장"
                  value={shadow.spread}
                  onChange={(spread) => updateShadow({ spread })}
                  unit="px"
                />
              </FieldRow>
              <ColorField
                label="그림자색"
                value={shadow.color}
                onChange={(color) => updateShadow({ color })}
              />
            </>
          )}
        </>
      )}
    </PropertySection>
  );
}
