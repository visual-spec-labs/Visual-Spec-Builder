import type { ScreenSpec } from "@/features/editor/schema";

export const UNSUPPORTED_SCREEN_RELATIONS_MESSAGE =
  "화면 관계(kind: modal/widget 또는 버튼 action)의 코드 생성·출력 수용·Export는 아직 지원하지 않습니다. JSON 가져오기와 저장은 값을 보존합니다.";

/**
 * S1-1 capability guard, not reference validation. Do not use at load/save boundaries.
 * Remove only after S1-2 and S1-8/9 generation/acceptance/Export support, including
 * project context, action-aware grouping and transitive input fingerprints, are ready.
 * Inspect all nodes (including hidden ones); dangling targets are unsupported too.
 * An omitted kind or explicit page without actions keeps the existing single-page path.
 */
export function hasUnsupportedScreenRelations(page: ScreenSpec): boolean {
  return page.kind === "modal" || page.kind === "widget" ||
    Object.values(page.nodes).some(node => node.type === "button" && node.action !== undefined);
}
