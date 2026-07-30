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

  it("version 불일치를 거부한다", () => {
    const input: unknown = {
      ...structuredClone(loginScreen),
      version: "0.2",
    };

    expectSchemaIssue(input);
  });
});
