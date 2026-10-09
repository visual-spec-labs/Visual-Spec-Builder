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
  files: new Map<string, string>(),
  offline: false,
  beforeRead: null as null | ((path: string) => Promise<void>),
  afterWrite: null as null | ((path: string) => void),
  owner: null as string | null,
}));

vi.mock("@/features/editor/ui/workspaceClient", () => {
  function list(dir: string, options: { recursive?: boolean } = {}) {
    if (workspace.offline) return null;
    const prefix = `${dir}/`;
    return [...workspace.files.keys()]
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
      .filter((path) => options.recursive === true || !path.includes("/"));
  }
  return {
    isWorkspaceAvailable: async () => !workspace.offline,
    listWorkspaceFiles: async (dir: string, options?: { recursive?: boolean }) => list(dir, options),
    readWorkspaceTextFile: async (path: string) => (workspace.offline ? null : workspace.files.get(path) ?? null),
    readWorkspaceTextFileStrict: async (path: string) => {
      await workspace.beforeRead?.(path);
      return workspace.offline ? { ok: false } : { ok: true, text: workspace.files.get(path) ?? null };
    },
    readWorkspaceBinaryFile: async () => null,
    writeWorkspaceFile: async (path: string, body: string) => {
      if (workspace.offline) return { ok: false, error: "fetch failed" };
      workspace.files.set(path, body);
      workspace.afterWrite?.(path);
      return { ok: true, path };
    },
  };
});

// 서버 잠금(`workspace/requestLock.ts`)처럼 풀 때 요청 id가 주인과 같은 요청 파일만 지운다.
vi.mock("@/features/editor/ui/agentRequestLock", () => ({
  holdRequestLock: async (kind: string, owner: string) => {
    workspace.owner = owner;
    return ({
    renew: async () => workspace.owner === owner,
    release: () => {
      if (workspace.owner !== owner) return;
      workspace.owner = null;
      const path = `runtime/${kind}-request.json`;
      const request = workspace.files.get(path);
      if (request !== undefined && (JSON.parse(request) as { id: string }).id === owner) {
        workspace.files.delete(path);
      }
    },
  }); },
}));

import { GENERATION_MANIFEST_PATH, parseGenerationManifest } from "@/features/editor/export/generationManifest";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { TICKET_PROTOCOL_VERSION, TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH, type TicketRequest } from "@/features/editor/ticket/ticketProtocol";
import { AGENT_WAIT_WINDOW_MS } from "@/features/editor/ui/agentRequestWait";
import { scanGeneratedCode } from "@/features/editor/ui/exportGeneratedCode";
import {
  cancelTicketRun,
  extendTicketWait,
  runAllTickets,
  runOneTicket,
} from "@/features/editor/ui/ticketRunner";

const HEADER = "components/Header.tsx";
const CARD = "components/Card.tsx";
const A_BYTES = "export function Header() { return <header>A — 취소된 요청</header>; }\n";
const B_BYTES = "export function Header() { return <header>B — 재시도 성공</header>; }\n";

function compileCurrent(): void {
  const { activePageId, spec } = useEditorStore.getState();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
}

function currentRequest(): TicketRequest {
  const text = workspace.files.get(TICKET_REQUEST_PATH);
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
  workspace.files.clear();
  workspace.offline = false;
  workspace.beforeRead = null;
  workspace.afterWrite = null;
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
    const manifest = parseGenerationManifest(workspace.files.get(GENERATION_MANIFEST_PATH) ?? null);
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
  it("완료 응답이어도 임시 출력이 없는 티켓은 실패로 바꾸고, 도착한 것만 확정한다", async () => {
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
    expect(status("Header")).toBe("done");
    expect(status("Card")).toBe("failed");
    expect(useTicketStore.getState().tickets.find((ticket) => ticket.id === "Card")?.error).toContain("임시 출력");
    expect(status("Content")).toBe("pending"); // 실패한 Card에 의존 — 다음 웨이브로 가지 않는다

    // Card가 늦게 도착해도 확정되지 않는다
    agentWrites(request.id, CARD, "export function Card() { return null; }\n");
    await vi.advanceTimersByTimeAsync(5000);
    expect(workspace.files.has(`generated/${CARD}`)).toBe(false);

    // Export 수용
    const { byTicket, freshness } = await exportScan();
    expect(byTicket.Header).toBe("current");
    expect(byTicket.Card).toBe("missing");
    expect(freshness.overall).toBe("partial");
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
