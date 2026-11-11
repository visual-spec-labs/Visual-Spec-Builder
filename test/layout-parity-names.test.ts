import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";

import type { ScreenSpec } from "@/features/editor/schema";
import { ticketFilePath } from "../src/features/editor/export/generatedPaths";
import { compileTickets } from "../src/features/editor/ticket/compileTickets";
import { selectPageModule } from "../scripts/browser/layout-parity-app/select-page.js";
import { pageComponentName } from "../scripts/browser/layout-parity-names.mjs";

// layout-parity.mjs --spec의 표시 이름과 실제 Export 파일 이름을 구분하는지 본다(PR #358 리뷰).
// Export와 같은 compileTickets·ticketFilePath로 결과 폴더를 만들고, layout-parity-app이 실제로 고르는 파일을 확인한다.
const text = (name: string) => ({
  type: "text" as const, name, box: { width: "fill" as const, height: "auto" as const }, content: name, color: "#111111",
  typography: { fontFamily: "Pretendard", fontSize: 14, fontWeight: 400, lineHeight: 20, letterSpacing: 0, textAlign: "left" as const },
});
function screen(name: string, children: string[]): ScreenSpec {
  return {
    name, size: { width: 390, height: 844 }, root: "root",
    nodes: {
      root: {
        type: "frame", name: "Root", box: { width: "fill", height: "fill" },
        layout: { direction: "column", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: "start", crossAxis: "stretch" },
        children: children.map((_, index) => ({ node: `n${index}` })),
      },
      ...Object.fromEntries(children.map((child, index) => [`n${index}`, text(child)])),
    },
  } as ScreenSpec;
}

it.each([
  ["일반 PascalCase 이름", screen("Login", ["Title"]), "Login"],
  ["공백 이름", screen("checkout page", ["Title"]), "CheckoutPage"],
  ["한글 이름", screen("로그인", ["Title"]), "Screen"],
  ["자식 컴포넌트와 같은 이름", screen("Header", ["Header"]), "Header2"],
])("%s: Export 결과에서 page 티켓의 파일을 고른다", (_name, page, expected) => {
  const directory = mkdtempSync(join(tmpdir(), "vsb-parity-names-"));
  try {
    // Export 결과 폴더: 티켓마다 pages/·components/<componentName>.tsx
    for (const ticket of compileTickets(page)) {
      const path = join(directory, "app", ticketFilePath(ticket));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `export default function ${ticket.componentName}() { return null; }\n`, "utf8");
    }
    // layout-parity-app/main.jsx의 import.meta.glob("./app/pages/*.{tsx,jsx}")와 같은 모양의 목록
    const pages = Object.fromEntries(readdirSync(join(directory, "app/pages"))
      .map((file) => [`./app/pages/${file}`, `pages/${file}`]));

    expect(pageComponentName(page)).toBe(expected);
    expect(selectPageModule(pages, pageComponentName(page))).toBe(`pages/${expected}.tsx`);
    // 표시 이름이 파일 이름과 다르면 표시 이름으로는 고르지 못한다(리뷰가 지적한 이전 동작).
    if (page.name !== expected) expect(selectPageModule(pages, page.name)).toBeNull();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
