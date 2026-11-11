import { describe, expect, it } from "vitest";

import { promptPick, promptText, usePromptDialogStore } from "@/features/editor/store/promptDialogStore";

/**
 * `window.prompt`를 대신하는 전역 다이얼로그 스토어(#288). `promptText`/
 * `promptPick`은 훅이 아닌 평범한 함수라, 실제 렌더링 없이도 "상태를 열고
 * 확인/취소하면 그 값으로 Promise가 풀린다"는 왕복을 직접 테스트할 수 있다 —
 * `panel-toggle.test.ts`가 `toggleTreePanel`을 테스트하는 것과 같은 패턴이다.
 */
describe("promptText/promptPick (#288)", () => {
  it("확인하면 그 값으로 Promise가 풀리고 상태가 닫힌다", async () => {
    const pending = promptText({ title: "다른 이름으로 저장", initialValue: "home.json" });
    const state = usePromptDialogStore.getState().state;
    expect(state.kind).toBe("text");
    if (state.kind !== "text") throw new Error("unreachable");
    expect(state.title).toBe("다른 이름으로 저장");
    expect(state.initialValue).toBe("home.json");
    expect(state.confirmLabel).toBe("확인"); // 기본값
    expect(state.cancelLabel).toBe("취소"); // 기본값

    usePromptDialogStore.getState().resolve("renamed.json");
    await expect(pending).resolves.toBe("renamed.json");
    expect(usePromptDialogStore.getState().state.kind).toBe("closed");
  });

  it("취소하면 null로 풀린다 — window.prompt의 취소와 같은 신호다", async () => {
    const pending = promptText({ title: "이름" });
    usePromptDialogStore.getState().resolve(null);
    await expect(pending).resolves.toBeNull();
  });

  it("옵션을 안 주면 기본 라벨과 빈 문자열로 연다", () => {
    void promptText({ title: "제목만" });
    const state = usePromptDialogStore.getState().state;
    if (state.kind !== "text") throw new Error("unreachable");
    expect(state.initialValue).toBe("");
    expect(state.message).toBeUndefined();
    usePromptDialogStore.getState().resolve(null); // 다음 테스트를 위해 닫는다
  });

  it("promptPick은 목록을 그대로 들고 연다", async () => {
    const pending = promptPick({ title: "스펙 열기", items: ["a.json", "b.json"] });
    const state = usePromptDialogStore.getState().state;
    expect(state.kind).toBe("pick");
    if (state.kind !== "pick") throw new Error("unreachable");
    expect(state.items).toEqual(["a.json", "b.json"]);

    usePromptDialogStore.getState().resolve("b.json");
    await expect(pending).resolves.toBe("b.json");
  });

  it("닫혀 있을 때 resolve를 불러도 아무 일도 안 한다", () => {
    expect(usePromptDialogStore.getState().state.kind).toBe("closed");
    expect(() => usePromptDialogStore.getState().resolve("무시됨")).not.toThrow();
    expect(usePromptDialogStore.getState().state.kind).toBe("closed");
  });

  /**
   * `window.prompt`는 한 번에 하나만 뜨고, 다음 게 뜨려면 반드시 먼저 답해야
   * 했다. 이 스토어는 상태를 그냥 덮어쓰므로 가드가 없으면 먼저 연 쪽의
   * resolve가 영영 안 불려 그 호출자의 await가 끝나지 않는다(#288 리뷰 대응).
   */
  it("이미 열린 다이얼로그가 있을 때 새로 열면 먼저 연 쪽을 null로 취소하고 나중 걸 연다", async () => {
    const first = promptText({ title: "첫 번째" });
    const second = promptPick({ title: "두 번째", items: ["x.json"] });

    await expect(first).resolves.toBeNull(); // 영영 안 풀리는 대신 취소로 정리된다
    expect(usePromptDialogStore.getState().state.kind).toBe("pick");

    usePromptDialogStore.getState().resolve("x.json");
    await expect(second).resolves.toBe("x.json");
  });
});


it("identifies replacement text requests even when their titles match", async () => {
  const first = promptText({ title: "Rename", initialValue: "Alpha" });
  const initial = usePromptDialogStore.getState().state;
  const second = promptText({ title: "Rename", initialValue: "Beta" });
  const replacement = usePromptDialogStore.getState().state;
  if (initial.kind !== "text" || replacement.kind !== "text") throw new Error("Expected text requests");
  expect(replacement.requestId).not.toBe(initial.requestId);
  expect(replacement.initialValue).toBe("Beta");
  await expect(first).resolves.toBeNull();
  usePromptDialogStore.getState().resolve("Beta renamed");
  await expect(second).resolves.toBe("Beta renamed");
});
