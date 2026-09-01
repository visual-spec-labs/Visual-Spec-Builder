import { describe, expect, it, beforeEach } from "vitest";

import { validateVisualSpec } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { getByPath, setByPath } from "@/features/editor/store/path";
import { seedSpec } from "@/features/editor/store/seedSpec";

describe("path utils", () => {
  it("점 표기 경로로 중첩 값을 읽는다", () => {
    const obj = { layout: { gap: 12, padding: { top: 4 } } };
    expect(getByPath(obj, "layout.gap")).toBe(12);
    expect(getByPath(obj, "layout.padding.top")).toBe(4);
  });

  it("없는 경로는 undefined를 반환한다", () => {
    expect(getByPath({ a: 1 }, "b.c")).toBeUndefined();
  });

  it("원본을 변형하지 않고 새 객체를 만든다", () => {
    const obj = { box: { width: 100, height: 50 } };
    const next = setByPath(obj, "box.width", 200);

    expect(next.box.width).toBe(200);
    expect(next.box.height).toBe(50);
    expect(obj.box.width).toBe(100); // 원본 불변
    expect(next).not.toBe(obj);
    expect(next.box).not.toBe(obj.box);
  });

  it("경로가 지나지 않는 형제 참조는 유지한다", () => {
    const obj = { layout: { gap: 8 }, box: { width: 100 } };
    const next = setByPath(obj, "layout.gap", 16);

    expect(next.box).toBe(obj.box); // 안 건드린 가지는 동일 참조
  });
});

describe("editorStore", () => {
  beforeEach(() => {
    useEditorStore.setState({ selectedId: null });
  });

  it("select로 선택 노드를 바꾼다", () => {
    useEditorStore.getState().select("cardA");
    expect(useEditorStore.getState().selectedId).toBe("cardA");

    useEditorStore.getState().select(null);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it("setNodeField로 중첩 값을 불변 업데이트한다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
    const after = useEditorStore.getState().spec;

    const cardA = after.screen.nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(40);
    expect(after).not.toBe(before); // 새 spec 참조
    expect(after.screen.nodes.cardB).toBe(before.screen.nodes.cardB); // 형제 유지
  });

  it("setNodeField 결과가 여전히 유효한 스펙이다", () => {
    useEditorStore.getState().setNodeField("cardA", "background.color", "#123456");
    useEditorStore.getState().setNodeField("headerTitle", "typography.fontSize", 22);

    const result = validateVisualSpec(useEditorStore.getState().spec);
    expect(result.valid).toBe(true);
  });

  it("없는 노드 id는 무시한다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().setNodeField("does-not-exist", "box.width", 10);
    expect(useEditorStore.getState().spec).toBe(before);
  });

  it("loadSpec은 spec을 통째로 교체하고 selectedId를 초기화한다", () => {
    useEditorStore.getState().select("cardA");

    const nextSpec = { ...blankSpec };
    useEditorStore.getState().loadSpec(nextSpec);

    expect(useEditorStore.getState().spec).toBe(nextSpec);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it("blankSpec(File > New)은 그 자체로 유효한 스펙이다", () => {
    expect(validateVisualSpec(blankSpec)).toEqual({ valid: true, issues: [] });
  });

  describe("insertNode", () => {
    // 위 테스트들이 store의 spec을 누적으로 바꿔놓으므로(loadSpec 테스트가
    // blankSpec으로 교체하기도 한다), seedSpec 기준으로 매번 되돌려 독립적으로 검증한다.
    beforeEach(() => {
      useEditorStore.setState({ spec: seedSpec, selectedId: null });
    });

    const imageNode = {
      type: "image" as const,
      name: "Hero",
      box: { width: 640, height: 360 },
      src: "data:image/png;base64,AAAA",
      fit: "cover" as const,
    };

    it("parent(frame)의 children 끝에 붙이고 선택한다", () => {
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().insertNode("content", "image-1", imageNode);
      const after = useEditorStore.getState().spec;

      const content = after.screen.nodes.content;
      expect(content.type === "frame" && content.children).toEqual([
        { node: "cardA" },
        { node: "cardB" },
        { node: "image-1" },
      ]);
      expect(after.screen.nodes["image-1"]).toEqual(imageNode);
      expect(useEditorStore.getState().selectedId).toBe("image-1");
      expect(after).not.toBe(before);
    });

    it("결과가 여전히 유효한 스펙이다", () => {
      useEditorStore.getState().insertNode("root", "image-1", imageNode);

      const result = validateVisualSpec(useEditorStore.getState().spec);
      expect(result.valid).toBe(true);
    });

    it("parentId가 frame이 아니면 아무 것도 하지 않는다", () => {
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().insertNode("cardALabel", "image-1", imageNode);

      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("parentId가 없으면 아무 것도 하지 않는다", () => {
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().insertNode("does-not-exist", "image-1", imageNode);

      expect(useEditorStore.getState().spec).toBe(before);
    });
  });
});
