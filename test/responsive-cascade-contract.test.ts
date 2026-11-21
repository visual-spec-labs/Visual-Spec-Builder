import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ScreenSpec } from "@/features/editor/schema";
import { resolveResponsiveScreen } from "@/features/editor/responsive/resolveResponsive";

/**
 * 분기점 누적 규칙과, 그 규칙을 **생성하는 에이전트가 읽는 자리**에 적어 뒀는지 (이슈 #510).
 *
 * `docs/12-responsive-ir-design.md` "표현 방식"이 규칙을 이미 정해 뒀다 — *"작은 화면 우선의 기본
 * 레이아웃은 기존 필드에 두고 큰 화면용 변경을 breakpoint에 기록한다."* 그런데 스킬 두 개 어디에도
 * 그 말이 없어서, 자연어로 만든 화면이 CSS 미디어쿼리 직관(구간으로 끊긴다)대로 쓰여 왔다.
 * 실제로 `mobile(320)` 재정의가 1440 캔버스까지 살아남아 데스크톱 화면이 모바일 치수로 그려졌다.
 *
 * 아래 첫 테스트는 그 **동작**을 고정하고(바꾸면 기존 문서의 해석이 달라진다), 나머지는 그 동작을
 * 스킬이 실제로 설명하는지 본다. 규칙을 코드에만 두면 다음 생성에서 같은 실수가 또 나온다.
 */

function screen(overrides: ScreenSpec["responsive"], baseFontSize = 42): ScreenSpec {
  return {
    name: "Portfolio",
    size: { width: 1440, height: 900 },
    root: "root",
    nodes: {
      root: {
        type: "frame",
        name: "Screen",
        box: { width: "fill", height: "fill" },
        layout: { direction: "column", gap: 72, padding: { top: 56, right: 80, bottom: 40, left: 80 }, mainAxis: "start", crossAxis: "stretch" },
        children: [{ node: "title" }],
      },
      title: {
        type: "text",
        name: "Title",
        box: { width: "fill", height: "auto" },
        content: "안녕하세요",
        color: "#111111",
        typography: { fontFamily: "Pretendard", fontSize: baseFontSize, fontWeight: 700, lineHeight: 52, letterSpacing: -1, textAlign: "left" },
      },
    },
    responsive: overrides,
  };
}

const fontSize = (spec: ScreenSpec, width: number) => {
  const node = resolveResponsiveScreen(spec, width).nodes.title;
  return node.type === "text" ? node.typography.fontSize : null;
};

describe("분기점 누적 규칙 (#510)", () => {
  it("작은 분기점의 재정의는 더 큰 폭에서도 그대로 남는다 — 구간으로 끊기지 않는다", () => {
    // 데스크톱 값을 기본에 쓰고 mobile(320)에 모바일 값을 적은 모양. 자연어 생성이 실제로 이렇게 썼다.
    const spec = screen({
      breakpoints: { mobile: { minWidthPx: 320 }, tablet: { minWidthPx: 768 }, desktop: { minWidthPx: 1024 } },
      overrides: { mobile: { title: { typography: { fontSize: 32 } } } },
    });

    expect(fontSize(spec, 320)).toBe(32);
    // 페이지 크기(1440)에서도 모바일 값이 이긴다 — 기본의 42는 320 미만에서만 쓰이는 죽은 값이다.
    expect(fontSize(spec, 1440)).toBe(32);
    expect(fontSize(spec, 319)).toBe(42);
  });

  it("기본을 가장 좁은 화면으로 두고 넓은 쪽을 분기점에 적으면 의도대로 그려진다", () => {
    // 같은 화면을 규칙대로 쓴 모양 — 기본이 모바일(32), 넓은 쪽만 분기점에 적는다.
    const spec = screen({
      breakpoints: { desktop: { minWidthPx: 1024 } },
      overrides: { desktop: { title: { typography: { fontSize: 42 } } } },
    }, 32);

    expect(fontSize(spec, 390)).toBe(32);
    expect(fontSize(spec, 1440)).toBe(42);
  });

  it("같은 속성이 여러 분기점에 있으면 적용되는 것 중 가장 큰 분기점이 이긴다", () => {
    const spec = screen({
      breakpoints: { tablet: { minWidthPx: 768 }, desktop: { minWidthPx: 1024 } },
      overrides: {
        tablet: { title: { typography: { fontSize: 36 } } },
        desktop: { title: { typography: { fontSize: 42 } } },
      },
    });

    expect(fontSize(spec, 800)).toBe(36);
    expect(fontSize(spec, 1440)).toBe(42);
  });
});

describe("규칙이 생성하는 쪽 문서에 적혀 있다 (#510)", () => {
  const read = (name: string) =>
    readFileSync(new URL(`../skills/${name}/SKILL.md`, import.meta.url), "utf8");

  it("authoring 스킬이 누적 규칙과 기본값의 뜻을 설명한다", () => {
    const skill = read("visual-spec-authoring");

    expect(skill).toContain("분기점은 **누적**이다");
    expect(skill).toContain("가장 좁은 화면이고, 넓은 화면 값을 분기점에 적는다");
    // 요청이 말하지 않으면 아예 만들지 않는다 — 쓸데없는 분기점이 이 함정의 입구다.
    expect(skill).toContain("말하지 않으면 아예 만들지 않는다");
  });

  it("nl-response 스킬도 같은 규칙을 적고 authoring을 가리킨다", () => {
    const skill = read("visual-spec-nl-response");

    expect(skill).toContain("분기점은 누적이다");
    expect(skill).toContain("기본값이 가장 좁은 화면이고");
    expect(skill).toContain("visual-spec-authoring");
  });
});
