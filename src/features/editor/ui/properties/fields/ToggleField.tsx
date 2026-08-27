import { FieldLabel } from "./Field";

interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** 켜기/끄기 스위치. visible 등에 사용. */
export function ToggleField({ label, value, onChange }: ToggleFieldProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          value ? "bg-primary" : "bg-surface-inset"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-surface transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
