import { useEffect, useState } from "react";

import { useEditBurst } from "./editBurst";

interface UseDraftInputOptions<TValue, TParsed> {
  /** 외부 값 → draft 문자열. undefined를 반환하면 이번 값 변경에는 draft를 동기화하지 않는다. */
  toDraft: (value: TValue) => string | undefined;
  /** 입력값을 draft에 반영하기 전 정규화(예: "#" 접두어 보정). 기본은 그대로 사용. */
  normalize?: (raw: string) => string;
  /** draft 문자열을 파싱. 유효하지 않으면 undefined. */
  parse: (draft: string) => TParsed | undefined;
  /**
   * 파싱 결과를 커밋해도 스펙 값이 그대로인가(#209). true면 커밋하지 않고 burst도
   * 시작하지 않는다. 입력칸에 보이는 값이 아니라 저장된 값과 견줘야 한다 — 이유는
   * unchangedCommit.ts 주석 참고.
   */
  isUnchanged: (parsed: TParsed) => boolean;
  /**
   * 파싱에 성공했을 때 커밋(store 반영 등).
   *
   * `continueEdit`(#121)이 true면 지금 커밋이 바로 직전 커밋과 같은 타이핑
   * burst를 잇는 것이다(예: "1" 다음에 "16") — `setNodeField`/`setPageField`에
   * 그대로 넘기면 새 undo 단계를 안 쌓고 직전 체크포인트에 덮어쓴다. burst의
   * 첫 커밋이거나 `handleBlur` 뒤 다시 시작한 편집이면 false로 온다.
   */
  onCommit: (parsed: TParsed, continueEdit: boolean) => void;
}

/**
 * NumberField / SizeField / ColorField가 공통으로 쓰는 입력 상태 머신.
 * 타이핑 중엔 draft로 받다가 유효하고 값이 바뀌면 즉시 onCommit하고, 외부에서 값이 바뀌면 draft를 리셋한다.
 */
export function useDraftInput<TValue, TParsed>(
  value: TValue,
  { toDraft, normalize, parse, isUnchanged, onCommit }: UseDraftInputOptions<TValue, TParsed>,
) {
  const [draft, setDraft] = useState(() => toDraft(value) ?? "");
  const [invalid, setInvalid] = useState(false);
  /**
   * 지금 같은 편집(타이핑 burst)을 잇는 중인지. `handleBlur`가 끊는다(#121).
   * TextField(#132)도 같은 추적기를 쓴다 — draft 관리 없이 burst만 필요해서
   * 별도 모듈로 나눠뒀다. 판정 근거는 editBurst.ts 주석 참고.
   */
  const burst = useEditBurst();

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
    // 값이 그대로면 커밋하지 않는다(#209). draft는 사용자가 친 그대로 둔다.
    // burst.next()보다 먼저 걸러야 한다 — 부르는 순간 burst가 시작돼 다음 입력이
    // continueEdit: true로 올라간다(TextField.tsx의 같은 가드 참고).
    if (parsed === undefined || isUnchanged(parsed)) {
      return;
    }
    onCommit(parsed, burst.next());
  }

  /** 포커스가 빠지면 burst를 끝낸다 — 다음 편집(같은 칸이라도)은 새 undo 단계로 잡힌다. */
  function handleBlur() {
    burst.end();
  }

  return { draft, invalid, handleChange, handleBlur };
}
