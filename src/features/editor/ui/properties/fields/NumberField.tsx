import { blurOnWheel, Field, inputClass, invalidClass } from "./Field";
import { useDraftInput } from "./useDraftInput";

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  /**
   * `continueEdit`(#121)은 지금 커밋이 직전 커밋과 같은 타이핑 burst를 잇는
   * 것이면 true다 — 그대로 setNodeField/setPageField에 넘겨야 새 undo 단계가
   * 안 쌓이고 병합된다. 무시하고 `(value) => ...` 한 인자만 받아도 동작은
   * 하지만(값은 여전히 맞게 반영된다) 그 필드는 키 입력마다 undo 단계가
   * 쌓이는 예전 동작으로 돌아간다.
   */
  onChange: (value: number, continueEdit?: boolean) => void;
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
  const { draft, invalid, handleChange, handleBlur } = useDraftInput(value, {
    toDraft: (v) => (v === undefined ? "" : String(v)),
    parse: (raw) => {
      const parsed = Number(raw);
      const ok =
        raw.trim() !== "" &&
        Number.isFinite(parsed) &&
        (min === undefined || parsed >= min) &&
        (max === undefined || parsed <= max);
      return ok ? parsed : undefined;
    },
    onCommit: onChange,
  });

  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number"
          onWheel={blurOnWheel}
          inputMode="decimal"
          className={`${inputClass} ${invalid ? invalidClass : ""} ${unit ? "pr-7" : ""}`}
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
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
