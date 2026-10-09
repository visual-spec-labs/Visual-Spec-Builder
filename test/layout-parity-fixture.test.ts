import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { responsiveCardsClasses } from "./fixtures/responsive-codegen";

// scripts/browser/layout-parity.mjs가 실측하는 생성 fixture가 스킬·GUI 정본과 어긋나지 않는지 본다.
// 실측 자체는 브라우저가 필요해 일반 테스트에서 실행하지 않는다(docs/25-layout-parity-contract.md).
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const styleBlock = (source: string) => source.split("<style>{`")[1].split("`}</style>")[0];
const skill = read("../skills/visual-spec-to-react/SKILL.md");
const skillShellCss = styleBlock(skill.split("### 페이지 viewport와 브라우저 기본 스타일")[1]);

it("fixture 셸은 스킬의 페이지 셸 CSS를 글자 그대로 쓴다", () => {
  expect(styleBlock(read("./fixtures/layout-parity/PageShell.jsx"))).toBe(skillShellCss);
});

it("GUI와 생성 셸은 family Pretendard를 정의하는 같은 폰트 CSS를 불러온다", () => {
  const importUrl = (css: string) => /@import url\("([^"]+)"\);/.exec(css)?.[1];
  const guiFont = importUrl(read("../src/styles/fonts.css"));

  expect(guiFont).toBe(importUrl(skillShellCss));
  // variable 배포 CSS는 family가 "Pretendard Variable"이라 fontFamily "Pretendard" 노드가 폴백으로 그려진다.
  expect(guiFont).toMatch(/pretendard@v1\.3\.9\/dist\/web\/static\/pretendard-dynamic-subset\.css$/);
});

it("반응형 fixture root 클래스는 #224 매핑 fixture와 같다", () => {
  const source = read("./fixtures/layout-parity/pages/ResponsiveCardsPage.jsx");
  expect(/export const rootClasses = "([^"]+)";/.exec(source)?.[1]).toBe(responsiveCardsClasses);
});
