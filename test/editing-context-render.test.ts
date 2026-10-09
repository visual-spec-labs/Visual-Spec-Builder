import { TextField, NumberField, SelectField, SizeField, ColorField } from "@/features/editor/ui/properties/fields";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import example from "../examples/responsive-cards.json";
import type { VisualSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveViewStore } from "@/features/editor/responsive/responsiveViewStore";
import { PropertiesPanel } from "@/features/editor/ui/PropertiesPanel";

// SSR의 Zustand는 최초 snapshot만 읽는다. 현재 fixture를 읽도록 구독 훅만
// 대체하고, 컴포넌트·반응형 해석·store 액션은 실제 구현으로 렌더링한다.
// DOM 이벤트·구독 갱신·키보드는 scripts/browser/editing-context.py가 검증한다.
vi.mock("@/features/editor/store/editorStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/store/editorStore")>();
  const store = actual.useEditorStore;
  return { ...actual, useEditorStore: Object.assign(
    <T,>(selector: (state: ReturnType<typeof store.getState>) => T) => selector(store.getState()), store,
  ) };
});
vi.mock("@/features/editor/responsive/responsiveViewStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/responsive/responsiveViewStore")>();
  const store = actual.useResponsiveViewStore;
  return { ...actual, useResponsiveViewStore: Object.assign(
    <T,>(selector: (state: ReturnType<typeof store.getState>) => T) => selector(store.getState()), store,
  ) };
});

beforeEach(() => {
  vi.stubGlobal("window", { innerWidth: 1280 });
  useEditorStore.getState().loadSpec(structuredClone(example) as VisualSpec);
});
afterEach(() => vi.unstubAllGlobals());

function render(width: number, selection: string | null) {
  const state = useEditorStore.getState();
  state.select(selection);
  useResponsiveViewStore.getState().setWidth(state.activePageId, width);
  return renderToStaticMarkup(createElement(PropertiesPanel));
}
function liveRegion(markup: string) {
  const match = markup.match(/<div role="status" aria-label="현재 편집 범위">([\s\S]*?)<\/div>/);
  expect(match).not.toBeNull();
  return match![1];
}

describe("실제 PropertiesPanel + ResponsivePanel 렌더 (#340)", () => {
  it.each([
    [null, 767, "선택: 없음", "기본값(base)", true, "페이지 이름·크기를 편집"],
    ["elevatedCard", 767, "ElevatedCard · 노드 1개", "기본값(base)", false, "선택한 노드 하나"],
    ["root", 767, "루트 프레임 1개", "기본값(base)", true, "페이지 이름·크기와 루트 프레임"],
    [null, 768, "선택: 없음", "tablet 재정의(override)", false, "노드를 선택하면 이 구간"],
    ["elevatedCard", 768, "ElevatedCard · 노드 1개", "tablet 재정의(override)", false, "선택한 노드 하나"],
    ["root", 768, "루트 프레임 1개", "tablet 재정의(override)", false, "선택한 노드 하나"],
  ] as const)("선택 %s / 폭 %s의 범위·페이지 속성·편집 제한", (selection, width, scope, mode, showPage, guidance) => {
    const markup = render(width, selection);
    expect(liveRegion(markup)).toContain(scope);
    expect(liveRegion(markup)).toContain(mode);
    expect(markup).toContain(guidance);
    expect(markup.includes('>페이지 (Page)<')).toBe(showPage);
    expect(markup).toContain('aria-label="반응형 편집"');
    expect(markup).toContain('미리보기 폭에 따라 편집 기준도 바뀝니다.');
    if (selection) {
      const name = markup.match(/<input[^>]*aria-label="노드 이름"[^>]*>/)![0];
      expect(name.includes('disabled=""')).toBe(width >= 768);
    }
  });

  it("같은 분기점의 폭 변경은 live region 내용을 바꾸지 않는다", () => {
    const before = render(768, "root");
    const after = render(900, "root");
    expect(liveRegion(before)).toBe(liveRegion(after));
    expect(liveRegion(after)).not.toContain("미리보기");
    expect(after).toContain("미리보기 900px");
    expect(liveRegion(render(1024, "root"))).toContain("desktop 재정의(override)");
  });

  it("오류는 색상 없이도 식별할 수 있는 접두어와 alert로 렌더링한다", () => {
    render(768, "root");
    useResponsiveViewStore.getState().reportError("폭은 양수여야 합니다.");
    const markup = renderToStaticMarkup(createElement(PropertiesPanel));
    expect(markup).toMatch(/<p role="alert"[^>]*>오류: 폭은 양수여야 합니다\.<\/p>/);
  });
});

// 실제 컴포넌트의 label/id 연결을 검사한다. 입력/오류/IME/undo는 브라우저 회귀에서 검증한다.
describe("속성 입력 접근 가능한 이름과 정상적인 빈 값", () => {
  it.each([
    [TextField, { label: "내용", value: "", onChange: () => {} }, "input"],
    [TextField, { label: "내용", value: "", multiline: true, onChange: () => {} }, "textarea"],
    [NumberField, { label: "간격", value: undefined, onChange: () => {} }, "input"],
    [SelectField, { label: "종류", value: "one", options: [{value:"one",label:"하나"}], onChange: () => {} }, "select"],
  ])("라벨과 %s 입력 연결", (Component, props, tag) => {
    const html = renderToStaticMarkup(createElement(Component as typeof TextField, props));
    const target = html.match(/<label[^>]*for="([^"]+)"/)?.[1];
    expect(target).toBeTruthy();
    expect(html).toContain(`<${tag} id="${target}"`);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid="true"');
  });
  it("미지정 크기·색상은 오류가 아니고 한국어 크기 안내를 제공한다", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(SizeField, {label:"너비",value:undefined,onChange:()=>{}}),
      createElement(ColorField, {label:"색",value:undefined,onChange:()=>{}})));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid="true"');
    for (const text of ["고정 (Fixed)", "내용 맞춤 (Hug)", "공간 채움 (Fill)"]) expect(html).toContain(text);
  });
});
