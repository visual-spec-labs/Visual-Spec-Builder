import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import loginScreen from "../examples/login-screen.json";
import type { FrameNode, ScreenSpec } from "@/features/editor/schema";
import { relativeToRoot } from "@/features/editor/export/generationIdentity";
import { verifyGenerated } from "@/features/editor/export/verifyGenerated";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { buildTicketRequest } from "@/features/editor/ticket/ticketProtocol";

function duplicateNames(): ScreenSpec {
  const screen = structuredClone(loginScreen.screen) as ScreenSpec;
  screen.name = "Section";
  for (const node of Object.values(screen.nodes)) node.name = "Section";
  // 이미 숫자가 붙은 이름도 예약 목록에 있으므로 자동 접미사와 겹치면 안 된다.
  screen.nodes.numbered = { ...screen.nodes.title, name: "Section2" };
  (screen.nodes.root as FrameNode).children.unshift({ node: "numbered" });
  return screen;
}

describe("compiler → ticket request → export 식별자 호환 (PR #237)", () => {
  it("기존 숫자 이름·반복 컴포넌트·직계 자식·페이지 이름 충돌을 모두 고유한 JS 식별자로 만든다", () => {
    const screen = duplicateNames();
    const tickets = compileTickets(screen);
    const names = tickets.map((ticket) => ticket.componentName);
    expect(names).toEqual(["Section2", "Section", "Section3", "Section4", "Section5"]);
    expect(new Set(names).size).toBe(names.length);
    for (const ticket of tickets) {
      expect(ticket.componentName).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      expect(ticket.id).toBe(ticket.componentName);
      for (const dependency of ticket.dependsOn) {
        const dependencyIndex = tickets.findIndex((item) => item.id === dependency);
        expect(dependencyIndex).toBeGreaterThanOrEqual(0);
        expect(dependencyIndex).toBeLessThan(tickets.indexOf(ticket));
      }
    }
    expect(compileTickets(screen)).toEqual(tickets);
  });

  it("같은 이름으로 정규화되는 공백·기호와 한글·숫자 시작 이름도 안전하다", () => {
    const screen = duplicateNames();
    screen.nodes.title.name = "123 section";
    screen.nodes.card.name = "123-section";
    screen.nodes.numbered.name = "한글";
    screen.name = "!!!";
    const tickets = compileTickets(screen);
    const names = tickets.map((ticket) => ticket.componentName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Screen123Section2");
    expect(names).toContain("Screen2");
    for (const name of names) expect(name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
  });

  it("요청의 이름·경로를 그대로 쓰는 named/default export와 상대 import가 실제 TypeScript 검사를 통과한다", () => {
    const screen = duplicateNames();
    const tickets = compileTickets(screen);
    const request = buildTicketRequest({ id: "duplicate-names", pageId: "page1", page: screen, tickets, generatedRoot: "shop/page1" });
    // 스킬/AI의 구현 품질 검사가 아니다. 요청의 이름을 재매핑하지 않고 쓰는 최소 코드 fixture다.
    const files = request.tickets.map((item) => {
      const dependencies = tickets.find((ticket) => ticket.id === item.id)!.dependsOn;
      const imports = dependencies.map((id) => {
        const dependency = request.tickets.find((ticket) => ticket.id === id)!;
        const prefix = item.kind === "page" ? "../components/" : "./";
        return `import { ${dependency.componentName} } from '${prefix}${dependency.componentName}';`;
      });
      return {
        // 요청 경로는 생성 자리(#281) 아래다. 검사와 ZIP은 그 자리 기준 경로로 본다.
        path: relativeToRoot(request.generatedRoot, item.filePath) ?? item.filePath,
        content: `${imports.join("\n")}\nexport ${item.kind === "page" ? "default " : ""}function ${item.componentName}() { ${dependencies.map((name) => `${name}();`).join(" ")} return null; }`,
      };
    });
    const report = verifyGenerated({ files, tickets, assetNames: [] });
    expect(report.issues).toEqual([]);
    expect(report.coveredCount).toBe(tickets.length);

    const directory = mkdtempSync(join(tmpdir(), "vsb-component-names-"));
    try {
      const roots = files.map((file) => {
        const path = join(directory, file.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
        return path;
      });
      const program = ts.createProgram(roots, {
        strict: true,
        noEmit: true,
        types: [],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.Preserve,
      });
      expect(ts.getPreEmitDiagnostics(program).map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      )).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
