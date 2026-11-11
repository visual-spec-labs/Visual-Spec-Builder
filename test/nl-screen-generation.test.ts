import { beforeEach, describe, expect, it } from "vitest";

import loginScreen from "../examples/login-screen.json";

import { canUndo, initHistory } from "@/features/editor/command/history";
import type { Command } from "@/features/editor/command/types";
import { migrateV01, validateProjectSpec } from "@/features/editor/schema";
import type { PageId } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { createNode } from "@/features/editor/store/createNode";
import { useEditorStore } from "@/features/editor/store/editorStore";

/**
 * "빈 화면에서 자연어로 화면을 만든다"(#183) 가 **지금 있는 조각만으로 이미
 * 되는지** 확인하는 통합 테스트다. docs/08-natural-language.md 3.3이 손으로 짚어 본
 * `examples/login-screen.json`(현재 노드 7개) 재현을 코드로 옮겼다. 문서는 최초 4노드 사례에서
 * Command마다 리프 값을 전부 적어야 했지만(53칸), 여기서는 #182의
 * `createNode(kind, overrides)`로 부분 값만 준다.
 *
 * 새 메커니즘은 없다. `runTransactionGates`(G2·G3, #154)와
 * `editorStore.applyGuardedTransaction`은 이미 Command 배열의 종류·개수에 무관한
 * 범용 경로라, "자연어 화면 생성"이 실은 "자연어 부분 수정"과 같은 파이프라인을
 * 탄다는 것을 이 테스트가 실행 가능한 형태로 고정한다.
 */

function resetToBlank(): void {
  const spec = migrateV01(blankSpec);
  useEditorStore.setState({
    spec,
    activePageId: spec.pageOrder[0],
    selectedId: null,
    history: initHistory({ spec, activePageId: spec.pageOrder[0] }),
  });
}

describe("자연어 화면 생성 — 빈 화면 → login-screen 재현 (#183)", () => {
  beforeEach(resetToBlank);

  function pageId(): PageId {
    return useEditorStore.getState().activePageId;
  }

  /** 현재 login-screen 예제를 그대로 재현하는 Command 9개. */
  function loginScreenTransaction(): Command[] {
    return [
      { type: "updateScreen", path: "name", value: "Login" },
      { type: "updateScreen", path: "size", value: { width: 390, height: 844 } },
      {
        type: "setLayout",
        id: "root",
        layout: {
          direction: "column",
          gap: 16,
          padding: { top: 24, right: 20, bottom: 24, left: 20 },
          mainAxis: "start",
          crossAxis: "stretch",
        },
      },
      {
        type: "createNode",
        parentId: "root",
        id: "title",
        node: createNode("text", {
          name: "Title",
          box: { width: "fill", height: "auto" },
          content: "로그인",
          typography: { fontSize: 24, fontWeight: 700, lineHeight: 32, letterSpacing: -0.5 },
        }),
      },
      {
        type: "createNode",
        parentId: "root",
        id: "card",
        node: createNode("frame", {
          name: "Card",
          visible: true,
          box: { width: "fill", height: "auto" },
          // gap·mainAxis·crossAxis를 바꾼다 — padding(사방 16)은 newFrame 기본값과 이미 같다.
          layout: { gap: 12, mainAxis: "center", crossAxis: "stretch" },
          background: [{ type: "solid", color: "#F5F5F5FF" }],
          border: { color: "#00000020" },
        }),
      },
      {
        type: "createNode",
        parentId: "card",
        id: "hint",
        node: createNode("text", {
          name: "Hint",
          content: "계정 정보를 입력하세요",
          color: "#666666",
          typography: { fontSize: 14, lineHeight: 20, textAlign: "center" },
        }),
      },
      {
        type: "createNode",
        parentId: "card",
        id: "emailInput",
        node: createNode("input", {
          name: "EmailInput",
          box: { width: "fill", height: 44 },
          placeholder: "이메일을 입력하세요",
        }),
      },
      {
        type: "createNode",
        parentId: "card",
        id: "passwordInput",
        node: createNode("input", {
          name: "PasswordInput",
          box: { width: "fill", height: 44 },
          placeholder: "비밀번호를 입력하세요",
        }),
      },
      {
        type: "createNode",
        parentId: "card",
        id: "loginButton",
        node: createNode("button", {
          name: "LoginButton",
          box: { width: "fill", height: 44 },
          content: "로그인",
        }),
      },
    ];
  }

  it("전부-또는-전무로 커밋되고 login-screen과 같은 트리가 나온다", () => {
    const gate = useEditorStore.getState().applyGuardedTransaction(pageId(), loginScreenTransaction());

    expect(gate.ok).toBe(true);
    if (!gate.ok) return;

    const page = gate.screen;
    expect(page.name).toBe("Login");
    expect(page.size).toEqual({ width: 390, height: 844 });

    const root = page.nodes.root;
    if (root.type !== "frame") throw new Error("root는 frame이어야 한다");
    expect(root.children).toEqual([{ node: "title" }, { node: "card" }]);

    const card = page.nodes.card;
    if (card.type !== "frame") throw new Error("card는 frame이어야 한다");
    expect(card.children).toEqual([
      { node: "hint" },
      { node: "emailInput" },
      { node: "passwordInput" },
      { node: "loginButton" },
    ]);
    expect(page).toEqual(loginScreen.screen);

    const title = page.nodes.title;
    if (title.type !== "text") throw new Error("title은 text여야 한다");
    expect(title.content).toBe("로그인");
    // 부분 덮어쓰기가 안 건드린 칸은 createNode 기본값 그대로다.
    expect(title.typography.fontFamily).toBe("Pretendard");
    expect(title.typography.textAlign).toBe("left");
  });

  it("결과가 validateProjectSpec을 통과한다", () => {
    const gate = useEditorStore.getState().applyGuardedTransaction(pageId(), loginScreenTransaction());
    expect(gate.ok).toBe(true);

    const result = validateProjectSpec(useEditorStore.getState().spec);
    expect(result.issues).toEqual([]);
  });

  it("요청 하나 = Undo 한 단계 — Command가 9개여도 history는 1단계만 쌓인다", () => {
    expect(canUndo(useEditorStore.getState().history)).toBe(false);

    useEditorStore.getState().applyGuardedTransaction(pageId(), loginScreenTransaction());
    expect(canUndo(useEditorStore.getState().history)).toBe(true);

    useEditorStore.getState().undo();

    // 한 번의 Undo로 모든 노드·레이아웃·이름·해상도가 전부 빈 화면으로
    // 되돌아간다 — Command가 9개였다는 사실이 Undo 횟수에 새지 않는다.
    expect(canUndo(useEditorStore.getState().history)).toBe(false);
    const page = useEditorStore.getState().spec.pages[pageId()];
    expect(page.name).toBe("Untitled");
    const root = page.nodes.root;
    if (root.type !== "frame") throw new Error("root는 frame이어야 한다");
    expect(root.children).toEqual([]);
  });

  it("전부-또는-전무 — 섞인 Command 하나가 no-op이면 스펙도 history도 그대로다", () => {
    const commands = [
      ...loginScreenTransaction(),
      // 존재하지 않는 부모를 가리키는 잘못된 createNode. G2(dry-run)가 no-op으로 잡는다.
      { type: "createNode", parentId: "없음", id: "broken", node: createNode("text") },
    ] satisfies Command[];

    const before = useEditorStore.getState().spec;
    const gate = useEditorStore.getState().applyGuardedTransaction(pageId(), commands);

    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.failure.kind).toBe("noOp");
    // 커밋되지 않았다 — 앞의 아홉 Command가 유효했어도 title 하나 생기지 않는다.
    expect(useEditorStore.getState().spec).toBe(before);
    expect(canUndo(useEditorStore.getState().history)).toBe(false);
  });
});
