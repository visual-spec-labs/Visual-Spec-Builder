import { isScreenRelationIssue, type ValidationIssue } from "@/features/editor/schema";

/** 진단을 생략하지 않는다. 복원 허용과 정상 저장 성공은 다른 상태다. */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues.map(({ code, path, message }) => `[${code}] ${path}: ${message}`).join("\n");
}

export const RELATION_RECOVERY_GUIDANCE = "복원·새로고침은 이전 Undo 기록을 복원하지 않습니다. Undo는 이 세션에 기록이 남아 있을 때만 가능합니다. 버튼 삭제는 해당 action 오류만 없앨 수 있으며 first-page-kind는 해결하지 못합니다. 먼저 미검증 복구 사본을 다운로드하세요. 원본과 사본을 보관하고, 텍스트 편집기에서 오류를 수정한 별도 사본을 파일 → 열기로 다시 검증하세요. 관계 자동 수정 기능은 아직 없습니다.";

export function validationFailureMessage(title: string, issues: ValidationIssue[], operation: "open" | "save"): string {
  const preservation = operation === "open"
    ? "선택한 원본 파일과 현재 작업은 변경하지 않았습니다. 원본을 보관하고 별도 사본을 수정한 뒤 다시 여세요."
    : "파일을 저장하지 않았습니다. 현재 작업은 유지됩니다.";
  const recovery = operation === "save" && issues.some(isScreenRelationIssue)
    ? `\n에디터의 화면 관계 오류 안내에서 미검증 복구 사본을 다운로드할 수 있습니다.\n${RELATION_RECOVERY_GUIDANCE}`
    : "";
  return `${title} (검증 실패 ${issues.length}건).\n${formatValidationIssues(issues)}\n\n${preservation}${recovery}`;
}
