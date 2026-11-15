import { describe, expect, it } from "vitest";

import { generateNodeId, generateNodeIds } from "@/features/editor/store/nodeId";

describe("generateNodeId", () => {
  it("빈 nodes에서는 1번부터 시작한다", () => {
    expect(generateNodeId("image", {})).toBe("image-1");
  });

  it("이미 쓰인 번호는 건너뛴다", () => {
    const nodes = { "image-1": {}, "image-2": {} };
    expect(generateNodeId("image", nodes)).toBe("image-3");
  });

  it("1번부터 순차 탐색하므로 중간에 빈 번호가 있으면 그 자리를 채운다", () => {
    const nodes = { "image-1": {}, "image-3": {} };
    expect(generateNodeId("image", nodes)).toBe("image-2");
  });

  it("접두사가 다르면 서로 간섭하지 않는다", () => {
    const nodes = { "image-1": {}, "text-1": {} };
    expect(generateNodeId("text", nodes)).toBe("text-2");
  });
});

describe("generateNodeIds — 한 배치에서 여러 개 뽑기(#151)", () => {
  it("같은 접두사를 여러 번 요청해도 서로 겹치지 않는다", () => {
    // generateNodeId를 그냥 반복 호출했다면 둘 다 "frame-1"이 나왔을 상황이다 —
    // 매 호출이 원본 nodes만 보고, 서로가 막 뽑은 id를 모르기 때문이다.
    expect(generateNodeIds(["frame", "frame", "frame"], {})).toEqual([
      "frame-1",
      "frame-2",
      "frame-3",
    ]);
  });

  it("이미 쓰인 번호는 건너뛰고, 그 뒤로는 이어서 매긴다", () => {
    const nodes = { "text-1": {}, "text-2": {} };
    expect(generateNodeIds(["text", "text"], nodes)).toEqual(["text-3", "text-4"]);
  });

  it("접두사가 섞여 있어도 각자의 번호를 챙긴다", () => {
    const nodes = { "frame-1": {} };
    expect(generateNodeIds(["frame", "text", "frame"], nodes)).toEqual([
      "frame-2",
      "text-1",
      "frame-3",
    ]);
  });

  it("빈 목록이면 빈 배열이다", () => {
    expect(generateNodeIds([], {})).toEqual([]);
  });
});
