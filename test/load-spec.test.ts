import { describe, expect, it } from "vitest";

import dashboardCards from "../examples/dashboard-cards.json";
import rootMissing from "../examples/invalid/root-missing.json";
import twoPageExample from "../examples/two-page-project.json";
import legacyDashboard from "./fixtures/legacy/dashboard-cards.v0.1.json";
import legacyTwoPage from "./fixtures/legacy/two-page-project.v0.2.json";
import { parseSpecJson } from "@/features/editor/store/loadSpec";

describe("parseSpecJson", () => {
  it("유효한 JSON 스펙을 파싱해 spec을 돌려준다", () => {
    const result = parseSpecJson(JSON.stringify(dashboardCards));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec).toEqual(dashboardCards);
    }
  });

  it("프로젝트 문서도 받는다 — 버전이 아니라 pages 키로 가른다", () => {
    const result = parseSpecJson(JSON.stringify(twoPageExample));

    expect(result).toEqual({ ok: true, spec: twoPageExample });
  });

  // #127: 0.1·0.2 문서는 열 때 0.3으로 바꾼 뒤 검증한다.
  it("0.1 화면 문서는 0.3으로 변환해서 연다", () => {
    const result = parseSpecJson(JSON.stringify(legacyDashboard));

    expect(result).toEqual({ ok: true, spec: dashboardCards });
  });

  it("0.2 프로젝트 문서는 0.3으로 변환해서 연다", () => {
    const result = parseSpecJson(JSON.stringify(legacyTwoPage));

    expect(result).toEqual({ ok: true, spec: twoPageExample });
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
