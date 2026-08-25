import { validateVisualSpec } from "@/features/editor/schema";
import type { VisualSpec } from "@/features/editor/schema";

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; issueCount: number };

/**
 * 스펙을 검증하고 내보낼 JSON을 만든다(순수 함수, DOM 없음 — 테스트 대상).
 * 검증 실패 시 이슈 개수만 담아 돌려준다.
 */
export function buildExportPayload(spec: VisualSpec): ExportResult {
  const result = validateVisualSpec(spec);
  if (!result.valid) {
    console.warn("Export 검증 실패:", result.issues);
    return { ok: false, issueCount: result.issues.length };
  }

  return {
    ok: true,
    filename: `${spec.screen.name || "screen"}.json`,
    json: JSON.stringify(spec, null, 2),
  };
}
