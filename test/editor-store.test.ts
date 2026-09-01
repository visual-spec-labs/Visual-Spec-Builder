import { describe, expect, it, beforeEach } from "vitest";

import {
  migrateV01,
  validateProjectSpec,
  validateVisualSpec,
} from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
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

/** 지금 캔버스에 떠 있는 페이지. 테스트 대부분이 이 안의 노드를 본다. */
function activePage(): ScreenSpec {
  const { spec, activePageId } = useEditorStore.getState();
  return spec.pages[activePageId];
}

/** 테스트가 spec을 누적으로 바꾸므로 시드 프로젝트로 매번 되돌린다. */
function resetToSeed(): void {
  const spec = migrateV01(seedSpec);
  useEditorStore.setState({
    spec,
    activePageId: spec.pageOrder[0],
    selectedId: null,
  });
}

describe("editorStore", () => {
  beforeEach(resetToSeed);

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

    const cardA = activePage().nodes.cardA;
    expect(cardA.type === "frame" && cardA.layout.gap).toBe(40);
    expect(after).not.toBe(before); // 새 spec 참조
    expect(activePage().nodes.cardB).toBe(
      before.pages[before.pageOrder[0]].nodes.cardB,
    ); // 형제 유지
  });

  it("setNodeField 결과가 여전히 유효한 프로젝트다", () => {
    useEditorStore.getState().setNodeField("cardA", "background.color", "#123456");
    useEditorStore.getState().setNodeField("headerTitle", "typography.fontSize", 22);

    const result = validateProjectSpec(useEditorStore.getState().spec);
    expect(result.valid).toBe(true);
  });

  it("없는 노드 id는 무시한다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().setNodeField("does-not-exist", "box.width", 10);
    expect(useEditorStore.getState().spec).toBe(before);
  });

  it("한 페이지를 고쳐도 다른 페이지는 참조가 그대로다", () => {
    useEditorStore.getState().addPage();
    const before = useEditorStore.getState().spec;
    const untouched = before.pageOrder[0];

    useEditorStore.getState().selectPage(untouched);
    useEditorStore.getState().setNodeField("cardA", "layout.gap", 8);

    const after = useEditorStore.getState().spec;
    expect(after.pages[before.pageOrder[1]]).toBe(before.pages[before.pageOrder[1]]);
  });

  it("blankSpec(File > New)은 그 자체로 유효한 v0.1 스펙이다", () => {
    expect(validateVisualSpec(blankSpec)).toEqual({ valid: true, issues: [] });
  });

  describe("loadSpec", () => {
    it("v0.1 문서를 받으면 페이지 1개짜리 프로젝트로 넓힌다", () => {
      useEditorStore.getState().select("cardA");
      useEditorStore.getState().loadSpec(blankSpec);

      const { spec, activePageId, selectedId } = useEditorStore.getState();
      expect(spec.version).toBe("0.2");
      expect(spec.pageOrder).toHaveLength(1);
      expect(spec.pages[activePageId]).toEqual(blankSpec.screen);
      expect(selectedId).toBeNull();
    });

    it("v0.2 프로젝트는 그대로 싣고 첫 페이지를 연다", () => {
      const project = migrateV01(seedSpec);
      useEditorStore.getState().loadSpec(project);

      const { spec, activePageId } = useEditorStore.getState();
      expect(spec).toBe(project);
      expect(activePageId).toBe(project.pageOrder[0]);
    });
  });

  describe("selectPage", () => {
    it("활성 페이지를 바꾸고 선택을 해제한다", () => {
      useEditorStore.getState().addPage();
      const first = useEditorStore.getState().spec.pageOrder[0];
      useEditorStore.getState().select("root");

      useEditorStore.getState().selectPage(first);

      expect(useEditorStore.getState().activePageId).toBe(first);
      expect(useEditorStore.getState().selectedId).toBeNull();
    });

    it("없는 페이지 id는 무시한다", () => {
      const before = useEditorStore.getState().activePageId;
      useEditorStore.getState().selectPage("does-not-exist");
      expect(useEditorStore.getState().activePageId).toBe(before);
    });
  });

  describe("setPageField", () => {
    it("페이지 크기(해상도)를 바꾼다", () => {
      const pageId = useEditorStore.getState().activePageId;
      useEditorStore.getState().setPageField(pageId, "size.width", 1920);

      expect(activePage().size.width).toBe(1920);
      expect(activePage().size.height).toBe(900); // 형제 값 유지
    });

    it("페이지 이름을 바꾼다", () => {
      const pageId = useEditorStore.getState().activePageId;
      useEditorStore.getState().setPageField(pageId, "name", "Login");

      expect(activePage().name).toBe("Login");
    });

    it("없는 페이지 id는 무시한다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().setPageField("does-not-exist", "name", "X");
      expect(useEditorStore.getState().spec).toBe(before);
    });
  });

  describe("addPage / removePage", () => {
    it("addPage는 빈 페이지를 끝에 붙이고 그리로 이동한다", () => {
      useEditorStore.getState().addPage();

      const { spec, activePageId, selectedId } = useEditorStore.getState();
      expect(spec.pageOrder).toHaveLength(2);
      expect(activePageId).toBe(spec.pageOrder[1]);
      expect(selectedId).toBeNull();
      expect(activePage().nodes).toEqual(blankSpec.screen.nodes);
    });

    it("addPage 결과가 여전히 유효한 프로젝트다", () => {
      useEditorStore.getState().addPage();
      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
    });

    it("마지막 한 장은 지우지 않는다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().removePage(before.pageOrder[0]);
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("활성 페이지를 지우면 같은 자리의 이웃으로 옮겨 간다", () => {
      useEditorStore.getState().addPage();
      const [first, second] = useEditorStore.getState().spec.pageOrder;

      useEditorStore.getState().selectPage(first);
      useEditorStore.getState().removePage(first);

      expect(useEditorStore.getState().spec.pageOrder).toEqual([second]);
      expect(useEditorStore.getState().activePageId).toBe(second);
      expect(useEditorStore.getState().selectedId).toBeNull();
    });

    it("활성이 아닌 페이지를 지우면 보던 페이지가 유지된다", () => {
      useEditorStore.getState().addPage();
      const [first, second] = useEditorStore.getState().spec.pageOrder;

      useEditorStore.getState().removePage(first);

      expect(useEditorStore.getState().activePageId).toBe(second);
    });

    it("없는 페이지 id는 무시한다", () => {
      useEditorStore.getState().addPage();
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().removePage("does-not-exist");
      expect(useEditorStore.getState().spec).toBe(before);
    });
  });

  describe("insertNode", () => {
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

      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toEqual([
        { node: "cardA" },
        { node: "cardB" },
        { node: "image-1" },
      ]);
      expect(activePage().nodes["image-1"]).toEqual(imageNode);
      expect(useEditorStore.getState().selectedId).toBe("image-1");
      expect(useEditorStore.getState().spec).not.toBe(before);
    });

    it("결과가 여전히 유효한 프로젝트다", () => {
      useEditorStore.getState().insertNode("root", "image-1", imageNode);

      const result = validateProjectSpec(useEditorStore.getState().spec);
      expect(result.valid).toBe(true);
    });

    it("활성 페이지에만 붙는다", () => {
      useEditorStore.getState().addPage();
      const [first, second] = useEditorStore.getState().spec.pageOrder;

      useEditorStore.getState().insertNode("root", "image-1", imageNode);

      const { spec } = useEditorStore.getState();
      expect(spec.pages[second].nodes["image-1"]).toEqual(imageNode);
      expect(spec.pages[first].nodes["image-1"]).toBeUndefined();
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
