import type { ReactNode } from "react";

import { Field } from "./Field";

export interface SegmentOption<T extends string> {
  value: T;
  /** 아이콘 또는 짧은 라벨 */
  content: ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T | undefined;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
}

/** 버튼 묶음 중 하나 선택. textAlign, direction 같은 소수 옵션에 사용. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <Field label={label}>
      <div className="flex rounded-control border border-line bg-surface p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.title}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`flex flex-1 items-center justify-center rounded-control px-2 py-1 text-sm transition-colors ${
                active
                  ? "bg-primary-subtle text-primary"
                  : "text-content-muted hover:bg-hover"
              }`}
            >
              {option.content}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
