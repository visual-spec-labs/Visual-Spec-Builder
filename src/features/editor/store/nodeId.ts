import type { NodeId } from "@/features/editor/schema";

/**
 * prefix 기반으로 nodes에 없는 새 id를 순번으로 만든다(순수 함수, 테스트 대상).
 * NodeId 패턴(^[A-Za-z0-9_-]+$)을 항상 만족한다.
 */
export function generateNodeId(
  prefix: string,
  nodes: Record<string, unknown>,
): NodeId {
  let index = 1;
  let candidate = `${prefix}-${index}`;

  while (Object.prototype.hasOwnProperty.call(nodes, candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }

  return candidate;
}
