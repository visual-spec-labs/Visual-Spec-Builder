import { describe, expect, it } from "vitest";
import { changedBackgroundNodes, describeBackground, needsBackgroundConfirmation } from "@/features/editor/nl/backgroundChange";
import type { Background, LinearFill, ScreenSpec } from "@/features/editor/schema";
import login from "../examples/login-screen.json";

const white = { type: "solid", color: "#FFFFFF" } as const;
const black = { type: "solid", color: "#000000" } as const;
const red = { type: "solid", color: "#FF0000" } as const;
const gradient: LinearFill = { type: "linear", angle: 90, stops: [{ color: "#4F46E5", at: 0 }, { color: "#1E40AF", at: 1 }] };

describe("NL 배경 적용 전 확인", () => {
  it("배경이 없었거나 기존 겹을 보존하는 추가는 묻지 않는다", () => {
    expect(needsBackgroundConfirmation(undefined, [white])).toBe(false);
    expect(needsBackgroundConfirmation([white, black], [red, white, red, black])).toBe(false);
    expect(needsBackgroundConfirmation([white], [{ color: "#FFFFFF", type: "solid" }])).toBe(false);
  });
  it("누락·전체 삭제·역순·내용 교체는 확인한다", () => {
    expect(needsBackgroundConfirmation([white, black], [white])).toBe(true);
    expect(needsBackgroundConfirmation([white], undefined)).toBe(true);
    expect(needsBackgroundConfirmation([white, black], [black, white])).toBe(true);
    expect(needsBackgroundConfirmation([white], [gradient])).toBe(true);
    expect(needsBackgroundConfirmation([gradient], [white])).toBe(true);
    expect(needsBackgroundConfirmation([white, black], [red, black])).toBe(true);
  });
  it("단색 한 겹을 다른 단색 한 겹으로 바꾸는 것은 묻지 않는다 (#441)", () => {
    expect(needsBackgroundConfirmation([white], [red])).toBe(false);
  });
  it("중복 겹의 개수와 순서를 보존해야 한다", () => {
    expect(needsBackgroundConfirmation([white, white], [white])).toBe(true);
    expect(needsBackgroundConfirmation([white, black, white], [white, white, black])).toBe(true);
    expect(needsBackgroundConfirmation([white, white], [white, red, white])).toBe(false);
  });
  it("노드 삭제로 사라지는 배경도 포함하고 입력을 변경하지 않는다", () => {
    const before = structuredClone(login.screen) as ScreenSpec;
    if (before.nodes.card.type === "frame") before.nodes.card.background = [white];
    const after = structuredClone(before);
    delete after.nodes.card;
    const snapshot = JSON.stringify(before);
    expect(changedBackgroundNodes(before, after)).toContainEqual({ name: before.nodes.card.name, before: "단색 #FFFFFF", after: "요소 삭제" });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it("확인창은 노드마다 이전·이후 배경을 화면의 말로 보여 준다 (#441)", () => {
    const before = structuredClone(login.screen) as ScreenSpec;
    if (before.nodes.card.type !== "frame") throw new Error("card fixture");
    before.nodes.card.background = [white];
    const after = structuredClone(before);
    if (after.nodes.card.type !== "frame") throw new Error("card fixture");
    after.nodes.card.background = [gradient, black];
    expect(changedBackgroundNodes(before, after)).toEqual([
      { name: before.nodes.card.name, before: "단색 #FFFFFF", after: "선형 그라디언트 90° (#4F46E5 0%, #1E40AF 100%) + 단색 #000000" },
    ]);
    expect(describeBackground([])).toBe("배경 없음");
    expect(describeBackground([{ type: "image", src: "assets/hero.png", fit: "cover" }])).toBe("이미지 assets/hero.png (채우기)");
    expect(describeBackground([{ type: "image", src: "data:image/png;base64,AAAA", fit: "cover" }])).toMatch(/^내장 이미지 [0-9a-f]{8} \(채우기\)$/);
  });
  it("확인이 필요한 값 변경은 이전·이후 문구가 서로 다르다 — 각도·위치·채우기 방식·경로 (PR #452 리뷰)", () => {
    const pairs: [Background, Background][] = [
      [[gradient], [{ ...gradient, angle: 180 }]],
      [[gradient], [{ ...gradient, stops: [{ color: "#4F46E5", at: 0.5 }, { color: "#1E40AF", at: 1 }] }]],
      [[{ type: "image", src: "assets/hero.png", fit: "cover" }], [{ type: "image", src: "assets/hero.png", fit: "contain" }]],
      [[{ type: "image", src: "assets/a/hero.png", fit: "cover" }], [{ type: "image", src: "assets/b/hero.png", fit: "cover" }]],
      [[{ type: "image", src: "data:image/png;base64,AAAA", fit: "cover" }], [{ type: "image", src: "data:image/png;base64,BBBB", fit: "cover" }]],
    ];
    for (const [previous, next] of pairs) {
      expect(needsBackgroundConfirmation(previous, next)).toBe(true);
      expect(describeBackground(previous)).not.toBe(describeBackground(next));
    }
    expect(describeBackground([{ ...gradient, angle: 180 }])).toBe("선형 그라디언트 180° (#4F46E5 0%, #1E40AF 100%)");
    expect(describeBackground([{ ...gradient, stops: [{ color: "#4F46E5", at: 0.29 }, { color: "#1E40AF", at: 1 }] }]))
      .toBe("선형 그라디언트 90° (#4F46E5 29%, #1E40AF 100%)");
  });
  it("패널 자리수보다 작은 차이로 문구가 같아지면 바뀐 것만은 알린다", () => {
    const before = structuredClone(login.screen) as ScreenSpec;
    if (before.nodes.card.type !== "frame") throw new Error("card fixture");
    before.nodes.card.background = [gradient];
    const after = structuredClone(before);
    if (after.nodes.card.type !== "frame") throw new Error("card fixture");
    after.nodes.card.background = [{ ...gradient, angle: 90.00001 }];
    const [change] = changedBackgroundNodes(before, after);
    expect(change.before).toBe("선형 그라디언트 90° (#4F46E5 0%, #1E40AF 100%)");
    expect(change.after).toBe("선형 그라디언트 90° (#4F46E5 0%, #1E40AF 100%) (패널에 보이지 않는 작은 값 차이)");
  });
});
