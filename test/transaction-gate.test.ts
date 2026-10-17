import { describe, expect, it } from "vitest";

import type { Command } from "@/features/editor/command/types";
import { dryRunTransaction, runTransactionGates } from "@/features/editor/command/transactionGate";
import { migrateV01 } from "@/features/editor/schema";
import type { Node, PageId, ProjectSpec } from "@/features/editor/schema";
import { seedSpec } from "@/features/editor/store/seedSpec";

const SPEC: ProjectSpec = migrateV01(seedSpec);
const PAGE_ID = SPEC.pageOrder[0];
const SCREEN = SPEC.pages[PAGE_ID];

describe("dryRunTransaction — G2(#154)", () => {
  it("no-op 없이 전부 성공하면 noOps가 비어 있다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 },
      { type: "updateNode", id: "cardB", path: "layout.gap", value: 4 },
    ];
    const result = dryRunTransaction(SCREEN, commands);

    expect(result.noOps).toEqual([]);
    expect(result.screen).not.toBe(SCREEN);
  });

  it("no-op을 인덱스·이유와 함께 전부 기록한다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 }, // 0: 성공
      { type: "updateNode", id: "없음", path: "layout.gap", value: 4 }, // 1: no-op
      { type: "deleteNode", id: SCREEN.root }, // 2: no-op(root)
      { type: "updateNode", id: "cardB", path: "layout.gap", value: 4 }, // 3: 성공
    ];
    const result = dryRunTransaction(SCREEN, commands);

    expect(result.noOps).toHaveLength(2);
    expect(result.noOps[0]).toMatchObject({ index: 1, reason: "id '없음'가 없습니다" });
    expect(result.noOps[1]).toMatchObject({ index: 2, reason: "root는 지울 수 없습니다" });
  });

  it("no-op이 섞여도 나머지 Command는 계속 접는다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "없음", path: "layout.gap", value: 4 }, // no-op
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 99 }, // 이어서 성공
    ];
    const result = dryRunTransaction(SCREEN, commands);

    const cardA = result.screen.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(99);
  });

  it("빈 배열이면 no-op도 없고 화면도 그대로다", () => {
    const result = dryRunTransaction(SCREEN, []);
    expect(result.noOps).toEqual([]);
    expect(result.screen).toBe(SCREEN);
  });
});

describe("runTransactionGates — G2→G3, 전부-또는-전무(#154)", () => {
  it("전부 통과하면 ok:true와 최종 화면을 돌려준다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 },
    ];
    const result = runTransactionGates(SPEC, PAGE_ID, commands);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const cardA = result.screen.nodes.cardA;
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(4);
    }
  });

  it("존재하지 않는 pageId면 예외를 던지지 않고 ok:false를 돌려준다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 },
    ];
    const missingPageId = "존재하지-않는-id" as PageId;

    expect(() => runTransactionGates(SPEC, missingPageId, commands)).not.toThrow();

    const result = runTransactionGates(SPEC, missingPageId, commands);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe("pageNotFound");
      if (result.failure.kind === "pageNotFound") {
        expect(result.failure.pageId).toBe(missingPageId);
      }
    }
  });

  it("G2에서 no-op이 하나라도 있으면 통째로 버린다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 }, // 유효
      { type: "updateNode", id: "없음", path: "layout.gap", value: 4 }, // no-op
    ];
    const result = runTransactionGates(SPEC, PAGE_ID, commands);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe("noOp");
      if (result.failure.kind === "noOp") {
        expect(result.failure.noOps).toHaveLength(1);
        expect(result.failure.noOps[0].reason).toBe("id '없음'가 없습니다");
      }
    }
  });

  it("G3 — 개별 Command는 성공해도 결과가 스키마를 어기면 버린다", () => {
    // applyCreateNode는 command.node의 모양을 검사하지 않는다 — 필수 필드가
    // 빠진 노드도 그대로 끼워 넣는다. no-op이 아니므로 G2는 통과하지만, 결과
    // 전체를 보는 G3(validateProjectSpec)가 이걸 잡아야 한다.
    const malformedNode = {
      type: "text",
      name: "Broken",
      box: { width: "auto", height: "auto" },
      content: "x",
      // color가 빠졌다 — 스키마 필수 필드
      typography: {
        fontFamily: "Pretendard",
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 20,
        letterSpacing: 0,
        textAlign: "left",
      },
    } as unknown as Node;

    const commands: Command[] = [
      { type: "createNode", parentId: "content", id: "broken", node: malformedNode },
    ];
    const result = runTransactionGates(SPEC, PAGE_ID, commands);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.kind).toBe("invalid");
      if (result.failure.kind === "invalid") {
        expect(result.failure.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it("실패해도 원본 spec 참조는 바뀌지 않는다 — 부분 적용이 없다", () => {
    const commands: Command[] = [
      { type: "updateNode", id: "cardA", path: "layout.gap", value: 4 },
      { type: "updateNode", id: "없음", path: "layout.gap", value: 4 },
    ];
    runTransactionGates(SPEC, PAGE_ID, commands);

    // runTransactionGates는 순수 함수라 SPEC 자신은 애초에 안 바뀐다 —
    // 이 테스트는 "호출 뒤에도 여전히 원본과 같다"를 재확인한다.
    expect(SPEC.pages[PAGE_ID].nodes.cardA).toBe(SCREEN.nodes.cardA);
  });

  it("프로젝트 스타일 Command를 같은 transaction에서 검증·적용한다", () => {
    const spec = structuredClone(SPEC);
    const page = spec.pages[PAGE_ID];
    const text = Object.entries(page.nodes).find(([, node]) => node.type === "text");
    expect(text).toBeDefined();
    if (!text || text[1].type !== "text") return;
    spec.styles = { colors: { "color-primary": { name: "Primary", value: text[1].color } } };
    text[1].styleRefs = { colors: { color: "color-primary" } };

    const result = runTransactionGates(spec, PAGE_ID, [
      { type: "updateColorStyle", id: "color-primary", name: "Brand", value: "#123456" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.screen.nodes[text[0]]).toMatchObject({ color: "#123456" });
    expect(text[1].color).not.toBe("#123456");
  });

  it("자연어 updateNode 직접 편집은 해당 스타일 연결을 끊고 literal을 바꾼다", () => {
    const spec = structuredClone(SPEC);
    const page = spec.pages[PAGE_ID];
    const text = Object.entries(page.nodes).find(([, node]) => node.type === "text");
    expect(text).toBeDefined();
    if (!text || text[1].type !== "text") return;
    spec.styles = { colors: { "color-primary": { name: "Primary", value: text[1].color } } };
    text[1].styleRefs = { colors: { color: "color-primary" } };

    const result = runTransactionGates(spec, PAGE_ID, [
      { type: "updateNode", id: text[0], path: "color", value: "#654321" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const resultNode = result.screen.nodes[text[0]];
      expect(result.screen.nodes[text[0]]).toMatchObject({ color: "#654321" });
      expect("styleRefs" in resultNode ? resultNode.styleRefs : undefined).toBeUndefined();
    }
    expect(text[1].color).not.toBe("#654321");
  });

  it("스타일 create/apply/delete를 한 원자 transaction으로 처리한다", () => {
    const spec = structuredClone(SPEC);
    const text = Object.entries(spec.pages[PAGE_ID].nodes).find(([, node]) => node.type === "text");
    expect(text).toBeDefined();
    if (!text || text[1].type !== "text") return;
    const result = runTransactionGates(spec, PAGE_ID, [
      { type: "createColorStyle", id: "color-brand", name: "Brand", value: "#112233" },
      { type: "applyColorStyle", id: "color-brand", nodeId: text[0], target: "color" },
      { type: "deleteColorStyle", id: "color-brand" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const resultNode = result.screen.nodes[text[0]];
      expect(result.spec.styles?.colors?.["color-brand"]).toBeUndefined();
      expect(result.screen.nodes[text[0]]).toMatchObject({ color: "#112233" });
      expect("styleRefs" in resultNode ? resultNode.styleRefs?.colors : undefined).toBeUndefined();
    }
    expect(spec.styles).toBeUndefined();
  });
});
