import type { NodeId } from "@/features/editor/schema";

/** prefix로 시작하는 후보를 1번부터 늘려 가며 `taken`이 아니라고 할 때까지 찾는다. */
function nextFreeId(prefix: string, taken: (candidate: string) => boolean): NodeId {
  let index = 1;
  let candidate = `${prefix}-${index}`;

  while (taken(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }

  return candidate;
}

/**
 * prefix 기반으로 nodes에 없는 새 id를 순번으로 만든다(순수 함수, 테스트 대상).
 * NodeId 패턴(^[A-Za-z0-9_-]+$)을 항상 만족한다.
 */
export function generateNodeId(
  prefix: string,
  nodes: Record<string, unknown>,
): NodeId {
  return nextFreeId(prefix, (candidate) =>
    Object.prototype.hasOwnProperty.call(nodes, candidate),
  );
}

/**
 * 한 배치 안에서 새 id를 여러 개 뽑는다(복제·붙여넣기, #151).
 *
 * `generateNodeId`를 그냥 반복 호출하면 두 노드가 같은 id를 받을 수 있다 —
 * 매 호출이 원본 `nodes`만 보고 판정하기 때문에, 그 호출에서 막 뽑은 id를
 * 다음 호출은 모른다(서브트리를 복제하며 자식마다 새 id가 필요할 때 실제로
 * 겹친다). 여기서는 뽑을 때마다 예약 집합에 더해 가며 다음 후보 탐색에 반영한다.
 *
 * `prefixes`는 만들 노드들의 접두사를 순서대로 나열한 것이고, 반환값은 같은
 * 순서의 id 배열이다.
 */
export function generateNodeIds(
  prefixes: readonly string[],
  nodes: Record<string, unknown>,
): NodeId[] {
  const reserved = new Set<NodeId>(Object.keys(nodes));

  return prefixes.map((prefix) => {
    const id = nextFreeId(prefix, (candidate) => reserved.has(candidate));
    reserved.add(id);
    return id;
  });
}
