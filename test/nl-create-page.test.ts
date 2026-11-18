import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import fixture from "./fixtures/screen-relations-project.json";
import { applyCreatePageCommand, type CreatePageCommand } from "@/features/editor/command/createPageCommand";
import { buildNlRequest, parseNlResponse, NL_PROTOCOL_VERSION } from "@/features/editor/nl/nlProtocol";
import type { ProjectSpec, ScreenSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";

/**
 * 자연어 요청 한 번으로 **새 프로젝트 페이지**를 만드는 경로 (이슈 #497).
 *
 * 지켜야 하는 것 셋을 고정한다.
 * 1. 새 페이지의 id는 **GUI가 발급한다** — 응답이 다른 id를 들고 오면 기존 화면을 덮어쓸 수 있다.
 * 2. 실패하면 **빈 페이지도 남지 않는다** — GUI에서 페이지를 먼저 만드는 경로와 다른 점이 이것이다.
 * 3. 성공은 **Undo 한 단계**다 — 되돌리면 페이지와 활성 페이지가 함께 돌아간다.
 */

const project = () => structuredClone(fixture) as unknown as ProjectSpec;
const editor = () => useEditorStore.getState();
const ALLOCATED = "page-1";

function newPage(name = "Fashion"): ScreenSpec {
  return {
    name,
    size: { width: 1440, height: 900 },
    root: "root",
    nodes: {
      root: {
        type: "frame",
        name: "Root",
        box: { width: "fill", height: "fill" },
        layout: { direction: "column", gap: 16, padding: { top: 24, right: 24, bottom: 24, left: 24 }, mainAxis: "start", crossAxis: "stretch" },
        background: [{ type: "solid", color: "#FFFFFF" }],
        children: [{ node: "title" }],
      },
      title: {
        type: "text",
        name: "Title",
        box: { width: "fill", height: "auto" },
        content: "타이포그래피",
        color: "#111111",
        typography: { fontFamily: "Pretendard", fontSize: 48, fontWeight: 700, lineHeight: 56, letterSpacing: -1, textAlign: "left" },
      },
    },
  };
}

const command = (overrides: Partial<CreatePageCommand> = {}): CreatePageCommand =>
  ({ version: "0.1", type: "createPage", pageId: ALLOCATED, page: newPage(), ...overrides }) as CreatePageCommand;

beforeEach(() => editor().loadSpec(project()));

describe("applyCreatePageCommand — 후보 프로젝트를 검증한 뒤에만 돌려준다", () => {
  it("새 페이지를 pages와 pageOrder 끝에 더하고 원본은 바꾸지 않는다", () => {
    const spec = project();
    const before = structuredClone(spec);
    const result = applyCreatePageCommand(spec, command(), ALLOCATED);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.pageOrder).toEqual([...spec.pageOrder, ALLOCATED]);
    expect(result.spec.pages[ALLOCATED].name).toBe("Fashion");
    expect(spec).toEqual(before);
  });

  it("요청에서 발급한 id가 아니면 거부한다 — 기존 화면을 덮어쓰지 않는다", () => {
    const spec = project();
    const result = applyCreatePageCommand(spec, command({ pageId: "login" }), ALLOCATED);

    expect(result).toEqual({ ok: false, message: expect.stringContaining(ALLOCATED) });
    expect(spec.pages.login.name).toBe(project().pages.login.name);
  });

  it("이미 있는 id를 발급값으로 넘겨도 덮어쓰지 않는다", () => {
    expect(applyCreatePageCommand(project(), command({ pageId: "login" }), "login").ok).toBe(false);
  });

  it("modal·widget은 이 경로로 만들지 않는다 — 어디서 열리는지는 사용자가 정한다", () => {
    for (const kind of ["modal", "widget"] as const) {
      const result = applyCreatePageCommand(project(), command({ page: { ...newPage(), kind } }), ALLOCATED);
      expect(result.ok).toBe(false);
    }
  });

  it("스펙이 유효하지 않으면 거부한다 — 없는 자식을 가리키는 페이지가 그렇다", () => {
    const broken = newPage();
    (broken.nodes.root as { children: { node: string }[] }).children = [{ node: "없는노드" }];

    expect(applyCreatePageCommand(project(), command({ page: broken }), ALLOCATED).ok).toBe(false);
  });

  it("명령 버전과 스펙 모양을 먼저 본다", () => {
    expect(applyCreatePageCommand(project(), command({ version: "0.2" as "0.1" }), ALLOCATED).ok).toBe(false);
    expect(applyCreatePageCommand(project(), command({ page: null as unknown as ScreenSpec }), ALLOCATED).ok).toBe(false);
  });
});

describe("editorStore.applyNlCreatePageCommand — Undo 한 단계", () => {
  it("새 페이지를 활성화하고 되돌리면 페이지와 활성 페이지가 함께 돌아간다", () => {
    const before = editor().spec;
    const activeBefore = editor().activePageId;

    expect(editor().applyNlCreatePageCommand(command(), ALLOCATED).ok).toBe(true);
    expect(editor().activePageId).toBe(ALLOCATED);
    expect(editor().selectedId).toBeNull();
    expect(editor().spec.pageOrder.at(-1)).toBe(ALLOCATED);

    editor().undo();
    expect(editor().spec).toEqual(before);
    expect(editor().activePageId).toBe(activeBefore);
    expect(editor().spec.pages[ALLOCATED]).toBeUndefined();
  });

  it("실패하면 프로젝트·활성 페이지·history가 그대로다 — 빈 페이지가 남지 않는다", () => {
    const before = editor().spec;
    const history = editor().history;

    const result = editor().applyNlCreatePageCommand(command({ pageId: "dashboard" }), ALLOCATED);

    expect(result.ok).toBe(false);
    expect(editor().spec).toBe(before);
    expect(editor().history).toBe(history);
    expect(editor().activePageId).toBe(before.pageOrder[0]);
  });
});

describe("parseNlResponse — 새 페이지 명령은 닫힌 한 종류다", () => {
  const body = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    protocol: NL_PROTOCOL_VERSION, commandVersion: "0.3", requestId: "req-1",
    projectCommand: { version: "0.1", type: "createPage", pageId: ALLOCATED, page: newPage() },
    ...overrides,
  });

  it("protocol 2 · commandVersion 0.3 의 createPage 를 받는다", () => {
    const result = parseNlResponse(body(), "req-1");

    expect(result.kind).toBe("createPage");
    if (result.kind !== "createPage") return;
    expect(result.command.pageId).toBe(ALLOCATED);
    expect(result.command.page.name).toBe("Fashion");
  });

  it("화면 Command와 섞은 응답·모르는 필드·옛 버전은 거부한다", () => {
    const page = newPage();
    for (const broken of [
      { commands: [{ type: "updateNode", id: "root", path: "name", value: "x" }] },
      { projectCommand: { version: "0.1", type: "createPage", pageId: ALLOCATED, page, unexpected: true } },
      { projectCommand: { version: "0.1", type: "createPage", pageId: "", page } },
      { projectCommand: { version: "0.1", type: "createPage", pageId: ALLOCATED } },
      { projectCommand: { version: "0.1", type: "createPage", pageId: ALLOCATED, page: "스펙 아님" } },
      { projectCommand: { version: "0.2", type: "createPage", pageId: ALLOCATED, page } },
      { commandVersion: "0.2" },
    ]) expect(parseNlResponse(body(broken), "req-1").kind).toBe("malformed");
  });

  it("낡은 응답은 이번 요청의 답으로 쓰지 않는다", () => {
    expect(parseNlResponse(body({ requestId: "req-0" }), "req-1")).toEqual({ kind: "stale" });
  });

  it("설치되는 스킬의 createPage 예시가 그대로 파싱된다", () => {
    const skill = readFileSync(new URL("../skills/visual-spec-nl-response/SKILL.md", import.meta.url), "utf8");
    const example = skill.split("\n").find((line) => line.startsWith('{ "protocol": 2') && line.includes('"createPage"'));

    expect(example).toBeDefined();
    expect(parseNlResponse(example!.replace("<요청의 id 값>", "req-1"), "req-1").kind).toBe("createPage");
  });
});

describe("buildNlRequest — 새 페이지 범위의 요청 문맥", () => {
  const base = (spec: ProjectSpec) => ({ id: "req-1", instruction: "새 페이지 만들어줘", pageId: "login", page: spec.pages.login });
  const newPageScope = { kind: "newPage" as const, nodeId: null, label: "새 프로젝트 페이지" };

  it("새 페이지 범위에서만 발급한 id를 싣는다", () => {
    const spec = project();

    expect(buildNlRequest({ ...base(spec), scope: newPageScope, newPageId: ALLOCATED }).newPageId).toBe(ALLOCATED);
    expect(buildNlRequest({ ...base(spec), scope: { kind: "screen", nodeId: null, label: "화면" }, newPageId: ALLOCATED }))
      .not.toHaveProperty("newPageId");
  });

  it("asset 경로 목록은 있을 때만 싣는다 — 모델이 없는 파일을 짓지 않게 한다", () => {
    const spec = project();

    expect(buildNlRequest({ ...base(spec), scope: newPageScope, assets: ["assets/hero.png"] }).assets).toEqual(["assets/hero.png"]);
    expect(buildNlRequest({ ...base(spec), scope: newPageScope, assets: [] })).not.toHaveProperty("assets");
    expect(buildNlRequest({ ...base(spec), scope: newPageScope })).not.toHaveProperty("assets");
  });

  it("새 페이지 범위에서도 요청의 page는 지금 화면이다 — 읽기 전용 참조다", () => {
    const spec = project();
    const request = buildNlRequest({ ...base(spec), scope: newPageScope, project: spec, newPageId: ALLOCATED });

    expect(request.pageId).toBe("login");
    expect(request.destinations?.map((destination) => destination.pageId)).toEqual(spec.pageOrder);
  });
});
