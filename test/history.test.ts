import { describe, expect, it } from "vitest";

import {
  canRedo,
  canUndo,
  initHistory,
  pushHistory,
  redo,
  replacePresent,
  undo,
} from "@/features/editor/command/history";

describe("history", () => {
  it("초기 상태는 undo/redo 둘 다 못한다", () => {
    const history = initHistory("a");
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(history.present).toBe("a");
  });

  it("push하면 present가 바뀌고 이전 값이 past에 쌓인다", () => {
    const history = pushHistory(initHistory("a"), "b");
    expect(history.present).toBe("b");
    expect(history.past).toEqual(["a"]);
    expect(canUndo(history)).toBe(true);
  });

  it("같은 참조를 push하면(no-op 결과) 히스토리를 쌓지 않는다", () => {
    const history = initHistory("a");
    const next = pushHistory(history, "a" /* 같은 값이지만 참조 비교이므로 문자열은 같은 원시값 */);
    // 원시값은 ===가 값 비교와 같으므로 "변경 없음"으로 처리돼야 한다.
    expect(next).toBe(history);
  });

  it("undo/redo를 왕복한다", () => {
    let history = initHistory("a");
    history = pushHistory(history, "b");
    history = pushHistory(history, "c");

    history = undo(history);
    expect(history.present).toBe("b");
    expect(history.future).toEqual(["c"]);

    history = undo(history);
    expect(history.present).toBe("a");
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present).toBe("b");

    history = redo(history);
    expect(history.present).toBe("c");
    expect(canRedo(history)).toBe(false);
  });

  it("경계에서 undo/redo는 아무 것도 하지 않는다", () => {
    const history = initHistory("a");
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("undo 후 새로 push하면 future(되돌렸던 미래)가 사라진다", () => {
    let history = initHistory("a");
    history = pushHistory(history, "b");
    history = pushHistory(history, "c");
    history = undo(history); // present: b, future: [c]

    history = pushHistory(history, "d");
    expect(history.present).toBe("d");
    expect(history.past).toEqual(["a", "b"]);
    expect(history.future).toEqual([]);
    expect(canRedo(history)).toBe(false);
  });

  describe("replacePresent (#121)", () => {
    it("present만 바뀌고 past/future는 그대로다", () => {
      let history = initHistory("a");
      history = pushHistory(history, "b");
      history = pushHistory(history, "c");
      history = undo(history); // present: b, past: [a], future: [c]

      history = replacePresent(history, "b-edited");
      expect(history.present).toBe("b-edited");
      expect(history.past).toEqual(["a"]);
      expect(history.future).toEqual(["c"]);
    });

    it("pushHistory와 달리 present를 past로 밀어넣지 않는다 — undo 체크포인트를 새로 만들지 않는다", () => {
      const history = pushHistory(initHistory("a"), "b");
      const replaced = replacePresent(history, "c");

      expect(replaced.present).toBe("c");
      expect(replaced.past).toEqual(["a"]); // "b"가 past에 추가되지 않는다
      expect(canUndo(replaced)).toBe(true);

      const undone = undo(replaced);
      expect(undone.present).toBe("a"); // "b"를 거치지 않고 바로 "a"로 돌아간다
    });
  });
});
