import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import rootMissing from "../examples/invalid/root-missing.json";
import { parseSpecJson } from "@/features/editor/store/loadSpec";

describe("parseSpecJson", () => {
  it("유효한 JSON 스펙을 파싱해 spec을 돌려준다", () => {
    const result = parseSpecJson(JSON.stringify(dashboardCards));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec).toEqual(dashboardCards);
    }
  });

  it("JSON 형식이 아니면 이슈 1건으로 실패한다", () => {
    const result = parseSpecJson("{ not valid json");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issueCount).toBe(1);
    }
  });

  it("스키마에 안 맞는 JSON은 검증 이슈 개수를 돌려준다", () => {
    const result = parseSpecJson(JSON.stringify(rootMissing));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issueCount).toBeGreaterThan(0);
    }
  });
});
