import { validateProjectSpec, validateVisualSpec } from "@/features/editor/schema";
import type { ProjectSpec, VisualSpec } from "@/features/editor/schema";

export type LoadSpecResult =
  | { ok: true; spec: VisualSpec | ProjectSpec }
  | { ok: false; issueCount: number };

/** v0.2 프로젝트 문서인지 본다. 아니면 v0.1 화면 문서로 다룬다. */
function isProjectDocument(parsed: unknown): boolean {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { version?: unknown }).version === "0.2"
  );
}

/**
 * JSON 문자열을 파싱하고 검증한다(순수 함수, DOM 없음 — 테스트 대상).
 * exportSpec.ts의 buildExportPayload와 대칭 — 파싱/파일 읽기의 반대 방향.
 *
 * v0.1과 v0.2를 모두 받는다. 어느 쪽인지는 version으로 가른다.
 * v0.1을 프로젝트로 넓히는 일은 스토어의 loadSpec이 한다.
 */
export function parseSpecJson(jsonText: string): LoadSpecResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.warn("Open: JSON 파싱 실패 — 올바른 JSON이 아닙니다.");
    return { ok: false, issueCount: 1 };
  }

  const result = isProjectDocument(parsed)
    ? validateProjectSpec(parsed)
    : validateVisualSpec(parsed);

  if (!result.valid) {
    console.warn("Open 검증 실패:", result.issues);
    return { ok: false, issueCount: result.issues.length };
  }

  return { ok: true, spec: parsed as VisualSpec | ProjectSpec };
}
