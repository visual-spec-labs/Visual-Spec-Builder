import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import emptyTitleScreen from "../examples/empty-title-screen.json";
import loginScreen from "../examples/login-screen.json";
import { compileTickets, toPascalCase } from "@/features/editor/ticket/compileTickets";
import type { Node, ScreenSpec, VisualSpec } from "@/features/editor/schema";

function screenOf(spec: VisualSpec): ScreenSpec {
  return spec.screen;
}

describe("toPascalCase", () => {
  it("한 단어는 첫 글자만 올린다", () => {
    expect(toPascalCase("Login")).toBe("Login");
    expect(toPascalCase("card")).toBe("Card");
  });

  it("공백·기호를 단어 경계로 본다", () => {
    expect(toPascalCase("dashboard page")).toBe("DashboardPage");
    expect(toPascalCase("stat-card_grid")).toBe("StatCardGrid");
  });

  it("숫자로 시작하면 Screen을 붙인다", () => {
    expect(toPascalCase("404 page")).toBe("Screen404Page");
  });

  it("단어가 하나도 안 남으면 Screen이다", () => {
    expect(toPascalCase("!!!")).toBe("Screen");
    expect(toPascalCase("")).toBe("Screen");
  });
});

describe("compileTickets", () => {
  it("반복되는 형제(cardA/cardB)를 하나의 컴포넌트 티켓으로 묶는다", () => {
    const tickets = compileTickets(screenOf(dashboardCards as VisualSpec));

    const card = tickets.find((t) => t.id === "Card");
    expect(card).toBeDefined();
    expect(card?.instances.sort()).toEqual(["cardA", "cardB"]);
    expect(card?.kind).toBe("component");
    expect(card?.dependsOn).toEqual([]);
  });

  it("반복 컴포넌트를 쓰는 부모는 그 티켓에 의존한다", () => {
    const tickets = compileTickets(screenOf(dashboardCards as VisualSpec));
    const content = tickets.find((t) => t.id === "Content");

    expect(content?.dependsOn).toEqual(["Card"]);
    expect(content?.instances).toEqual(["content"]);
  });

  it("반복이 없는 root 자식(Header)도 자기 컴포넌트 티켓을 받는다", () => {
    const tickets = compileTickets(screenOf(dashboardCards as VisualSpec));
    const header = tickets.find((t) => t.id === "Header");

    expect(header).toBeDefined();
    expect(header?.dependsOn).toEqual([]);
    expect(header?.instances).toEqual(["header"]);
  });

  it("screen.root는 page 티켓이 되어 root 직계 자식 전부에 의존한다", () => {
    const tickets = compileTickets(screenOf(dashboardCards as VisualSpec));
    const page = tickets.find((t) => t.kind === "page");

    expect(page?.id).toBe("DashboardPage");
    expect(page?.instances).toEqual(["root"]);
    expect(page?.dependsOn).toEqual(["Header", "Content"]);
  });

  it("배열 순서가 이미 유효한 실행 순서다 — 의존 티켓이 항상 먼저 나온다", () => {
    const tickets = compileTickets(screenOf(dashboardCards as VisualSpec));
    const indexOf = (id: string) => tickets.findIndex((t) => t.id === id);

    for (const ticket of tickets) {
      for (const dep of ticket.dependsOn) {
        expect(indexOf(dep)).toBeLessThan(indexOf(ticket.id));
      }
    }
  });

  it("모든 티켓은 pending으로 시작한다", () => {
    const tickets = compileTickets(screenOf(dashboardCards as VisualSpec));
    expect(tickets.every((t) => t.status === "pending")).toBe(true);
  });

  it("반복이 전혀 없는 화면은 root 자식마다 티켓 하나씩만 만든다(중첩 티켓 없음)", () => {
    const tickets = compileTickets(screenOf(loginScreen as VisualSpec));

    // root(Screen)의 직계 자식: title, card. 각각 컴포넌트 티켓 + page 티켓 1개.
    expect(tickets).toHaveLength(3);
    expect(tickets.map((t) => t.id).sort()).toEqual(["Card", "Login", "Title"]);
    const card = tickets.find((t) => t.id === "Card");
    expect(card?.dependsOn).toEqual([]); // card 안의 hint는 하나뿐이라 반복 아님
  });

  it("자식이 텍스트 하나뿐인 최소 화면도 page 티켓 하나는 만든다", () => {
    const tickets = compileTickets(screenOf(emptyTitleScreen as VisualSpec));
    const page = tickets.find((t) => t.kind === "page");

    expect(page).toBeDefined();
    expect(tickets.some((t) => t.kind === "component")).toBe(true); // title
  });

  it("root가 frame이 아니거나 없으면 빈 배열을 반환한다", () => {
    const broken: ScreenSpec = {
      name: "Broken",
      size: { width: 100, height: 100 },
      root: "missing",
      nodes: {},
    };
    expect(compileTickets(broken)).toEqual([]);
  });

  it("root 직계 자식은 서로 반복 판정을 하지 않는다 — 완전히 같아도 각자 티켓, id만 -2로 구분", () => {
    // a, b는 완전히 동일한 모양(내용만 다름)이지만 root의 "직계 자식"이라 규칙 1이
    // 적용된다 — 규칙 2(형제 반복 그룹화)는 어떤 노드의 "자식들" 사이에서만 보므로
    // root 자신의 자식끼리는 절대 하나로 묶이지 않는다. 그래서 티켓이 1개(Card처럼
    // 묶임)가 아니라 2개(Section, Section-2) 나와야 한다.
    const screen: ScreenSpec = {
      name: "Dup",
      size: { width: 100, height: 100 },
      root: "root",
      nodes: {
        root: {
          type: "frame",
          name: "Root",
          box: { width: "fill", height: "fill" },
          layout: {
            direction: "column",
            gap: 0,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            mainAxis: "start",
            crossAxis: "start",
          },
          children: [{ node: "a" }, { node: "b" }],
        },
        a: {
          type: "text",
          name: "Section",
          box: { width: "auto", height: "auto" },
          content: "A",
          color: "#000000",
          typography: {
            fontFamily: "Pretendard",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 16,
            letterSpacing: 0,
            textAlign: "left",
          },
        },
        b: {
          type: "text",
          name: "Section",
          box: { width: "auto", height: "auto" },
          content: "B",
          color: "#000000",
          typography: {
            fontFamily: "Pretendard",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 16,
            letterSpacing: 0,
            textAlign: "left",
          },
        },
      },
    };

    const tickets = compileTickets(screen);
    const componentIds = tickets.filter((t) => t.kind === "component").map((t) => t.id);
    expect(componentIds).toEqual(["Section", "Section-2"]);
  });

  it("구조가 같은 button 형제(라벨만 다름)를 하나의 컴포넌트 티켓으로 묶는다", () => {
    // structuralKey가 button/input을 frame으로 착각해 .layout/.children에 접근하려다
    // 터지지 않는지 확인한다(#75로 Node 유니언이 늘면서 실제로 깨졌던 지점).
    const button = (name: string, content: string): Node => ({
      type: "button",
      name,
      box: { width: "fill", height: 44 },
      content,
      color: "#FFFFFF",
      typography: {
        fontFamily: "Pretendard",
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 20,
        letterSpacing: 0,
        textAlign: "center" as const,
      },
      background: { color: "#4F46E5" },
    });

    const screen: ScreenSpec = {
      name: "ButtonList",
      size: { width: 100, height: 100 },
      root: "root",
      nodes: {
        root: {
          type: "frame",
          name: "Root",
          box: { width: "fill", height: "fill" },
          layout: {
            direction: "column",
            gap: 0,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            mainAxis: "start",
            crossAxis: "start",
          },
          children: [{ node: "list" }],
        },
        list: {
          type: "frame",
          name: "List",
          box: { width: "fill", height: "auto" },
          layout: {
            direction: "column",
            gap: 8,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            mainAxis: "start",
            crossAxis: "stretch",
          },
          children: [{ node: "buttonA" }, { node: "buttonB" }],
        },
        buttonA: button("ButtonA", "저장"),
        buttonB: button("ButtonB", "취소"),
      },
    };

    const tickets = compileTickets(screen);
    const buttonTicket = tickets.find((t) => t.instances.includes("buttonA"));

    expect(buttonTicket).toBeDefined();
    expect(buttonTicket?.instances.sort()).toEqual(["buttonA", "buttonB"]);
  });
});
