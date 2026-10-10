import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 요청 세대와 출력 수용의 회귀 (이슈 #284, docs/26).
 *
 * **가상 시간 + 메모리 작업공간 fixture다.** 실제 실행기(`ui/ticketRunner.ts`)·클라이언트
 * (`ticket/ticketAgentClient.ts`)·확정(`ui/ticketOutputAcceptance.ts`)·Export 훑기
 * (`ui/exportGeneratedCode.ts`)를 그대로 돌리고, 작업공간 HTTP 클라이언트와 요청 잠금만 메모리
 * 구현으로 바꿨다. 외부 에이전트는 테스트가 파일을 써서 흉내 낸다 — 실제 모델 실행이 아니고,
 * 180초는 vitest fake timers로 건너뛴다.
 *
 * 각 시나리오는 **티켓 상태**(ticketStore)와 **Export 수용**(생성 세대 판정·`generated/` 바이트)을
 * 따로 단언한다. 둘이 어긋났던 것이 #284 감사의 재현 결함이었다(티켓은 pending인데 Export 4/4).
 */

const workspace = vi.hoisted(() => ({
  files: new Map<string, string | Uint8Array>(),
  offline: false,
  beforeWrite: null as ((path: string) => void) | null,
  failWrite: null as ((path: string) => string | null) | null,
  log: [] as string[],
  owner: null as string | null,
  beforeRead: undefined as ((path: string) => Promise<void>) | undefined,
  afterWrite: undefined as ((path: string) => void) | undefined,
}));

vi.mock("@/features/editor/ui/workspaceClient", async () =>
  (await import("./fixtures/memoryWorkspace")).memoryWorkspaceClient(workspace));

// 서버 잠금(`workspace/requestLock.ts`)처럼 풀 때 요청 id가 주인과 같은 요청 파일만 지운다.
vi.mock("@/features/editor/ui/agentRequestLock", () => ({
  holdRequestLock: async (kind: string, owner: string) => {
    if (workspace.owner !== null && workspace.owner !== owner) return "busy";
    workspace.owner = owner;
    return ({
    renew: async () => workspace.owner === owner,
    release: () => {
      if (workspace.owner !== owner) return;
      workspace.owner = null;
      const path = `runtime/${kind}-request.json`;
      const request = workspace.files.get(path);
      if (typeof request === "string" && (JSON.parse(request) as { id: string }).id === owner) {
        workspace.files.delete(path);
      }
    },
  }); },
}));

import { resetMemoryWorkspace, textOf } from "./fixtures/memoryWorkspace";
import { GENERATION_MANIFEST_PATH, parseGenerationManifest } from "@/features/editor/export/generationManifest";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { TICKET_PROTOCOL_VERSION, TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH, type TicketRequest } from "@/features/editor/ticket/ticketProtocol";
import { AGENT_WAIT_WINDOW_MS } from "@/features/editor/ui/agentRequestWait";
import { scanGeneratedCode } from "@/features/editor/ui/exportGeneratedCode";
import {
  cancelTicketRun,
  answerOverwriteReview,
  extendTicketWait,
  runAllTickets,
  runOneTicket,
} from "@/features/editor/ui/ticketRunner";

import type { Action, ScreenSpec } from "@/features/editor/schema";
import { validateVisualSpec } from "@/features/editor/schema";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { ticketFilePath } from "@/features/editor/export/generatedPaths";
import { contentHash, inputFingerprint } from "@/features/editor/export/contentHash";
import { planTicketOutputs, commitTicketOutputs } from "@/features/editor/ui/ticketOutputAcceptance";

const HEADER = "components/Header.tsx";
const CARD = "components/Card.tsx";
const A_BYTES = "export function Header() { return <header>A — 취소된 요청</header>; }\n";
const B_BYTES = "export function Header() { return <header>B — 재시도 성공</header>; }\n";

function compileCurrent(): void {
  const { activePageId, spec } = useEditorStore.getState();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
}

function currentRequest(): TicketRequest {
  const text = textOf(workspace, TICKET_REQUEST_PATH);
  if (text === undefined) throw new Error("요청 파일이 없습니다");
  return JSON.parse(text) as TicketRequest;
}

/** 에이전트 흉내 — 요청에 실린 임시 출력 경로에 쓴다. */
function agentWrites(requestId: string, filePath: string, content: string): void {
  workspace.files.set(`staging/${requestId}/${filePath}`, content);
}

function agentResponds(requestId: string, results: { ticketId: string; status: "done" | "failed"; message?: string }[]): void {
  workspace.files.set(TICKET_RESPONSE_PATH, JSON.stringify({ protocol: TICKET_PROTOCOL_VERSION, requestId, results }));
}

function status(id: string) {
  return useTicketStore.getState().tickets.find((ticket) => ticket.id === id)?.status;
}

async function exportScan() {
  const { activePageId, spec } = useEditorStore.getState();
  const scan = await scanGeneratedCode(spec.pages[activePageId], activePageId);
  if (scan.kind !== "ready" || scan.freshness === null) throw new Error("Export 훑기 실패");
  const byTicket = Object.fromEntries(scan.freshness.tickets.map((entry) => [entry.ticketId, entry.freshness]));
  return { scan, freshness: scan.freshness, byTicket };
}

/** 폴링 한 회차(1초)를 돌린다. */
const tick = () => vi.advanceTimersByTimeAsync(1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  resetMemoryWorkspace(workspace);
  workspace.owner = null;
  useEditorStore.getState().loadSpec(seedSpec);
  useTicketStore.setState({
    tickets: [], sourcePageId: null, sourcePage: null, sourceDocumentId: null, isOpen: false,
    running: false, runError: null, runErrorRetryable: false, wait: null, acceptanceWarning: null, generation: 0,
  });
  compileCurrent();
});

afterEach(async () => {
  // 다음 시나리오로 폴링 루프가 새지 않게 끝낸다.
  cancelTicketRun();
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
});

describe("취소 A → 재시도 B 성공 → 늦은 A 응답/파일", () => {
  it("B만 확정하고, 늦은 A는 B 결과 바이트를 대체하지 않으며 Export는 B를 현재로 본다", async () => {
    // A: 요청을 쓰고 기다리다 취소한다
    const runA = runOneTicket("Header");
    await tick();
    const requestA = currentRequest();
    expect(requestA.tickets[0].outputPath).toBe(`staging/${requestA.id}/${HEADER}`);
    cancelTicketRun();
    await tick();
    await runA;
    expect(status("Header")).toBe("pending");
    expect(workspace.files.has(TICKET_REQUEST_PATH)).toBe(false); // 잠금 해제와 함께 지워진다

    // B: 수동 재시도는 새 요청 ID다
    const runB = runOneTicket("Header");
    await tick();
    const requestB = currentRequest();
    expect(requestB.id).not.toBe(requestA.id);

    // B 대기 중 늦은 A 응답이 먼저 와도 B는 그것을 받지 않고 계속 기다린다
    agentWrites(requestA.id, HEADER, A_BYTES);
    agentResponds(requestA.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    expect(useTicketStore.getState().running).toBe(true);
    expect(status("Header")).toBe("in-progress");
    expect(workspace.files.has(`generated/${HEADER}`)).toBe(false);

    agentWrites(requestB.id, HEADER, B_BYTES);
    agentResponds(requestB.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await runB;

    // 티켓 상태
    expect(status("Header")).toBe("done");
    expect(useTicketStore.getState().running).toBe(false);
    // Export 수용
    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES);
    const manifest = parseGenerationManifest(textOf(workspace, GENERATION_MANIFEST_PATH) ?? null);
    expect(manifest.entries[HEADER]?.requestId).toBe(requestB.id);

    // B 확정 뒤 A가 또 늦게 쓴다(응답·파일) — 아무도 확정하지 않는다
    agentWrites(requestA.id, HEADER, `${A_BYTES}// 더 늦은 쓰기\n`);
    agentResponds(requestA.id, [{ ticketId: "Header", status: "done" }]);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES); // B 바이트 보존
    expect(status("Header")).toBe("done");
    const { byTicket, freshness } = await exportScan();
    expect(byTicket.Header).toBe("current");
    // 나머지 티켓은 아직 없다 — 4/4 성공이 아니다
    expect(freshness.overall).toBe("partial");
  });

  it("규약을 무시하고 늦은 A가 generated/에 직접 써도 현재 성공으로 보이지 않는다(감지)", async () => {
    const run = runOneTicket("Header");
    await tick();
    const request = currentRequest();
    agentWrites(request.id, HEADER, B_BYTES);
    agentResponds(request.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await run;

    workspace.files.set(`generated/${HEADER}`, A_BYTES); // 구버전 스킬·외부 writer

    // 티켓 상태는 B 수용 그대로다
    expect(status("Header")).toBe("done");
    // Export는 파일·참조 검사와 별개로 확인 불가를 낸다
    const { scan, byTicket, freshness } = await exportScan();
    expect(scan.report.coverage.find((entry) => entry.ticketId === "Header")?.found).toBe(true);
    expect(byTicket.Header).toBe("changed");
    expect(freshness.overall).toBe("unverifiable");
  });

  it("4/4 파일이 모두 있어도 수용 기록이 없으면(취소된 요청의 늦은 직접 쓰기 재현) Export는 확인 불가다", async () => {
    // 감사 재현: 요청을 취소한 뒤 외부 writer가 네 파일을 늦게 썼다
    const run = runAllTickets();
    await tick();
    cancelTicketRun();
    await tick();
    await run;
    for (const ticket of useTicketStore.getState().tickets) {
      const dir = ticket.kind === "page" ? "pages" : "components";
      workspace.files.set(`generated/${dir}/${ticket.componentName}.tsx`, `export function ${ticket.componentName}() { return null; }\n`);
    }

    // 티켓 상태: 모두 pending
    expect(useTicketStore.getState().tickets.every((ticket) => ticket.status === "pending")).toBe(true);
    // Export: 파일·참조로는 4/4지만 생성 세대는 확인 불가
    const { scan, freshness } = await exportScan();
    expect(scan.report.coveredCount).toBe(scan.report.coverage.length);
    expect(freshness.overall).toBe("unverifiable");
  });
});

describe("일부 파일만 도착", () => {
  it("완료 응답이어도 임시 출력이 빠지면 웨이브 전체를 보존한다", async () => {
    const run = runAllTickets();
    await tick();
    const request = currentRequest();
    expect(request.tickets.map((ticket) => ticket.id).sort()).toEqual(["Card", "Header"]);
    agentWrites(request.id, HEADER, B_BYTES); // Card는 아직 안 썼다
    agentResponds(request.id, [
      { ticketId: "Header", status: "done" },
      { ticketId: "Card", status: "done" },
    ]);
    await tick();
    await run;

    // 티켓 상태
    expect(status("Header")).toBe("failed");
    expect(status("Card")).toBe("failed");
    expect(useTicketStore.getState().tickets.find((ticket) => ticket.id === "Card")?.error).toContain("임시 출력");
    expect(status("Content")).toBe("pending"); // 실패한 Card에 의존 — 다음 웨이브로 가지 않는다

    // Card가 늦게 도착해도 확정되지 않는다
    agentWrites(request.id, CARD, "export function Card() { return null; }\n");
    await vi.advanceTimersByTimeAsync(5000);
    expect(workspace.files.has(`generated/${CARD}`)).toBe(false);

    // Export 수용
    const { byTicket, freshness } = await exportScan();
    expect(byTicket.Header).toBe("missing");
    expect(byTicket.Card).toBe("missing");
    expect(freshness.overall).toBe("missing");
  });

  it("취소된 요청의 일부 파일이 늦게 와도 아무것도 확정하지 않는다", async () => {
    const run = runAllTickets();
    await tick();
    const request = currentRequest();
    cancelTicketRun();
    await tick();
    await run;
    agentWrites(request.id, HEADER, A_BYTES);
    agentResponds(request.id, [{ ticketId: "Header", status: "done" }, { ticketId: "Card", status: "done" }]);
    await vi.advanceTimersByTimeAsync(5000);

    expect(status("Header")).toBe("pending");
    expect(workspace.files.has(`generated/${HEADER}`)).toBe(false);
    expect((await exportScan()).freshness.overall).toBe("missing");
  });
});

describe("같은 경로 재컴파일", () => {
  it("재컴파일 전 요청의 응답은 버리고 확정하지 않으며, 같은 경로의 새 요청 출력만 현재가 된다", async () => {
    const runA = runOneTicket("Header");
    await tick();
    const requestA = currentRequest();
    // 편집 후 다시 생성 — 패널 버튼과 달리 취소 없이 재컴파일되는 경로도 막혀야 한다
    useEditorStore.getState().setNodeField("headerTitle", "content", "편집된 제목");
    compileCurrent();
    agentWrites(requestA.id, HEADER, A_BYTES);
    agentResponds(requestA.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await runA;

    // 티켓 상태: 새 계획은 건드리지 않는다
    expect(status("Header")).toBe("pending");
    // Export 수용: A 출력은 generated/에 닿지 않는다
    expect(workspace.files.has(`generated/${HEADER}`)).toBe(false);

    const runB = runOneTicket("Header");
    await tick();
    const requestB = currentRequest();
    expect(requestB.id).not.toBe(requestA.id);
    expect(JSON.stringify(requestB.page)).toContain("편집된 제목");
    agentWrites(requestB.id, HEADER, B_BYTES);
    agentResponds(requestB.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await runB;

    // 늦은 A 파일이 같은 경로로 또 와도 B가 남는다
    agentWrites(requestA.id, HEADER, `${A_BYTES}// late\n`);
    await vi.advanceTimersByTimeAsync(5000);
    expect(status("Header")).toBe("done");
    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES);
    expect((await exportScan()).byTicket.Header).toBe("current");
  });

  it("확정 뒤 스펙을 바꾸면 B 바이트는 남고 Export는 오래됨으로 본다(보존과 최신성은 별개)", async () => {
    const run = runOneTicket("Header");
    await tick();
    const request = currentRequest();
    agentWrites(request.id, HEADER, B_BYTES);
    agentResponds(request.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await run;

    useEditorStore.getState().setNodeField("headerTitle", "content", "확정 뒤 편집");

    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES);
    expect((await exportScan()).byTicket.Header).toBe("stale");
  });
});

describe("끊김 → 복구", () => {
  it("대기 중 연결이 끊기면 단계가 connectionLost로 보이고, 복구 뒤 같은 요청의 응답을 확정한다", async () => {
    const run = runOneTicket("Header");
    await tick();
    const request = currentRequest();
    expect(useTicketStore.getState().wait?.phase).toBe("waiting");

    workspace.offline = true;
    await vi.advanceTimersByTimeAsync(5000);
    expect(useTicketStore.getState().wait?.phase).toBe("connectionLost");
    expect(useTicketStore.getState().running).toBe(true);

    workspace.offline = false;
    agentWrites(request.id, HEADER, B_BYTES);
    agentResponds(request.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await run;

    expect(status("Header")).toBe("done");
    expect(useTicketStore.getState().wait).toBeNull();
    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES);
    expect((await exportScan()).byTicket.Header).toBe("current");
  });
});

describe("timeout → 연장 / 재시도", () => {
  it("연장하면 같은 요청을 계속 기다리고, 만료 뒤에는 연장이 거절되며 늦은 출력은 확정되지 않는다", async () => {
    const run = runOneTicket("Header");
    await tick();
    const requestA = currentRequest();

    await vi.advanceTimersByTimeAsync(170_000);
    expect(extendTicketWait()).toBe(true);
    expect(extendTicketWait()).toBe(true); // 중복 클릭
    await vi.advanceTimersByTimeAsync(30_000); // 원래 기한을 넘긴다
    expect(useTicketStore.getState().running).toBe(true);
    expect(currentRequest().id).toBe(requestA.id);

    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS);
    await run;
    // 티켓 상태: timeout은 재시도 안내가 붙는 실패이고 티켓은 대기로 돌아간다
    expect(useTicketStore.getState().runError).toContain("대기 시간");
    expect(useTicketStore.getState().runErrorRetryable).toBe(true);
    expect(status("Header")).toBe("pending");
    expect(extendTicketWait()).toBe(false);

    // 만료된 요청의 늦은 출력
    agentWrites(requestA.id, HEADER, A_BYTES);
    agentResponds(requestA.id, [{ ticketId: "Header", status: "done" }]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(workspace.files.has(`generated/${HEADER}`)).toBe(false);

    // 재시도는 새 요청이며 그 출력만 확정된다
    const retry = runOneTicket("Header");
    await tick();
    const requestB = currentRequest();
    expect(requestB.id).not.toBe(requestA.id);
    agentWrites(requestB.id, HEADER, B_BYTES);
    agentResponds(requestB.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    await retry;

    expect(status("Header")).toBe("done");
    expect(useTicketStore.getState().runError).toBeNull();
    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES);
    expect((await exportScan()).byTicket.Header).toBe("current");
  });
});


describe("승격 중 재진입 회귀", () => {
  it("임시 파일 읽기 동안 잠금을 유지하고 Stop 이후 다음 웨이브를 보내지 않는다", async () => {
    const run = runAllTickets();
    await tick();
    const request = currentRequest();
    for (const item of request.tickets) agentWrites(request.id, item.filePath, B_BYTES);
    workspace.afterWrite = (path) => { if (path.startsWith("generated/")) cancelTicketRun(); };
    agentResponds(request.id, request.tickets.map((item) => ({ ticketId: item.id, status: "done" })));
    await tick();
    await run;
    expect(status("Content")).toBe("pending");
    expect(workspace.files.has(TICKET_REQUEST_PATH)).toBe(false);
    expect(useTicketStore.getState().running).toBe(false);
  });

  it.each(["cancel", "compile", "lost"])("지연된 staging 읽기 중 %s이면 이전 정상 파일을 보존한다", async (action) => {
    workspace.files.set(`generated/${HEADER}`, B_BYTES);
    const run = runOneTicket("Header");
    await tick();
    const request = currentRequest();
    let resume!: () => void;
    const barrier = new Promise<void>((resolve) => { resume = resolve; });
    workspace.beforeRead = async (path) => {
      if (path.startsWith("staging/")) {
        expect(workspace.owner).toBe(request.id);
        await barrier;
      }
    };
    agentWrites(request.id, HEADER, A_BYTES);
    agentResponds(request.id, [{ ticketId: "Header", status: "done" }]);
    await tick();
    if (action === "cancel") cancelTicketRun();
    if (action === "compile") compileCurrent();
    if (action === "lost") workspace.owner = "newer-tab";
    resume();
    await run;
    expect(workspace.files.get(`generated/${HEADER}`)).toBe(B_BYTES);
    expect(workspace.files.has(GENERATION_MANIFEST_PATH)).toBe(false);
    if (action === "cancel") {
      expect(status("Header")).toBe("pending");
      workspace.beforeRead = undefined;
      const retry = runOneTicket("Header");
      await tick();
      const next = currentRequest();
      expect(next.id).not.toBe(request.id);
      agentWrites(next.id, HEADER, B_BYTES);
      agentResponds(next.id, [{ ticketId: "Header", status: "done" }]);
      await tick();
      answerOverwriteReview({ [HEADER]: "overwrite" });
      await tick();
      await retry;
      expect(status("Header")).toBe("done");
    }
  });

  it.each([
    [{ ticketId: "Header", status: "done" as const }, { ticketId: "Header", status: "failed" as const }],
    [{ ticketId: "Header", status: "done" as const }, { ticketId: "Content", status: "done" as const }],
    [],
  ])("중복·예상 밖·누락 응답은 확정 전에 거절한다: %j", async (...results) => {
    const run = runOneTicket("Header");
    await tick();
    const request = currentRequest();
    agentWrites(request.id, HEADER, A_BYTES);
    agentResponds(request.id, results);
    await tick();
    await run;
    expect(workspace.files.has(`generated/${HEADER}`)).toBe(false);
    expect(workspace.files.has(GENERATION_MANIFEST_PATH)).toBe(false);
    expect(status("Header")).not.toBe("in-progress");
    expect(status("Content")).toBe("pending");
  });
});

// S1-1 stores relation shapes, but generation is not supported until S1-2/S1-8/9.


function relationPage(action?: Action): ScreenSpec {
  const page = structuredClone(seedSpec.screen);
  const title = page.nodes.headerTitle;
  if (title.type !== "text") throw new Error("fixture");
  page.nodes.headerTitle = { ...title, type: "button", ...(action ? { action } : {}) };
  return page;
}

const unsupportedPages: [string, ScreenSpec][] = [
  ["navigate dangling target", relationPage({ type: "navigate", target: "missing" })],
  ["openModal", relationPage({ type: "openModal", target: "missing" })],
  ["close on page", relationPage({ type: "close" })],
  ["modal without actions", { ...relationPage(), kind: "modal" }],
  ["widget without actions", { ...relationPage(), kind: "widget" }],
  ["hidden action", (() => {
    const page = relationPage({ type: "navigate", target: "missing" });
    page.nodes.headerTitle.visible = false;
    return page;
  })()],
];

describe("S1-1 relation generation boundary", () => {
  it.each(unsupportedPages)("preserves raw import but refuses transmission: %s", async (_name, page) => {
    const spec = { version: "0.3" as const, screen: page };
    expect(validateVisualSpec(spec).valid).toBe(true);
    expect(parseSpecJson(JSON.stringify(spec))).toEqual({ ok: true, spec });
    useEditorStore.getState().loadSpec(spec);
    compileCurrent();
    const run = runAllTickets();
    await tick();
    expect(workspace.files.has(TICKET_REQUEST_PATH)).toBe(false);
    await run;
    expect(useTicketStore.getState().runError).toContain("아직 지원하지 않습니다");
    expect(useTicketStore.getState().runErrorRetryable).toBe(false);
    expect(useTicketStore.getState().tickets.every(ticket => ticket.status === "pending")).toBe(true);
    expect(useEditorStore.getState().spec.pages[useEditorStore.getState().activePageId]).toEqual(page);
  });

  it.each(unsupportedPages)("rejects inert done outputs, including old requests: %s", async (_name, page) => {
    const tickets = compileTickets(page);
    for (const ticket of tickets) agentWrites("old", ticketFilePath(ticket), `export function ${ticket.componentName}() { return null; }`);
    const before = new Map(workspace.files);
    const plan = await planTicketOutputs({ requestId: "old", pageId: "home", page,
      projectKey: "relations.json", waveTickets: tickets,
      results: tickets.map(ticket => doneResultForRelation(ticket.id)) });
    workspace.owner = "old";
    const accepted = await commitTicketOutputs(plan, {}, { renew: async () => workspace.owner === "old" });
    expect(accepted.results.every(result => result.status === "failed" && result.message?.includes("아직 지원하지 않습니다"))).toBe(true);
    expect(plan.targets).toEqual([]);
    expect(workspace.files).toEqual(before);
  });

  it.each(unsupportedPages)("never reports old inert files as ready/current: %s", async (_name, page) => {
    const tickets = compileTickets(page);
    const entries = Object.fromEntries(tickets.map(ticket => {
      const path = ticketFilePath(ticket);
      const content = `export function ${ticket.componentName}() { return null; }`;
      workspace.files.set(`generated/${path}`, content);
      return [path, { requestId: "old", pageId: "home", ticketId: ticket.id,
        inputFingerprint: inputFingerprint("home", page), contentHash: contentHash(content),
        acceptedAt: "2026-10-10T00:00:00Z" }];
    }));
    workspace.files.set(GENERATION_MANIFEST_PATH, JSON.stringify({ protocol: 1, entries }));
    const scan = await scanGeneratedCode(page, "home");
    expect(scan).toMatchObject({ kind: "unsupported" });
    expect(await scanGeneratedCode(page)).toMatchObject({ kind: "unsupported" });
  });

  it.each([undefined, "page"] as const)("ordinary page (%s) still completes real runner → acceptance → Export", async kind => {
    const page = relationPage();
    if (kind) page.kind = kind;
    useEditorStore.getState().loadSpec({ version: "0.3", screen: page });
    compileCurrent();
    const run = runAllTickets();
    await tick();
    for (let wave = 0; useTicketStore.getState().running && wave < 10; wave++) {
      const request = currentRequest();
      for (const ticket of request.tickets) agentWrites(request.id, ticket.filePath, `export function ${ticket.componentName}() { return null; }`);
      agentResponds(request.id, request.tickets.map(ticket => doneResultForRelation(ticket.id)));
      await tick();
    }
    await run;
    expect(useTicketStore.getState().tickets.every(ticket => ticket.status === "done")).toBe(true);
    const { scan, freshness } = await exportScan();
    expect(scan.report.errorCount).toBe(0);
    expect(scan.report.coveredCount).toBe(scan.report.coverage.length);
    expect(freshness.overall).toBe("current");
  });
});

function doneResultForRelation(ticketId: string) { return { ticketId, status: "done" as const }; }
