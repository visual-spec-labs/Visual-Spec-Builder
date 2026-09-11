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
    history: {}, // setState는 부분 병합이라 안 지우면 이전 테스트의 undo 스택이 새어 들어온다
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

    it("지운 페이지의 history를 지운다 — id가 재사용돼도 안 샌다(#40 리뷰, GAMMJ, PR #102)", () => {
      // generateNodeId는 빈 순번을 재사용한다. 페이지를 지우고 새로 만들면
      // 같은 id를 다시 받을 수 있는데, 그때 지운 페이지의 history가 안
      // 지워져 있으면 새 빈 페이지가 남의 undo 스택을 이어받는다 — 결정적
      // 재현이었다(리뷰 원문 참고). setNodeField로 history를 쌓아야 한다 —
      // setPageField는 이 케이스를 못 잡는다(이 리뷰에서야 history를 타기
      // 시작했으니 "지운 페이지의 흔적"이 될 과거가 애초에 없었을 수 있다).
      useEditorStore.getState().addPage();
      const removedId = useEditorStore.getState().activePageId;
      useEditorStore.getState().setNodeField(
        useEditorStore.getState().spec.pages[removedId].root,
        "name",
        "흔적1",
      );

      useEditorStore.getState().removePage(removedId);
      useEditorStore.getState().addPage();
      const reusedId = useEditorStore.getState().activePageId;

      expect(reusedId).toBe(removedId); // 전제 확인 — 실제로 id가 재사용됐다

      const before = useEditorStore.getState().spec;
      useEditorStore.getState().undo(); // 방금 만든 빈 페이지엔 되돌릴 게 없어야 한다
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

  describe("undo / redo (#40)", () => {
    it("setNodeField 하나를 되돌린다", () => {
      const before = activePage().nodes.cardA;
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);

      useEditorStore.getState().undo();

      expect(activePage().nodes.cardA).toBe(before);
    });

    it("되돌린 것을 다시 실행한다", () => {
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      const changed = activePage().nodes.cardA;
      useEditorStore.getState().undo();

      useEditorStore.getState().redo();

      expect(activePage().nodes.cardA).toBe(changed);
    });

    it("연속된 변경을 순서대로 되돌린다", () => {
      const original = activePage().nodes.cardA;
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 10);
      const first = activePage().nodes.cardA;
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 20);

      useEditorStore.getState().undo();
      expect(activePage().nodes.cardA).toBe(first);

      useEditorStore.getState().undo();
      expect(activePage().nodes.cardA).toBe(original);
    });

    it("되돌릴 것이 없으면 아무 일도 하지 않는다", () => {
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().undo();

      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("다시 실행할 것이 없으면 아무 일도 하지 않는다", () => {
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().redo(); // undo를 안 했으니 future가 비어 있다

      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("한 페이지의 undo가 다른 페이지에 영향을 주지 않는다", () => {
      useEditorStore.getState().addPage();
      const [firstPageId, secondPageId] = useEditorStore.getState().spec.pageOrder;

      useEditorStore.getState().selectPage(firstPageId);
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);

      useEditorStore.getState().selectPage(secondPageId);
      // 새 페이지의 root는 undo할 것이 없다 — 다른 페이지 히스토리를 잘못 봤다면
      // 여기서 뭔가 바뀌었을 것이다.
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("두 setNodeField 사이에 낀 insertNode는 그 사이 한 단계에서 살아남는다", () => {
      // reconciledHistory는 push/점프 직전에 present를 실제 현재 페이지로
      // 맞춘다 — 그래서 "setNodeField → insertNode → setNodeField" 순서면
      // 두 번째 setNodeField가 만드는 체크포인트에 insertNode의 결과가
      // 포함된다. 한 단계만 undo하면 그 체크포인트로 돌아가므로 이미지가
      // 남는다.
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      useEditorStore.getState().insertNode("content", "image-1", {
        type: "image",
        name: "Hero",
        box: { width: 640, height: 360 },
        src: "data:image/png;base64,AAAA",
        fit: "cover",
      });
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 50);

      useEditorStore.getState().undo();

      // gap 40(insertNode 직후 체크포인트)으로 돌아가고, image-1은 남아 있다.
      const cardA = activePage().nodes.cardA;
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(40);
      expect(activePage().nodes["image-1"]).toBeDefined();
    });

    it("알려진 한계 — insertNode 바로 뒤에 undo하면 그 삽입까지 함께 되돌아간다", () => {
      // insertNode 자신은 history에 체크포인트를 안 남긴다(#40 범위 밖). 그
      // 앞뒤로 setNodeField가 없으면 되짚어 갈 중간 스냅숏 자체가 없어서,
      // undo는 그보다 앞선(마지막 tracked) 체크포인트로 통째로 점프한다 —
      // 방금 삽입한 노드까지 함께 사라진다. reconciledHistory의 문서화된
      // 한계이지 이 테스트가 잡으려는 회귀는 아니다.
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      useEditorStore.getState().insertNode("content", "image-1", {
        type: "image",
        name: "Hero",
        box: { width: 640, height: 360 },
        src: "data:image/png;base64,AAAA",
        fit: "cover",
      });

      useEditorStore.getState().undo();

      const cardA = activePage().nodes.cardA;
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(8); // 시드 원래 값까지 되돌아감
      expect(activePage().nodes["image-1"]).toBeUndefined(); // 삽입도 함께 사라짐
      // 그래도 spec 자체는 여전히 유효해야 한다 — 되돌아간 상태가 깨진 트리는 아니다.
      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
    });

    it("setPageField 하나를 되돌린다 — 페이지 필드도 이제 Command Engine을 거친다(#40 리뷰, GAMMJ, PR #102)", () => {
      const pageId = useEditorStore.getState().activePageId;
      const before = activePage().size; // 시드 원래 값: { width: 1440, height: 900 }

      useEditorStore.getState().setPageField(pageId, "size.width", 1920);
      useEditorStore.getState().undo();

      expect(activePage().size).toEqual(before);
    });

    it("노드 편집 뒤의 해상도 변경은 그 해상도만 되돌린다 — 둘 다 되돌아가지 않는다(#40 리뷰, GAMMJ, PR #102)", () => {
      // setPageField가 history를 안 거치던 시절엔, "노드 편집 → 해상도 변경 →
      // undo" 한 번이 둘 다 되돌렸다(해상도가 ScreenSpec 필드라 노드 편집의
      // 스냅숏에도 같이 담겨서). 이제 setPageField도 자기 체크포인트를 남기므로
      // undo 한 번은 해상도만 되돌리고 노드 편집은 남아야 한다.
      const pageId = useEditorStore.getState().activePageId;
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      useEditorStore.getState().setPageField(pageId, "size.width", 1920);

      useEditorStore.getState().undo();

      expect(activePage().size.width).toBe(1440); // 시드 원래 해상도로 복귀
      const cardA = activePage().nodes.cardA;
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(40); // 노드 편집은 남아 있다
    });

    it("loadSpec은 history를 비운다", () => {
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);

      useEditorStore.getState().loadSpec(blankSpec);

      expect(useEditorStore.getState().history).toEqual({});
      // 비었으니 undo를 불러도 blankSpec 이전(시드) 상태로 튀지 않는다.
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().spec).toBe(before);
    });
  });

  describe("removeNode", () => {
    it("부모의 children에서 빼고 노드를 지운다", () => {
      useEditorStore.getState().removeNode("cardB");

      expect(activePage().nodes.cardB).toBeUndefined();
      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toEqual([{ node: "cardA" }]);
    });

    it("프레임을 지우면 자손까지 연쇄 삭제한다", () => {
      useEditorStore.getState().removeNode("cardA");

      expect(activePage().nodes.cardA).toBeUndefined();
      expect(activePage().nodes.cardALabel).toBeUndefined();
      expect(activePage().nodes.cardAValue).toBeUndefined();
    });

    it("결과가 여전히 유효한 프로젝트다", () => {
      useEditorStore.getState().removeNode("cardA");
      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
    });

    it("삭제한 노드가 선택 중이었으면 선택을 해제한다", () => {
      useEditorStore.getState().select("cardAValue"); // cardA의 자손
      useEditorStore.getState().removeNode("cardA");

      expect(useEditorStore.getState().selectedId).toBeNull();
    });

    it("삭제 대상과 무관한 선택은 유지한다", () => {
      useEditorStore.getState().select("cardB");
      useEditorStore.getState().removeNode("cardA");

      expect(useEditorStore.getState().selectedId).toBe("cardB");
    });

    it("root는 지우지 않는다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().removeNode("root");
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("없는 노드 id는 무시한다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().removeNode("does-not-exist");
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("한 페이지에서 지워도 다른 페이지는 참조가 그대로다", () => {
      useEditorStore.getState().addPage();
      const before = useEditorStore.getState().spec;
      const [original, blank] = before.pageOrder;

      useEditorStore.getState().selectPage(original);
      useEditorStore.getState().removeNode("cardB");

      const after = useEditorStore.getState().spec;
      expect(after.pages[blank]).toBe(before.pages[blank]);
    });

    it("결과가 undo 대상이다 — 삭제 뒤 undo하면 노드가 되살아난다", () => {
      useEditorStore.getState().removeNode("cardB");

      useEditorStore.getState().undo();

      expect(activePage().nodes.cardB).toBeDefined();
      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toEqual([
        { node: "cardA" },
        { node: "cardB" },
      ]);
    });
  });

  describe("moveNode", () => {
    it("같은 부모 안에서 순서를 바꾼다", () => {
      useEditorStore.getState().moveNode("cardB", "content", 0);

      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toEqual([
        { node: "cardB" },
        { node: "cardA" },
      ]);
    });

    it("다른 부모로 옮긴다", () => {
      useEditorStore.getState().moveNode("cardA", "header", 0);

      const content = activePage().nodes.content;
      const header = activePage().nodes.header;
      expect(content.type === "frame" && content.children).toEqual([{ node: "cardB" }]);
      expect(header.type === "frame" && header.children).toEqual([
        { node: "cardA" },
        { node: "headerTitle" },
      ]);
    });

    it("결과가 여전히 유효한 프로젝트다", () => {
      useEditorStore.getState().moveNode("cardA", "header", 0);
      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
    });

    it("자기 자손 밑으로는 옮길 수 없다(순환 방지)", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().moveNode("content", "cardA", 0); // cardA는 content의 자손

      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("root는 옮기지 않는다", () => {
      const before = useEditorStore.getState().spec;
      const rootId = activePage().root;
      useEditorStore.getState().moveNode(rootId, "header", 0);

      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("없는 노드 id는 무시한다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().moveNode("does-not-exist", "header", 0);
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("한 페이지에서 옮겨도 다른 페이지는 참조가 그대로다", () => {
      useEditorStore.getState().addPage();
      const before = useEditorStore.getState().spec;
      const [original, blank] = before.pageOrder;

      useEditorStore.getState().selectPage(original);
      useEditorStore.getState().moveNode("cardB", "content", 0);

      const after = useEditorStore.getState().spec;
      expect(after.pages[blank]).toBe(before.pages[blank]);
    });

    it("결과가 undo 대상이다 — 이동 뒤 undo하면 원래 순서로 되돌아간다", () => {
      useEditorStore.getState().moveNode("cardB", "content", 0);

      useEditorStore.getState().undo();

      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toEqual([
        { node: "cardA" },
        { node: "cardB" },
      ]);
    });
  });
});
