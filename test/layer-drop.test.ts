import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import { resolveLayerDrop } from "@/features/editor/ui/layerDrop";
import type { VisualSpec } from "@/features/editor/schema";

// root > header(frame) > headerTitle(text)
//      > content(frame) > cardA(frame) > cardALabel(text), cardAValue(text)
//                        > cardB(frame) > cardBLabel(text), cardBValue(text)
const { nodes } = (dashboardCards as VisualSpec).screen;

describe("resolveLayerDrop", () => {
  it("frame 위에 놓으면 그 자식 끝으로 재부모화한다", () => {
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "cardA",
        dragParentId: "content",
        targetId: "header",
        targetParentId: "root",
      }),
    ).toEqual({ newParentId: "header", index: 1 }); // header.children.length === 1
  });

  it("root 위에 놓으면 최상위로 재부모화한다", () => {
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "headerTitle",
        dragParentId: "header",
        targetId: "root",
        targetParentId: null,
      }),
    ).toEqual({ newParentId: "root", index: 2 }); // root.children.length === 2
  });

  it("같은 부모의 형제 위에 놓으면 그 자리로 순서를 바꾼다", () => {
    // cardA.children === [cardALabel, cardAValue] — cardAValue(index 1)를 cardALabel(index 0) 자리로.
    // 둘 다 text라 frame 분기(재부모화)가 아니라 순서 변경 분기를 탄다.
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "cardAValue",
        dragParentId: "cardA",
        targetId: "cardALabel",
        targetParentId: "cardA",
      }),
    ).toEqual({ newParentId: "cardA", index: 0 });
  });

  it("제거로 인해 뒤로 밀리는 자리를 보정한다(앞에서 뒤로 옮길 때)", () => {
    // cardALabel(index 0)을 cardAValue(index 1) 자리로 — 제거 후 cardAValue가 index 0으로 당겨진다.
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "cardALabel",
        dragParentId: "cardA",
        targetId: "cardAValue",
        targetParentId: "cardA",
      }),
    ).toEqual({ newParentId: "cardA", index: 0 });
  });

  it("형제라도 frame 위에 놓으면 순서 변경이 아니라 그 안으로 재부모화한다", () => {
    // content.children === [cardA, cardB] — cardB를 형제 cardA 위에 놓아도, cardA가
    // frame이라 자리를 바꾸는 게 아니라 cardA의 자식으로 들어간다.
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "cardB",
        dragParentId: "content",
        targetId: "cardA",
        targetParentId: "content",
      }),
    ).toEqual({ newParentId: "cardA", index: 2 }); // cardA.children.length === 2
  });

  it("다른 부모에 속한 노드 위에 놓으면 그 부모 안으로 재부모화한다", () => {
    // cardA.children === [cardALabel, cardAValue] — headerTitle을 cardALabel 자리로.
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "headerTitle",
        dragParentId: "header",
        targetId: "cardALabel",
        targetParentId: "cardA",
      }),
    ).toEqual({ newParentId: "cardA", index: 0 });
  });

  it("자기 자신 위에 놓으면 null이다", () => {
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "cardA",
        dragParentId: "content",
        targetId: "cardA",
        targetParentId: "content",
      }),
    ).toBeNull();
  });

  it("자기 자손 위에 놓으면 null이다(순환 방지)", () => {
    expect(
      resolveLayerDrop({
        nodes,
        dragId: "content",
        dragParentId: "root",
        targetId: "cardALabel", // content의 자손
        targetParentId: "cardA",
      }),
    ).toBeNull();
  });
});
