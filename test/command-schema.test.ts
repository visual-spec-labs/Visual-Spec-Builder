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
] satisfies Command[];

describe("Command Schema v0.1", () => {
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
    const transaction = { commands } satisfies Transaction;
    expect(validateTransaction(transaction)).toEqual({ valid: true, issues: [] });
    expect(validateTransaction({ commands: [] }).valid).toBe(false);
    expect(validateTransaction({ commands: Array(101).fill(commands[2]) }).valid).toBe(false);
  });

  it("Transaction의 추가 필드와 잘못된 원소를 거부한다", () => {
    expect(validateTransaction({ commands, prompt: "make a page" }).valid).toBe(false);
    expect(validateTransaction({ commands: [{ type: "deleteNode" }] }).valid).toBe(false);
  });

  it("검증 중 예외가 나도 던지지 않고 issues를 돌려준다", () => {
    const hostile = new Proxy({}, { ownKeys: () => { throw new Error("boom"); } });
    expect(() => validateCommand(hostile)).not.toThrow();
    expect(validateCommand(hostile).valid).toBe(false);
  });
});
