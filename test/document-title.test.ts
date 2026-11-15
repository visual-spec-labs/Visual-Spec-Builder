import { describe, expect, it } from "vitest";

import { formatDocumentTitle } from "@/features/editor/ui/documentTitle";

describe("formatDocumentTitle (#158)", () => {
  it("프로젝트·활성 페이지·현재 파일명을 표시한다", () => {
    expect(formatDocumentTitle("쇼핑몰", "상품 상세", "product.json")).toBe(
      "쇼핑몰 — 상품 상세 · product.json",
    );
  });

  it("아직 파일이 없으면 저장되지 않은 문서임을 표시한다", () => {
    expect(formatDocumentTitle("새 프로젝트", "홈", null)).toBe(
      "새 프로젝트 — 홈 · 저장되지 않음",
    );
  });
});
