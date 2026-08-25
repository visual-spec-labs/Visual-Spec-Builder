import { Field, inputClass } from "./Field";

interface TextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 여러 줄 입력 (텍스트 content 등) */
  multiline?: boolean;
}

/** 문자열 입력. 타이핑 즉시 커밋. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: TextFieldProps) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type="text"
          className={inputClass}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
