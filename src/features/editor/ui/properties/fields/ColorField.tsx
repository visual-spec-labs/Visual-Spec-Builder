import { Field, inputClass, invalidClass } from "./Field";
import { useDraftInput } from "./useDraftInput";

interface ColorFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX_FULL = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;

/** value(#RRGGBB / #RRGGBBAA)를 6자리 hex + 불투명도(%)로 분해. */
function parseColor(value: string | undefined): { hex: string; opacity: number } {
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
function composeColor(hex: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(100, opacity));
  if (clamped >= 100) {
    return hex.toUpperCase();
  }
  const alpha = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`.toUpperCase();
}

/** 색상 입력. 스와치 + hex(6자리) + 불투명도(%). rgba는 #RRGGBBAA로 저장. */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const opacity = useDraftInput(value, {
    toDraft: (v) => String(parseColor(v).opacity),
    parse: (raw) => {
      const n = Number(raw);
      const ok = raw.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
      return ok ? n : undefined;
    },
    onCommit: (n) => {
      if (HEX6.test(hex.draft)) {
        onChange(composeColor(hex.draft, n));
      }
    },
  });

  const hex = useDraftInput(value, {
    toDraft: (v) => parseColor(v).hex,
    normalize: (raw) => (raw.startsWith("#") ? raw : `#${raw}`),
    parse: (draft) => (HEX6.test(draft) ? draft : undefined),
    onCommit: (nextHex) => {
      const n = Number(opacity.draft);
      onChange(composeColor(nextHex, Number.isFinite(n) ? n : 100));
    },
  });

  const swatch = HEX6.test(hex.draft) ? hex.draft : "#000000";

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} 색상 선택`}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-control border border-line bg-surface p-0.5"
          value={swatch}
          onChange={(event) => hex.handleChange(event.target.value)}
        />
        <input
          type="text"
          className={`${inputClass} ${hex.invalid ? invalidClass : ""} uppercase`}
          value={hex.draft}
          spellCheck={false}
          onChange={(event) => hex.handleChange(event.target.value)}
        />
        <div className="relative w-20 shrink-0">
          <input
            type="number"
            min={0}
            max={100}
            aria-label={`${label} 불투명도`}
            className={`${inputClass} pr-6`}
            value={opacity.draft}
            onChange={(event) => opacity.handleChange(event.target.value)}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-content-subtle">
            %
          </span>
        </div>
      </div>
    </Field>
  );
}
