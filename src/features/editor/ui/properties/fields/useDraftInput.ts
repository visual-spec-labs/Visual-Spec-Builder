import { useEffect, useState } from "react";

interface UseDraftInputOptions<TValue, TParsed> {
  /** 외부 값 → draft 문자열. undefined를 반환하면 이번 값 변경에는 draft를 동기화하지 않는다. */
  toDraft: (value: TValue) => string | undefined;
  /** 입력값을 draft에 반영하기 전 정규화(예: "#" 접두어 보정). 기본은 그대로 사용. */
  normalize?: (raw: string) => string;
  /** draft 문자열을 파싱. 유효하지 않으면 undefined. */
  parse: (draft: string) => TParsed | undefined;
  /** 파싱에 성공했을 때 커밋(store 반영 등). */
  onCommit: (parsed: TParsed) => void;
}

/**
 * NumberField / SizeField / ColorField가 공통으로 쓰는 입력 상태 머신.
 * 타이핑 중엔 draft로 받다가 유효하면 즉시 onCommit하고, 외부에서 값이 바뀌면 draft를 리셋한다.
 */
export function useDraftInput<TValue, TParsed>(
  value: TValue,
  { toDraft, normalize, parse, onCommit }: UseDraftInputOptions<TValue, TParsed>,
) {
  const [draft, setDraft] = useState(() => toDraft(value) ?? "");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const next = toDraft(value);
    if (next !== undefined) {
      setDraft(next);
      setInvalid(false);
    }
  }, [value]);

  function handleChange(raw: string) {
    const next = normalize ? normalize(raw) : raw;
    setDraft(next);

    const parsed = parse(next);
    setInvalid(parsed === undefined);
    if (parsed !== undefined) {
      onCommit(parsed);
    }
  }

  return { draft, invalid, handleChange };
}
