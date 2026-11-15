/**
 * ColorField가 다루는 색 문자열(#RRGGBB / #RRGGBBAA)의 분해·조립.
 * 값이 그대로인지 판단(unchangedCommit.ts)도 같은 조립을 거쳐야 해서
 * React를 모르는 모듈로 나눠뒀다(#209).
 */

export const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX_FULL = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;

/** value(#RRGGBB / #RRGGBBAA)를 6자리 hex + 불투명도(%)로 분해. */
export function parseColor(value: string | undefined): { hex: string; opacity: number } {
  const match = HEX_FULL.exec(value ?? "");
  if (match === null) {
    return { hex: value ?? "", opacity: 100 };
  }
  const opacity = match[2]
    ? Math.round((parseInt(match[2], 16) / 255) * 100)
    : 100;
  return { hex: `#${match[1].toUpperCase()}`, opacity };
}

/** 6자리 hex + 불투명도(%) → #RRGGBB 또는 #RRGGBBAA. */
export function composeColor(hex: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(100, opacity));
  if (clamped >= 100) {
    return hex.toUpperCase();
  }
  const alpha = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`.toUpperCase();
}
