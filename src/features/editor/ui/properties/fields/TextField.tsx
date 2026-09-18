import { useEditBurst } from "./editBurst";
import { Field, inputClass } from "./Field";

interface TextFieldProps {
  label: string;
  value: string | undefined;
  /** `continueEdit`(#121, #132) — NumberField.tsx의 같은 매개변수 설명 참고. */
  onChange: (value: string, continueEdit?: boolean) => void;
  placeholder?: string;
  /** 여러 줄 입력 (텍스트 content 등) */
  multiline?: boolean;
}

/**
 * 문자열 입력. 타이핑 즉시 커밋하되, 연속 타이핑은 undo 한 단계로 합친다(#132).
 *
 * 숫자·색상 칸과 달리 `useDraftInput`을 안 쓴다 — 문자열은 파싱할 것이 없어
 * parse/normalize가 항등이 되고, draft를 두면 입력칸이 store 값이 아니라 로컬
 * 상태로 그려진다. 한글은 IME 조합(compositionstart~end) 중에도 매 단계가
 * onChange로 올라오므로, 그 사이에 값의 출처를 바꾸면 조합 중인 글자와 커서가
 * 흔들릴 여지가 생긴다. 필요한 건 draft가 아니라 burst 추적뿐이라 그것만 쓴다.
 * (조합 중 올라오는 "ㄱ"→"가"→"각"도 같은 burst라 한 단계로 합쳐진다.)
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: TextFieldProps) {
  const burst = useEditBurst();
  const shown = value ?? "";

  function handleChange(next: string) {
    // 값이 그대로면 아예 커밋하지 않는다. 스토어는 어차피 no-op이지만, 그래도
    // 커밋을 부르면 burst만 시작돼서(next()가 true를 반환하기 시작해서) 뒤따르는
    // 글자들이 "직전 편집"의 체크포인트에 덮어써진다 — 그 직전 편집이 남인
    // 경우(예: 방금 바꾼 gap) 그 단계가 통째로 사라진다. 글자를 선택해 같은
    // 글자로 덮어쓸 때 실제로 이 입력이 올라온다.
    if (next === shown) {
      return;
    }
    onChange(next, burst.next());
  }

  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={shown}
          placeholder={placeholder}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={burst.end}
        />
      ) : (
        <input
          type="text"
          className={inputClass}
          value={shown}
          placeholder={placeholder}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={burst.end}
        />
      )}
    </Field>
  );
}
