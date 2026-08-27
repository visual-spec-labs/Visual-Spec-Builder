import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import rootMissing from "../examples/invalid/root-missing.json";
import type { VisualSpec } from "@/features/editor/schema";
import { buildExportPayload } from "@/features/editor/store/exportSpec";

describe("buildExportPayload", () => {
  it("유효한 스펙은 파일명과 JSON 문자열을 돌려준다", () => {
    const result = buildExportPayload(dashboardCards as VisualSpec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filename).toBe(`${dashboardCards.screen.name}.json`);
      expect(JSON.parse(result.json)).toEqual(dashboardCards);
    }
  });

  it("무효한 스펙은 다운로드 대신 이슈 개수를 돌려준다", () => {
    const result = buildExportPayload(rootMissing as VisualSpec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issueCount).toBeGreaterThan(0);
    }
  });
});
