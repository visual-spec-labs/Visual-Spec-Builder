import { describe, expect, it } from "vitest";
import { changedBackgroundNodes, needsBackgroundConfirmation } from "@/features/editor/nl/backgroundChange";
import type { ScreenSpec } from "@/features/editor/schema";
import login from "../examples/login-screen.json";

const white = { type: "solid", color: "#FFFFFF" } as const;
const black = { type: "solid", color: "#000000" } as const;
const red = { type: "solid", color: "#FF0000" } as const;

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
    expect(needsBackgroundConfirmation([white], [red])).toBe(true);
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
    expect(changedBackgroundNodes(before, after)).toContain(before.nodes.card.name);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
