import { describe, expect, it } from "vitest";
import { validateTransaction, COMMAND_TYPES, COMMAND_VERSION } from "@/features/editor/command";
import { parseNlResponse, buildNlRequest } from "@/features/editor/nl/nlProtocol";
import { parseAgentEdit, buildGuiState } from "@/features/editor/agent/agentEditProtocol";
import { seedSpec } from "@/features/editor/store/seedSpec";
const commands = [{ type: "updateScreen", path: "name", value: "new" }];

describe("Command 0.3 외부 입구", () => {
  it.each([undefined, null, 0.2, "0.1", "0.2"])("버전 %j를 보정하지 않고 두 전송에서 거부한다", (version) => {
    expect(validateTransaction({ version, commands })).toMatchObject({ valid: false, issues: [{ code: "version", path: "/version" }] });
    expect(parseNlResponse(JSON.stringify({ protocol: 2, requestId: "x", commandVersion: version, commands }), "x")).toMatchObject({ kind: "invalid", issues: [{ code: "version" }] });
    expect(parseAgentEdit(JSON.stringify({ protocol: 2, id: "x", pageId: "p", baseStateRevision: "r", commandVersion: version, commands }))).toMatchObject({ kind: "invalid", issues: [{ code: "version" }] });
  });
  it("구 protocol은 Command 버전과 무관하게 거부한다", () => {
    expect(parseNlResponse(JSON.stringify({ protocol: 1, requestId: "x", commandVersion: "0.3", commands }), "x")).toMatchObject({ kind: "malformed" });
    expect(parseAgentEdit(JSON.stringify({ protocol: 1, id: "x", commandVersion: "0.3", commands }))).toMatchObject({ kind: "malformed" });
  });
  it("새 요청과 gui-state가 버전과 지원 명령을 공개한다", () => {
    const page = seedSpec.screen;
    expect(buildNlRequest({ id: "x", pageId: "p", page, instruction: "rename", scope: { kind: "screen", nodeId: null, label: "screen" } })).toMatchObject({ protocol: 2, commandVersion: COMMAND_VERSION });
    expect(buildGuiState({ tabId: "t", documentId: 1, fileName: null, pageId: "p", page, diskRevision: null, selectedId: null, now: new Date() })).toMatchObject({ protocol: 2, capabilities: { commandVersion: COMMAND_VERSION, commands: COMMAND_TYPES } });
    expect(COMMAND_TYPES).toHaveLength(15);
  });
  it("새 전송은 버전을 보존해 G1을 통과한다", () => {
    expect(parseNlResponse(JSON.stringify({ protocol: 2, requestId: "x", commandVersion: "0.3", commands }), "x")).toEqual({ kind: "commands", commands });
    expect(parseAgentEdit(JSON.stringify({ protocol: 2, id: "x", pageId: "p", baseStateRevision: "r", commandVersion: "0.3", commands }))).toMatchObject({ kind: "edit", commands });
  });
});
