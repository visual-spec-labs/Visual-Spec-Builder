/**
 * 범용 Undo/Redo 스택. VisualSpec 전용이 아니라 스냅샷 하나를 통째로
 * 기억하는 방식이라 T는 뭐든 된다 — 여기서는 T = VisualSpec으로 쓴다.
 *
 * Command 목록을 거꾸로 돌리는(inverse command) 방식 대신 스냅샷을 쌓는다.
 * VisualSpec은 이미 항상 불변 업데이트라(setByPath/applyCommand 전부 새
 * 객체를 반환) 이전 값을 그냥 들고 있기만 하면 되고, 역연산을 커맨드마다
 * 새로 정의할 필요가 없다.
 *
 * pushHistory를 트랜잭션 하나당 한 번만 부르면(individual command마다 부르지
 * 않으면) PRD 13장이 요구하는 "여러 노드를 바꾼 요청 하나 = Undo 한 번"이 된다.
 * applyTransaction으로 여러 Command를 먼저 다 적용한 뒤 그 결과 하나만
 * pushHistory에 넘기면 된다.
 */
export interface HistoryState<T> {
  /** 지금보다 앞선 상태들. 배열 끝이 가장 최근(=undo 시 돌아갈 상태). */
  past: T[];
  present: T;
  /** undo로 밀려난 상태들. 배열 앞이 redo 시 돌아갈 상태. */
  future: T[];
}

export function initHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

/**
 * 새 상태를 present로 밀어넣는다. 지금 present는 past 끝에 쌓이고,
 * future는 비운다 — 새 변경이 생기면 그 전의 "되돌렸던 미래"는 더 이상
 * 의미가 없다(표준 Undo/Redo 동작).
 * next가 present와 같은 참조면(변경이 실제로 없었던 경우 — applyCommand가
 * 규칙 위반으로 no-op일 때 흔하다) 히스토리를 쌓지 않는다.
 */
export function pushHistory<T>(history: HistoryState<T>, next: T): HistoryState<T> {
  if (next === history.present) return history;

  return { past: [...history.past, history.present], present: next, future: [] };
}

export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) return history;

  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) return history;

  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}
