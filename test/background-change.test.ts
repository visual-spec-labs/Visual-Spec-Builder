import { describe, expect, it } from "vitest";
import { changedBackgroundNodes, describeBackground, needsBackgroundConfirmation } from "@/features/editor/nl/backgroundChange";
import type { LinearFill, ScreenSpec } from "@/features/editor/schema";
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
      { name: before.nodes.card.name, before: "단색 #FFFFFF", after: "선형 그라디언트 #4F46E5→#1E40AF + 단색 #000000" },
    ]);
    expect(describeBackground([])).toBe("배경 없음");
    expect(describeBackground([{ type: "image", src: "assets/hero.png", fit: "cover" }])).toBe("이미지 hero.png");
    expect(describeBackground([{ type: "image", src: "data:image/png;base64,AAAA", fit: "cover" }])).toBe("이미지");
  });
});
