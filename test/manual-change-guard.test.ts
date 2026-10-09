import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 재생성 전 수동 변경 보호의 회귀 (이슈 #282, docs/26 "#282").
 *
 * **가상 시간 + 메모리 작업공간 fixture다.** 실제 실행기(`ui/ticketRunner.ts`)·확정
 * (`ui/ticketOutputAcceptance.ts`)·되돌리기를 그대로 돌리고, 작업공간 HTTP 클라이언트만 메모리
 * 구현(`fixtures/memoryWorkspace.ts`)으로 바꿨다. 그 구현은 서버처럼 `generated/`·`backups/`의 기대
 * 버전을 비교한다(서버 자체는 `workspace-middleware.test.ts`가 진짜 서버로 본다). 외부 에이전트와
 * 사람의 수동 수정은 테스트가 파일을 써서 흉내 낸다 — 실제 모델 실행이 아니다.
 *
 * 시나리오마다 같은 것을 단언한다: 수동 파일의 원본 바이트, 마지막 정상 결과의 바이트, 수용 기록,
 * 그리고 `generated/`에 실제로 일어난 쓰기(로그). "아무것도 쓰지 않았다"는 로그로 확인한다.
 */

const workspace = vi.hoisted(() => ({
  files: new Map<string, string | Uint8Array>(),
  offline: false,
  beforeWrite: null as ((path: string) => void) | null,
  failWrite: null as ((path: string) => string | null) | null,
  log: [] as string[],
  beforeRead: undefined as ((path: string) => void | Promise<void>) | undefined,
  afterWrite: undefined as ((path: string) => string | null | Promise<string | null>) | undefined,
}));

vi.mock("@/features/editor/ui/workspaceClient", async () =>
  (await import("./fixtures/memoryWorkspace")).memoryWorkspaceClient(workspace));

vi.mock("@/features/editor/ui/agentRequestLock", () => ({
  holdRequestLock: async (kind: string, owner: string) => ({
    renew: async () => true,
    release: () => {
      const path = `runtime/${kind}-request.json`;
      const request = workspace.files.get(path);
      if (typeof request === "string" && (JSON.parse(request) as { id: string }).id === owner) {
        workspace.files.delete(path);
      }
    },
  }),
}));

import { bytesOf, resetMemoryWorkspace, textOf } from "./fixtures/memoryWorkspace";
import { contentHash } from "@/features/editor/export/contentHash";
import {
  GENERATION_MANIFEST_PATH,
  parseGenerationManifest,
  type GenerationManifest,
} from "@/features/editor/export/generationManifest";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { TICKET_PROTOCOL_VERSION, TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH, type TicketRequest } from "@/features/editor/ticket/ticketProtocol";
import {
  answerOverwriteReview,
  cancelTicketRun,
  OVERWRITE_CANCELLED_MESSAGE,
  restoreLastRun,
  runAllTickets,
  runOneTicket,
} from "@/features/editor/ui/ticketRunner";

const HEADER = "components/Header.tsx";
const CARD = "components/Card.tsx";
const G_HEADER = `generated/${HEADER}`;
const G_CARD = `generated/${CARD}`;
/** 마지막 정상 생성(L). */
const L_HEADER = "export function Header() { return <header>L</header>; }\n";
const L_CARD = "export function Card() { return <div>L</div>; }\n";
/** 사람이 고친 Header(M). */
const M_HEADER = "export function Header() { return <header onClick={track}>L + 수동 로직</header>; }\n";
/** 새 요청의 출력(N). */
const N_HEADER = "export function Header() { return <header>N</header>; }\n";
const N_CARD = "export function Card() { return <div>N</div>; }\n";
/** 생성과 무관한 사용자 파일 — 대조군. */
const EXTRA = "generated/components/Extra.tsx";
const EXTRA_BYTES = "export function Extra() { return null; }\n";

const PATH_TO_TICKET: Record<string, string> = { [HEADER]: "Header", [CARD]: "Card" };

function compileCurrent(): void {
  const { activePageId, spec } = useEditorStore.getState();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
}

function currentRequest(): TicketRequest {
  const text = textOf(workspace, TICKET_REQUEST_PATH);
  if (text === undefined) throw new Error("요청 파일이 없습니다");
  return JSON.parse(text) as TicketRequest;
}

function respond(requestId: string, outputs: Record<string, string>): void {
  for (const [path, content] of Object.entries(outputs)) workspace.files.set(`staging/${requestId}/${path}`, content);
  workspace.files.set(TICKET_RESPONSE_PATH, JSON.stringify({
    protocol: TICKET_PROTOCOL_VERSION,
    requestId,
    results: Object.keys(outputs).map((path) => ({ ticketId: PATH_TO_TICKET[path], status: "done" })),
  }));
}

function manifest(): GenerationManifest {
  return parseGenerationManifest(textOf(workspace, GENERATION_MANIFEST_PATH) ?? null);
}

function status(id: string) {
  return useTicketStore.getState().tickets.find((ticket) => ticket.id === id);
}

/** `generated/`에 일어난 쓰기·지우기(백업·기록 제외). */
function generatedWrites(): string[] {
  return workspace.log.filter((entry) => entry.includes(" generated/"));
}

const tick = () => vi.advanceTimersByTimeAsync(1000);

/**
 * 진행 중인 실행을 끝낸다. 먼저 적용(확정)이 끝나게 둔 뒤, 다음 웨이브 요청이 나가 있으면 취소한다 —
 * 답한 직후 같은 틱에 "중지"하면 그 답도 취소로 본다(`ticketRunner.runWave`).
 */
async function finish(run: Promise<void>): Promise<void> {
  await vi.advanceTimersByTimeAsync(500);
  cancelTicketRun();
  await vi.advanceTimersByTimeAsync(2000);
  await run;
}

/**
 * 시작 상태: 1차 생성으로 Header·Card가 L로 확정·기록되고, 사람이 Header를 M으로 고쳤다.
 * 그 뒤 스펙을 고치고 티켓을 다시 만든다(후속 수정 → 재생성 흐름).
 */
async function seedLastGoodAndManualEdit(): Promise<{ firstRequestId: string }> {
  const run = runAllTickets();
  await tick();
  const first = currentRequest();
  respond(first.id, { [HEADER]: L_HEADER, [CARD]: L_CARD });
  await tick();
  await finish(run);
  expect(textOf(workspace, G_HEADER)).toBe(L_HEADER);
  expect(manifest().entries[HEADER]?.projectKey).toBe("shop.json");

  workspace.files.set(G_HEADER, M_HEADER); // 사람의 수동 수정
  workspace.files.set(EXTRA, EXTRA_BYTES);
  useEditorStore.getState().setNodeField("headerTitle", "content", "후속 수정");
  compileCurrent();
  workspace.log.length = 0;
  return { firstRequestId: first.id };
}

/** 2차 요청을 보내고 N을 응답한 뒤 쓰기 전 확인이 뜰 때까지 진행한다. */
async function secondRoundToReview(outputs: Record<string, string> = { [HEADER]: N_HEADER, [CARD]: N_CARD }) {
  const run = runAllTickets();
  await tick();
  const request = currentRequest();
  respond(request.id, outputs);
  await tick();
  return { run, request };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  resetMemoryWorkspace(workspace);
  useEditorStore.getState().loadSpec(seedSpec);
  useDocumentStore.setState({ fileName: "shop.json" });
  useTicketStore.setState({
    tickets: [], sourcePageId: null, sourcePage: null, sourceDocumentId: null, isOpen: false,
    running: false, runError: null, runErrorRetryable: false, wait: null, acceptanceWarning: null,
    overwriteReview: null, lastRun: null, restoreMessage: null, generation: 0,
  });
  compileCurrent();
});

afterEach(async () => {
  cancelTicketRun();
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
});

describe("쓰기 전 감지와 영향 목록", () => {
  it("수동 수정 파일이 있으면 쓰기 전에 멈추고 영향 목록·diff 재료를 보인다 — 그때까지 generated/는 그대로다", async () => {
    const { firstRequestId } = await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();

    const review = useTicketStore.getState().overwriteReview;
    expect(review).not.toBeNull();
    const byPath = Object.fromEntries(review!.items.map((item) => [item.path, item]));
    expect(byPath[HEADER]?.ownership).toBe("modified");
    expect(byPath[CARD]?.ownership).toBe("owned");
    // 수동 변경 diff: 마지막 생성(1차 요청의 임시 출력, 해시 확인) → 지금 파일
    expect(byPath[HEADER]?.baselineText).toBe(L_HEADER);
    expect(byPath[HEADER]?.currentText).toBe(M_HEADER);
    expect(byPath[HEADER]?.nextText).toBe(N_HEADER);
    expect(workspace.files.has(`staging/${firstRequestId}/${HEADER}`)).toBe(true);
    // 아직 아무것도 쓰지 않았다
    expect(generatedWrites()).toEqual([]);
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);

    answerOverwriteReview("cancel");
    await run;
  });

  it("마지막 생성 그대로인 파일만 있으면 묻지 않고 바꾸되 백업과 되돌리기 기록을 남긴다(정상 재생성 경로)", async () => {
    await seedLastGoodAndManualEdit();
    workspace.files.set(G_HEADER, L_HEADER); // 수동 수정을 없던 일로
    workspace.log.length = 0;
    const { run } = await secondRoundToReview();

    expect(useTicketStore.getState().overwriteReview).toBeNull();
    await finish(run);
    expect(textOf(workspace, G_HEADER)).toBe(N_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(N_CARD);
    const lastRun = useTicketStore.getState().lastRun;
    expect(lastRun?.paths.sort()).toEqual([CARD, HEADER]);
    expect(textOf(workspace, `${lastRun!.backupRoot}/files/${HEADER}`)).toBe(L_HEADER);
    expect(textOf(workspace, `${lastRun!.backupRoot}/files/${CARD}`)).toBe(L_CARD);
    expect(status("Header")?.status).toBe("done");
  });

  it("기록 없는 기존 파일은 생성기 소유로 추정하지 않는다 — 처음 생성이어도 확인을 거친다", async () => {
    workspace.files.set(G_HEADER, M_HEADER); // 직접 실행한 to-react·사람이 만든 파일
    const run = runOneTicket("Header");
    await tick();
    respond(currentRequest().id, { [HEADER]: N_HEADER });
    await tick();

    expect(useTicketStore.getState().overwriteReview?.items[0]?.ownership).toBe("unowned");
    answerOverwriteReview({}); // 아무것도 고르지 않으면 보존이다
    await run;
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(generatedWrites()).toEqual([]);
    expect(status("Header")?.status).toBe("failed");
    expect(status("Header")?.error).toContain("보존");
    expect(manifest().entries[HEADER]).toBeUndefined();
  });

  it("다른 프로젝트·이름 바꾼 프로젝트의 기록은 해시가 맞아도 이 프로젝트의 마지막 생성으로 보지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    workspace.files.set(G_HEADER, L_HEADER);
    useDocumentStore.setState({ fileName: "shop-copy.json" }); // 복사본·이름 변경·같은 이름의 다른 프로젝트
    const { run } = await secondRoundToReview();

    const kinds = useTicketStore.getState().overwriteReview?.items.map((item) => item.ownership);
    expect(kinds).toEqual(["foreign", "foreign"]);
    answerOverwriteReview("cancel");
    await run;
    expect(textOf(workspace, G_HEADER)).toBe(L_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
  });
});

describe("성공 대조군 — 선택한 범위만 바뀐다", () => {
  it("Header 보존 · Card 교체: Header는 M 바이트 그대로, Card만 N, 생성과 무관한 파일은 그대로", async () => {
    await seedLastGoodAndManualEdit();
    const before = manifest();
    const { run } = await secondRoundToReview();
    answerOverwriteReview({ [HEADER]: "keep" });
    await finish(run);

    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(N_CARD);
    expect(textOf(workspace, EXTRA)).toBe(EXTRA_BYTES);
    expect(generatedWrites()).toEqual([`PUT ${G_CARD}`]);
    // 기록: 보존한 Header는 1차 기록 그대로, Card만 새 요청
    expect(manifest().entries[HEADER]).toEqual(before.entries[HEADER]);
    expect(manifest().entries[CARD]?.contentHash).toBe(contentHash(N_CARD));
    expect(status("Header")?.status).toBe("failed");
    expect(status("Card")?.status).toBe("done");
  });

  it("Header 백업 후 덮어쓰기: 백업은 M 원본 바이트이고 되돌리면 M과 L이 그대로 돌아온다", async () => {
    await seedLastGoodAndManualEdit();
    const before = manifest();
    const { run } = await secondRoundToReview();
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);

    expect(textOf(workspace, G_HEADER)).toBe(N_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(N_CARD);
    const lastRun = useTicketStore.getState().lastRun!;
    expect(textOf(workspace, `${lastRun.backupRoot}/files/${HEADER}`)).toBe(M_HEADER);

    await restoreLastRun();
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
    expect(textOf(workspace, EXTRA)).toBe(EXTRA_BYTES);
    expect(manifest().entries).toEqual(before.entries);
    expect(useTicketStore.getState().restoreMessage).toContain("2개 파일을 되돌렸습니다");
    expect(status("Header")?.status).toBe("pending");
  });

  it("BOM이 있는 수동 파일도 바이트 그대로 백업하고 되돌린다", async () => {
    await seedLastGoodAndManualEdit();
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytesOf(M_HEADER)]);
    workspace.files.set(G_HEADER, withBom);
    const { run } = await secondRoundToReview();
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);

    const backup = workspace.files.get(`${useTicketStore.getState().lastRun!.backupRoot}/files/${HEADER}`);
    expect(bytesOf(backup!)).toEqual(withBom);
    await restoreLastRun();
    expect(bytesOf(workspace.files.get(G_HEADER)!)).toEqual(withBom);
  });
});

describe("실패·취소에서 원본 보존", () => {
  it("여러 파일 중 두 번째 쓰기가 실패하면 첫 파일을 되돌려 M과 L이 그대로이고 기록도 바뀌지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const before = manifest();
    const seedRun = useTicketStore.getState().lastRun;
    const { run } = await secondRoundToReview();
    workspace.failWrite = (path) => (path === G_CARD ? "디스크가 가득 찼습니다" : null);
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);

    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER); // 수동 원본 바이트
    expect(textOf(workspace, G_CARD)).toBe(L_CARD); // 마지막 정상 결과
    expect(generatedWrites()).toEqual([`PUT ${G_HEADER}`, `PUT ${G_HEADER}`]); // 쓰고 → 되돌림
    expect(manifest().entries).toEqual(before.entries);
    expect(status("Header")?.status).toBe("failed");
    expect(status("Card")?.status).toBe("failed");
    expect(status("Card")?.error).toContain("되돌렸습니다");
    // 중단한 적용은 되돌리기 대상이 아니다 — 마지막 성공 적용(1차)이 그대로 남는다
    expect(useTicketStore.getState().lastRun).toEqual(seedRun);
  });

  it("백업이 실패하면 아무 파일도 바꾸지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const before = manifest();
    const { run } = await secondRoundToReview();
    workspace.failWrite = (path) => (path.startsWith("backups/") && path.endsWith(HEADER) ? "권한이 없습니다" : null);
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);

    expect(generatedWrites()).toEqual([]);
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
    expect(manifest().entries).toEqual(before.entries);
    expect(status("Header")?.error).toContain("백업에 실패");
  });

  it("확인 화면에서 전체 취소하거나 중지하면 아무것도 쓰지 않고 티켓은 대기로 돌아간다", async () => {
    await seedLastGoodAndManualEdit();
    const first = await secondRoundToReview();
    answerOverwriteReview("cancel");
    await first.run;
    expect(useTicketStore.getState().runError).toBe(OVERWRITE_CANCELLED_MESSAGE);
    expect(status("Header")?.status).toBe("pending");

    const second = await secondRoundToReview();
    cancelTicketRun(); // 헤더의 "중지"
    await second.run;

    expect(generatedWrites()).toEqual([]);
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
    expect(status("Card")?.status).toBe("pending");
  });

  it("취소 A → 재시도 B → 늦은 A 출력: B만 확인·적용되고 A는 어디에도 확정되지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const A_BYTES = "export function Header() { return <header>A — 취소된 요청</header>; }\n";
    const runA = runOneTicket("Header");
    await tick();
    const requestA = currentRequest();
    cancelTicketRun();
    await tick();
    await runA;

    const runB = runOneTicket("Header");
    await tick();
    const requestB = currentRequest();
    respond(requestB.id, { [HEADER]: N_HEADER });
    await tick();
    expect(useTicketStore.getState().overwriteReview?.requestId).toBe(requestB.id);

    // 확인을 기다리는 사이 늦은 A 응답·임시 출력이 온다
    respond(requestA.id, { [HEADER]: A_BYTES });
    await vi.advanceTimersByTimeAsync(5000);
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);

    answerOverwriteReview({ [HEADER]: "overwrite" });
    await runB;
    expect(textOf(workspace, G_HEADER)).toBe(N_HEADER);
    expect(textOf(workspace, `${useTicketStore.getState().lastRun!.backupRoot}/files/${HEADER}`)).toBe(M_HEADER);
    expect(manifest().entries[HEADER]?.requestId).toBe(requestB.id);

    // B 적용 뒤에도 A가 또 늦게 쓴다 — 아무도 확정하지 않는다
    respond(requestA.id, { [HEADER]: `${A_BYTES}// 더 늦은 쓰기\n` });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(textOf(workspace, G_HEADER)).toBe(N_HEADER);
    expect(generatedWrites()).toEqual([`PUT ${G_HEADER}`]);
  });
});

describe("확인 뒤 재수정 경쟁", () => {
  it("확인 화면을 본 뒤 사람이 파일을 또 고치면 적용 직전 재비교에서 멈추고 아무것도 쓰지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();
    const M2 = `${M_HEADER}// 확인 화면을 본 뒤 고침\n`;
    workspace.files.set(G_HEADER, M2);
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);

    expect(generatedWrites()).toEqual([]);
    expect(textOf(workspace, G_HEADER)).toBe(M2);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
    expect(status("Header")?.error).toContain("확인한 뒤");
  });

  it("재비교 뒤·쓰기 직전에 바뀌면 서버 비교가 막고, 이미 쓴 파일은 되돌린다", async () => {
    await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();
    const M2_CARD = "export function Card() { return <div>쓰기 직전 수정</div>; }\n";
    workspace.beforeWrite = (path) => {
      if (path === G_CARD) {
        workspace.files.set(G_CARD, M2_CARD);
        workspace.beforeWrite = null;
      }
    };
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);

    expect(textOf(workspace, G_CARD)).toBe(M2_CARD); // 더 새로운 수정을 덮지 않았다
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER); // 이미 쓴 Header는 되돌렸다
    expect(status("Card")?.error).toContain("확인한 뒤 파일이 바뀌었습니다");
  });

  it("되돌리기는 적용 뒤 다시 고친 파일을 덮지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);
    const M3_CARD = "export function Card() { return <div>적용 뒤 수정</div>; }\n";
    workspace.files.set(G_CARD, M3_CARD);

    await restoreLastRun();
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(M3_CARD);
    expect(useTicketStore.getState().restoreMessage).toContain(CARD);
    expect(manifest().entries[CARD]?.contentHash).toBe(contentHash(N_CARD)); // 되돌리지 않은 파일의 기록은 그대로
  });

  it("되돌리는 중에 파일이 바뀌어도 서버 비교가 막아 더 새로운 수정이 남는다", async () => {
    await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);
    const M4 = `${N_HEADER}// 되돌리기 도중 수정\n`;
    workspace.beforeWrite = (path) => {
      if (path === G_HEADER) {
        workspace.files.set(G_HEADER, M4);
        workspace.beforeWrite = null;
      }
    };

    await restoreLastRun();
    expect(textOf(workspace, G_HEADER)).toBe(M4);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD); // 다른 파일은 정상적으로 되돌렸다
    expect(useTicketStore.getState().restoreMessage).toContain(HEADER);
  });
});


describe("await 경계와 불확실한 전송 결과", () => {
  it.each(["planning", "backup", "revalidate"].flatMap((phase) => ["stop", "compile"].map((action) => ({ phase, action }))))("$phase 대기 중 $action은 출력 쓰기를 막는다", async ({ phase, action }) => {
    const stop = () => action === "stop" ? cancelTicketRun() : compileCurrent();
    await seedLastGoodAndManualEdit();
    const original = phase === "planning" ? L_HEADER : M_HEADER;
    workspace.files.set(G_HEADER, original);
    const run = runOneTicket("Header");
    await tick();
    let reads = 0;
    workspace.beforeRead = (path) => {
      if (path === G_HEADER && ++reads === (phase === "planning" ? 1 : 2)) {
        if (phase !== "backup") stop();
      }
    };
    workspace.afterWrite = (path) => {
      if (phase === "backup" && path.startsWith("backups/")) stop();
      return null;
    };
    respond(currentRequest().id, { [HEADER]: N_HEADER });
    await tick();
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await tick();
    await run;
    expect(textOf(workspace, G_HEADER)).toBe(original);
    expect(generatedWrites()).toEqual([]);
  });

  it("재컴파일은 review resolver를 끝내고 새 확인을 건드리지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();
    compileCurrent();
    await run;
    expect(useTicketStore.getState().overwriteReview).toBeNull();
    expect(generatedWrites()).toEqual([]);
    const next = await secondRoundToReview();
    expect(useTicketStore.getState().overwriteReview?.requestId).toBe(next.request.id);
    answerOverwriteReview("cancel");
    await next.run;
  });

  it("PUT 반영 뒤 응답 유실도 현재 파일까지 원본 BOM 바이트로 보상한다", async () => {
    await seedLastGoodAndManualEdit();
    const original = new Uint8Array([239, 187, 191, ...bytesOf(M_HEADER)]);
    workspace.files.set(G_HEADER, original);
    const { run } = await secondRoundToReview();
    let lost = false;
    workspace.afterWrite = (path) => {
      if (path === G_HEADER && !lost) { lost = true; return "response lost"; }
      return null;
    };
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);
    expect(bytesOf(workspace.files.get(G_HEADER)!)).toEqual(original);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
  });

  it("보상 실패는 실제 실행 ID와 백업 위치 및 재시도 handle을 유지한다", async () => {
    await seedLastGoodAndManualEdit();
    const { run } = await secondRoundToReview();
    workspace.afterWrite = (path) => {
      if (path === G_HEADER) {
        workspace.failWrite = (p) => p === G_HEADER ? "offline" : null;
        return "response lost";
      }
      return null;
    };
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);
    const recovery = useTicketStore.getState().lastRun!;
    expect(useTicketStore.getState().acceptanceWarning).toContain(`${recovery.backupRoot}/files/`);
    expect(textOf(workspace, `${recovery.backupRoot}/files/${HEADER}`)).toBe(M_HEADER);
    workspace.offline = true;
    await restoreLastRun();
    expect(useTicketStore.getState().lastRun).toEqual(recovery);
    workspace.offline = false;
    workspace.failWrite = null;
    workspace.afterWrite = undefined;
    await restoreLastRun();
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
  });

  it("외부 프로젝트의 동일 바이트를 보존하면 소유 기록을 가져오지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    useDocumentStore.setState({ fileName: "other.json" });
    const before = textOf(workspace, GENERATION_MANIFEST_PATH);
    const { run } = await secondRoundToReview({ [HEADER]: M_HEADER, [CARD]: L_CARD });
    expect(useTicketStore.getState().overwriteReview?.items.every((i) => i.ownership === "foreign")).toBe(true);
    answerOverwriteReview({});
    await finish(run);
    expect(textOf(workspace, GENERATION_MANIFEST_PATH)).toBe(before);
    expect(generatedWrites()).toEqual([]);
  });

  it("부분 staging은 기존 정상 웨이브를 혼합하지 않는다", async () => {
    await seedLastGoodAndManualEdit();
    const run = runAllTickets();
    await tick();
    respond(currentRequest().id, { [HEADER]: N_HEADER, [CARD]: N_CARD });
    workspace.files.delete(`staging/${currentRequest().id}/${CARD}`);
    await tick();
    answerOverwriteReview({ [HEADER]: "overwrite" });
    await finish(run);
    expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
    expect(textOf(workspace, G_CARD)).toBe(L_CARD);
    expect(generatedWrites()).toEqual([]);
  });
});


it("보상 응답도 유실되어도 원본 바이트를 재확인한 뒤에만 복구 완료로 본다", async () => {
  await seedLastGoodAndManualEdit();
  const { run } = await secondRoundToReview();
  workspace.afterWrite = (path) => path === G_HEADER ? "response lost" : null;
  answerOverwriteReview({ [HEADER]: "overwrite" });
  await finish(run);
  expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
  expect(useTicketStore.getState().acceptanceWarning).toBeNull();
  expect(status("Header")?.error).toContain("되돌렸습니다");
});

it("출력 PUT 진행 중 Stop은 완료 후 보상하고 이전 manifest를 보존한다", async () => {
  await seedLastGoodAndManualEdit();
  const before = textOf(workspace, GENERATION_MANIFEST_PATH);
  const { run } = await secondRoundToReview();
  workspace.afterWrite = (path) => {
    if (path === G_HEADER) cancelTicketRun();
    return null;
  };
  answerOverwriteReview({ [HEADER]: "overwrite" });
  await finish(run);
  expect(textOf(workspace, G_HEADER)).toBe(M_HEADER);
  expect(textOf(workspace, G_CARD)).toBe(L_CARD);
  expect(textOf(workspace, GENERATION_MANIFEST_PATH)).toBe(before);
});

it("CAS 409에서 다른 writer의 동일 새 바이트를 보상 대상으로 오판하지 않는다", async () => {
  await seedLastGoodAndManualEdit();
  const { run } = await secondRoundToReview();
  workspace.beforeWrite = (path) => {
    if (path === G_HEADER) workspace.files.set(path, N_HEADER);
  };
  answerOverwriteReview({ [HEADER]: "overwrite" });
  await finish(run);
  expect(textOf(workspace, G_HEADER)).toBe(N_HEADER);
  expect(generatedWrites()).toEqual([]);
});
