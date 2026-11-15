import { useId } from "react";
import { blurOnWheel, Field, FieldError, inputClass, invalidClass } from "./Field";
import { isUnchangedNumber } from "./unchangedCommit";
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
  /**
   * `max` 자체는 받지 않는다(미만). 스키마가 `exclusiveMaximum`인 필드용이다 —
   * 그라디언트 각도 `[0, 360)`처럼 끝값이 시작값과 같은 뜻이라 막아 둔 칸.
   */
  maxExclusive?: boolean;
  step?: number;
  /**
   * 정수만 받는다. 스키마가 `"type": "integer"`인 필드에 필수다.
   *
   * 없으면 소수가 그대로 스펙에 들어가 **내보낸 JSON이 검증에 실패한다.** 게다가
   * 그 값이 CSS로 나가면 조용히 무너진다 — `grid-template-columns: repeat(2.5, 1fr)`
   * 은 무효 값이라 브라우저가 통째로 버리고 1열이 된다(2026-09-16 리뷰에서 잡힘).
   */
  integer?: boolean;
  /** px, ° 같은 단위 표기 */
  unit?: string;
}

/** 숫자 입력. 유효할 때만 즉시 커밋하고, 파싱 실패 시 입력을 보존하고 오류 설명을 제공한다. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  maxExclusive = false,
  step,
  integer = false,
  unit,
}: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const { draft, invalid, handleChange, handleBlur } = useDraftInput(value, {
    toDraft: (v) => (v === undefined ? "" : String(v)),
    parse: (raw) => {
      const parsed = Number(raw);
      const ok =
        raw.trim() !== "" &&
        Number.isFinite(parsed) &&
        // 반올림하지 않고 거절한다. 2.5를 3으로 바꿔 넣으면 사용자가 친 값과
        // 저장된 값이 달라지는데, 빨간 테두리로 막으면 무엇이 문제인지 보인다.
        (!integer || Number.isInteger(parsed)) &&
        (min === undefined || parsed >= min) &&
        (max === undefined || (maxExclusive ? parsed < max : parsed <= max));
      return ok ? parsed : undefined;
    },
    // "016"·"16.0"처럼 표기만 다른 같은 값은 커밋하지 않는다(#209).
    isUnchanged: (n) => isUnchangedNumber(n, value),
    onCommit: onChange,
  });

  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          type="number"
          onWheel={blurOnWheel}
          inputMode={integer ? "numeric" : "decimal"}
          className={`${inputClass} ${invalid ? invalidClass : ""} ${unit ? "pr-7" : ""}`}
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-content-muted">
            {unit}
          </span>
        ) : null}
      </div>
      {invalid && <FieldError id={errorId}>{integer ? "정수" : "숫자"}를 입력하세요{min !== undefined ? ` · ${min} 이상` : ""}{max !== undefined ? ` · ${max} ${maxExclusive ? "미만" : "이하"}` : ""}. 유효한 값만 반영됩니다.</FieldError>}
    </Field>
  );
}
