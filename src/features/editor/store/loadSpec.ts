import { validateVisualSpec } from "@/features/editor/schema";
import type { VisualSpec } from "@/features/editor/schema";

export type LoadSpecResult =
  | { ok: true; spec: VisualSpec }
  | { ok: false; issueCount: number };

/**
 * JSON 문자열을 파싱하고 검증한다(순수 함수, DOM 없음 — 테스트 대상).
 * exportSpec.ts의 buildExportPayload와 대칭 — 파싱/파일 읽기의 반대 방향.
 */
export function parseSpecJson(jsonText: string): LoadSpecResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.warn("Open: JSON 파싱 실패 — 올바른 JSON이 아닙니다.");
    return { ok: false, issueCount: 1 };
  }

  const result = validateVisualSpec(parsed);
  if (!result.valid) {
    console.warn("Open 검증 실패:", result.issues);
    return { ok: false, issueCount: result.issues.length };
  }

  return { ok: true, spec: parsed as VisualSpec };
}
