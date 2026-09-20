import { describe, expect, it, beforeEach } from "vitest";

import { canRedo, canUndo, initHistory } from "@/features/editor/command/history";
import {
  migrateV01,
  validateProjectSpec,
  validateVisualSpec,
} from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { collectSubtree } from "@/features/editor/store/duplicateNode";
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
    // setState는 부분 병합이라 안 지우면 이전 테스트의 undo 스택이 새어 들어온다.
    // 스토어가 초기값으로 쓰는 것과 같은 모양으로 새로 시작한다(#131).
    history: initHistory({ spec, activePageId: spec.pageOrder[0] }),
  });
}

/** 되돌리기/다시 실행 버튼이 켜지는지 — LayerTree footer가 이 두 값을 그대로 쓴다. */
function undoEnabled(): boolean {
  return canUndo(useEditorStore.getState().history);
}

function redoEnabled(): boolean {
  return canRedo(useEditorStore.getState().history);
}

describe("editorStore", () => {
  beforeEach(resetToSeed);

  it("select로 선택 노드를 바꾼다", () => {
    useEditorStore.getState().select("cardA");
    expect(useEditorStore.getState().selectedId).toBe("cardA");

    useEditorStore.getState().select(null);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  describe("focusRootId — 더블클릭 진입 문맥(#151)", () => {
    it("enterFocus로 문맥을 세운다", () => {
      useEditorStore.getState().enterFocus("cardA");
      expect(useEditorStore.getState().focusRootId).toBe("cardA");
    });

    it("select(null)이 문맥도 함께 비운다 — Esc·바깥 클릭이 전부 이 호출을 거친다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().select(null);

      expect(useEditorStore.getState().focusRootId).toBeNull();
    });

    it("select(다른 id)는 문맥을 건드리지 않는다 — 더블클릭이 select를 잇달아 부른다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().select("cardALabel");

      expect(useEditorStore.getState().focusRootId).toBe("cardA");
    });

    it("selectPage가 문맥을 비운다 — 페이지마다 id가 겹칠 수 있다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().addPage();
      const [original] = useEditorStore.getState().spec.pageOrder;

      useEditorStore.getState().selectPage(original);

      expect(useEditorStore.getState().focusRootId).toBeNull();
    });

    it("addPage가 문맥을 비운다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().addPage();

      expect(useEditorStore.getState().focusRootId).toBeNull();
    });

    it("문맥의 노드가 지워지면 문맥도 비운다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().removeNode("cardA");

      expect(useEditorStore.getState().focusRootId).toBeNull();
    });

    it("문맥과 무관한 노드가 지워지면 문맥은 그대로다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().removeNode("cardB");

      expect(useEditorStore.getState().focusRootId).toBe("cardA");
    });

    it("undo·redo는 문맥을 비운다 — 되돌린 트리에 그 프레임이 없을 수 있다", () => {
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      useEditorStore.getState().enterFocus("cardA");

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().focusRootId).toBeNull();

      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().focusRootId).toBeNull();
    });

    it("loadSpec이 문맥을 비운다 — 새 프로젝트다", () => {
      useEditorStore.getState().enterFocus("cardA");
      useEditorStore.getState().loadSpec(seedSpec);

      expect(useEditorStore.getState().focusRootId).toBeNull();
    });
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

  describe("setNodeFields (#149)", () => {
    it("여러 노드 변경을 한 번에 적용하고 Undo 한 단계로 되돌린다", () => {
      const before = activePage();

      useEditorStore.getState().setNodeFields([
        { id: "cardA", path: "box.width", value: 360 },
        { id: "cardB", path: "box.width", value: 360 },
      ]);

      expect(activePage().nodes.cardA.box.width).toBe(360);
      expect(activePage().nodes.cardB.box.width).toBe(360);
      expect(useEditorStore.getState().history.past).toHaveLength(1);

      useEditorStore.getState().undo();
      expect(activePage()).toBe(before);
    });

    it("중간 결과를 내보내지 않고 구독자에게 최종 상태만 한 번 알린다", () => {
      const seenWidths: Array<[unknown, unknown]> = [];
      const unsubscribe = useEditorStore.subscribe((state) => {
        seenWidths.push([
          state.spec.pages[state.activePageId].nodes.cardA.box.width,
          state.spec.pages[state.activePageId].nodes.cardB.box.width,
        ]);
      });

      useEditorStore.getState().setNodeFields([
        { id: "cardA", path: "box.width", value: 360 },
        { id: "cardB", path: "box.width", value: 360 },
      ]);
      unsubscribe();

      expect(seenWidths).toEqual([[360, 360]]);
    });

    it("빈 배열과 전부 no-op인 배열은 spec과 history를 바꾸지 않는다", () => {
      const before = useEditorStore.getState();

      useEditorStore.getState().setNodeFields([]);
      useEditorStore.getState().setNodeFields([
        { id: "missing", path: "box.width", value: 360 },
        { id: "cardA", path: "not.a.path", value: 1 },
      ]);

      expect(useEditorStore.getState().spec).toBe(before.spec);
      expect(useEditorStore.getState().history).toBe(before.history);
    });

    it("유효한 patch는 적용하고 같은 batch의 no-op patch는 건너뛴다", () => {
      useEditorStore.getState().setNodeFields([
        { id: "missing", path: "box.width", value: 360 },
        { id: "cardA", path: "box.width", value: 360 },
      ]);

      expect(activePage().nodes.cardA.box.width).toBe(360);
      expect(useEditorStore.getState().history.past).toHaveLength(1);
    });

    it("연속 batch는 continueEdit으로 같은 Undo 단계에 합친다", () => {
      const beforeCardA = activePage().nodes.cardA.box.width;
      const beforeCardB = activePage().nodes.cardB.box.width;

      useEditorStore.getState().setNodeFields([
        { id: "cardA", path: "box.width", value: 300 },
        { id: "cardB", path: "box.width", value: 300 },
      ]);
      useEditorStore.getState().setNodeFields(
        [
          { id: "cardA", path: "box.width", value: 360 },
          { id: "cardB", path: "box.width", value: 360 },
        ],
        true,
      );

      expect(useEditorStore.getState().history.past).toHaveLength(1);
      useEditorStore.getState().undo();
      expect(activePage().nodes.cardA.box.width).toBe(beforeCardA);
      expect(activePage().nodes.cardB.box.width).toBe(beforeCardB);
    });
  });

  it("없는 노드 id는 무시한다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().setNodeField("does-not-exist", "box.width", 10);
    expect(useEditorStore.getState().spec).toBe(before);
  });

  // #146: 경로 검사가 없으면 setByPath가 스키마에 없는 필드를 붙인 새 객체를
  // 만들고, 새 객체라서 applied()가 no-op으로 못 보고 빈 단계가 history에 쌓인다.
  it("스키마에 없는 경로는 무시하고 history에도 쌓지 않는다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().setNodeField("cardA", "layot.gap", 40);

    expect(useEditorStore.getState().spec).toBe(before);
    expect(undoEnabled()).toBe(false);
  });

  // PR #147 리뷰: 경로 이름만 맞춰보던 때는 이 둘이 새 spec 참조를 만들어 history에
  // 빈 단계로 쌓였고, 그렇게 쌓인 결과가 스키마 검증에 실패했다. #146과 같은 성질의
  // 조용한 오염이라 같은 기준(무시 + history에도 안 쌓임)으로 막는다.
  it("중간 값이 없거나 숫자인 중첩 경로는 무시하고 history에도 쌓지 않는다", () => {
    const before = useEditorStore.getState().spec;

    // header에는 border가 없다 → { width: 3 }만 생겨 color·radius가 빠진다.
    useEditorStore.getState().setNodeField("header", "border.width", 3);
    // cardA의 border.radius는 숫자 12다 → { topLeft: 4 }가 되어 모서리 셋이 빠진다.
    useEditorStore.getState().setNodeField("cardA", "border.radius.topLeft", 4);

    expect(useEditorStore.getState().spec).toBe(before);
    expect(undoEnabled()).toBe(false);
    expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
  });

  // 반대편도 같이 고정한다 — 선택 필드를 처음 설정하는 호출은 계속 통과해야 한다.
  it("border를 완전한 객체로 통째로 넘기는 패널 호출은 그대로 통과한다", () => {
    // ui/properties/BorderSection.tsx가 mergeBorder로 만들어 넘기는 모양.
    useEditorStore
      .getState()
      .setNodeField("header", "border", { width: 3, color: "#000000", radius: 0 });

    const header = activePage().nodes.header;
    expect(header.type === "frame" && header.border).toEqual({
      width: 3,
      color: "#000000",
      radius: 0,
    });
    expect(undoEnabled()).toBe(true);
    expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
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

    // #146: 자연어 변환이 들어오면 이 path는 LLM이 만들어 낸 문자열이 된다.
    it("스키마에 없는 경로는 무시하고 history에도 쌓지 않는다", () => {
      const pageId = useEditorStore.getState().activePageId;
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().setPageField(pageId, "siz.width", 1920);

      expect(useEditorStore.getState().spec).toBe(before);
      expect(undoEnabled()).toBe(false);
    });

    it("정상 경로는 전과 똑같이 history에 한 단계로 쌓인다", () => {
      const pageId = useEditorStore.getState().activePageId;
      useEditorStore.getState().setPageField(pageId, "size.width", 1920);

      expect(undoEnabled()).toBe(true);
      useEditorStore.getState().undo();
      expect(activePage().size.width).toBe(1440);
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

    it("지운 페이지의 옛 내용이 id 재사용으로 새 페이지에 새지 않는다(#40 리뷰, GAMMJ, PR #102 · #131)", () => {
      // generateNodeId는 빈 순번을 재사용한다. 페이지를 지우고 새로 만들면 같은
      // id를 다시 받는데, 페이지별 스택 시절엔 removePage가 history[id]를 손으로
      // 지워주지 않으면 새 빈 페이지가 남의 undo 스택을 이어받았다(리뷰 원문 —
      // 결정적 재현). 스냅숏이 페이지가 아니라 프로젝트 전체가 된 뒤엔(#131) 그
      // 누수가 구조적으로 불가능하다 — 되돌릴 대상이 페이지 id로 묶여 있지 않고,
      // undo는 실제로 있었던 조작을 역순으로 되짚어 갈 뿐이다.
      const firstId = useEditorStore.getState().activePageId;
      useEditorStore.getState().addPage();
      const removedId = useEditorStore.getState().activePageId;
      const rootId = useEditorStore.getState().spec.pages[removedId].root;
      useEditorStore.getState().setNodeField(rootId, "name", "흔적1");

      useEditorStore.getState().removePage(removedId);
      useEditorStore.getState().addPage();
      const reusedId = useEditorStore.getState().activePageId;

      expect(reusedId).toBe(removedId); // 전제 확인 — 실제로 id가 재사용됐다
      expect(activePage().nodes).toEqual(blankSpec.screen.nodes); // 흔적1이 안 따라왔다

      useEditorStore.getState().undo(); // 마지막 조작(페이지 추가)만 되돌아간다
      expect(useEditorStore.getState().spec.pageOrder).toEqual([firstId]);

      useEditorStore.getState().undo(); // 그 앞이 페이지 삭제 — 흔적1과 함께 돌아온다
      const restored = useEditorStore.getState().spec.pages[removedId];
      expect(restored.nodes[rootId].name).toBe("흔적1");
    });

    it("addPage 직후 undo하면 추가된 페이지가 사라진다(#131)", () => {
      const before = useEditorStore.getState().spec;
      const firstId = useEditorStore.getState().activePageId;

      useEditorStore.getState().addPage();
      const addedId = useEditorStore.getState().activePageId;
      expect(undoEnabled()).toBe(true); // 되돌리기 버튼이 켜진다

      useEditorStore.getState().undo();

      const { spec, activePageId } = useEditorStore.getState();
      expect(spec.pageOrder).toEqual([firstId]);
      expect(spec.pages[addedId]).toBeUndefined();
      // 보고 있던 페이지가 사라졌으니 활성 페이지도 함께 되돌아가야 한다 —
      // 안 그러면 activePageId가 없는 페이지를 가리켜 캔버스가 그릴 것을 잃는다.
      expect(activePageId).toBe(firstId);
      expect(spec).toEqual(before);
      expect(validateProjectSpec(spec).valid).toBe(true);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().spec.pageOrder).toEqual([firstId, addedId]);
      expect(useEditorStore.getState().activePageId).toBe(addedId);
    });

    it("removePage 직후 undo하면 지운 페이지와 그 노드가 전부 돌아온다(#131)", () => {
      // 이 조작만 되돌릴 방법이 없어서 그대로 데이터 유실이었다 — 이슈 #131의
      // 급한 쪽이다. 지워진 페이지의 노드까지 온전히 돌아오는지 본다.
      useEditorStore.getState().addPage();
      const [firstId, secondId] = useEditorStore.getState().spec.pageOrder;
      useEditorStore.getState().selectPage(firstId);
      const removedPage = useEditorStore.getState().spec.pages[firstId];

      useEditorStore.getState().removePage(firstId);
      expect(useEditorStore.getState().spec.pages[firstId]).toBeUndefined();
      expect(useEditorStore.getState().activePageId).toBe(secondId);
      expect(undoEnabled()).toBe(true); // 되돌리기 버튼이 켜진다

      useEditorStore.getState().undo();

      const { spec, activePageId } = useEditorStore.getState();
      expect(spec.pageOrder).toEqual([firstId, secondId]);
      expect(spec.pages[firstId]).toEqual(removedPage); // 노드까지 그대로
      expect(Object.keys(spec.pages[firstId].nodes).length).toBeGreaterThan(1);
      expect(activePageId).toBe(firstId); // 지우기 전에 보던 페이지로 돌아간다
      expect(validateProjectSpec(spec).valid).toBe(true);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().spec.pageOrder).toEqual([secondId]);
    });

    it("마지막 한 장을 지우려는 시도는 history에도 안 쌓인다", () => {
      const before = useEditorStore.getState().history;
      useEditorStore.getState().removePage(useEditorStore.getState().activePageId);
      expect(useEditorStore.getState().history).toBe(before);
      expect(undoEnabled()).toBe(false);
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

    it("이미 있는 id는 덮어쓰지 않는다 — createNode Command가 막는다(#131)", () => {
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().insertNode("content", "cardA", imageNode);

      expect(useEditorStore.getState().spec).toBe(before);
      expect(undoEnabled()).toBe(false); // 아무 일도 없었으니 history에도 안 쌓인다
    });

    it("삽입 직후 undo하면 노드가 사라지고, redo하면 다시 생긴다(#131)", () => {
      // Import(이미지)·도구 모음·트리의 프레임 추가가 모두 이 함수를 쓴다 —
      // 셋 다 이 한 단계로 되돌아간다.
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().insertNode("content", "image-1", imageNode);
      expect(undoEnabled()).toBe(true); // 되돌리기 버튼이 켜진다

      useEditorStore.getState().undo();

      expect(activePage().nodes["image-1"]).toBeUndefined();
      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toEqual([
        { node: "cardA" },
        { node: "cardB" },
      ]); // 부모의 children 참조도 함께 빠진다 — orphan/dangling이 안 남는다
      expect(useEditorStore.getState().spec).toEqual(before);
      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
      expect(redoEnabled()).toBe(true);

      useEditorStore.getState().redo();
      expect(activePage().nodes["image-1"]).toEqual(imageNode);
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
      // continueEdit을 안 넘기면(기본 false) 매 호출이 별개 단계다(#121) — 이
      // 둘은 서로 다른 두 번의 편집을 흉내 낸다.
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

    it("undo는 마지막 편집을 되돌리고 그 편집이 있던 페이지로 옮겨 간다(#131)", () => {
      // 페이지별 독립 스택 시절엔 두 번째 페이지에서 undo를 눌러도 아무 일이
      // 없었다. 스택이 프로젝트 하나로 합쳐진 뒤엔(EditorSnapshot 주석 참고)
      // 첫 페이지의 편집이 되돌아간다 — 그리고 보던 페이지도 그 편집이 있던
      // 페이지로 함께 옮겨 간다. 안 그러면 방금 되돌린 변화가 화면 밖에서
      // 조용히 일어난다.
      useEditorStore.getState().addPage();
      const [firstPageId, secondPageId] = useEditorStore.getState().spec.pageOrder;

      useEditorStore.getState().selectPage(firstPageId);
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);

      useEditorStore.getState().selectPage(secondPageId);
      useEditorStore.getState().undo();

      expect(useEditorStore.getState().activePageId).toBe(firstPageId);
      const cardA = useEditorStore.getState().spec.pages[firstPageId].nodes.cardA;
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(8); // 시드 원래 값
      // 건드린 적 없는 페이지는 참조까지 그대로다.
      expect(useEditorStore.getState().spec.pages[secondPageId].nodes).toEqual(
        blankSpec.screen.nodes,
      );
    });

    it("페이지 전환 자체는 undo 단계가 아니다(#131)", () => {
      // 스냅숏이 activePageId를 들고 있지만 페이지 전환은 편집이 아니다 —
      // selectPage가 present만 갈아 끼우는 이유다(새 단계를 쌓지 않는다).
      useEditorStore.getState().addPage();
      const [firstPageId] = useEditorStore.getState().spec.pageOrder;
      const steps = useEditorStore.getState().history.past.length;

      useEditorStore.getState().selectPage(firstPageId);

      expect(useEditorStore.getState().history.past.length).toBe(steps);
    });

    it("두 setNodeField 사이에 낀 insertNode는 그 사이 한 단계에서 살아남는다", () => {
      // insertNode도 자기 체크포인트를 남기므로(#131) "setNodeField →
      // insertNode → setNodeField"는 세 단계다. 한 단계만 undo하면 insertNode
      // 직후 상태로 돌아가 이미지가 남는다 — #131 전에는 insertNode가 단계를
      // 안 남겨서 "두 번째 setNodeField의 스냅숏에 삽입 결과가 섞여 들어간
      // 덕에" 우연히 같은 결과가 나왔다.
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

    it("insertNode 바로 뒤에 undo하면 그 삽입만 되돌아간다(#131)", () => {
      // #40 시절의 알려진 한계였다 — insertNode가 체크포인트를 안 남겨서 undo
      // 한 번이 마지막 tracked 체크포인트로 통째로 점프했고, 앞선 노드 편집까지
      // 함께 되돌아갔다. 이제 삽입 자신이 한 단계라 그 단계만 되돌아간다.
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
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(40); // 앞선 편집은 남는다
      expect(activePage().nodes["image-1"]).toBeUndefined(); // 삽입만 사라진다
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

    it("비활성 페이지를 편집한 단계로 redo하면 편집된 페이지로 옮겨 간다(#131 리뷰, wook3964, PR #142)", () => {
      // 스냅숏의 activePageId는 편집이 일어난 페이지여야 한다 — "이 편집 직후의
      // 상태"에서 보고 있어야 할 페이지가 그 페이지이기 때문이다. state.activePageId를
      // 담던 시절엔 여기서 pageA(편집할 때 보고 있던 페이지)로 튀어서, redo가
      // 바꿔놓은 내용이 화면 밖에 있었다.
      useEditorStore.getState().addPage();
      const [pageA, pageB] = useEditorStore.getState().spec.pageOrder;
      useEditorStore.getState().selectPage(pageA); // pageB는 이제 비활성이다

      useEditorStore.getState().setPageField(pageB, "name", "Login");
      useEditorStore.getState().undo();
      useEditorStore.getState().redo();

      expect(useEditorStore.getState().activePageId).toBe(pageB);
      expect(useEditorStore.getState().spec.pages[pageB].name).toBe("Login");
    });

    it("비활성 페이지를 두 번 편집한 뒤 undo해도 그 페이지를 가리킨다(#131 리뷰, wook3964, PR #142)", () => {
      // 위와 같은 이유. 첫 편집의 스냅숏으로 되돌아가므로 거기 담긴 activePageId도
      // 편집 대상인 pageB여야 한다.
      useEditorStore.getState().addPage();
      const [pageA, pageB] = useEditorStore.getState().spec.pageOrder;
      useEditorStore.getState().selectPage(pageA);

      useEditorStore.getState().setPageField(pageB, "size.width", 1920);
      useEditorStore.getState().setPageField(pageB, "size.width", 1280);
      useEditorStore.getState().undo();

      expect(useEditorStore.getState().activePageId).toBe(pageB);
      expect(useEditorStore.getState().spec.pages[pageB].size.width).toBe(1920);
    });

    it("loadSpec은 history를 새로 시작한다", () => {
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);

      useEditorStore.getState().loadSpec(blankSpec);

      const { history } = useEditorStore.getState();
      expect(history.past).toEqual([]);
      expect(history.future).toEqual([]);
      expect(history.present.spec).toBe(useEditorStore.getState().spec);
      expect(undoEnabled()).toBe(false); // 되돌리기 버튼이 꺼진다
      // 비었으니 undo를 불러도 blankSpec 이전(시드) 상태로 튀지 않는다.
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().spec).toBe(before);
    });

    describe("continueEdit로 이어지는 편집을 history 한 단계로 합친다 (#121)", () => {
      // continueEdit은 호출하는 쪽(useDraftInput, ui/properties/fields/useDraftInput.ts)이
      // "이건 방금 그 편집의 다음 글자다"를 알 때만 넘긴다 — 스토어가 노드·경로가
      // 같다고 스스로 추측해서 병합하지 않는다(레이어 트리 표시 토글처럼 같은
      // 경로를 반복 호출해도 매번 별개 편집인 호출부가 있어서다). 그래서 여기서는
      // 그 플래그를 직접 넘겨 스토어 쪽 병합 메커니즘만 검증한다 — burst를 실제로
      // 추적하는 useDraftInput의 로직은 이 저장소에 컴포넌트/훅 테스트 도구가 없어
      // (다른 UI 코드와 마찬가지로) 여기서 단위 테스트하지 않는다.
      it("continueEdit=true로 두 번째를 부르면 history 한 단계로 합쳐진다", () => {
        const before = activePage(); // 시드 원래 페이지(gap: 8)

        // useDraftInput이 "1" 커밋(continueEdit: false) → "16" 커밋(continueEdit: true)을
        // 만드는 상황을 그대로 재현한다.
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 1);
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 16, true);

        const pageId = useEditorStore.getState().activePageId;
        const { past } = useEditorStore.getState().history;
        expect(past).toHaveLength(1); // 1단계뿐
        expect(past[0].spec.pages[pageId]).toBe(before); // 그 1단계가 편집 이전 상태다

        useEditorStore.getState().undo();

        const cardA = activePage().nodes.cardA;
        expect(cardA.type === "frame" && cardA.layout.gap).toBe(8); // 시드 원래 값으로 한 번에 복귀
      });

      it("continueEdit을 안 넘기면(기본 false) 같은 id·path라도 매번 새 단계가 쌓인다", () => {
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 16);
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 32); // continueEdit 없음

        expect(useEditorStore.getState().history.past.length).toBe(2);

        useEditorStore.getState().undo();
        let cardA = activePage().nodes.cardA;
        expect(cardA.type === "frame" && cardA.layout.gap).toBe(16); // 한 단계만 되돌아감

        useEditorStore.getState().undo();
        cardA = activePage().nodes.cardA;
        expect(cardA.type === "frame" && cardA.layout.gap).toBe(8);
      });

      it("continueEdit=true라도 다른 노드·경로에 대한 첫 편집이면 무조건 새 단계다", () => {
        // continueEdit은 "present만 갈아 끼운다"는 무조건 지시일 뿐 노드·경로
        // 일치를 스스로 확인하지 않는다 — 그 책임은 호출자(useDraftInput, 같은
        // burst 안에서만 true를 보낸다)에 있다. 정상적인 첫 호출은 항상 false다.
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 16);
        useEditorStore.getState().setNodeField("cardA", "box.width", 999); // 경로가 다름, continueEdit 없음
        useEditorStore.getState().setNodeField("cardB", "layout.gap", 16); // 노드가 다름, continueEdit 없음

        expect(useEditorStore.getState().history.past.length).toBe(3); // 셋 다 별개 단계
      });

      it("편집 사이에 다른 액션(removeNode)이 껴도 그 액션은 별개 단계로 남는다", () => {
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 16);
        useEditorStore.getState().removeNode("cardB");
        useEditorStore.getState().setNodeField("cardA", "layout.gap", 32); // continueEdit 없음 — 새 단계

        expect(activePage().nodes.cardB).toBeUndefined();

        useEditorStore.getState().undo(); // gap=32 → gap=16으로만 돌아가야 한다
        let cardA = activePage().nodes.cardA;
        expect(cardA.type === "frame" && cardA.layout.gap).toBe(16);
        expect(activePage().nodes.cardB).toBeUndefined(); // 삭제는 아직 안 되돌아감

        useEditorStore.getState().undo(); // 이제 삭제가 되돌아간다 — gap은 여전히 16(첫 편집은 남아 있다)
        expect(activePage().nodes.cardB).toBeDefined();
        cardA = activePage().nodes.cardA;
        expect(cardA.type === "frame" && cardA.layout.gap).toBe(16);

        useEditorStore.getState().undo(); // 마지막으로 첫 편집도 되돌아간다
        cardA = activePage().nodes.cardA;
        expect(cardA.type === "frame" && cardA.layout.gap).toBe(8);
      });

      it("setPageField도 같은 continueEdit 규칙을 따른다", () => {
        const pageId = useEditorStore.getState().activePageId;

        useEditorStore.getState().setPageField(pageId, "size.width", 1900);
        useEditorStore.getState().setPageField(pageId, "size.width", 1920, true);

        expect(useEditorStore.getState().history.past.length).toBe(1);

        useEditorStore.getState().undo();
        expect(activePage().size.width).toBe(1440); // 시드 원래 값으로 한 번에 복귀
      });
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

  describe("duplicateNode (#151)", () => {
    it("자손까지 복제해 원본 바로 뒤 형제로 끼워 넣고 복제본을 선택한다", () => {
      useEditorStore.getState().duplicateNode("cardA");

      const content = activePage().nodes.content;
      expect(content.type === "frame" && content.children).toHaveLength(3);
      const newId = (content as { children: { node: string }[] }).children[1].node;

      expect(newId).not.toBe("cardA");
      expect(activePage().nodes[newId]).toMatchObject({ name: "Card" });
      expect(useEditorStore.getState().selectedId).toBe(newId);

      // 자손도 함께 복제됐다 — 원본과 자손 수가 같다.
      const duplicated = activePage().nodes[newId];
      expect(duplicated.type === "frame" && duplicated.children).toHaveLength(2);
    });

    it("결과가 여전히 유효한 프로젝트다", () => {
      useEditorStore.getState().duplicateNode("cardA");
      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
    });

    it("root는 복제하지 않는다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().duplicateNode(activePage().root);
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("없는 노드 id는 무시한다", () => {
      const before = useEditorStore.getState().spec;
      useEditorStore.getState().duplicateNode("does-not-exist");
      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("자식이 여러 개인 프레임을 복제해도 undo 한 번으로 전부 되돌아간다", () => {
      // createNode가 서브트리 크기(cardA + 자손 둘 = 3개)만큼 나오지만 한
      // 트랜잭션이라 history는 한 단계다.
      const before = useEditorStore.getState().spec;

      useEditorStore.getState().duplicateNode("cardA");
      expect(undoEnabled()).toBe(true);

      useEditorStore.getState().undo();

      expect(useEditorStore.getState().spec).toEqual(before);
      expect(undoEnabled()).toBe(false);
    });
  });

  describe("pasteNode (#151)", () => {
    it("클립보드 서브트리를 parentId 자식 끝에 붙이고 그 루트를 선택한다", () => {
      const { nodes } = activePage();
      const entry = {
        rootId: "cardA",
        nodes: { cardA: nodes.cardA, cardALabel: nodes.cardALabel, cardAValue: nodes.cardAValue },
      };

      useEditorStore.getState().pasteNode(entry, "header");

      const header = activePage().nodes.header;
      expect(header.type === "frame" && header.children).toHaveLength(2);
      const newId = (header as { children: { node: string }[] }).children[1].node;

      expect(activePage().nodes[newId]).toMatchObject({ name: "Card" });
      expect(useEditorStore.getState().selectedId).toBe(newId);
    });

    it("클립보드 id가 지금 문서의 id와 겹쳐도 새 id를 새로 뽑는다", () => {
      // 클립보드는 복사할 때의 원본 id를 그대로 담고 있을 수 있다(같은 문서에서
      // 복사했다면 반드시 겹친다) — liveNodes 기준으로 id를 다시 뽑아야 한다.
      const { nodes } = activePage();
      const entry = { rootId: "cardALabel", nodes: { cardALabel: nodes.cardALabel } };

      useEditorStore.getState().pasteNode(entry, "header");

      expect(activePage().nodes.cardALabel).toBe(nodes.cardALabel); // 원본은 그대로
      const header = activePage().nodes.header;
      const newId = (header as { children: { node: string }[] }).children[1].node;
      expect(newId).not.toBe("cardALabel");
    });

    it("parentId가 frame이 아니면 아무 것도 하지 않는다", () => {
      const before = useEditorStore.getState().spec;
      const { nodes } = activePage();
      const entry = { rootId: "cardALabel", nodes: { cardALabel: nodes.cardALabel } };

      useEditorStore.getState().pasteNode(entry, "cardBLabel");

      expect(useEditorStore.getState().spec).toBe(before);
    });

    it("결과가 여전히 유효한 프로젝트다", () => {
      const { nodes } = activePage();
      const entry = { rootId: "cardALabel", nodes: { cardALabel: nodes.cardALabel } };

      useEditorStore.getState().pasteNode(entry, "header");

      expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
    });
  });
});

describe("enteredId — 선택 문맥 (#151)", () => {
  beforeEach(resetToSeed);

  it("enter 로 들어가고 null 로 나온다", () => {
    useEditorStore.getState().enter("cardA");
    expect(useEditorStore.getState().enteredId).toBe("cardA");

    useEditorStore.getState().enter(null);
    expect(useEditorStore.getState().enteredId).toBeNull();
  });

  it("들어가 있던 노드를 지우면 문맥이 풀린다 — 안 그러면 갇힌다", () => {
    // 사라진 id 를 기준으로 클릭이 해석되면 아무것도 못 고르게 된다.
    useEditorStore.getState().enter("cardA");
    useEditorStore.getState().removeNode("cardA");

    expect(useEditorStore.getState().enteredId).toBeNull();
  });

  it("다른 노드를 지우면 문맥은 그대로다", () => {
    useEditorStore.getState().enter("cardA");
    useEditorStore.getState().removeNode("cardB");

    expect(useEditorStore.getState().enteredId).toBe("cardA");
  });

  it("페이지를 옮기면 문맥이 풀린다 — 페이지마다 id 가 겹친다", () => {
    useEditorStore.getState().enter("cardA");
    useEditorStore.getState().addPage();

    expect(useEditorStore.getState().enteredId).toBeNull();
  });

  it("스펙을 새로 불러오면 문맥이 풀린다", () => {
    useEditorStore.getState().enter("cardA");
    useEditorStore.getState().loadSpec(blankSpec);

    expect(useEditorStore.getState().enteredId).toBeNull();
  });
});

describe("editorStore — 복제·붙여넣기 (#151)", () => {
  beforeEach(resetToSeed);

  /** content 의 자식 id 목록. 사본이 어디 꽂혔는지 보는 데 쓴다. */
  function contentChildren(): string[] {
    const content = activePage().nodes.content;
    return content.type === "frame" ? content.children.map((child) => child.node) : [];
  }

  it("duplicateNode 가 사본을 원본 바로 뒤에 넣는다", () => {
    useEditorStore.getState().duplicateNode("cardA");

    const children = contentChildren();
    expect(children).toHaveLength(3);
    expect(children[0]).toBe("cardA");
    expect(children[2]).toBe("cardB");
  });

  it("사본을 바로 선택해 준다 — 만들자마자 옮길 수 있어야 한다", () => {
    useEditorStore.getState().duplicateNode("cardA");

    const selectedId = useEditorStore.getState().selectedId;
    expect(selectedId).toBe(contentChildren()[1]);
    expect(selectedId).not.toBe("cardA");
  });

  it("자손까지 같이 복제하고, 사본의 자식은 새 id 다", () => {
    useEditorStore.getState().duplicateNode("cardA");

    const copyId = useEditorStore.getState().selectedId as string;
    const copy = activePage().nodes[copyId];
    const childIds = copy.type === "frame" ? copy.children.map((c) => c.node) : [];

    expect(childIds).toHaveLength(2);
    // 원본의 자식을 같이 가리키면 원본을 지울 때 사본 속이 비어 버린다.
    expect(childIds).not.toContain("cardALabel");
    expect(activePage().nodes[childIds[0]]).toBeDefined();
  });

  it("자손이 몇이든 undo 한 번이면 전부 사라진다", () => {
    useEditorStore.getState().duplicateNode("cardA");
    const after = Object.keys(activePage().nodes).length;

    useEditorStore.getState().undo();

    expect(Object.keys(activePage().nodes).length).toBe(after - 3);
    expect(contentChildren()).toEqual(["cardA", "cardB"]);
  });

  it("root 는 복제하지 않는다 — 페이지에 root 는 하나다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().duplicateNode(activePage().root);

    expect(useEditorStore.getState().spec).toBe(before);
    expect(undoEnabled()).toBe(false);
  });

  it("없는 id 는 아무 일도 하지 않는다", () => {
    const before = useEditorStore.getState().spec;
    useEditorStore.getState().duplicateNode("nope");

    expect(useEditorStore.getState().spec).toBe(before);
  });

  it("복제한 문서도 스키마를 통과한다", () => {
    useEditorStore.getState().duplicateNode("cardA");

    expect(validateProjectSpec(useEditorStore.getState().spec).valid).toBe(true);
  });

  it("pasteSubtree 는 넘긴 부모의 끝에 심고 선택한다", () => {
    const subtree = collectSubtree(activePage().nodes, "cardALabel");
    useEditorStore.getState().pasteSubtree(subtree!, "content");

    const children = contentChildren();
    expect(children).toHaveLength(3);
    expect(children[2]).toBe(useEditorStore.getState().selectedId);
  });

  it("원본을 지운 뒤에도 붙여넣을 수 있다 — 덩어리는 그때의 사본이다", () => {
    const subtree = collectSubtree(activePage().nodes, "cardA");
    useEditorStore.getState().removeNode("cardA");
    useEditorStore.getState().pasteSubtree(subtree!, "content");

    const pastedId = useEditorStore.getState().selectedId as string;
    const pasted = activePage().nodes[pastedId];
    expect(pasted.type === "frame" && pasted.children).toHaveLength(2);
  });
});
