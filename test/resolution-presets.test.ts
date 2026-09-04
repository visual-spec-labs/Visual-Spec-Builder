import { describe, expect, it } from "vitest";

import {
  CUSTOM_PRESET_ID,
  RESOLUTION_PRESETS,
  findPreset,
  findPresetId,
} from "@/features/editor/ui/properties/resolutionPresets";
import { blankSpec } from "@/features/editor/store/blankSpec";

describe("RESOLUTION_PRESETS", () => {
  it("id가 겹치지 않는다", () => {
    const ids = RESOLUTION_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("해상도 조합이 겹치지 않는다 — 겹치면 findPresetId가 어느 쪽을 고를지 모호해진다", () => {
    const sizes = RESOLUTION_PRESETS.map((p) => `${p.width}x${p.height}`);
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it("CUSTOM_PRESET_ID를 프리셋 id로 쓰지 않는다", () => {
    expect(RESOLUTION_PRESETS.map((p) => p.id)).not.toContain(CUSTOM_PRESET_ID);
  });

  it("모든 크기가 양수다 — 스키마가 exclusiveMinimum 0을 요구한다", () => {
    for (const preset of RESOLUTION_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });

  it("04-gui-spec.md의 예시 크기를 담고 있다", () => {
    const sizes = RESOLUTION_PRESETS.map((p) => `${p.width}x${p.height}`);
    expect(sizes).toContain("390x844");
    expect(sizes).toContain("1440x900");
  });

  it("blankSpec의 기본 크기가 프리셋에 있다 — 새 페이지가 직접 입력으로 뜨면 안 된다", () => {
    expect(findPresetId(blankSpec.screen.size)).not.toBe(CUSTOM_PRESET_ID);
  });
});

describe("findPresetId", () => {
  it("정확히 일치하는 프리셋의 id를 돌려준다", () => {
    expect(findPresetId({ width: 1920, height: 1080 })).toBe("1920x1080");
  });

  it("어느 프리셋과도 다르면 custom을 돌려준다", () => {
    expect(findPresetId({ width: 1234, height: 567 })).toBe(CUSTOM_PRESET_ID);
  });

  it("가로세로가 뒤바뀐 크기는 일치로 보지 않는다", () => {
    expect(findPresetId({ width: 1080, height: 1920 })).toBe(CUSTOM_PRESET_ID);
  });

  it("한 변만 같으면 일치로 보지 않는다", () => {
    expect(findPresetId({ width: 1920, height: 1200 })).toBe(CUSTOM_PRESET_ID);
  });
});

describe("findPreset", () => {
  it("id로 프리셋을 찾는다", () => {
    expect(findPreset("1440x900")).toEqual({
      id: "1440x900",
      label: expect.any(String),
      width: 1440,
      height: 900,
    });
  });

  it("없는 id면 undefined", () => {
    expect(findPreset("does-not-exist")).toBeUndefined();
  });

  it("custom은 프리셋이 아니라 undefined", () => {
    expect(findPreset(CUSTOM_PRESET_ID)).toBeUndefined();
  });
});
