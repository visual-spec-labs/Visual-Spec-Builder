import { describe, expect, it } from "vitest";

import { reorderedIndex } from "@/features/editor/ui/reorderSibling";

const children = ["a", "b", "c", "d"];

describe("reorderedIndex — 컨텍스트 메뉴의 순서 바꾸기(#152)", () => {
  it("맨 앞으로는 0이다", () => {
    expect(reorderedIndex(children, "c", "front")).toBe(0);
  });

  it("맨 뒤로는 마지막 인덱스다", () => {
    expect(reorderedIndex(children, "a", "back")).toBe(3);
  });

  it("앞으로는 한 칸 당긴다", () => {
    expect(reorderedIndex(children, "c", "forward")).toBe(1);
  });

  it("뒤로는 한 칸 민다", () => {
    expect(reorderedIndex(children, "b", "backward")).toBe(2);
  });

  it("이미 맨 앞이면 앞으로 가도 그대로다", () => {
    expect(reorderedIndex(children, "a", "forward")).toBe(0);
  });

  it("이미 맨 뒤면 뒤로 가도 그대로다", () => {
    expect(reorderedIndex(children, "d", "backward")).toBe(3);
  });

  it("목록에 없는 id면 null이다", () => {
    expect(reorderedIndex(children, "없음", "front")).toBeNull();
  });

  it("자식이 하나뿐이면 어느 방향이든 제자리다", () => {
    expect(reorderedIndex(["only"], "only", "forward")).toBe(0);
    expect(reorderedIndex(["only"], "only", "backward")).toBe(0);
  });
});
