import { useEditorStore } from "@/features/editor/store/editorStore";
import { useViewStore } from "@/features/editor/store/viewStore";

import { PropertySection } from "./PropertySection";
import {
  CUSTOM_PRESET_ID,
  RESOLUTION_PRESETS,
  findPreset,
  findPresetId,
} from "./resolutionPresets";
import {
  FieldRow,
  NumberField,
  SelectField,
  TextField,
  type SelectOption,
} from "./fields";

const PRESET_OPTIONS: SelectOption<string>[] = RESOLUTION_PRESETS.map((preset) => ({
  label: preset.label,
  value: preset.id,
}));

/**
 * 활성 페이지 자체의 속성 — 이름과 크기(해상도).
 *
 * 페이지 행은 곧 그 페이지의 root 프레임이므로, root를 골랐거나 아무것도 고르지
 * 않았을 때 패널 맨 위에 얹힌다. 아래 배경·레이아웃 섹션은 같은 root를 setNodeField로
 * 편집하고, 이 섹션만 setPageField로 페이지를 편집한다.
 *
 * 캔버스 아트보드는 이 크기를 그대로 px로 쓴다. 줌은 화면에 보여주는 배율일
 * 뿐이라 스펙에 저장되는 값은 언제나 여기서 정한 실제 px다.
 */
export function PageProperties() {
  const activePageId = useEditorStore((state) => state.activePageId);
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const setPageField = useEditorStore((state) => state.setPageField);

  const presetId = findPresetId(page.size);
  const options =
    presetId === CUSTOM_PRESET_ID
      ? [{ label: "직접 입력", value: CUSTOM_PRESET_ID }, ...PRESET_OPTIONS]
      : PRESET_OPTIONS;

  function handlePreset(id: string) {
    const preset = findPreset(id);
    if (preset === undefined) {
      return; // "직접 입력"을 다시 고른 경우 — 크기를 건드리지 않는다.
    }

    setPageField(activePageId, "size", {
      width: preset.width,
      height: preset.height,
    });

    // 아트보드가 실제로 커지고 작아지므로 확대율을 다시 맞춘다. 캔버스가
    // setContent를 올려주길 기다리면 한 프레임 늦어 직전 크기로 맞춰지므로,
    // 새 크기를 여기서 바로 알린다.
    const view = useViewStore.getState();
    view.setContent({ width: preset.width, height: preset.height });
    view.fitToScreen();
  }

  return (
    <PropertySection title="Page">
      <TextField
        label="이름"
        value={page.name}
        onChange={(value) => setPageField(activePageId, "name", value)}
      />
      <SelectField
        label="해상도"
        value={presetId}
        options={options}
        onChange={handlePreset}
      />
      {/* 프리셋에 없는 크기를 쓸 수 있게 직접 입력도 남긴다. 타이핑 중에는
          확대율을 다시 맞추지 않는다 — 한 글자마다 줌이 튀면 쓰기 어렵다. */}
      <FieldRow>
        <NumberField
          label="너비 (W)"
          value={page.size.width}
          min={1}
          unit="px"
          onChange={(value) => setPageField(activePageId, "size.width", value)}
        />
        <NumberField
          label="높이 (H)"
          value={page.size.height}
          min={1}
          unit="px"
          onChange={(value) => setPageField(activePageId, "size.height", value)}
        />
      </FieldRow>
    </PropertySection>
  );
}
