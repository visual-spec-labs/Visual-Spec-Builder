import type { ProjectSpec } from './types.ts';
import type { ValidationIssue } from './validate.ts';

type Edge = { target: string; path: string };

function pointer(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Cross-page widget checks run only after the closed JSON schema succeeds. */
export function validateInstances(project: ProjectSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const edges = new Map<string, Edge[]>();
  for (const [pageId, page] of Object.entries(project.pages)) {
    const fromWidget = page.kind === 'widget';
    if (fromWidget) edges.set(pageId, []);
    for (const [nodeId, node] of Object.entries(page.nodes)) {
      if (node.type !== 'instance') continue;
      const path = `/pages/${pointer(pageId)}/nodes/${pointer(nodeId)}`;
      const target = Object.prototype.hasOwnProperty.call(project.pages, node.ref) ? project.pages[node.ref] : undefined;
      if (!target) {
        issues.push({ code: 'instance-ref-missing', path: `${path}/ref`, message: `위젯 참조 "${node.ref}"가 없습니다.` });
        continue;
      }
      if (target.kind !== 'widget') {
        issues.push({ code: 'instance-ref-kind', path: `${path}/ref`, message: `참조 "${node.ref}"는 widget이어야 합니다.` });
        continue;
      }
      if (fromWidget) edges.get(pageId)!.push({ target: node.ref, path: `${path}/ref` });
      for (const [overrideId, override] of Object.entries(node.overrides ?? {})) {
        const overridePath = `${path}/overrides/${pointer(overrideId)}`;
        const original = Object.prototype.hasOwnProperty.call(target.nodes, overrideId) ? target.nodes[overrideId] : undefined;
        if (!original || (original.type !== 'text' && original.type !== 'button')) {
          issues.push({ code: 'instance-override-invalid', path: overridePath, message: `원본 widget의 Text/Button 노드 "${overrideId}"가 없습니다.` });
          continue;
        }
        if (original.type === 'button' && override.content === '') {
          issues.push({ code: 'instance-override-invalid', path: `${overridePath}/content`, message: 'Button의 content는 비어 있을 수 없습니다.' });
        }
      }
    }
  }

  // Iterative DFS bounds stack usage on deeply nested, otherwise valid projects.
  const state = new Map<string, 1 | 2>();
  for (const start of edges.keys()) {
    if (state.has(start)) continue;
    const stack: { pageId: string; next: number }[] = [{ pageId: start, next: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const adjacent = edges.get(frame.pageId) ?? [];
      if (frame.next === adjacent.length) {
        state.set(frame.pageId, 2);
        stack.pop();
        continue;
      }
      const edge = adjacent[frame.next++];
      if (state.get(edge.target) === 1) {
        issues.push({ code: 'instance-cycle', path: edge.path, message: `widget 참조 순환이 "${edge.target}"에서 닫힙니다.` });
      } else if (!state.has(edge.target)) {
        state.set(edge.target, 1);
        stack.push({ pageId: edge.target, next: 0 });
      }
    }
  }
  return issues;
}
