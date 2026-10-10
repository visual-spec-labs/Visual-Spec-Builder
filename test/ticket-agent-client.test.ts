import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workspace = vi.hoisted(() => ({
  files: new Map<string, string>(),
  /** true면 작업공간 서버에 닿지 않는다(목록·읽기가 null). */
  offline: false,
  /** 잠금 연장 결과. 연결이 끊긴 동안은 실제 클라이언트처럼 true로 지나간다. */
  lockOwned: true,
  released: [] as string[],
  beforeRead: null as null | (() => Promise<void>),
}));

vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFiles: async (dir: string, options: { recursive?: boolean } = {}) => {
    if (workspace.offline) return null;
    const prefix = `${dir}/`;
    return [...workspace.files.keys()]
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
      .filter((path) => options.recursive === true || !path.includes("/"));
  },
  readWorkspaceTextFile: async (path: string) => {
    await workspace.beforeRead?.();
    return workspace.offline ? null : workspace.files.get(path) ?? null;
  },
  writeWorkspaceFile: async (path: string, body: string) => {
    if (workspace.offline) return { ok: false, error: "fetch failed" };
    workspace.files.set(path, body);
    return { ok: true, path };
  },
}));

vi.mock("@/features/editor/ui/agentRequestLock", () => ({
  holdRequestLock: async (_kind: string, owner: string) => ({
    renew: async () => workspace.offline || workspace.lockOwned,
    release: () => { workspace.released.push(owner); },
  }),
}));

import { requestNlEdit } from "@/features/editor/nl/nlAgentClient";
import { NL_REQUEST_PATH, NL_RESPONSE_PATH } from "@/features/editor/nl/nlProtocol";
import { requestTicketBatch } from "@/features/editor/ticket/ticketAgentClient";
import { TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH, TICKET_PROTOCOL_VERSION } from "@/features/editor/ticket/ticketProtocol";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import {
  AGENT_WAIT_WINDOW_MS,
  createAgentRequestWait,
  type AgentWaitProgress,
} from "@/features/editor/ui/agentRequestWait";
import { seedSpec } from "@/features/editor/store/seedSpec";

/**
 * 티켓·자연어 요청 클라이언트의 대기 상태 전이 (이슈 #284, docs/26 상태 전이표).
 *
 * **가상 시간 + 메모리 작업공간 fixture다.** vitest fake timers로 폴링 간격과 180초 기한을 건너뛴다 —
 * 실제 180초 경과 시험이 아니고, 외부 에이전트·모델은 실행하지 않는다. 응답 파일은 테스트가 쓴다.
 */

const pageId = "page1";
const page = seedSpec.screen;
const wave = compileTickets(page).filter((ticket) => ticket.id === "Header" || ticket.id === "Card");

function currentRequestId(path: string): string {
  return (JSON.parse(workspace.files.get(path) ?? "{}") as { id: string }).id;
}

function respondTicket(requestId: string): void {
  workspace.files.set(TICKET_RESPONSE_PATH, JSON.stringify({
    protocol: TICKET_PROTOCOL_VERSION,
    requestId,
    results: wave.map((ticket) => ({ ticketId: ticket.id, status: "done" })),
  }));
}

function startTicket(id = "req-1") {
  const progress: AgentWaitProgress[] = [];
  const wait = createAgentRequestWait((item) => progress.push(item));
  const cancel = { cancelled: false };
  const outcome = requestTicketBatch({ id, pageId, page, tickets: wave, generatedRoot: "shop/page1" }, cancel, wait);
  return { outcome, wait, cancel, progress };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  workspace.files.clear();
  workspace.offline = false;
  workspace.lockOwned = true;
  workspace.released = [];
  workspace.beforeRead = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("티켓 요청 대기 — timeout과 대기 연장 (가상 시간)", () => {
  it("연장하지 않으면 창 하나 뒤 timeout이고, 끝난 요청은 연장되지 않는다", async () => {
    const { outcome, wait } = startTicket();
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS + 1000);
    await expect(outcome).resolves.toMatchObject({ kind: "timeout" });
    expect(wait.extend()).toBe(false);
    expect(workspace.released).toEqual(["req-1"]);
  });

  it("만료 직전에 연장하면 원래 기한을 넘겨도 같은 요청으로 계속 기다리고 응답을 받는다", async () => {
    const { outcome, wait } = startTicket();
    await vi.advanceTimersByTimeAsync(170_000);
    expect(wait.extend()).toBe(true);
    expect(wait.extend()).toBe(true); // 중복 클릭
    await vi.advanceTimersByTimeAsync(30_000); // 원래 기한(180초)을 지난다
    // 같은 요청 ID — 연장은 새 요청을 만들지 않는다
    expect(currentRequestId(TICKET_REQUEST_PATH)).toBe("req-1");
    respondTicket("req-1");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(outcome).resolves.toMatchObject({ kind: "response", result: { kind: "results" } });
  });

  it("연장한 기한도 지나면 timeout이다 — 연장은 누적되지 않는다", async () => {
    const { outcome, wait } = startTicket();
    await vi.advanceTimersByTimeAsync(100_000);
    wait.extend();
    wait.extend();
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS + 1000);
    await expect(outcome).resolves.toMatchObject({ kind: "timeout" });
  });
});

describe("티켓 요청 대기 — 연결 끊김과 복구 (가상 시간)", () => {
  it("폴링이 서버에 닿지 않으면 connectionLost를 알리고, 복구되면 같은 요청을 이어서 받는다", async () => {
    const { outcome, progress } = startTicket();
    await vi.advanceTimersByTimeAsync(2000);
    workspace.offline = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(progress.at(-1)?.phase).toBe("connectionLost");
    workspace.offline = false;
    respondTicket("req-1");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(outcome).resolves.toMatchObject({ kind: "response", result: { kind: "results" } });
    expect(progress.map((item) => item.phase)).toEqual(["waiting", "waiting", "connectionLost", "waiting"]);
  });

  it("복구 첫 회차에 잠금 소유권을 다시 확인한다 — 끊긴 사이 다른 탭이 가져갔으면 lockLost", async () => {
    const { outcome } = startTicket();
    await vi.advanceTimersByTimeAsync(1000); // 요청 파일을 쓴 뒤 끊긴다
    workspace.offline = true;
    workspace.lockOwned = false; // 끊긴 사이 기한이 지나 다른 탭이 가져갔다
    await vi.advanceTimersByTimeAsync(40_000);
    workspace.offline = false;
    await vi.advanceTimersByTimeAsync(1000);
    await expect(outcome).resolves.toMatchObject({ kind: "lockLost" });
  });

  it("끊긴 채 기한이 지나면 timeout이 아니라 connectionLost로 끝난다(다음 행동이 다르다)", async () => {
    const { outcome } = startTicket();
    await vi.advanceTimersByTimeAsync(1000);
    workspace.offline = true;
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS);
    await expect(outcome).resolves.toMatchObject({ kind: "connectionLost" });
  });
});

describe("티켓 요청 대기 — 진행 근거와 취소", () => {
  it("요청을 쓴 뒤에는 근거 없는 waiting이고, 이 요청의 임시 출력이 보일 때만 파일 수를 알린다", async () => {
    const { outcome, cancel, progress } = startTicket();
    await vi.advanceTimersByTimeAsync(1000);
    expect(progress.at(-1)).toMatchObject({ phase: "waiting", stagedFiles: 0 });
    // 다른 요청의 임시 출력은 세지 않는다
    workspace.files.set("staging/old-req/components/Header.tsx", "old");
    workspace.files.set("staging/req-1/shop/page1/components/Header.tsx", "new");
    await vi.advanceTimersByTimeAsync(1000);
    expect(progress.at(-1)).toMatchObject({ phase: "waiting", stagedFiles: 1 });
    cancel.cancelled = true;
    await vi.advanceTimersByTimeAsync(1000);
    await expect(outcome).resolves.toEqual({ kind: "cancelled" });
  });

  it("요청 파일에 임시 출력 경로를 싣는다 — 에이전트가 generated/에 직접 쓰지 않게 한다", async () => {
    const { outcome, cancel } = startTicket("req-x");
    await vi.advanceTimersByTimeAsync(0);
    const request = JSON.parse(workspace.files.get(TICKET_REQUEST_PATH) ?? "{}");
    expect(request.outputRoot).toBe("staging/req-x");
    expect(request.tickets.map((item: { outputPath: string }) => item.outputPath)).toEqual(
      wave.map((ticket) => `staging/req-x/shop/page1/components/${ticket.componentName}.tsx`),
    );
    cancel.cancelled = true;
    await vi.advanceTimersByTimeAsync(1000);
    await outcome;
  });
});

describe("자연어 요청도 같은 대기 규칙을 쓴다 (가상 시간)", () => {
  function startNl() {
    const progress: AgentWaitProgress[] = [];
    const wait = createAgentRequestWait((item) => progress.push(item));
    const outcome = requestNlEdit(
      { id: "nl-1", instruction: "간격을 24로", scope: { kind: "screen", nodeId: null, label: "현재 화면" }, pageId, page },
      { cancelled: false },
      wait,
    );
    return { outcome, wait, progress };
  }

  it("연장하면 원래 기한을 넘겨 같은 요청의 응답을 받는다", async () => {
    const { outcome, wait } = startNl();
    await vi.advanceTimersByTimeAsync(170_000);
    expect(wait.extend()).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(currentRequestId(NL_REQUEST_PATH)).toBe("nl-1");
    workspace.files.set(NL_RESPONSE_PATH, JSON.stringify({ protocol: 1, requestId: "nl-1", commands: [] }));
    await vi.advanceTimersByTimeAsync(1000);
    await expect(outcome).resolves.toMatchObject({ kind: "response" });
  });

  it("끊김을 알리고, 끊긴 채 기한이 지나면 connectionLost로 끝난다", async () => {
    const { outcome, progress } = startNl();
    await vi.advanceTimersByTimeAsync(1000);
    workspace.offline = true;
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS);
    expect(progress.map((item) => item.phase)).toContain("connectionLost");
    await expect(outcome).resolves.toMatchObject({ kind: "connectionLost" });
  });

  it("연장하지 않으면 timeout이고 끝난 뒤 연장은 거절된다", async () => {
    const { outcome, wait } = startNl();
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS + 1000);
    await expect(outcome).resolves.toMatchObject({ kind: "timeout" });
    expect(wait.extend()).toBe(false);
  });
});


it("응답 GET이 기한 뒤 끝나면 성공 응답도 수용하지 않는다", async () => {
  const { outcome, wait } = startTicket();
  await vi.advanceTimersByTimeAsync(1000);
  respondTicket("req-1");
  let resume!: () => void;
  workspace.beforeRead = () => new Promise<void>((resolve) => { resume = resolve; });
  await vi.advanceTimersByTimeAsync(1000);
  vi.setSystemTime(new Date(wait.deadline! + 1));
  expect(wait.extend()).toBe(false);
  resume();
  await expect(outcome).resolves.toMatchObject({ kind: "timeout" });
  expect(workspace.released).toEqual(["req-1"]);
});

it("승격 호출자는 응답 후 잠금을 소유하고 명시적으로 해제한다", async () => {
  const outcome = requestTicketBatch({ id: "held", pageId, page, tickets: wave, generatedRoot: "shop/page1" }, { cancelled: false }, createAgentRequestWait(), true);
  await vi.advanceTimersByTimeAsync(1000);
  respondTicket("held");
  await vi.advanceTimersByTimeAsync(1000);
  const result = await outcome;
  expect(result.kind).toBe("response");
  expect(workspace.released).toEqual([]);
  if (result.kind === "response") result.lock!.release();
  expect(workspace.released).toEqual(["held"]);
});


it("응답 GET 중 소유권이 바뀌면 응답 ID가 맞아도 거절한다", async () => {
  const { outcome } = startTicket();
  await vi.advanceTimersByTimeAsync(1000);
  respondTicket("req-1");
  let resume!: () => void;
  workspace.beforeRead = () => new Promise<void>((resolve) => { resume = resolve; });
  await vi.advanceTimersByTimeAsync(1000);
  workspace.lockOwned = false;
  resume();
  await expect(outcome).resolves.toMatchObject({ kind: "lockLost" });
});
