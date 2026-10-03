import { beforeEach, describe, expect, it } from "vitest";

import { initHistory } from "@/features/editor/command/history";
import { migrateV01 } from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { getByPath } from "@/features/editor/store/path";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { createEditBurst } from "@/features/editor/ui/properties/fields/editBurst";
import {
  isUnchangedColor,
  isUnchangedNumber,
} from "@/features/editor/ui/properties/fields/unchangedCommit";

/** 지금 캔버스에 떠 있는 페이지. editor-store.test.ts의 같은 헬퍼와 같다. */
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
    history: initHistory({ spec, activePageId: spec.pageOrder[0] }),
  });
}

function historyStepCount(): number {
  return useEditorStore.getState().history.past.length;
}

/** cardA의 한 필드. useNodeField가 읽는 것과 같다. */
function cardAField(path: string): unknown {
  return getByPath(activePage().nodes.cardA, path);
}

/** NumberField의 parse(min·max·integer 없음)와 같다. */
function parseNumber(raw: string): number | undefined {
  const parsed = Number(raw);
  return raw.trim() !== "" && Number.isFinite(parsed) ? parsed : undefined;
}

describe("isUnchangedNumber (#209)", () => {
  describe("NumberField — 저장된 값이 숫자", () => {
    it.each(["16", "016", "16.0", "1.6e1"])("표기만 다른 같은 값 %s는 그대로다", (raw) => {
      expect(isUnchangedNumber(Number(raw), 16)).toBe(true);
    });

    it("다른 값은 바뀐 것이다", () => {
      expect(isUnchangedNumber(160, 16)).toBe(false);
      expect(isUnchangedNumber(1, 16)).toBe(false);
    });

    it("저장된 값이 없으면(undefined) 어떤 숫자든 바뀐 것이다", () => {
      expect(isUnchangedNumber(0, undefined)).toBe(false);
      expect(isUnchangedNumber(16, undefined)).toBe(false);
    });
  });

  describe("SizeField — 저장된 값이 Size 유니온", () => {
    it("Fixed에서 같은 숫자는 그대로다", () => {
      expect(isUnchangedNumber(320, 320)).toBe(true);
    });

    it("Fill/Hug에서 칸에 보이던 실측값과 같은 숫자를 쳐도 Fixed로 바뀌는 실제 변경이다", () => {
      // SizeField는 Hug/Fill일 때 실측 px(예: 320)를 칸에 보여 준다. 그 숫자를 그대로
      // 쳐도 "fill" → 320은 모드가 바뀌는 편집이라 커밋해야 한다.
      expect(isUnchangedNumber(320, "fill")).toBe(false);
      expect(isUnchangedNumber(320, "auto")).toBe(false);
    });
  });
});

describe("isUnchangedColor (#209)", () => {
  describe("hex 칸", () => {
    it("같은 hex는 그대로다", () => {
      expect(isUnchangedColor("#FF0000", 100, "#FF0000")).toBe(true);
    });

    it("소문자로 쳐도 저장된 값이 대문자면 그대로다 — 조립하면 같은 문자열이다", () => {
      expect(isUnchangedColor("#ff0000", 100, "#FF0000")).toBe(true);
    });

    it("저장된 값이 소문자면 대문자로 조립돼 스펙 문자열이 바뀌므로 커밋한다", () => {
      // 파일에서 온 값은 소문자일 수 있다. 칸에는 대문자로 보이지만 스펙은 다르다.
      expect(isUnchangedColor("#FF0000", 100, "#ff0000")).toBe(false);
      expect(isUnchangedColor("#ff0000", 100, "#ff0000")).toBe(false);
    });

    it("다른 hex는 바뀐 것이다", () => {
      expect(isUnchangedColor("#00FF00", 100, "#FF0000")).toBe(false);
    });

    it("저장된 값이 없으면 바뀐 것이다", () => {
      expect(isUnchangedColor("#FF0000", 100, undefined)).toBe(false);
    });

    it("불투명도가 붙은 값도 hex·불투명도를 함께 견준다", () => {
      expect(isUnchangedColor("#ff0000", 50, "#FF000080")).toBe(true);
      expect(isUnchangedColor("#00FF00", 50, "#FF000080")).toBe(false);
    });
  });

  describe("불투명도 칸", () => {
    it("같은 %는 그대로다", () => {
      expect(isUnchangedColor("#FF0000", 50, "#FF000080")).toBe(true);
      expect(isUnchangedColor("#FF0000", Number("050"), "#FF000080")).toBe(true);
    });

    it("100%는 알파 없는 값과 같다", () => {
      expect(isUnchangedColor("#FF0000", 100, "#FF0000")).toBe(true);
    });

    it("다른 %는 바뀐 것이다", () => {
      expect(isUnchangedColor("#FF0000", 40, "#FF000080")).toBe(false);
      expect(isUnchangedColor("#FF0000", 100, "#FF000080")).toBe(false);
    });

    it("보이는 %가 같아도 다시 조립한 알파가 다르면 커밋한다", () => {
      // 0x81 = 129 → 129/255 = 50.6% → 51%로 보인다. 51%를 조립하면 0x82다.
      expect(isUnchangedColor("#FF0000", 51, "#FF000081")).toBe(false);
    });
  });
});

/**
 * 숫자 칸 하나를 흉내 낸다 — useDraftInput.ts의 `handleChange`/`handleBlur` 배선
 * 그대로다: 파싱에 실패하거나 값이 그대로면 건너뛰고, 아니면
 * `onCommit(값, burst.next())`로 커밋한다. edit-burst.test.ts의 `fakeTextField`와
 * 같은 이유로(컴포넌트/훅 테스트 도구가 없다) 진짜 스토어에 물려 검증한다.
 */
function fakeDraftField(
  isUnchanged: (parsed: number) => boolean,
  commit: (value: number, continueEdit: boolean) => void,
) {
  const burst = createEditBurst();

  return {
    change(raw: string): void {
      const parsed = parseNumber(raw);
      if (parsed === undefined || isUnchanged(parsed)) return;
      commit(parsed, burst.next());
    },
    blur: () => burst.end(),
  };
}

describe("값이 그대로인 입력은 커밋하지 않는다 — 숫자 칸 (#209)", () => {
  beforeEach(resetToSeed);

  /** LayoutSection의 간격 칸 배선 그대로(useNodeField 세터 → setNodeField). */
  function gapField(isUnchanged = (n: number) => isUnchangedNumber(n, cardAField("layout.gap"))) {
    return fakeDraftField(isUnchanged, (value, continueEdit) => {
      useEditorStore.getState().setNodeField("cardA", "layout.gap", value, continueEdit);
    });
  }

  /** 이슈 재현 1단계 — 간격을 16으로 바꾸고 포커스를 뺀다. */
  function setGapTo16(): void {
    const field = gapField();
    field.change("1");
    field.change("16");
    field.blur();
  }

  it("가드가 없으면(예전 동작) 같은 값 커밋이 빈 undo 단계를 쌓는다", () => {
    // 스토어는 같은 값 쓰기도 새 단계로 쌓는다 — setByPath가 늘 새 객체를 만든다.
    // 그래서 예전에는 "016"을 넣고 포커스를 빼면 Ctrl+Z 한 번이 화면을 안 바꿨다.
    setGapTo16();
    const afterGap = historyStepCount();

    const field = gapField(() => false);
    field.change("016");
    field.blur();

    expect(historyStepCount()).toBe(afterGap + 1); // 빈 단계

    useEditorStore.getState().undo();
    expect(cardAField("layout.gap")).toBe(16); // 되돌렸는데 그대로다
  });

  it("같은 값(\"016\")을 넣고 포커스를 빼도 undo 단계가 생기지 않는다", () => {
    setGapTo16();
    const afterGap = historyStepCount();

    const field = gapField();
    field.change("016");
    field.blur();

    expect(historyStepCount()).toBe(afterGap);

    useEditorStore.getState().undo();
    expect(cardAField("layout.gap")).toBe(8); // 한 번에 "간격 16" 이전(시드 값)으로
  });

  it("같은 값 뒤에 다른 값을 치면 새 단계가 되고, 직전 \"간격 16\" 단계는 남는다", () => {
    setGapTo16();
    const afterGap = historyStepCount();

    const field = gapField();
    field.change("016"); // 값 그대로 — burst를 시작하지 않는다
    field.change("0167");

    expect(cardAField("layout.gap")).toBe(167);
    expect(historyStepCount()).toBe(afterGap + 1);

    useEditorStore.getState().undo();
    expect(cardAField("layout.gap")).toBe(16);

    useEditorStore.getState().undo();
    expect(cardAField("layout.gap")).toBe(8);
  });

  it("값이 그대로인 입력이 이어지는 중간에 끼어도 같은 burst는 한 단계로 합쳐진다", () => {
    const before = historyStepCount();

    const field = gapField();
    field.change("1");
    field.change("12");
    field.change("012"); // 값 그대로 — 건너뛴다
    field.change("0123");

    expect(historyStepCount()).toBe(before + 1);

    useEditorStore.getState().undo();
    expect(cardAField("layout.gap")).toBe(8);
  });
});

describe("값이 그대로인 입력은 커밋하지 않는다 — 크기 칸 (#209)", () => {
  beforeEach(resetToSeed);

  /** SizeSection의 너비 칸 배선 그대로 — 견주는 대상은 칸에 보이는 실측값이 아니라 box.width다. */
  function widthField() {
    return fakeDraftField(
      (n) => isUnchangedNumber(n, cardAField("box.width")),
      (value, continueEdit) => {
        useEditorStore.getState().setNodeField("cardA", "box.width", value, continueEdit);
      },
    );
  }

  it("Fill일 때 칸에 보이던 실측값을 그대로 쳐도 Fixed로 바뀐다", () => {
    expect(cardAField("box.width")).toBe("fill");
    const before = historyStepCount();

    // 칸에는 실측 px(예: 320)가 보인다. 그 숫자를 그대로 친다.
    const field = widthField();
    field.change("320");
    field.blur();

    expect(cardAField("box.width")).toBe(320);
    expect(historyStepCount()).toBe(before + 1);
  });

  it("Fixed일 때 같은 숫자는 커밋하지 않는다", () => {
    useEditorStore.getState().setNodeField("cardA", "box.width", 320);
    const before = historyStepCount();

    const field = widthField();
    field.change("320.0");
    field.blur();

    expect(historyStepCount()).toBe(before);
  });
});
