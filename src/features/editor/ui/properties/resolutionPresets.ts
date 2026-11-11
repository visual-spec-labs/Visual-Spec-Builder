import type { ScreenSpec } from "@/features/editor/schema";

export interface ResolutionPreset {
  /** `${width}x${height}` — 크기에서 바로 역산할 수 있게 맞춰 둔다. */
  id: string;
  label: string;
  width: number;
  height: number;
}

/** 어느 프리셋과도 맞지 않는 상태. 프리셋 id로는 쓰지 않는다. */
export const CUSTOM_PRESET_ID = "custom";

/**
 * 페이지 크기 프리셋. 흔한 화면을 바로 고르게 해서, 나온 JSON을 읽는 쪽이
 * 어떤 화면을 전제로 디자인했는지 알 수 있게 한다.
 *
 * 세로형(모바일·태블릿)은 숫자만으로는 무슨 기기인지 알기 어려워 기기 이름을
 * 붙였다. 가로형 데스크톱은 숫자가 곧 이름이라 그대로 둔다.
 */
export const RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { id: "1920x1080", label: "1920 × 1080 (FHD)", width: 1920, height: 1080 },
  { id: "1680x1050", label: "1680 × 1050", width: 1680, height: 1050 },
  { id: "1600x900", label: "1600 × 900", width: 1600, height: 900 },
  { id: "1512x982", label: "1512 × 982 (MacBook Pro 14)", width: 1512, height: 982 },
  { id: "1440x900", label: "1440 × 900", width: 1440, height: 900 },
  { id: "1366x768", label: "1366 × 768", width: 1366, height: 768 },
  { id: "1280x720", label: "1280 × 720 (HD)", width: 1280, height: 720 },
  { id: "1024x1366", label: "1024 × 1366 (iPad Pro 12.9)", width: 1024, height: 1366 },
  { id: "820x1180", label: "820 × 1180 (iPad Air)", width: 820, height: 1180 },
  { id: "768x1024", label: "768 × 1024 (iPad mini)", width: 768, height: 1024 },
  { id: "430x932", label: "430 × 932 (iPhone Pro Max)", width: 430, height: 932 },
  { id: "393x852", label: "393 × 852 (iPhone Pro)", width: 393, height: 852 },
  { id: "390x844", label: "390 × 844 (iPhone)", width: 390, height: 844 },
  { id: "360x800", label: "360 × 800 (Android)", width: 360, height: 800 },
];

/**
 * 지금 크기에 딱 맞는 프리셋 id. 없으면 CUSTOM_PRESET_ID.
 * 가로세로가 뒤바뀐 경우는 다른 화면이므로 일치로 보지 않는다.
 */
export function findPresetId(size: ScreenSpec["size"]): string {
  const match = RESOLUTION_PRESETS.find(
    (preset) => preset.width === size.width && preset.height === size.height,
  );

  return match?.id ?? CUSTOM_PRESET_ID;
}

/** id로 프리셋을 찾는다. CUSTOM_PRESET_ID를 넘기면 undefined. */
export function findPreset(id: string): ResolutionPreset | undefined {
  return RESOLUTION_PRESETS.find((preset) => preset.id === id);
}
