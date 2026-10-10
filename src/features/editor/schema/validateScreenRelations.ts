import type { PageId, ProjectSpec, ScreenKind, ScreenSpec } from "./types";
import type { ValidationIssue } from "./validate";

function pointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** kind 생략은 page다(docs/24 §3). */
function kindOf(screen: ScreenSpec): ScreenKind {
  return screen.kind ?? "page";
}

/**
 * 화면 관계(kind·action)의 참조 무결성을 본다(#265 S1-2, docs/24 §5).
 *
 * 스키마 통과 뒤 프로젝트 문서에서만 부른다. 화면 문서(VisualSpec)는 외부 PageId를
 * 알 수 없으므로 검사하지 않는다(docs/06 "화면 종류·연결 선택 확장"). 반응형 override는
 * kind·action을 바꿀 수 없으므로(스키마) 기본값만 본다. 숨김 버튼과 루트에서 도달할 수
 * 없는 노드의 action도 저장된 값이므로 똑같이 검사한다.
 */
export function validateScreenRelations(project: ProjectSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pageOf = (id: PageId): ScreenSpec | undefined =>
    Object.prototype.hasOwnProperty.call(project.pages, id) ? project.pages[id] : undefined;

  // pageOrder[0]이 pages에 없으면 page-order-mismatch가 이미 같은 칸을 보고한다 — 중복하지 않는다.
  const first = pageOf(project.pageOrder[0]);
  if (first !== undefined && kindOf(first) !== "page") {
    issues.push({
      code: "first-page-kind",
      path: "/pageOrder/0",
      message: `첫 화면 "${project.pageOrder[0]}"의 kind는 "page"여야 합니다 (현재 "${kindOf(first)}").`,
    });
  }

  for (const [pageId, page] of Object.entries(project.pages)) {
    for (const [nodeId, node] of Object.entries(page.nodes)) {
      if (node.type !== "button" || node.action === undefined) continue;
      const { action } = node;
      const actionPath = `/pages/${pointer(pageId)}/nodes/${pointer(nodeId)}/action`;

      if (action.type === "close") {
        // 닫을 모달 문맥이 없는 page 자체 버튼만 막는다. widget의 close는 허용한다(docs/24 §3).
        if (kindOf(page) === "page") {
          issues.push({
            code: "action-source-invalid",
            path: actionPath,
            message: `page "${pageId}"의 버튼 "${nodeId}"에는 close를 둘 수 없습니다 — 닫을 모달이 없습니다.`,
          });
        }
        continue;
      }

      const targetPath = `${actionPath}/target`;
      const target = pageOf(action.target);
      if (target === undefined) {
        issues.push({
          code: "action-target-missing",
          path: targetPath,
          message: `버튼 "${nodeId}"의 ${action.type} 대상 "${action.target}"가 pages에 없습니다.`,
        });
      } else if (action.type === "openModal" && kindOf(target) !== "modal") {
        issues.push({
          code: "action-target-kind",
          path: targetPath,
          message: `openModal 대상 "${action.target}"의 kind는 "modal"이어야 합니다 (현재 "${kindOf(target)}").`,
        });
      } else if (action.type === "navigate" && kindOf(target) !== "page") {
        issues.push({
          code: "navigate-to-non-page",
          path: targetPath,
          message: `navigate 대상 "${action.target}"의 kind는 "page"여야 합니다 (현재 "${kindOf(target)}").`,
        });
      }
    }
  }

  return issues;
}
