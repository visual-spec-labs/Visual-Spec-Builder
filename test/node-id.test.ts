import { describe, expect, it } from "vitest";

import { generateNodeId } from "@/features/editor/store/nodeId";

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
