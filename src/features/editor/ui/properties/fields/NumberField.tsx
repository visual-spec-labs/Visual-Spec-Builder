import { useEffect, useState } from "react";

import { Field, inputClass, invalidClass } from "./Field";

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** px, ° 같은 단위 표기 */
  unit?: string;
}

/** 숫자 입력. 유효할 때만 즉시 커밋하고, 파싱 실패 시 빨간 테두리. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [invalid, setInvalid] = useState(false);

  // 외부(스토어)에서 값이 바뀌면 입력값도 맞춘다.
  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
    setInvalid(false);
  }, [value]);

  function handleChange(raw: string) {
    setDraft(raw);
    const parsed = Number(raw);
    const ok =
      raw.trim() !== "" &&
      Number.isFinite(parsed) &&
      (min === undefined || parsed >= min) &&
      (max === undefined || parsed <= max);

    setInvalid(!ok);
    if (ok) {
      onChange(parsed);
    }
  }

  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          className={`${inputClass} ${invalid ? invalidClass : ""} ${unit ? "pr-7" : ""}`}
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(event) => handleChange(event.target.value)}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-content-subtle">
            {unit}
          </span>
        ) : null}
      </div>
    </Field>
  );
}
