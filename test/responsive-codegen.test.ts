import { readFileSync } from "node:fs";
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
});
