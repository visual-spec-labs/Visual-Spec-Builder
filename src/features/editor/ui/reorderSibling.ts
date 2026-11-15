import type { NodeId } from "@/features/editor/schema";

/** 형제 순서를 옮기는 네 방향(#152) — 피그마의 4단 관례(맨앞·앞·뒤·맨뒤). */
export type ReorderDirection = "front" | "forward" | "backward" | "back";

/**
 * `id`를 형제 배열(`children`) 안에서 `direction`으로 옮겼을 때의 새 인덱스.
 * `id`가 그 배열에 없으면 null — 대상이 없다는 뜻이라 `moveNode`를 부를 이유가
 * 없다. 이미 끝에 있어 움직이지 않는 경우도(예: 맨 앞에서 "맨 앞으로") 그
 * 자리 그대로의 인덱스를 돌려준다 — 호출부가 "바뀌지 않는다"를 따로 판정하지
 * 않고 그냥 moveNode에 넘겨도 결과가 같다.
 */
export function reorderedIndex(
  children: readonly NodeId[],
  id: NodeId,
  direction: ReorderDirection,
): number | null {
  const index = children.indexOf(id);
  if (index === -1) return null;

  switch (direction) {
    case "front":
      return 0;
    case "forward":
      return Math.max(0, index - 1);
    case "backward":
      return Math.min(children.length - 1, index + 1);
    case "back":
      return children.length - 1;
  }
}
