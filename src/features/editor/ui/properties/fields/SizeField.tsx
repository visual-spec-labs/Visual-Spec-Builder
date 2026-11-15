import { useId } from "react";
import { blurOnWheel, Field, FieldError, inputClass, invalidClass } from "./Field";
import { isUnchangedNumber } from "./unchangedCommit";
import { useDraftInput } from "./useDraftInput";

export type Size = number | "auto" | "fill";
type Mode = "fixed" | "auto" | "fill";

interface SizeFieldProps {
  label: string;
  value: Size | undefined;
  /** `continueEdit`(#121) — NumberField.tsx의 같은 매개변수 설명 참고. */
  onChange: (value: Size, continueEdit?: boolean) => void;
  /** 캔버스에서 실제로 그려진 px. Hug/Fill일 때 이 값을 보여준다. */
  measured?: number;
}

function modeOf(value: Size | undefined): Mode {
  if (typeof value === "number") return "fixed";
  if (value === "fill") return "fill";
  return "auto";
}

/** 실측값을 아직 못 받았을 때 px 칸에 흐리게 보여줄 문구. */
const MODE_PLACEHOLDER: Record<Mode, string | undefined> = {
  fixed: undefined,
  // Figma 용어를 따른다 — 스키마 값은 "auto"지만 UI는 Hug로 부른다.
  auto: "내용 맞춤",
  fill: "공간 채움",
};

/** box.width / height 전용. Fixed(px) / Hug / Fill 중 선택. */
export function SizeField({ label, value, onChange, measured }: SizeFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const mode = modeOf(value);

  /**
   * px 칸에 실제로 채워 넣을 숫자. Fixed면 스펙값, Hug/Fill이면 실측값이다.
   * 실측값이 바뀌면(형제 크기 변화 등) 이 값도 따라 바뀌어 칸이 갱신된다.
   */
  const shown = typeof value === "number" ? value : measured;

  const { draft, invalid, handleChange, handleBlur } = useDraftInput(shown, {
    toDraft: (v) => (v === undefined ? "" : String(v)),
    parse: (raw) => {
      const parsed = Number(raw);
      const ok = raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
      return ok ? parsed : undefined;
    },
    // `shown`이 아니라 `value`와 견준다(#209) — Hug/Fill이면 칸에 실측 px가 보이지만,
    // 같은 숫자를 치는 것은 Fixed로 바꾸는 실제 변경이라 커밋해야 한다.
    isUnchanged: (n) => isUnchangedNumber(n, value),
    // 숫자를 커밋하면 값이 number가 되므로 모드가 자동으로 Fixed로 바뀐다.
    onCommit: onChange,
  });

  function handleMode(next: Mode) {
    if (next === "fixed") {
      // Hug/Fill에서 Fixed로 바꿀 때는 지금 그려진 크기를 그대로 이어받는다.
      onChange(typeof value === "number" ? value : (measured ?? 100));
    } else {
      onChange(next);
    }
  }

  // 실측값을 아직 못 받아 칸이 비었을 때만 모드 이름을 흐리게 보여준다.
  const placeholder = mode === "fixed" ? undefined : MODE_PLACEHOLDER[mode];

  return (
    <Field label={label} htmlFor={id}>
      {/* 패널이 좁아(칸당 약 155px) 가로로 나란히 두면 px 칸이 남지 않는다. 세로로 쌓는다. */}
      <div className="flex flex-col gap-1">
        <div className="relative">
          <input
            id={id}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${helpId} ${errorId}` : helpId}
            type="number"
            onWheel={blurOnWheel}
            inputMode="decimal"
            min={0}
            aria-label={`${label} px`}
            placeholder={placeholder}
            className={`${inputClass} ${invalid ? invalidClass : ""} pr-7`}
            value={draft}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-content-muted">
            px
          </span>
        </div>
        <select
          aria-label={`${label} 크기 모드`}
          aria-describedby={helpId}
          className={inputClass}
          value={mode}
          onChange={(event) => handleMode(event.target.value as Mode)}
        >
          <option value="fixed">고정 (Fixed)</option>
          <option value="auto">내용 맞춤 (Hug)</option>
          <option value="fill">공간 채움 (Fill)</option>
        </select>
      </div>
      <p id={helpId} className="text-xs text-content-muted">{mode === "fixed" ? "고정: 지정한 px 크기입니다." : mode === "auto" ? "내용 맞춤: 내용에 맞춰 크기가 정해집니다." : "공간 채움: 부모의 남는 공간을 채웁니다."}{mode !== "fixed" && " 숫자를 입력하면 고정 크기로 바뀝니다."}</p>
      {invalid && <FieldError id={errorId}>0 이상의 숫자를 입력하세요. 유효한 값만 반영됩니다.</FieldError>}
    </Field>
  );
}
