import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "./fixtures/screen-relations-project.json";
import { runTransactionGates } from "@/features/editor/command/transactionGate";
import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { buildExportPayload } from "@/features/editor/store/exportSpec";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { seedSpec } from "@/features/editor/store/seedSpec";
import {
  loadStoredFileName,
  loadStoredSpec,
  readRecovery,
  RECOVERY_KEY,
  saveSpecToStorage,
  serializeStoredDocument,
  writeRecovery,
} from "@/features/editor/store/specStorage";
import { listUnnamedDrafts, UNNAMED_DRAFT_PREFIX } from "@/features/editor/store/unnamedDraftStore";

/**
 * 화면 관계 오류가 생긴 문서의 복원·저장 경계(#265 S1-2).
 *
 * S1-4 전에는 GUI 페이지 삭제(removePage)가 그 페이지를 가리키는 action을 정리하지 못하고
 * 첫 page를 다시 고르지도 않는다. 그 상태가 자동 저장된 뒤 새로고침 한 번에 작업이 seedSpec으로
 * 바뀌지 않도록 자동 저장 복원은 관계 오류만 남은 문서를 받는다. Open·Save·NL G3는 엄격하다.
 */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

function project(): ProjectSpec {
  return structuredClone(fixture) as unknown as ProjectSpec;
}

/** Open한 fixture에서 GUI로 페이지를 지운 결과(검증을 거치지 않는 경로). */
function afterRemovingPages(...pageIds: string[]): ProjectSpec {
  useEditorStore.getState().loadSpec(project());
  for (const id of pageIds) useEditorStore.getState().removePage(id);
  return useEditorStore.getState().spec;
}

/** 자동 저장을 한 뒤 새로고침한 것처럼 editorStore 모듈을 새로 읽어 초기 문서를 돌려준다. */
async function reloadEditor(): Promise<ProjectSpec> {
  vi.resetModules();
  const fresh = await import("@/features/editor/store/editorStore");
  return fresh.useEditorStore.getState().spec;
}

const DANGLING = { code: "action-target-missing", path: "/pages/login/nodes/loginButton/action/target" };
const MODAL_FIRST = { code: "first-page-kind", path: "/pageOrder/0" };

describe("관계 오류가 생긴 문서의 자동 저장 복원 (#265 S1-2)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["navigate 대상 페이지 삭제", ["dashboard"], [DANGLING]],
    ["첫 page들 삭제로 modal이 첫 화면", ["login", "dashboard"], [MODAL_FIRST]],
  ])("%s 뒤 새로고침해도 문서가 그대로 돌아오고 seedSpec으로 바뀌지 않는다", async (_label, removed, expected) => {
    const spec = afterRemovingPages(...removed);
    expect(validateProjectSpec(spec).issues.map(({ code, path }) => ({ code, path }))).toEqual(expected);

    saveSpecToStorage(spec, "login-flow.json");
    expect(loadStoredSpec()).toEqual(spec);
    expect(loadStoredFileName()).toBe("login-flow.json");

    const restored = await reloadEditor();
    expect(restored).toEqual(spec);
    expect(JSON.stringify(restored)).not.toBe(JSON.stringify(seedSpec));
  });

  it("탭 복구(sessionStorage)도 같은 문서를 돌려준다", () => {
    const spec = afterRemovingPages("dashboard");
    const document = { fileName: null, spec };
    expect(writeRecovery({ document, key: `${UNNAMED_DRAFT_PREFIX}tab`, baseline: null, conflicted: false })).toBe(true);
    expect(readRecovery()?.document.spec).toEqual(spec);
    expect(sessionStorage.getItem(RECOVERY_KEY)).not.toBeNull();
  });

  it.each([
    ["navigate 대상 페이지 삭제", ["dashboard"]],
    ["첫 page들 삭제로 modal이 첫 화면", ["login", "dashboard"]],
  ])("%s 뒤의 이름 없는 초안이 목록에 계속 보인다", (_label, removed) => {
    const spec = afterRemovingPages(...removed);
    const key = `${UNNAMED_DRAFT_PREFIX}relations`;
    localStorage.setItem(key, serializeStoredDocument({ fileName: null, spec }));
    expect(listUnnamedDrafts().map((draft) => [draft.key, draft.document.spec])).toEqual([[key, spec]]);
  });

  it.each([
    ["root 없음", (spec: ProjectSpec) => { spec.pages.login.root = "ghost"; }],
    ["스키마 위반", (spec: ProjectSpec) => { (spec.pages.login as unknown as Record<string, unknown>).extra = 1; }],
  ])("관계 오류에 구조 오류(%s)가 섞이면 전처럼 버린다", (_label, breakIt) => {
    const spec = structuredClone(afterRemovingPages("dashboard"));
    breakIt(spec);
    saveSpecToStorage(spec, null);
    expect(loadStoredSpec()).toBeUndefined();
    localStorage.setItem(`${UNNAMED_DRAFT_PREFIX}broken`, serializeStoredDocument({ fileName: null, spec }));
    expect(listUnnamedDrafts()).toEqual([]);
  });
});

describe("관계 오류가 생긴 문서의 엄격한 경로 (#265 S1-2)", () => {
  it.each([
    ["navigate 대상 페이지 삭제", ["dashboard"], [DANGLING]],
    ["첫 page들 삭제로 modal이 첫 화면", ["login", "dashboard"], [MODAL_FIRST]],
  ])("%s 뒤 Save는 ok:false와 이슈를 돌려준다", (_label, removed, expected) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = buildExportPayload(afterRemovingPages(...removed));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issueCount).toBe(expected.length);
    expect(result.issues.map(({ code, path }) => ({ code, path }))).toEqual(expected);
    warn.mockRestore();
  });

  it("Open은 관계 오류가 있는 파일을 거부한다(파일 자체는 건드리지 않는다)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseSpecJson(JSON.stringify(afterRemovingPages("dashboard")))).toEqual({ ok: false, issueCount: 1 });
    warn.mockRestore();
  });

  it("Undo 한 번이면 지운 대상 페이지와 함께 유효한 문서로 돌아오고 Save가 다시 된다", () => {
    afterRemovingPages("dashboard");
    useEditorStore.getState().undo();
    const spec = useEditorStore.getState().spec;
    expect(spec).toEqual(project());
    expect(buildExportPayload(spec).ok).toBe(true);
  });

  // 알려진 제약(S1-4에서 해소): 관계 오류가 남은 동안 NL G3는 관계와 무관한 편집도 거부한다.
  // 지금 사용자가 고칠 수 있는 길은 Undo 또는 해당 버튼 삭제뿐이다.
  it("관계 오류가 남은 문서에서는 NL G3가 다른 페이지의 무관한 편집도 거부한다", () => {
    const spec = afterRemovingPages("dashboard");
    const result = runTransactionGates(spec, "resetPassword", [
      { type: "updateNode", id: "title", path: "content", value: "새 제목" },
    ]);
    expect(result).toMatchObject({ ok: false, failure: { kind: "invalid", issues: [DANGLING] } });
  });
});
