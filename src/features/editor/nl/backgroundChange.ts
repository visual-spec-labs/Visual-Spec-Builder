import type { Background, Fill, ImageFill, ScreenSpec } from "@/features/editor/schema";

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

// 세부설정 패널의 채우기 방식 버튼 이름(ContentSection FIT_OPTIONS)과 같다.
const FIT_NAMES: Record<ImageFill["fit"], string> = { cover: "채우기", contain: "맞추기", fill: "늘이기" };

/** 패널 칸과 같은 자리수(소수 넷째 자리)로 — 0.29 × 100 같은 부동소수 오차를 숨긴다. */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** data URI에는 이름이 없다 — 내용으로 짧은 식별값(FNV-1a 32비트)을 만들어 다른 이미지와 구분한다. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * 확인창에 보일 배경 한 겹 — 세부설정 패널의 종류 이름(단색·선형·이미지)과 칸(각도·위치·채우기 방식)을
 * 그대로 쓴다. 확인 여부는 겹의 모든 값으로 판단하므로, 어느 값이 바뀌어도 이전·이후 문구가 달라지게
 * 모든 값을 싣는다(PR #452 리뷰).
 */
function describeFill(fill: Fill): string {
  switch (fill.type) {
    case "solid":
      return `단색 ${fill.color}`;
    case "linear":
      return `선형 그라디언트 ${round(fill.angle)}° (${fill.stops.map((stop) => `${stop.color} ${round(stop.at * 100)}%`).join(", ")})`;
    case "image": {
      const source = fill.src.startsWith("data:") ? `내장 이미지 ${shortHash(fill.src)}` : `이미지 ${fill.src}`;
      return `${source} (${FIT_NAMES[fill.fit]})`;
    }
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
    const description = { before: describeBackground(previous), after: next === undefined ? "요소 삭제" : describeBackground(following) };
    // 패널 자리수보다 작은 차이는 문구에 드러나지 않는다 — 같은 문구 둘로 묻지 않게 바뀐 것만은 알린다.
    if (description.before === description.after) description.after += " (패널에 보이지 않는 작은 값 차이)";
    return [{ name: node.name || id, ...description }];
  });
}
