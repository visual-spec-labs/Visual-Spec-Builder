import { Field, inputClass, invalidClass } from "./Field";
import { useDraftInput } from "./useDraftInput";

export type Size = number | "auto" | "fill";
type Mode = "fixed" | "auto" | "fill";

interface SizeFieldProps {
  label: string;
  value: Size | undefined;
  onChange: (value: Size) => void;
}

function modeOf(value: Size | undefined): Mode {
  if (typeof value === "number") return "fixed";
  if (value === "fill") return "fill";
  return "auto";
}

/** box.width / height 전용. Fixed(px) / Auto / Fill 중 선택. */
export function SizeField({ label, value, onChange }: SizeFieldProps) {
  const mode = modeOf(value);

  const { draft, invalid, handleChange } = useDraftInput(value, {
    toDraft: (v) => (typeof v === "number" ? String(v) : undefined),
    parse: (raw) => {
      const parsed = Number(raw);
      const ok = raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
      return ok ? parsed : undefined;
    },
    onCommit: onChange,
  });

  function handleMode(next: Mode) {
    if (next === "fixed") {
      onChange(typeof value === "number" ? value : 100);
    } else {
      onChange(next);
    }
  }

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <select
          className={`${inputClass} w-24 shrink-0`}
          value={mode}
          onChange={(event) => handleMode(event.target.value as Mode)}
        >
          <option value="fixed">Fixed</option>
          <option value="auto">Auto</option>
          <option value="fill">Fill</option>
        </select>
        {mode === "fixed" ? (
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className={`${inputClass} ${invalid ? invalidClass : ""}`}
            value={draft}
            onChange={(event) => handleChange(event.target.value)}
          />
        ) : null}
      </div>
    </Field>
  );
}
