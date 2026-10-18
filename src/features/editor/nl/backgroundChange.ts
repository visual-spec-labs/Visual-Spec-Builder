import type { Background, Fill, ScreenSpec } from "@/features/editor/schema";

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

/**
 * 기존 겹들이 같은 순서로 모두 남아 있으면 단순 추가이므로 확인하지 않는다.
 *
 * 단색 한 겹을 다른 단색 한 겹으로 바꾸는 것도 묻지 않는다(#441) — "버튼 색을 바꿔줘"가 바로 이것이고,
 * 앞뒤가 한 겹씩이라 어느 겹이 없어지는지 헷갈릴 일이 없다. 그 밖의 내용 교체는 ID가 없어 보수적으로 묻는다.
 */
export function needsBackgroundConfirmation(before: Background = [], after: Background = []): boolean {
  if (before.length === 1 && after.length === 1 && before[0].type === "solid" && after[0].type === "solid") return false;
  const remaining = after.map(key);
  let cursor = 0;
  for (const fill of before) {
    const index = remaining.indexOf(key(fill), cursor);
    if (index < 0) return true;
    cursor = index + 1;
  }
  return false;
}

/** 확인창에 보일 배경 한 겹 — 세부설정 패널의 종류 이름(단색·선형·이미지)과 같은 말을 쓴다. */
function describeFill(fill: Fill): string {
  switch (fill.type) {
    case "solid":
      return `단색 ${fill.color}`;
    case "linear":
      return `선형 그라디언트 ${fill.stops.map((stop) => stop.color).join("→")}`;
    case "image":
      // data URI는 이름이 없고 길어서 종류만 쓴다. 경로·assetId는 마지막 조각이 파일 이름이다.
      return fill.src.startsWith("data:") ? "이미지" : `이미지 ${fill.src.split("/").pop()}`;
  }
}

/** 배열 앞이 맨 위 겹이므로 그 순서 그대로 "위 + 아래"로 잇는다. */
export function describeBackground(background: Background = []): string {
  return background.length === 0 ? "배경 없음" : background.map(describeFill).join(" + ");
}

/** 적용 전 확인이 필요한 노드 하나 — 화면에 보이는 이름과 이전·이후 배경을 사람 말로 담는다. */
export interface BackgroundChange {
  name: string;
  before: string;
  after: string;
}

export function changedBackgroundNodes(before: ScreenSpec, after: ScreenSpec): BackgroundChange[] {
  return Object.entries(before.nodes).flatMap(([id, node]) => {
    const next = after.nodes[id];
    const previous = "background" in node ? node.background : undefined;
    const following = next && "background" in next ? next.background : undefined;
    if (!needsBackgroundConfirmation(previous, following)) return [];
    return [{
      name: node.name || id,
      before: describeBackground(previous),
      after: next === undefined ? "요소 삭제" : describeBackground(following),
    }];
  });
}
