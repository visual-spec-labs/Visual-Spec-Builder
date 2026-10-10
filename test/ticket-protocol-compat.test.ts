import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 티켓 요청 규약 v3과 이미 설치된 v2 스킬의 조합 (이슈 #281 리뷰, docs/26 #281 "티켓 요청 규약 v3").
 *
 * **fixture다 — 실제 모델 실행이 아니다.** `fixtures/installed-skill-v2/`는 이 PR 전 develop(`537b591`)의
 * `skills/visual-spec-ticket-response/SKILL.md` 그대로다(사용자 작업공간에 이미 설치된 사본). 아래 `v2SkillAgent`는
 * 그 사본의 두 규칙 — 버전 관문(2번)과 v2 경로 형식(4번) — 만 흉내 낸다. 새 GUI 쪽은 실제 실행기
 * (`ui/ticketRunner.ts`)·요청 클라이언트를 그대로 돌리고 작업공간 HTTP와 요청 잠금만 메모리 구현으로 바꿨다.
 */

const workspace = vi.hoisted(() => ({
  files: new Map<string, string | Uint8Array>(),
  offline: false,
  beforeWrite: null as ((path: string) => void) | null,
  failWrite: null as ((path: string) => string | null) | null,
  log: [] as string[],
}));

vi.mock("@/features/editor/ui/workspaceClient", async () =>
  (await import("./fixtures/memoryWorkspace")).memoryWorkspaceClient(workspace));

vi.mock("@/features/editor/ui/agentRequestLock", () => ({
  holdRequestLock: async (kind: string, owner: string) => ({
    renew: async () => true,
    release: () => {
      const path = `runtime/${kind}-request.json`;
      const request = workspace.files.get(path);
      if (typeof request === "string" && (JSON.parse(request) as { id: string }).id === owner) workspace.files.delete(path);
    },
  }),
}));

import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import {
  buildTicketRequest,
  TICKET_PROTOCOL_VERSION,
  TICKET_REQUEST_PATH,
  TICKET_RESPONSE_PATH,
  type TicketRequest,
} from "@/features/editor/ticket/ticketProtocol";
import { buildTicketAgentInstruction } from "@/features/editor/ui/agentHandoff";
import { AGENT_WAIT_WINDOW_MS } from "@/features/editor/ui/agentRequestWait";
import { forgetUnsavedGenerationProjects } from "@/features/editor/ui/generationTarget";
import { cancelTicketRun, runAllTickets } from "@/features/editor/ui/ticketRunner";

import { resetMemoryWorkspace, textOf } from "./fixtures/memoryWorkspace";

const installedV2Skill = readFileSync(new URL("./fixtures/installed-skill-v2/visual-spec-ticket-response.SKILL.md", import.meta.url), "utf8");
const currentSkill = readFileSync(new URL("../skills/visual-spec-ticket-response/SKILL.md", import.meta.url), "utf8");

type V2AgentOutcome =
  | { kind: "refused"; report: string }
  | { kind: "responded"; results: { ticketId: string; status: "done" | "failed"; message?: string }[] };

/**
 * 설치된 v2 스킬을 따르는 에이전트 흉내. `ignoreVersionGate`는 버전 관문을 건너뛰고 응답까지 쓰는 에이전트
 * (지시를 일부만 따른 경우)를 흉내 낸다 — 그때도 경로 규칙(4번)은 지킨다.
 */
function v2SkillAgent(request: TicketRequest, { ignoreVersionGate = false } = {}): V2AgentOutcome {
  if (request.protocol !== 2 && !ignoreVersionGate) {
    // 2번: "`protocol`이 2가 아니면(구버전 GUI·구버전 스킬) 파일을 쓰지 말고 GUI와 스킬 버전을 맞추라고 보고한다"
    return { kind: "refused", report: `요청 protocol ${request.protocol}은 이 스킬(v2)이 처리하지 않습니다. GUI와 스킬 버전을 맞추세요.` };
  }
  const results = request.tickets.map((ticket) => {
    // 4번: "`kind`에 따라 정확히 `pages/<componentName>.tsx` 또는 `components/<componentName>.tsx`다"
    const expected = `${ticket.kind === "page" ? "pages" : "components"}/${ticket.componentName}.tsx`;
    if (ticket.filePath !== expected) {
      return { ticketId: ticket.id, status: "failed" as const, message: `filePath가 ${expected}가 아닙니다: ${ticket.filePath}` };
    }
    workspace.files.set(ticket.outputPath, `export function ${ticket.componentName}() { return null; }\n`);
    return { ticketId: ticket.id, status: "done" as const };
  });
  workspace.files.set(TICKET_RESPONSE_PATH, JSON.stringify({ protocol: 2, requestId: request.id, results }));
  return { kind: "responded", results };
}

function currentRequest(): TicketRequest | null {
  const text = textOf(workspace, TICKET_REQUEST_PATH);
  return text === undefined ? null : (JSON.parse(text) as TicketRequest);
}

function writtenUnder(prefix: string): string[] {
  return [...workspace.files.keys()].filter((path) => path.startsWith(prefix));
}

beforeEach(() => {
  vi.useFakeTimers();
  resetMemoryWorkspace(workspace);
  forgetUnsavedGenerationProjects();
  useTicketStore.setState({
    tickets: [], sourcePageId: null, sourcePage: null, sourceDocumentId: null, isOpen: false,
    running: false, runError: null, runErrorRetryable: false, wait: null, acceptanceWarning: null,
    overwriteReview: null, lastRun: null, restoreMessage: null, generation: 0,
  });
  useEditorStore.getState().loadSpec(structuredClone(seedSpec));
  useDocumentStore.setState({ fileName: "shop.json" });
  const { activePageId, spec } = useEditorStore.getState();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
});

afterEach(async () => {
  cancelTicketRun();
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
});

describe("설치된 v2 스킬 사본(fixture)", () => {
  it("버전 관문과 v2 경로 형식 규칙을 들고 있다 — fixture 에이전트가 흉내 내는 두 규칙", () => {
    expect(installedV2Skill).toContain("2가 아니면(구버전 GUI·구버전 스킬) 파일을 쓰지 말고 GUI와 스킬 버전을 맞추라고 보고한다");
    expect(installedV2Skill).toContain("`kind`에 따라 정확히 `pages/<componentName>.tsx` 또는 `components/<componentName>.tsx`다.");
    expect(installedV2Skill).not.toContain("generatedRoot");
  });

  it("번호를 v2로 두었다면 조용히 실패했다 — 생성 자리 아래의 filePath를 v2 스킬은 모든 티켓 경로 오류로 본다", () => {
    const page = structuredClone(seedSpec.screen);
    const request = { ...buildTicketRequest({ id: "wave-1", pageId: "page1", page, tickets: compileTickets(page), generatedRoot: "shop/page1" }), protocol: 2 };
    const outcome = v2SkillAgent(request);
    expect(outcome.kind).toBe("responded");
    if (outcome.kind === "responded") expect(outcome.results.every((result) => result.status === "failed")).toBe(true);
  });
});

describe("새 GUI(규약 v3) + 설치된 v2 스킬 — 조용히 실패하지 않는다", () => {
  it("요청은 v3이라 v2 스킬은 쓰기 전에 멈추고, GUI는 만료 때 스킬 갱신(visual-spec skills)을 안내한다", async () => {
    expect(TICKET_PROTOCOL_VERSION).toBe(3);
    const run = runAllTickets();
    await vi.advanceTimersByTimeAsync(1000);
    const request = currentRequest()!;
    expect(request.protocol).toBe(3);
    expect(request.generatedRoot).toBe("shop/page1");

    const outcome = v2SkillAgent(request);
    expect(outcome).toMatchObject({ kind: "refused" });
    // 전달 지시문도 같은 행동을 요구한다 — 에이전트 대화에서 버전 불일치와 갱신 명령이 보인다
    expect(buildTicketAgentInstruction()).toContain(`티켓 요청 규약 v${TICKET_PROTOCOL_VERSION}`);
    expect(buildTicketAgentInstruction()).toContain("`visual-spec skills`로 스킬을 갱신");

    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS + 5000);
    await run;
    const state = useTicketStore.getState();
    expect(state.running).toBe(false);
    expect(state.runError).toContain("티켓 요청 규약 버전이 다르다고 알렸다면 `visual-spec skills`로 스킬을 갱신");
    expect(state.runError).toContain("규약 v3");
    expect(state.runErrorRetryable).toBe(true);
    expect(state.tickets.every((ticket) => ticket.status === "pending")).toBe(true);
    expect(writtenUnder("staging/")).toEqual([]);
    expect(writtenUnder("generated/")).toEqual([]);
  });

  it("v2 스킬이 관문을 건너뛰고 v2 응답을 써도 받지 않고 '구버전 스킬 — visual-spec skills로 갱신'을 보이며 티켓을 실패로 만들지 않는다", async () => {
    const run = runAllTickets();
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = v2SkillAgent(currentRequest()!, { ignoreVersionGate: true });
    expect(outcome.kind).toBe("responded");
    await vi.advanceTimersByTimeAsync(3000);
    await run;

    const state = useTicketStore.getState();
    expect(state.running).toBe(false);
    expect(state.runError).toContain("에이전트의 티켓 응답 스킬이 구버전입니다(티켓 요청 규약 v2 응답, 이 GUI는 v3)");
    expect(state.runError).toContain("`visual-spec skills`로 에이전트의 스킬 사본을 갱신한 뒤");
    expect(state.tickets.every((ticket) => ticket.status === "pending")).toBe(true);
    expect(writtenUnder("generated/")).toEqual([]);
  });
});

describe("구 GUI(규약 v2) + 새 스킬 — 문서 계약", () => {
  it("새 스킬은 v3과 v2 요청을 모두 처리하고 요청과 같은 번호로 응답한다고 명시한다", () => {
    expect(currentSkill).toContain("이 스킬은 **티켓 요청 규약 v3**(현재 GUI)과 v2(생성 자리 전의 구버전\n   GUI)를 처리한다. 응답의 `protocol`은 요청과 같은 번호로 쓴다.");
    expect(currentSkill).toContain("- `protocol: 2`: 구버전 GUI의 요청이다. `generatedRoot`가 없고");
    expect(currentSkill).toContain("`visual-spec skills`로 갱신");
  });
});
