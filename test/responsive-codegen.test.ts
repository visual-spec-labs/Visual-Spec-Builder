import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

import { frameStyle } from "../src/features/editor/ui/nodeStyles";
import { validateVisualSpec } from "@/features/editor/schema";
import responsiveCards from "../examples/responsive-cards.json";
import { autoSizedCardsSpec, backgroundCases, backgroundSpec, responsiveCardsCss, mismatchedNamedVariant, responsiveCardsClasses } from "./fixtures/responsive-codegen";

const skill = readFileSync(new URL("../skills/visual-spec-to-react/SKILL.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("반응형 to-react 매핑 fixture (#224)", () => {
  it("스킬의 원본 예제와 배경 배열 교체 사례는 현재 스키마를 통과한다", () => {
    expect(validateVisualSpec(responsiveCards)).toEqual({ valid: true, issues: [] });
    for (let index = 0; index < backgroundCases.length; index += 1) {
      expect(validateVisualSpec(backgroundSpec(index))).toEqual({ valid: true, issues: [] });
    }
  });

  it("스킬에 실측한 원본 root 클래스가 그대로 포함되어 있다", () => {
    expect(skill).toContain(responsiveCardsClasses);
    expect(skill).toContain(responsiveCardsCss);
  });

  it("auto 높이 카드의 교차축은 캔버스와 같이 flex-start이며 컴파일 후에도 보존된다", async () => {
    const spec = autoSizedCardsSpec();
    expect(validateVisualSpec(spec)).toEqual({ valid: true, issues: [] });
    const root = spec.screen.nodes.root;
    if (root.type !== "frame") throw new Error("fixture root must be a frame");
    expect(frameStyle(root, undefined).alignItems).toBe("flex-start");
    for (const { node } of root.children) expect(spec.screen.nodes[node].box.height).toBe("auto");
    const compiler = await compile("@tailwind utilities;");
    expect(compiler.build(responsiveCardsClasses.split(" "))).toContain("align-items: flex-start;");
    expect(responsiveCardsCss).toContain("align-items: flex-start;");
  });

  it("제한된 Fill 카드 예제가 긴 텍스트와 명시적 개행에 맞는 매핑을 쓴다", async () => {
    const fillClass = "flex-[1_1_0] min-w-0";
    const textClass = "flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0";
    expect(skill).toContain(fillClass);
    expect(skill).toContain(textClass);
    expect(skill).toContain("w-full flex-[1_0_auto]");
    expect(skill).toContain("h-auto flex-[0_0_auto] min-h-0");
    expect(skill).toContain("h-[240px] flex-[0_0_240px] shrink-0");
    expect(skill).not.toContain("w-full h-full");
    expect(skill).not.toContain("flex-1 h-auto");

    const longValue = "a-very-long-unbroken-value-".repeat(8);
    const markup = renderToStaticMarkup(createElement("div", { className: "flex", style: { width: 240 } },
      createElement("article", { className: fillClass },
        createElement("p", { className: textClass }, "first\nsecond"),
        createElement("p", { className: textClass }, longValue)),
      createElement("article", { className: fillClass }, "sibling")));
    expect(markup).toContain("first\nsecond");
    expect(markup).toContain(longValue);

    const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
    const css = compiler.build([
      ...fillClass.split(" "), ...textClass.split(" "),
      "flex-[1_0_auto]", "flex-[0_0_240px]", "min-h-0",
    ]);
    expect(css).toMatch(/flex:\s*1 1 0(?:%|px)?;/);
    expect(css).toContain("flex: 1 0 auto;");
    expect(css).toContain("flex: 0 0 240px;");
    expect(css).toContain("min-width: 0px;");
    expect(css).toContain("min-height: 0px;");
    expect(css).toContain("white-space: pre-wrap;");
    expect(css).toContain("margin: 0px;");
  });

  it("Tailwind v4는 정적 숫자 variant와 색/이미지/origin reset을 실제 CSS로 만든다", async () => {
    const compiler = await compile("@theme { --color-transparent: transparent; --breakpoint-md: 960px; } @tailwind utilities;");
    const candidates = [responsiveCardsClasses, mismatchedNamedVariant, ...backgroundCases.map((item) => item.classes)].flatMap((value) => value.split(" "));
    const css = compiler.build(candidates);
    expect(css).toContain("@media (width >= 768px)");
    expect(css).toContain("@media (width >= 1024px)");
    expect(css).toContain("@media (width >= 960px)");
    expect(css).toContain("background-image: none;");
    expect(css).toContain("background-color: transparent;");
    expect(css).toContain("background-origin: padding-box;");
    expect(css).toContain("background-origin: border-box;");
    expect(css).toContain("background-image: linear-gradient(");
  });

  it("grid 열은 유효한 repeat 트랙으로 컴파일되고 교차축·auto/fill이 보존된다", async () => {
    const columns = [1, 2, 3];
    const axes = ["start", "center", "end", "stretch"];
    const classes = [
      ...columns.map((count) => `grid-cols-[repeat(${count},1fr)]`),
      ...axes.map((axis) => `items-${axis}`),
      "w-full", "h-full", "w-auto", "h-auto",
      "min-[700px]:grid-cols-[repeat(2,1fr)]",
      "min-[900px]:grid-cols-[repeat(3,1fr)]",
      "min-[700px]:items-center",
      "min-[900px]:items-stretch",
    ];
    const compiler = await compile("@tailwind utilities;");
    const css = compiler.build(classes);

    for (const count of columns) {
      expect(css).toContain(`grid-template-columns: repeat(${count},1fr);`);
    }
    expect(css).toContain("align-items: flex-start;");
    expect(css).toContain("align-items: center;");
    expect(css).toContain("align-items: flex-end;");
    expect(css).toContain("align-items: stretch;");
    expect(css).toContain("width: 100%;");
    expect(css).toContain("height: 100%;");
    expect(css).toContain("width: auto;");
    expect(css).toContain("height: auto;");
    expect(css).toContain("@media (width >= 700px)");
    expect(css).toContain("@media (width >= 900px)");
  });
});
