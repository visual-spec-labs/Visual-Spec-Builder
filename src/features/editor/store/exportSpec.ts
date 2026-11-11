import { validateProjectSpec } from "@/features/editor/schema";
import type { ProjectSpec, ValidationIssue } from "@/features/editor/schema";

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; issueCount: number; issues: ValidationIssue[] };

/**
 * 프로젝트를 검증하고 내보낼 JSON을 만든다(순수 함수, DOM 없음 — 테스트 대상).
 * 검증 실패 시 사용자에게 보여줄 원인과 이슈 개수를 돌려준다.
 *
 * 페이지 전부를 내보낸다. "이 페이지만 화면 문서로" 모드는 schema의 toVisualSpec으로
 * 만들 수 있지만 그걸 고르는 UI가 아직 없어 여기서는 다루지 않는다.
 */
export function buildExportPayload(spec: ProjectSpec): ExportResult {
  const result = validateProjectSpec(spec);
  if (!result.valid) {
    console.warn("Export 검증 실패:", result.issues);
    return { ok: false, issueCount: result.issues.length, issues: result.issues };
  }

  return {
    ok: true,
    filename: `${spec.name || "project"}.json`,
    json: JSON.stringify(spec, null, 2),
  };
}

/**
 * Save as의 파일명 prompt 결과를 정리한다(순수 함수, DOM 없음 — 테스트 대상).
 * 공백만 입력하면 기본 파일명으로 대체하고, .json 접미사가 없으면 붙인다.
 */
export function resolveFilename(chosenName: string, defaultFilename: string): string {
  const trimmed = chosenName.trim() || defaultFilename;
  return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
}
