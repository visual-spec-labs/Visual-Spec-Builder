import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 생성 파일의 프로젝트 소유권과 입력 버전 (이슈 #281, docs/26 "#281").
 *
 * **가상 시간 + 메모리 작업공간 fixture다.** 실제 실행기(`ui/ticketRunner.ts`)·생성 자리
 * (`ui/generationTarget.ts`)·확정(`ui/ticketOutputAcceptance.ts`)·Export 훑기(`ui/exportGeneratedCode.ts`)를
 * 그대로 돌리고, 작업공간 HTTP 클라이언트와 요청 잠금만 메모리 구현으로 바꿨다. 외부 에이전트는 테스트가
 * 요청의 `outputPath`에 파일을 써서 흉내 낸다 — 실제 모델 실행이 아니다.
 *
 * 시나리오마다 세 가지를 따로 본다: `generated/`의 실제 바이트(누가 무엇을 덮었나), 수용 기록의 신원
 * (프로젝트 ID·페이지·컴포넌트), Export 생성 세대 판정(현재/오래됨/부분/확인 불가).
 */

const workspace = vi.hoisted(() => ({
  files: new Map<string, string | Uint8Array>(),
  offline: false,
  beforeWrite: null as ((path: string) => void) | null,
  failWrite: null as ((path: string) => string | null) | null,
  log: [] as string[],
  /** 다른 탭이 티켓 요청 잠금을 쥐고 있다. */
  lockBusy: false,
  failRead: undefined as ((path: string) => boolean) | undefined,
  afterWrite: undefined as ((path: string) => void) | undefined,
}));

vi.mock("@/features/editor/ui/workspaceClient", async () =>
  (await import("./fixtures/memoryWorkspace")).memoryWorkspaceClient(workspace));

vi.mock("@/features/editor/ui/agentRequestLock", () => ({
  holdRequestLock: async (kind: string, owner: string) => workspace.lockBusy ? "busy" : ({
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

import { contentHash } from "@/features/editor/export/contentHash";
import {
  chooseOutputDir,
  isLegacyGeneratedPath,
  pageIdCaseConflicts,
  projectOutputDirName,
  ticketComponentKey,
  ticketInputFingerprint,
} from "@/features/editor/export/generationIdentity";
import {
  findProjectByFileName,
  GENERATION_MANIFEST_PATH,
  GENERATION_MANIFEST_PROTOCOL,
  parseGenerationManifest,
  type GenerationManifest,
} from "@/features/editor/export/generationManifest";
import type { ProjectSpec, ScreenSpec } from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { TICKET_PROTOCOL_VERSION, TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH, type TicketRequest } from "@/features/editor/ticket/ticketProtocol";
import { scanGeneratedCode } from "@/features/editor/ui/exportGeneratedCode";
import { forgetUnsavedGenerationProjects, recordProjectRename } from "@/features/editor/ui/generationTarget";
import {
  cancelTicketRun,
  isTicketPlanStale,
  PROJECT_CHANGED_TICKET_MESSAGE,
  runAllTickets,
  runOneTicket,
} from "@/features/editor/ui/ticketRunner";

import { resetMemoryWorkspace, textOf } from "./fixtures/memoryWorkspace";

const tick = () => vi.advanceTimersByTimeAsync(1000);

function compileCurrent(): void {
  const { activePageId, spec } = useEditorStore.getState();
  useTicketStore.getState().compile(activePageId, spec.pages[activePageId]);
}

/** 문서를 연다 — 새 문서 ID와 그 문서의 작업공간 파일 이름. */
function openDocument(spec: ProjectSpec | typeof seedSpec, fileName: string | null): void {
  useEditorStore.getState().loadSpec(structuredClone(spec));
  useDocumentStore.setState({ fileName });
  compileCurrent();
}

function currentRequest(): TicketRequest | null {
  const text = textOf(workspace, TICKET_REQUEST_PATH);
  return text === undefined ? null : (JSON.parse(text) as TicketRequest);
}

/** 에이전트 흉내 — 요청의 모든 티켓을 그 요청의 임시 출력에 쓰고 성공 응답을 남긴다. */
function agentCompletes(request: TicketRequest, mark: string): void {
  for (const ticket of request.tickets) {
    const keyword = ticket.kind === "page" ? "export default function" : "export function";
    workspace.files.set(ticket.outputPath, `${keyword} ${ticket.componentName}() { return null; } // ${mark}\n`);
  }
  workspace.files.set(TICKET_RESPONSE_PATH, JSON.stringify({
    protocol: TICKET_PROTOCOL_VERSION,
    requestId: request.id,
    results: request.tickets.map((ticket) => ({ ticketId: ticket.id, status: "done" })),
  }));
}

/**
 * 준비된 티켓을 끝까지(모든 웨이브) 전달하고 에이전트가 매번 성공한다. 처리한 요청들을 돌려준다.
 * `afterAgent`는 에이전트가 응답을 남긴 직후(GUI가 응답을 읽기 전) 다른 writer를 흉내 낼 때 쓴다.
 */
async function deliver(
  mark: string,
  start: () => Promise<void> = runAllTickets,
  afterAgent: (request: TicketRequest) => void = () => {},
): Promise<TicketRequest[]> {
  const run = start();
  const handled: TicketRequest[] = [];
  for (let round = 0; round < 20 && useTicketStore.getState().running; round++) {
    await tick();
    const request = currentRequest();
    if (request === null || handled.some((done) => done.id === request.id)) continue;
    handled.push(request);
    agentCompletes(request, mark);
    afterAgent(request);
  }
  await run;
  return handled;
}

function manifest(): GenerationManifest {
  return parseGenerationManifest(textOf(workspace, GENERATION_MANIFEST_PATH) ?? null);
}

async function exportScan() {
  const { activePageId, spec, documentId } = useEditorStore.getState();
  const scan = await scanGeneratedCode(spec.pages[activePageId], activePageId, {
    fileName: useDocumentStore.getState().fileName,
    documentId,
  });
  if (scan.kind !== "ready" || scan.freshness === null) throw new Error("Export 훑기 실패");
  const byTicket = Object.fromEntries(scan.freshness.tickets.map((entry) => [entry.ticketId, entry.freshness]));
  return { scan, freshness: scan.freshness, byTicket };
}

/** `generated/`에 일어난 쓰기(백업·기록·임시 출력 제외). */
function generatedWrites(): string[] {
  return workspace.log.filter((entry) => entry.includes(" generated/"));
}

/** 같은 화면 두 장(page1·page2)을 가진 프로젝트 — 컴포넌트 이름이 모두 같다. */
function twoPageProject(): ProjectSpec {
  return {
    version: "0.3",
    name: "Shop",
    pages: { page1: structuredClone(seedSpec.screen), page2: structuredClone(seedSpec.screen) },
    pageOrder: ["page1", "page2"],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  resetMemoryWorkspace(workspace);
  workspace.lockBusy = false;
  forgetUnsavedGenerationProjects();
  useTicketStore.setState({
    tickets: [], sourcePageId: null, sourcePage: null, sourceDocumentId: null, isOpen: false,
    running: false, runError: null, runErrorRetryable: false, wait: null, acceptanceWarning: null,
    overwriteReview: null, lastRun: null, restoreMessage: null, generation: 0,
  });
  openDocument(seedSpec, "shop.json");
});

afterEach(async () => {
  cancelTicketRun();
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
});

describe("신원과 자리 — 순수 함수", () => {
  it("프로젝트 폴더 후보는 파일 이름에서 오고, 대소문자·공백·예약 이름을 피하며, 쓰인 이름과 겹치면 번호를 붙인다", () => {
    expect(projectOutputDirName("shop.json")).toBe("shop");
    expect(projectOutputDirName("My Shop.json")).toBe("my-shop");
    expect(projectOutputDirName("쇼핑몰 v2.json")).toBe("쇼핑몰-v2");
    expect(projectOutputDirName("pages.json")).toBe("pages-project");
    expect(projectOutputDirName("...json")).toBe("project");
    expect(chooseOutputDir("shop", new Set(["shop", "shop-2"]))).toBe("shop-3");
    expect(isLegacyGeneratedPath("pages/Home.tsx")).toBe(true);
    expect(isLegacyGeneratedPath("shop/page1/pages/Home.tsx")).toBe(false);
  });

  it("컴포넌트 신원은 노드 ID라 이름을 바꿔도 같고, 컴포넌트 지문은 자기 하위 트리 밖의 편집에 흔들리지 않는다", () => {
    const screen = structuredClone(seedSpec.screen) as ScreenSpec;
    const [header] = compileTickets(screen).filter((ticket) => ticket.id === "Header");
    const page = compileTickets(screen).find((ticket) => ticket.kind === "page")!;

    const renamed = structuredClone(screen);
    renamed.nodes.header = { ...renamed.nodes.header, name: "TopBar" };
    const renamedHeader = compileTickets(renamed).find((ticket) => ticket.instances[0] === "header")!;
    expect(renamedHeader.componentName).toBe("TopBar");
    expect(ticketComponentKey(renamedHeader)).toBe(ticketComponentKey(header));

    // 카드 문구만 바꾼다 — Header 하위 트리 밖
    const cardEdited = structuredClone(screen);
    cardEdited.nodes.cardALabel = { ...cardEdited.nodes.cardALabel, content: "B" } as typeof cardEdited.nodes.cardALabel;
    expect(ticketInputFingerprint("page1", cardEdited, header)).toBe(ticketInputFingerprint("page1", screen, header));
    expect(ticketInputFingerprint("page1", cardEdited, page)).not.toBe(ticketInputFingerprint("page1", screen, page));

    // Header 안의 문구·색을 바꾼다 — A→B
    const titleEdited = structuredClone(screen);
    titleEdited.nodes.headerTitle = { ...titleEdited.nodes.headerTitle, content: "B", color: "#FF0000" } as typeof titleEdited.nodes.headerTitle;
    expect(ticketInputFingerprint("page1", titleEdited, header)).not.toBe(ticketInputFingerprint("page1", screen, header));
    // 같은 입력이라도 다른 페이지면 다른 지문이다
    expect(ticketInputFingerprint("page2", screen, header)).not.toBe(ticketInputFingerprint("page1", screen, header));
  });
});

describe("같은 이름이 서로 덮지 않는다", () => {
  it("다른 프로젝트의 같은 이름(Header·Card…)은 프로젝트마다 다른 자리에 확정되고 서로의 바이트·기록을 건드리지 않는다", async () => {
    await deliver("shop");
    const shopHeader = "generated/shop/page1/components/Header.tsx";
    expect(textOf(workspace, shopHeader)).toContain("// shop");

    openDocument(seedSpec, "blog.json");
    workspace.log.length = 0;
    const [first] = await deliver("blog");
    expect(first.generatedRoot).toBe("blog/page1");
    expect(generatedWrites().every((entry) => entry.includes(" generated/blog/page1/"))).toBe(true);
    expect(textOf(workspace, shopHeader)).toContain("// shop");
    expect(textOf(workspace, "generated/blog/page1/components/Header.tsx")).toContain("// blog");
    expect(useTicketStore.getState().overwriteReview).toBeNull();

    const shop = findProjectByFileName(manifest(), "shop.json")!;
    const blog = findProjectByFileName(manifest(), "blog.json")!;
    expect(shop.projectId).not.toBe(blog.projectId);
    expect(manifest().entries["shop/page1/components/Header.tsx"]?.projectId).toBe(shop.projectId);
    expect(manifest().entries["blog/page1/components/Header.tsx"]?.projectId).toBe(blog.projectId);
    expect((await exportScan()).freshness.overall).toBe("current");

    // 원래 프로젝트로 돌아가도 자기 출력이 현재다
    openDocument(seedSpec, "shop.json");
    const { freshness, scan } = await exportScan();
    expect(freshness.overall).toBe("current");
    expect(scan.location).toEqual({ layout: "project", root: "shop/page1", projectId: shop.projectId });
    // ZIP·검사는 자리 기준 경로라 배치가 #157 그대로다
    expect(scan.files.map((file) => file.path).sort()).toEqual(
      ["components/Card.tsx", "components/Content.tsx", "components/Header.tsx", "pages/DashboardPage.tsx"],
    );
  });

  it("대소문자만 다른 PageId(Login·login)는 생성 자리가 같은 폴더가 되므로 전달하지 않고 이유를 알린다", async () => {
    expect(pageIdCaseConflicts("Login", ["Login", "login", "LOGIN", "signup"])).toEqual(["LOGIN", "login"]);
    expect(pageIdCaseConflicts("signup", ["Login", "login", "signup"])).toEqual([]);

    const project: ProjectSpec = {
      version: "0.3",
      name: "Shop",
      pages: { Login: structuredClone(seedSpec.screen), login: structuredClone(seedSpec.screen) },
      pageOrder: ["Login", "login"],
    };
    openDocument(project, "shop.json");
    const run = runAllTickets();
    await tick();
    await run;

    expect(currentRequest()).toBeNull();
    expect(workspace.files.has(GENERATION_MANIFEST_PATH)).toBe(false);
    expect(generatedWrites()).toEqual([]);
    const { runError, runErrorRetryable, tickets } = useTicketStore.getState();
    expect(runError).toContain("대소문자만 다른 페이지");
    expect(runError).toContain('"login"');
    expect(runErrorRetryable).toBe(false);
    expect(tickets.every((ticket) => ticket.status === "pending")).toBe(true);
  });

  it("같은 프로젝트의 다른 페이지에 같은 컴포넌트 이름이 있어도 페이지마다 다른 자리를 쓴다", async () => {
    openDocument(twoPageProject(), "shop.json");
    await deliver("page1");
    useEditorStore.getState().selectPage("page2");
    compileCurrent();
    const [first] = await deliver("page2");

    expect(first.generatedRoot).toBe("shop/page2");
    expect(textOf(workspace, "generated/shop/page1/components/Header.tsx")).toContain("// page1");
    expect(textOf(workspace, "generated/shop/page2/components/Header.tsx")).toContain("// page2");
    const entries = manifest().entries;
    expect(entries["shop/page1/components/Header.tsx"]?.pageId).toBe("page1");
    expect(entries["shop/page2/components/Header.tsx"]?.pageId).toBe("page2");
    expect(entries["shop/page1/components/Header.tsx"]?.projectId).toBe(entries["shop/page2/components/Header.tsx"]?.projectId);
    expect((await exportScan()).freshness.overall).toBe("current");
    useEditorStore.getState().selectPage("page1");
    expect((await exportScan()).freshness.overall).toBe("current");
  });
});

describe("이름 변경·복사", () => {
  it("앱 안 이름 변경은 같은 프로젝트 ID·같은 폴더를 이어받아 Export가 현재이고, 재생성도 묻지 않고 백업 후 바꾼다", async () => {
    await deliver("A");
    const before = findProjectByFileName(manifest(), "shop.json")!;

    expect(await recordProjectRename("shop.json", "store.json")).toBeNull();
    useDocumentStore.setState({ fileName: "store.json" });
    const after = findProjectByFileName(manifest(), "store.json")!;
    expect(after.projectId).toBe(before.projectId);
    expect(after.project.outputDir).toBe("shop");
    expect(findProjectByFileName(manifest(), "shop.json")).toBeNull();
    expect((await exportScan()).freshness.overall).toBe("current");

    useEditorStore.getState().setNodeField("headerTitle", "content", "B");
    compileCurrent();
    const run = runOneTicket("Header");
    await tick();
    agentCompletes(currentRequest()!, "B");
    await tick();
    await run;
    expect(useTicketStore.getState().overwriteReview).toBeNull(); // #282에서는 foreign으로 물었다
    expect(textOf(workspace, "generated/shop/page1/components/Header.tsx")).toContain("// B");
    expect(manifest().entries["shop/page1/components/Header.tsx"]?.projectId).toBe(before.projectId);
    expect(Object.keys(manifest().projects)).toHaveLength(1);
  });

  it("앱 밖에서 이름을 바꾼(기록에 없는) 파일은 새 프로젝트로 보고, 옛 프로젝트의 출력을 자기 것으로 보이지 않는다", async () => {
    await deliver("A");
    useDocumentStore.setState({ fileName: "renamed-outside.json" });

    const { scan, freshness } = await exportScan();
    expect(scan.location).toEqual({ layout: "project", root: "renamed-outside/page1", projectId: null });
    expect(freshness.overall).toBe("missing");

    workspace.log.length = 0;
    await deliver("new");
    expect(generatedWrites().every((entry) => entry.includes(" generated/renamed-outside/page1/"))).toBe(true);
    expect(textOf(workspace, "generated/shop/page1/components/Header.tsx")).toContain("// A");
    expect(findProjectByFileName(manifest(), "renamed-outside.json")?.projectId)
      .not.toBe(findProjectByFileName(manifest(), "shop.json")?.projectId);
  });

  it("컴포넌트 이름을 바꾸면 같은 신원의 이전 이름 출력을 알아보고, 재생성 뒤에도 옛 파일은 지우지 않고 '이전 출력'으로 알린다", async () => {
    await deliver("A");
    useEditorStore.getState().setNodeField("header", "name", "TopBar");
    compileCurrent();

    const renamed = await exportScan();
    const topBar = renamed.freshness.tickets.find((entry) => entry.ticketId === "TopBar")!;
    expect(topBar.freshness).toBe("renamed");
    expect(topBar.previousPath).toBe("shop/page1/components/Header.tsx");
    expect(renamed.freshness.overall).not.toBe("current");
    expect(renamed.freshness.superseded).toEqual([{
      path: "shop/page1/components/Header.tsx",
      componentName: "Header",
      reason: "renamed",
      currentPath: "shop/page1/components/TopBar.tsx",
      changed: false,
    }]);

    await deliver("B");
    const after = await exportScan();
    expect(after.byTicket.TopBar).toBe("current");
    expect(textOf(workspace, "generated/shop/page1/components/Header.tsx")).toContain("// A");
    expect(after.freshness.superseded.map((output) => output.reason)).toEqual(["renamed"]);
    // 옛 파일도 ZIP에 함께 담기므로 전체는 아직 현재가 아니다(추가 파일도 판정에 넣는다, #282 감사 보강)
    expect(after.freshness.overall).toBe("partial");
    const entries = manifest().entries;
    expect(entries["shop/page1/components/TopBar.tsx"]?.componentKey).toBe(entries["shop/page1/components/Header.tsx"]?.componentKey);
    // 사람이 옛 파일을 지우면 현재다
    workspace.files.delete("generated/shop/page1/components/Header.tsx");
    expect((await exportScan()).freshness.overall).toBe("current");
  });
});

describe("입력 최신성", () => {
  it("A→B 텍스트·색 변경 뒤 이름·파일을 그대로 두면 파일·참조 검사는 4/4·오류 0이어도 현재 성공이 아니다", async () => {
    await deliver("A");
    const headerPath = "generated/shop/page1/components/Header.tsx";
    const bytesA = textOf(workspace, headerPath);
    expect((await exportScan()).freshness.overall).toBe("current");

    useEditorStore.getState().setNodeField("headerTitle", "content", "B 문구");
    useEditorStore.getState().setNodeField("headerTitle", "color", "#FF0000");
    const { scan, freshness, byTicket } = await exportScan();

    expect(textOf(workspace, headerPath)).toBe(bytesA); // 파일은 그대로
    expect(scan.report.coveredCount).toBe(4);
    expect(scan.report.errorCount).toBe(0);
    expect(byTicket.Header).toBe("stale");
    expect(byTicket.DashboardPage).toBe("stale");
    // Header 하위 트리 밖의 컴포넌트는 그대로 현재다(컴포넌트 단위 지문)
    expect(byTicket.Card).toBe("current");
    expect(freshness.overall).not.toBe("current");
    expect(freshness.overall).toBe("partial");
  });

  it("일부 파일만 B로 다시 만들면 그 파일만 현재이고 나머지는 오래됨이라 전체는 부분이다", async () => {
    await deliver("A");
    useEditorStore.getState().setNodeField("headerTitle", "content", "B 문구");
    compileCurrent();
    await deliver("B", () => runOneTicket("Header"));

    const { byTicket, freshness } = await exportScan();
    expect(byTicket.Header).toBe("current");
    expect(byTicket.DashboardPage).toBe("stale");
    expect(freshness.overall).toBe("partial");
    const header = manifest().entries["shop/page1/components/Header.tsx"]!;
    expect(header).toMatchObject({ inputScope: "component", componentKey: "component:header", ticketProtocol: TICKET_PROTOCOL_VERSION });

    // 남은 티켓까지 B로 끝내면 현재다
    await deliver("B");
    expect((await exportScan()).freshness.overall).toBe("current");
  });

  it("재컴파일 뒤 늦게 온 A의 응답·임시 출력은 확정되지 않고, A가 generated/에 직접 쓰면 확인 불가로 드러난다", async () => {
    await deliver("A0");
    useEditorStore.getState().setNodeField("headerTitle", "content", "A 문구");
    compileCurrent();
    const runA = runOneTicket("Header");
    await tick();
    const requestA = currentRequest()!;

    useEditorStore.getState().setNodeField("headerTitle", "content", "B 문구");
    compileCurrent(); // 취소 없이 "다시 생성" — 진행 중이던 A는 세대가 달라 버려진다
    await deliver("B", () => runOneTicket("Header"));
    const headerPath = "generated/shop/page1/components/Header.tsx";
    const bytesB = textOf(workspace, headerPath);
    expect(bytesB).toContain("// B");

    agentCompletes(requestA, "late-A"); // 늦은 A — 규약대로 임시 출력과 응답
    await vi.advanceTimersByTimeAsync(10_000);
    await runA; // A의 대기는 자기 응답을 보고 끝나지만 세대가 달라 아무것도 받지 않는다
    expect(textOf(workspace, headerPath)).toBe(bytesB);
    expect(manifest().entries["shop/page1/components/Header.tsx"]?.contentHash).toBe(contentHash(bytesB!));
    expect((await exportScan()).byTicket.Header).toBe("current");

    workspace.files.set(headerPath, "export function Header() { return null; } // late-A direct\n"); // 규약 무시
    const { byTicket, freshness } = await exportScan();
    expect(byTicket.Header).toBe("changed");
    expect(freshness.overall).toBe("unverifiable");
  });
});

describe("호환과 저장하지 않은 문서", () => {
  it("이전 배치(generated/pages·components)만 있으면 호환해서 보이되 주인을 모르므로 최신으로 인정하지 않는다", async () => {
    const legacy = {
      "pages/DashboardPage.tsx": "export default function DashboardPage() { return null; }\n",
      "components/Header.tsx": "export function Header() { return null; }\n",
      "components/Card.tsx": "export function Card() { return null; }\n",
      "components/Content.tsx": "export function Content() { return null; }\n",
    };
    for (const [path, content] of Object.entries(legacy)) workspace.files.set(`generated/${path}`, content);
    // #284 시절(protocol 1) 기록 — 바이트는 맞지만 주인이 파일 이름뿐이다
    workspace.files.set(GENERATION_MANIFEST_PATH, JSON.stringify({
      protocol: 1,
      entries: Object.fromEntries(Object.entries(legacy).map(([path, content]) => [path, {
        requestId: "old", ticketId: path.split("/")[1].replace(".tsx", ""), pageId: "page1",
        inputFingerprint: "sha256:old", contentHash: contentHash(content), acceptedAt: "2026-10-01T00:00:00.000Z",
        projectKey: "shop.json",
      }])),
    }));

    const before = await exportScan();
    expect(before.scan.location.layout).toBe("legacy");
    expect(before.scan.report.coveredCount).toBe(4);
    expect(before.byTicket.Header).toBe("foreign");
    expect(before.freshness.overall).toBe("unverifiable");

    await deliver("new");
    expect(textOf(workspace, "generated/components/Header.tsx")).toBe(legacy["components/Header.tsx"]); // 건드리지 않음
    const after = await exportScan();
    expect(after.scan.location.layout).toBe("project");
    expect(after.freshness.overall).toBe("current");
    expect(manifest().protocol).toBe(GENERATION_MANIFEST_PROTOCOL);
    expect(manifest().entries["components/Header.tsx"]?.projectId).toBeNull(); // 옛 기록은 주인 모름으로 남는다
  });

  it("저장하지 않은 문서는 세션 프로젝트 자리에 만들고, 처음 저장한 뒤 전달하면 그 파일 이름을 이어받는다", async () => {
    openDocument(seedSpec, null);
    const [first] = await deliver("draft");
    expect(first.generatedRoot).toBe("unsaved/page1");
    const sessionId = Object.keys(manifest().projects)[0];
    expect(manifest().projects[sessionId]?.fileName).toBeNull();
    expect((await exportScan()).freshness.overall).toBe("current");

    useDocumentStore.setState({ fileName: "draft.json" }); // 같은 문서를 처음 저장
    expect((await exportScan()).freshness.overall).toBe("current");
    useEditorStore.getState().setNodeField("headerTitle", "content", "B 문구");
    compileCurrent();
    await deliver("B");
    expect(findProjectByFileName(manifest(), "draft.json")?.projectId).toBe(sessionId);
    expect(Object.keys(manifest().projects)).toHaveLength(1);

    forgetUnsavedGenerationProjects(); // 새로고침해도 파일 이름으로 찾는다
    expect((await exportScan()).freshness.overall).toBe("current");
  });

  it("다른 탭이 티켓 잠금을 쥐고 있으면 생성 자리를 새로 기록하지 않고 전달하지 않는다 — 그 탭의 기록 갱신을 덮지 않는다", async () => {
    workspace.lockBusy = true;
    const run = runAllTickets();
    await tick();
    await run;
    expect(workspace.files.has(GENERATION_MANIFEST_PATH)).toBe(false);
    expect(currentRequest()).toBeNull();
    expect(useTicketStore.getState().runError).toContain("다른 탭");
    expect(await recordProjectRename("shop.json", "store.json")).toBeNull(); // 기록에 없는 프로젝트 — 할 일 없음
  });

  it("생성 기록이 이 앱보다 새 형식이면 덮어쓰지 않고 전달하지 않는다", async () => {
    const newer = JSON.stringify({ protocol: GENERATION_MANIFEST_PROTOCOL + 1, projects: {}, entries: {} });
    workspace.files.set(GENERATION_MANIFEST_PATH, newer);
    const run = runAllTickets();
    await tick();
    await run;

    expect(currentRequest()).toBeNull();
    expect(textOf(workspace, GENERATION_MANIFEST_PATH)).toBe(newer);
    expect(useTicketStore.getState().runError).toContain("새 형식");
    expect(useTicketStore.getState().tickets.every((ticket) => ticket.status === "pending")).toBe(true);
  });
});

describe("요청 중 기록이 새 형식이 되면", () => {
  const newer = JSON.stringify({ protocol: GENERATION_MANIFEST_PROTOCOL + 1, projects: {}, entries: {} });
  const firstWave = () => useTicketStore.getState().tickets.filter((ticket) => ticket.status !== "pending");

  it("계획 단계에서 멈추고 generated/에 아무것도 쓰지 않는다 — 기록도 그대로다", async () => {
    // 에이전트가 응답한 뒤, GUI가 응답을 읽기 전에 다른 writer가 기록을 새 형식으로 바꾼다
    await deliver("a", runAllTickets, () => workspace.files.set(GENERATION_MANIFEST_PATH, newer));

    expect(generatedWrites()).toEqual([]);
    expect(workspace.log.some((entry) => entry.includes(" backups/"))).toBe(false);
    expect(textOf(workspace, GENERATION_MANIFEST_PATH)).toBe(newer);
    expect(firstWave().length).toBeGreaterThan(0);
    expect(firstWave().every((ticket) => ticket.status === "failed" && ticket.error?.includes("새 형식"))).toBe(true);
    expect(useTicketStore.getState().lastRun).toBeNull();
  });

  it("계획 뒤 첫 쓰기 직전에 바뀌어도 쓰기 전에 다시 확인해 generated/에 아무것도 쓰지 않는다", async () => {
    // 되돌리기 계획(plan.json)은 재비교·재확인 전에 쓴다 — 그 순간 기록이 바뀌는 경우다
    workspace.beforeWrite = (path) => {
      if (path.endsWith("/plan.json")) workspace.files.set(GENERATION_MANIFEST_PATH, newer);
    };
    await deliver("a");

    expect(workspace.log.some((entry) => entry.endsWith("/plan.json"))).toBe(true);
    expect(generatedWrites()).toEqual([]);
    expect(textOf(workspace, GENERATION_MANIFEST_PATH)).toBe(newer);
    expect(firstWave().every((ticket) => ticket.status === "failed" && ticket.error?.includes("새 형식"))).toBe(true);
    expect(useTicketStore.getState().lastRun).toBeNull();
  });

  it("쓰기 뒤 기록 직전에 바뀌면 확정하지 않고 보상 경로로 넘긴다 — 출처를 증명하지 못한 파일은 지우지 않고 복구 확인 필요로 남긴다", async () => {
    workspace.beforeWrite = (path) => {
      if (path.startsWith("generated/")) workspace.files.set(GENERATION_MANIFEST_PATH, newer);
    };
    await deliver("a");

    const written = generatedWrites();
    expect(written.length).toBeGreaterThan(0);
    // 새 형식 기록은 해석하지 못하므로 손대지 않는다
    expect(textOf(workspace, GENERATION_MANIFEST_PATH)).toBe(newer);
    expect(firstWave().every((ticket) => ticket.status === "failed")).toBe(true);
    const { acceptanceWarning, lastRun } = useTicketStore.getState();
    expect(acceptanceWarning).toContain("복구 확인 필요");
    expect(acceptanceWarning).toContain("새 형식");
    // 보상은 기록으로 이 요청의 출력임을 증명할 때만 되돌린다(#282) — 남은 파일을 실행 기록으로 알린다
    expect(lastRun?.paths.length).toBe(written.length);
    for (const path of lastRun?.paths ?? []) expect(workspace.files.has(`generated/${path}`)).toBe(true);
  });
});

describe("요청 중 다른 이름으로 저장 (#281 리뷰)", () => {
  /** 실행이 끝날 때까지 시간을 보낸다(에이전트는 더 응답하지 않는다). */
  async function settle(run: Promise<void>): Promise<void> {
    for (let round = 0; round < 10 && useTicketStore.getState().running; round++) await tick();
    await run;
  }

  it("A 요청 → 다른 이름으로 저장 B → 늦은 A 응답: 어느 프로젝트에도 확정하지 않고, B의 티켓을 완료로 표시하지 않으며, 다음 웨이브를 B로 보내지 않는다", async () => {
    const run = runAllTickets();
    await tick();
    const requestA = currentRequest()!;
    expect(requestA.generatedRoot).toBe("shop/page1");
    const shopId = findProjectByFileName(manifest(), "shop.json")!.projectId;

    useDocumentStore.getState().setFileName("shop-copy.json", null); // 다른 이름으로 저장
    expect(isTicketPlanStale()).toBe(true);
    agentCompletes(requestA, "A");
    await settle(run);

    // 파일: generated/ 어디에도 쓰지 않았다. A의 출력은 A 요청의 임시 출력에 남는다
    expect(generatedWrites()).toEqual([]);
    expect(textOf(workspace, requestA.tickets[0].outputPath)).toContain("// A");
    // 티켓: 복사본의 계획에서 완료로 보이지 않는다
    expect(useTicketStore.getState().tickets.every((ticket) => ticket.status === "pending")).toBe(true);
    expect(useTicketStore.getState().runError).toBe(PROJECT_CHANGED_TICKET_MESSAGE);
    // 기록: 확정 기록이 없고, 복사본은 아직 프로젝트가 아니다
    expect(manifest().entries).toEqual({});
    expect(Object.keys(manifest().projects)).toEqual([shopId]);
    // 후속 웨이브: 요청이 없고, 낡은 계획으로 다시 눌러도 전달하지 않는다
    expect(currentRequest()).toBeNull();
    await runAllTickets();
    expect(currentRequest()).toBeNull();

    // 복사본에서 티켓을 다시 생성해 전달하면 복사본의 새 자리에 처음부터 만든다 — 원본 자리는 비어 있다
    compileCurrent();
    workspace.log.length = 0;
    const handled = await deliver("B");
    expect(handled.length).toBeGreaterThan(1);
    expect(handled.every((request) => request.generatedRoot === "shop-copy/page1")).toBe(true);
    expect(generatedWrites().every((entry) => entry.includes(" generated/shop-copy/page1/"))).toBe(true);
    expect([...workspace.files.keys()].some((path) => path.startsWith("generated/shop/"))).toBe(false);
    const copy = findProjectByFileName(manifest(), "shop-copy.json")!;
    expect(copy.projectId).not.toBe(shopId);
    expect(Object.values(manifest().entries).every((entry) => entry.projectId === copy.projectId)).toBe(true);
    expect((await exportScan()).freshness.overall).toBe("current");
  });

  it("확정 중(생성 기록을 쓰는 순간) 다른 이름으로 저장해도 복사본의 티켓을 완료로 표시하지 않고 다음 웨이브를 보내지 않는다", async () => {
    workspace.afterWrite = (path) => {
      if (path === GENERATION_MANIFEST_PATH && Object.keys(manifest().entries).length > 0) {
        useDocumentStore.getState().setFileName("shop-copy.json", null);
      }
    };
    const run = runAllTickets();
    await tick();
    const requestA = currentRequest()!;
    agentCompletes(requestA, "A");
    await settle(run);

    expect(useDocumentStore.getState().fileName).toBe("shop-copy.json");
    expect(useTicketStore.getState().tickets.every((ticket) => ticket.status === "pending")).toBe(true);
    expect(useTicketStore.getState().runError).toBe(PROJECT_CHANGED_TICKET_MESSAGE);
    expect(currentRequest()).toBeNull();
    // 확정 시점 전이라 보상했다 — 원본 자리에도 이 요청의 기록이 남지 않고, 복사본 자리는 없다
    expect(Object.values(manifest().entries).some((entry) => entry.requestId === requestA.id)).toBe(false);
    expect([...workspace.files.keys()].some((path) => path.startsWith("generated/shop-copy/"))).toBe(false);
  });

  it("앱 안 이름 변경은 같은 프로젝트라 요청 중이어도 같은 자리에 확정하고 다음 웨이브도 같은 자리로 이어 간다 — 잠금 때문에 못 남긴 이름 변경 기록은 그 다음 전달에서 고친다", async () => {
    const run = runAllTickets();
    await tick();
    const requestA = currentRequest()!;
    const shopId = findProjectByFileName(manifest(), "shop.json")!.projectId;

    // 요청이 티켓 잠금을 쥐고 있어 이름 변경을 기록하지 못한다 — 이름 변경 자체는 끝난다
    workspace.lockBusy = true;
    const warning = await recordProjectRename("shop.json", "store.json");
    workspace.lockBusy = false;
    expect(warning).toContain("이름 변경을 생성 기록에 남기지 못했습니다");
    expect(warning).toContain("다음에 전달할 때 기록을 다시 시도");
    useDocumentStore.getState().adoptRenamedFileName("store.json", null);
    expect(isTicketPlanStale()).toBe(false);

    agentCompletes(requestA, "A");
    const handled = [requestA];
    for (let round = 0; round < 20 && useTicketStore.getState().running; round++) {
      await tick();
      const request = currentRequest();
      if (request === null || handled.some((done) => done.id === request.id)) continue;
      handled.push(request);
      agentCompletes(request, "A");
    }
    await run;

    expect(handled.length).toBeGreaterThan(1);
    expect(handled.every((request) => request.generatedRoot === "shop/page1")).toBe(true);
    expect(useTicketStore.getState().tickets.every((ticket) => ticket.status === "done")).toBe(true);
    // 두 번째 웨이브의 자리 결정이 대기 중이던 이름 변경을 기록했다 — 같은 ID·같은 폴더
    expect(Object.keys(manifest().projects)).toEqual([shopId]);
    expect(findProjectByFileName(manifest(), "store.json")).toMatchObject({ projectId: shopId, project: { outputDir: "shop" } });
    expect((await exportScan()).freshness.overall).toBe("current");
  });
});

describe("이름 변경 기록 실패 (#281 리뷰)", () => {
  it("기록하지 못하면 이유와 복구 경로를 돌려주고, Export는 그 사이에도 같은 자리를 보며, 이 탭의 다음 전달이 같은 ID·같은 폴더로 기록을 고친다", async () => {
    await deliver("A");
    const shopId = findProjectByFileName(manifest(), "shop.json")!.projectId;

    workspace.lockBusy = true; // 다른 탭의 티켓 요청이 진행 중
    const warning = await recordProjectRename("shop.json", "store.json");
    workspace.lockBusy = false;
    expect(warning).toContain("다른 탭(창)의 티켓 요청이 진행 중");
    expect(warning).toContain("새로고침하거나 다른 탭에서 전달하면 새 프로젝트");
    expect(findProjectByFileName(manifest(), "shop.json")?.projectId).toBe(shopId); // 기록은 아직 옛 이름
    useDocumentStore.getState().adoptRenamedFileName("store.json", null);

    // 그 사이 Export: 옛 이름의 기록을 이 프로젝트로 이어받아 같은 자리를 "현재"로 본다
    const { scan, freshness } = await exportScan();
    expect(scan.location).toEqual({ layout: "project", root: "shop/page1", projectId: shopId });
    expect(freshness.overall).toBe("current");

    // 다음 전달: 같은 자리에 쓰고, 기록의 이름을 고친다 — 새 프로젝트를 만들지 않는다
    useEditorStore.getState().setNodeField("headerTitle", "content", "B");
    compileCurrent();
    const handled = await deliver("B", () => runOneTicket("Header"));
    expect(handled.map((request) => request.generatedRoot)).toEqual(["shop/page1"]);
    expect(Object.keys(manifest().projects)).toEqual([shopId]);
    expect(findProjectByFileName(manifest(), "store.json")?.projectId).toBe(shopId);
    expect(findProjectByFileName(manifest(), "shop.json")).toBeNull();
    expect(textOf(workspace, "generated/shop/page1/components/Header.tsx")).toContain("// B");
  });

  it("기록을 읽지 못해도 안내하고, 새로고침(대기 잊음) 뒤 전달은 새 프로젝트로 시작해 옛 출력을 덮지 않는다", async () => {
    await deliver("A");
    workspace.failRead = (path) => path === GENERATION_MANIFEST_PATH;
    const warning = await recordProjectRename("shop.json", "store.json");
    workspace.failRead = undefined;
    expect(warning).toContain("생성 기록을 읽지 못해");
    expect(warning).toContain("이름 변경은 완료됐습니다");

    useDocumentStore.getState().adoptRenamedFileName("store.json", null);
    forgetUnsavedGenerationProjects(); // 새로고침 흉내 — 이 탭의 기록 대기를 잊는다
    compileCurrent();
    workspace.log.length = 0;
    await deliver("new");
    expect(generatedWrites().every((entry) => entry.includes(" generated/store/page1/"))).toBe(true);
    expect(textOf(workspace, "generated/shop/page1/components/Header.tsx")).toContain("// A");
    expect(findProjectByFileName(manifest(), "store.json")?.projectId)
      .not.toBe(findProjectByFileName(manifest(), "shop.json")?.projectId);
  });
});

describe("Export 검사 불가 — 기록 없음과 읽기 실패를 가른다 (#281 리뷰)", () => {
  /** 이 문서·페이지를 훑는다(판정 전 결과 그대로). */
  async function scanAs(fileName: string) {
    const { activePageId, spec, documentId } = useEditorStore.getState();
    return scanGeneratedCode(spec.pages[activePageId], activePageId, { fileName, documentId });
  }

  it("기록 없음(확정된 404)이면 파일 이름 후보 폴더(직접 실행한 to-react 출력)를 '기록 없음'으로 보인다", async () => {
    workspace.files.set("generated/shop/page1/pages/Home.tsx", "export default function Home() { return null; } // direct\n");
    const scan = await scanAs("shop.json");
    expect(scan).toMatchObject({ kind: "ready", location: { layout: "project", root: "shop/page1", projectId: null } });
    if (scan.kind === "ready") {
      expect(scan.files.map((file) => file.path)).toEqual(["pages/Home.tsx"]);
      expect(scan.freshness?.overall).toBe("unverifiable");
    }
  });

  it("이름 변경 뒤 옛 이름을 다시 쓴 다른 프로젝트: 기록이 읽히면 남의 폴더를 고르지 않고, 읽기 실패면 추측하지 않고 검사 불가로 멈춘다", async () => {
    await deliver("store");
    expect(await recordProjectRename("shop.json", "store.json")).toBeNull(); // shop 폴더의 주인은 이제 store.json

    // 같은 이름(shop.json)으로 새로 만든 다른 프로젝트 — 기록에 없다. 후보 "shop"은 store.json이 쓰는 폴더다
    const fresh = await scanAs("shop.json");
    expect(fresh).toMatchObject({ kind: "ready", location: { layout: "unassigned" } });
    if (fresh.kind === "ready") expect(fresh.files).toEqual([]);

    workspace.failRead = (path) => path === GENERATION_MANIFEST_PATH; // HTTP 500·네트워크 오류
    const failed = await scanAs("shop.json");
    expect(failed.kind).toBe("unavailable");
    if (failed.kind === "unavailable") expect(failed.message).toContain("생성 기록(runtime/generation-manifest.json)을 읽지 못해");
    // 주인 쪽도 같다 — 기록 없이 자리를 정하지 않는다
    expect((await scanAs("store.json")).kind).toBe("unavailable");
  });

  it("같은 slug의 두 프로젝트(my shop·my-shop → my-shop·my-shop-2)는 기록이 읽힐 때만 각자의 폴더를 보고, 읽기 실패면 둘 다 검사 불가다", async () => {
    openDocument(seedSpec, "my shop.json");
    await deliver("space");
    openDocument(seedSpec, "my-shop.json");
    await deliver("dash");
    expect(Object.values(manifest().projects).map((project) => project.outputDir).sort()).toEqual(["my-shop", "my-shop-2"]);

    const space = await scanAs("my shop.json");
    const dash = await scanAs("my-shop.json");
    expect(space).toMatchObject({ kind: "ready", location: { root: "my-shop/page1" } });
    expect(dash).toMatchObject({ kind: "ready", location: { root: "my-shop-2/page1" } });
    if (dash.kind === "ready") expect(dash.files.every((file) => file.content.includes("// dash"))).toBe(true);

    workspace.failRead = (path) => path === GENERATION_MANIFEST_PATH;
    expect((await scanAs("my shop.json")).kind).toBe("unavailable");
    expect((await scanAs("my-shop.json")).kind).toBe("unavailable"); // 예전에는 "my-shop"(남의 폴더)을 골랐다
  });

  it.each([
    { name: "이 앱보다 새 형식", text: JSON.stringify({ protocol: GENERATION_MANIFEST_PROTOCOL + 1, projects: {}, entries: {} }), message: "새 형식" },
    { name: "손상(JSON 아님)", text: "{ 깨진 기록", message: "손상" },
    { name: "손상(모르는 모양)", text: JSON.stringify([1, 2]), message: "손상" },
  ])("기록이 $name이면 빈 기록으로 읽지 않고 검사 불가로 멈춘다", async ({ text, message }) => {
    workspace.files.set("generated/shop/page1/pages/Home.tsx", "export default function Home() { return null; }\n");
    workspace.files.set(GENERATION_MANIFEST_PATH, text);
    const scan = await scanAs("shop.json");
    expect(scan.kind).toBe("unavailable");
    if (scan.kind === "unavailable") expect(scan.message).toContain(message);
  });
});
