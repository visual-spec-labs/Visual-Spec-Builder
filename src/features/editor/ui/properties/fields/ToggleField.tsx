interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** 켜기/끄기 스위치. visible 등에 사용. */
export function ToggleField({ label, value, onChange }: ToggleFieldProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-[11px] font-medium tracking-wide text-content-muted">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-surface-inset"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
