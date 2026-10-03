import { composeColor, HEX6, parseColor } from "./colorValue";
import { blurOnWheel, Field, inputClass, invalidClass } from "./Field";
import { isUnchangedColor } from "./unchangedCommit";
import { useDraftInput } from "./useDraftInput";

interface ColorFieldProps {
  label: string;
  value: string | undefined;
  /** `continueEdit`(#121) — NumberField.tsx의 같은 매개변수 설명 참고. */
  onChange: (value: string, continueEdit?: boolean) => void;
}

/** 색상 입력. 스와치 + hex(6자리) + 불투명도(%). rgba는 #RRGGBBAA로 저장. */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const opacity = useDraftInput(value, {
    toDraft: (v) => String(parseColor(v).opacity),
    parse: (raw) => {
      const n = Number(raw);
      const ok = raw.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
      return ok ? n : undefined;
    },
    // 보이는 %가 아니라 조립한 색 문자열로 견준다(#209) — 반올림 때문에 같은 %라도
    // 스펙 값이 바뀔 수 있다(unchangedCommit.ts 참고).
    isUnchanged: (n) => isUnchangedColor(hex.draft, n, value),
    onCommit: (n, continueEdit) => {
      if (HEX6.test(hex.draft)) {
        onChange(composeColor(hex.draft, n), continueEdit);
      }
    },
  });

  const hex = useDraftInput(value, {
    toDraft: (v) => parseColor(v).hex,
    normalize: (raw) => (raw.startsWith("#") ? raw : `#${raw}`),
    parse: (draft) => (HEX6.test(draft) ? draft : undefined),
    // 대소문자만 다른 hex는 조립하면 같은 대문자 문자열이 되므로 커밋하지 않는다.
    // 저장된 값이 소문자면 조립 결과와 달라 커밋한다(#209, unchangedCommit.ts 참고).
    isUnchanged: (nextHex) => isUnchangedColor(nextHex, draftOpacity(), value),
    onCommit: (nextHex, continueEdit) => {
      onChange(composeColor(nextHex, draftOpacity()), continueEdit);
    },
  });

  /** hex 커밋에 함께 실을 불투명도. 칸이 비었거나 숫자가 아니면 100%. */
  function draftOpacity(): number {
    const n = Number(opacity.draft);
    return Number.isFinite(n) ? n : 100;
  }

  const swatch = HEX6.test(hex.draft) ? hex.draft : "#000000";

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} 색상 선택`}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-control border border-line bg-surface p-0.5"
          value={swatch}
          onChange={(event) => hex.handleChange(event.target.value)}
          onBlur={hex.handleBlur}
        />
        <input
          type="text"
          className={`${inputClass} ${hex.invalid ? invalidClass : ""} uppercase`}
          value={hex.draft}
          spellCheck={false}
          onChange={(event) => hex.handleChange(event.target.value)}
          onBlur={hex.handleBlur}
        />
        <div className="relative w-20 shrink-0">
          <input
            type="number"
            onWheel={blurOnWheel}
            min={0}
            max={100}
            aria-label={`${label} 불투명도`}
            className={`${inputClass} pr-6`}
            value={opacity.draft}
            onChange={(event) => opacity.handleChange(event.target.value)}
            onBlur={opacity.handleBlur}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-content-subtle">
            %
          </span>
        </div>
      </div>
    </Field>
  );
}
