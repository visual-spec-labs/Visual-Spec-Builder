import type { Background, ScreenSpec } from "@/features/editor/schema";

// Fill에는 ID가 없으므로 속성 순서와 무관한 전체 값으로 기존 겹을 식별한다.
// 겹 자체의 수정도 기존 겹 소실 가능성이 있어 보수적으로 확인한다.
function key(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(key).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, item]) => `${JSON.stringify(name)}:${key(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** 기존 겹들이 같은 순서로 모두 남아 있으면 단순 추가이므로 확인하지 않는다. */
export function needsBackgroundConfirmation(before: Background = [], after: Background = []): boolean {
  const remaining = after.map(key);
  let cursor = 0;
  for (const fill of before) {
    const index = remaining.indexOf(key(fill), cursor);
    if (index < 0) return true;
    cursor = index + 1;
  }
  return false;
}

export function changedBackgroundNodes(before: ScreenSpec, after: ScreenSpec): string[] {
  return Object.entries(before.nodes)
    .filter(([id, node]) => {
      const next = after.nodes[id];
      return needsBackgroundConfirmation(
        "background" in node ? node.background : undefined,
        next && "background" in next ? next.background : undefined,
      );
    })
    .map(([id, node]) => node.name || id);
}
