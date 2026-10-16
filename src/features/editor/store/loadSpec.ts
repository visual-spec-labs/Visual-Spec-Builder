import {
  migrateToV04,
  validateProjectSpec,
  validateVisualSpec,
} from "@/features/editor/schema";
import type { ProjectSpec, ValidationIssue, VisualSpec } from "@/features/editor/schema";

export type LoadSpecResult =
  | { ok: true; spec: VisualSpec | ProjectSpec }
  | { ok: false; issueCount: number; issues: ValidationIssue[] };

/**
 * 프로젝트 문서인지 본다. 아니면 화면 문서로 다룬다.
 *
 * 버전이 아니라 키(`pages`)로 가른다 — 0.3부터 버전 문자열은 IR 세대를 뜻하고
 * 화면 문서와 프로젝트 문서가 같은 "0.3"을 쓴다(#127).
 */
function isProjectDocument(parsed: unknown): boolean {
  return typeof parsed === "object" && parsed !== null && "pages" in parsed;
}

/**
 * JSON 문자열을 파싱하고 검증한다(순수 함수, DOM 없음 — 테스트 대상).
 * exportSpec.ts의 buildExportPayload와 대칭 — 파싱/파일 읽기의 반대 방향.
 *
 * 화면 문서와 프로젝트 문서를 모두 받는다. 어느 쪽인지는 키로 가른다.
 * 0.1·0.2·0.3 문서는 검증 전에 `migrateToV04`로 0.4로 바꾼다 — 파일은 다시 쓰지
 * 않고, 처음 저장할 때 0.3으로 바뀐다. 화면 문서를 프로젝트로 넓히는 일은
 * 스토어의 loadSpec이 한다.
 */
export function parseSpecJson(jsonText: string): LoadSpecResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.warn("Open: JSON 파싱 실패 — 올바른 JSON이 아닙니다.");
    return { ok: false, issueCount: 1, issues: [{ code: "schema", path: "/", message: "올바른 JSON이 아닙니다. JSON 구문을 확인하세요." }] };
  }

  const migrated = migrateToV04(parsed);
  const result = isProjectDocument(migrated)
    ? validateProjectSpec(migrated)
    : validateVisualSpec(migrated);

  if (!result.valid) {
    console.warn("Open 검증 실패:", result.issues);
    return { ok: false, issueCount: result.issues.length, issues: result.issues };
  }

  return { ok: true, spec: migrated as VisualSpec | ProjectSpec };
}
