import { describe, expect, it } from "vitest";

import {
  validateCommand,
  validateTransaction,
  type Command,
  type Transaction,
} from "@/features/editor/command";
import { seedSpec } from "@/features/editor/store/seedSpec";

const frame = seedSpec.screen.nodes.cardA;
if (frame.type !== "frame") throw new Error("테스트 시드의 cardA는 frame이어야 합니다.");
const title = seedSpec.screen.nodes.headerTitle;
if (title.type !== "text") throw new Error("테스트 시드의 headerTitle은 text여야 합니다.");

const commands = [
  {
    type: "createNode",
    parentId: "content",
    id: "newText",
    node: seedSpec.screen.nodes.headerTitle,
  },
  { type: "updateNode", id: "cardA", path: "layout.gap", value: 24 },
  { type: "deleteNode", id: "cardB" },
  { type: "moveNode", id: "cardA", newParentId: "content", index: 0 },
  { type: "setLayout", id: "cardA", layout: frame.layout },
  { type: "updateScreen", path: "size.width", value: 1280 },
  { type: "removeNodeAction", id: "button" },
  { type: "createColorStyle", id: "color-primary", name: "Primary", value: "#123456" },
  { type: "updateColorStyle", id: "color-primary", name: "Primary", value: "#123456" },
  { type: "deleteColorStyle", id: "color-primary" },
  { type: "applyColorStyle", id: "color-primary", nodeId: "headerTitle", target: "color" },
  { type: "createTypographyStyle", id: "text-title", name: "Title", value: title.typography },
  { type: "updateTypographyStyle", id: "text-title", name: "Title", value: title.typography },
  { type: "deleteTypographyStyle", id: "text-title" },
  { type: "applyTypographyStyle", id: "text-title", nodeId: "headerTitle" },
] satisfies Command[];

describe("Command Schema v0.3", () => {
  it.each(commands)("$type Command를 받는다", (command) => {
    expect(validateCommand(command)).toEqual({ valid: true, issues: [] });
  });

  it("모르는 type과 추가 필드를 거부한다", () => {
    expect(validateCommand({ type: "paintNode", id: "cardA" }).valid).toBe(false);
    expect(validateCommand({ ...commands[2], force: true }).valid).toBe(false);
  });

  it("필수 필드와 각 필드 타입을 검사한다", () => {
    expect(validateCommand({ type: "deleteNode" }).valid).toBe(false);
    expect(validateCommand({ ...commands[3], index: -1 }).valid).toBe(false);
    expect(validateCommand({ ...commands[3], index: 1.5 }).valid).toBe(false);
    expect(validateCommand({ ...commands[1], path: "" }).valid).toBe(false);
  });

  it("createNode.index는 선택 필드다 — 생략해도, 줘도 받는다(#193)", () => {
    expect(validateCommand(commands[0]).valid).toBe(true); // index 없음
    expect(validateCommand({ ...commands[0], index: 0 }).valid).toBe(true);
    // moveNode.index와 같은 제약(정수, 0 이상)이다.
    expect(validateCommand({ ...commands[0], index: -1 }).valid).toBe(false);
    expect(validateCommand({ ...commands[0], index: 1.5 }).valid).toBe(false);
  });

  it("createNode.node와 setLayout.layout은 IR 스키마로 검사한다", () => {
    expect(validateCommand({ ...commands[0], node: { type: "text" } }).valid).toBe(false);
    expect(
      validateCommand({ ...commands[4], layout: { direction: "diagonal" } }).valid,
    ).toBe(false);
  });

  it("path와 value의 의미 검사는 다음 관문에 맡긴다", () => {
    expect(
      validateCommand({
        type: "updateNode",
        id: "cardA",
        path: "not.a.real.path",
        value: { any: "JSON value" },
      }),
    ).toEqual({ valid: true, issues: [] });
  });

  it("Transaction에 1–100개 Command를 받는다", () => {
    const transaction = { version: "0.3", commands } satisfies Transaction;
    expect(validateTransaction(transaction)).toEqual({ valid: true, issues: [] });
    expect(validateTransaction({ version: "0.3", commands: [] }).valid).toBe(false);
    expect(validateTransaction({ version: "0.3", commands: Array(101).fill(commands[2]) }).valid).toBe(false);
  });

  it("Transaction의 추가 필드와 잘못된 원소를 거부한다", () => {
    expect(validateTransaction({ version: "0.3", commands, prompt: "make a page" }).valid).toBe(false);
    expect(validateTransaction({ version: "0.3", commands: [{ type: "deleteNode" }] }).valid).toBe(false);
  });

  it("검증 중 예외가 나도 던지지 않고 issues를 돌려준다", () => {
    const hostile = new Proxy({}, { ownKeys: () => { throw new Error("boom"); } });
    expect(() => validateCommand(hostile)).not.toThrow();
    expect(validateCommand(hostile).valid).toBe(false);
  });
});
