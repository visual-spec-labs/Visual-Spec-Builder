import { useId } from "react";
import { Field, inputClass } from "./Field";

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T | undefined;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}

/** 드롭다운 선택. fontFamily, direction 등에 사용. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select
        id={id}
        className={inputClass}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
