import { useEffect, useState } from "react";

import { Field, inputClass, invalidClass } from "./Field";

type Size = number | "auto" | "fill";
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
  const numeric = typeof value === "number" ? value : 100;

  const [draft, setDraft] = useState(String(numeric));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (typeof value === "number") {
      setDraft(String(value));
      setInvalid(false);
    }
  }, [value]);

  function handleMode(next: Mode) {
    if (next === "fixed") {
      onChange(numeric);
    } else {
      onChange(next);
    }
  }

  function handleNumber(raw: string) {
    setDraft(raw);
    const parsed = Number(raw);
    const ok = raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
    setInvalid(!ok);
    if (ok) {
      onChange(parsed);
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
            onChange={(event) => handleNumber(event.target.value)}
          />
        ) : null}
      </div>
    </Field>
  );
}
