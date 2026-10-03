import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import emptyTitleScreen from "../examples/empty-title-screen.json";
import cardEffects from "../examples/card-effects.json";
import formGrid from "../examples/form-grid.json";
import headerContent from "../examples/header-content.json";
import imageHero from "../examples/image-hero.json";
import childMissing from "../examples/invalid/child-missing.json";
import cycle from "../examples/invalid/cycle.json";
import multipleParents from "../examples/invalid/multiple-parents.json";
import orphanNode from "../examples/invalid/orphan-node.json";
import rootMissing from "../examples/invalid/root-missing.json";
import rootNotFrame from "../examples/invalid/root-not-frame.json";
import textWithoutContent from "../examples/invalid/text-without-content.json";
import unsupportedNodeType from "../examples/invalid/unsupported-node-type.json";
import loginScreen from "../examples/login-screen.json";
import { migrateV01, validateProjectSpec, validateVisualSpec } from "@/features/editor/schema";
import type { VisualSpec } from "@/features/editor/schema";

describe("validateVisualSpec", () => {
  it.each([
    ["login-screen", loginScreen],
    ["empty-title-screen", emptyTitleScreen],
    ["dashboard-cards", dashboardCards],
    ["header-content", headerContent],
    ["image-hero", imageHero],
    ["form-grid", formGrid],
    ["card-effects", cardEffects],
  ] as const)("%s 예제를 통과시킨다", (_name, input) => {
    expect(validateVisualSpec(input)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ["root-missing", rootMissing],
    ["root-not-frame", rootNotFrame],
    ["child-missing", childMissing],
    ["cycle", cycle],
    ["multiple-parents", multipleParents],
    ["orphan-node", orphanNode],
  ] as const)("%s 예제는 해당 오류 코드 하나만 반환한다", (code, input) => {
    const result = validateVisualSpec(input);

    expect(result.valid).toBe(false);
    // 무효 예제는 원인이 하나뿐이어야 한다. 잡음이 섞이면 예제나 검증기가 잘못된 것이다.
    expect(result.issues.map((issue) => issue.code)).toEqual([code]);
  });

  it("content가 없는 text 노드를 거부한다", () => {
    const result = validateVisualSpec(textWithoutContent);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("schema");
  });

  it("지원하지 않는 노드 type을 거부한다", () => {
    const result = validateVisualSpec(unsupportedNodeType);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("schema");
  });

  it("schema 이슈 메시지가 위반된 필드마다 다르게 나온다", () => {
    const result = validateVisualSpec(textWithoutContent);
    const messages = result.issues.map((issue) => issue.message);

    // 예전에는 7개 모두 "JSON 스키마의 구조 규칙을 위반했습니다." 하나였다.
    expect(new Set(messages).size).toBeGreaterThan(1);
    expect(messages.some((message) => message.includes("content"))).toBe(
      true,
    );
    expect(messages.some((message) => message.includes("layout"))).toBe(
      true,
    );
  });

  it("지원하지 않는 노드 type의 메시지에 허용 값이 나온다", () => {
    const result = validateVisualSpec(unsupportedNodeType);
    const messages = result.issues.map((issue) => issue.message);

    expect(
      messages.some(
        (message) => message.includes("frame") || message.includes("text"),
      ),
    ).toBe(true);
  });

  it.each([null, "invalid", [], {}])(
    "잘못된 입력 %#에도 예외를 던지지 않고 invalid를 반환한다",
    (input) => {
      expect(() => validateVisualSpec(input)).not.toThrow();
      expect(validateVisualSpec(input).valid).toBe(false);
    },
  );
});

/**
 * 그라디언트 stop의 `at` 오름차순(#127). JSON Schema로는 원소끼리 비교할 수 없어
 * 검증기가 `gradient-stop-order`로 따로 잡는다.
 */
describe("gradient-stop-order", () => {
  /** login-screen의 root 배경을 주어진 stop의 linear 한 겹(+ 밑에 solid)으로 바꾼다. */
  function withStops(ats: number[]): VisualSpec {
    const spec = structuredClone(loginScreen) as VisualSpec;
    const root = spec.screen.nodes.root;
    if (root.type !== "frame") throw new Error("root는 frame이어야 한다");
    root.background = [
      {
        type: "linear",
        angle: 180,
        stops: ats.map((at) => ({ color: "#000000", at })) as [
          { color: string; at: number },
          { color: string; at: number },
        ],
      },
      { type: "solid", color: "#FFFFFF" },
    ];
    return spec;
  }

  it("오름차순 stop은 통과한다", () => {
    expect(validateVisualSpec(withStops([0, 0.4, 1]))).toEqual({ valid: true, issues: [] });
  });

  it("같은 위치가 이어지는 stop은 통과한다 — 딱 끊기는 경계", () => {
    expect(validateVisualSpec(withStops([0, 0.5, 0.5, 1])).valid).toBe(true);
  });

  it("앞보다 작은 stop을 그 위치 경로로 보고한다", () => {
    const result = validateVisualSpec(withStops([0, 0.8, 0.3, 1]));

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "gradient-stop-order",
        path: "/screen/nodes/root/background/0/stops/2/at",
      }),
    ]);
  });

  it("어긋난 자리마다 하나씩 보고한다", () => {
    const result = validateVisualSpec(withStops([1, 0.5, 0]));

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "gradient-stop-order",
      "gradient-stop-order",
    ]);
  });

  it("프로젝트 문서에서는 페이지 경로로 보고한다", () => {
    const project = migrateV01(withStops([1, 0]));
    const result = validateProjectSpec(project);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "gradient-stop-order",
        path: "/pages/page1/nodes/root/background/0/stops/1/at",
      }),
    ]);
  });
});
