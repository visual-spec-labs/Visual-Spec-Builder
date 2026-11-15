import { describe, expect, it } from "vitest";

import { resolveImportParent } from "@/features/editor/store/resolveImportParent";
import { seedSpec } from "@/features/editor/store/seedSpec";

describe("resolveImportParent", () => {
  it("선택된 노드가 frame이면 그 id를 반환한다", () => {
    expect(resolveImportParent(seedSpec.screen, "cardA")).toBe("cardA");
  });

  it("선택된 노드가 text면 root를 반환한다", () => {
    expect(resolveImportParent(seedSpec.screen, "cardALabel")).toBe("root");
  });

  it("선택된 노드가 없으면(null) root를 반환한다", () => {
    expect(resolveImportParent(seedSpec.screen, null)).toBe("root");
  });

  it("selectedId가 존재하지 않는 id면 root를 반환한다", () => {
    expect(resolveImportParent(seedSpec.screen, "does-not-exist")).toBe("root");
  });
});
