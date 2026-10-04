import { describe, expect, it } from "vitest";

import { resolveScope, scopeOptions } from "@/features/editor/nl/nlScope";
import type { ScreenSpec } from "@/features/editor/schema";

/**
 * 적용 범위 (이슈 #155).
 *
 * 03-user-flow.md가 정한 기본값 표를 그대로 고정한다 —
 * 요소를 선택했으면 선택 요소, 아무것도 선택 안 했으면 현재 화면.
 */

const page: ScreenSpec = {
  name: "Product List",
  size: { width: 1440, height: 900 },
  root: "root",
  nodes: {
    root: {
      type: "frame",
      name: "Screen",
      box: { width: "fill", height: "fill" },
      layout: {
        direction: "column",
        gap: 8,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "stretch",
      },
      background: [{ type: "solid", color: "#FFFFFF" }],
      children: [{ node: "card" }],
    },
    card: {
      type: "frame",
      name: "ProductCard",
      box: { width: "fill", height: "auto" },
      layout: {
        direction: "column",
        gap: 8,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "stretch",
      },
      background: [{ type: "solid", color: "#FFFFFF" }],
      children: [],
    },
  },
};

describe("resolveScope — 기본값", () => {
  it("요소를 선택하면 선택 요소가 범위다", () => {
    expect(resolveScope(page, "card")).toEqual({
      kind: "node",
      nodeId: "card",
      label: "현재 선택 요소: ProductCard",
    });
  });

  it("아무것도 선택 안 했으면 현재 화면이다", () => {
    expect(resolveScope(page, null)).toEqual({
      kind: "screen",
      nodeId: null,
      label: "현재 화면: Product List",
    });
  });

  it("선택 id가 이 페이지에 없으면 화면으로 떨어진다 — 페이지를 바꾼 직후가 그렇다", () => {
    expect(resolveScope(page, "지워진노드").kind).toBe("screen");
  });
});

describe("resolveScope — 사용자가 직접 고른 범위", () => {
  it("선택 요소가 있어도 화면을 고르면 화면이다", () => {
    expect(resolveScope(page, "card", "screen")).toEqual({
      kind: "screen",
      nodeId: null,
      label: "현재 화면: Product List",
    });
  });

  it("선택이 없는데 node 를 고른 상태는 성립하지 않는다 — 화면으로 떨어진다", () => {
    expect(resolveScope(page, null, "node").kind).toBe("screen");
  });

  it("node 를 골랐고 선택도 있으면 선택 요소다", () => {
    expect(resolveScope(page, "card", "node").nodeId).toBe("card");
  });
});

describe("scopeOptions — 입력창 위 라디오 두 칸", () => {
  it("선택이 있으면 두 칸 다 고를 수 있다", () => {
    expect(scopeOptions(page, "card")).toEqual([
      { kind: "node", label: "현재 선택 요소: ProductCard", disabled: false },
      { kind: "screen", label: "현재 화면: Product List", disabled: false },
    ]);
  });

  it("선택이 없으면 선택 요소 칸은 고를 수 없다", () => {
    const [nodeOption] = scopeOptions(page, null);

    expect(nodeOption).toEqual({ kind: "node", label: "현재 선택 요소: 없음", disabled: true });
  });

  it("1차에는 '전체 프로젝트' 칸이 없다 — docs/08 7.2", () => {
    expect(scopeOptions(page, "card")).toHaveLength(2);
  });
});
