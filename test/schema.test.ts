import { describe, expect, it } from "vitest";

import loginScreen from "../examples/login-screen.json";
import { validateVisualSpec } from "@/features/editor/schema";

function expectSchemaIssue(input: unknown): void {
  const result = validateVisualSpec(input);

  expect(result.valid).toBe(false);
  expect(result.issues.map(({ code }) => code)).toContain("schema");
}

describe("JSON Schema 검증", () => {
  it("잘못된 색상 문자열을 거부한다", () => {
    const input = structuredClone(loginScreen);
    input.screen.nodes.title.color = "red";

    expectSchemaIssue(input);
  });

  it("범위 밖 fontWeight를 거부한다", () => {
    const input = structuredClone(loginScreen);
    input.screen.nodes.title.typography.fontWeight = 1000;

    expectSchemaIssue(input);
  });

  it("스키마에 정의되지 않은 속성을 거부한다", () => {
    const input: unknown = {
      ...structuredClone(loginScreen),
      unspecified: true,
    };

    expectSchemaIssue(input);
  });

  it("범위 밖 opacity를 거부한다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.title as { opacity?: number }).opacity = 1.5;

    expectSchemaIssue(input);
  });

  it("음수 blur를 거부한다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.title as { blur?: number }).blur = -1;

    expectSchemaIssue(input);
  });

  it("정의되지 않은 테두리 정렬을 거부한다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.root as { border?: unknown }).border = {
      width: 1,
      color: "#000000",
      radius: 0,
      align: "middle",
    };

    expectSchemaIssue(input);
  });

  it("칸이 빠진 그림자를 거부한다 — 반쪽 객체가 CSS를 깨뜨린다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.root as { shadow?: unknown }).shadow = { x: 0, y: 4, color: "#00000020" };

    expectSchemaIssue(input);
  });

  it("칸이 빠진 모서리별 반경을 거부한다 — 반쪽 객체가 border-radius를 깨뜨린다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.root as { border?: unknown }).border = {
      width: 1,
      color: "#000000",
      radius: { topLeft: 8, topRight: 8 },
    };

    expectSchemaIssue(input);
  });

  it("음수 모서리 반경을 거부한다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.root as { border?: unknown }).border = {
      width: 1,
      color: "#000000",
      radius: { topLeft: -1, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    };

    expectSchemaIssue(input);
  });

  it("옛 버전(0.1) 문서는 그대로는 거부한다 — 변환은 입구(loadSpec)의 몫이다", () => {
    const input: unknown = {
      ...structuredClone(loginScreen),
      version: "0.1",
    };

    expectSchemaIssue(input);
  });

  it("배경이 옛 모양({ color })이면 거부한다", () => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.root as { background?: unknown }).background = { color: "#FFFFFF" };

    expectSchemaIssue(input);
  });

  it.each([
    ["알 수 없는 type", { type: "radial", color: "#FFFFFF" }],
    ["solid에 color가 없음", { type: "solid" }],
    ["linear의 stop이 하나", { type: "linear", angle: 0, stops: [{ color: "#000000", at: 0 }] }],
    [
      "linear 각도가 360",
      { type: "linear", angle: 360, stops: [{ color: "#000000", at: 0 }, { color: "#FFFFFF", at: 1 }] },
    ],
    [
      "linear 각도가 음수",
      { type: "linear", angle: -90, stops: [{ color: "#000000", at: 0 }, { color: "#FFFFFF", at: 1 }] },
    ],
    [
      "stop 위치가 1보다 큼",
      { type: "linear", angle: 90, stops: [{ color: "#000000", at: 0 }, { color: "#FFFFFF", at: 100 }] },
    ],
  ])("잘못된 채우기 겹을 거부한다 — %s", (_name, fill) => {
    const input = structuredClone(loginScreen);
    (input.screen.nodes.root as { background?: unknown }).background = [fill];

    expectSchemaIssue(input);
  });

  it("version 불일치를 거부한다", () => {
    const input: unknown = {
      ...structuredClone(loginScreen),
      version: "0.2",
    };

    expectSchemaIssue(input);
  });
});
