import { Field, inputClass, invalidClass } from "./Field";
import { useDraftInput } from "./useDraftInput";

export type Size = number | "auto" | "fill";
type Mode = "fixed" | "auto" | "fill";

interface SizeFieldProps {
  label: string;
  value: Size | undefined;
  onChange: (value: Size) => void;
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
  auto: "Hug",
  fill: "Fill",
};

/** box.width / height 전용. Fixed(px) / Hug / Fill 중 선택. */
export function SizeField({ label, value, onChange, measured }: SizeFieldProps) {
  const mode = modeOf(value);

  /**
   * px 칸에 실제로 채워 넣을 숫자. Fixed면 스펙값, Hug/Fill이면 실측값이다.
   * 실측값이 바뀌면(형제 크기 변화 등) 이 값도 따라 바뀌어 칸이 갱신된다.
   */
  const shown = typeof value === "number" ? value : measured;

  const { draft, invalid, handleChange } = useDraftInput(shown, {
    toDraft: (v) => (v === undefined ? "" : String(v)),
    parse: (raw) => {
      const parsed = Number(raw);
      const ok = raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
      return ok ? parsed : undefined;
    },
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
    <Field label={label}>
      {/* 패널이 좁아(칸당 약 155px) 가로로 나란히 두면 px 칸이 남지 않는다. 세로로 쌓는다. */}
      <div className="flex flex-col gap-1">
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            aria-label={`${label} px`}
            placeholder={placeholder}
            className={`${inputClass} ${invalid ? invalidClass : ""} pr-7`}
            value={draft}
            onChange={(event) => handleChange(event.target.value)}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-content-subtle">
            px
          </span>
        </div>
        <select
          aria-label={`${label} 크기 모드`}
          className={inputClass}
          value={mode}
          onChange={(event) => handleMode(event.target.value as Mode)}
        >
          <option value="fixed">Fixed</option>
          <option value="auto">Hug</option>
          <option value="fill">Fill</option>
        </select>
      </div>
    </Field>
  );
}
